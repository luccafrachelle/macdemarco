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
