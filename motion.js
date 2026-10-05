const Motion = (() => {
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  const Ease = {
    linear: (t) => t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) =>
      t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    outBack: (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
      if (t === 0 || t === 1) return t;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
  };

  const state = {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    nx: 0,
    ny: 0,
    down: false,
    inside: false,
    fine: window.matchMedia("(pointer: fine)").matches,
    idle: 0,
    time: 0,
    w: window.innerWidth,
    h: window.innerHeight,
    scroll: window.scrollY || 0,
    velocity: 0
  };

  const tickers = new Set();
  let rafId = 0;
  let last = 0;

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    state.time = now;

    state.vx = state.vx * 0.82 + (state.x - state.px) * 0.18;
    state.vy = state.vy * 0.82 + (state.y - state.py) * 0.18;
    state.px = state.x;
    state.py = state.y;
    state.speed = Math.hypot(state.vx, state.vy);
    state.nx = (state.x / Math.max(1, state.w)) * 2 - 1;
    state.ny = (state.y / Math.max(1, state.h)) * 2 - 1;
    state.idle = Math.min(4000, state.idle + dt * 1000);

    for (const fn of tickers) {
      try {
        fn(dt, now);
      } catch (err) {
        tickers.delete(fn);
      }
    }

    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (rafId) return;
    last = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function on(fn) {
    tickers.add(fn);
    return () => tickers.delete(fn);
  }

  function tween(options) {
    const o = Object.assign(
      { from: 0, to: 1, duration: 600, delay: 0, ease: Ease.outCubic, onUpdate() {}, onComplete() {} },
      options
    );
    let elapsed = 0;
    let alive = true;

    const tick = (dt) => {
      elapsed += dt * 1000;
      if (elapsed < o.delay) return;
      const p = clamp((elapsed - o.delay) / Math.max(1, o.duration), 0, 1);
      const eased = o.ease(p);
      o.onUpdate(o.from + (o.to - o.from) * eased, eased, p);
      if (p >= 1) {
        alive = false;
        tickers.delete(tick);
        o.onComplete();
      }
    };

    if (reduceQuery.matches) {
      o.onUpdate(o.to, 1, 1);
      o.onComplete();
      return { cancel() {}, finish() {} };
    }

    tickers.add(tick);
    return {
      cancel() {
        if (!alive) return;
        alive = false;
        tickers.delete(tick);
      },
      finish() {
        if (!alive) return;
        alive = false;
        tickers.delete(tick);
        o.onUpdate(o.to, 1, 1);
        o.onComplete();
      }
    };
  }

  function spring(value, target, velocity, stiffness, damping, dt) {
    const force = (target - value) * stiffness - velocity * damping;
    const nextVelocity = velocity + force * dt;
    return [value + nextVelocity * dt, nextVelocity];
  }

  function scramble(node, finalText, duration) {
    const glyphs = "♟♞♝♜♛♚<>/\\|=+*#@%&";
    if (reduceQuery.matches) {
      node.textContent = finalText;
      return { cancel() {} };
    }
    let raf = 0;
    const start = performance.now();
    const total = duration || 900;
    const chars = [...finalText];
    node.textContent = finalText;
    const step = (now) => {
      const p = clamp((now - start) / total, 0, 1);
      const settled = Math.floor(p * chars.length * 1.35);
      let out = "";
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === " ") {
          out += " ";
          continue;
        }
        if (i < settled) out += ch;
        else if (p >= 1) out += ch;
        else out += glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      node.textContent = out;
      if (p < 1) raf = window.requestAnimationFrame(step);
      else node.textContent = finalText;
    };
    raf = window.requestAnimationFrame(step);
    return {
      cancel() {
        window.cancelAnimationFrame(raf);
        node.textContent = finalText;
      }
    };
  }

  function onPointerMove(event) {
    state.x = event.clientX;
    state.y = event.clientY;
    state.inside = true;
    state.idle = 0;
  }

  function onPointerDown() {
    state.down = true;
    state.idle = 0;
  }

  function onPointerUp() {
    state.down = false;
  }

  function onPointerLeave() {
    state.inside = false;
  }

  function onResize() {
    state.w = window.innerWidth;
    state.h = window.innerHeight;
  }

  function onScroll() {
    const y = window.scrollY || 0;
    state.velocity = y - state.scroll;
    state.scroll = y;
  }

  if (state.fine) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
  }
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    } else start();
  });

  state.x = state.px = window.innerWidth / 2;
  state.y = state.py = window.innerHeight / 2;
  onScroll();
  start();

  return {
    state,
    on,
    tween,
    spring,
    scramble,
    Ease,
    clamp,
    lerp,
    rand,
    dist,
    get reduced() {
      return reduceQuery.matches;
    }
  };
})();