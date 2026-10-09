/* Authored water/building/window/line layers + symbolic people.
   All motion is a pure function of scroll progress: reverse scrolling rebuilds
   the exact artwork, without a running physics simulation or random refreshes. */
function createNepalFloodSequence(camera) {
  'use strict';
  const artwork = camera.querySelector('#nepal-mountain-artwork');
  const root = artwork && artwork.querySelector('#nepal-glacier-mountain');
  if (!root) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const unit = Number(camera.dataset.artworkUnitsPerScene) || 1;
  const width = artwork.viewBox.baseVal.width;
  const TIMING = {
    settlement: [.51, .61], people: [.54, .64],
    floodStart: .62, floodDuration: .31,
    impactEnd: .99
  };
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const range = (p, a, b) => clamp((p - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);
  const random = (seed) => { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const make = (tag, attrs = {}) => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };
  function wrap(node, className) {
    const group = make('g', { class: className });
    node.before(group);
    group.append(node);
    node.style.opacity = '1';
    return group;
  }
  // Extra transforms belong on wrappers: retain every rotation authored in SVG.
  const waters = [...root.querySelectorAll('[id^="water-"]')].map((node, i) => {
    const group = wrap(node, 'nepal-water-motion');
    const box = group.getBBox();
    return {
      node: group, box, start: TIMING.floodStart + i * .009,
      duration: TIMING.floodDuration + (i % 2) * .025,
      drop: (205 + i * 16) * unit,
      drift: [-25, -48, 28, 46, 62][i % 5] * unit,
      centerX: box.x + box.width / 2
    };
  });
  const settlementNodes = [...root.querySelectorAll('[id^="building-"], [id^="window-"], [id^="line-"]')];
  const ground = Math.max(...settlementNodes.map((node) => { const b = node.getBBox(); return b.y + b.height; }), artwork.viewBox.baseVal.height);
  // A loose, staggered distribution under the buildings, like the reference.
  // These dots are illustrative people, not a count of casualties.
  const peoplePositions = [
    [.05, 38], [.11, 64], [.20, 39], [.27, 55], [.38, 36], [.46, 60],
    [.55, 49], [.63, 38], [.73, 42], [.84, 59], [.94, 44],
    [.20, 105], [.32, 91], [.43, 102], [.67, 96], [.78, 84], [.92, 96]
  ];
  const peopleLayer = make('g', { id: 'nepal-people', 'aria-hidden': 'true' });
  root.append(peopleLayer);

  function arrival(box) {
    const x = box.x + box.width / 2;
    // When the descending flood front reaches this height, with a short lateral
    // spread to the outer houses. This ties breakup order to flood travel.
    const hits = waters.map((water) => {
      const frontStart = water.box.y + water.box.height - 35 * unit;
      const descent = range(box.y, frontStart, frontStart + water.drop);
      const sideDistance = Math.max(0, Math.abs(x - water.centerX) - (water.box.width + box.width) / 2);
      return water.start + descent * water.duration + sideDistance / (3200 * unit);
    });
    return Math.max(.74, Math.min(.92, hits.length ? Math.min(...hits) : .82));
  }
  function fragment(node, seed) {
    const box = node.getBBox();
    const style = getComputedStyle(node);
    const fragments = [];
    // Walls, roofs and poles fracture; the smaller windows separate whole.
    if (node.tagName.toLowerCase() === 'rect' && (box.width > 75 || box.height > 110)) {
      const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]];
      const hub = [box.x + box.width * (.38 + random(seed) * .24), box.y + box.height * (.35 + random(seed + 1) * .3)];
      corners.forEach((corner, i) => {
        const next = corners[(i + 1) % 4];
        fragments.push(make('path', { d: `M${corner} L${next} L${hub}Z`, fill: style.fill }));
      });
    } else if (node.id.startsWith('line-')) {
      const length = node.getTotalLength();
      for (let i = 0; i < 5; i++) {
        const points = Array.from({length: 7}, (_, j) => node.getPointAtLength(length * (i + j / 6) / 5));
        fragments.push(make('path', { d: 'M' + points.map((p) => `${p.x},${p.y}`).join('L'), fill: 'none', stroke: style.stroke, 'stroke-width': style.strokeWidth }));
      }
    }
    return fragments;
  }
  function motion(piece, box, impact, seed, person = false) {
    const direction = random(seed) < .5 ? -1 : 1;
    return {
      node: piece, x: box.x + box.width / 2, y: box.y + box.height / 2,
      start: Math.min(.94, impact + random(seed + 2) * .013),
      dx: direction * (person ? 45 + random(seed + 3) * 90 : 28 + random(seed + 3) * 115) * unit,
      kick: (person ? 30 + random(seed + 4) * 40 : 20 + random(seed + 4) * 50) * unit,
      gravity: (person ? 45 + random(seed + 5) * 25 : 65 + random(seed + 5) * 60) * unit,
      turn: person ? 0 : direction * (28 + random(seed + 6) * 125)
    };
  }
  const buildings = settlementNodes.map((node, i) => {
    const group = wrap(node, 'nepal-impact-piece');
    const box = group.getBBox();
    const impact = arrival(box);
    const shards = fragment(node, i + 1);
    const shardsGroup = make('g', { class: 'nepal-building-fragments' });
    group.append(shardsGroup);
    shards.forEach((piece) => shardsGroup.append(piece));
    const motions = shards.map((piece, j) => motion(piece, piece.getBBox(), impact, i * 7 + j + 1));
    return { group, original: node, shardsGroup, motions, impact, whole: motion(node, box, impact, i * 7 + 1) };
  });
  const people = peoplePositions.map(([x, y], i) => {
    const node = make('circle', { class: 'nepal-person', cx: x * width, cy: ground + y * unit, r: 12 * unit, fill: 'var(--color-pink)' });
    peopleLayer.append(node);
    const box = node.getBBox();
    return motion(node, box, Math.max(.84, arrival(box)), 500 + i * 11, true);
  });
  function move(piece, p) {
    const t = range(p, piece.start, TIMING.impactEnd);
    // Initial kick, tumbling and downward acceleration, all scrubbed by scroll.
    const dx = piece.dx * t;
    const dy = -piece.kick * t + piece.gravity * t * t;
    piece.node.setAttribute('transform', `translate(${dx} ${dy}) rotate(${piece.turn * t} ${piece.x} ${piece.y})`);
  }
  function update(p) {
    const visible = smooth(range(p, ...TIMING.settlement));
    buildings.forEach((building) => {
      building.group.style.opacity = String(visible);
      const broken = p > building.impact && building.motions.length > 0;
      building.original.style.visibility = broken ? 'hidden' : 'visible';
      building.shardsGroup.style.visibility = broken ? 'visible' : 'hidden';
      if (building.motions.length) building.motions.forEach((piece) => move(piece, p));
      else move(building.whole, p);
    });
    peopleLayer.style.opacity = String(smooth(range(p, ...TIMING.people)));
    people.forEach((piece) => move(piece, p));
    waters.forEach((water) => {
      const t = range(p, water.start, water.start + water.duration);
      water.node.style.opacity = String(smooth(range(p, water.start, water.start + .04)) * (1 - .65 * smooth(range(p, .94, 1))));
      water.node.setAttribute('transform', `translate(${water.drift * t} ${-35 * unit + water.drop * t})`);
    });
    root.dataset.floodProgress = range(p, TIMING.floodStart, .99).toFixed(3);
    root.dataset.brokenParts = String(buildings.filter((building) => p > building.impact).length);
  }
  update(0);
  return { update, groundY: ground };
}
