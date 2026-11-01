# Mac en tu cumple

Mac DeMarco tiene la costumbre de ponerle a sus demos la fecha en que las grabó como título. *One Wayne G* son 199 temas que se llaman `20190805`, `20210217 Scarecrow` y así, y los discos que sacó después siguieron con la misma idea.

Un día me pregunté si habría alguna de mi cumpleaños. Esta página responde eso: elegís día y mes y te muestra la canción, o la más cercana si ese día no tiene ninguna. Cada una va directo a Spotify.

→ **[luccafrachelle.github.io/macdemarco](https://luccafrachelle.github.io/macdemarco/)**

Hoy hay 246 canciones con fecha, repartidas en 153 de los 366 días del año.

## Cómo se arman los datos

Hay un script en Python que:

1. baja la discografía de [MusicBrainz](https://musicbrainz.org),
2. saca la fecha del título de cada tema con una regex (sobre todo el formato `YYYYMMDD`),
3. busca el link de cada tema en Spotify, primero en el embed público del álbum y, para lo que falta, en [ListenBrainz](https://listenbrainz.org),
4. escribe todo en `src/data/songs.json`.

El resultado queda commiteado, así que la web no necesita correr nada de esto. Para actualizarlo cuando salga algo nuevo (Python 3.11+):

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
MB_CONTACT=tu@email.com .venv/bin/python -m scripts.build_db --refresh
```

MusicBrainz pide un email de contacto en cada request; por eso va en `MB_CONTACT`.

## La web

Es Astro estático, sin backend y casi sin JavaScript.

```bash
npm ci
npm run dev        # http://localhost:4321
npm test           # tests de la parte web
.venv/bin/pytest   # tests del script de datos
```

Cada push a `main` se publica solo en GitHub Pages (`.github/workflows/deploy.yml`).

---

Lo hizo un fan; no tiene nada que ver con Mac ni con su sello.
