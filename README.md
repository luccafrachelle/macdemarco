# Mac DeMarco: canciones de cumpleaños

Sitio estático (Astro) con las canciones de Mac DeMarco para cada día del año. Proyecto fan, no oficial: no está afiliado a Mac DeMarco ni a su sello.

## Regenerar los datos

El pipeline en Python genera `src/data/songs.json`:

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt
MB_CONTACT=tu@email.com .venv/bin/python -m scripts.build_db --refresh
```

Nota: unos ~99 temas usan un link de búsqueda de Spotify en vez de link directo, porque el embed público trunca "One Wayne G" a 100 temas.

`src/data/songs.json` y `data/raw/` están commiteados y el CI no ejecuta el pipeline de Python (requiere Python 3.11+).

## Tests

```bash
.venv/bin/pytest   # pipeline de datos
npm test           # frontend (vitest)
```

## Desarrollo local

```bash
npm ci
npm run dev
```

Para probar un subpath: `SITE_URL=https://x.github.io BASE_PATH=/macdemarco npm run build && npx astro preview`.

## Deploy

GitHub Actions publica en GitHub Pages en cada push a `main` (`.github/workflows/deploy.yml`). Primero activá Pages en el repo: Settings > Pages > Source: "GitHub Actions". `SITE_URL` y `BASE_PATH` se toman automáticamente de `actions/configure-pages`.
