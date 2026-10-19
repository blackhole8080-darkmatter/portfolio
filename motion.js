/* ============================================================
   Film layer.

   The page is treated as one continuous take rather than a stack
   of sections that fade in. Five reference languages, mapped:

     1. ONE TAKE      — every scene exposes a single progress value
                        (--p). Content and paper sit at different
                        depths, so scrolling travels past them the
                        way a dolly travels past a set. Nothing is
                        staged at opacity 0 waiting to fade in.
     2. HYPERFRAMES   — headings are wiped on like lower thirds,
                        scene numerals slab in, rules draw.
     3. COLLAGE       — torn-paper scraps assemble in the margins;
                        tape tabs mark the splice between shots.
     4. ANIMATION BASE— hand-drawn line work draws itself, with a
                        two-frame boil.
     5. LEMO-OPUSCAR  — leader card, letterbox, HUD timecode,
                        24fps grain, grade and vignette.

   Kept from the first cut because they do a job: FLIP filtering,
   the odometer, the ticker, tilt and magnetic buttons.

   Everything is transform / clip-path / opacity. With JS off the
   page is a legible still frame; under prefers-reduced-motion it is
   a still frame by choice.
   ============================================================ */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad = (n) => String(n).padStart(2, "0");

  /* deterministic noise, so the tears look the same on every load */
  const rng = (seed) => {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const leader = document.getElementById("leader");
  const hero = $(".hero");

  /* ---------------------------------------------------------- 1. camera + scenes */
  const scenes = $$(".scene");
  let metrics = [];
  let raf = 0;

  const measure = () => {
    const y = window.scrollY;
    metrics = scenes.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, top: r.top + y, h: r.height };
    });
    paint();
  };

  const hudScene = document.getElementById("hud-scene");
  const hudTc = document.getElementById("hud-tc");
  const bar = document.getElementById("progress-bar");
  const threadPath = document.querySelector("#thread path");
  const TOTAL_SECONDS = 72;
  const TOTAL_FRAMES = TOTAL_SECONDS * 24;

  const progress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  };

  const paint = () => {
    raf = 0;
    const vh = window.innerHeight;
    const sy = window.scrollY;
    const p = progress();

    let current = null;
    let best = -Infinity;
    let nearestAny = null;
    let nearestGap = Infinity;

    for (const m of metrics) {
      const topInView = m.top - sy;
      const center = topInView + m.h / 2;
      /* -1 above the eye line, 0 on it, +1 below */
      const depth = clamp((vh / 2 - center) / (m.h / 2 + vh / 2), -1, 1);
      m.el.style.setProperty("--p", depth.toFixed(4));

      if (!m.el.classList.contains("is-set") && topInView < vh * 0.88) {
        m.el.classList.add("is-set");
      }

      /* The shot you are in is the last one whose top has crossed the
         eye line. Using the section centre fails for sections taller
         than the viewport: Work would read as "next" for thousands of
         pixels while you are already inside it. */
      if (topInView <= vh * 0.42 && topInView > best) {
        best = topInView;
        current = m.el;
      }
      const gap = Math.abs(topInView - vh * 0.42);
      if (gap < nearestGap) { nearestGap = gap; nearestAny = m.el; }
    }

    if (!current) current = nearestAny;

    if (current && hudScene) {
      hudScene.textContent = `shot ${current.dataset.scene} — ${current.dataset.label || ""}`;
    }

    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;

    if (threadPath) threadPath.style.strokeDashoffset = String(1 - p);

    if (hudTc) {
      const f = Math.round(p * TOTAL_FRAMES);
      hudTc.textContent = `00:${pad(Math.floor(f / 1440))}:${pad(Math.floor(f / 24) % 60)}:${pad(f % 24)}`;
    }
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(paint);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", () => { measure(); schedule(); });
  window.addEventListener("load", measure);

  if (reduce) {
    scenes.forEach((el) => el.classList.add("is-set"));
    if (threadPath) threadPath.style.strokeDashoffset = "0";
  }

  /* ---------------------------------------------------------- 2. title-card type */
  const maskify = (el) => {
    const groups = [];
    let group = [];
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeName === "BR") { groups.push(group); group = []; }
      else group.push(node);
    });
    groups.push(group);

    const frag = document.createDocumentFragment();
    let i = 0;
    groups.forEach((nodes) => {
      const hasContent = nodes.some(
        (n) => n.nodeType === 1 || (n.textContent || "").trim().length > 0
      );
      if (!hasContent) return;
      const mask = document.createElement("span");
      mask.className = "mask";
      const line = document.createElement("span");
      line.className = "line-i";
      line.style.setProperty("--i", String(i++));
      nodes.forEach((n) => line.appendChild(n.cloneNode(true)));
      mask.appendChild(line);
      frag.appendChild(mask);
    });
    el.replaceChildren(frag);
  };

  $$("[data-split]").forEach((el) => {
    if (el.classList.contains("hero-title")) {
      $$(".line", el).forEach(maskify);
    } else {
      maskify(el);
    }
  });

  if (reduce) $$("[data-split]").forEach((el) => el.classList.add("is-set"));

  /* ---------------------------------------------------------- 3. collage b-roll */
  const torn = (seed, jag) => {
    const r = rng(seed);
    const pts = [];
    const perEdge = 5;
    const edge = (x0, y0, x1, y1) => {
      for (let i = 0; i < perEdge; i++) {
        const t = i / perEdge;
        const jx = (r() - 0.5) * jag;
        const jy = (r() - 0.5) * jag;
        pts.push(
          `${clamp(x0 + (x1 - x0) * t + jx, 0, 100).toFixed(2)}% ` +
          `${clamp(y0 + (y1 - y0) * t + jy, 0, 100).toFixed(2)}%`
        );
      }
    };
    edge(0, 0, 100, 0);
    edge(100, 0, 100, 100);
    edge(100, 100, 0, 100);
    edge(0, 100, 0, 0);
    return `polygon(${pts.join(", ")})`;
  };

  /* Paper is placed only where there is guaranteed whitespace: the
     top and bottom padding bands of a section, and the outer margins.
     Never behind running text — a bone scrap under a white serif
     headline is the one thing this look cannot survive. */
  const COLLAGE = {
    "00": [
      { k: "still", l: "76%", t: "10%", w: "clamp(96px, 12vw, 176px)", h: "clamp(62px, 8vw, 110px)", rot: 6.5, dz: 46, from: [34, -54] },
      { k: "oxide", l: "-1%", t: "44%", w: "clamp(44px, 4.4vw, 64px)", h: "clamp(88px, 9vw, 140px)", rot: -8, dz: 30, from: [-38, 58] },
      { k: "tape", l: "52%", t: "90%", w: "clamp(96px, 12vw, 176px)", h: "clamp(15px, 1.8vw, 22px)", rot: -3.4, dz: 16, from: [-46, 26] },
      { k: "dots", l: "91%", t: "64%", w: "clamp(46px, 5vw, 84px)", h: "clamp(46px, 5vw, 84px)", rot: 4, dz: 70, from: [22, 34] }
    ],
    "01": [
      { k: "bone", l: "73%", t: "0px", w: "clamp(84px, 9vw, 124px)", h: "clamp(78px, 8vw, 104px)", rot: -5, dz: 40, from: [-56, 40] },
      { k: "tape", l: "38%", t: "14px", w: "clamp(120px, 16vw, 220px)", h: "clamp(14px, 1.6vw, 20px)", rot: 1.6, dz: 14, from: [0, -30] },
      { k: "oxide", l: "88%", t: "26px", w: "clamp(44px, 5vw, 62px)", h: "clamp(62px, 7vw, 92px)", rot: 8, dz: 58, from: [42, 66] },
      { k: "navy", l: "-2%", b: "26px", w: "clamp(88px, 10vw, 140px)", h: "clamp(56px, 6vw, 84px)", rot: 5, dz: 34, from: [-44, 30] }
    ],
    "02": [
      { k: "navy", l: "79%", t: "18px", w: "clamp(74px, 8vw, 118px)", h: "clamp(96px, 11vw, 156px)", rot: 7, dz: 44, from: [40, -46] },
      { k: "oxide", l: "-2.5%", t: "9%", w: "clamp(40px, 4vw, 58px)", h: "clamp(74px, 8vw, 110px)", rot: -7, dz: 30, from: [-40, 40] },
      { k: "tape", l: "6%", b: "20px", w: "clamp(96px, 12vw, 170px)", h: "clamp(14px, 1.7vw, 20px)", rot: 2.4, dz: 16, from: [-30, 22] }
    ],
    "03": [
      { k: "oxide", l: "87%", t: "20px", w: "clamp(48px, 5.4vw, 74px)", h: "clamp(80px, 9vw, 134px)", rot: 7, dz: 36, from: [-48, -34] },
      { k: "bone", l: "-2%", t: "16px", w: "clamp(64px, 7vw, 96px)", h: "clamp(52px, 5.6vw, 74px)", rot: -4, dz: 24, from: [18, -40] },
      { k: "dots", l: "93%", b: "30px", w: "clamp(48px, 5vw, 80px)", h: "clamp(48px, 5vw, 80px)", rot: -5, dz: 66, from: [28, 32] }
    ],
    "04": [
      { k: "bone", l: "86%", t: "34px", w: "clamp(70px, 7.6vw, 104px)", h: "clamp(72px, 8vw, 112px)", rot: -6, dz: 38, from: [44, -36] },
      { k: "navy", l: "2%", b: "26px", w: "clamp(84px, 9vw, 122px)", h: "clamp(52px, 5.6vw, 76px)", rot: 4, dz: 32, from: [-38, 34] },
      { k: "tape", l: "24%", b: "32px", w: "clamp(96px, 12vw, 170px)", h: "clamp(14px, 1.6vw, 20px)", rot: -2, dz: 15, from: [0, 26] }
    ]
  };

  const ns = "http://www.w3.org/2000/svg";

  scenes.forEach((scene) => {
    const id = scene.dataset.scene;
    const cfg = COLLAGE[id];
    if (!cfg) return;

    const layer = document.createElement("div");
    layer.className = "collage";
    layer.setAttribute("aria-hidden", "true");

    cfg.forEach((item, i) => {
      const scrap = document.createElement("span");
      scrap.className = "scrap";
      scrap.style.left = item.l;
      if (item.b) scrap.style.bottom = item.b;
      else scrap.style.top = item.t;
      scrap.style.width = item.w;
      scrap.style.height = item.h;
      scrap.style.setProperty("--dz", String(item.dz));
      scrap.style.setProperty("--rot", `${item.rot}deg`);

      const paper = document.createElement("span");
      paper.className = `paper paper--${item.k}`;
      paper.style.setProperty("--fx", `${item.from[0]}px`);
      paper.style.setProperty("--fy", `${item.from[1]}px`);
      paper.style.setProperty("--i", String(i));
      if (item.k === "bone" || item.k === "oxide" || item.k === "navy") {
        paper.style.setProperty("--clip", torn(i * 31 + Number(id) * 7 + 5, item.k === "tape" ? 1.4 : 3.6));
      }

      scrap.appendChild(paper);
      layer.appendChild(scrap);
    });

    scene.insertBefore(layer, scene.firstChild);

    /* tape tabs at the splice into this shot */
    if (!scene.classList.contains("hero")) {
      const seam = document.createElement("div");
      seam.className = "seam";
      seam.setAttribute("aria-hidden", "true");
      seam.innerHTML = "<i></i><i></i>";
      scene.appendChild(seam);
    }

    /* slab numeral, wiped in like a slate */
    const head = $(".section-head", scene) || scene;
    /* 00 is the prologue — a slate numeral on the open would be noise */
    if (id !== "00" && !head.querySelector(".scene-num")) {
      const num = document.createElement("span");
      num.className = "scene-num";
      num.setAttribute("aria-hidden", "true");
      num.textContent = id;
      head.appendChild(num);
    }
  });

  /* ---------------------------------------------------------- 4. hand-drawn rings */
  const heroTitle = $(".hero-title");

  const ringPath = (seed) => {
    const r = rng(seed);
    const N = 26;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const w = 1 + (r() - 0.5) * 0.06;
      pts.push([50 + Math.cos(a) * 46 * w, 50 + Math.sin(a) * 43 * w]);
    }
    let d = `M ${((pts[N - 1][0] + pts[0][0]) / 2).toFixed(1)} ${((pts[N - 1][1] + pts[0][1]) / 2).toFixed(1)}`;
    for (let i = 0; i < N; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % N];
      d += ` Q ${a[0].toFixed(1)} ${a[1].toFixed(1)} ${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`;
    }
    return `${d} Z`;
  };

  const drawRings = () => {
    if (!hero || !heroTitle) return;
    $$(".hand-circle", hero).forEach((n) => n.remove());
    const hr = hero.getBoundingClientRect();
    /* one ring, on the last word. Three would read as decoration;
       one reads as a note someone made while reading. */
    $$("em", heroTitle).slice(-1).forEach((em, idx) => {
      const r = em.getBoundingClientRect();
      if (!r.width) return;
      const padX = 13;
      const padY = 10;
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("class", "hand-circle");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("aria-hidden", "true");
      svg.style.left = `${r.left - hr.left - padX}px`;
      svg.style.top = `${r.top - hr.top - padY}px`;
      svg.style.width = `${r.width + padX * 2}px`;
      svg.style.height = `${r.height + padY * 2}px`;
      svg.innerHTML =
        `<path pathLength="1" vector-effect="non-scaling-stroke" d="${ringPath(idx * 17 + 3)}"/>` +
        `<path pathLength="1" vector-effect="non-scaling-stroke" d="${ringPath(idx * 17 + 41)}"/>`;
      hero.appendChild(svg);
    });
  };

  if (heroTitle) {
    drawRings();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawRings);
    let resizeT = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(drawRings, 180);
    });
  }

  /* ---------------------------------------------------------- keepers: tilt */
  if (fine && !reduce) {
    $$(".card").forEach((card) => {
      card.addEventListener("pointerenter", () => card.classList.add("is-tilting"));
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--rx", `${(-ny * 3.4).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${(nx * 4.6).toFixed(2)}deg`);
        card.style.setProperty("--cx", `${e.clientX - r.left}px`);
        card.style.setProperty("--cy", `${e.clientY - r.top}px`);
      }, { passive: true });
      card.addEventListener("pointerleave", () => {
        card.classList.remove("is-tilting");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------------------------------------------------------- keepers: magnetic buttons */
  if (fine && !reduce) {
    $$(".btn").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        btn.style.setProperty("--bx", `${clamp(dx * 0.22, -12, 12)}px`);
        btn.style.setProperty("--by", `${clamp(dy * 0.3, -10, 10)}px`);
      }, { passive: true });
      btn.addEventListener("pointerleave", () => {
        btn.style.setProperty("--bx", "0px");
        btn.style.setProperty("--by", "0px");
      });
    });
  }

  /* ---------------------------------------------------------- keepers: nav indicator */
  const links = $(".nav-links");
  if (links && !reduce) {
    const ink = document.createElement("span");
    ink.className = "nav-ink";
    ink.setAttribute("aria-hidden", "true");
    links.appendChild(ink);
    const move = (el) => {
      if (!el) { ink.style.opacity = "0"; return; }
      const r = el.getBoundingClientRect();
      const p = links.getBoundingClientRect();
      ink.style.opacity = "1";
      ink.style.width = `${r.width}px`;
      ink.style.transform = `translateX(${r.left - p.left}px)`;
    };
    $$("a", links).forEach((a) => {
      a.addEventListener("pointerenter", () => move(a));
      a.addEventListener("focus", () => move(a));
    });
    links.addEventListener("pointerleave", () => move(null));
  }

  /* ---------------------------------------------------------- keepers: FLIP filters */
  const filterBar = document.getElementById("filters");
  if (filterBar) {
    filterBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter");
      if (!btn) return;
      const key = btn.dataset.filter;
      const cards = $$(".card");
      const first = new Map();
      if (!reduce) cards.forEach((c) => first.set(c, c.getBoundingClientRect()));

      $$(".filter", filterBar).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      cards.forEach((c) => {
        const cats = (c.dataset.cats || "").split(" ");
        c.classList.toggle("filtered-out", key !== "all" && !cats.includes(key));
      });

      if (reduce) return;
      cards.forEach((card) => {
        if (card.classList.contains("filtered-out")) return;
        const before = first.get(card);
        if (!before) return;
        const after = card.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        card.animate(
          [{ transform: `translate3d(${dx}px, ${dy}px, 0)` }, { transform: "none" }],
          { duration: 560, easing: "cubic-bezier(.22,1,.36,1)" }
        );
      });
    });
  }

  /* ---------------------------------------------------------- keepers: odometer */
  const roll = (el, value) => {
    const text = String(value);
    el.textContent = "";
    el.classList.add("odo");
    el.setAttribute("aria-label", text);
    const cols = [];
    for (const ch of text) {
      if (!/\d/.test(ch)) {
        const sep = document.createElement("span");
        sep.textContent = ch;
        el.appendChild(sep);
        continue;
      }
      const col = document.createElement("span");
      col.className = "odo-col";
      const strip = document.createElement("span");
      strip.className = "odo-strip";
      for (let d = 0; d <= 9; d++) {
        const digit = document.createElement("span");
        digit.textContent = String(d);
        strip.appendChild(digit);
      }
      col.appendChild(strip);
      el.appendChild(col);
      cols.push({ strip, digit: Number(ch) });
    }
    cols.forEach(({ strip }) => strip.setAttribute("aria-hidden", "true"));
    requestAnimationFrame(() => {
      cols.forEach(({ strip, digit }, i) => {
        setTimeout(() => { strip.style.transform = `translateY(-${digit}em)`; }, 80 + i * 70);
      });
    });
  };

  const stats = document.getElementById("stats");
  let statsFired = false;
  if (stats && reduce) {
    statsFired = true;
    $$("dd", stats).forEach((dd) => { dd.textContent = String(dd.dataset.count || 0); });
  }

  const fireStats = () => {
    if (statsFired || !stats) return;
    const r = stats.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.top > vh * 0.85) return;
    statsFired = true;
    $$("dd", stats).forEach((dd) => roll(dd, Number(dd.dataset.count || 0)));
  };
  window.addEventListener("scroll", fireStats, { passive: true });
  setTimeout(fireStats, 600);

  /* ---------------------------------------------------------- keepers: ticker */
  const ticker = document.getElementById("ticker");
  if (ticker) {
    const data = window.PORTFOLIO || {};
    const langs = (data.languages || []).map((l) => l.name);
    const extras = ["local-first", "offline by default", "MITRE ATT&CK", "Ollama", "Leaflet", "three.js", "Flask"];
    const items = [...langs, ...extras];
    const row = items.map((t) => `<span class="ticker-item">${t}</span>`).join("");
    ticker.innerHTML = row + row; // two copies, seamless -50% loop
  }

  /* ---------------------------------------------------------- boot */
  const begin = () => {
    if (hero) hero.classList.add("is-set");
    paint();
  };

  measure();

  if (reduce) {
    if (leader) leader.remove();
    begin();
  } else if (leader) {
    setTimeout(begin, 1000);                               // hero starts as the leader lifts
    setTimeout(() => leader.classList.add("done"), 1040);  // clip-path wipes upward
    setTimeout(() => leader.remove(), 1900);
  } else {
    begin();
  }
})();
