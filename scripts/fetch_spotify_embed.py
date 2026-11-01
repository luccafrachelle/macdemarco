"""Resolve exact Spotify track ids per album from the public embed page (no credentials).

Page: https://open.spotify.com/embed/album/{id}
Track list path inside <script id="__NEXT_DATA__">:
    props.pageProps.state.data.entity.trackList[]  -> {"title", "uri": "spotify:track:<22-char id>"}
Note: the embed truncates long albums (observed: 100 tracks max).
"""
import argparse
import json
import logging
import re
import time
from pathlib import Path

import requests

log = logging.getLogger(__name__)

EMBED_URL = "https://open.spotify.com/embed/album/{}"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "spotify_tracks.json"
RELEASES_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "releases.json"
USER_AGENT = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
RETRIES = 3
NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)
TRACK_URI_RE = re.compile(r"^spotify:track:([A-Za-z0-9]{22})$")
ALBUM_ID_RE = re.compile(r"/album/([A-Za-z0-9]+)")


def album_id_from_url(url: str) -> str:
    match = ALBUM_ID_RE.search(url)
    if not match:
        raise ValueError(f"not a Spotify album url: {url}")
    return match.group(1)


def parse_embed(html: str) -> list[dict]:
    match = NEXT_DATA_RE.search(html)
    if not match:
        return []
    try:
        data = json.loads(match.group(1))
        track_list = data["props"]["pageProps"]["state"]["data"]["entity"]["trackList"]
        tracks = []
        for item in track_list:
            uri = TRACK_URI_RE.match(item["uri"])
            if uri:
                tracks.append({"title": item["title"], "track_id": uri.group(1)})
        return tracks
    except (KeyError, ValueError, TypeError):
        return []


def _get_html(album_id: str) -> str:
    last = None
    for attempt in range(RETRIES):
        time.sleep(1)
        try:
            resp = requests.get(EMBED_URL.format(album_id),
                                headers={"User-Agent": USER_AGENT}, timeout=30)
            if resp.status_code < 500:
                resp.raise_for_status()
                return resp.text
            last = requests.HTTPError(f"{resp.status_code} for album {album_id}")
        except (requests.ConnectionError, requests.Timeout) as exc:
            last = exc
        if attempt < RETRIES - 1:
            time.sleep(2**attempt)
    raise last


def fetch_all(releases: list[dict], refresh: bool = False) -> dict[str, list[dict]]:
    if OUT_PATH.exists() and not refresh:
        return json.loads(OUT_PATH.read_text())
    album_ids = []
    for release in releases:
        url = release.get("spotify_album_url")
        if url and album_id_from_url(url) not in album_ids:
            album_ids.append(album_id_from_url(url))
    results = {}
    for album_id in album_ids:
        tracks = parse_embed(_get_html(album_id))
        if not tracks:
            log.warning("album %s: no tracks parsed", album_id)
        results[album_id] = tracks
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    tmp.replace(OUT_PATH)
    return results


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    releases = json.loads(RELEASES_PATH.read_text())
    results = fetch_all(releases, refresh=args.refresh)
    print(f"{len(results)} albums, {sum(1 for t in results.values() if t)} with tracks, "
          f"{sum(len(t) for t in results.values())} tracks total")


if __name__ == "__main__":
    main()
