"use strict";
const $ = s => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const seg = (p, a, b) => clamp((p - a) / (b - a));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let target = 0, cur = 0, W = 0, H = 0, DPR = 1, hasRose = false;
let scenes = [], cards = [], particles = [], stars = [];
const cv = $("#sky"), ctx = cv.getContext("2d"), rose = $("#rose");

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
  $("#skip").textContent = c.skip;
  $("#skip").onclick = () => scrollTo({ top: document.body.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  c.scenes.forEach(s => scenes.push(buildScene(s)));
  c.cards.forEach(d => buildCard(d, c.form));

  rose.onerror = () => { rose.remove(); makeParticles(null); };
  rose.onload = () => { hasRose = true; makeParticles(rose); };
  rose.src = c.images.rose;

  stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random(), ph: Math.random() * 6.28, s: Math.random() * 1.3 + 0.4 }));
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

// ---------- Сцены с текстом ----------
function buildScene(s) {
  const el = document.createElement("section");
  el.className = "scene pos-" + s.pos;
  const lines = s.lines.map(l => {
    const p = document.createElement("p");
    p.className = "l l-" + l.t; el.appendChild(p);
    return { el: p, text: l.text, typed: l.t === "say" || l.t === "draft", draft: l.t === "draft" };
  });
  $("#scenes").appendChild(el);
  return { ...s, el, lines };
}

function updateScene(s, p) {
  const op = smooth(seg(p, s.from, s.from + 0.05)) * (1 - smooth(seg(p, s.to - 0.05, s.to)));
  s.el.style.opacity = op;
  if (op <= 0) return;
  const tl = s.lines.filter(l => l.typed);
  const total = tl.reduce((n, l) => n + l.text.length, 0);
  let shown = Math.floor(seg(p, s.from + 0.04, s.to - 0.06) * total * 1.05);
  tl.forEach((l, i) => {
    const n = clamp(shown, 0, l.text.length);
    l.el.textContent = l.text.slice(0, n);
    shown -= l.text.length;
    l.el.classList.toggle("strike", l.draft && n === l.text.length && shown > 0 && i < tl.length - 1);
  });
  s.lines.forEach(l => { if (!l.typed) l.el.textContent = l.text; });
}

// ---------- Стеклянные карточки ----------
function buildCard(d, f) {
  const el = document.createElement("article");
  el.className = "slab";
  const img = new Image(); img.className = "ph"; img.alt = ""; img.onerror = () => img.remove(); img.src = d.img;
  const pane = document.createElement("div"); pane.className = "pane";
  d.lines.forEach(l => { const p = document.createElement("p"); p.className = "l l-" + l.t; p.textContent = l.text; pane.appendChild(p); });
  if (d.kind === "choice") d.options.forEach(o => {
    const lab = document.createElement("label"); lab.className = "opt";
    lab.innerHTML = '<input type="radio" name="choice"><b></b><span></span>';
    lab.firstChild.value = o.title;
    lab.children[1].textContent = o.title; lab.children[2].textContent = o.sub;
    pane.appendChild(lab);
  });
  if (d.kind === "form") addForm(pane, f);
  el.append(img, pane);
  $("#deck").appendChild(el);
  cards.push(el);
}

function addForm(pane, f) {
  const form = document.createElement("form");
  form.innerHTML = '<label for="tg"></label><input id="tg" name="telegram" required autocomplete="off" autocapitalize="off"><button class="send" type="submit"></button><p class="note"></p>';
  form.children[0].textContent = f.label;
  form.children[1].placeholder = f.placeholder;
  form.children[2].textContent = f.submit;
  const note = form.children[3]; note.textContent = f.note;

  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const ch = document.querySelector("input[name=choice]:checked");
    fd.append("choice", ch ? ch.value : "не выбрано");
    Object.entries(f.extra || {}).forEach(([k, v]) => fd.append(k, v));
    try {
      if (f.endpoint.includes("ЗАМЕНИ")) throw new Error("endpoint не настроен");
      const r = await fetch(f.endpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const ok = document.createElement("p"); ok.className = "reply"; ok.textContent = f.ok;
      form.replaceWith(ok); no.remove();
    } catch (err) {
      console.error(err);
      note.textContent = f.fail;
      const a = document.createElement("a"); a.href = f.contact; a.textContent = f.contactText;
      note.appendChild(a);
    }
  };
  const no = document.createElement("button");
  no.className = "decline"; no.type = "button"; no.textContent = f.decline.text;
  no.onclick = () => {
    form.remove(); no.remove();
    const r = document.createElement("p"); r.className = "reply"; r.textContent = f.decline.reply;
    pane.appendChild(r);
  };
  pane.append(form, no);
}

// ---------- Частицы: пиксели фото розы ----------
function makeParticles(img) {
  const cols = 90, rows = img ? Math.round(cols * img.naturalHeight / img.naturalWidth) : cols;
  const off = document.createElement("canvas"); off.width = cols; off.height = rows;
  const o = off.getContext("2d", { willReadFrequently: true });
  if (img) o.drawImage(img, 0, 0, cols, rows);
  else {
    const g = o.createRadialGradient(cols / 2, rows / 2, 2, cols / 2, rows / 2, cols / 2);
    g.addColorStop(0, "#9F2438"); g.addColorStop(1, "#080B09");
    o.fillStyle = g; o.fillRect(0, 0, cols, rows);
  }
  const d = o.getImageData(0, 0, cols, rows).data;
  particles = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = (y * cols + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    if (0.3 * r + 0.59 * g + 0.11 * b < 45) continue;
    const a = Math.random() * 6.283, dist = 0.25 + Math.random();
    particles.push({ u: x / cols - 0.5, v: (y / rows - 0.5) * rows / cols, col: `rgb(${r},${g},${b})`,
      dx: Math.cos(a) * dist, dy: Math.sin(a) * dist - 0.4, ph: Math.random() * 6.28 });
  }
}

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  rose.style.width = Math.min(W * 0.9, H * 0.52) + "px";
}

// ---------- Кадр ----------
function frame(t) {
  cur += (target - cur) * (reduced ? 1 : 0.1);
  const p = cur, time = reduced ? 0 : t / 1000;
  ctx.clearRect(0, 0, W, H);

  const starVis = 0.3 + 0.7 * smooth(seg(p, 0.42, 0.62));
  ctx.fillStyle = "#F1EADB";
  for (const s of stars) {
    const y = ((s.y - p * s.z * 0.5) % 1 + 1) % 1;
    ctx.globalAlpha = starVis * s.z * (0.55 + 0.45 * Math.sin(time * 1.3 + s.ph));
    ctx.fillRect(s.x * W, y * H, s.s, s.s);
  }

  // роза: настоящее фото → при распаде то же изображение превращается в точки
  const appear = smooth(seg(p, 0.08, 0.26)), swap = smooth(seg(p, 0.4, 0.46));
  const dissolve = smooth(seg(p, 0.44, 0.72)), fade = 1 - smooth(seg(p, 0.6, 0.78));
  const S = Math.min(W * 0.9, H * 0.52), cx = W / 2, cy = H * 0.42, k = Math.max(W, H) * 0.7;
  if (hasRose) {
    rose.style.top = cy + "px";
    rose.style.opacity = appear * (1 - swap);
    rose.style.transform = `translate(-50%,-50%) scale(${1 + appear * 0.05})`;
  }
  const pa = (hasRose ? swap : appear) * fade;
  if (pa > 0.01) for (const q of particles) {
    const m = (hasRose ? 0 : (1 - appear) * 0.35) + dissolve;
    ctx.globalAlpha = pa; ctx.fillStyle = q.col;
    ctx.fillRect(cx + q.u * S + q.dx * k * m + Math.sin(time + q.ph) * 0.8,
                 cy + q.v * S + q.dy * k * m + Math.cos(time + q.ph) * 0.8, S / 90 * 1.2, S / 90 * 1.2);
  }
  ctx.globalAlpha = 1;

  // карточки идут по спирали снизу: позиция по винтовой линии + поворот к центру
  const N = cards.length, pos = seg(p, 0.54, 0.96) * (N - 1), enter = smooth(seg(p, 0.5, 0.62));
  cards.forEach((el, i) => {
    const tt = i - pos + (1 - enter) * 1.6, a = tt * 0.5, R = W * 0.6;
    const x = Math.sin(a) * R, z = (Math.cos(a) - 1) * R * 0.8, y = tt > 0 ? tt * H * 0.75 : tt * H * 0.3;
    el.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y}px,${z}px) rotateY(${a * 57.3}deg)`;
    el.style.opacity = clamp(1 - Math.abs(tt) * 0.9);
    el.style.zIndex = 100 - Math.round(Math.abs(tt) * 10);
    el.style.pointerEvents = Math.abs(tt) < 0.3 ? "auto" : "none";
  });

  scenes.forEach(s => updateScene(s, p));
  $("#hint").style.opacity = 1 - smooth(seg(p, 0.01, 0.05));
  $("#skip").style.opacity = 1 - smooth(seg(p, 0.9, 0.96));
  requestAnimationFrame(frame);
}
