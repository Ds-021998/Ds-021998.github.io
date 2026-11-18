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

// Workshop wall: draggable sticky notes joined by dashed lines, and arrows that draw on scroll
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const board = document.querySelector(".board");
  const desktop = window.matchMedia("(min-width: 861px)");

  if (board) {
    const notes = [...board.querySelectorAll(".sticky")];
    const svg = board.querySelector(".links");
    const ns = "http://www.w3.org/2000/svg";
    const paths = notes.slice(1).map(() => svg.appendChild(document.createElementNS(ns, "path")));

    const centre = (n) => {
      const b = board.getBoundingClientRect(), r = n.getBoundingClientRect();
      return [r.left - b.left + r.width / 2, r.top - b.top + r.height / 2];
    };
    const redraw = () => {
      if (!desktop.matches) return;
      paths.forEach((p, i) => {
        const [x1, y1] = centre(notes[i]), [x2, y2] = centre(notes[i + 1]);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + 30;
        p.setAttribute("d", `M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`);
      });
    };

    // Notes stick onto the wall one after another
    if (!reduce) notes.forEach((n, i) => { n.style.animationDelay = 0.25 + i * 0.18 + "s"; n.classList.add("landed"); });
    setTimeout(redraw, 50);
    setTimeout(redraw, 1400);
    window.addEventListener("resize", redraw);

    notes.forEach((n) => {
      let sx, sy, ox, oy, moved = false, active = false;
      n.addEventListener("pointerdown", (e) => {
        if (!desktop.matches || e.button !== 0) return;
        active = true; moved = false;
        sx = e.clientX; sy = e.clientY;
        ox = n.offsetLeft; oy = n.offsetTop;
        n.setPointerCapture(e.pointerId);
      });
      n.addEventListener("pointermove", (e) => {
        if (!active) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true;
        n.classList.remove("landed");
        n.classList.add("dragging");
        const maxX = board.clientWidth - n.offsetWidth, maxY = board.clientHeight - n.offsetHeight;
        n.style.left = Math.max(0, Math.min(maxX, ox + dx)) + "px";
        n.style.top = Math.max(0, Math.min(maxY, oy + dy)) + "px";
        redraw();
      });
      const end = () => { active = false; n.classList.remove("dragging"); };
      n.addEventListener("pointerup", end);
      n.addEventListener("pointercancel", end);
      // A drag should not also open the link
      n.addEventListener("click", (e) => { if (moved) { e.preventDefault(); moved = false; } });
      n.addEventListener("dragstart", (e) => e.preventDefault());
    });
  }

  const arrows = document.querySelectorAll(".arrow");
  if (arrows.length) {
    if (reduce || !("IntersectionObserver" in window)) arrows.forEach((a) => a.classList.add("in"));
    else {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.6 });
      arrows.forEach((a) => io.observe(a));
    }
  }
})();
