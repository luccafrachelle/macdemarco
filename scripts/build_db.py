"""Build src/data/songs.json from MusicBrainz + Spotify caches (spec 3.4 / 4)."""
import argparse
import datetime
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote

from scripts.extract_dates import extract_date
from scripts.fetch_spotify_embed import album_id_from_url

ROOT = Path(__file__).resolve().parent.parent
RELEASES_PATH = ROOT / "data" / "raw" / "releases.json"
SPOTIFY_PATH = ROOT / "data" / "raw" / "spotify_tracks.json"
OUT_PATH = ROOT / "src" / "data" / "songs.json"


def normalize(title: str) -> str:
    text = re.sub(r"[^a-z0-9 ]", "", title.lower())
    return re.sub(r" +", " ", text).strip()


def _date_key(release: dict) -> tuple:
    d = release.get("release_date") or ""
    return (d == "", d)  # "" sorts last


def _track_id(release: dict, spotify: dict, norm: str):
    url = release.get("spotify_album_url")
    if not url:
        return None
    try:
        album_id = album_id_from_url(url)
    except ValueError:
        return None
    for t in spotify.get(album_id, []):
        if normalize(t["title"]) == norm:
            return t["track_id"]
    return None


def build(releases: list[dict], spotify: dict[str, list[dict]]) -> dict:
    chosen: dict[str, tuple] = {}  # norm -> (rank, title, release, track_id)
    for release in releases:
        for track in release.get("tracks", []):
            norm = normalize(track["title"])
            if not norm:
                continue
            tid = _track_id(release, spotify, norm)
            rank = (tid is None,) + _date_key(release)
            if norm not in chosen or rank < chosen[norm][0]:
                chosen[norm] = (rank, track["title"], release, tid)

    songs = []
    for _, title, release, tid in chosen.values():
        d = extract_date(title)
        if d is None:
            continue
        if tid:
            link, exact = f"https://open.spotify.com/track/{tid}", True
        else:
            link, exact = "https://open.spotify.com/search/" + quote(f"{title} mac demarco"), False
        songs.append({"title": title, "date": d.isoformat(), "md": d.strftime("%m-%d"),
                      "album": release["release_title"], "spotify": link, "exact_link": exact})
    songs.sort(key=lambda s: (s["md"], s["date"], s["title"]))

    base = datetime.date(2024, 1, 1)
    days = {(base + datetime.timedelta(n)).strftime("%m-%d"): [] for n in range(366)}
    for i, s in enumerate(songs):
        days[s["md"]].append(i)
    generated = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"generated_at": generated, "songs": songs, "days": days}


def stats(db: dict) -> str:
    songs, days = db["songs"], db["days"]
    exact = sum(s["exact_link"] for s in songs)
    empty = [k for k, v in days.items() if not v]
    return "\n".join([
        f"songs con fecha: {len(songs)}",
        f"días cubiertos {366 - len(empty)}/366",
        f"links exactos {exact} / fallback {len(songs) - exact}",
        f"días vacíos ({len(empty)}): {', '.join(empty)}",
    ])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()

    if args.refresh or not RELEASES_PATH.exists():
        from scripts.fetch_musicbrainz import fetch_all as fetch_mb
        contact = os.environ.get("MB_CONTACT")
        if not contact:
            sys.exit("MB_CONTACT env var is required to fetch MusicBrainz data")
        releases = fetch_mb(contact, refresh=args.refresh)
    else:
        releases = json.loads(RELEASES_PATH.read_text(encoding="utf-8"))

    if args.refresh or not SPOTIFY_PATH.exists():
        from scripts.fetch_spotify_embed import fetch_all as fetch_sp
        spotify = fetch_sp(releases, refresh=args.refresh)
    else:
        spotify = json.loads(SPOTIFY_PATH.read_text(encoding="utf-8"))

    db = build(releases, spotify)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(stats(db))


if __name__ == "__main__":
    main()
