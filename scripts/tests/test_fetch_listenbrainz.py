import json

import pytest
import requests

from scripts import fetch_listenbrainz as flb

A = "A" * 22
B = "B" * 22


class _Resp:
    def __init__(self, data, status=200):
        self._data, self.status_code = data, status

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(str(self.status_code))


def item(track, release="One Wayne G"):
    return {"artist_name": "Mac DeMarco", "release_name": release, "track_name": track}


@pytest.fixture(autouse=True)
def _nosleep(monkeypatch):
    monkeypatch.setattr(flb.time, "sleep", lambda s: None)


def test_lookup_batches_and_preserves_order(monkeypatch):
    sizes = []

    def fake_post(url, json=None, **kw):
        sizes.append(len(json))
        return _Resp([{"spotify_track_ids": [x["track_name"].ljust(22, "x")]} for x in json])

    monkeypatch.setattr(flb.requests, "post", fake_post)
    items = [item(f"t{i}") for i in range(120)]
    out = flb.lookup(items)
    assert sizes == [50, 50, 20]
    assert out == [f"t{i}".ljust(22, "x") for i in range(120)]


def test_lookup_empty_and_invalid_ids(monkeypatch):
    resp = [{"spotify_track_ids": []}, {"spotify_track_ids": ["bad!", A, B]},
            {"spotify_track_ids": ["short"]}]
    monkeypatch.setattr(flb.requests, "post", lambda *a, **k: _Resp(resp))
    assert flb.lookup([item("a"), item("b"), item("c")]) == [None, A, None]


def test_lookup_retries_on_5xx(monkeypatch):
    seq = [_Resp([], 503), _Resp([{"spotify_track_ids": [A]}])]
    monkeypatch.setattr(flb.requests, "post", lambda *a, **k: seq.pop(0))
    assert flb.lookup([item("a")]) == [A]


def test_fetch_all_cache_hit_no_request(tmp_path, monkeypatch):
    path = tmp_path / "lb.json"
    path.write_text(json.dumps({"One Wayne G|x": A}))
    monkeypatch.setattr(flb, "OUT_PATH", path)
    monkeypatch.setattr(flb.requests, "post", lambda *a, **k: pytest.fail("network"))
    out = flb.fetch_all([{"release_name": "One Wayne G", "track_name": "x"}])
    assert out == {"One Wayne G|x": A}


def test_fetch_all_partial_cache_fetches_missing_only(tmp_path, monkeypatch):
    path = tmp_path / "lb.json"
    path.write_text(json.dumps({"R|x": A}))
    monkeypatch.setattr(flb, "OUT_PATH", path)
    seen = []

    def fake_post(url, json=None, **kw):
        seen.extend(i["track_name"] for i in json)
        return _Resp([{"spotify_track_ids": [B]} for _ in json])

    monkeypatch.setattr(flb.requests, "post", fake_post)
    out = flb.fetch_all([{"release_name": "R", "track_name": "x"},
                         {"release_name": "R", "track_name": "y"}])
    assert seen == ["y"]
    assert out == {"R|x": A, "R|y": B}
    assert json.loads(path.read_text()) == out


def test_fetch_all_writes_only_found(tmp_path, monkeypatch):
    path = tmp_path / "lb.json"
    monkeypatch.setattr(flb, "OUT_PATH", path)
    monkeypatch.setattr(flb.requests, "post",
                        lambda *a, **k: _Resp([{"spotify_track_ids": [A]}, {"spotify_track_ids": []}]))
    out = flb.fetch_all([{"release_name": "R", "track_name": "x"},
                         {"release_name": "R", "track_name": "y"}])
    assert out == {"R|x": A}
