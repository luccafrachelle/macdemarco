import pytest

from scripts.build_db import build, normalize

A = "A" * 22
B = "B" * 22
C = "C" * 22


def rel(title, date, url, tracks):
    return {"release_title": title, "release_date": date, "spotify_album_url": url,
            "tracks": [{"title": t, "position": i + 1} for i, t in enumerate(tracks)]}


def url(album_id):
    return f"https://open.spotify.com/album/{album_id}"


def test_normalize():
    assert normalize("  20190805  Mac-Baby! ") == "20190805 macbaby"


def test_days_has_366_keys():
    db = build([], {})
    assert len(db["days"]) == 366 and "02-29" in db["days"] and db["songs"] == []


def test_song_with_exact_link():
    releases = [rel("One Wayne G", "2015", url("alb1"), ["20190805 Mac Baby"])]
    spotify = {"alb1": [{"title": "20190805 Mac Baby", "track_id": A}]}
    s = build(releases, spotify)["songs"][0]
    assert s == {"title": "20190805 Mac Baby", "date": "2019-08-05", "md": "08-05",
                 "album": "One Wayne G", "spotify": "https://open.spotify.com/track/" + A,
                 "exact_link": True}


def test_fallback_search_link():
    s = build([rel("X", "2023", None, ["20200101 Foo"])], {})["songs"][0]
    assert s["exact_link"] is False
    assert s["spotify"] == "https://open.spotify.com/search/20200101%20Foo%20mac%20demarco"


def test_dedupe_prefers_oldest_with_spotify():
    t = "20190805 Mac Baby"
    releases = [
        rel("Single", "2022-05-01", None, [t]),
        rel("Deluxe", "2024", url("alb3"), [t]),
        rel("One Wayne G", "2023-01-01", url("alb2"), [t]),
    ]
    spotify = {"alb2": [{"title": t, "track_id": B}], "alb3": [{"title": t, "track_id": C}]}
    db = build(releases, spotify)
    assert len(db["songs"]) == 1
    assert db["songs"][0]["album"] == "One Wayne G"
    assert db["songs"][0]["spotify"].endswith(B)


def test_dedupe_no_match_uses_oldest_overall():
    t = "20190805 Mac Baby"
    releases = [rel("Late", "2024", None, [t]), rel("Early", "2020", None, [t]),
                rel("Undated", "", None, [t])]
    db = build(releases, {})
    assert len(db["songs"]) == 1 and db["songs"][0]["album"] == "Early"


def test_titles_without_date_dropped():
    db = build([rel("Salad Days", "2014", None, ["Salad Days"])], {})
    assert db["songs"] == []


def test_days_index_sorted():
    releases = [rel("R", "2020", None, ["20190805 B", "20180805 A"])]
    db = build(releases, {})
    assert [db["songs"][i]["date"] for i in db["days"]["08-05"]] == ["2018-08-05", "2019-08-05"]


def test_songs_sorted_by_md_then_date():
    releases = [rel("R", "2020", None, ["20190805 B", "20190101 C", "20180805 A"])]
    songs = build(releases, {})["songs"]
    assert [s["md"] for s in songs] == ["01-01", "08-05", "08-05"]
    assert songs[1]["date"] == "2018-08-05"


def test_generated_at_format():
    import re
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", build([], {})["generated_at"])
