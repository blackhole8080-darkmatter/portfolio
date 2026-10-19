# Motion system

Every animation on this site is hand-written CSS + a single DOM layer (`motion.js`).
There is no GSAP, no Lottie, no Framer Motion, no scroll-jacking. The page stays
a static file you can open from disk.

Two rules drive all of it:

1. **Motion explains, it doesn't decorate.** Every effect either establishes
   hierarchy, preserves spatial continuity, or confirms an action. If it did
   none of those, it was cut.
2. **Nothing is load-bearing.** With `prefers-reduced-motion: reduce` the page
   renders in its final state — same content, same layout, no animation.

---

## Techniques used, where, and why

### 1. Entrance curtain
**Where** `.curtain` → first 0.7 s of the page.
**What** A single acid-green glyph and a hairline rule on the ink background, then the whole layer fades and is removed from the DOM.
**Why** It covers the webfont swap (Instrument Serif arriving after first paint), so the page is never seen in fallback type. It also gives the eye one focal point before the hero starts moving — the equivalent of a title card. It removes itself after 700 ms and never intercepts a pointer.

### 2. Kinetic typography — masked word reveal
**Where** Hero headline, all section headings, contact headline (`[data-split]`).
**What** Each word is wrapped in an overflow-hidden mask; the inner span starts
`translate3d(0, 118%, 0) rotate(2.5deg)` and lands at rest, staggered 55 ms per word.
**Why** Line-level fades look like a slide deck. Word-level masks read as
*typesetting* — the eye follows the sentence the way it would read it, and the
slight rotation gives it weight rather than a float. The hero runs 1.15 s;
headings run 1 s and only fire when they enter the viewport.

### 3. Scroll choreography
**Where** Section headings, project cards, language bars, contact block.
**What** An rAF-throttled `getBoundingClientRect` sweep adds `.is-revealed` when an
element is 18% into the viewport. Cards stagger at 70 ms each via `--delay`.
**Why** Reveals should be scoped to attention, not to page load. A rect sweep
instead of `IntersectionObserver` is deliberate: IO callbacks are starved in
background tabs and some embedded webviews, which silently leaves content at
`opacity: 0`. The sweep is ~20 elements — cheaper than the failure mode.

### 4. Scroll progress
**Where** 2 px line fixed to the top of the viewport.
**What** `scaleX(0→1)` against scroll position, written from a passive scroll
listener inside `requestAnimationFrame`.
**Why** The page is ~7,600 px tall with four sections. A progress line answers
"how much is left" without adding a sticky table of contents. It is also the
cheapest possible feedback that the page is responding to you.

### 5. Cursor companion
**Where** Fine pointers only.
**What** A 30 px ring that chases the pointer with exponential smoothing
(`lerp 0.18`), plus a 4 px dot locked to the pointer. The ring scales to 54 px and
fills slightly over links, buttons, cards and inputs.
**Why** It turns "is this clickable" into a pre-hover signal and makes the pointer
feel weighted. The native cursor is never hidden — a custom cursor that replaces
the system one is a usability tax, not a feature. Hidden on coarse pointers and
under reduced motion.

### 6. Magnetic buttons
**Where** Every `.btn` (See the work, GitHub, contact, back-to-top).
**What** On `pointermove`, the button translates toward the pointer up to 12 px on
X and 10 px on Y, clamping hard so it never detaches from its own hit area.
**Why** Magnetic controls are the cheapest way to make a static page feel
physical. The clamp is the important part: past ~12 px the target starts running
away from the cursor, which is the common way this effect gets misused.

### 7. Card depth — tilt + pointer glare
**Where** All eight project cards.
**What** `rotateX/rotateY` of at most 3.4°/4.6° driven by pointer position, with a
radial glare and an accent-coloured bloom that both track the pointer through
CSS custom properties.
**Why** The grid is flat, text-only content. A small parallax tilt separates
planes and makes each card feel like an object you are picking up. The rotation
is deliberately tiny — enough to read as depth, not enough to distort type.

### 8. FLIP filter transitions
**Where** The category chips above the project grid.
**What** First (measure every card) → Last (toggle `display`, measure again) →
Invert (apply the delta as a transform) → Play (animate to zero). 560 ms on a
`cubic-bezier(.22,1,.36,1)`.
**Why** Without FLIP, filtering is a hard cut: surviving cards teleport. With it,
the grid rearranges itself and you keep the spatial model of where everything
was. This is the one place where animation is doing real cognitive work.

### 9. Odometer counters
**Where** The four hero statistics (projects, commits, languages, live games).
**What** Each digit is a vertical strip of 0–9; strips roll to the target digit
with a 70 ms stagger.
**Why** A count-up makes the number feel measured; a roll makes it feel like an
instrument. It also stops the stats from looking like static marketing copy when
in fact they are read from the GitHub API at build time. The rolling glyphs are
`aria-hidden`; the real value is in an `aria-label` on the element.

### 10. Infinite ticker
**Where** Between the hero and the work section.
**What** Two identical rows of language and tool names translating `-50%` over
34 s, masked at both edges, pausing on hover.
**Why** It is the page's only continuous motion, and it earns its place by
carrying information — Python, TypeScript, Flask, Ollama, MITRE ATT&CK — rather
than decorative text. Two copies plus a `-50%` translate means the loop has no
seam and no JS timer.

### 11. Hero scroll drift
**Where** The `.hero-inner` block as you leave the hero.
**What** `translate3d(0, scrollY × 0.14, 0)` with opacity falling to 0 across the
first 780 px.
**Why** Parallax at two different rates (the canvas field is independent) gives
the hero depth on exit and hands the work section the viewport without a hard
cut. It is bounded and short, so it never becomes the scroll-jacking that gives
parallax a bad name.

### 12. Ambient canvas field
**Where** Hero background, 34–90 particles scaled to viewport area.
**What** A point lattice with proximity links, particles pushed away from the
pointer, drawn at device pixel ratio (capped at 2×).
**Why** It is the one element that makes the hero feel alive while idle, and it
reacts to the pointer without competing with the type. Capped particle count and
DPR keep it off the critical path.

---

## Accessibility + performance contract

- `prefers-reduced-motion: reduce` removes the curtain, the cursor, the ticker
  animation, the word transforms, card transforms and the odometer transition.
  The page renders in final state.
- Only `transform` and `opacity` are animated. No layout-triggering properties,
  no `top/left` animation, no `filter` on large layers.
- All scroll and pointer listeners are `{ passive: true }` and coalesced into a
  single `requestAnimationFrame` per frame.
- Measured on the deployed page: CLS ≈ 0.03 (font swap is covered by the
  curtain), first contentful paint ≈ 92 ms locally, no console errors.

## What was *not* used, and why

| Skipped | Reason |
| --- | --- |
| GSAP / Framer Motion / Lottie | 30–70 KB of runtime to do what 400 lines of CSS + WAAPI already do here. The site has no build step; a bundler dependency would be the only reason to add one. |
| Scroll-jacking / pinned sections | Breaks keyboard scrolling, trackpads and screen readers. The drift is bounded to 780 px and never captures the scroll. |
| `IntersectionObserver` for reveals | Starved in background tabs and some webviews, which leaves content invisible. Replaced with a rect sweep. |
| Cursor replacement (`cursor: none`) | Removes the OS pointer, hurts precision and breaks accessibility. The companion ring augments the cursor instead. |
| Skeleton screens / fake loading | The page is ~65 KB of static assets. A loading state would be theatre. |
