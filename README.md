# Portfolio

A static, dependency-free portfolio generated from live GitHub repositories.

Every number on the page — project count, commits, language shares, last sync —
comes from the GitHub API, not from hand-written copy. Curated text lives in
one place (`scripts/sync_github.py`), so re-running it refreshes the site
without touching the design.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page shell and section structure |
| `styles.css` | Design system, layout, motion |
| `app.js` | Renders projects, filters, language bars, canvas field |
| `motion.js` | Entrance, kinetic type, reveals, cursor, magnetism, tilt, FLIP, odometer, ticker |
| `data.js` | **Generated** — `window.PORTFOLIO` payload |
| `scripts/sync_github.py` | Pulls repos/languages/commits, writes `data.js` |

## Preview locally

```bash
python -m http.server 8777 --bind 127.0.0.1
# open http://127.0.0.1:8777/
```

Any static server works; there is no build step. Opening `index.html` straight
from disk also works.

## Refresh the data

```bash
gh auth status          # needs the authenticated GitHub CLI
python scripts/sync_github.py
```

Edit the `CURATED` dict in `scripts/sync_github.py` to change titles, taglines,
or which repositories are featured. Repositories not listed there are ignored;
forks are always excluded.

## Publish with GitHub Pages

The site is plain static files, so Pages can serve it directly:

1. Push this folder to a repository (e.g. `portfolio`).
2. **Settings → Pages → Source: Deploy from a branch → `main` / root.**
3. It goes live at `https://<user>.github.io/portfolio/`.

For a user site at `https://<user>.github.io/`, name the repository
`<user>.github.io` instead and push the same files to its root.

## Motion

All animation is hand-written CSS and `motion.js` — no GSAP, Lottie or Framer
Motion, and no scroll-jacking. **[MOTION.md](MOTION.md)** lists every technique,
where it is used, why it exists, and what was deliberately left out.

In short: an entrance curtain that hides the font swap, masked word reveals,
scroll-scoped reveals, a scroll progress line, a cursor companion, magnetic
buttons, card tilt with pointer glare, FLIP transitions when filtering, rolling
odometer stats, a pausable ticker, and a bounded hero parallax — all of it
collapsing under `prefers-reduced-motion: reduce`.

## Notes

- No trackers, no cookies, no analytics, no external JS. The only network
  requests are Google Fonts and the GitHub links themselves.
- Motion respects `prefers-reduced-motion`; nothing depends on an animation
  completing in order to be readable.
- The hero constellation is a `<canvas>` drawn at device pixel ratio, capped at
  90 particles.
