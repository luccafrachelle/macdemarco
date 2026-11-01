# Mac DeMarco Birthday Songs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pipeline Python que extrae fechas de los títulos de canciones de Mac DeMarco a un JSON de 366 días, y un sitio Astro estático (GitHub Pages) que dado un cumpleaños muestra la canción exacta o la más cercana con link a Spotify.

**Architecture:** Dos mitades desacopladas por `src/data/songs.json`. Build-time: `scripts/` (Python stdlib + `requests`) scrapea MusicBrainz y el embed público de Spotify, cachea en `data/raw/`, y genera el JSON. Runtime: página Astro única con JS vanilla que importa el JSON en build; sin requests en runtime.

**Tech Stack:** Python 3.11+, `requests`, `pytest`; Node 20+, Astro 5, TypeScript, `vitest`; GitHub Actions (`withastro/action`, `actions/deploy-pages`).

**Spec:** `docs/superpowers/specs/2026-11-01-mac-demarco-birthday-design.md`

## Global Constraints

- MusicBrainz: máximo 1 req/s, header `User-Agent: macdemarco-birthday/0.1 ( <CONTACT_EMAIL> )` — el email lo provee el usuario vía env var `MB_CONTACT`; el script aborta si falta.
- Spotify: sin credenciales; solo `https://open.spotify.com/embed/album/{id}`, 1 s entre requests.
- `days` tiene exactamente 366 claves `MM-DD`, incluye `02-29`.
- Comparación solo por día+mes; distancia circular módulo 366 sobre año de referencia 2024.
- Formatos ambiguos tipo `3/4` no se interpretan como fecha.
- Paleta: `--paper #f3ecdf`, `--ink #2b2118`, `--ink-soft #6b5a4a`, `--cell-empty #3a2f26`, `--green-1 #9be9a8`, `--green-2 #40c463`, `--green-3 #30a14e`, `--green-4 #216e39`, `--accent #c8553d`.
- Fuentes: Instrument Serif (titulares), JetBrains Mono (fechas/UI), desde Google Fonts.
- Todo link/asset interno usa `import.meta.env.BASE_URL`. Sin modo oscuro. Animaciones respetan `prefers-reduced-motion`.
- El pipeline Python no corre en el deploy; `songs.json` y `data/raw/` se commitean.
- Footer aclara: proyecto fan no oficial.

## Review Focus

1. Títulos con números que no son fechas (`"2"`, `"Chamber of Reflection 2014 Demo"`, `"1000"`, `"20191231000"`) → no deben producir fecha. Test en Task 1.
2. Mismo título normalizado en distintos releases (single + álbum + deluxe) → una sola canción, link del release más antiguo con Spotify. Test en Task 4.
3. Hash inválido en la URL (`#13-45`, `#02-30`, `#hola`) → se ignora sin romper la página. Test en Task 5 (`parseHash`).
4. Cambiar de mes con un día ya elegido que no existe en el nuevo mes (31 → febrero) → el día se ajusta al máximo válido. Test en Task 5 (`clampDay`).
5. Deploy bajo subpath `/<repo>/` → fuentes, favicon y JSON cargan; verificado con `astro preview` en Task 8.

---

### Task 1: Scaffold Python + `extract_date`

**Files:**
- Create: `scripts/__init__.py`, `scripts/extract_dates.py`, `scripts/tests/__init__.py`, `scripts/tests/test_extract_dates.py`, `requirements.txt` (`requests`, `pytest`), `.gitignore` (`node_modules/`, `dist/`, `.astro/`, `__pycache__/`, `.venv/`, `.env`)

**Interfaces:**
- Produces: `extract_date(title: str) -> datetime.date | None`

- [ ] **Step 1: `git init`, crear venv, `pip install -r requirements.txt`**

- [ ] **Step 2: Write the failing tests**

```python
from datetime import date
from scripts.extract_dates import extract_date

def test_yyyymmdd(): assert extract_date("20190805 Mac Baby") == date(2019, 8, 5)
def test_yyyymmdd_only(): assert extract_date("20180914") == date(2018, 9, 14)
def test_impossible_date_rejected(): assert extract_date("20190231 Song") is None
def test_leap_day(): assert extract_date("20200229") == date(2020, 2, 29)
def test_non_leap_feb29_rejected(): assert extract_date("20190229") is None
def test_long_number_not_date(): assert extract_date("20191231000") is None
def test_iso_separators(): assert extract_date("Demo 2015-03-07") == date(2015, 3, 7)
def test_month_name_sept(): assert extract_date("Sept 13th Jam") == date(2000, 9, 13)
def test_month_name_full(): assert extract_date("September 13") == date(2000, 9, 13)
def test_month_abbrev(): assert extract_date("jan. 2nd") == date(2000, 1, 2)
def test_ambiguous_slash_ignored(): assert extract_date("3/4") is None
def test_plain_numbers_ignored():
    for t in ["2", "1000", "Chamber of Reflection 2014 Demo", "Salad Days"]:
        assert extract_date(t) is None
```

Fechas sin año usan año centinela **2000** (bisiesto, así `Feb 29` es válido).

- [ ] **Step 3: Run** `pytest scripts/tests/test_extract_dates.py -v` → FAIL (ImportError)

- [ ] **Step 4: Implement `extract_date` en `scripts/extract_dates.py`**

Tres regex del spec §3.3 en orden; por cada match construir `date(...)` en `try/except ValueError` y seguir con el próximo match/patrón si falla. Patrón de mes: `Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|June?|July?|Aug(ust)?|Sep(t(ember)?)?|Oct(ober)?|Nov(ember)?|Dec(ember)?`, `re.IGNORECASE`, con `\b` a ambos lados y día `(\d{1,2})(?!\d)`.

- [ ] **Step 5: Run** tests → PASS

- [ ] **Step 6: Commit** `feat: extract dates from song titles`

---

### Task 2: Fetcher de MusicBrainz

**Files:**
- Create: `scripts/fetch_musicbrainz.py`, `scripts/tests/test_fetch_musicbrainz.py`, `scripts/tests/fixtures/mb_release.json` (respuesta real recortada de `GET /ws/2/release/{id}?inc=recordings+url-rels&fmt=json`)

**Interfaces:**
- Produces:
  - `parse_release(payload: dict, release_group_title: str) -> dict` → `{"release_title": str, "release_date": str, "spotify_album_url": str | None, "tracks": [{"title": str, "position": int}]}`
  - `fetch_all(contact: str, refresh: bool = False) -> list[dict]` → escribe y devuelve `data/raw/releases.json`
  - CLI: `MB_CONTACT=... python -m scripts.fetch_musicbrainz [--refresh]`

- [ ] **Step 1: Write the failing tests**

```python
def test_parse_release_tracks(fixture):
    r = parse_release(fixture, "One Wayne G")
    assert r["release_title"] == "One Wayne G"
    assert r["tracks"][0] == {"title": fixture["media"][0]["tracks"][0]["title"], "position": 1}
    assert len(r["tracks"]) == sum(len(m["tracks"]) for m in fixture["media"])

def test_parse_release_spotify_url(fixture):
    assert parse_release(fixture, "x")["spotify_album_url"].startswith("https://open.spotify.com/album/")

def test_parse_release_without_spotify(fixture):
    fixture["relations"] = []
    assert parse_release(fixture, "x")["spotify_album_url"] is None
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

`parse_release`: aplana `media[].tracks[]` numerando `position` de forma continua; busca en `relations` un `url.resource` que contenga `open.spotify.com/album/`.
`fetch_all`: resolver MBID del artista una vez (`/ws/2/artist?query=artist:"Mac DeMarco"`) y fijarlo como constante `MAC_MBID`; paginar `/ws/2/release-group?artist={MBID}&limit=100&offset=…`; por grupo, `/ws/2/release?release-group={id}&status=official` → elegir el release con url-rel de Spotify, si no el más antiguo; luego `parse_release`. Helper `_get(url)` con `time.sleep(1)`, UA del Global Constraints, 3 reintentos con backoff `2**n` en 503/5xx; si agota, `raise` sin tocar el archivo existente. Si `releases.json` existe y no hay `--refresh`, lo devuelve.

- [ ] **Step 4: Run** tests → PASS

- [ ] **Step 5: Run real** `MB_CONTACT=<email> python -m scripts.fetch_musicbrainz` → `data/raw/releases.json` existe e incluye un release `One Wayne G` con >100 tracks.

- [ ] **Step 6: Commit** `feat: fetch discography from MusicBrainz` (incluye `data/raw/releases.json`)

---

### Task 3: Parser del embed de Spotify

**Files:**
- Create: `scripts/fetch_spotify_embed.py`, `scripts/tests/test_fetch_spotify_embed.py`, `scripts/tests/fixtures/spotify_embed.html` (HTML real de un embed de álbum, guardado una vez)

**Interfaces:**
- Consumes: `data/raw/releases.json` (Task 2)
- Produces:
  - `album_id_from_url(url: str) -> str`
  - `parse_embed(html: str) -> list[dict]` → `[{"title": str, "track_id": str}]`
  - `fetch_all(releases: list[dict], refresh: bool = False) -> dict[str, list[dict]]` → `data/raw/spotify_tracks.json`
  - CLI: `python -m scripts.fetch_spotify_embed [--refresh]`

- [ ] **Step 1: Inspeccionar el fixture** y anotar en un comentario del módulo la ruta exacta dentro de `__NEXT_DATA__` al tracklist (típicamente `props.pageProps.state.data.entity.trackList[]` con `title` y `uri` `spotify:track:<id>`).

- [ ] **Step 2: Write the failing tests**

```python
def test_album_id_from_url():
    assert album_id_from_url("https://open.spotify.com/album/abc123?si=x") == "abc123"

def test_parse_embed(html):
    tracks = parse_embed(html)
    assert len(tracks) > 0
    assert all(set(t) == {"title", "track_id"} for t in tracks)
    assert all(len(t["track_id"]) == 22 for t in tracks)

def test_parse_embed_garbage_returns_empty():
    assert parse_embed("<html></html>") == []
```

- [ ] **Step 3: Run** → FAIL

- [ ] **Step 4: Implement** — regex sobre `<script id="__NEXT_DATA__" type="application/json">(.*?)</script>`, `json.loads`, navegar la ruta del Step 1; ante cualquier `KeyError/ValueError` devolver `[]`. `fetch_all` loguea `WARNING album <id>: no tracks parsed` y sigue; `time.sleep(1)` entre requests; UA de navegador común.

- [ ] **Step 5: Run** tests → PASS; luego real → `data/raw/spotify_tracks.json` con al menos el álbum de One Wayne G poblado.

- [ ] **Step 6: Commit** `feat: resolve Spotify track ids from public embed`

---

### Task 4: `build_db` → `src/data/songs.json`

**Files:**
- Create: `scripts/build_db.py`, `scripts/tests/test_build_db.py`

**Interfaces:**
- Consumes: `extract_date` (Task 1), JSON de Tasks 2–3
- Produces:
  - `normalize(title: str) -> str`
  - `build(releases: list[dict], spotify: dict[str, list[dict]]) -> dict` (forma exacta del spec §4)
  - CLI: `python -m scripts.build_db [--refresh]` (corre Tasks 2–3 si falta caché o hay `--refresh`, escribe `src/data/songs.json`, imprime stats)

- [ ] **Step 1: Write the failing tests**

```python
def test_normalize(): assert normalize("  20190805  Mac-Baby! ") == "20190805 macbaby"

def test_days_has_366_keys():
    db = build([], {})
    assert len(db["days"]) == 366 and "02-29" in db["days"] and db["songs"] == []

def test_song_with_exact_link(releases, spotify):  # fixtures en el test file
    s = build(releases, spotify)["songs"][0]
    assert s == {"title": "20190805 Mac Baby", "date": "2019-08-05", "md": "08-05",
                 "album": "One Wayne G", "spotify": "https://open.spotify.com/track/" + "A"*22,
                 "exact_link": True}

def test_fallback_search_link():
    s = build([{"release_title": "X", "release_date": "2023", "spotify_album_url": None,
                "tracks": [{"title": "20200101 Foo", "position": 1}]}], {})["songs"][0]
    assert s["exact_link"] is False
    assert s["spotify"] == "https://open.spotify.com/search/20200101%20Foo%20mac%20demarco"

def test_dedupe_prefers_oldest_with_spotify():
    # mismo título en single 2022 (sin spotify) y álbum 2023 (con spotify) y deluxe 2024 (con spotify)
    db = build(three_releases, spotify_for_2023_and_2024)
    assert len(db["songs"]) == 1 and db["songs"][0]["album"] == "One Wayne G"

def test_titles_without_date_dropped():
    db = build([{"release_title": "Salad Days", "release_date": "2014", "spotify_album_url": None,
                 "tracks": [{"title": "Salad Days", "position": 1}]}], {})
    assert db["songs"] == []

def test_days_index_sorted():
    db = build(two_songs_same_md_2019_and_2018, {})
    assert [db["songs"][i]["date"] for i in db["days"]["08-05"]] == ["2018-08-05", "2019-08-05"]
```

`normalize`: lowercase, quitar todo lo que no sea `[a-z0-9 ]`, colapsar espacios, strip.

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement** según spec §3.4. Match MB↔Spotify por `normalize(title)` dentro del álbum cuyo id sale de `spotify_album_url`. Orden de `songs`: por `md`, luego `date`. `days`: iterar `date(2024,1,1) + n días` para n en 0..365. `generated_at` en UTC ISO.

- [ ] **Step 4: Run** tests → PASS

- [ ] **Step 5: Run real** `python -m scripts.build_db` → imprime `songs con fecha`, `días cubiertos X/366`, `links exactos N / fallback M`, lista de días vacíos. Revisar a ojo 5 títulos al azar contra su fecha.

- [ ] **Step 6: Commit** `feat: build songs.json day index` (incluye `src/data/songs.json`)

---

### Task 5: Scaffold Astro + lógica `nearest.ts`

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/lib/types.ts`, `src/lib/nearest.ts`, `tests/nearest.test.ts`

**Interfaces:**
- Consumes: forma de `songs.json` (Task 4)
- Produces (`src/lib/types.ts` / `src/lib/nearest.ts`):
  - `type Song = { title: string; date: string; md: string; album: string; spotify: string; exact_link: boolean }`
  - `type DB = { generated_at: string; songs: Song[]; days: Record<string, number[]> }`
  - `type Match = { md: string; distance: number; songs: Song[] }`
  - `type Result = { kind: 'exact'; md: string; songs: Song[] } | { kind: 'nearest'; md: string; before?: Match; after?: Match }`
  - `toMd(month: number, day: number): string` (`"08-05"`)
  - `daysInMonth(month: number): number` (febrero → 29)
  - `clampDay(month: number, day: number): number`
  - `parseHash(hash: string): { month: number; day: number } | null`
  - `findSongs(month: number, day: number, db: DB): Result` (lanza `RangeError` si fecha inválida)

- [ ] **Step 1: Scaffold** `npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git`, `npm i`, `npm i -D vitest`. Script `"test": "vitest run"`. En `astro.config.mjs`: `output: 'static'`, `site` y `base` leídos de `process.env.SITE_URL` / `process.env.BASE_PATH` con defaults `'http://localhost:4321'` y `'/'`.

- [ ] **Step 2: Write the failing tests** (DB de prueba construida en el test con 366 claves vacías + canciones en `01-01`, `03-10`, `03-16`, `12-30`)

```ts
test('exact', () => expect(findSongs(1, 1, db)).toMatchObject({ kind: 'exact', md: '01-01' }));
test('nearest before only', () => { const r = findSongs(3, 12, db); // 03-10 a 2, 03-16 a 4
  expect(r).toMatchObject({ kind: 'nearest', before: { md: '03-10', distance: 2 } }); expect(r.after).toBeUndefined(); });
test('tie returns both', () => expect(findSongs(3, 13, db)).toMatchObject({ before: { md: '03-10', distance: 3 }, after: { md: '03-16', distance: 3 } }));
test('wraps year end→start', () => expect(findSongs(12, 31, db)).toMatchObject({ before: { md: '12-30', distance: 1 } }));
test('wraps start→end', () => { const r = findSongs(1, 2, dbWithout0101); expect(r.before).toMatchObject({ md: '12-30', distance: 3 }); });
test('feb 29 nearest', () => expect(findSongs(2, 29, db).kind).toBe('nearest'));
test('feb 29 exact', () => expect(findSongs(2, 29, dbWith0229).kind).toBe('exact'));
test('invalid throws', () => expect(() => findSongs(4, 31, db)).toThrow(RangeError));
test('clampDay', () => { expect(clampDay(2, 31)).toBe(29); expect(clampDay(4, 31)).toBe(30); expect(clampDay(1, 15)).toBe(15); });
test('parseHash', () => { expect(parseHash('#08-05')).toEqual({ month: 8, day: 5 });
  for (const h of ['#13-45', '#02-30', '#hola', '', '#8-5']) expect(parseHash(h)).toBeNull(); });
```

- [ ] **Step 3: Run** `npm test` → FAIL

- [ ] **Step 4: Implement** — índice de día = días desde `2024-01-01` (UTC). Recorrer `d = 1..365` mirando `(i+d) % 366` y `(i-d+366) % 366`; detenerse en el primer `d` donde alguna dirección tenga canciones; devolver solo las direcciones con canciones a esa misma `d`.

- [ ] **Step 5: Run** → PASS

- [ ] **Step 6: Commit** `feat: astro scaffold and nearest-song lookup`

---

### Task 6: Layout, estilos, input y tarjeta de resultado

**Files:**
- Create: `src/layouts/Base.astro`, `src/styles/global.css`, `src/components/DateInput.astro`, `src/components/ResultCard.astro`, `src/scripts/app.ts`, `public/favicon.svg` (cassette simple)
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `findSongs`, `clampDay`, `daysInMonth`, `parseHash`, `toMd`, `DB` (Task 5); `src/data/songs.json`
- Produces:
  - Evento DOM `window.dispatchEvent(new CustomEvent('mdm:search', { detail: { month, day } }))` — única API entre componentes; `app.ts` lo escucha, ejecuta `findSongs`, renderiza el resultado, escribe `location.hash = toMd(...)` y emite `mdm:result` con `{ md }` (lo consume el calendario en Task 7).
  - `<div id="result">` en el que `app.ts` renderiza las tarjetas.
  - DB disponible en el cliente vía `<script type="application/json" id="db">` en `index.astro`.

- [ ] **Step 1: `global.css`** — tokens del Global Constraints en `:root`; `body { background: var(--paper); color: var(--ink) }`; overlay de grano: pseudo-elemento fijo con SVG `feTurbulence` inline como data-URI, `opacity: .06`, `pointer-events: none`; escala tipográfica (hero serif `clamp(2.5rem, 7vw, 5rem)`); contenedor `max-width: 960px`, gutter 16px en mobile; `@media (prefers-reduced-motion: reduce)` desactiva animaciones.

- [ ] **Step 2: `Base.astro`** — `<title>Mac en tu cumple</title>`, meta description y OG, Google Fonts (Instrument Serif, JetBrains Mono 400/600), favicon con `import.meta.env.BASE_URL`.

- [ ] **Step 3: `DateInput.astro`** — dos `<select>` mono (día 1–31, mes con nombres en español) + botón "Buscar". Al cambiar mes, re-generar opciones de día con `daysInMonth` y aplicar `clampDay`. Submit → `mdm:search`.

- [ ] **Step 4: `ResultCard` + `app.ts`** — tarjeta "etiqueta de cassette": borde `1.5px solid var(--ink)`, radio 10px, líneas horizontales con `repeating-linear-gradient`, título en serif, fecha completa en mono (`05.08.2019`), álbum en `--ink-soft`, botón "Escuchar en Spotify ↗" (`target="_blank" rel="noopener"`). Copys exactos:
  - exact: `"El {d} de {mes} tiene canción."`
  - nearest: `"No hay canción para el {d} de {mes}, pero la más cercana es {N} día(s) {antes|después}."` (con empate: `"…hay dos a {N} días: una antes y una después."`)
  Al cargar: si `parseHash(location.hash)` es válido, disparar `mdm:search`.

- [ ] **Step 5: Hero + footer en `index.astro`** — titular `"¿Mac te escribió una canción para tu cumple?"`; subtítulo mono: `"Los títulos de One Wayne G son fechas. Fijate si hay una con la tuya."`; footer: `"{X} de 366 días tienen canción · proyecto fan no oficial"`.

- [ ] **Step 6: Verificar** `npm run dev` → buscar un día con canción, uno sin canción, el 29/02, cambiar 31/ene → feb (queda 29), recargar con `#08-05` y con `#13-45`. Revisar a 375px de ancho sin scroll horizontal.

- [ ] **Step 7: Commit** `feat: page layout, date input and result cards`

---

### Task 7: Calendario estilo GitHub

**Files:**
- Create: `src/components/CalendarGrid.astro`
- Modify: `src/pages/index.astro` (montar debajo del resultado), `src/styles/global.css`

**Interfaces:**
- Consumes: `DB`, `toMd`, `daysInMonth` (Task 5); eventos `mdm:search` / `mdm:result` (Task 6)

- [ ] **Step 1: Render en build** — por cada mes 1–12 y día 1–31 un `<button class="cell" data-md="MM-DD" data-level="0..4">`; días inexistentes (30/02, 31/04…) como `<span class="cell cell--void">` con `visibility: hidden`. `data-level` = `min(cantidad, 4)`. `aria-label`: `"5 de agosto: 2 canciones"` / `"14 de marzo: sin canción"`. `title`/tooltip con la lista de títulos.

- [ ] **Step 2: Layout** — desktop: grid de 12 columnas (meses, con label abreviado arriba) × 31 filas; mobile (`< 640px`): 12 filas × 31 columnas, `overflow-x: auto` solo en el contenedor del calendario. Celdas `12px` (desktop) / `9px` (mobile), gap `3px`, `border-radius: 2px`. Nivel 0 → `--cell-empty`, 1–4 → `--green-1..4`. Leyenda `"menos ▢▢▢▢▢ más"` debajo.

- [ ] **Step 3: Interacción** — click/Enter en celda → `mdm:search` con su fecha. Al recibir `mdm:result`, quitar `.is-target` de la anterior y ponerla en `[data-md=md]`: `outline: 2px solid var(--accent); outline-offset: 2px` + keyframe de pulso (sin animación si reduced-motion). Tooltip custom en hover/focus (div absoluto, mono, fondo `--ink`, texto `--paper`).

- [ ] **Step 4: Verificar** en dev: el conteo de celdas verdes coincide con `días cubiertos` del stats de Task 4; click en celda verde muestra su canción; click en celda oscura muestra la más cercana; tab recorre celdas; mobile scrollea solo el calendario.

- [ ] **Step 5: Commit** `feat: github-style song calendar`

---

### Task 8: Deploy a GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: `SITE_URL`, `BASE_PATH` (Task 5)

- [ ] **Step 1: Workflow** — on push a `main` + `workflow_dispatch`; permisos `pages: write`, `id-token: write`, `contents: read`; job `build` con `withastro/action@v3` (env `SITE_URL=https://<user>.github.io`, `BASE_PATH=/<repo>`), job `deploy` con `actions/deploy-pages@v4`. Agregar paso `npm test` antes del build.

- [ ] **Step 2: Verificar subpath local** `SITE_URL=https://x.github.io BASE_PATH=/macdemarco npm run build && npx astro preview` → abrir `/macdemarco/`: fuentes, favicon, búsqueda y calendario funcionan; consola sin 404.

- [ ] **Step 3: README** — qué es, cómo regenerar datos (`MB_CONTACT=… python -m scripts.build_db --refresh`), cómo correr tests (`pytest`, `npm test`), deploy.

- [ ] **Step 4: Commit** `ci: deploy to GitHub Pages`

- [ ] **Step 5: (con OK del usuario)** crear repo en GitHub, push, activar Pages con source "GitHub Actions", verificar la URL pública.
