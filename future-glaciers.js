/* Four local CSVs, loaded once. Counts (not mass) use the supplied 2025 baseline. */
(async () => {
  'use strict';
  const host = document.getElementById('future-chart');
  if (!host) return;
  const BASELINE = 211490;
  const SCENARIOS = [
    { label: '+1.5°C', file: './data/glaciers_left_2100_+15.csv' },
    { label: '+2.0°C', file: './data/glaciers_left_2100_+20.csv' },
    { label: '+2.7°C', file: './data/glaciers_left_2100_+27.csv' },
    { label: '+4.0°C', file: './data/glaciers_left_2100_+40.csv' }
  ];
  const countText = (n) => n.toLocaleString('en-US');
  const percentText = (n) => `${(100 * n / BASELINE).toFixed(2)}%`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = motion.matches;
  const ns = 'http://www.w3.org/2000/svg';
  function node(tag, attributes = {}, text) {
    const element = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  try {
    const data = await Promise.all(SCENARIOS.map(async (scenario) => {
      const response = await fetch(scenario.file);
      if (!response.ok) throw new Error(`${scenario.file}: ${response.status}`);
      const rows = d3.csvParse(await response.text());
      const total = rows[rows.length - 1];
      const remaining = Number(total?.['Number of glaciers remaining by 2100 (median)']);
      if (String(total?.[rows.columns[0]]).trim() !== 'TOTAL' || !Number.isInteger(remaining) || remaining < 0 || remaining > BASELINE) {
        throw new Error(`Invalid TOTAL count in ${scenario.file}`);
      }
      // The CSV percentage heading says "remaining", but its negative values
      // express change. Calculate loss directly from the unambiguous count.
      return { ...scenario, remaining, lost: BASELINE - remaining };
    }));
    const tip = document.createElement('div');
    tip.className = 'future-tooltip';
    tip.id = 'future-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    const scenarioText = document.createElement('small');
    const valueText = document.createElement('strong');
    const categoryText = document.createElement('span');
    const shareText = document.createElement('strong');
    shareText.className = 'future-tooltip-percent';
    const baselineText = document.createElement('small');
    baselineText.textContent = 'of the 211,490 glaciers in 2025';
    tip.append(scenarioText, valueText, categoryText, shareText, baselineText);
    document.body.append(tip);
    let active = null;
    let parts = [];
    let frame = 0;
    function hide() {
      tip.hidden = true;
      if (active) active.removeAttribute('aria-describedby');
      active = null;
    }
    function show(rect, scenario, category, x, y) {
      if (active && active !== rect) active.removeAttribute('aria-describedby');
      active = rect;
      rect.setAttribute('aria-describedby', tip.id);
      scenarioText.textContent = `${scenario.label} warming · 2100 projection`;
      valueText.textContent = countText(scenario[category]);
      categoryText.textContent = category === 'lost' ? 'glaciers lost between 2025 and 2100' : 'glaciers remaining in 2100';
      shareText.textContent = percentText(scenario[category]);
      tip.hidden = false;
      const box = tip.getBoundingClientRect();
      const left = x + box.width + 18 > innerWidth - 12 ? x - box.width - 18 : x + 18;
      const top = y + box.height + 18 > innerHeight - 12 ? y - box.height - 18 : y + 18;
      tip.style.left = `${Math.max(12, Math.min(left, innerWidth - box.width - 12))}px`;
      tip.style.top = `${Math.max(12, Math.min(top, innerHeight - box.height - 12))}px`;
    }
    function chartEnter() {
      const scrolly = host.closest('.future-scrolly');
      if (!scrolly) return 0;
      return scrolly.getBoundingClientRect().top + window.scrollY - window.innerHeight;
    }
    function scrollProgress() {
      if (reduceMotion) return 1;
      const distance = window.innerHeight;
      if (distance <= 0) return 1;
      // Progress starts as the chart top crosses into the viewport.
      return clamp((window.scrollY - chartEnter()) / distance, 0, 1);
    }
    // The chart pins on its own. After the entrance animation, it holds for about 1–2 seconds of scrolling.
    function syncTrack() {
      const scrolly = host.closest('.future-scrolly');
      const sticky = scrolly && scrolly.querySelector('.future-sticky');
      const track = scrolly && scrolly.querySelector('.future-scroll-track');
      if (!scrolly || !sticky || !track || reduceMotion) return;
      const stickyTop = parseFloat(getComputedStyle(sticky).top) || 0;
      const hold = window.innerHeight * 0.65;
      track.style.height = `${Math.max(0, Math.round(hold + stickyTop))}px`;
    }
    function shownCount(part, progress) {
      return part.category === 'remaining'
        ? BASELINE + (part.scenario.remaining - BASELINE) * progress
        : (BASELINE - part.scenario.remaining) * progress;
    }
    function applyProgress(progress) {
      parts.forEach((part) => {
        const height = Math.max(0, shownCount(part, progress) / BASELINE * part.plotHeight);
        const y = part.category === 'remaining' ? part.bottom - height : part.marginTop;
        part.rect.setAttribute('y', String(y));
        part.rect.setAttribute('height', String(height));
      });
    }
    function updateFromScroll() {
      frame = 0;
      applyProgress(scrollProgress());
    }
    function requestUpdate() {
      if (frame) return;
      frame = requestAnimationFrame(updateFromScroll);
    }
    let previousWidth = 0;
    function draw() {
      const width = host.getBoundingClientRect().width;
      if (!width || Math.abs(width - previousWidth) < .5) return;
      previousWidth = width;
      const height = Math.max(380, Math.min(640, width * .7));
      hide();
      const compact = width < 520;
      const margin = { top: 38, right: 8, bottom: 48, left: compact ? 49 : 72 };
      const plotHeight = height - margin.top - margin.bottom;
      const plotWidth = width - margin.left - margin.right;
      const bottom = height - margin.bottom;
      const y = (count) => bottom - count / BASELINE * plotHeight;
      const fontSize = compact ? 10 : 13;
      const svg = node('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': 'Projected glacier counts in 2100 under four warming scenarios' });
      const axes = node('g', { class: 'future-axes', 'pointer-events': 'none' });
      axes.append(node('text', { x: margin.left, y: 17, class: 'future-axis-title', 'font-size': compact ? 12 : 15 }, 'Number of glaciers'));
      axes.append(node('path', { d: `M${margin.left} ${margin.top}V${bottom}H${width - margin.right}`, class: 'future-axis', fill: 'none' }));
      for (const tick of [0, 50000, 100000, 150000, 200000]) {
        axes.append(node('line', { x1: margin.left - 5, x2: margin.left, y1: y(tick), y2: y(tick), class: 'future-axis' }));
        axes.append(node('text', { x: margin.left - 10, y: y(tick) + 4, 'text-anchor': 'end', class: 'future-tick', 'font-size': fontSize }, countText(tick)));
      }
      const step = plotWidth / data.length;
      const barWidth = step * .70;
      parts = [];
      data.forEach((scenario, i) => {
        const x = margin.left + step * i + (step - barWidth) / 2;
        for (const category of ['remaining', 'lost']) {
          const label = category === 'lost' ? `${percentText(scenario.lost)} lost` : `${countText(scenario.remaining)} remaining`;
          const rect = node('rect', { x, y: margin.top, width: barWidth, height: 0, class: `future-bar-part is-${category}`, tabindex: 0, role: 'img', 'aria-label': `${scenario.label}: ${label} by 2100` });
          parts.push({ rect, scenario, category, plotHeight, bottom, marginTop: margin.top });
          rect.addEventListener('pointermove', (event) => show(rect, scenario, category, event.clientX, event.clientY));
          rect.addEventListener('pointerleave', hide);
          rect.addEventListener('pointerdown', (event) => event.preventDefault());
          rect.addEventListener('click', (event) => show(rect, scenario, category, event.clientX, event.clientY));
          rect.addEventListener('focus', () => {
            const box = rect.getBoundingClientRect();
            show(rect, scenario, category, box.x + box.width / 2, Math.max(12, Math.min(innerHeight - 12, box.y + box.height / 2)));
          });
          rect.addEventListener('blur', hide);
          rect.addEventListener('keydown', (event) => { if (event.key === 'Escape') hide(); });
          svg.append(rect);
        }
        axes.append(node('text', { x: x + barWidth / 2, y: bottom + 28, 'text-anchor': 'middle', class: 'future-scenario', 'font-size': compact ? 12 : 18, 'font-weight': 650 }, scenario.label));
      });
      // Draw both axes last, above every bar and hover outline.
      svg.append(axes);
      host.replaceChildren(svg);
      host.setAttribute('aria-busy', 'false');
      applyProgress(scrollProgress());
    }
    draw();
    syncTrack();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
    window.addEventListener('resize', () => {
      syncTrack();
      draw();
      requestUpdate();
    });
    window.addEventListener('scroll', requestUpdate, { passive: true });
    motion.addEventListener('change', () => {
      reduceMotion = motion.matches;
      requestUpdate();
    });
    window.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
  } catch (error) {
    host.textContent = 'The glacier projections could not be loaded. Please refresh to try again.';
    host.setAttribute('aria-busy', 'false');
    console.error('Glacier projections:', error);
  }
})();
