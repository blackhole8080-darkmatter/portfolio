# Motion system — the re-cut

The site is animated as **one continuous take**, not as a stack of sections that
fade in. Everything is hand-written CSS plus one DOM layer (`motion.js`): no
GSAP, no Lottie, no Framer Motion, no scroll-jacking, no build step.

Two rules still hold:

1. **Motion explains.** It establishes where you are, keeps objects continuous
   across the joins, or confirms an action. Anything that only decorated was cut.
2. **Nothing is load-bearing.** With JS off the page is a legible still frame —
   the one overlay that could have trapped it, the leader card, lifts itself in
   CSS. The project grid is still rendered by `app.js`, so that list needs JS;
   the copy, headings and chrome do not. Under
   `prefers-reduced-motion: reduce` it is the same still frame by choice.

---

## The direction

Five reference languages were named for this pass. All five are *video* tools
(Lemo-Opuscar renders films frame by frame in code; One Take, HyperFrames,
Collage B-roll and Animation Base are Claude video skills), so what follows is a
translation of their grammar into a scrolling page — not the skills themselves.

| Reference | What it does on film | What it does here |
| --- | --- | --- |
| **One Take** | one camera move, no cuts | one progress value per scene drives a depth stack; you travel past content instead of being shown it |
| **HyperFrames** | editorial titles, kinetic type | clip-path type wipes, slab scene numerals, drawn lower-third rules |
| **Collage B-roll** | paper cut-outs assemble | torn-paper scraps assemble in the margins; tape tabs mark the splices |
| **Animation Base** | hand-drawn cartoons | line work draws itself on, with a two-frame boil and one hand-drawn ring |
| **Lemo-Opuscar** | directed, graded films | leader card, letterbox, viewfinder marks, HUD timecode, 24fps grain, warm/cool grade, vignette |

---

## Techniques, where, and why

### 1. One take — the camera rig
**Where** every `.scene` (hero + four sections), `motion.js → paint()`.
**What** Each frame writes one CSS variable, `--p`, per scene: `-1` when the
scene is below the eye line, `0` on it, `+1` when it has passed. Content and
paper consume that single value at different rates (`-18px` for content,
`-24…-70px` for paper, `-84px` plus a 2.8% push-in for the hero).
**Why** The old system cut between shots: each section faded up when it arrived.
A shared, continuous variable means there is no moment where the page "starts"
a new section — the same camera keeps moving and objects at different depths
slide past at different speeds. That is the whole of the One Take idea, and it
costs one property write per scene per frame.

Deliberately **not** scroll-jacking: native scroll, native momentum, native
anchors. The camera is a function of scroll, not a replacement for it.

### 2. Title-card type
**Where** hero headline, all section headings, contact headline (`[data-split]`).
**What** Each authored line is wrapped in a mask, then wiped on with
`clip-path: inset(-24% 100% -24% 0)` → `inset(… -6% … 0)`, staggered 90 ms.
**Why** This replaces the masked-word-rise from the first cut. A rise is web
motion; a horizontal wipe is a lower third. The negative right inset exists so
italic serif overshoot is never clipped at the end of the reveal. Lines are
split at `<br>` (or per authored line in the hero), not per word, so the wipe
runs at reading speed rather than word-by-word stutter.

### 3. Slab numerals and rules
**Where** `.scene-num` (01–04), `.kicker::after`.
**What** An outlined serif numeral, 5.5–13rem, wiped in from the right; a
hairline that scales from the left under each kicker.
**Why** HyperFrames' most useful habit is stating where you are. The numeral
costs no layout (absolutely positioned, `z-index: -1`) and tells you the shot
number before you read the heading. The rule is the same idea at small scale.
The hero has no numeral: `00` is the prologue, and a slate on the open is noise.

### 4. Collage B-roll
**Where** `.collage` inside each scene; 15 scraps, 4 splice seams.
**What** Torn-paper polygons (`torn()` in `motion.js`, seeded noise, so the
tear is identical on every load) in bone, oxide, navy, plus a dark "still"
with a viewfinder border, translucent tape and a halftone patch. Each scrap
parallaxes at its own `--dz` and assembles from an offset on entry — slide and
scale, only a 0.42 s opacity fade.
**Why** The paper is what makes the page feel cut and pasted rather than
rendered. The hard constraint: **paper never sits behind running text.** It
lives only in the top and bottom padding bands of a section and in the outer
margins. A bone scrap under a white serif headline is the one thing this look
cannot survive; that was caught in verification and every placement was moved.
Splice tabs at each section boundary are the only literal reference to cutting —
a one-take film still has joins in the negative.

### 5. Hand-drawn layer
**Where** `.sketch` in the hero (orbit, arc, arrow, "one take" label),
`.hand-circle` around the last word of the headline.
**What** Every path has `pathLength="1"` and is drawn by animating
`stroke-dashoffset` from 1 to 0. The group carries a two-frame `boil`
(0.7px jitter, 0.42 s, `steps(2)`), and the ring is a jittered ellipse built
from a seeded RNG so it reads as drawn, not geometric.
**Why** Animation Base's charm is imperfection held still. One ring, not three:
three read as decoration, one reads as a note someone made while reading.
The boil is the detail that sells it — hand-drawn lines are never static.

### 6. Leader card
**Where** `.film-leader` on first load.
**What** Black frame, three lines wiping in at 140/300/400 ms, then the whole
layer wipes upward at 1.04 s and is removed at 1.9 s. The hero reveal begins
at 1.0 s, so the headline is already wiping as the leader lifts.
**Why** It covers the webfont swap and gives the page a directed opening. It is
`aria-hidden`, never focusable, and gone from the DOM at 1.9 s.
The wipe is a CSS animation (`leaderLift`), not a JS class alone: if `motion.js`
never runs, the card still clears at 1.76 s instead of leaving an opaque black
frame over the page. JS adds `.done` at the same moment for the DOM removal.

### 7. Film chrome
**Where** `.film-bar`, `.film-frame`, `.film-hud`, `.film-grade`, `.film-vignette`.
**What** 9px letterbox bars (body padding matches, nav offset to match), four
viewfinder corners, a HUD with a record dot, `SHOT 0n — LABEL` and a timecode
derived from scroll (72 s at 24fps), a warm/cool `soft-light` grade over the
page, and a vignette.
**Why** The grade and vignette do real work: they pull the near-black palette
into something photographed rather than rendered, and the vignette gives the
edges somewhere to fall away. The HUD is the one persistent lie that makes the
page read as a single take — it never resets, and it says which shot you are in.

### 8. Grain at 24fps
**Where** `.grain`.
**What** The existing SVG turbulence layer, but stepped `0.5s steps(12)` —
twelve position changes per half second — instead of `7s steps(6)`.
**Why** Grain that drifts on a seven-second cycle reads as a texture overlay;
grain that reshuffles 24 times a second reads as film. Same asset, different
cadence, and it is disabled entirely under reduced motion.

### 9. Kept from the first cut
These do a job rather than decorate, so the re-cut kept them: FLIP transitions
on filtering (spatial continuity), the rolling odometer (data as instrument),
the pausable ticker (now with sprocket holes, so it reads as film strip), card
tilt with pointer glare, magnetic buttons, and the nav indicator.

### 10. Removed on purpose
- **Cursor companion** — the most template-like tic on the page, and absent
  from every reference language. The native cursor is back.
- **Masked word-rise reveals** — replaced by title-card wipes.
- **Section fade-ins** — replaced by the camera; content is never staged at
  `opacity: 0` waiting to be scrolled to.
- **The `.reveal` class** survives only as a hook (`app.js` uses `.in` on
  `.langs` to start the language bars); it no longer hides anything.

---

## Verification

Headless Chrome, 1440×900 and 430×932, against the local server:

- **Zero** console errors, page errors or failed requests.
- Leader removed; 5 scenes, all reaching `.is-set`; hero headline at
  `inset(-24% -6% -24% 0px)` (fully wiped, not left clipped).
- 15 scraps across the five scenes (3 / 4 / 3 / 3 / 2), 4 splice seams; every
  scrap in a scene reaches `opacity: 1` once that scene is set, checked scene by
  scene rather than at a single scroll position.
- HUD advances `SHOT 00 — OPEN` → `SHOT 04 — CONTACT`; timecode ends `00:01:12:00`
  at the foot of the page; thread `stroke-dashoffset` 1 → 0.
- Filter click still isolates *Security* → DEEP + urlscan-mcp.
- Reduced motion: no leader, no thread, every line clip `none`, grain and ticker
  `animation-name: none`, hero transform `none`, all scenes locked visible.
- **CLS 0.0005** while scrolling the whole page. The first cut measured 0.15
  because the webfont swap reflowed the hero rail and moved the headline; the
  rail is now out of flow (`position: absolute`) and the four latin faces are
  preloaded, so the swap happens under the leader.
- **Frame pacing** over a full-page 2 s scroll: median 16.7 ms, p95 18.2 ms,
  worst 18.8 ms, zero frames over 33 ms.
- **JavaScript disabled**: leader lifts itself (`clip-path: inset(0 0 100%)`,
  `pointer-events: none`), hero and all four section headings read in full, no
  line left clipped.
- Paper/text collisions checked at 1440, 1100 and 780 px using per-line
  text-node rects (`Range.getClientRects`), not block boxes: zero. An earlier
  probe reported a false hit on the two-line work heading because a range over
  the whole heading returns one box spanning both lines.
