"""Download Mac DeMarco's discography (titles + Spotify album URL) from MusicBrainz."""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

API = "https://musicbrainz.org/ws/2"
MAC_MBID = "f2492c31-54a8-4347-a1fc-f81f72873bbf"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "releases.json"
SPOTIFY_MARKER = "open.spotify.com/album/"
RETRIES = 3


def _get(url: str, contact: str, params: dict | None = None) -> dict:
    """GET JSON with 1 req/s, MB User-Agent, and exponential backoff on 5xx."""
    headers = {"User-Agent": f"macdemarco-birthday/0.1 ( {contact} )"}
    last = None
    for attempt in range(RETRIES):
        time.sleep(1)
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=30)
            if resp.status_code < 500:
                resp.raise_for_status()
                return resp.json()
            last = requests.HTTPError(f"{resp.status_code} for {url}")
        except (requests.ConnectionError, requests.Timeout) as exc:
            last = exc
        if attempt < RETRIES - 1:
            time.sleep(2**attempt)
    raise last


def _spotify_url(relations: list[dict]) -> str | None:
    for rel in relations or []:
        resource = (rel.get("url") or {}).get("resource", "")
        if SPOTIFY_MARKER in resource:
            return resource
    return None


def parse_release(payload: dict, release_group_title: str) -> dict:
    tracks = []
    for medium in payload.get("media", []):
        for track in medium.get("tracks", []):
            tracks.append({"title": track["title"], "position": len(tracks) + 1})
    return {
        "release_title": payload.get("title", release_group_title),
        "release_date": payload.get("date") or "",
        "spotify_album_url": _spotify_url(payload.get("relations", [])),
        "tracks": tracks,
    }


def _release_groups(contact: str) -> list[dict]:
    groups, offset = [], 0
    while True:
        page = _get(f"{API}/release-group", contact,
                    {"artist": MAC_MBID, "limit": 100, "offset": offset, "fmt": "json"})
        groups += page["release-groups"]
        offset += len(page["release-groups"])
        if not page["release-groups"] or offset >= page["release-group-count"]:
            return groups


def _choose_release(releases: list[dict]) -> dict | None:
    if not releases:
        return None
    with_spotify = [r for r in releases if _spotify_url(r.get("relations", []))]
    if with_spotify:
        return min(with_spotify, key=lambda r: r.get("date") or "9999")
    return min(releases, key=lambda r: r.get("date") or "9999")


def fetch_all(contact: str, refresh: bool = False) -> list[dict]:
    if OUT_PATH.exists() and not refresh:
        return json.loads(OUT_PATH.read_text())
    results = []
    for group in _release_groups(contact):
        listing = _get(f"{API}/release", contact,
                       {"release-group": group["id"], "status": "official",
                        "inc": "url-rels", "limit": 100, "fmt": "json"})
        chosen = _choose_release(listing.get("releases", []))
        if chosen is None:
            continue
        full = _get(f"{API}/release/{chosen['id']}", contact,
                    {"inc": "recordings+url-rels", "fmt": "json"})
        parsed = parse_release(full, group["title"])
        parsed["release_group"] = group["title"]
        results.append(parsed)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    tmp.replace(OUT_PATH)
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    contact = os.environ.get("MB_CONTACT")
    if not contact:
        sys.exit("MB_CONTACT env var is required (contact email for the MusicBrainz User-Agent).")
    releases = fetch_all(contact, refresh=args.refresh)
    print(f"{len(releases)} releases, "
          f"{sum(1 for r in releases if r['spotify_album_url'])} with Spotify URL")


if __name__ == "__main__":
    main()
