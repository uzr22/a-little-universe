"use strict";
// ---------- Помощники ----------
const $ = s => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };   // плавный старт и финиш (easing)
const seg = (p, a, b) => clamp((p - a) / (b - a));                    // где мы внутри отрезка a..b: 0..1
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let target = 0, cur = 0;       // target — где реально скролл, cur — где «камера» (догоняет с инерцией)
let scenes = [], particles = [], stars = [];
let W = 0, H = 0, DPR = 1;
const cv = $("#sky"), ctx = cv.getContext("2d");

fetch("content.json")
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(init)
  .catch(() => { $("#err").hidden = false; });

function init(c) {
  $("#hint").textContent = c.hint;
  $("#skip").textContent = c.skip;
  $("#skip").onclick = () => scrollTo({ top: document.body.scrollHeight, behavior: reduced ? "auto" : "smooth" });

  c.scenes.forEach(s => scenes.push(buildScene(s, c.choice)));

  const jup = $("#jup");
  jup.onerror = () => jup.remove();         // нет фото — просто без Юпитера
  jup.src = c.images.jupiter;

  const img = new Image();
  img.onload = () => makeParticles(img);
  img.onerror = () => makeParticles(null);   // нет фото розы — запасное свечение
  img.src = c.images.rose;

  makeStars();
  resize();
  addEventListener("resize", resize);
  addEventListener("scroll", readScroll, { passive: true });
  readScroll(); cur = target;
  requestAnimationFrame(frame);
}

function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  target = max > 0 ? clamp(scrollY / max) : 0;
}

// ---------- Сцены ----------
function buildScene(s, choice) {
  const el = document.createElement("section");
  el.className = "scene pos-" + s.pos;
  const lines = s.lines.map(l => {
    const p = document.createElement("p");
    p.className = "l l-" + l.t;
    el.appendChild(p);
    return { el: p, text: l.text, typed: l.t === "say" || l.t === "draft", draft: l.t === "draft" };
  });
  if (s.id === "choice") addChoice(el, choice);
  $("#scenes").appendChild(el);
  return { ...s, el, lines };
}

function addChoice(el, ch) {
  const box = document.createElement("div");
  box.className = "cards";
  ch.options.forEach(o => {
    const a = document.createElement("a");
    a.className = "card"; a.href = o.href;
    a.innerHTML = "<b></b><span></span>";
    a.firstChild.textContent = o.title;
    a.lastChild.textContent = o.sub;
    box.appendChild(a);
  });
  const no = document.createElement("button");
  no.className = "decline"; no.type = "button"; no.textContent = ch.decline.text;
  no.onclick = () => {   // «нет» — такой же спокойный ответ, как и «да»
    box.remove(); no.remove();
    const r = document.createElement("p");
    r.className = "reply"; r.textContent = ch.decline.reply;
    el.appendChild(r);
  };
  el.append(box, no);
}

function updateScene(s, p) {
  const last = s.to >= 1;
  const op = smooth(seg(p, s.from, s.from + 0.05)) * (last ? 1 : 1 - smooth(seg(p, s.to - 0.05, s.to)));
  s.el.style.opacity = op;
  s.el.style.pointerEvents = op > 0.6 ? "auto" : "none";
  if (op <= 0) return;

  // Печать текста привязана к скроллу: листаешь вперёд — печатается, назад — стирается
  const typedLines = s.lines.filter(l => l.typed);
  const total = typedLines.reduce((n, l) => n + l.text.length, 0);
  let shown = Math.floor(seg(p, s.from + 0.04, s.to - 0.06) * total * 1.05);
  typedLines.forEach((l, i) => {
    const n = clamp(shown, 0, l.text.length);
    l.el.textContent = l.text.slice(0, n);
    shown -= l.text.length;
    l.el.classList.toggle("strike", l.draft && n === l.text.length && shown > 0 && i < typedLines.length - 1);
  });
  s.lines.forEach(l => { if (!l.typed) l.el.textContent = l.text; });
}

// ---------- Частицы розы: каждый пиксель реального фото становится точкой ----------
function makeParticles(img) {
  const cols = 64;
  let rows = 64;
  const off = document.createElement("canvas"), o = off.getContext("2d", { willReadFrequently: true });
  if (img) {
    rows = Math.round(cols * img.height / img.width);
    off.width = cols; off.height = rows;
    o.drawImage(img, 0, 0, cols, rows);
  } else {   // запасной вариант: мягкое красное свечение
    off.width = cols; off.height = rows;
    const g = o.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, "#9F2438"); g.addColorStop(1, "#080B09");
    o.fillStyle = g; o.fillRect(0, 0, cols, rows);
  }
  const d = o.getImageData(0, 0, cols, rows).data;
  particles = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = (y * cols + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    if (0.3 * r + 0.59 * g + 0.11 * b < 45) continue;   // тёмный фон не рисуем: остаётся только цветок
    const a = Math.random() * Math.PI * 2, dist = 0.25 + Math.random();
    particles.push({ u: x / cols - 0.5, v: (y / rows - 0.5) * rows / cols,
      col: `rgb(${r},${g},${b})`, dx: Math.cos(a) * dist, dy: Math.sin(a) * dist - 0.4, ph: Math.random() * 6.28 });
  }
}

function makeStars() {
  stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random(), ph: Math.random() * 6.28, s: Math.random() * 1.3 + 0.4 }));
}

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

// ---------- Главный цикл: камера ----------
function frame(t) {
  cur += (target - cur) * (reduced ? 1 : 0.1);   // инерция
  const p = cur, time = reduced ? 0 : t / 1000;
  ctx.clearRect(0, 0, W, H);

  // звёзды: проступают, когда роза рассыпается; дальние (z мал) движутся медленнее — это параллакс
  const starVis = 0.3 + 0.7 * smooth(seg(p, 0.4, 0.65));
  ctx.fillStyle = "#F1EADB";
  for (const s of stars) {
    const y = ((s.y - p * s.z * 0.5) % 1 + 1) % 1;
    ctx.globalAlpha = starVis * s.z * (0.55 + 0.45 * Math.sin(time * 1.3 + s.ph));
    ctx.fillRect(s.x * W, y * H, s.s, s.s);
  }

  // роза: собирается → держится → рассыпается
  const appear = smooth(seg(p, 0.08, 0.26)), dissolve = smooth(seg(p, 0.42, 0.7));
  const fade = 1 - smooth(seg(p, 0.6, 0.78));
  const S = Math.min(W * 0.86, H * 0.5), cx = W / 2, cy = H * 0.42, k = Math.max(W, H) * 0.7;
  if (appear * fade > 0.01) for (const q of particles) {
    const m = (1 - appear) * 0.35 + dissolve;
    const x = cx + q.u * S + q.dx * k * m + Math.sin(time + q.ph) * 0.8;
    const y = cy + q.v * S + q.dy * k * m + Math.cos(time + q.ph) * 0.8;
    ctx.globalAlpha = appear * fade;
    ctx.fillStyle = q.col;
    ctx.fillRect(x, y, S / 64 * 1.1, S / 64 * 1.1);
  }
  ctx.globalAlpha = 1;

  // Юпитер: поднимается снизу, приближается, а к финалу темнеет, чтобы был читаем текст
  const j = $("#jup");
  if (j) {
    const e = smooth(seg(p, 0.44, 0.8));
    j.style.transform = `translate(-50%, ${60 - e * 62}%) scale(${1 + e * 0.3})`;
    j.style.opacity = smooth(seg(p, 0.46, 0.62)) * (1 - 0.7 * smooth(seg(p, 0.8, 0.95)));
  }

  scenes.forEach(s => updateScene(s, p));
  $("#hint").style.opacity = 1 - smooth(seg(p, 0.01, 0.05));
  $("#skip").style.opacity = 1 - smooth(seg(p, 0.7, 0.8));
  $("#skip").style.pointerEvents = p > 0.78 ? "none" : "auto";
  requestAnimationFrame(frame);
}
