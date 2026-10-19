/* ============================================================
   Motion layer.

   Technique inventory (also documented in MOTION.md):
     1. Entrance curtain        — orient the eye, hide font swap
     2. Kinetic typography      — masked word reveal, staggered
     3. Scroll choreography     — IntersectionObserver reveals
     4. Scroll progress         — orientation for a long page
     5. Cursor companion        — pointer lag + interactive states
     6. Magnetic buttons        — attraction with damped return
     7. Card depth / tilt       — physicality + pointer glare
     8. FLIP filter transitions — spatial continuity
     9. Odometer counters       — data as motion
    10. Infinite ticker         — ambient texture, pauses on hover
    11. Hero scroll drift       — parallax on exit

   Every path is transform/opacity. All of it is disabled under
   prefers-reduced-motion (see the media query in styles.css).
   ============================================================ */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------------------------------------------------- 1. curtain */
  const curtain = document.getElementById("curtain");
  if (curtain) {
    const drop = () => {
      curtain.classList.add("done");
      setTimeout(() => curtain.remove(), 700);
    };
    window.addEventListener("load", () => setTimeout(drop, 360));
    setTimeout(drop, 1600); // never trap the page if load is slow
  }

  /* ---------------------------------------------------------- 2. split type */
  const makeWord = (node, index) => {
    const word = document.createElement("span");
    word.className = "word";
    const inner = document.createElement("span");
    inner.className = "word-i";
    inner.style.setProperty("--i", String(index));
    inner.appendChild(node);
    word.appendChild(inner);
    return word;
  };

  const split = (el, start = 0) => {
    let i = start;
    const source = Array.from(el.childNodes);
    const frag = document.createDocumentFragment();
    for (const node of source) {
      if (node.nodeType === Node.TEXT_NODE) {
        const tokens = node.textContent.split(/(\s+)/);
        for (const token of tokens) {
          if (!token) continue;
          if (/^\s+$/.test(token)) {
            frag.appendChild(document.createTextNode(" "));
            continue;
          }
          frag.appendChild(makeWord(document.createTextNode(token), i++));
        }
      } else if (node.nodeName === "BR") {
        frag.appendChild(document.createElement("br"));
      } else {
        frag.appendChild(makeWord(node, i++));
      }
    }
    el.replaceChildren(frag);
    return i;
  };

  const heroTitle = $(".hero-title");
  if (heroTitle) {
    let idx = 0;
    $$(".line[data-split]", heroTitle).forEach((line) => { idx = split(line, idx); });
    const reveal = () => heroTitle.classList.add("is-revealed");
    if (reduce) reveal();
    else setTimeout(reveal, 260);
  }

  $$("[data-split]").forEach((el) => { if (!el.closest(".hero-title")) split(el); });

  /* ---------------------------------------------------------- 3. scroll reveals */
  const revealTargets = $$("[data-split]").filter((el) => !el.closest(".hero-title"));
  const inView = (el, ratio = 0.18) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    return visible > 0 && visible >= Math.min(r.height, vh) * ratio;
  };
  const sweep = () => {
    revealTargets.forEach((el) => {
      if (!el.classList.contains("is-revealed") && inView(el)) el.classList.add("is-revealed");
    });
  };

  /* ---------------------------------------------------------- 4. progress + drift */
  const bar = document.getElementById("progress-bar");
  let scrollY = 0;
  let rafScroll = 0;
  const paintScroll = () => {
    rafScroll = 0;
    if (bar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1) : 0})`;
    }
    const inner = $(".hero-inner");
    if (inner && !reduce) {
      inner.style.transform = `translate3d(0, ${Math.round(scrollY * 0.14)}px, 0)`;
      inner.style.opacity = String(clamp(1 - scrollY / 780, 0, 1));
    }
  };
  window.addEventListener("scroll", () => {
    scrollY = window.scrollY;
    if (!rafScroll) rafScroll = requestAnimationFrame(paintScroll);
  }, { passive: true });
  paintScroll();

  /* one rAF-throttled scroll sweep drives both reveals and the odometer, so the
     page never depends on IntersectionObserver being delivered (embedded
     webviews and background tabs can starve it) */
  let rafSweep = 0;
  const onScrollSweep = () => {
    if (rafSweep) return;
    rafSweep = requestAnimationFrame(() => {
      rafSweep = 0;
      sweep();
      fireStats();
    });
  };
  window.addEventListener("scroll", onScrollSweep, { passive: true });
  window.addEventListener("resize", onScrollSweep);
  if (reduce) revealTargets.forEach((el) => el.classList.add("is-revealed"));
  onScrollSweep();
  setTimeout(() => { sweep(); fireStats(); }, 400);

  /* ---------------------------------------------------------- 5. cursor */
  const cursor = document.getElementById("cursor");
  if (cursor && fine && !reduce) {
    const ring = $(".cursor-ring", cursor);
    const dot = $(".cursor-dot", cursor);
    let mx = -100, my = -100, rx = -100, ry = -100, raf = 0, seen = false;

    const tick = () => {
      rx = lerp(rx, mx, 0.18);
      ry = lerp(ry, my, 0.18);
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", (e) => {
      mx = e.clientX; my = e.clientY;
      if (!seen) {
        seen = true;
        rx = mx; ry = my;
        tick();
      }
      const hot = e.target.closest("a, button, .card, input, label");
      cursor.classList.toggle("is-hot", Boolean(hot));
    }, { passive: true });

    document.addEventListener("pointerleave", () => cursor.classList.remove("is-hot"));
  }

  /* ---------------------------------------------------------- 6. magnetic buttons */
  if (fine && !reduce) {
    $$(".btn").forEach((btn) => {
      const strength = 0.22;
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        btn.style.setProperty("--bx", `${clamp(dx * strength, -12, 12)}px`);
        btn.style.setProperty("--by", `${clamp(dy * strength * 1.4, -10, 10)}px`);
      }, { passive: true });
      btn.addEventListener("pointerleave", () => {
        btn.style.setProperty("--bx", "0px");
        btn.style.setProperty("--by", "0px");
      });
    });
  }

  /* ---------------------------------------------------------- 7. card tilt */
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

  /* ---------------------------------------------------------- 8. nav indicator */
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

  /* ---------------------------------------------------------- 9. FLIP filters */
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

  /* ---------------------------------------------------------- 10. odometer */
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
    // the rolling strips are decoration; the accessible value is the aria-label
    cols.forEach(({ strip }) => strip.setAttribute("aria-hidden", "true"));
    requestAnimationFrame(() => {
      cols.forEach(({ strip, digit }, i) => {
        setTimeout(() => { strip.style.transform = `translateY(-${digit}em)`; }, 80 + i * 70);
      });
    });
  };

  const stats = document.getElementById("stats");
  let statsFired = false;
  const fireStats = () => {
    if (statsFired || !stats) return;
    if (!inView(stats, 0.35)) return;
    statsFired = true;
    $$("dd", stats).forEach((dd) => roll(dd, Number(dd.dataset.count || 0)));
  };
  if (stats && reduce) {
    statsFired = true;
    $$("dd", stats).forEach((dd) => { dd.textContent = String(dd.dataset.count || 0); });
  }

  /* ---------------------------------------------------------- 11. ticker */
  const ticker = document.getElementById("ticker");
  if (ticker) {
    const data = window.PORTFOLIO || {};
    const langs = (data.languages || []).map((l) => l.name);
    const extras = ["local-first", "offline by default", "MITRE ATT&CK", "Ollama", "Leaflet", "three.js", "Flask"];
    const items = [...langs, ...extras];
    const row = items.map((t) => `<span class="ticker-item">${t}</span>`).join("");
    ticker.innerHTML = row + row; // two copies => seamless -50% loop
  }

  if (reduce && curtain) curtain.remove();
})();
