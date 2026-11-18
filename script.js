// Small, dependency-free interactions. Everything works without JS too:
// details are readable, tabs fall back to the first panel.
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Expandable story chapters
  document.querySelectorAll(".toggle").forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      btn.firstChild.textContent = open ? "Read the story " : "Hide the story ";
      panel.classList.toggle("open", !open);
      panel.toggleAttribute("inert", open);
    });
  });

  // Timeline progress line that fills as you scroll
  const tl = document.querySelector(".timeline");
  if (tl) {
    const fill = tl.querySelector(".fill");
    const chapters = [...tl.querySelectorAll(".chapter")];
    const update = () => {
      const r = tl.getBoundingClientRect();
      const mid = window.innerHeight * 0.6;
      const h = Math.max(0, Math.min(r.height, mid - r.top));
      fill.style.height = h + "px";
      chapters.forEach((c) => c.classList.toggle("seen", c.getBoundingClientRect().top < mid));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  // Tabs (HabitAct rounds)
  document.querySelectorAll("[role=tablist]").forEach((list) => {
    const tabs = [...list.querySelectorAll("[role=tab]")];
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const p = document.getElementById(t.getAttribute("aria-controls"));
        p.hidden = !on;
        if (on) animatePanel(p);
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const k = e.key;
        if (k === "ArrowRight" || k === "ArrowLeft") {
          e.preventDefault();
          const n = (i + (k === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
          select(tabs[n], true);
        }
      });
    });
    select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
  });

  function animatePanel(p) {
    p.querySelectorAll(".meter i").forEach((m) => {
      m.style.width = "0";
      requestAnimationFrame(() => requestAnimationFrame(() => (m.style.width = m.dataset.w + "%")));
    });
    if (reduce) return;
    p.querySelectorAll("[data-count]").forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const dec = String(el.dataset.count).includes(".") ? 1 : 0;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 600);
        el.textContent = (end * (1 - Math.pow(1 - k, 3))).toFixed(dec) + suffix;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // Single-choice button groups that write an explanation (error codes, evidence states)
  document.querySelectorAll("[data-explain]").forEach((group) => {
    const out = document.getElementById(group.dataset.explain);
    const btns = [...group.querySelectorAll("button")];
    btns.forEach((b) =>
      b.addEventListener("click", () => {
        btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        out.innerHTML = b.querySelector("template").innerHTML;
      })
    );
    btns[0].click();
  });

  // Requirements sorter, with a FLIP animation so cards visibly move into their verdict
  const sorter = document.querySelector(".sorter");
  if (sorter) {
    const cards = [...sorter.querySelectorAll(".req")];
    const home = cards.map((c) => c.parentElement);
    const order = cards.slice();
    const buttons = [...sorter.querySelectorAll(".controls button")];
    const apply = (sorted) => {
      const first = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
      if (sorted) {
        cards.forEach((c) => sorter.querySelector(".g-" + c.dataset.v + " .reqs").appendChild(c));
      } else {
        order.forEach((c, i) => home[0].appendChild(c));
      }
      sorter.classList.toggle("sorted", sorted);
      buttons.forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.mode === "sorted") === sorted)));
      if (reduce) return;
      cards.forEach((c) => {
        const a = first.get(c), z = c.getBoundingClientRect();
        const dx = a.left - z.left, dy = a.top - z.top;
        if (!dx && !dy) return;
        c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 450, easing: "cubic-bezier(.2,.7,.2,1)" });
      });
    };
    buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.mode === "sorted")));
  }
})();

// Spatial layer: cursor light, parallax highlights, tilting cards, quiet reveals
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const root = document.documentElement;

  // Light that follows the cursor
  if (fine && !reduce) {
    let raf;
    window.addEventListener("pointermove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        root.style.setProperty("--mx", e.clientX + "px");
        root.style.setProperty("--my", e.clientY + "px");
      });
    }, { passive: true });
  }

  // Highlights float at different depths and drift with the cursor
  const chips = [...document.querySelectorAll(".chip")];
  const desktop = window.matchMedia("(min-width: 901px)");
  if (chips.length) {
    if (!reduce) chips.forEach((c, i) => { c.style.animationDelay = 0.3 + i * 0.15 + "s"; c.classList.add("enter"); });
    if (fine && !reduce) {
      const hero = document.querySelector(".space");
      hero.addEventListener("pointermove", (e) => {
        if (!desktop.matches) return;
        const r = hero.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        chips.forEach((c) => {
          const d = parseFloat(c.dataset.depth || 1);
          c.style.transform = `translate3d(${x * -40 * d}px, ${y * -30 * d}px, 0) rotateY(${x * 8}deg) rotateX(${y * -8}deg)`;
        });
      });
      hero.addEventListener("pointerleave", () => chips.forEach((c) => (c.style.transform = "")));
    }
  }

  // Cards tilt towards the cursor, with a shine where the light hits
  if (fine && !reduce) {
    document.querySelectorAll(".tilt").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.transition = "transform .1s linear, border-color .3s";
        card.style.transform = `rotateY(${(x - 0.5) * 12}deg) rotateX(${(0.5 - y) * 10}deg) translateZ(0)`;
        card.style.setProperty("--gx", x * 100 + "%");
        card.style.setProperty("--gy", y * 100 + "%");
      });
      card.addEventListener("pointerleave", () => { card.style.transition = ""; card.style.transform = ""; });
    });
  }

  // Inner pages: blocks fade in once as they enter the view
  const blocks = document.querySelectorAll("main.sheet figure, main.sheet .note, main.sheet .rounds-ui, main.sheet .sorter, main.sheet .role, main.sheet .codes, main.sheet .states");
  if (blocks.length && !reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    blocks.forEach((b) => { if (b.getBoundingClientRect().top > window.innerHeight) { b.classList.add("reveal"); io.observe(b); } });
  }
})();
