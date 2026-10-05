const PIECE_IDS = PIECES.map((p) => p.id);
const PIECE_BY_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));
const SVG_NS = "http://www.w3.org/2000/svg";

const elStats = {
  screen: document.getElementById("screen-stats"),
  title: document.getElementById("stats-title"),
  kpis: document.getElementById("kpis"),
  radar: document.getElementById("radar"),
  line: document.getElementById("line-chart"),
  lineNote: document.getElementById("line-note"),
  flips: document.getElementById("flips"),
  cfGrid: document.getElementById("cf-grid"),
  histo: document.getElementById("histo"),
  histoNote: document.getElementById("histo-note"),
  btnResult: document.getElementById("btn-stats-result"),
  btnRetry: document.getElementById("btn-stats-retry"),
  btnBack: document.getElementById("btn-stats-back")
};

const statsReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

function svg(tag, attrs, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function div(cls, text) {
  const node = document.createElement("div");
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clip(text, max) {
  const value = (text || "").trim();
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function pointsList(option) {
  const out = [];
  if (!option || !option.points) return out;
  for (const id of PIECE_IDS) {
    const value = Number(option.points[id]);
    if (Number.isFinite(value) && value !== 0) out.push([id, value]);
  }
  return out;
}

function awardsOf(pick, qi) {
  const option = QUESTIONS[qi] && QUESTIONS[qi].options[pick];
  return option ? pointsList(option) : [];
}

function scoreOf(picks) {
  const scores = Object.fromEntries(PIECE_IDS.map((id) => [id, 0]));
  picks.forEach((pick, qi) => {
    if (pick === null || pick === undefined) return;
    for (const [id, value] of awardsOf(pick, qi)) scores[id] += value;
  });
  return scores;
}

function rankOf(scores) {
  const sorted = PIECES.map((p) => ({ id: p.id, score: scores[p.id] })).sort((a, b) => b.score - a.score);
  const topScore = sorted[0].score;
  const tied = sorted.filter((p) => p.score === topScore).map((p) => p.id);
  const second = sorted.find((p) => p.score < topScore);
  return {
    sorted,
    top: sorted[0].id,
    topScore,
    tied,
    second: second ? second.id : null,
    secondScore: second ? second.score : null,
    margin: second ? topScore - second.score : topScore
  };
}

function label(id) {
  const piece = PIECE_BY_ID[id];
  return (piece && piece.name) || id.charAt(0).toUpperCase() + id.slice(1);
}

function glyph(id) {
  const piece = PIECE_BY_ID[id];
  return (piece && piece.glyph) || "";
}

let pathCache = null;

function allPaths() {
  if (pathCache) return pathCache;
  const out = [];
  const walk = (i, acc) => {
    if (i === QUESTIONS.length) {
      out.push(acc.slice());
      return;
    }
    for (let k = 0; k < QUESTIONS[i].options.length; k++) {
      acc.push(k);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  pathCache = out;
  return out;
}

function distribution() {
  const counts = Object.fromEntries(PIECE_IDS.map((id) => [id, 0]));
  let ties = 0;
  const paths = allPaths();
  for (const picks of paths) {
    const result = rankOf(scoreOf(picks));
    counts[result.top] += 1;
    if (result.tied.length > 1) ties += 1;
  }
  return { counts, ties, total: paths.length };
}

function flipScenarios(picks, base) {
  const out = [];
  picks.forEach((pick, qi) => {
    if (pick === null || pick === undefined) return;
    const question = QUESTIONS[qi];
    if (!question) return;
    question.options.forEach((option, oi) => {
      if (oi === pick) return;
      const alt = picks.slice();
      alt[qi] = oi;
      const scores = scoreOf(alt);
      const result = rankOf(scores);
      const stillYou = result.tied.includes(base.top);
      out.push({
        qi,
        optionIndex: oi,
        optionText: option.text || `Answer ${oi + 1}`,
        newTop: result.top,
        newTied: result.tied.length > 1,
        stillYou,
        myScore: scores[base.top],
        delta: scores[base.top] - base.topScore
      });
    });
  });
  return out;
}

function completionsFrom(from) {
  const out = [];
  const walk = (qi, acc) => {
    if (qi >= QUESTIONS.length) {
      out.push(acc.slice());
      return;
    }
    for (let k = 0; k < QUESTIONS[qi].options.length; k++) {
      acc.push(k);
      walk(qi + 1, acc);
      acc.pop();
    }
  };
  walk(from, []);
  return out;
}

function leadFrom(picks, winnerId) {
  const n = QUESTIONS.length;
  const running = Object.fromEntries(PIECE_IDS.map((id) => [id, 0]));
  const leaders = [];
  for (let i = 0; i < n; i++) {
    if (picks[i] !== null && picks[i] !== undefined) {
      for (const [id, value] of awardsOf(picks[i], i)) running[id] += value;
    }
    let best = -Infinity;
    for (const id of PIECE_IDS) if (running[id] > best) best = running[id];
    leaders.push(PIECE_IDS.filter((id) => running[id] === best));
  }
  let lastLost = -1;
  for (let i = 0; i < n; i++) {
    if (!(leaders[i].length === 1 && leaders[i][0] === winnerId)) lastLost = i;
  }
  if (lastLost === -1) return { from: 1, everBehind: false, everLed: true };
  const from = lastLost + 2;
  if (from > n) return { from: null, everBehind: true, everLed: false };
  return { from, everBehind: true, everLed: true };
}

function lockPoint(picks) {
  const n = QUESTIONS.length;
  const prefix = [{ ...Object.fromEntries(PIECE_IDS.map((id) => [id, 0])) }];
  const running = { ...prefix[0] };
  for (let i = 0; i < n; i++) {
    if (picks[i] !== null && picks[i] !== undefined) {
      for (const [id, value] of awardsOf(picks[i], i)) running[id] += value;
    }
    prefix.push({ ...running });
  }

  for (let k = 1; k <= n; k++) {
    const base = prefix[k];
    let best = -Infinity;
    for (const id of PIECE_IDS) if (base[id] > best) best = base[id];
    const leaders = PIECE_IDS.filter((id) => base[id] === best);
    if (leaders.length !== 1) continue;

    let safe = true;
    for (const tail of completionsFrom(k)) {
      const scores = { ...base };
      tail.forEach((pick, offset) => {
        for (const [id, value] of awardsOf(pick, k + offset)) scores[id] += value;
      });
      let top = -Infinity;
      for (const id of PIECE_IDS) if (scores[id] > top) top = scores[id];
      const winners = PIECE_IDS.filter((id) => scores[id] === top);
      if (winners.length !== 1 || winners[0] !== leaders[0]) {
        safe = false;
        break;
      }
    }

    if (safe) return { decidedAt: k, guaranteed: true, leader: leaders[0] };
  }

  return { decidedAt: null, guaranteed: false, leader: null };
}

function cumulativeSeries(picks, ids) {
  const running = Object.fromEntries(PIECE_IDS.map((id) => [id, 0]));
  const series = Object.fromEntries(ids.map((id) => [id, []]));
  for (let qi = 0; qi < QUESTIONS.length; qi++) {
    const pick = picks[qi];
    if (pick !== null && pick !== undefined) {
      for (const [id, value] of awardsOf(pick, qi)) running[id] += value;
    }
    for (const id of ids) series[id].push(running[id]);
  }
  return series;
}

function kpi(labelText, valueText, subText, tone) {
  const tile = div(`kpi${tone ? ` is-${tone}` : ""}`);
  tile.style.setProperty("--i", String(elStats.kpis.children.length));
  tile.append(div("kpi-label", labelText), div("kpi-value", valueText), div("kpi-sub", subText || ""));
  elStats.kpis.appendChild(tile);
  return tile;
}

function countUpTile(node, to, suffix) {
  if (!node) return;
  const whole = Number.isInteger(to);
  const format = (value) => `${whole ? Math.round(value) : value.toFixed(1)}${suffix || ""}`;
  if (statsReduced.matches || typeof Motion === "undefined") {
    node.textContent = format(to);
    return;
  }
  node.textContent = format(0);
  Motion.tween({
    from: 0,
    to,
    duration: 900,
    ease: Motion.Ease.outExpo,
    onUpdate: (value) => {
      node.textContent = format(value);
    }
  });
}

function buildRadar(scores, base) {
  elStats.radar.replaceChildren();
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 52;
  const n = PIECES.length;
  const max = Math.max(1, ...PIECE_IDS.map((id) => Math.abs(scores[id])));
  const angleAt = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointAt = (i, ratio) => [cx + Math.cos(angleAt(i)) * R * ratio, cy + Math.sin(angleAt(i)) * R * ratio];

  const root = svg("svg", { viewBox: `0 0 ${size} ${size}`, class: "radar", role: "img" });
  root.appendChild(svg("title", {}, `Radar of your scores across all ${n} pieces`));

  for (let ring = 1; ring <= 4; ring++) {
    const ratio = ring / 4;
    const pts = PIECES.map((_, i) => pointAt(i, ratio).map((v) => v.toFixed(1)).join(",")).join(" ");
    root.appendChild(svg("polygon", { points: pts, class: "radar-ring" }));
  }

  PIECES.forEach((_, i) => {
    const [x, y] = pointAt(i, 1);
    root.appendChild(svg("line", { x1: cx, y1: cy, x2: x, y2: y, class: "radar-axis" }));
  });

  const shapePts = PIECES.map((p, i) => pointAt(i, Math.max(0.02, Math.abs(scores[p.id]) / max)).map((v) => v.toFixed(1)).join(",")).join(" ");
  root.appendChild(svg("polygon", { points: shapePts, class: "radar-shape" }));

  PIECES.forEach((piece, i) => {
    const ratio = Math.max(0.02, Math.abs(scores[piece.id]) / max);
    const [x, y] = pointAt(i, ratio);
    const [lx, ly] = pointAt(i, 1.17);
    const isTop = base.tied.includes(piece.id);

    const dot = svg("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: isTop ? 5.5 : 4.5, class: `radar-dot${isTop ? " is-top" : ""}`, "data-piece": piece.id });
    dot.style.setProperty("--i", String(i));
    root.appendChild(dot);

    const text = svg("text", {
      x: lx.toFixed(1),
      y: (ly + 4).toFixed(1),
      class: `radar-label${isTop ? " is-top" : ""}`,
      "data-piece": piece.id,
      "text-anchor": lx < cx - 6 ? "end" : lx > cx + 6 ? "start" : "middle"
    }, `${piece.glyph} ${label(piece.id)} ${scores[piece.id]}`);
    root.appendChild(text);
  });

  elStats.radar.appendChild(root);
}

function buildLine(picks, base, decidedAt, leadAt) {
  elStats.line.replaceChildren();
  const rivals = base.second && base.second !== base.top ? base.second : base.sorted[1].id;
  const ids = [base.top, rivals];
  const series = cumulativeSeries(picks, ids);
  const n = QUESTIONS.length;

  const W = 700;
  const H = 280;
  const pad = { t: 26, r: 26, b: 46, l: 44 };
  const all = ids.flatMap((id) => series[id]);
  const min = Math.min(0, ...all);
  const max = Math.max(1, ...all);
  const span = max - min || 1;

  const xAt = (i) => (n === 1 ? pad.l + (W - pad.l - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (n - 1));
  const yAt = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - min) / span);

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "line-chart", role: "img" });
  root.appendChild(svg("title", {}, `Cumulative score after each question for ${label(base.top)} against ${label(rivals)}`));

  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const value = min + (span * t) / ticks;
    const y = yAt(value);
    root.appendChild(svg("line", { x1: pad.l, y1: y.toFixed(1), x2: W - pad.r, y2: y.toFixed(1), class: "line-grid" }));
    root.appendChild(svg("text", { x: pad.l - 10, y: (y + 4).toFixed(1), class: "line-axis", "text-anchor": "end" }, String(Math.round(value))));
  }

  for (let i = 0; i < n; i++) {
    root.appendChild(svg("text", { x: xAt(i).toFixed(1), y: H - 16, class: "line-axis", "text-anchor": "middle" }, `Q${i + 1}`));
  }

  if (leadAt && leadAt.from && leadAt.everBehind) {
    const x = xAt(leadAt.from - 1);
    root.appendChild(svg("line", { x1: x.toFixed(1), y1: pad.t - 8, x2: x.toFixed(1), y2: H - pad.b, class: "line-lead" }));
    root.appendChild(svg("text", { x: (x + 8).toFixed(1), y: pad.t + 4, class: "line-lead-label" }, "took the lead"));
  }

  if (decidedAt) {
    const x = xAt(decidedAt - 1);
    root.appendChild(svg("line", { x1: x.toFixed(1), y1: pad.t - 8, x2: x.toFixed(1), y2: H - pad.b, class: "line-lock" }));
    root.appendChild(svg("text", { x: (x + 8).toFixed(1), y: pad.t + 4, class: "line-lock-label" }, "unbeatable"));
  }

  const linePath = ids.map((id, seriesIndex) => {
    const d = series[id].map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(" ");
    const path = svg("path", { d, class: `line-path${seriesIndex === 0 ? " is-primary" : ""}` });
    path.style.setProperty("--delay", `${seriesIndex * 0.35}s`);
    return path;
  });
  const areaD = `${linePath[0].getAttribute("d")} L${xAt(n - 1).toFixed(1)} ${yAt(min).toFixed(1)} L${xAt(0).toFixed(1)} ${yAt(min).toFixed(1)} Z`;
  root.appendChild(svg("path", { d: areaD, class: "line-area" }));
  for (const path of linePath) root.appendChild(path);

  ids.forEach((id, seriesIndex) => {
    series[id].forEach((v, i) => {
      const dot = svg("circle", {
        cx: xAt(i).toFixed(1),
        cy: yAt(v).toFixed(1),
        r: seriesIndex === 0 ? 4.5 : 3.5,
        class: `line-dot${seriesIndex === 0 ? " is-primary" : ""}`,
        "data-piece": id
      });
      dot.style.setProperty("--i", String(i));
      const tip = svg("title", {}, `${label(id)} after Q${i + 1}: ${v}`);
      dot.appendChild(tip);
      root.appendChild(dot);
    });
  });

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  for (const id of ids) {
    const item = div("legend-item");
    item.dataset.piece = id;
    item.append(div("legend-swatch"), div("legend-text", `${glyph(id)} ${label(id)}`));
    legend.appendChild(item);
  }
  elStats.line.appendChild(root);
  elStats.line.appendChild(legend);
}

function buildFlips(flips, base, lockedAt) {
  elStats.flips.replaceChildren();
  const changing = flips.filter((f) => !f.stillYou);
  const byPiece = new Map();
  for (const flip of changing) {
    byPiece.set(flip.newTop, (byPiece.get(flip.newTop) || 0) + 1);
  }

  if (!changing.length) {
    const card = div("flip-card is-empty");
    card.append(
      div("flip-head", "Untouchable result"),
      div("flip-body", `No single answer change turns you into a different piece. ${label(base.top)} wins from every direction — the closest rival, ${label(base.second || base.sorted[1].id)}, is always behind.`)
    );
    elStats.flips.appendChild(card);
    return;
  }

  const summary = div("flip-card is-summary");
  summary.append(
    div("flip-head", `${changing.length} of ${flips.length} alternate answers change your piece`),
    div("flip-body", `Averaging the board, the single most expensive question is Q${lockedAt + 1}. The pieces one answer away: ${[...byPiece.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => `${glyph(id)} ${label(id)} ×${count}`).join("  ·  ")}`)
  );
  summary.style.setProperty("--i", "0");
  elStats.flips.appendChild(summary);

  changing.forEach((flip, i) => {
    const card = div("flip-card");
    card.style.setProperty("--i", String(i + 1));
    card.append(
      div("flip-q", `Q${flip.qi + 1} · ${clip(QUESTIONS[flip.qi].text, 70)}`),
      div("flip-if", `If you had picked “${clip(flip.optionText, 80)}”`),
      div("flip-then", `${glyph(flip.newTop)} ${label(flip.newTop)}${flip.newTied ? " (tie)" : ""} with ${flip.myScore}`),
      div("flip-delta", `you ${base.topScore} → ${flip.myScore} (${flip.delta > 0 ? "+" : ""}${flip.delta})`)
    );
    card.addEventListener("mouseenter", () => card.classList.add("is-hot"));
    card.addEventListener("mouseleave", () => card.classList.remove("is-hot"));
    elStats.flips.appendChild(card);
  });
}

function buildCounterfactuals(picks, base) {
  elStats.cfGrid.replaceChildren();
  picks.forEach((pick, qi) => {
    if (pick === null || pick === undefined) return;
    const question = QUESTIONS[qi];
    const card = div("cf-card");
    card.style.setProperty("--i", String(qi));

    const head = div("cf-head");
    head.append(div("cf-num", `Q${qi + 1}`), div("cf-text", clip(question.text, 90)));
    card.appendChild(head);

    question.options.forEach((option, oi) => {
      const chosen = oi === pick;
      const alt = picks.slice();
      alt[qi] = oi;
      const result = rankOf(scoreOf(alt));
      const stillYou = result.tied.includes(base.top);

      const row = div(`cf-row${chosen ? " is-chosen" : ""}${!chosen && !stillYou ? " is-flip" : ""}`);
      row.dataset.pieceRow = result.top;
      row.tabIndex = 0;
      row.append(div("cf-pick", chosen ? "Your answer" : `Answer ${oi + 1}`));
      row.append(div("cf-copy", clip(option.text, 110)));
      const myScore = result.sorted.find((row2) => row2.id === base.top).score;
      const outcome = div("cf-outcome");
      outcome.append(div("cf-piece", `${glyph(result.top)} ${label(result.top)}`));
      outcome.append(div("cf-score", stillYou ? `${result.topScore} · you hold on` : `${result.topScore} · you drop to ${myScore}`));
      row.appendChild(outcome);
      card.appendChild(row);
    });

    elStats.cfGrid.appendChild(card);
  });
}

function buildHistogram(dist, base) {
  elStats.histo.replaceChildren();
  const max = Math.max(...PIECE_IDS.map((id) => dist.counts[id]), 1);
  const ranked = PIECE_IDS.map((id) => ({ id, count: dist.counts[id] })).sort((a, b) => b.count - a.count);
  const rank = ranked.findIndex((row) => row.id === base.top) + 1;
  const share = (dist.counts[base.top] / dist.total) * 100;
  const position = rank === 1 ? "the most common result" : `the #${rank} most common result`;
  const ahead = ranked.slice(0, rank - 1);
  const beatenBy = ahead.length
    ? `, behind ${ahead.map((row) => `${label(row.id)} (${((row.count / dist.total) * 100).toFixed(1)}%)`).join(" and ")}`
    : "";

  ranked.forEach((row, i) => {
    const wrap = div(`histo-row${base.tied.includes(row.id) ? " is-you" : ""}`);
    wrap.dataset.piece = row.id;
    wrap.style.setProperty("--i", String(i));

    const name = div("histo-name", `${glyph(row.id)} ${label(row.id)}`);
    if (base.tied.includes(row.id)) name.appendChild(div("histo-badge", "you"));

    const track = div("histo-track");
    const fill = div("histo-fill");
    track.appendChild(fill);

    const value = div("histo-value", "");
    countUpTile(value, row.count, ` · ${((row.count / dist.total) * 100).toFixed(1)}%`);

    wrap.append(name, track, value);
    elStats.histo.appendChild(wrap);

    const target = `${(row.count / max) * 100}%`;
    if (statsReduced.matches || typeof Motion === "undefined") {
      fill.style.width = target;
    } else {
      Motion.tween({
        from: 0,
        to: (row.count / max) * 100,
        duration: 950,
        delay: i * 90,
        ease: Motion.Ease.outExpo,
        onUpdate: (v) => {
          fill.style.width = `${v.toFixed(2)}%`;
        }
      });
    }
  });

  elStats.histoNote.textContent = `All ${dist.total} possible answer paths were scored. ${label(base.top)} is ${position} — ${share.toFixed(1)}% of paths land there${beatenBy}${dist.ties ? `, and ${dist.ties} paths end in a tie` : ""}.`;
}

function renderStats(picks) {
  const scores = scoreOf(picks);
  const base = rankOf(scores);
  const dist = distribution();
  const flips = flipScenarios(picks, base);
  const lock = lockPoint(picks);
  const lead = leadFrom(picks, base.top);
  const flipped = flips.filter((f) => !f.stillYou);

  elStats.title.textContent = `${label(base.top)}, examined`;

  elStats.kpis.replaceChildren();
  const marginTile = kpi("Margin over runner-up", "", base.second ? `${base.topScore} vs ${base.secondScore} · ${label(base.second)}` : "no runner-up", base.margin <= 1 ? "is-thin" : "");
  countUpTile(marginTile.querySelector(".kpi-value"), base.margin, " pts");
  kpi(
    "Unbeatable from",
    lock.decidedAt === null ? "—" : String(lock.decidedAt),
    lock.decidedAt === null
      ? "no combination of later answers can overturn it"
      : lock.decidedAt >= QUESTIONS.length
        ? "only the very last answer could still swing it"
        : `question ${lock.decidedAt} · no combination after it wins`,
    ""
  );
  kpi(
    "Held the lead from",
    lead.from === null ? "—" : String(lead.from),
    lead.from === null
      ? "never led alone — your result is a tie"
      : lead.everBehind
        ? `question ${lead.from} · never gave it back`
        : "led from the first answer",
    lead.from === null ? "is-warn" : ""
  );
  const shareTile = kpi("Share of all answer paths", "", `of ${dist.total} possible paths`, "");
  countUpTile(shareTile.querySelector(".kpi-value"), (dist.counts[base.top] / dist.total) * 100, "%");
  const flipTile = kpi("Answers that flip it", "", `single swaps, of ${flips.length} options`, "is-warn");
  countUpTile(flipTile.querySelector(".kpi-value"), flipped.length, "");

  buildRadar(scores, base);
  buildLine(picks, base, lock.decidedAt, lead);
  const leadText = lead.from === null
    ? `${label(base.top)} never led alone — your result is a tie`
    : lead.everBehind
      ? `${label(base.top)} took the lead at question ${lead.from} and never gave it back`
      : `${label(base.top)} led from the first answer`;
  elStats.lineNote.textContent = lock.decidedAt === null
    ? `Cumulative score after each answer. ${leadText}, but no combination of the remaining answers was ruled out — the board was still open at the end.`
    : `Cumulative score after each answer. ${leadText}, and from question ${lock.decidedAt} no combination of the remaining answers could beat it.`;
  buildFlips(flips, base, flipped.length ? Math.max(...flipped.map((f) => f.qi)) : null);
  buildCounterfactuals(picks, base);
  buildHistogram(dist, base);

  elStats.screen.classList.remove("is-active");
  void elStats.screen.offsetWidth;
  elStats.screen.classList.add("is-active");
}

elStats.btnBack.addEventListener("click", () => showScreen("result"));
elStats.btnResult.addEventListener("click", () => showScreen("result"));
elStats.btnRetry.addEventListener("click", () => startTest());