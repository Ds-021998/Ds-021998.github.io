// Motion layer: ambiguity-to-roadmap particle field, custom cursor, magnetic buttons,
// decoding headline, tilt tiles and count-ups. Everything degrades to a static page.
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const root = document.documentElement;
  root.classList.add("fx");

  /* ---------- Particle field ---------- */
  const canvas = document.createElement("canvas");
  canvas.className = "field";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const isHome = !!document.querySelector(".bento");
  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let pts = [], mouse = { x: -9999, y: -9999 }, progress = 0, shown = 0;
  const COLORS = ["#4338ca", "#4338ca", "#6d5ef5", "#9aa0b4", "#84cc16"];

  let L = 0, R = 0;
  function roadPoint(t) {
    // A winding road across the content width, left to right, with gentle S bends
    const x = L + (R - L) * t;
    const y = H * (0.62 + 0.16 * Math.sin(t * Math.PI * 2.2 + 0.6));
    return [x, y];
  }
  const MILESTONES = [0.08, 0.3, 0.52, 0.74, 0.94];

  function build() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pinEl = document.querySelector(".road-pin");
    if (pinEl) { const pr = pinEl.getBoundingClientRect(); L = pr.left + 100; R = pr.right - 100; }
    else { L = W * 0.06; R = W * 0.94; }
    const n = Math.round(Math.min(420, (W * H) / 4200)) * (isHome ? 1 : 0.55);
    pts = [];
    for (let i = 0; i < n; i++) {
      // Target: most points on the road, some clustered at milestones
      let tx, ty;
      if (i % 6 === 0) {
        const m = MILESTONES[i % MILESTONES.length];
        const [mx, my] = roadPoint(m);
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 16;
        tx = mx + Math.cos(a) * r; ty = my + Math.sin(a) * r;
      } else {
        const t = Math.random();
        const [rx, ry] = roadPoint(t);
        tx = rx; ty = ry + (Math.random() - 0.5) * 10;
      }
      pts.push({
        x: Math.random() * W, y: Math.random() * H,
        hx: Math.random() * W, hy: Math.random() * H,
        tx, ty,
        vx: 0, vy: 0,
        ph: Math.random() * Math.PI * 2, sp: 0.2 + Math.random() * 0.5,
        r: i % 6 === 0 ? 2.4 : 1.2 + Math.random() * 1.1,
        c: COLORS[i % COLORS.length],
      });
    }
  }

  const stage = document.querySelector(".road-stage");
  const labels = stage ? [...stage.querySelectorAll(".milestones li")] : [];
  function scrollProgress() {
    if (!stage) return 0;
    const r = stage.getBoundingClientRect();
    const total = Math.max(1, r.height - H);
    const p = Math.max(0, Math.min(1, (-r.top + H * 0.35) / (total + H * 0.1)));
    const fade = r.bottom < H ? Math.max(0, r.bottom / H) : 1;
    return Math.min(1, p * 1.25) * fade;
  }
  function placeLabels(e) {
    if (!labels.length || W < 901 || reduce) return;
    const pin = stage.querySelector(".road-pin").getBoundingClientRect();
    labels.forEach((li, i) => {
      const [x, y] = roadPoint(MILESTONES[i]);
      const show = Math.max(0, Math.min(1, (e - 0.25 - i * 0.12) / 0.2));
      const above = i % 2 === 0;
      li.style.left = x - pin.left + "px";
      li.style.top = y - pin.top + (above ? -34 : 34) + "px";
      li.style.opacity = show;
      li.classList.toggle("above", above);
      li.style.transform = `translate(-50%, ${above ? "-100%" : "0"}) translateY(${(1 - show) * (above ? 10 : -10)}px)`;
    });
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last) / 16.67; last = now;
    progress = scrollProgress();
    shown += (progress - shown) * 0.08 * dt;
    const e = shown * shown * (3 - 2 * shown);
    placeLabels(e);
    ctx.clearRect(0, 0, W, H);

    // Road line appears as the field aligns
    if (e > 0.02) {
      ctx.beginPath();
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const [x, y] = roadPoint(t);
        t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(67,56,202,${0.18 * e})`;
      ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.stroke(); ctx.setLineDash([]);
      MILESTONES.forEach((m, i) => {
        const [x, y] = roadPoint(m);
        ctx.beginPath(); ctx.arc(x, y, 9 * e, 0, Math.PI * 2);
        ctx.fillStyle = i === MILESTONES.length - 1 ? `rgba(132,204,22,${0.9 * e})` : `rgba(67,56,202,${0.85 * e})`;
        ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 18 * e, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(67,56,202,${0.2 * e})`; ctx.lineWidth = 1.5; ctx.stroke();
      });
    }

    // Move points: drift around home positions, ease to road targets with scroll
    for (const p of pts) {
      p.ph += 0.01 * p.sp * dt;
      const wx = p.hx + Math.cos(p.ph) * 40, wy = p.hy + Math.sin(p.ph * 1.3) * 30;
      const gx = wx + (p.tx - wx) * e, gy = wy + (p.ty - wy) * e;
      p.vx += (gx - p.x) * 0.012 * dt; p.vy += (gy - p.y) * 0.012 * dt;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 140 * 140) {
        const f = (1 - Math.sqrt(d2) / 140) * 2.4;
        const d = Math.sqrt(d2) || 1;
        p.vx += (dx / d) * f * dt; p.vy += (dy / d) * f * dt;
      }
      p.vx *= 0.86; p.vy *= 0.86;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }

    // Faint links between nearby points while things are still messy
    const linkA = 0.16 * (1 - e);
    if (linkA > 0.01) {
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i += 2) {
        const a = pts[i];
        for (let j = i + 1; j < Math.min(pts.length, i + 26); j++) {
          const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 9000) {
            ctx.strokeStyle = `rgba(86,94,120,${linkA * (1 - d2 / 9000)})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
    }
    for (const p of pts) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c; ctx.globalAlpha = 0.55 + 0.35 * e; ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }

  build();
  window.addEventListener("resize", () => { build(); if (reduce) frame(performance.now()); });
  window.addEventListener("pointermove", (ev) => { mouse.x = ev.clientX; mouse.y = ev.clientY; }, { passive: true });
  window.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
  if (reduce) { shown = 0; frame(performance.now()); } else requestAnimationFrame(frame);

  /* ---------- Custom cursor ---------- */
  if (fine && !reduce) {
    const dot = document.createElement("div"); dot.className = "cur-dot";
    const ring = document.createElement("div"); ring.className = "cur-ring";
    document.body.append(dot, ring);
    dot.style.opacity = ring.style.opacity = "0";
    window.addEventListener("pointermove", () => { dot.style.opacity = ring.style.opacity = ""; }, { once: true });
    let rx = 0, ry = 0, x = 0, y = 0;
    window.addEventListener("pointermove", (ev) => { x = ev.clientX; y = ev.clientY; dot.style.transform = `translate(${x}px,${y}px)`; }, { passive: true });
    (function loop() { rx += (x - rx) * 0.18; ry += (y - ry) * 0.18; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); })();
    document.addEventListener("pointerover", (ev) => {
      const t = ev.target.closest("a, button, .tile");
      root.classList.toggle("cur-hover", !!(t && t.matches("a, button")));
      root.classList.toggle("cur-tile", !!(t && t.matches(".tile") && !t.matches("a")));
    });
    document.addEventListener("pointerdown", () => root.classList.add("cur-down"));
    document.addEventListener("pointerup", () => root.classList.remove("cur-down"));
  }

  /* ---------- Magnetic buttons ---------- */
  if (fine && !reduce) {
    document.querySelectorAll(".site-head nav a, .pill, .btn, .filters button, .toc-row a").forEach((el) => {
      el.classList.add("magnetic");
      el.addEventListener("pointermove", (ev) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(ev.clientX - r.left - r.width / 2) * 0.25}px, ${(ev.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      el.addEventListener("pointerleave", () => (el.style.transform = ""));
    });
  }

  /* ---------- Decoding headline ---------- */
  const h1 = document.querySelector("[data-decode]");
  if (h1 && !reduce) {
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=?/<>";
    const nodes = [];
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push({ n: walker.currentNode, text: walker.currentNode.textContent });
    const total = nodes.reduce((s, o) => s + o.text.length, 0);
    const t0 = performance.now(), dur = 1300;
    (function tick(now) {
      const k = Math.min(1, (now - t0) / dur);
      let seen = 0;
      nodes.forEach((o) => {
        o.n.textContent = [...o.text].map((ch, i) => {
          const pos = (seen + i) / total;
          if (ch === " " || pos < k) return ch;
          return pos < k + 0.25 ? glyphs[(Math.random() * glyphs.length) | 0] : " ";
        }).join("");
        seen += o.text.length;
      });
      if (k < 1) requestAnimationFrame(tick); else nodes.forEach((o) => (o.n.textContent = o.text));
    })(t0);
  }

  /* ---------- Tilt and light on tiles ---------- */
  if (fine && !reduce) {
    document.querySelectorAll(".bento .tile, .glance-tile, .chapter").forEach((t) => {
      t.addEventListener("pointermove", (ev) => {
        const r = t.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        t.style.setProperty("--lx", x * 100 + "%"); t.style.setProperty("--ly", y * 100 + "%");
        if (t.closest(".bento")) t.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 6}deg) translateY(-3px)`;
      });
      t.addEventListener("pointerleave", () => (t.style.transform = ""));
    });
  }

  /* ---------- Count up when visible ---------- */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      if (reduce) return;
      const el = en.target, end = parseInt(el.dataset.count, 10), t0 = performance.now();
      (function step(t) {
        const k = Math.min(1, (t - t0) / 1000);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }), { threshold: 0.6 });
    counters.forEach((c) => io.observe(c));
  }
})();
