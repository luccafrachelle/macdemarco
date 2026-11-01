import json
from pathlib import Path

import pytest
import requests

from scripts import fetch_spotify_embed as fse
from scripts.fetch_spotify_embed import album_id_from_url, parse_embed

FIXTURE = Path(__file__).parent / "fixtures" / "spotify_embed.html"


@pytest.fixture
def html():
    return FIXTURE.read_text(encoding="utf-8")


def test_album_id_from_url():
    assert album_id_from_url("https://open.spotify.com/album/abc123?si=x") == "abc123"


def test_parse_embed(html):
    tracks = parse_embed(html)
    assert len(tracks) > 0
    assert all(set(t) == {"title", "track_id"} for t in tracks)
    assert all(len(t["track_id"]) == 22 for t in tracks)


def test_parse_embed_garbage_returns_empty():
    assert parse_embed("<html></html>") == []


def test_parse_embed_bad_json_returns_empty():
    html = '<script id="__NEXT_DATA__" type="application/json">{nope</script>'
    assert parse_embed(html) == []


class _Resp:
    def __init__(self, text, status=200):
        self.text, self.status_code = text, status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(str(self.status_code))


def test_fetch_all_dedupes_skips_null_and_warns(tmp_path, monkeypatch, html, caplog):
    monkeypatch.setattr(fse, "OUT_PATH", tmp_path / "spotify_tracks.json")
    monkeypatch.setattr(fse.time, "sleep", lambda s: None)
    calls = []

    def fake_get(url, **kw):
        calls.append(url)
        return _Resp(html if "70hX7IYqmUGV97OXs2v848" in url else "<html></html>")

    monkeypatch.setattr(fse.requests, "get", fake_get)
    releases = [
        {"spotify_album_url": "https://open.spotify.com/album/70hX7IYqmUGV97OXs2v848"},
        {"spotify_album_url": "https://open.spotify.com/album/70hX7IYqmUGV97OXs2v848?si=1"},
        {"spotify_album_url": None},
        {"spotify_album_url": "https://open.spotify.com/album/emptyalbum"},
    ]
    with caplog.at_level("WARNING"):
        out = fse.fetch_all(releases)
    assert len(calls) == 2
    assert calls[0] == "https://open.spotify.com/embed/album/70hX7IYqmUGV97OXs2v848"
    assert len(out["70hX7IYqmUGV97OXs2v848"]) > 0
    assert out["emptyalbum"] == []
    assert "album emptyalbum: no tracks parsed" in caplog.text
    assert json.loads((tmp_path / "spotify_tracks.json").read_text()) == out


def test_fetch_all_uses_cache(tmp_path, monkeypatch):
    path = tmp_path / "spotify_tracks.json"
    path.write_text('{"a": []}')
    monkeypatch.setattr(fse, "OUT_PATH", path)
    monkeypatch.setattr(fse.requests, "get", lambda *a, **k: pytest.fail("network"))
    assert fse.fetch_all([{"spotify_album_url": "https://open.spotify.com/album/zzz"}]) == {"a": []}
