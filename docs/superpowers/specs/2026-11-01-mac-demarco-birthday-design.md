# Mac DeMarco Birthday Songs — Design Spec

**Fecha:** 2026-11-01
**Estado:** aprobado en chat, pendiente de revisión escrita

## 1. Objetivo

Una web estática y minimalista donde el usuario ingresa su fecha de cumpleaños y descubre si Mac DeMarco tiene una canción cuyo **título** contiene esa fecha (día + mes). Si no hay, se muestra la canción más cercana en el calendario. Cada canción linkea a Spotify.

**Éxito:**
- Se extraen todas las fechas presentes en títulos de canciones de Mac DeMarco disponibles en MusicBrainz/Spotify (principalmente *One Wayne G*, formato `YYYYMMDD`).
- Existe un índice de los 366 días del año (incluye 29/02) indicando qué canciones caen en cada uno.
- La web responde correctamente para cualquier día, incluyendo vuelta de año y 29/02.
- La página es visualmente cuidada (estética cassette/lo-fi + calendario estilo GitHub) y se deploya en GitHub Pages.

**Fuera de alcance:** backend, cuentas de usuario, plataformas distintas de Spotify, credenciales de Spotify API.

## 2. Arquitectura

```
macdemarco/
├── scripts/                      # Pipeline Python (build-time, no se deploya)
│   ├── fetch_musicbrainz.py
│   ├── fetch_spotify_embed.py
│   ├── extract_dates.py
│   ├── build_db.py               # orquesta los 3 pasos + imprime stats
│   └── tests/
├── data/raw/                     # caché del scraping (commiteado)
├── src/                          # Sitio Astro
│   ├── data/songs.json           # DB final (output del pipeline)
│   ├── lib/nearest.ts            # lógica de búsqueda (función pura)
│   ├── components/
│   │   ├── DateInput.astro
│   │   ├── CalendarGrid.astro
│   │   └── ResultCard.astro
│   ├── layouts/Base.astro
│   ├── styles/global.css
│   └── pages/index.astro
├── tests/nearest.test.ts         # vitest
├── astro.config.mjs
└── .github/workflows/deploy.yml
```

El pipeline de datos y la web están desacoplados por un único contrato: `src/data/songs.json`.

## 3. Pipeline de datos

### 3.1 `fetch_musicbrainz.py`
- Busca el artista Mac DeMarco (MBID resuelto una vez y fijado como constante).
- Recorre release-groups (álbumes, EPs, singles, compilaciones) → un release representativo por grupo → tracklist (`inc=recordings+url-rels`).
- Extrae la URL de álbum de Spotify de las `url-rels` del release, si existe.
- Respeta el rate limit: **1 req/s** y `User-Agent: macdemarco-birthday/0.1 ( <email de contacto> )`.
- Output: `data/raw/releases.json` → `[{release_title, release_date, spotify_album_url|null, tracks:[{title, position}]}]`.
- Si el archivo ya existe, no vuelve a pedir salvo `--refresh`.

### 3.2 `fetch_spotify_embed.py`
- Por cada `spotify_album_url`, descarga `https://open.spotify.com/embed/album/{id}` y parsea el JSON embebido (`<script id="__NEXT_DATA__">`) para obtener `[{title, track_id}]`.
- Output: `data/raw/spotify_tracks.json` → `{album_id: [{title, track_id}]}`.
- Pausa de 1 s entre requests. Si falla el parseo de un álbum, se registra un warning y se continúa.

### 3.3 `extract_dates.py`
Función pura `extract_date(title: str) -> date | None`.

Patrones en orden de prioridad:
1. `YYYYMMDD`: `(?<!\d)(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)`
2. ISO con separadores: `(19|20)\d{2}[-./](0?[1-9]|1[0-2])[-./](0?[1-9]|[12]\d|3[01])`
3. Mes en texto inglés + día: `(Jan(uary)?|Feb(ruary)?|…|Dec(ember)?)\.?\s+(\d{1,2})(st|nd|rd|th)?` (case-insensitive)

Cada match se valida con `datetime.date(...)`; si es inválido (ej. `20190231`) se descarta y se prueba el siguiente patrón. Formatos ambiguos tipo `3/4` **no** se interpretan.

### 3.4 `build_db.py`
1. Une tracks de MusicBrainz con Spotify por título normalizado (lowercase, sin puntuación, espacios colapsados).
2. Deduplica canciones por título normalizado (prioriza el release más antiguo que tenga link de Spotify).
3. Aplica `extract_date`; descarta canciones sin fecha.
4. Link: `https://open.spotify.com/track/{id}` si hay match (`exact_link: true`); si no, `https://open.spotify.com/search/{urlencoded title + " mac demarco"}` (`exact_link: false`).
5. Escribe `src/data/songs.json` e imprime stats: total de canciones con fecha, días cubiertos / 366, links exactos vs. fallback, lista de días sin canción.

## 4. Contrato: `src/data/songs.json`

```json
{
  "generated_at": "2026-11-01T00:00:00Z",
  "songs": [
    {
      "title": "20190805 Mac Baby",
      "date": "2019-08-05",
      "md": "08-05",
      "album": "One Wayne G",
      "spotify": "https://open.spotify.com/track/…",
      "exact_link": true
    }
  ],
  "days": { "01-01": [], "08-05": [0, 12] }
}
```

- `days` contiene **las 366 claves** `MM-DD` (incluye `02-29`), con índices a `songs`, ordenados por `date` ascendente.
- `songs` ordenado por `md` y luego `date`.

## 5. Lógica de búsqueda (`src/lib/nearest.ts`)

`findSongs(month: number, day: number, db) -> Result`

```ts
type Result =
  | { kind: 'exact'; md: string; songs: Song[] }
  | { kind: 'nearest'; md: string; before?: Match; after?: Match };
type Match = { md: string; distance: number; songs: Song[] };
```

- Calendario base de 366 días (año bisiesto de referencia, ej. 2024) → índice `0..365`.
- Si `days[md]` no está vacío → `exact`.
- Si no, recorre hacia adelante y hacia atrás con distancia circular (módulo 366) hasta encontrar el primer día no vacío en cada dirección.
- Si una dirección está estrictamente más cerca, solo se devuelve esa; si empatan, se devuelven ambas (`before` y `after`).
- Entrada inválida (ej. 31/04) → la UI no la permite; la función lanza error.

## 6. Diseño visual

### 6.1 Dirección
Cassette / lo-fi cálido, con calendario estilo GitHub como elemento protagonista.

- **Paleta (tokens CSS):**
  - `--paper: #f3ecdf` (fondo), `--ink: #2b2118` (texto), `--ink-soft: #6b5a4a`
  - `--cell-empty: #3a2f26` (días sin canción, oscuro)
  - `--green-1: #9be9a8`, `--green-2: #40c463`, `--green-3: #30a14e`, `--green-4: #216e39` (intensidad por cantidad de canciones: 1, 2, 3, 4+)
  - `--accent: #c8553d` (marcador del cumpleaños / foco)
- **Tipografía (Google Fonts):** *Instrument Serif* para titulares, *JetBrains Mono* para fechas, labels y UI.
- **Textura:** ruido SVG inline (`feTurbulence`) como overlay de baja opacidad (~6%).
- Sin modo oscuro: la estética crema es parte de la identidad.

### 6.2 Layout (una sola página)
1. **Hero:** titular serif grande ("¿Mac te escribió una canción para tu cumple?"), subtítulo mono breve explicando que los títulos de *One Wayne G* son fechas.
2. **Input:** dos selects mono grandes (día / mes) + botón "Buscar". El día se limita según el mes (29 para febrero).
3. **Resultado:** tarjeta tipo etiqueta de cassette (borde, líneas horizontales sutiles, esquinas redondeadas): título de la canción, fecha original completa, álbum, botón "Escuchar en Spotify". En modo `nearest`: "No hay canción para el 14/03, pero la más cercana es… (3 días después)". Si hay varias canciones, una tarjeta por canción.
4. **Calendario:** grilla estilo GitHub de 12 columnas (meses) × hasta 31 filas (días) en desktop; en mobile, 12 filas (meses) × 31 columnas con celdas más chicas y scroll interno si hace falta. Celdas cuadradas con `border-radius: 2px`, verde por intensidad, oscuras si vacías, inexistentes (ej. 30/02) invisibles. El día buscado lleva outline `--accent` con una animación de pulso suave (respetando `prefers-reduced-motion`). Hover/focus → tooltip con fecha y títulos; click → ejecuta la búsqueda de ese día. Leyenda "menos → más" debajo, como en GitHub.
5. **Footer:** stats ("X de 366 días tienen canción"), crédito y aclaración de que es un proyecto fan no oficial.

### 6.3 Comportamiento
- El JSON se importa en build y se inyecta en la página; JS vanilla mínimo en un `<script>` del componente.
- La fecha buscada se refleja en la URL como hash (`#08-05`) para compartir; al cargar con hash se ejecuta la búsqueda.
- Accesibilidad: celdas como `<button>` con `aria-label` ("5 de agosto: 2 canciones"), navegación por teclado, contraste AA para texto.

## 7. Deploy

- `astro.config.mjs`: `output: 'static'`, `site: 'https://<usuario>.github.io'`, `base: '/<repo>'`. Todos los assets/links usan `import.meta.env.BASE_URL`.
- `.github/workflows/deploy.yml`: on push a `main` → `withastro/action` → `actions/deploy-pages`.
- El pipeline Python **no** corre en el deploy; `songs.json` se commitea. (Opcional futuro: workflow mensual que corra `build_db.py --refresh` y abra un PR.)

## 8. Manejo de errores

- MusicBrainz caído / 503: retry con backoff (3 intentos), luego aborta sin sobreescribir el JSON existente.
- Embed de Spotify cambia de formato: warning por álbum, se usan links de búsqueda como fallback; las stats muestran cuántos.
- La web nunca hace requests en runtime: no hay estados de error de red.

## 9. Testing

- **Python (`pytest`):** `extract_date` — YYYYMMDD válido, fecha imposible, número largo sin fecha, ISO con separadores, mes en texto, sin fecha, 29/02 de año bisiesto. Normalización de títulos. Construcción de `days` con 366 claves.
- **TS (`vitest`):** `findSongs` — match exacto, nearest solo hacia adelante, solo hacia atrás, empate, vuelta de año (31/12 ↔ 01/01), 29/02 con y sin canción, entrada inválida.
- **Manual:** `astro build && astro preview` con `base` configurado; revisar desktop y mobile.

## 10. Decisiones abiertas resueltas

| Tema | Decisión |
|---|---|
| Fuente de datos | MusicBrainz + embed público de Spotify, sin credenciales |
| Comparación | Solo día + mes |
| Cercanía | Circular sobre 366 días, empate muestra ambas |
| Links | Spotify (track exacto o búsqueda como fallback) |
| Estética | Cassette lo-fi + calendario estilo GitHub verde/oscuro |
| Hosting | GitHub Pages vía Astro estático |
