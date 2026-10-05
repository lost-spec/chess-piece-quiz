const perRound = Number(TEST.questionsPerRound) > 0 ? Number(TEST.questionsPerRound) : 3;

const pieceIds = PIECES.map((p) => p.id);
const pieceById = Object.fromEntries(PIECES.map((p) => [p.id, p]));

const els = {
  screens: {
    intro: document.getElementById("screen-intro"),
    quiz: document.getElementById("screen-quiz"),
    result: document.getElementById("screen-result"),
    stats: document.getElementById("screen-stats"),
    empty: document.getElementById("screen-empty")
  },
  titleText: document.getElementById("title-text"),
  introText: document.getElementById("intro-text"),
  introMeta: document.getElementById("intro-meta"),
  btnStart: document.getElementById("btn-start"),
  piecesPreview: document.getElementById("pieces-preview"),
  pieceDetail: document.getElementById("piece-detail"),
  pieceDetailInner: document.getElementById("piece-detail-inner"),
  progressFill: document.getElementById("progress-fill"),
  progressRunner: document.getElementById("progress-runner"),
  progressSteps: document.getElementById("progress-steps"),
  roundLabel: document.getElementById("round-label"),
  stepLabel: document.getElementById("step-label"),
  questionText: document.getElementById("question-text"),
  options: document.getElementById("options"),
  btnBack: document.getElementById("btn-back"),
  hint: document.getElementById("hint"),
  burst: document.getElementById("burst"),
  resultGlyph: document.getElementById("result-glyph"),
  resultName: document.getElementById("result-name"),
  resultTagline: document.getElementById("result-tagline"),
  resultDescription: document.getElementById("result-description"),
  scores: document.getElementById("scores"),
  recap: document.getElementById("recap"),
  btnRestart: document.getElementById("btn-restart"),
  btnShare: document.getElementById("btn-share"),
  btnStatsOpen: document.getElementById("btn-stats-open"),
  emptyText: document.getElementById("empty-text"),
  emptyReport: document.getElementById("empty-report")
};

const state = {
  step: 0,
  picks: new Array(QUESTIONS.length).fill(null),
  locked: false
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function pieceName(id) {
  const piece = pieceById[id];
  if (piece && piece.name) return piece.name;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function pointsOf(option) {
  const out = [];
  if (!option || !option.points) return out;
  for (const id of pieceIds) {
    const value = Number(option.points[id]);
    if (Number.isFinite(value) && value !== 0) out.push({ id, value });
  }
  return out;
}

function totalPoints() {
  return QUESTIONS.reduce((sum, q) => {
    for (const option of q.options) {
      for (const { value } of pointsOf(option)) sum += value;
    }
    return sum;
  }, 0);
}

function roundBounds(step) {
  const start = Math.floor(step / perRound) * perRound;
  const end = Math.min(QUESTIONS.length, start + perRound);
  return { start, end, count: end - start };
}

function roundsCount() {
  return Math.max(1, Math.ceil(QUESTIONS.length / perRound));
}

function showScreen(name) {
  for (const [key, el] of Object.entries(els.screens)) {
    const active = key === name;
    el.classList.toggle("is-active", active);
    el.hidden = !active;
  }
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
}

function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

function audit() {
  const issues = [];
  if (QUESTIONS.length < perRound) {
    issues.push(`QUESTIONS has ${QUESTIONS.length} item(s). Add at least ${perRound} so one round is playable.`);
  }
  QUESTIONS.forEach((q, i) => {
    const n = i + 1;
    if (!q.text || !q.text.trim()) issues.push(`Question ${n}: text is empty.`);
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length < 2) issues.push(`Question ${n}: needs at least 2 options.`);
    options.forEach((opt, oi) => {
      const label = `Question ${n} / option ${oi + 1}`;
      if (!opt.text || !opt.text.trim()) issues.push(`${label}: answer text is empty.`);
      const awarded = pointsOf(opt);
      if (awarded.length === 0) issues.push(`${label}: no points entered for any piece.`);
      if (totalPoints() > 0 && awarded.every((a) => a.value < 0)) {
        issues.push(`${label}: subtracts from every piece, which can never win.`);
      }
    });
  });
  PIECES.forEach((p) => {
    if (!p.name || !p.name.trim()) issues.push(`Piece "${p.id}": name is empty.`);
  });
  return issues;
}

function renderPreview() {
  els.piecesPreview.replaceChildren();
  for (const piece of PIECES) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "piece-card";
    card.dataset.id = piece.id;
    card.style.setProperty("--i", String(PIECES.indexOf(piece)));

    const glyph = document.createElement("span");
    glyph.className = "piece-glyph";
    glyph.textContent = piece.glyph;

    const name = document.createElement("span");
    name.className = "piece-name";
    name.textContent = pieceName(piece.id);

    const tag = document.createElement("span");
    tag.className = "piece-tag";
    tag.textContent = piece.tagline || "";

    card.append(glyph, name, tag);
    card.addEventListener("click", () => {
      const already = card.classList.contains("is-open");
      for (const other of els.piecesPreview.children) other.classList.remove("is-open");
      card.classList.toggle("is-open", !already);
      els.pieceDetailInner.textContent = !already ? piece.description || piece.tagline || "" : "";
      els.pieceDetail.classList.toggle("is-on", !already);
    });
    els.piecesPreview.appendChild(card);
  }
}

function renderIntro() {
  if (TEST.title) {
    document.title = TEST.title;
    els.titleText.textContent = TEST.title;
  }
  els.introText.textContent = TEST.intro || "Answer every question and the board will decide which piece you are.";
  const rounds = roundsCount();
  els.introMeta.textContent = `${QUESTIONS.length || perRound} questions · ${rounds} ${rounds === 1 ? "round" : "rounds"} · ${perRound} per round`;
  els.btnStart.textContent = TEST.startButtonLabel || "Start the test";
  renderPreview();
}

function renderSteps() {
  els.progressSteps.replaceChildren();
  QUESTIONS.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "step-dot";
    const round = Math.floor(i / perRound) + 1;
    dot.classList.toggle("is-round-start", i % perRound === 0);
    if (i < state.step) dot.classList.add("is-done");
    if (i === state.step) dot.classList.add("is-current");
    dot.dataset.round = String(round);
    els.progressSteps.appendChild(dot);
  });
}

function renderQuestion() {
  const q = QUESTIONS[state.step];
  const round = roundBounds(state.step);
  state.locked = false;

  els.roundLabel.textContent = `Round ${Math.floor(round.start / perRound) + 1} of ${roundsCount()}`;
  els.stepLabel.textContent = `Question ${state.step - round.start + 1} of ${round.count}`;
  els.questionText.textContent = q.text || `Question ${state.step + 1} (text not filled in)`;

  const done = state.step + 1;
  const ratio = done / QUESTIONS.length;
  els.progressFill.style.width = `${ratio * 100}%`;
  els.progressRunner.style.left = `${ratio * 100}%`;
  els.progressRunner.textContent = state.picks[state.step] !== null ? "♔" : "♟";
  els.hint.textContent = state.step === 0 ? "Pick the answer that feels most like you." : "Pick an answer to continue.";
  els.btnBack.disabled = state.step === 0;

  renderSteps();
  replay(els.questionText, "is-in");
  replay(els.options, "is-in");

  els.options.replaceChildren();
  q.options.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.dataset.index = String(index);
    btn.style.setProperty("--i", String(index));

    const key = document.createElement("kbd");
    key.className = "option-key";
    key.textContent = String(index + 1);

    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = option.text || `Answer ${index + 1}`;

    const tick = document.createElement("span");
    tick.className = "option-tick";
    tick.textContent = "✓";

    btn.append(key, label, tick);
    btn.addEventListener("click", () => choose(index));
    els.options.appendChild(btn);
  });

  if (state.picks[state.step] !== null) {
    const chosen = els.options.querySelector(`.option[data-index="${state.picks[state.step]}"]`);
    if (chosen) chosen.classList.add("is-chosen");
  }
}

function choose(index) {
  if (state.locked) return;
  const option = els.options.querySelector(`.option[data-index="${index}"]`);
  if (!option) return;
  state.locked = true;
  state.picks[state.step] = index;

  for (const el of els.options.querySelectorAll(".option")) el.classList.remove("is-chosen");
  option.classList.add("is-chosen");
  els.progressRunner.textContent = "♔";

  window.setTimeout(() => {
    if (state.step + 1 >= QUESTIONS.length) renderResult();
    else {
      state.step += 1;
      renderQuestion();
    }
  }, reducedMotion.matches ? 0 : 230);
}

function tally() {
  const scores = Object.fromEntries(pieceIds.map((id) => [id, 0]));
  state.picks.forEach((pick, qi) => {
    if (pick === null) return;
    for (const { id, value } of pointsOf(QUESTIONS[qi].options[pick])) scores[id] += value;
  });
  return scores;
}

function countUp(node, to) {
  if (reducedMotion.matches) {
    node.textContent = String(to);
    return;
  }
  const from = 0;
  const duration = 700;
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = String(Math.round(from + (to - from) * eased));
    if (p < 1) window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

function fireBurst() {
  els.burst.replaceChildren();
  if (reducedMotion.matches) return;
  const colors = ["#c8a24a", "#e8c877", "#f2e9df", "#8a6f3a"];
  for (let i = 0; i < 30; i++) {
    const spark = document.createElement("span");
    spark.className = "spark";
    const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.35;
    const dist = 80 + Math.random() * 200;
    spark.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
    spark.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
    spark.style.setProperty("--delay", `${(Math.random() * 0.22).toFixed(2)}s`);
    spark.style.background = colors[i % colors.length];
    els.burst.appendChild(spark);
  }
}

function renderResult() {
  const scores = tally();
  const ranked = PIECES.map((p) => ({ ...p, score: scores[p.id] })).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const tied = ranked.filter((p) => p.score === top.score);

  els.progressFill.style.width = "100%";
  els.resultGlyph.textContent = tied.map((p) => p.glyph).join(" ");
  els.resultName.textContent = tied.length > 1 ? tied.map((p) => pieceName(p.id)).join(" / ") : pieceName(top.id);
  els.resultTagline.textContent = tied.length > 1 ? "Two pieces claim you." : top.tagline || "";
  const blurb = [top.description].filter(Boolean);
  if (tied.length > 1) {
    blurb.push(`Tied on ${top.score} point(s) with ${tied.slice(1).map((p) => pieceName(p.id)).join(" and ")}.`);
  }
  els.resultDescription.textContent = blurb.join(" ");

  const max = Math.max(1, ...ranked.map((p) => Math.abs(p.score)));
  els.scores.replaceChildren();
  ranked.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "score-row";
    row.style.setProperty("--i", String(i));

    const name = document.createElement("span");
    name.className = "score-name";
    name.textContent = `${p.glyph} ${pieceName(p.id)}`;

    const bar = document.createElement("span");
    bar.className = "score-bar";
    const fill = document.createElement("span");
    fill.className = "score-fill";
    if (p.score < 0) fill.classList.add("is-negative");
    bar.appendChild(fill);

    const value = document.createElement("span");
    value.className = "score-value";
    value.textContent = "0";

    row.append(name, bar, value);
    els.scores.appendChild(row);

    const ratio = (Math.abs(p.score) / max) * 100;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      fill.style.width = `${ratio}%`;
    }));
    countUp(value, p.score);
  });

  els.recap.replaceChildren();
  state.picks.forEach((pick, qi) => {
    const q = QUESTIONS[qi];
    const li = document.createElement("li");
    li.style.setProperty("--i", String(qi));
    const label = document.createElement("span");
    label.className = "recap-q";
    label.textContent = q.text || `Question ${qi + 1}`;
    const answer = document.createElement("span");
    answer.className = "recap-a";
    answer.textContent = pick === null ? "— skipped —" : q.options[pick].text || `Answer ${pick + 1}`;
    const awarded = pick === null ? [] : pointsOf(q.options[pick]);
    const delta = awarded.map((a) => `${pieceById[a.id].glyph} ${a.value > 0 ? "+" : ""}${a.value}`).join("  ");
    const points = document.createElement("span");
    points.className = "recap-p";
    points.textContent = delta || "0";
    li.append(label, answer, points);
    els.recap.appendChild(li);
  });

  els.btnShare.textContent = "Copy my result";
  els.btnShare.disabled = false;
  showScreen("result");
  fireBurst();
  els.resultGlyph.classList.remove("is-in");
  replay(els.resultGlyph, "is-in");
}

async function share() {
  const name = els.resultName.textContent;
  const tagline = els.resultTagline.textContent;
  const text = `I took "Which Chess Piece Are You?" and got ${name}. ${tagline}`.trim();
  try {
    await navigator.clipboard.writeText(text);
    els.btnShare.textContent = "Copied ✓";
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    els.btnShare.textContent = ok ? "Copied ✓" : "Copy failed";
  }
  window.setTimeout(() => {
    els.btnShare.textContent = "Copy my result";
  }, 2200);
}

function goBack() {
  if (state.step === 0) return;
  state.step -= 1;
  renderQuestion();
}

function startTest() {
  state.step = 0;
  state.picks = new Array(QUESTIONS.length).fill(null);
  renderQuestion();
  showScreen("quiz");
}

function onKey(event) {
  if (els.screens.quiz.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    goBack();
    return;
  }
  if (/^[1-9]$/.test(event.key)) {
    const btn = els.options.children[Number(event.key) - 1];
    if (btn) {
      event.preventDefault();
      btn.focus();
      choose(Number(event.key) - 1);
    }
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const opts = [...els.options.children];
    if (!opts.length) return;
    event.preventDefault();
    const at = opts.indexOf(document.activeElement);
    const next = event.key === "ArrowDown" ? (at + 1) % opts.length : (at - 1 + opts.length) % opts.length;
    opts[next].focus();
  }
}

els.btnStart.addEventListener("click", startTest);
els.btnRestart.addEventListener("click", startTest);
els.btnBack.addEventListener("click", goBack);
els.btnShare.addEventListener("click", share);
els.btnStatsOpen.addEventListener("click", () => {
  if (typeof renderStats !== "function") return;
  renderStats(state.picks);
  showScreen("stats");
});
document.addEventListener("keydown", onKey);

renderIntro();
const issues = audit();
if (issues.length) renderEmpty(issues);
else showScreen("intro");

function renderEmpty(issues) {
  els.emptyText.textContent =
    `The logic is in place. Open content.js and fill in ${perRound} questions per round, the points each answer is worth, and which piece each answer belongs to.`;
  els.emptyReport.replaceChildren();
  const heading = document.createElement("p");
  heading.className = "report-title";
  heading.textContent = issues.length ? `Needs attention (${issues.length})` : "Content check passed";
  els.emptyReport.appendChild(heading);
  const list = document.createElement("ul");
  const items = issues.length ? issues : ["Every question has text, options, and points."];
  items.forEach((issue) => {
    const li = document.createElement("li");
    li.textContent = issue;
    list.appendChild(li);
  });
  els.emptyReport.appendChild(list);
  showScreen("empty");
}