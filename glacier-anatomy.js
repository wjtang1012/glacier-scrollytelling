/* Anatomy copy adapted from NSIDC Science of Glaciers / Why Glaciers Matter:
   https://nsidc.org/learn/parts-cryosphere/glaciers/science-glaciers
   https://nsidc.org/learn/parts-cryosphere/glaciers/why-glaciers-matter
   Rock-debris terminology: https://pubs.usgs.gov/of/2004/1216/text.html */
(() => {
  'use strict';
  const figure = document.querySelector('.hero-anatomy');
  if (!figure) return;
  const map = figure.querySelector('.hero-anatomy-map');
  const artwork = figure.querySelector('.hero-mountain-art');
  const card = figure.querySelector('.anatomy-annotation');
  const leader = figure.querySelector('.hero-anatomy-leader');
  const points = [...figure.querySelectorAll('.anatomy-point')];
  const PARTS = {
    accumulation: {
      name: 'Accumulation Area',
      text: 'High on the glacier, more snow collects than melts each year. Over time, the buried snow compresses into glacier ice.'
    },
    ablation: {
      name: 'Ablation Area',
      text: 'Lower down, the glacier loses more snow and ice than it gains. Most of this loss happens through melting.'
    },
    moraines: {
      name: 'Moraines',
      text: 'Rock and sediment carried and deposited by a glacier. These deposits can build up along its sides or at its end.'
    },
    terminus: {
      name: 'Terminus',
      text: 'The lower end of the glacier, also called its snout. Its position retreats when ice loss outpaces the supply of ice flowing downhill.'
    },
    lake: {
      name: 'Glacial Lake',
      text: 'Meltwater can collect in a basin near the glacier’s end. As the ice retreats, this lake can grow.'
    }
  };
  let active = points[0];
  function positionCard() {
    if (window.matchMedia('(max-width: 600px)').matches) return;
    // Work in the artwork's unscaled coordinates: the outer camera scales
    // image, markers, card and connector together throughout the reveal.
    const bounds = { width: map.clientWidth, height: map.clientHeight };
    const x = parseFloat(active.style.getPropertyValue('--point-x')) / 100 * bounds.width;
    const y = parseFloat(active.style.getPropertyValue('--point-y')) / 100 * bounds.height;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const left = Math.max(12, Math.min(x - width / 2, bounds.width - width - 12));
    const top = Math.max(12, y - height - Math.max(45, bounds.width * .065));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    leader.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const anchorX = Math.max(left + 16, Math.min(x, left + width - 16));
    leader.querySelector('path').setAttribute('d', `M${x} ${y}L${anchorX} ${top + height}`);
  }
  function select(point) {
    active = point;
    const info = PARTS[point.dataset.part];
    card.querySelector('h3').textContent = info.name;
    card.querySelector('p').textContent = info.text;
    points.forEach((item) => {
      const selected = item === point;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    positionCard();
  }
  points.forEach((point) => {
    point.addEventListener('pointerenter', () => select(point));
    point.addEventListener('focus', () => select(point));
    point.addEventListener('click', () => select(point));
  });
  const hero = document.getElementById('hero');
  const title = document.getElementById('hero-title');
  const subtitle = hero.querySelector('.hero-anatomy-copy');
  const hint = hero.querySelector('.hero-bottom');
  const pointLayer = figure.querySelector('.hero-anatomy-points');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Hero tuning: scroll distance, initial zoom, and summit position in the viewport.
  const REVEAL = { scrollScreens: 1.5, startScale: 1.75, summitX: .87, summitY: .46 };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const phase = (p, a, b) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };
  let revealDistance = 1;
  let artTop = 140;
  let scheduled = 0;
  let wasOpening = true;
  function renderReveal() {
    scheduled = 0;
    if (reducedMotion.matches) return;
    const p = clamp(-hero.getBoundingClientRect().top / revealDistance);
    const reveal = phase(p, 0, 1);
    const scale = REVEAL.startScale + (1 - REVEAL.startScale) * reveal;
    // The highest summit is x=682.66 in the authored SVG's 1284.51 viewBox.
    const startX = hero.clientWidth * REVEAL.summitX - figure.offsetLeft - figure.offsetWidth * (682.66 / 1284.51) * REVEAL.startScale;
    const startY = window.innerHeight * REVEAL.summitY - artTop;
    figure.style.transform = `translate(${startX * (1 - reveal)}px, ${startY * (1 - reveal)}px) scale(${scale})`;
    title.style.opacity = String(1 - phase(p, .04, .43));
    hint.style.opacity = String(1 - phase(p, .02, .28));
    hint.style.visibility = p > .28 ? 'hidden' : 'visible';
    subtitle.style.opacity = String(phase(p, .48, .78));
    pointLayer.style.opacity = String(phase(p, .62, .90));
    pointLayer.inert = p < .62;
    pointLayer.style.visibility = p < .62 ? 'hidden' : 'visible';
    card.style.opacity = leader.style.opacity = String(phase(p, .72, 1));
    card.style.visibility = p < .72 ? 'hidden' : 'visible';
    if (p < .1 && !wasOpening) select(points[0]);
    wasOpening = p < .1;
  }
  function requestReveal() {
    if (!scheduled) scheduled = requestAnimationFrame(renderReveal);
  }
  function layoutReveal() {
    hero.classList.toggle('hero-scroll', !reducedMotion.matches);
    if (reducedMotion.matches) {
      figure.style.transform = '';
      [title, hint, subtitle, pointLayer, card, leader].forEach((element) => {
        element.style.opacity = ''; element.style.visibility = '';
      });
      pointLayer.inert = false;
      positionCard();
      return;
    }
    // Desktop: copy on the left, enlarged mountain on the right.
    // On narrow screens, retain the stacked reading order.
    artTop = window.innerWidth <= 760
      ? subtitle.offsetTop + subtitle.offsetHeight + 24
      : 170;
    hero.style.setProperty('--hero-art-top', `${artTop}px`);
    revealDistance = window.innerHeight * REVEAL.scrollScreens;
    // Keep the whole anatomy in the document; after the pinned reveal, readers
    // can scroll naturally to the lake and lower markers before the timeline.
    const stageHeight = Math.max(window.innerHeight, artTop + figure.offsetHeight + 12);
    hero.style.setProperty('--hero-stage-height', `${stageHeight}px`);
    hero.style.setProperty('--hero-scroll-height', `${stageHeight + revealDistance}px`);
    positionCard();
    renderReveal();
  }
  window.addEventListener('scroll', requestReveal, { passive: true });
  window.addEventListener('resize', layoutReveal);
  reducedMotion.addEventListener('change', layoutReveal);
  hint.querySelector('a').addEventListener('click', (event) => {
    if (reducedMotion.matches) return;
    event.preventDefault();
    window.scrollTo({ top: window.scrollY + hero.getBoundingClientRect().top + revealDistance, behavior: 'smooth' });
  });
  select(active);
  layoutReveal();
  artwork.addEventListener('load', layoutReveal);
  if (document.fonts) document.fonts.ready.then(layoutReveal);
  artwork.addEventListener('load', positionCard);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(positionCard);
    observer.observe(map);
    observer.observe(card);
  } else window.addEventListener('resize', positionCard);
  if (document.fonts) document.fonts.ready.then(positionCard);
})();
