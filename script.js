"use strict";
const $ = s => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const seg = (p, a, b) => clamp((p - a) / (b - a));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const CARD0 = 0.68, CARD1 = 0.97;   // на каком отрезке прокрутки идут карточки
const PLANE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 12 22 3l-5 18-5-7-10-2zm10 2 5-9-9 7z"/></svg>';

let target = 0, cur = 0, W = 0, H = 0, DPR = 1, RW = 0, RH = 0, hasRose = false, t0 = null, last = 0;
let scenes = [], cards = [], particles = [], stars = [], ring = [], bokeh = [], flies = [], meteors = [];
const stage = $("#stage"), cv = $("#fx"), ctx = cv.getContext("2d"), rose = $("#rose"), planet = $("#planet");

fetch("content.json")
  .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(init)
  .catch(e => {
    console.error(e);
    if (location.protocol === "file:") $("#err").textContent = "Открой сайт через сервер: python -m http.server, затем localhost:8000.";
    $("#err").hidden = false;
  });

function init(c) {
  $("#hint").textContent = c.hint;
  c.scenes.forEach((s, i) => scenes.push(buildScene(s, i === 0)));
  c.cards.forEach(d => buildCard(d, c));
  planet.style.backgroundImage = `url("${c.images.planet}")`;

  rose.onerror = () => { rose.remove(); hasRose = false; layoutRose(); makeParticles(null); };
  rose.onload = () => { hasRose = true; layoutRose(); makeParticles(rose); };
  rose.src = c.images.rose;

  const R = Math.random;
  stars = Array.from({ length: 280 }, () => ({ x: R(), y: R(), z: 0.2 + R(), ph: R() * 6.28, s: R() * 1.4 + 0.5, th: 0.42 + R() * 0.34, big: R() > 0.86 }));
  ring = Array.from({ length: 800 }, () => ({ a: R() * 6.283, j: R() - 0.5, ph: R() * 6.28, s: R() * 1.8 + 0.5, g: R() > 0.7 }));
  bokeh = Array.from({ length: 14 }, () => ({ x: R(), y: R(), z: 0.5 + R() * 1.2, r: 18 + R() * 50, g: R() > 0.5 }));
  flies = Array.from({ length: 46 }, () => ({ x: R(), y: R(), z: 0.3 + R(), ph: R() * 6.28, s: R() * 1.8 + 0.8 }));

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

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (w === W && h === H) return;      // адресная строка телефона не должна пересобирать сцену
  W = w; H = h;
  DPR = Math.min(devicePixelRatio || 1, 2);
  cv.width = W * DPR; cv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  layoutRose();
  // «магниты» прокрутки: страница мягко останавливается на каждой карточке
  document.querySelectorAll(".snap").forEach(n => n.remove());
  const max = $("#track").offsetHeight - innerHeight, n = cards.length;
  [0, ...cards.map((_, i) => CARD0 + i / (n - 1) * (CARD1 - CARD0))].forEach(v => {
    const d = document.createElement("div"); d.className = "snap"; d.style.top = v * max + "px";
    $("#track").appendChild(d);
  });
}

function layoutRose() {
  const ar = hasRose ? rose.naturalHeight / rose.naturalWidth : 1;
  RW = hasRose ? Math.min(W * 0.86, H * 0.54 / ar) : Math.min(W * 0.6, H * 0.35);
  RH = RW * ar;
  if (hasRose) { rose.style.width = RW + "px"; rose.style.height = RH + "px"; }
}

// ---------- Текстовые сцены ----------
function buildScene(s, first) {
  const el = document.createElement("section");
  el.className = "scene pos-" + s.pos;
  const lines = s.lines.map(l => {
    const p = document.createElement("p"); p.className = "l l-" + l.t; el.appendChild(p);
    return { el: p, text: l.text, typed: l.t === "say" || l.t === "draft", draft: l.t === "draft" };
  });
  $("#scenes").appendChild(el);
  return { ...s, el, lines, first };
}

function updateScene(s, p, born) {
  const op = (s.first ? born : smooth(seg(p, s.from, s.from + 0.05))) * (1 - smooth(seg(p, s.to - 0.05, s.to)));
  s.el.style.opacity = op;
  s.el.style.filter = op < 0.99 ? `blur(${((1 - op) * 10).toFixed(1)}px)` : "none";
  if (op <= 0) return;
  const tl = s.lines.filter(l => l.typed), total = tl.reduce((n, l) => n + l.text.length, 0);
  let shown = Math.floor(seg(p, s.from + 0.04, s.to - 0.06) * total * 1.05);
  tl.forEach((l, i) => {
    const n = clamp(shown, 0, l.text.length);
    l.el.textContent = l.text.slice(0, n); shown -= l.text.length;
    l.el.classList.toggle("strike", l.draft && n === l.text.length && shown > 0 && i < tl.length - 1);
  });
  s.lines.forEach(l => { if (!l.typed) l.el.textContent = l.text; });
}

// ---------- Карточки: всё берётся из content.json ----------
function el(tag, cls, text, par) {
  const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; if (par) par.appendChild(n); return n;
}

function buildCard(d, c) {
  const slab = el("article", "slab"), flip = el("div", "flip", "", slab);
  const face = cls => el("div", "f " + cls, "", flip);
  for (let k = 0; k < 8; k++) face("edge").style.transform = `translateZ(${-k * 2.6}px)`;   // толщина стекла
  const img = `url("${d.img}")`, foc = d.focus || "center";
  const bg = face("bglass"); bg.style.backgroundImage = img; bg.style.backgroundPosition = foc;   // матовая обратная сторона
  const ph = face("photo");                                                                       // фото «внутри» стекла
  ph.style.backgroundImage = `linear-gradient(to top,rgba(8,11,9,.85),rgba(8,11,9,0) 62%),${img}`;
  ph.style.backgroundPosition = `center,${foc}`;
  face("front");
  const txt = face("txt");

  if (d.kind === "note") d.lines.forEach(t => el("p", "l l-say", t, txt));
  else {
    el("p", "t-title", d.title, txt);
    el("p", "l-sub", d.sub, txt);
    el("p", "kicker", c.opinionLabel, txt);
    el("p", "opinion", d.opinion, txt);
    const go = el("button", "go", "", flip); go.type = "button";
    el("span", "", d.go || c.goText, go);
    go.onclick = () => slab.classList.add("flipped");
    const back = face("btxt");
    if (d.kind === "activity") addForm(back, c.form, d.title, slab);
    else {
      el("p", "reply", d.reply, back);
      const b = el("button", "backlink", c.form.back, back); b.type = "button"; b.onclick = () => slab.classList.remove("flipped");
    }
    for (let i = 0; i < 7; i++) {   // светлячки на обороте
      const s = el("i", "sp", "", back);
      s.style.cssText = `left:${10 + Math.random() * 80}%;top:${10 + Math.random() * 80}%;animation-delay:${-Math.random() * 7}s`;
    }
  }
  $("#deck").appendChild(slab);
  cards.push(slab);
}

function addForm(par, f, title, slab) {
  const form = el("form", "tgform", "", par);
  el("p", "chosen", `${f.chosen} ${title}`, form);
  const field = el("div", "field", "", form);
  const inp = el("input", "", "", field);
  inp.name = "telegram"; inp.required = true; inp.placeholder = " "; inp.autocomplete = "off"; inp.autocapitalize = "off";
  el("label", "", f.label, field); el("i", "", "", field);
  const send = el("button", "send", "", form); send.type = "submit";
  el("span", "", f.submit, send); send.insertAdjacentHTML("beforeend", PLANE);
  const note = el("p", "note", f.note, form);
  const back = el("button", "backlink", f.back, form); back.type = "button"; back.onclick = () => slab.classList.remove("flipped");

  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    fd.append("choice", title);
    Object.entries(f.extra || {}).forEach(([k, v]) => fd.append(k, v));
    try {
      if (f.endpoint.includes("ЗАМЕНИ")) throw new Error("endpoint не настроен");
      const r = await fetch(f.endpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      form.classList.add("sent");                       // бумажный самолётик улетает
      setTimeout(() => form.replaceWith(el("p", "reply", f.ok)), 1000);
    } catch (err) {
      console.error(err);
      note.textContent = f.fail;
      const a = el("a", "", f.contactText, note); a.href = f.contact;
    }
  };
}

// ---------- Частицы розы: пиксели настоящего фото ----------
function makeParticles(img) {
  const cols = 80, rows = img ? Math.round(cols * img.naturalHeight / img.naturalWidth) : cols;
  const off = document.createElement("canvas"); off.width = cols; off.height = rows;
  const o = off.getContext("2d", { willReadFrequently: true });
  if (img) o.drawImage(img, 0, 0, cols, rows);
  else {
    const g = o.createRadialGradient(cols / 2, rows / 2, 2, cols / 2, rows / 2, cols / 2);
    g.addColorStop(0, "#9F2438"); g.addColorStop(1, "#080B09"); o.fillStyle = g; o.fillRect(0, 0, cols, rows);
  }
  const d = o.getImageData(0, 0, cols, rows).data; particles = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = (y * cols + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    if (0.3 * r + 0.59 * g + 0.11 * b < 40) continue;
    const a = Math.random() * 6.283, dist = 0.25 + Math.random();
    const k = 1.35;   // подсветка: точки ярче исходных пикселей
    particles.push({ u: x / cols - 0.5, v: (y / rows - 0.5) * rows / cols, col: `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`,
      dx: Math.cos(a) * dist, dy: Math.sin(a) * dist - 0.45, ph: Math.random() * 6.28 });
  }
}

function glow(x, y, r, rgb, a) {
  if (a < 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---------- Главный цикл ----------
function frame(t) {
  if (t0 === null) { t0 = t; last = t; }
  const dt = Math.min((t - last) / 1000, 0.05); last = t;
  cur += (target - cur) * (reduced ? 1 : 1 - Math.exp(-dt * 6));   // инерция не зависит от частоты кадров
  const p = cur, time = reduced ? 0 : t / 1000, born = reduced ? 1 : smooth((t - t0) / 2200);
  const sky = smooth(seg(p, 0.36, 0.62));
  stage.style.setProperty("--sky", sky.toFixed(3));

  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter";   // свет складывается: всё «сияет»

  // звёзды: каждая загорается в свой момент
  for (const s of stars) {
    const vis = 0.07 + 0.93 * smooth(seg(p, s.th, s.th + 0.12));
    const x = s.x * W, y = (((s.y - p * s.z * 0.35) % 1 + 1) % 1) * H, tw = 0.6 + 0.4 * Math.sin(time * 1.4 + s.ph);
    ctx.globalAlpha = vis * s.z * tw; ctx.fillStyle = s.big ? "#FFF3D6" : "#CFE6EA";
    ctx.fillRect(x, y, s.s, s.s);
    if (s.big && vis > 0.3) { ctx.fillRect(x - 8 * tw, y + s.s / 2 - 0.4, 16 * tw, 0.8); ctx.fillRect(x + s.s / 2 - 0.4, y - 8 * tw, 0.8, 16 * tw); }
  }

  // вступление: золотое кольцо из частиц расширяется и вспыхивает
  const ra = (1 - smooth(seg(p, 0.14, 0.25))) * born;
  if (ra > 0.01) {
    const rr = Math.min(W, H) * 0.34 + smooth(seg(p, 0.02, 0.22)) * Math.max(W, H) * 0.9, cy0 = H * 0.5;
    for (const r of ring) {
      const a = r.a + time * 0.06 * (r.g ? 1 : -1), rad = rr * (1 + r.j * 0.16) + Math.sin(time * 0.8 + r.ph) * 4;
      ctx.globalAlpha = ra * (0.35 + 0.65 * Math.abs(Math.sin(time + r.ph))) * (r.g ? 0.5 : 0.9);
      ctx.fillStyle = r.g ? "#6FAE86" : "#E8CB8A";
      ctx.fillRect(W / 2 + Math.cos(a) * rad, cy0 + Math.sin(a) * rad * 0.9, r.s, r.s);
    }
    glow(W / 2, cy0, Math.max(W, H) * 0.6, "255,210,140", 0.38 * Math.sin(Math.PI * seg(p, 0.06, 0.26)) * born);
  }

  // роза: появляется из темноты и размытия → то же фото рассыпается на светящиеся точки
  const appear = smooth(seg(p, 0.12, 0.3)), swap = hasRose ? smooth(seg(p, 0.38, 0.44)) : appear;
  const dissolve = smooth(seg(p, 0.44, 0.74)), fade = 1 - smooth(seg(p, 0.66, 0.84));
  const cx = W / 2, cy = H * 0.42, k = Math.max(W, H) * 0.7;
  if (hasRose) {
    rose.style.top = cy + "px";
    rose.style.opacity = appear * (1 - swap);
    rose.style.filter = `blur(${((1 - appear) * 16).toFixed(1)}px) brightness(${(0.3 + 0.7 * appear + swap * 0.8).toFixed(2)})`;
    rose.style.transform = `translate(-50%,-50%) scale(${1 + appear * 0.05 + swap * 0.04})`;
  }
  glow(cx, cy, RW * 1.1, "255,170,150", 0.35 * Math.sin(Math.PI * seg(p, 0.4, 0.66)));
  const pa = swap * fade;
  if (pa > 0.01) {
    const m = (hasRose ? 0 : (1 - appear) * 0.35) + dissolve, sz = RW / 80 * 1.5;
    for (const q of particles) {
      ctx.globalAlpha = pa; ctx.fillStyle = q.col;
      ctx.fillRect(cx + q.u * RW + q.dx * k * m + Math.sin(time + q.ph) * 0.8, cy + q.v * RW + q.dy * k * m + Math.cos(time + q.ph) * 0.8, sz, sz);
    }
  }

  // боке на переднем плане (объём) и светлячки
  if (p > 0.3) for (const b of bokeh)
    glow(b.x * W + Math.sin(time * 0.3 + b.r) * 14, (((b.y - p * b.z * 1.1) % 1 + 1) % 1) * H, b.r, b.g ? "111,174,134" : "232,203,138", 0.07 * smooth(seg(p, 0.3, 0.5)));
  for (const f of flies) {
    ctx.globalAlpha = (0.3 + 0.7 * Math.abs(Math.sin(time * 1.1 + f.ph))) * 0.8 * smooth(seg(p, 0.08, 0.2));
    ctx.fillStyle = "#FFE9B0";
    ctx.fillRect(f.x * W + Math.sin(time * 0.6 + f.ph) * 18, (((f.y - p * f.z * 0.6 - time * 0.01 * f.z) % 1 + 1) % 1) * H, f.s, f.s);
  }

  // падающие звёзды
  if (!reduced && sky > 0.4 && Math.random() < 0.006 && meteors.length < 2) meteors.push({ x: W * (0.5 + Math.random() * 0.5), y: H * Math.random() * 0.3, l: 0 });
  meteors = meteors.filter(m => {
    m.l += dt * 1.1; m.x -= dt * W * 0.9; m.y += dt * H * 0.3;
    const g = ctx.createLinearGradient(m.x, m.y, m.x + 110, m.y - 36);
    g.addColorStop(0, `rgba(255,243,214,${1 - m.l})`); g.addColorStop(1, "rgba(255,243,214,0)");
    ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + 110, m.y - 36); ctx.stroke();
    return m.l < 1;
  });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

  // Юпитер поднимается из звёздного неба, как горизонт планеты
  const pe = smooth(seg(p, 0.6, 0.86));
  planet.style.transform = `translate(-50%,${((1 - pe) * 100).toFixed(1)}%) scale(${(1 + pe * 0.08).toFixed(3)})`;
  planet.style.opacity = smooth(seg(p, 0.6, 0.7)) * (1 - 0.25 * smooth(seg(p, 0.92, 1)));
  planet.style.backgroundPosition = `${50 + 10 * Math.sin(time * 0.07)}% ${45 + 6 * Math.cos(time * 0.05)}%`;

  // карточки по спирали: больше движения справа налево, чем снизу вверх; зазор между ними проверен расчётом
  const N = cards.length, pos = seg(p, CARD0, CARD1) * (N - 1), enter = smooth(seg(p, 0.6, 0.7));
  cards.forEach((c, i) => {
    const tt = i - pos + (1 - enter) * 1.8, a = tt * 0.95, R = W * 1.3;
    const x = Math.sin(a) * R, z = (Math.cos(a) - 1) * R * 0.9, y = tt * H * 0.05;
    c.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${(a * 57.3).toFixed(1)}deg)`;
    c.style.setProperty("--o", clamp(1.15 - Math.abs(tt) * 0.9).toFixed(3));
    c.style.pointerEvents = Math.abs(tt) < 0.35 ? "auto" : "none";
    if (Math.abs(tt) > 1.4) c.classList.remove("flipped");
  });

  scenes.forEach(s => updateScene(s, p, born));
  $("#hint").style.opacity = born * (1 - smooth(seg(p, 0.01, 0.05)));
  requestAnimationFrame(frame);
}
