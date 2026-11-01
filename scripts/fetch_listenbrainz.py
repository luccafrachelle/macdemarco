"""Resolve Spotify track ids via the ListenBrainz Labs metadata lookup (no credentials).

Endpoint: POST https://labs.api.listenbrainz.org/spotify-id-from-metadata/json
Body: [{"artist_name", "release_name", "track_name"}, ...]
Response: same-order list of {"spotify_track_ids": [...]} (possibly empty).
"""
import json
import logging
import re
import time
from pathlib import Path

import requests

log = logging.getLogger(__name__)

API_URL = "https://labs.api.listenbrainz.org/spotify-id-from-metadata/json"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "listenbrainz.json"
USER_AGENT = "macdemarco-birthday/0.1"
ARTIST = "Mac DeMarco"
BATCH = 50
RETRIES = 3
TRACK_ID_RE = re.compile(r"^[A-Za-z0-9]{22}$")


def _post(batch: list[dict]) -> list[dict]:
    last = None
    for attempt in range(RETRIES):
        try:
            resp = requests.post(API_URL, json=batch,
                                 headers={"User-Agent": USER_AGENT}, timeout=60)
            if resp.status_code < 500:
                resp.raise_for_status()
                return resp.json()
            last = requests.HTTPError(f"{resp.status_code} from ListenBrainz")
        except (requests.ConnectionError, requests.Timeout) as exc:
            last = exc
        if attempt < RETRIES - 1:
            time.sleep(2**attempt)
    raise last


def _first_valid(entry) -> str | None:
    try:
        for tid in entry["spotify_track_ids"]:
            if isinstance(tid, str) and TRACK_ID_RE.match(tid):
                return tid
    except (KeyError, TypeError):
        pass
    return None


def lookup(items: list[dict]) -> list[str | None]:
    out: list[str | None] = []
    for start in range(0, len(items), BATCH):
        if start:
            time.sleep(1)
        batch = items[start:start + BATCH]
        data = _post(batch)
        if len(data) != len(batch):
            raise ValueError(f"ListenBrainz returned {len(data)} results for {len(batch)} items")
        out.extend(_first_valid(entry) for entry in data)
    return out


def fetch_all(wanted: list[dict], refresh: bool = False) -> dict[str, str]:
    """wanted: [{"release_name", "track_name"}]; returns {"release|track": track_id}."""
    cache: dict[str, str] = {}
    if OUT_PATH.exists() and not refresh:
        cache = json.loads(OUT_PATH.read_text())
    missing, seen = [], set()
    for w in wanted:
        key = f"{w['release_name']}|{w['track_name']}"
        if key not in cache and key not in seen:
            seen.add(key)
            missing.append(w)
    if not missing:
        return cache
    ids = lookup([{"artist_name": ARTIST, "release_name": w["release_name"],
                   "track_name": w["track_name"]} for w in missing])
    for w, tid in zip(missing, ids):
        if tid:
            cache[f"{w['release_name']}|{w['track_name']}"] = tid
        else:
            log.warning("no spotify id for %s | %s", w["release_name"], w["track_name"])
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, indent=2, ensure_ascii=False))
    tmp.replace(OUT_PATH)
    return cache
