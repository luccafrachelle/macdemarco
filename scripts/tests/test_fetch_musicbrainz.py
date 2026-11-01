import copy
import json
from pathlib import Path

import pytest

from scripts.fetch_musicbrainz import parse_release

FIXTURE = Path(__file__).parent / "fixtures" / "mb_release.json"


@pytest.fixture
def fixture():
    return copy.deepcopy(json.loads(FIXTURE.read_text()))


def test_parse_release_tracks(fixture):
    r = parse_release(fixture, "One Wayne G")
    assert r["release_title"] == "One Wayne G"
    assert r["tracks"][0] == {"title": fixture["media"][0]["tracks"][0]["title"], "position": 1}
    assert len(r["tracks"]) == sum(len(m["tracks"]) for m in fixture["media"])


def test_parse_release_continuous_positions_across_media(fixture):
    fixture["media"].append(copy.deepcopy(fixture["media"][0]))
    r = parse_release(fixture, "x")
    assert [t["position"] for t in r["tracks"]] == list(range(1, len(r["tracks"]) + 1))


def test_parse_release_spotify_url(fixture):
    assert parse_release(fixture, "x")["spotify_album_url"].startswith("https://open.spotify.com/album/")


def test_parse_release_without_spotify(fixture):
    fixture["relations"] = []
    assert parse_release(fixture, "x")["spotify_album_url"] is None


def test_parse_release_missing_date(fixture):
    fixture.pop("date", None)
    assert parse_release(fixture, "x")["release_date"] == ""


# --- _get / fetch_all / main (no network) ---
import requests

from scripts import fetch_musicbrainz as fm


class FakeResp:
    def __init__(self, status=200, body=None):
        self.status_code = status
        self._body = body if body is not None else {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(str(self.status_code))

    def json(self):
        return self._body


@pytest.fixture
def sleeps(monkeypatch):
    calls = []
    monkeypatch.setattr(fm.time, "sleep", calls.append)
    return calls


def test_get_retries_on_503_with_backoff_then_succeeds(monkeypatch, sleeps):
    responses = [FakeResp(503), FakeResp(503), FakeResp(200, {"ok": 1})]
    seen = []

    def fake_get(url, params=None, headers=None, timeout=None):
        seen.append(headers)
        return responses.pop(0)

    monkeypatch.setattr(fm.requests, "get", fake_get)
    assert fm._get("http://x", "me@example.com") == {"ok": 1}
    assert len(seen) == 3
    assert seen[0]["User-Agent"] == "macdemarco-birthday/0.1 ( me@example.com )"
    # rate-limit 1s, fail, backoff 1s, rate-limit 1s, fail, backoff 2s, rate-limit 1s, ok
    assert sleeps == [1, 1, 1, 2, 1]


def test_get_exhausts_retries_and_raises_without_trailing_sleep(monkeypatch, sleeps):
    n = []
    monkeypatch.setattr(fm.requests, "get", lambda *a, **k: n.append(1) or FakeResp(503))
    with pytest.raises(requests.HTTPError):
        fm._get("http://x", "me@example.com")
    assert len(n) == 3
    # three attempts, backoff only between them (1s, 2s), none after the last
    assert sleeps == [1, 1, 1, 2, 1]


def test_fetch_all_failure_leaves_existing_file_untouched(monkeypatch, tmp_path, sleeps):
    out = tmp_path / "releases.json"
    out.write_text('["old"]')
    monkeypatch.setattr(fm, "OUT_PATH", out)
    monkeypatch.setattr(fm.requests, "get", lambda *a, **k: FakeResp(503))
    with pytest.raises(requests.HTTPError):
        fm.fetch_all("me@example.com", refresh=True)
    assert out.read_text() == '["old"]'


def test_fetch_all_cache_hit_makes_no_requests(monkeypatch, tmp_path):
    out = tmp_path / "releases.json"
    out.write_text('[{"release_title": "cached"}]')
    monkeypatch.setattr(fm, "OUT_PATH", out)

    def boom(*a, **k):
        raise AssertionError("network used")

    monkeypatch.setattr(fm.requests, "get", boom)
    assert fm.fetch_all("me@example.com") == [{"release_title": "cached"}]


def test_fetch_all_refresh_refetches_and_writes(monkeypatch, tmp_path, fixture, sleeps):
    out = tmp_path / "sub" / "releases.json"
    out.parent.mkdir()
    out.write_text('["old"]')
    monkeypatch.setattr(fm, "OUT_PATH", out)
    listing = {"releases": [{"id": "r1", "date": "2023", "relations": fixture["relations"]}]}

    def fake_get(url, params=None, headers=None, timeout=None):
        if url.endswith("/release-group"):
            return FakeResp(200, {"release-groups": [{"id": "g1", "title": "One Wayne G"}],
                                  "release-group-count": 1})
        if url.endswith("/release"):
            return FakeResp(200, listing)
        return FakeResp(200, fixture)

    monkeypatch.setattr(fm.requests, "get", fake_get)
    res = fm.fetch_all("me@example.com", refresh=True)
    assert len(res) == 1 and res[0]["release_group"] == "One Wayne G"
    assert json.loads(out.read_text()) == res


def test_main_aborts_without_mb_contact(monkeypatch):
    monkeypatch.delenv("MB_CONTACT", raising=False)
    monkeypatch.setattr(fm.sys, "argv", ["fetch_musicbrainz"])
    with pytest.raises(SystemExit) as exc:
        fm.main()
    assert "MB_CONTACT" in str(exc.value)
