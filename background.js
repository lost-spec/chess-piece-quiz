const canvas = document.getElementById("board-bg");
const ctx = canvas.getContext("2d");

const GLYPHS = ["♙", "♘", "♗", "♖", "♕", "♔"];
const SQUARE = 72;

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

let viewW = 0;
let viewH = 0;
let dpr = 1;
let pieces = [];
let raf = 0;
let last = 0;

function build() {
  const target = Math.round(Math.min(16, Math.max(7, (viewW * viewH) / 90000)));
  while (pieces.length > target) pieces.pop();
  while (pieces.length < target) {
    pieces.push({
      glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      x: Math.random() * viewW,
      y: Math.random() * viewH,
      size: 20 + Math.random() * 34,
      speed: 5 + Math.random() * 16,
      spin: (Math.random() - 0.5) * 0.16,
      angle: Math.random() * Math.PI * 2,
      alpha: 0.02 + Math.random() * 0.05,
      drift: (Math.random() - 0.5) * 10
    });
  }
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  canvas.style.width = viewW + "px";
  canvas.style.height = viewH + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  build();
  draw(pieces.map((p) => ({ ...p })), 0);
}

function draw(list, dt) {
  ctx.clearRect(0, 0, viewW, viewH);

  ctx.fillStyle = "rgba(255, 236, 200, 0.014)";
  for (let y = 0; y < viewH + SQUARE; y += SQUARE) {
    for (let x = 0; x < viewW + SQUARE; x += SQUARE) {
      if (((x / SQUARE) | 0) % 2 === ((y / SQUARE) | 0) % 2) continue;
      ctx.fillRect(x, y, SQUARE, SQUARE);
    }
  }

  for (const p of list) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.font = `${p.size}px "Segoe UI Symbol", "Noto Sans Symbols 2", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(226, 199, 140, ${p.alpha})`;
    ctx.fillText(p.glyph, 0, 0);
    ctx.restore();
  }
}

function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  for (const p of pieces) {
    p.y -= p.speed * dt;
    p.angle += p.spin * dt;
    p.x += p.drift * dt;
    if (p.y < -p.size) {
      p.y = viewH + p.size;
      p.x = Math.random() * viewW;
    }
    if (p.x < -p.size) p.x = viewW + p.size;
    if (p.x > viewW + p.size) p.x = -p.size;
  }
  draw(pieces, dt);
  raf = window.requestAnimationFrame(step);
}

function play() {
  if (raf || reduced.matches) return;
  last = performance.now();
  raf = window.requestAnimationFrame(step);
}

function pause() {
  if (!raf) return;
  window.cancelAnimationFrame(raf);
  raf = 0;
}

window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
reduced.addEventListener("change", () => (reduced.matches ? pause() : play()));

resize();
play();