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
