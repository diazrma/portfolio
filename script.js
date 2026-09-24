// Cada pata da aranha é uma skill. Pernas 0-3 = lado direito (frente → trás), 4-7 = lado esquerdo.
const skills = [
  { name: 'Magento', level: 95, color: '#ff7a3d', text: 'Arquitetura de loja, módulos, fluxo de checkout, customizações e estabilidade de negócio.' },
  { name: 'PHP', level: 93, color: '#9b8cff', text: 'Lógica de backend, processamento de regras, APIs e integrações de forma escalável.' },
  { name: 'MySQL', level: 88, color: '#38c8ff', text: 'Modelagem, consultas e otimização de dados para manter a performance e a consistência.' },
  { name: 'APIs', level: 90, color: '#7ef9d6', text: 'Integração com sistemas externos, ERP, CRM, logística e automações de processo.' },
  { name: 'Redis', level: 82, color: '#ff4d6d', text: 'Cache estratégico para reduzir tempo de resposta e melhorar a experiência do usuário.' },
  { name: 'Docker', level: 84, color: '#4d7cff', text: 'Ambientes consistentes para desenvolvimento, teste e deploy com menos riscos.' },
  { name: 'Git', level: 91, color: '#ff9ac7', text: 'Versionamento em equipe, rastreabilidade e organização de entregas e correções.' },
  { name: 'Linux', level: 86, color: '#ffd24d', text: 'Administração de ambiente, processos, deploy e manutenção da infraestrutura.' }
];

// Nível exibido no lugar de porcentagens autoavaliadas.
const levelLabel = (level) => (level >= 93 ? 'Especialista' : level >= 86 ? 'Avançado' : 'Proficiente');

const stage = document.getElementById('spiderStage');
const world = document.getElementById('spiderWorld');
const rig = document.getElementById('spiderRig');
const spider = document.getElementById('spider');
const floorShadow = document.getElementById('floorShadow');
const pivotMarker = document.getElementById('threadPivot');
const overlay = document.getElementById('spiderOverlay');
const labelLayer = document.getElementById('legLabels');
const webBg = document.getElementById('webBg');
const hudReadout = document.getElementById('hudReadout');
const infoCard = document.getElementById('skillCard');
const skillTitle = document.getElementById('skillTitle');
const skillText = document.getElementById('skillText');
const skillLevel = document.getElementById('skillLevel');
const skillBar = document.getElementById('skillBar');
const legIndex = document.getElementById('legIndex');

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
const STAGE_BASE = 640;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = reduceMotion ? 0.3 : 1;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const el = (tag, className, parent) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
};

const svgEl = (tag, attrs, parent) => {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (parent) parent.appendChild(node);
  return node;
};

const translate = (x, y, z) => `translate3d(${x}px, ${y}px, ${z}px)`;

/* ---------- geometria ---------- */

const UNIT = 50;

// Elipsoide = meridianos + latitudes de uma esfera unitária escalada.
const buildEllipsoid = (parent, { x, y, z, rx, ry, rz, rings, meridians, core }) => {
  const holder = el('div', 'part', parent);
  holder.style.transform = translate(x, y, z);

  const shell = el('div', 'shell', holder);
  shell.style.transform = `scale3d(${rx / UNIT}, ${ry / UNIT}, ${rz / UNIT})`;

  for (let i = 0; i < meridians; i++) {
    const angle = (i * 180) / meridians;
    const ring = el('span', `ring meridian${angle === 90 ? ' spine' : ''}`, shell);
    ring.style.transform = `rotateY(${angle}deg)`;
  }

  for (let i = 1; i < rings; i++) {
    const phi = -Math.PI / 2 + (i * Math.PI) / rings;
    const r = Math.cos(phi) * UNIT;
    const ring = el('span', 'ring latitude', shell);
    ring.style.width = ring.style.height = `${r * 2}px`;
    ring.style.margin = `${-r}px 0 0 ${-r}px`;
    ring.style.transform = `translateY(${Math.sin(phi) * UNIT}px) rotateX(90deg)`;
  }

  let coreNode = null;
  if (core) {
    coreNode = el('span', 'core', holder);
    coreNode.style.width = coreNode.style.height = `${core}px`;
    coreNode.style.margin = `${-core / 2}px 0 0 ${-core / 2}px`;
  }

  return { holder, core: coreNode, rx, ry, rz };
};

// Segmento de pata: dois planos cruzados (parece um tubo de qualquer ângulo) + articulação.
const buildSegment = (parent, length, thickness, className = '') => {
  const seg = el('div', `seg ${className}`, parent);
  ['plane', 'plane plane-h'].forEach((cls) => {
    const plane = el('span', cls, seg);
    plane.style.width = `${length}px`;
    plane.style.height = `${thickness}px`;
    plane.style.top = `${-thickness / 2}px`;
  });
  ['joint', 'joint joint-b'].forEach((cls) => {
    const joint = el('span', cls, seg);
    joint.style.setProperty('--j', `${thickness * 1.35}px`);
  });
  return seg;
};

// Pontinho posicionado na superfície de um elipsoide, virado para fora.
const mountOnSurface = (body, x, y, className, size) => {
  const { rx, ry, rz } = body;
  const z = rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2)) + 1;
  const nx = x / rx ** 2;
  const ny = y / ry ** 2;
  const nz = z / rz ** 2;
  const len = Math.hypot(nx, ny, nz);
  const yaw = Math.atan2(nx, nz) / DEG;
  const pitch = -Math.asin(ny / len) / DEG;

  const mount = el('div', 'eye-mount', body.holder);
  mount.style.transform = `${translate(x, y, z)} rotateY(${yaw}deg) rotateX(${pitch}deg)`;
  const dot = el('span', className, mount);
  dot.style.setProperty('--s', `${size}px`);
  dot.style.animationDelay = `${(Math.random() * 4).toFixed(2)}s`;
  return dot;
};

/* ---------- corpo ---------- */

const CEPH_Z = 22;
const ceph = buildEllipsoid(spider, { x: 0, y: 0, z: CEPH_Z, rx: 36, ry: 24, rz: 44, rings: 7, meridians: 6, core: 120 });
buildEllipsoid(spider, { x: 0, y: -3, z: -24, rx: 11, ry: 9, rz: 12, rings: 4, meridians: 3 });
const abdomen = buildEllipsoid(spider, { x: 0, y: -10, z: -92, rx: 56, ry: 46, rz: 70, rings: 9, meridians: 8, core: 200 });

[
  [8, -9, 10], [-8, -9, 10],
  [19, -8, 7], [-19, -8, 7],
  [6, -17, 5.5], [-6, -17, 5.5],
  [25, -5, 6], [-25, -5, 6]
].forEach(([x, y, size]) => mountOnSurface(ceph, x, y, 'eye', size));

pivotMarker.style.transform = translate(0, -520, -95);

const centerMarker = el('span', 'marker', ceph.holder);
const anchorMarker = el('span', 'marker', abdomen.holder);
anchorMarker.style.transform = translate(0, -30, -48);

// Quelíceras (presas)
const fangs = [1, -1].map((side) => {
  const root = el('div', 'leg fang', ceph.holder);
  root.style.transform = `${translate(side * 7, 8, 36)} rotateY(-90deg)`;
  const base = buildSegment(root, 16, 8);
  const tip = buildSegment(base, 10, 4);
  return { side, base, tip };
});

// Pedipalpos (as "perninhas" da frente)
const palps = [1, -1].map((side) => {
  const root = el('div', 'leg palp', ceph.holder);
  const a = buildSegment(root, 16, 6);
  const b = buildSegment(a, 22, 5);
  const c = buildSegment(b, 14, 4);
  return { side, root, a, b, c };
});

/* ---------- patas (skills) ---------- */

const LEG_BASE = { coxa: 26, femur: 92, tibia: 100, tarsus: 52 };
const LEG_LAYOUT = [
  { yaw: -60, scale: 1.12 },
  { yaw: -22, scale: 1.0 },
  { yaw: 14, scale: 0.95 },
  { yaw: 50, scale: 1.08 }
];
const GROUP_A = new Set([0, 5, 2, 7]); // marcha em tetrápode alternado

const connectorLayer = svgEl('g', {}, overlay);
const defs = svgEl('defs', {}, overlay);
const threadGrad = svgEl('linearGradient', { id: 'threadGrad', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 300 }, defs);
svgEl('stop', { offset: '0', 'stop-color': '#dbe8ff', 'stop-opacity': '0' }, threadGrad);
svgEl('stop', { offset: '1', 'stop-color': '#dbe8ff', 'stop-opacity': '0.7' }, threadGrad);
const thread = svgEl('line', { class: 'thread' }, overlay);

const legs = skills.map((skill, i) => {
  const side = i < 4 ? 1 : -1;
  const layout = LEG_LAYOUT[i % 4];
  const len = Object.fromEntries(Object.entries(LEG_BASE).map(([k, v]) => [k, v * layout.scale]));

  const root = el('div', 'leg', spider);
  root.style.setProperty('--c', skill.color);
  const coxa = buildSegment(root, len.coxa, 13, 'coxa');
  const femur = buildSegment(coxa, len.femur, 10, 'femur');
  const tibia = buildSegment(femur, len.tibia, 7, 'tibia');
  const tarsus = buildSegment(tibia, len.tarsus, 4, 'tarsus');
  const tip = el('span', 'leg-tip', tarsus);
  tip.style.transform = `translateX(${len.tarsus}px)`;

  const label = el('button', 'leg-label', labelLayer);
  label.type = 'button';
  label.style.setProperty('--c', skill.color);
  label.setAttribute('aria-pressed', 'false');
  label.innerHTML = `<span class="dot"></span><span class="name">${skill.name}</span>`;

  const group = svgEl('g', { style: `--c:${skill.color}` }, connectorLayer);
  const connector = svgEl('path', { class: 'connector' }, group);
  const tipDot = svgEl('circle', { class: 'tip-dot', r: 2.5 }, group);
  const tipPulse = svgEl('circle', { class: 'tip-pulse', r: 4, visibility: 'hidden' }, group);

  const activate = () => {
    if (state.dragging) return;
    markInteraction();
    setActive(i);
  };
  root.addEventListener('pointerenter', activate);
  label.addEventListener('pointerenter', activate);
  label.addEventListener('focus', activate);
  label.addEventListener('click', activate);

  return {
    side, len, root, coxa, femur, tibia, tarsus, tip, label, connector, tipDot, tipPulse,
    baseYaw: layout.yaw,
    phase: GROUP_A.has(i) ? 0 : Math.PI,
    act: 0,
    yaw: 0,
    lx: null,
    ly: null,
    w: 100,
    h: 30
  };
});

/* ---------- teia de fundo ---------- */

const buildWeb = () => {
  const C = STAGE_BASE / 2;
  const spokes = 20;
  const rings = 13;
  const maxR = 340;
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const angles = Array.from({ length: spokes }, (_, i) => (i / spokes) * Math.PI * 2 + (rand() - 0.5) * 0.18);
  const radii = angles.map(() => []);
  for (let r = 1; r <= rings; r++) {
    const base = 20 + (r / rings) ** 1.15 * (maxR - 30);
    angles.forEach((_, i) => { radii[i][r] = base * (0.94 + rand() * 0.1); });
  }

  const point = (a, r) => `${(C + Math.cos(a) * r).toFixed(1)} ${(C + Math.sin(a) * r).toFixed(1)}`;
  let d = '';
  angles.forEach((a) => { d += `M${C} ${C}L${point(a, maxR)}`; });
  for (let r = 1; r <= rings; r++) {
    angles.forEach((a, i) => {
      const j = (i + 1) % spokes;
      const b = angles[j] + (j === 0 ? Math.PI * 2 : 0);
      const r1 = radii[i][r];
      const r2 = radii[j][r];
      d += `M${point(a, r1)}Q${point((a + b) / 2, ((r1 + r2) / 2) * 0.9)} ${point(b, r2)}`;
    });
  }

  const g = svgEl('g', { class: 'web-spin' }, webBg);
  svgEl('path', { d, class: 'web-lines' }, g);
  svgEl('circle', { cx: C, cy: C, r: 12, class: 'web-hub' }, g);
  for (let k = 0; k < 28; k++) {
    const i = Math.floor(rand() * spokes);
    const r = 2 + Math.floor(rand() * (rings - 2));
    const [cx, cy] = point(angles[i], radii[i][r]).split(' ');
    const dew = svgEl('circle', { cx, cy, r: (1 + rand() * 1.4).toFixed(1), class: 'dew' }, g);
    dew.style.animationDelay = `${(rand() * 4).toFixed(2)}s`;
  }
};

buildWeb();

/* ---------- resto da página ---------- */

const skillsGrid = document.getElementById('skillsGrid');
const skillCards = skills.map((skill, i) => {
  const card = el('button', 'skill-card reveal', skillsGrid);
  card.type = 'button';
  card.style.setProperty('--c', skill.color);
  card.style.setProperty('--lvl', `${skill.level}%`);
  card.style.transitionDelay = `${(i % 4) * 60}ms`;
  card.innerHTML = `
    <span class="skill-card-top"><span>${String(i + 1).padStart(2, '0')}</span><i></i></span>
    <strong>${skill.name}</strong>
    <span class="skill-card-bar"><span></span></span>
    <small>${levelLabel(skill.level)}</small>`;
  const activate = () => {
    markInteraction();
    setActive(i);
  };
  card.addEventListener('pointerenter', activate);
  card.addEventListener('focus', activate);
  card.addEventListener('click', activate);
  return card;
});

const tickerTrack = document.getElementById('tickerTrack');
tickerTrack.innerHTML = [...skills, ...skills]
  .map((skill) => `<span style="--c:${skill.color}"><i></i>${skill.name}</span>`)
  .join('');

document.getElementById('year').textContent = new Date().getFullYear();

const topbar = document.querySelector('.topbar');
const menuToggle = document.getElementById('menuToggle');
const setMenuOpen = (open) => {
  topbar.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
};
menuToggle.addEventListener('click', () => setMenuOpen(!topbar.classList.contains('menu-open')));
document.querySelectorAll('.menu a, .nav-cta').forEach((link) => link.addEventListener('click', () => setMenuOpen(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenuOpen(false);
});
const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 10);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((node) => revealObserver.observe(node));

const menuLinks = [...document.querySelectorAll('.menu a')];
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    menuLinks.forEach((link) => link.classList.toggle('current', link.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
menuLinks.forEach((link) => {
  const target = document.querySelector(link.getAttribute('href'));
  if (target) sectionObserver.observe(target);
});

/* ---------- estado + interação ---------- */

const state = {
  yaw: -32,
  tilt: -16,
  yawVel: 0,
  lookX: 0,
  lookY: 0,
  targetLookX: 0,
  targetLookY: 0,
  drop: reduceMotion ? 0 : -680,
  dropVel: 0,
  sway: 0,
  swayVel: 0,
  scale: 1,
  active: -1,
  dragging: false,
  lastInteraction: -Infinity,
  lastAuto: 0,
  pinned: false
};

// Passeio livre pelo chão holográfico.
const WALK_DROP = 124; // altura em que as patas tocam o chão
const WALK_SPEED = 1.5;
const WANDER_RADIUS = 135;
const walker = { x: 0, z: 0, heading: 0, speed: 0, turn: 0, gait: 0, amp: 0, tx: 0, tz: 0, waitUntil: 0 };

const pickWalkTarget = () => {
  for (let tries = 0; tries < 8; tries++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * WANDER_RADIUS;
    walker.tx = Math.cos(angle) * radius;
    walker.tz = Math.sin(angle) * radius;
    if (Math.hypot(walker.tx - walker.x, walker.tz - walker.z) > 70) return;
  }
};
pickWalkTarget();

function markInteraction() {
  state.lastInteraction = performance.now();
}

function setActive(index) {
  if (index === state.active) return;
  state.active = index;
  const skill = skills[index];

  document.documentElement.style.setProperty('--active', skill.color);
  skillTitle.textContent = skill.name;
  skillText.textContent = skill.text;
  skillLevel.textContent = levelLabel(skill.level);
  skillBar.style.width = `${skill.level}%`;
  legIndex.textContent = String(index + 1).padStart(2, '0');
  hudReadout.textContent = `${skill.name} · ${levelLabel(skill.level)}`;

  infoCard.classList.remove('swap');
  void infoCard.offsetWidth;
  infoCard.classList.add('swap');

  legs.forEach((leg, i) => {
    const on = i === index;
    leg.root.classList.toggle('active', on);
    leg.label.classList.toggle('active', on);
    leg.label.setAttribute('aria-pressed', String(on));
    leg.connector.classList.toggle('active', on);
    leg.tipPulse.setAttribute('visibility', on ? 'visible' : 'hidden');
  });
  skillCards.forEach((card, i) => card.classList.toggle('active', i === index));

  state.swayVel += 0.12 * motion;
  // Para um instante para acenar com a pata nova.
  walker.waitUntil = Math.max(walker.waitUntil, performance.now() + 1400);
}

let lastPointerX = 0;
let lastPointerY = 0;

stage.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.leg-label, .pin-btn')) return;
  state.dragging = true;
  stage.classList.add('dragging');
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  stage.setPointerCapture(event.pointerId);
  markInteraction();
});

stage.addEventListener('pointermove', (event) => {
  if (!state.dragging) return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  state.yaw += dx * 0.4;
  state.yawVel = dx * 0.25;
  state.tilt = clamp(state.tilt - dy * 0.25, -55, 10);
  state.swayVel += dx * 0.012;
  markInteraction();
});

const stopDragging = () => {
  state.dragging = false;
  stage.classList.remove('dragging');
};
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => stage.addEventListener(type, stopDragging));

// Parallax: a cena inteira acompanha o mouse de leve.
window.addEventListener('pointermove', (event) => {
  if (state.pinned) return;
  const rect = stage.getBoundingClientRect();
  const nx = clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1.5, 1.5);
  const ny = clamp((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1.5, 1.5);
  state.targetLookX = nx * 10 * motion;
  state.targetLookY = -ny * 6 * motion;
});

stage.addEventListener('keydown', (event) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  markInteraction();
  setActive((state.active + step + skills.length) % skills.length);
});

// Botão "Fixar aranha": para giro automático, balanço, parallax e troca automática.
const pinBtn = document.getElementById('pinBtn');
const stageHint = stage.querySelector('.stage-hint');
const setPinned = (pinned) => {
  state.pinned = pinned;
  pinBtn.setAttribute('aria-pressed', String(pinned));
  pinBtn.querySelector('.pin-text').textContent = pinned ? 'Aranha fixa' : 'Fixar aranha';
  stageHint.textContent = pinned
    ? 'Arraste para girar · passe o mouse nas patas'
    : 'Ela passeia sozinha · arraste para girar';
  if (pinned) {
    state.yawVel = 0;
    state.targetLookX = 0;
    state.targetLookY = 0;
  }
  try { localStorage.setItem('spiderPinned', pinned ? '1' : '0'); } catch { /* storage indisponível */ }
};
pinBtn.addEventListener('click', () => setPinned(!state.pinned));
try { setPinned(localStorage.getItem('spiderPinned') === '1'); } catch { setPinned(false); }

const measure = () => {
  state.scale = Math.min(1, stage.clientWidth / STAGE_BASE, stage.clientHeight / STAGE_BASE);
  threadGrad.setAttribute('y2', String(stage.clientHeight * 0.4));
  legs.forEach((leg) => {
    leg.w = leg.label.offsetWidth;
    leg.h = leg.label.offsetHeight;
  });
};

window.addEventListener('resize', measure);
document.fonts?.ready.then(measure);
measure();
setActive(0);

/* ---------- loop de animação ---------- */

const centerOf = (node, origin) => {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top };
};

// Empurra etiquetas sobrepostas para cima/baixo.
const relaxLabels = (items) => {
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const overlapX = (a.w + b.w) / 2 + 6 - Math.abs(a.x - b.x);
        const overlapY = (a.h + b.h) / 2 + 4 - Math.abs(a.y - b.y);
        if (overlapX > 0 && overlapY > 0) {
          const push = (a.y <= b.y ? -1 : 1) * (overlapY / 2);
          a.y += push;
          b.y -= push;
        }
      }
    }
  }
};

let lastTime = performance.now();
let time = 0;

const frame = (now) => {
  const dt = Math.min(50, now - lastTime) / 16.667;
  lastTime = now;
  time += dt / 60;

  // Troca de skill automática quando ninguém está mexendo.
  if (!state.pinned && now - state.lastInteraction > 7000 && now - state.lastAuto > 3800 && Math.abs(state.dropVel) < 0.5) {
    state.lastAuto = now;
    setActive((state.active + 1) % skills.length);
  }

  // Passeio: escolhe destinos, vira o corpo e anda. Fixa = volta ao centro e sobe no fio.
  const w = walker;
  const landed = state.drop > WALK_DROP - 12;
  let desiredHeading = w.heading;
  let desiredSpeed = 0;
  let dropTarget = WALK_DROP;

  if (state.pinned) {
    const home = Math.hypot(w.x, w.z);
    if (home > 30) {
      desiredHeading = Math.atan2(-w.x, -w.z) / DEG;
      desiredSpeed = WALK_SPEED * clamp(home / 40, 0.4, 1);
    } else {
      // Perto de casa: desliza direto pro centro e se vira de frente.
      w.x -= w.x * Math.min(1, 0.08 * dt);
      w.z -= w.z * Math.min(1, 0.08 * dt);
      desiredHeading = 0;
      if (home < 4 && Math.abs(((w.heading % 360) + 540) % 360 - 180) < 8) dropTarget = 0;
    }
  } else if (landed && now > w.waitUntil) {
    const dx = w.tx - w.x;
    const dz = w.tz - w.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 14) {
      w.waitUntil = now + 600 + Math.random() * 2200;
      pickWalkTarget();
    } else {
      desiredHeading = Math.atan2(dx, dz) / DEG;
      desiredSpeed = WALK_SPEED * clamp(dist / 40, 0.35, 1);
    }
  }

  const headingDiff = ((desiredHeading - w.heading) % 360 + 540) % 360 - 180;
  w.turn = clamp(headingDiff * 0.08, -2.4, 2.4) * motion * dt;
  w.heading += w.turn;
  const facing = Math.max(0, Math.cos(headingDiff * DEG));
  w.speed += (desiredSpeed * facing * motion - w.speed) * 0.06 * dt;
  w.x += Math.sin(w.heading * DEG) * w.speed * dt;
  w.z += Math.cos(w.heading * DEG) * w.speed * dt;
  const fromCenter = Math.hypot(w.x, w.z);
  if (fromCenter > WANDER_RADIUS + 10) {
    w.x *= (WANDER_RADIUS + 10) / fromCenter;
    w.z *= (WANDER_RADIUS + 10) / fromCenter;
  }
  w.gait += (w.speed * 0.09 + Math.abs(w.turn) * 0.05) * dt;
  const walking = clamp(w.speed / WALK_SPEED + Math.abs(w.turn) / 1.2, 0, 1);
  w.amp += (walking - w.amp) * 0.12 * dt;

  // Física: giro de câmera com inércia, fio (mola), chão (quique) e pêndulo.
  const hangAir = clamp(1 - state.drop / WALK_DROP, 0, 1);
  const ground = 1 - hangAir;
  if (!state.dragging) {
    state.yaw += (state.yawVel + (state.pinned ? 0 : 0.07 * motion * hangAir)) * dt;
    state.yawVel *= Math.pow(0.94, dt);
  }
  if (state.pinned || ground > 0.5) state.swayVel *= Math.pow(0.85, dt);
  state.dropVel += (dropTarget - state.drop) * 0.018 * dt;
  state.dropVel *= Math.pow(0.88, dt);
  state.drop += state.dropVel * dt;
  if (state.drop > WALK_DROP) {
    state.drop = WALK_DROP;
    if (state.dropVel > 0) state.dropVel *= -0.25;
  }

  state.swayVel += -state.sway * 0.012 * dt;
  state.swayVel *= Math.pow(0.975, dt);
  state.sway += state.swayVel * dt;

  state.lookX += (state.targetLookX - state.lookX) * 0.05 * dt;
  state.lookY += (state.targetLookY - state.lookY) * 0.05 * dt;

  const yaw = state.yaw + state.lookX;
  const tilt = state.tilt + state.lookY;
  const idleSway = state.pinned ? 0 : motion;
  const swayZ = (clamp(state.sway, -14, 14) + Math.sin(time * 0.8) * 1.6 * idleSway) * hangAir;
  const swayX = Math.cos(time * 0.6) * 1.4 * idleSway * hangAir;
  const bob = Math.sin(time * 1.7) * 4 * motion * hangAir - Math.abs(Math.sin(w.gait)) * 3 * w.amp * ground;

  world.style.transform = `scale3d(${state.scale}, ${state.scale}, ${state.scale}) rotateX(${tilt}deg) rotateY(${yaw}deg)`;
  rig.style.transform = `translate3d(0, ${state.drop}px, 0) rotateZ(${swayZ}deg) rotateX(${swayX}deg)`;
  spider.style.transform = `${translate(w.x, bob, w.z)} rotateY(${w.heading}deg) translateZ(45px)`;

  const lift = clamp(1 + (state.drop - WALK_DROP) / 800, 0, 1);
  floorShadow.style.transform = `translate(${w.x}px, ${w.z}px) scale(${0.4 + lift * 0.6})`;
  floorShadow.style.opacity = String(0.2 + lift * 0.8);
  thread.style.opacity = String(clamp((WALK_DROP - 8 - state.drop) / 60, 0, 1));

  // Brilho interno sempre de frente para a câmera (inverso das rotações).
  const billboard = `rotateY(${-w.heading}deg) rotateX(${-swayX}deg) rotateZ(${-swayZ}deg) rotateY(${-yaw}deg) rotateX(${-tilt}deg)`;
  ceph.core.style.transform = billboard;
  abdomen.core.style.transform = billboard;

  // Patas
  legs.forEach((leg, i) => {
    // No ar: "anda no vazio" pelo tempo. No chão: passos pela distância percorrida.
    leg.act += ((i === state.active ? 1 - 0.4 * w.amp : 0) - leg.act) * 0.09 * dt;
    const a = leg.act;
    const gaitAmp = (hangAir + w.amp * ground) * (1 - a) * motion;
    const p = leg.phase + time * 2.6 * hangAir + w.gait;
    const step = Math.max(0, Math.sin(p)) * gaitAmp * (1 + ground * 0.6);
    const swing = Math.cos(p) * (7 + 8 * ground) * gaitAmp;
    const wave = Math.sin(time * 9 + i) * a * motion;

    const localYaw = leg.baseYaw + swing - a * 8;
    leg.yaw = leg.side === 1 ? localYaw : 180 - localYaw;

    leg.root.style.transform = `${translate(0, 4, CEPH_Z)} rotateY(${leg.yaw}deg) translateX(26px)`;
    leg.coxa.style.transform = `rotateZ(${-12 - 6 * step - 18 * a}deg)`;
    leg.femur.style.transform = `translateX(${leg.len.coxa}px) rotateZ(${-48 - 10 * step + 6 * a}deg)`;
    leg.tibia.style.transform = `translateX(${leg.len.femur}px) rotateZ(${112 + 10 * step - 60 * a + wave * 8}deg)`;
    leg.tarsus.style.transform = `translateX(${leg.len.tibia}px) rotateZ(${26 - 11 * a + wave * 22}deg)`;
  });

  palps.forEach(({ side, root, a, b, c }) => {
    const wiggle = Math.sin(time * 3 + side) * 8 * motion;
    const localYaw = -90 + 28;
    root.style.transform = `${translate(side * 13, 6, 38)} rotateY(${side === 1 ? localYaw : 180 - localYaw}deg)`;
    a.style.transform = `rotateZ(${-20 + wiggle}deg)`;
    b.style.transform = `translateX(16px) rotateZ(${55 - wiggle}deg)`;
    c.style.transform = `translateX(22px) rotateZ(${35 + wiggle * 0.5}deg)`;
  });

  fangs.forEach(({ side, base, tip }) => {
    const chew = Math.max(0, Math.sin(time * 2.2)) * 10 * motion;
    base.style.transform = `rotateZ(${70 + chew}deg) rotateX(${side * 10}deg)`;
    tip.style.transform = `translateX(16px) rotateZ(${45 + chew}deg)`;
  });

  // Leitura das posições projetadas (um único layout por frame).
  const origin = stage.getBoundingClientRect();
  const center = centerOf(centerMarker, origin);
  const pivot = centerOf(pivotMarker, origin);
  const anchor = centerOf(anchorMarker, origin);
  const tips = legs.map((leg) => centerOf(leg.tip, origin));

  thread.setAttribute('x1', pivot.x);
  thread.setAttribute('y1', pivot.y);
  thread.setAttribute('x2', anchor.x);
  thread.setAttribute('y2', anchor.y);

  const yawRad = (yaw + w.heading) * DEG;
  const items = legs.map((leg, i) => {
    const tip = tips[i];
    let dx = tip.x - center.x;
    let dy = tip.y - center.y;
    const dist = Math.hypot(dx, dy) || 1;
    dx /= dist;
    dy /= dist;

    const theta = leg.yaw * DEG;
    const depth = -Math.cos(theta) * Math.sin(yawRad) - Math.sin(theta) * Math.cos(yawRad);

    return {
      leg,
      tip,
      depth,
      w: leg.w,
      h: leg.h,
      x: tip.x + dx * (28 + leg.w * 0.35),
      y: tip.y + dy * 26
    };
  });

  relaxLabels(items);

  items.forEach(({ leg, tip, depth, w, h, x, y }, i) => {
    const tx = clamp(x, w / 2 + 4, origin.width - w / 2 - 4);
    const ty = clamp(y, h / 2 + 4, origin.height - h / 2 - 30);
    leg.lx = leg.lx === null ? tx : leg.lx + (tx - leg.lx) * Math.min(1, 0.35 * dt);
    leg.ly = leg.ly === null ? ty : leg.ly + (ty - leg.ly) * Math.min(1, 0.35 * dt);

    const isActive = i === state.active;
    const scale = isActive ? 1.08 : 0.88 + (depth + 1) * 0.05;
    leg.label.style.transform = `translate(${leg.lx}px, ${leg.ly}px) translate(-50%, -50%) scale(${scale})`;
    leg.label.style.opacity = isActive ? '1' : String(0.5 + (depth + 1) * 0.22);
    leg.label.style.zIndex = isActive ? '50' : String(Math.round(20 + depth * 10));

    leg.connector.setAttribute('d', `M${tip.x} ${tip.y}L${leg.lx} ${leg.ly}`);
    leg.tipDot.setAttribute('cx', tip.x);
    leg.tipDot.setAttribute('cy', tip.y);
    leg.tipPulse.setAttribute('cx', tip.x);
    leg.tipPulse.setAttribute('cy', tip.y);
  });

  requestAnimationFrame(frame);
};

requestAnimationFrame(frame);
