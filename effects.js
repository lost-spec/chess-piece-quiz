const FX = (() => {
  const M = Motion;
  const s = M.state;
  const doc = document;
  const shell = doc.querySelector(".shell");
  const reduced = M.reduced;
  const fine = s.fine;
  const pointerFx = fine && !reduced;

  const root = doc.documentElement;
  const damp = (rate, dt) => 1 - Math.pow(1 - rate, dt * 60);
  const px = (v) => `${v.toFixed(2)}px`;
  const deg = (v) => `${v.toFixed(2)}deg`;

  /* ---------------------------------------------------------------- cursor */

  let cursor = null;
  let cursorRing = null;
  let cursorDot = null;
  let cursorGlyph = null;

  function buildCursor() {
    if (!pointerFx || cursor) return;
    cursor = doc.createElement("div");
    cursor.className = "fx-cursor";
    cursor.innerHTML =
      '<span class="fx-ring"><i class="fx-ring-fill"></i></span>' +
      '<span class="fx-dot"></span>' +
      '<span class="fx-glyph"></span>';
    doc.body.appendChild(cursor);
    cursorRing = cursor.querySelector(".fx-ring");
    cursorDot = cursor.querySelector(".fx-dot");
    cursorGlyph = cursor.querySelector(".fx-glyph");
    root.classList.add("fx-cursor-on");

    let rx = s.x;
    let ry = s.y;
    let dx = s.x;
    let dy = s.y;
    let rs = 1;
    let rsv = 0;
    let lastHover = null;

    M.on((dt, now) => {
      rx += (s.x - rx) * damp(0.16, dt);
      ry += (s.y - ry) * damp(0.16, dt);
      dx += (s.x - dx) * damp(0.55, dt);
      dy += (s.y - dy) * damp(0.55, dt);

      const grab = cursor.classList.contains("is-grab");
      const target = grab ? 1.9 : cursor.classList.contains("is-hover") ? 1.5 : 1;
      [rs, rsv] = M.spring(rs, target, rsv, 190, 22, dt);
      const boost = Math.min(1, s.speed / 55);

      cursor.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      cursorRing.style.transform = `translate(-50%, -50%) scale(${(rs + boost * 0.22).toFixed(3)})`;
      cursorRing.style.setProperty("--boost", boost.toFixed(3));
      cursorDot.style.transform = `translate(-50%, -50%) scale(${(1 - boost * 0.35).toFixed(3)})`;

      const hidden = !s.inside || s.idle > 2200;
      cursor.classList.toggle("is-idle", hidden && !grab);
      cursor.classList.toggle("is-press", s.down && !grab);
    });

    doc.addEventListener(
      "pointerover",
      (event) => {
        const hit = event.target.closest("button, a, .option, .piece-card, .kpi, .flip-card, .cf-row, .histo-row, .line-dot, .drag-piece");
        if (hit === lastHover) return;
        lastHover = hit;
        cursor.classList.toggle("is-hover", Boolean(hit));
        cursorGlyph.textContent = hit && hit.classList.contains("drag-piece") ? hit.dataset.glyph : "";
      },
      { passive: true }
    );

    doc.addEventListener("pointerout", (event) => {
      if (event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest("button, a, .option, .piece-card, .kpi, .flip-card, .cf-row, .histo-row, .line-dot, .drag-piece")) return;
      lastHover = null;
      cursor.classList.remove("is-hover");
      cursorGlyph.textContent = "";
    }, { passive: true });
  }

  /* ------------------------------------------------------------- spotlight */

  function buildSpotlight() {
    if (!pointerFx) return;
    const spot = doc.createElement("div");
    spot.className = "fx-spot";
    doc.body.appendChild(spot);
    let sx = s.x;
    let sy = s.y;
    M.on((dt) => {
      sx += (s.x - sx) * damp(0.1, dt);
      sy += (s.y - sy) * damp(0.1, dt);
      const boost = Math.min(1, s.speed / 90);
      spot.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      spot.style.opacity = (0.55 + boost * 0.45).toFixed(3);
    });
  }

  /* ------------------------------------------------------------ shell tilt */

  function buildShellTilt() {
    if (!pointerFx || !shell) return;
    let rx = 0;
    let ry = 0;
    let vx = 0;
    let vy = 0;
    M.on((dt) => {
      const tx = M.clamp(-s.ny * 2.4, -3.2, 3.2);
      const ty = M.clamp(s.nx * 2.4, -3.2, 3.2);
      [rx, vx] = M.spring(rx, tx, vx, 90, 15, dt);
      [ry, vy] = M.spring(ry, ty, vy, 90, 15, dt);
      shell.style.setProperty("--shell-rx", deg(rx));
      shell.style.setProperty("--shell-ry", deg(ry));
    });
  }

  /* ----------------------------------------- magnetic fields + tilt + press */

  const FIELD_SEL = ".btn, .option, .piece-card, .kpi";
  const MAGNET = { btn: 0.28, ".btn-lg": 0.4, option: 0.1, ".piece-card": 0.16, kpi: 0.12 };
  const TILT_MAX = { option: 5, ".piece-card": 7, kpi: 4, ".btn": 2.5 };

  let fields = [];

  function collectFields() {
    fields = [...doc.querySelectorAll(FIELD_SEL)].map((el) => ({
      el,
      rect: null,
      age: 99,
      mx: 0,
      my: 0,
      mvx: 0,
      mvy: 0,
      rx: 0,
      ry: 0,
      rvx: 0,
      rvy: 0,
      press: 1,
      pv: 0,
      shown: { mx: 0, my: 0, rx: 0, ry: 0, press: 1 }
    }));
  }

  function fieldStrength(el) {
    const cls = el.classList;
    if (cls.contains("option")) return MAGNET.option;
    if (cls.contains("piece-card")) return MAGNET[".piece-card"];
    if (cls.contains("kpi")) return MAGNET.kpi;
    if (cls.contains("btn-lg")) return MAGNET[".btn-lg"];
    return MAGNET.btn;
  }

  function fieldTilt(el) {
    const cls = el.classList;
    if (cls.contains("option")) return TILT_MAX.option;
    if (cls.contains("piece-card")) return TILT_MAX[".piece-card"];
    if (cls.contains("kpi")) return TILT_MAX.kpi;
    return TILT_MAX[".btn"];
  }

  function buildFields() {
    collectFields();
    let frame = 0;
    M.on((dt) => {
      frame++;
      for (const f of fields) {
        if (!f.el.isConnected) continue;
        f.age++;
        if (frame % 6 === 0 || f.age > 30) {
          f.rect = f.el.getBoundingClientRect();
          f.age = 0;
        }
        const r = f.rect;
        if (!r || !r.width) continue;

        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = s.x - cx;
        const dy = s.y - cy;
        const near = M.clamp(1 - Math.hypot(dx, dy) / 190, 0, 1);
        const inside = s.x > r.left && s.x < r.right && s.y > r.top && s.y < r.bottom;

        const k = fieldStrength(f.el);
        const tmax = fieldTilt(f.el);
        const tmx = inside ? (s.x - cx) * k * 0.5 : dx * near * k;
        const tmy = inside ? (s.y - cy) * k * 0.35 : dy * near * k * 0.6;
        const trx = inside ? ((s.y - cy) / r.height) * tmax : 0;
        const try_ = inside ? (-(s.x - cx) / r.width) * tmax : 0;
        const tpress = s.down && inside ? 0.965 : 1;

        [f.mx, f.mvx] = M.spring(f.mx, tmx, f.mvx, 150, 17, dt);
        [f.my, f.mvy] = M.spring(f.my, tmy, f.mvy, 150, 17, dt);
        [f.rx, f.rvx] = M.spring(f.rx, trx, f.rvx, 120, 16, dt);
        [f.ry, f.rvy] = M.spring(f.ry, try_, f.rvy, 120, 16, dt);
        [f.press, f.pv] = M.spring(f.press, tpress, f.pv, 420, 26, dt);

        const g = f.shown;
        const st = f.el.style;
        if (Math.abs(f.mx - g.mx) > 0.02) {
          g.mx = f.mx;
          st.setProperty("--mx", px(f.mx));
        }
        if (Math.abs(f.my - g.my) > 0.02) {
          g.my = f.my;
          st.setProperty("--my", px(f.my));
        }
        if (Math.abs(f.rx - g.rx) > 0.02) {
          g.rx = f.rx;
          st.setProperty("--rx", deg(f.rx));
        }
        if (Math.abs(f.ry - g.ry) > 0.02) {
          g.ry = f.ry;
          st.setProperty("--ry", deg(f.ry));
        }
        if (Math.abs(f.press - g.press) > 0.002) {
          g.press = f.press;
          st.setProperty("--press", f.press.toFixed(3));
        }
        if (inside !== f.inside) {
          f.inside = inside;
          f.el.classList.toggle("is-near", near > 0.02 && inside);
        }
      }
    });

    const refresh = () => collectFields();
    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("scroll", refresh, { passive: true });
    const mo = new MutationObserver(() => {
      if (moTimer) return;
      moTimer = window.setTimeout(() => {
        moTimer = 0;
        collectFields();
      }, 60);
    });
    let moTimer = 0;
    if (shell) mo.observe(shell, { childList: true, subtree: true });
  }

  /* ---------------------------------------------------------------- ripple */

  function buildRipple() {
    if (reduced) return;
    doc.addEventListener(
      "pointerdown",
      (event) => {
        const host = event.target.closest(FIELD_SEL);
        if (!host || !host.classList.contains("btn") && !host.classList.contains("option")) return;
        const r = host.getBoundingClientRect();
        const size = Math.max(r.width, r.height) * 2.1;
        const wave = doc.createElement("span");
        wave.className = "ripple";
        wave.style.width = `${size}px`;
        wave.style.height = `${size}px`;
        wave.style.left = `${event.clientX - r.left - size / 2}px`;
        wave.style.top = `${event.clientY - r.top - size / 2}px`;
        if (getComputedStyle(host).position === "static") host.style.position = "relative";
        host.appendChild(wave);
        wave.addEventListener("animationend", () => wave.remove());
        setTimeout(() => wave.remove(), 900);
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------- scroll-linked reveals */

  let pendingReveals = [];
  let scrollRail = null;

  function collectReveals() {
    pendingReveals = [...doc.querySelectorAll("[data-reveal]:not(.is-in)")];
  }

  function buildReveals() {
    const rail = doc.createElement("div");
    rail.className = "fx-rail";
    doc.body.appendChild(rail);
    scrollRail = rail.firstElementChild;

    collectReveals();
    if (reduced) {
      pendingReveals.forEach((el) => el.classList.add("is-in"));
      pendingReveals = [];
      return;
    }

    let frame = 0;
    M.on((dt) => {
      frame++;
      if (frame % 3 === 0) {
        for (let i = pendingReveals.length - 1; i >= 0; i--) {
          const el = pendingReveals[i];
          if (!el.isConnected) {
            pendingReveals.splice(i, 1);
            continue;
          }
          const r = el.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          if (el.closest("[hidden]")) continue;
          if (r.top < window.innerHeight * 0.92 && r.bottom > -40) {
            el.classList.add("is-in");
            if (el.hasAttribute("data-par")) {
              M.tween({
                from: 26,
                to: 0,
                duration: 820,
                ease: M.Ease.outExpo,
                onUpdate(v) {
                  el.style.setProperty("--par", `${(-v).toFixed(2)}px`);
                }
              });
            }
            pendingReveals.splice(i, 1);
          }
        }
      }

      if (scrollRail) {
        const max = doc.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? M.clamp(s.scroll / max, 0, 1) : 0;
        scrollRail.style.transform = `scaleX(${p.toFixed(4)})`;
      }
    });

    const mo = new MutationObserver(() => collectReveals());
    if (shell) mo.observe(shell, { childList: true, subtree: true });
  }

  /* ------------------------------------------------------- title scramble */

  function buildScramble() {
    const title = doc.getElementById("title-text");
    if (!title) return;
    const text = title.textContent.trim();
    let last = 0;
    const run = () => {
      const now = performance.now();
      if (now - last < 4000) return;
      last = now;
      M.scramble(title, text, 1100);
    };
    if (reduced) return;
    window.setTimeout(run, 420);
    const mo = new MutationObserver(() => {
      if (!doc.getElementById("screen-intro") || doc.getElementById("screen-intro").hasAttribute("hidden")) return;
      run();
    });
    if (shell) mo.observe(shell, { attributes: true, attributeFilter: ["hidden"], subtree: true });
  }

  /* --------------------------------------------------- draggable intro bits */

  function buildDragPieces() {
    const intro = doc.getElementById("screen-intro");
    if (!intro || reduced) return;
    const layer = doc.createElement("div");
    layer.className = "drag-layer";
    layer.setAttribute("aria-hidden", "true");
    intro.appendChild(layer);

    const glyphs = ["♞", "♝", "♜", "♛", "♚", "♟"];
    const spots = [
      [0.05, 0.1],
      [0.9, 0.09],
      [0.04, 0.33],
      [0.92, 0.31],
      [0.05, 0.57],
      [0.93, 0.56],
      [0.07, 0.8],
      [0.9, 0.79]
    ];

    const pieces = spots.map((spot, i) => {
      const el = doc.createElement("span");
      el.className = "drag-piece";
      el.dataset.glyph = glyphs[i % glyphs.length];
      el.style.fontSize = `${34 + (i % 3) * 11}px`;
      el.textContent = el.dataset.glyph;
      layer.appendChild(el);
      return { el, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0, hx: 0, hy: 0, spot, i, grabbed: false, phase: i * 1.7 };
    });

    let w = 0;
    let h = 0;
    const measure = () => {
      const r = layer.getBoundingClientRect();
      w = r.width;
      h = r.height;
      for (const p of pieces) {
        p.hx = p.spot[0] * Math.max(0, w - 70);
        p.hy = p.spot[1] * Math.max(0, h - 70);
        if (!p.grabbed) {
          p.x = p.hx;
          p.y = p.hy;
        }
      }
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    window.setTimeout(measure, 400);

    let origin = null;
    const local = (event) => {
      const r = layer.getBoundingClientRect();
      return { x: event.clientX - r.left, y: event.clientY - r.top };
    };

    for (const p of pieces) {
      p.el.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        p.grabbed = true;
        p.el.setPointerCapture(event.pointerId);
        p.el.classList.add("is-grabbed");
        origin = { x: event.clientX, y: event.clientY };
        if (cursor) {
          cursor.classList.add("is-grab");
          cursorGlyph.textContent = p.el.dataset.glyph;
        }
      });

      p.el.addEventListener("pointermove", (event) => {
        if (!p.grabbed) return;
        const now = local(event);
        p.vx = (now.x - p.x) * 14;
        p.vy = (now.y - p.y) * 14;
        p.x = now.x;
        p.y = now.y;
      });

      const release = (event) => {
        if (!p.grabbed) return;
        p.grabbed = false;
        p.el.classList.remove("is-grabbed");
        try {
          p.el.releasePointerCapture(event.pointerId);
        } catch (err) {}
        if (cursor) {
          cursor.classList.remove("is-grab");
          cursorGlyph.textContent = "";
        }
        origin = null;
      };
      p.el.addEventListener("pointerup", release);
      p.el.addEventListener("pointercancel", release);
      p.el.addEventListener("lostpointercapture", release);
    }

    M.on((dt, now) => {
      if (!w) return;
      for (const p of pieces) {
        if (!p.grabbed) {
          const drift = Math.sin(now / 2400 + p.phase) * 5;
          [p.x, p.vx] = M.spring(p.x, p.hx + drift, p.vx, 42, 9.5, dt);
          [p.y, p.vy] = M.spring(p.y, p.hy + Math.cos(now / 2700 + p.phase) * 5, p.vy, 42, 9.5, dt);

          if (fine && s.inside) {
            const r = layer.getBoundingClientRect();
            const px2 = s.x - r.left;
            const py2 = s.y - r.top;
            const dx = p.x - px2;
            const dy = p.y - py2;
            const d = Math.hypot(dx, dy);
            if (d < 150 && d > 0.01) {
              const push = (1 - d / 150) * 1400 * dt;
              p.vx += (dx / d) * push;
              p.vy += (dy / d) * push;
            }
          }

          if (p.x < 0) {
            p.x = 0;
            p.vx = Math.abs(p.vx) * 0.45;
          }
          if (p.x > w - 70) {
            p.x = w - 70;
            p.vx = -Math.abs(p.vx) * 0.45;
          }
          if (p.y < 0) {
            p.y = 0;
            p.vy = Math.abs(p.vy) * 0.45;
          }
          if (p.y > h - 70) {
            p.y = h - 70;
            p.vy = -Math.abs(p.vy) * 0.45;
          }

          p.vrot = -p.vx * 0.0016;
          [p.rot, p.vrot] = M.spring(p.rot, 0, p.vrot, 26, 7.5, dt);
        } else {
          p.vx *= 0.6;
          p.vy *= 0.6;
          p.rot += p.vrot * dt * 60;
        }

        const grabLift = p.grabbed ? 1.18 : 1;
        p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(${p.rot.toFixed(2)}deg) scale(${grabLift})`;
      }
    });
    void origin;
  }

  /* ------------------------------------------------ progress runner lean */

  function buildRunner() {
    const runner = doc.getElementById("progress-runner");
    if (!runner || reduced) return;
    let lx = 0;
    let ly = 0;
    let ls = 1;
    let lvx = 0;
    let lvy = 0;
    let lsv = 0;
    M.on((dt) => {
      const r = runner.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const pull = M.clamp(1 - Math.hypot(s.x - cx, s.y - cy) / 150, 0, 1);
      const tx = (s.x - cx) * 0.28 * pull;
      const ty = (s.y - cy) * 0.2 * pull;
      const tsc = 1 + pull * 0.55 + (s.down ? -0.12 * pull : 0);
      [lx, lvx] = M.spring(lx, tx, lvx, 160, 18, dt);
      [ly, lvy] = M.spring(ly, ty, lvy, 160, 18, dt);
      [ls, lsv] = M.spring(ls, tsc, lsv, 220, 20, dt);
      runner.style.setProperty("--lx", px(lx));
      runner.style.setProperty("--ly", px(ly));
      runner.style.setProperty("--ls", ls.toFixed(3));
    });
  }

  /* ------------------------------------------------------ result glyph tilt */

  function buildGlyph() {
    const wrap = doc.querySelector(".result-piece");
    const glyph = doc.getElementById("result-glyph");
    if (!wrap || reduced) return;
    let rx = 0;
    let ry = 0;
    let vx = 0;
    let vy = 0;
    M.on((dt) => {
      const r = wrap.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const near = M.clamp(1 - Math.hypot(s.x - cx, s.y - cy) / 320, 0, 1);
      [rx, vx] = M.spring(rx, ((s.y - cy) / r.height) * 9 * near, vx, 90, 14, dt);
      [ry, vy] = M.spring(ry, (-(s.x - cx) / r.width) * 12 * near, vy, 90, 14, dt);
      wrap.style.setProperty("--gx", deg(rx));
      wrap.style.setProperty("--gy", deg(ry));
      wrap.style.setProperty("--glow", (near * 0.85).toFixed(3));
      if (glyph) glyph.style.setProperty("--glow", (near * 0.85).toFixed(3));
    });
  }

  /* ------------------------------------------- cross-chart piece focusing */

  function buildPieceFocus() {
    const stats = doc.getElementById("screen-stats");
    if (!stats) return;
    let hot = null;

    const apply = (piece) => {
      if (hot === piece) return;
      hot = piece;
      stats.classList.toggle("is-piece-focus", Boolean(piece));
      const nodes = stats.querySelectorAll("[data-piece]");
      nodes.forEach((node) => {
        node.classList.toggle("is-hot", Boolean(piece) && node.dataset.piece === piece);
      });
    };

    stats.addEventListener("pointerover", (event) => {
      const row = event.target.closest("[data-piece-row]");
      if (row) apply(row.dataset.pieceRow);
    });
    stats.addEventListener("pointerout", (event) => {
      const row = event.target.closest("[data-piece-row]");
      if (row && !row.contains(event.relatedTarget)) apply(null);
    });
    stats.addEventListener("focusin", (event) => {
      const row = event.target.closest("[data-piece-row]");
      if (row) apply(row.dataset.pieceRow);
    });
    stats.addEventListener("focusout", () => apply(null));
  }

  /* ------------------------------------------------------------------ boot */

  buildCursor();
  buildSpotlight();
  buildShellTilt();
  buildFields();
  buildRipple();
  buildReveals();
  buildScramble();
  buildDragPieces();
  buildRunner();
  buildGlyph();
  buildPieceFocus();

  return { refresh: collectFields, reveals: collectReveals };
})();