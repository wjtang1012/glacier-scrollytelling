/* Supplementary sketch interactions only. The completed warming chart is untouched. */
(() => {
  'use strict';
  const retreat = document.getElementById('consequences');
  const nepal = document.getElementById('nepal');
  const retreatStage = retreat && retreat.querySelector('.retreat-stage');
  if (!retreat || !nepal) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const range = (p, a, b) => clamp((p - a) / (b - a));
  const smooth = (p) => p * p * (3 - 2 * p);
  // 每次刷新，冰块总数在 min 和 max 之间随机（含两端）。改这两个数字即可。
  const ICE_COUNT = {
    min: 35,
    max: 50
  };
  // 从原来的顶部均匀排到再往下 depth 屏，整组用同一段距离一起上升。
  const ICE_TAIL = {
    depth: 1.5
  };
  // 第三部分收尾之后，最小的冰块继续铺在地图页背景上。
  // 每次刷新，数量在 min 和 max 之间随机。
  const MAP_ICE_COUNT = {
    min: 30,
    max: 50
  };
  // Share of the rise that happens during the pinned tail, after the shapes are small.
  const RISE_TAIL_SHARE = 0.1;
  const ICE_FRAME_HEIGHT = 730;
  const rand = (min, max) => min + Math.random() * (max - min);
  function icePolygon(radius) {
    const sides = 5 + (Math.random() < .55 ? 1 : 0);
    const spin = rand(0, Math.PI * 2);
    const points = [];
    for (let i = 0; i < sides; i += 1) {
      const angle = spin + (i / sides) * Math.PI * 2 + rand(-.28, .28);
      const r = radius * rand(.62, 1.18);
      points.push(`${(Math.cos(angle) * r).toFixed(1)},${(Math.sin(angle) * r).toFixed(1)}`);
    }
    return points.join(' ');
  }
  function spreadEvenly(count, bounds) {
    const y1 = bounds.y1 + ICE_FRAME_HEIGHT * Math.max(0, ICE_TAIL.depth);
    const height = Math.max(1, y1 - bounds.y0);
    const width = Math.max(1, bounds.x1 - bounds.x0);
    const cols = Math.max(1, Math.round(Math.sqrt(count * width / height)));
    const rows = Math.ceil(count / cols);
    const spots = [];
    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      const rowCount = Math.min(cols, count - index);
      for (let col = 0; col < rowCount; col += 1) {
        spots.push({
          x: bounds.x0 + (col + rand(.18, .82)) * (width / rowCount),
          y: bounds.y0 + (row + rand(.18, .82)) * (height / rows)
        });
        index += 1;
      }
    }
    return spots;
  }
  function appendFloe(svg, depth, spot) {
    const front = depth === 'front';
    const roll = Math.random();
    const radius = roll < .18
      ? rand(7, 16)
      : roll < .42
        ? rand(front ? 48 : 36, front ? 110 : 78)
        : rand(front ? 130 : 70, front ? 230 : 165);
    const dotScale = radius < 22 ? rand(.16, .46) : radius < 90 ? rand(.028, .07) : rand(.011, .032);
    const host = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    host.setAttribute('transform', `translate(${spot.x.toFixed(0)} ${spot.y.toFixed(0)})`);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'retreat-floe');
    // One shared distance, so the whole field keeps its spacing while it rises.
    group.dataset.rise = (ICE_FRAME_HEIGHT * Math.max(0, ICE_TAIL.depth) / 2.3).toFixed(1);
    group.dataset.drift = rand(-15.5, 15.5).toFixed(1);
    group.dataset.delay = rand(.002, .09).toFixed(3);
    group.dataset.turn = rand(-11, 11).toFixed(1);
    group.dataset.dotScale = dotScale.toFixed(5);
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('class', 'retreat-ice');
    polygon.setAttribute('points', icePolygon(radius));
    group.append(polygon);
    host.append(group);
    svg.append(host);
  }
  function buildRetreatIce() {
    const back = retreat.querySelector('.retreat-art-back');
    const front = retreat.querySelector('.retreat-art-front');
    const least = Math.max(1, Math.round(Math.min(ICE_COUNT.min, ICE_COUNT.max)));
    const most = Math.max(least, Math.round(Math.max(ICE_COUNT.min, ICE_COUNT.max)));
    const total = least + Math.floor(Math.random() * (most - least + 1));
    const frontCount = total < 2 ? total : Math.max(1, Math.round(total * .55));
    const backCount = total - frontCount;
    back.replaceChildren();
    front.replaceChildren();
    spreadEvenly(backCount, { x0: 70, x1: 1030, y0: 90, y1: 680 }).forEach((spot) => appendFloe(back, 'back', spot));
    spreadEvenly(frontCount, { x0: 40, x1: 1060, y0: 80, y1: 780 }).forEach((spot) => appendFloe(front, 'front', spot));
  }
  buildRetreatIce();
  const mapSection = document.getElementById('global-retreat');
  const mapIceSvg = mapSection && mapSection.querySelector('.map-ice');
  const mapIceField = mapIceSvg && document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const mapIce = [];
  if (mapIceSvg && mapIceField) {
    const least = Math.max(1, Math.round(Math.min(MAP_ICE_COUNT.min, MAP_ICE_COUNT.max)));
    const most = Math.max(least, Math.round(Math.max(MAP_ICE_COUNT.min, MAP_ICE_COUNT.max)));
    const total = least + Math.floor(Math.random() * (most - least + 1));
    mapIceSvg.append(mapIceField);
    for (let index = 0; index < total; index += 1) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('class', 'map-ice-shape');
      polygon.setAttribute('points', icePolygon(1));
      group.append(polygon);
      mapIceField.append(group);
      mapIce.push({
        group,
        polygon,
        jx: rand(.18, .82),
        jy: rand(.18, .82),
        turn: rand(-110, 110),
        radiusUnits: rand(1.6, 7.2)
      });
    }
  }
  function mapIceUnit() {
    const art = retreat.querySelector('.retreat-art-back');
    const rect = art ? art.getBoundingClientRect() : { width: 0, height: 0 };
    const scale = Math.max(rect.width / 1100, rect.height / ICE_FRAME_HEIGHT);
    return scale || window.innerHeight / ICE_FRAME_HEIGHT;
  }
  // Same on-screen speed as the slow rise after the retreat shapes have shrunk.
  function iceContinueRate() {
    const stageHeight = retreatStage.getBoundingClientRect().height || window.innerHeight;
    const tailScreens = Number(getComputedStyle(retreat).getPropertyValue('--retreat-tail-screens')) || 1.05;
    const tailDistance = Math.max(1, tailScreens * stageHeight);
    const tailRise = ICE_FRAME_HEIGHT * Math.max(0, ICE_TAIL.depth) * RISE_TAIL_SHARE * mapIceUnit();
    return tailRise / tailDistance;
  }
  function layoutMapIce() {
    if (!mapIceSvg || !mapIce.length) return;
    const width = mapSection.clientWidth;
    const height = mapSection.clientHeight;
    if (width < 2 || height < 2) return;
    const spreadHeight = height + (height + window.innerHeight) * iceContinueRate();
    mapIceSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const cols = Math.max(1, Math.round(Math.sqrt(mapIce.length * width / spreadHeight)));
    const rows = Math.ceil(mapIce.length / cols);
    const unit = mapIceUnit();
    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      const rowCount = Math.min(cols, mapIce.length - index);
      for (let col = 0; col < rowCount; col += 1) {
        const spot = mapIce[index];
        const x = (col + spot.jx) * (width / rowCount);
        const y = (row + spot.jy) * (spreadHeight / rows);
        spot.group.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        spot.polygon.setAttribute('transform', `rotate(${spot.turn.toFixed(1)}) scale(${(spot.radiusUnits * unit).toFixed(2)})`);
        index += 1;
      }
    }
  }
  function updateMapIce() {
    if (!mapIceField) return;
    if (motion.matches) {
      mapIceField.setAttribute('transform', 'translate(0 0)');
      return;
    }
    const bounds = mapSection.getBoundingClientRect();
    const traveled = window.innerHeight - bounds.top;
    const rise = Math.max(0, traveled) * iceContinueRate();
    mapIceField.setAttribute('transform', `translate(0 ${(-rise).toFixed(1)})`);
  }
  layoutMapIce();
  const ice = [...retreat.querySelectorAll('.retreat-floe')].map((group) => ({
    group,
    polygon: group.querySelector('.retreat-ice'),
    // Shared travel. High pieces may leave the top so the lower ones can rise with them.
    rise: Number(group.dataset.rise) * 2.3,
    drift: Number(group.dataset.drift),
    delay: Number(group.dataset.delay),
    turn: Number(group.dataset.turn),
    dotScale: Number(group.dataset.dotScale),
    homeX: 0, homeY: 0, homeTurn: 0, homeScale: 1,
    body: { x: 0, y: 0, vx: 0, vy: 0 }
  }));
  // Degrees of rotation at full spin for a data-turn of 1.
  // Each floe's data-turn keeps its own direction and relative amount.
  const floeTurnScale = 10;
  const words = [...retreat.querySelectorAll('.retreat-words li')];
  const retreatHeading = retreat.querySelector('h2');
  const map = document.getElementById('nepal-map-layer');
  const mountain = document.getElementById('nepal-mountain-layer');
  const camera = document.getElementById('nepal-mountain-camera');
  const fallingIce = document.getElementById('nepal-ice');
  const rocks = [...nepal.querySelectorAll('.falling-rock')];
  const village = document.getElementById('nepal-village-layer');
  const pieces = [...nepal.querySelectorAll('.village-piece')];
  const stories = [...nepal.querySelectorAll('.nepal-story')];
  const progressMarks = [...nepal.querySelectorAll('.nepal-progress i')];
  // Five reading chapters, aligned with the existing illustration sequence.
  const nepalChapters = [
    { id: 'nepal', start: 0 },
    { id: 'mountain', start: .25 },
    { id: 'collapse', start: .46 },
    { id: 'flood', start: .68 },
    { id: 'disaster', start: .84 }
  ];
  document.documentElement.classList.add('sketch-motion');

  function localProgress(section) {
    const bounds = section.getBoundingClientRect();
    // Use the actual sticky height, so mobile browser chrome does not alter the stages.
    const stageHeight = section.firstElementChild.getBoundingClientRect().height;
    return clamp(-bounds.top / Math.max(1, bounds.height - stageHeight));
  }
  function updateRetreat(p, tail = 0) {
    // Start tinting the visible part on entry instead of hiding the gradient below
    // the viewport. Keep the user's final blue 0% / brown 40% composition.
    const ground = smooth(p);
    retreatStage.style.setProperty('--retreat-tint', String(smooth(range(p, 0, .25))));
    retreatStage.style.setProperty('--retreat-blue-stop', `${20 - 20 * ground}%`);
    retreatStage.style.setProperty('--retreat-brown-stop', `${110 - 70 * ground}%`);
    // Keep moving throughout the pinned tail, after text, gradient and scale settle.
    // Linear scroll tracking avoids the old near-zero speed at the end of smooth(p).
    const riseProgress = (1 - RISE_TAIL_SHARE) * p + RISE_TAIL_SHARE * tail;
    ice.forEach((floe) => {
      // Front pieces rise farther/faster; back pieces drift gently behind the text.
      // Separate translation from scaling so the final dots stay scattered in view.
      const shrink = smooth(range(p, floe.delay, .99));
      const scale = 1 + (floe.dotScale - 1) * shrink;
      // data-turn is each shape's own direction and amount. Most of the turn
      // happens while the floe is still large enough to read, then eases out.
      const spin = smooth(range(p, floe.delay, .68));
      floe.homeX = floe.drift * riseProgress;
      floe.homeY = -floe.rise * riseProgress;
      floe.homeTurn = floe.turn * floeTurnScale * spin;
      floe.homeScale = scale;
      paintFloe(floe);
    });
    const titleProgress = smooth(range(p, .1, .43));
    retreatHeading.style.opacity = String(titleProgress);
    retreatHeading.style.transform = `translateY(${60 * (1 - titleProgress)}px)`;
    words.forEach((word, index) => {
      const t = smooth(range(p, .2 + index * .07, .56 + index * .07));
      word.style.opacity = String(t);
      word.style.transform = `translateY(${100 * (1 - t)}px)`;
    });
  }
  function updateNepal(p) {
    const zoomMap = smooth(range(p, 0, .22));
    const approach = smooth(range(p, .2, .43));
    const fall = range(p, .46, .82);
    const pullBack = smooth(range(p, .68, .89));
    const collision = range(p, .83, .98);
    map.setAttribute('transform', `translate(340 400) scale(${1 + zoomMap * 2.7}) translate(-340 -400)`);
    map.style.opacity = String(1 - range(p, .18, .29));
    // The morph controller owns visibility while the triangle becomes the mountain.
    if (mountain.dataset.morphManaged !== 'true') mountain.style.opacity = String(range(p, .21, .32));
    const scale = .76 + approach * .59 - pullBack * .35;
    camera.setAttribute('transform', `translate(300 ${300 - pullBack * 50}) scale(${scale}) translate(-300 -300)`);
    fallingIce.setAttribute('transform', `translate(${fall * 18} ${fall * fall * 230}) rotate(${fall * 9} 245 380)`);
    rocks.forEach((rock, i) => {
      const t = range(p, .47 + (i % 3) * .025, .85);
      rock.setAttribute('transform', `translate(${(i % 2 ? 1 : -1) * t * (25 + i * 8)} ${t * t * (245 - i * 17)}) rotate(${(i % 2 ? 1 : -1) * t * 32} ${250 + i * 20} 400)`);
    });
    village.style.opacity = String(range(p, .64, .79));
    pieces.forEach((piece, i) => {
      const direction = i % 2 ? 1 : -1;
      const dx = direction * collision * (30 + (i % 5) * 17);
      const dy = -Math.sin(collision * Math.PI) * (15 + (i % 4) * 10) + collision * collision * 35;
      piece.style.transformBox = 'fill-box';
      piece.style.transformOrigin = 'center';
      piece.style.transform = `translate(${dx}px, ${dy}px) rotate(${direction * collision * (10 + (i % 4) * 9)}deg)`;
    });
    const active = nepalChapters.reduce((current, chapter, i) => p >= chapter.start ? i : current, 0);
    nepal.dataset.activeStep = nepalChapters[active].id;
    stories.forEach((story, i) => {
      const start = nepalChapters[i].start;
      const next = nepalChapters[i + 1];
      const entrance = i === 0 ? 1 : smooth(range(p, start - .015, start + .045));
      const leave = next ? smooth(range(p, next.start - .055, next.start + .005)) : 0;
      const opacity = entrance * (1 - leave);
      story.style.opacity = String(opacity);
      story.style.transform = `translateY(${(1 - entrance) * 65 - leave * 45}px)`;
      story.style.visibility = opacity < .005 ? 'hidden' : 'visible';
    });
    progressMarks.forEach((mark, i) => mark.classList.toggle('is-active', i === active));
  }
  function render() {
    if (motion.matches) {
      updateRetreat(1, 1);
      updateMapIce();
      updateNepal(.95);
      stories.forEach((story) => { story.style.visibility = 'visible'; });
      return;
    }
    // Begin when this section enters the viewport, not only after it pins at top.
    const bounds = retreat.getBoundingClientRect();
    const entryHeight = Math.min(window.innerHeight, retreatStage.getBoundingClientRect().height);
    const tailScreens = Number(getComputedStyle(retreat).getPropertyValue('--retreat-tail-screens'));
    const tailDistance = Math.max(0, tailScreens * entryHeight);
    const narrativeDistance = Math.max(1, bounds.height - tailDistance);
    const traveled = entryHeight - bounds.top;
    updateRetreat(clamp(traveled / narrativeDistance),
      tailDistance > 0 ? clamp((traveled - narrativeDistance) / tailDistance) : 1);
    updateMapIce();
    updateNepal(localProgress(nepal));
  }
  let frame = 0;
  function requestRender() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  }
  // 悬停与碰撞参数：只影响鼠标互动，不改变原来的 scroll 数值。
  const ICE_HOVER = {
    pushDistance: 200,       // 悬停推开的距离（SVG 单位）
    stiffness: 80,         // 轻推/回位的弹力
    damping: 12,           // 阻力：越大越快停下来
    restitution: .88,      // 同层碰撞的弹性（0–1）
    collisionStrength: .95 // 接触后分开的力度（0–1）
  };
  let springFrame = 0;
  let springLastTime = 0;
  let hovered = null;
  const layerBodies = ['back', 'front'].map((depth) =>
    ice.filter((floe) => floe.group.ownerSVGElement.dataset.depth === depth));
  const polygonBodies = new Map(ice.map((floe) => [floe.polygon, floe]));
  ice.forEach((floe) => {
    const origin = floe.group.parentElement.transform.baseVal.getItem(0).matrix;
    floe.origin = { x: origin.e, y: origin.f };
    floe.vertices = [...floe.polygon.points].map(({ x, y }) => ({ x, y }));
  });

  function paintFloe(floe) {
    const b = floe.body;
    floe.group.setAttribute('transform', `translate(${floe.homeX + b.x} ${floe.homeY + b.y})`);
    floe.polygon.setAttribute('transform', `rotate(${floe.homeTurn}) scale(${floe.homeScale})`);
  }

  function homeVertices(floe) {
    const angle = floe.homeTurn * Math.PI / 180;
    const c = Math.cos(angle) * floe.homeScale;
    const s = Math.sin(angle) * floe.homeScale;
    return floe.vertices.map(({ x, y }) => ({
      x: floe.origin.x + floe.homeX + x * c - y * s,
      y: floe.origin.y + floe.homeY + x * s + y * c
    }));
  }

  function project(vertices, axis, offset) {
    let min = Infinity, max = -Infinity;
    const shift = offset.x * axis.x + offset.y * axis.y;
    vertices.forEach((v) => {
      const dot = v.x * axis.x + v.y * axis.y + shift;
      min = Math.min(min, dot); max = Math.max(max, dot);
    });
    return { min, max };
  }

  // SAT checks the actual polygon edges; front and back are never paired.
  // Existing overlap in the illustration is allowed, so only extra penetration
  // from the hover displacement transfers force to another floe.
  function contact(a, b, av, bv) {
    let depth = Infinity, normal = null;
    const zero = { x: 0, y: 0 };
    const axes = [av, bv].flatMap((vertices) => vertices.map((v, i) => {
      const next = vertices[(i + 1) % vertices.length];
      const length = Math.hypot(next.x - v.x, next.y - v.y);
      return length < .0001 ? null : { x: -(next.y - v.y) / length, y: (next.x - v.x) / length };
    })).filter(Boolean);
    const baseline = Math.max(0, Math.min(...axes.map((axis) => {
      const ah = project(av, axis, zero), bh = project(bv, axis, zero);
      return Math.min(ah.max - bh.min, bh.max - ah.min);
    })));
    for (const axis of axes) {
      const ap = project(av, axis, a.body), bp = project(bv, axis, b.body);
      const extra = Math.min(ap.max - bp.min, bp.max - ap.min) - baseline;
      if (extra <= .02) return null;
      if (extra < depth) {
        depth = extra;
        const direction = (ap.min + ap.max) < (bp.min + bp.max) ? 1 : -1;
        normal = { x: axis.x * direction, y: axis.y * direction };
      }
    }
    return normal ? { depth, normal } : null;
  }

  function collideLayer(bodies, geometry) {
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const a = bodies[i], b = bodies[j];
        const hit = contact(a, b, geometry.get(a), geometry.get(b));
        if (!hit) continue;
        const { depth, normal: n } = hit;
        const correction = depth * ICE_HOVER.collisionStrength * .5;
        a.body.x -= n.x * correction; a.body.y -= n.y * correction;
        b.body.x += n.x * correction; b.body.y += n.y * correction;
        const closing = (b.body.vx - a.body.vx) * n.x + (b.body.vy - a.body.vy) * n.y;
        if (closing < 0) {
          const impulse = -(1 + ICE_HOVER.restitution) * closing * .5;
          a.body.vx -= impulse * n.x; a.body.vy -= impulse * n.y;
          b.body.vx += impulse * n.x; b.body.vy += impulse * n.y;
        }
      }
    }
  }

  function requestSpring() {
    if (springFrame) return;
    springLastTime = performance.now();
    springFrame = requestAnimationFrame(stepSpring);
  }

  function stepSpring(time) {
    springFrame = 0;
    const dt = Math.min(1 / 30, Math.max(0, (time - springLastTime) / 1000));
    springLastTime = time;
    if (motion.matches) {
      hovered = null;
      ice.forEach((floe) => {
        Object.assign(floe.body, { x: 0, y: 0, vx: 0, vy: 0 });
        paintFloe(floe);
      });
      return;
    }
    const geometry = new Map(ice.map((floe) => [floe, homeVertices(floe)]));
    const previous = ice.map((floe) => ({ x: floe.body.x, y: floe.body.y }));
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (let step = 0; step < steps; step += 1) {
      ice.forEach((floe) => {
        const b = floe.body;
        const target = hovered && hovered.floe === floe ? hovered : { x: 0, y: 0 };
        b.vx += ((target.x - b.x) * ICE_HOVER.stiffness - b.vx * ICE_HOVER.damping) * h;
        b.vy += ((target.y - b.y) * ICE_HOVER.stiffness - b.vy * ICE_HOVER.damping) * h;
        b.x += b.vx * h; b.y += b.vy * h;
      });
      layerBodies.forEach((bodies) => collideLayer(bodies, geometry));
    }
    let moving = Boolean(hovered);
    ice.forEach((floe, index) => {
      const b = floe.body;
      if (!hovered && Math.hypot(b.x, b.y) < .08 && Math.hypot(b.vx, b.vy) < .12) {
        b.x = b.y = b.vx = b.vy = 0;
      }
      moving = moving || Math.hypot(b.x - previous[index].x, b.y - previous[index].y) > .005
        || Math.hypot(b.vx, b.vy) > .12 || Math.hypot(b.x, b.y) > .08;
      paintFloe(floe);
    });
    if (moving) springFrame = requestAnimationFrame(stepSpring);
  }

  function clearHover() {
    if (!hovered) return;
    hovered = null;
    requestSpring();
  }
  retreatStage.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || motion.matches) return;
    const floe = polygonBodies.get(event.target);
    // Hold the gentle offset while the pointer is still. The fleeing polygon
    // must not repeatedly trigger pointerenter/leave and jitter under the cursor.
    if (hovered && Math.hypot(event.clientX - hovered.clientX, event.clientY - hovered.clientY) < 24) return;
    if (!floe) { clearHover(); return; }
    const matrix = floe.group.parentElement.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    let dx = floe.homeX + floe.body.x - point.x;
    let dy = floe.homeY + floe.body.y - point.y;
    if (Math.hypot(dx, dy) < 1) { dx = 0; dy = -1; }
    const length = Math.hypot(dx, dy);
    // Small dots get a smaller nudge as the scroll animation ends.
    const distance = ICE_HOVER.pushDistance * Math.max(.15, Math.sqrt(floe.homeScale));
    hovered = { floe, clientX: event.clientX, clientY: event.clientY,
      x: dx / length * distance, y: dy / length * distance };
    requestSpring();
  }, { passive: true });
  retreatStage.addEventListener('pointerleave', clearHover);
  retreatStage.addEventListener('pointercancel', clearHover);
  window.addEventListener('blur', clearHover);
  window.addEventListener('scroll', clearHover, { passive: true });
  window.addEventListener('resize', clearHover);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearHover(); });
  motion.addEventListener('change', () => { clearHover(); requestSpring(); });

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', () => { layoutMapIce(); requestRender(); });
  if (mapSection && window.ResizeObserver) {
    const mapIceObserver = new ResizeObserver(() => { layoutMapIce(); requestRender(); });
    mapIceObserver.observe(mapSection);
  }
  motion.addEventListener('change', requestRender);
  render();

  const impactDetail = document.getElementById('impact-detail');
  const defaultImpactText = impactDetail.textContent;
  document.querySelectorAll('.impact-mark').forEach((mark) => {
    const show = () => { impactDetail.textContent = `${mark.dataset.impact} · count, account & source pending`; };
    const reset = () => { impactDetail.textContent = defaultImpactText; };
    mark.addEventListener('pointerenter', show);
    mark.addEventListener('pointerleave', reset);
    mark.addEventListener('focus', show);
    mark.addEventListener('blur', reset);
    mark.addEventListener('click', show);
  });
})();
