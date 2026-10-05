/* Regional mass panels. Values come from glacier-mass-by-region.csv, already joined to the map. */
(() => {
  'use strict';

  // 每个区域使用同样多的三角形；质量单位按该区域 2000 年的质量自动计算。
  // 修改 columns / rows 调整视觉密度；例如 9 × 6 = 54 枚。
  const REGION_PANEL = { columns: 9, rows: 6 };
  const formatMass = (value) => value.toLocaleString('en', { maximumFractionDigits: 2 });
  const readNumber = (path, attribute) => {
    const value = path && path.getAttribute(attribute);
    return value === null || value === '' ? NaN : Number(value);
  };

  const host = document.getElementById('glacier-map');
  if (!host) return;
  let initialized = false;
  function initialize() {
    const svg = host.querySelector(':scope > svg');
    const markers = svg && [...svg.querySelectorAll('.glacier-region-marker')];
    if (initialized || !markers || markers.length !== 19) return;
    initialized = true;
    observer.disconnect();
    const regions = markers.map((marker) => {
      const path = svg.querySelector(`.glacier-region[data-region-id="${marker.dataset.regionId}"]:not(.glacier-region-union)`);
      const initial = readNumber(path, 'data-mass-2000-gt');
      const lost = readNumber(path, 'data-mass-lost-2000-2024-gt');
      return {
        id: marker.dataset.regionId,
        name: marker.dataset.regionName,
        initial, lost, remaining: initial - lost,
        massLoss: initial > 0 ? lost / initial * 100 : NaN,
        marker
      };
    }).sort((a, b) => Number(a.id) - Number(b.id));

    // Keep the actual ocean silhouette and fade everything drawn over it.
    [...svg.children].forEach((child) => {
      if (child.id !== 'ocean' && !['defs', 'style', 'metadata', 'title', 'desc'].includes(child.localName)) {
        child.classList.add('region-panel-map-detail');
      }
    });
    svg.setAttribute('role', 'group');
    markers.forEach((marker) => {
      marker.setAttribute('role', 'button');
      marker.setAttribute('tabindex', '0');
      marker.setAttribute('aria-label', `Open region ${Number(marker.dataset.regionId)}: ${marker.dataset.regionName}`);
      marker.setAttribute('aria-controls', 'glacier-region-panel');
      marker.setAttribute('aria-expanded', 'false');
    });

    const panel = document.createElement('section');
    panel.id = 'glacier-region-panel';
    panel.className = 'glacier-region-panel';
    panel.setAttribute('aria-labelledby', 'region-panel-title');
    panel.hidden = true;
    panel.innerHTML = `
      <button type="button" class="region-panel-arrow region-panel-prev" aria-label="Previous region"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="16,5 8,12 16,19"/></svg></button>
      <div class="region-panel-content">
        <header class="region-panel-heading small-text-normal" aria-live="polite" aria-atomic="true">
          <p class="region-panel-number"></p>
          <h3 id="region-panel-title"></h3>
        </header>
        <div class="region-panel-triangles" role="group"></div>
        <p class="region-panel-unit caption-text-san-serif"></p>
        <div class="region-panel-legend caption-text-san-serif">
          <span><i class="region-triangle-lost" aria-hidden="true"></i>Mass lost</span>
          <span><i class="region-triangle-remained" aria-hidden="true"></i>Mass remaining</span>
        </div>
        <p class="region-panel-percent caption-text-san-serif"></p>
      </div>
      <button type="button" class="region-panel-arrow region-panel-next" aria-label="Next region"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="8,5 16,12 8,19"/></svg></button>`;
    host.append(panel);
    const title = panel.querySelector('h3');
    const number = panel.querySelector('.region-panel-number');
    const chart = panel.querySelector('.region-panel-triangles');
    const unitLabel = panel.querySelector('.region-panel-unit');
    const percent = panel.querySelector('.region-panel-percent');
    const legend = panel.querySelector('.region-panel-legend');
    panel.setAttribute('tabindex', '-1');
    const tooltip = document.createElement('div');
    tooltip.id = 'region-mass-annotation';
    tooltip.className = 'region-mass-annotation caption-text-san-serif';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    document.body.append(tooltip);
    let annotated = null;
    let closing = false;
    let closeTimer = 0;
    let openingScrollY = window.scrollY;
    let activeIndex = -1;

    function hideAnnotation() {
      tooltip.hidden = true;
      if (annotated) annotated.removeAttribute('aria-describedby');
      annotated = null;
    }
    function annotate(icon, kind, clientX, clientY) {
      if (closing || panel.hidden) return;
      const region = regions[activeIndex];
      const unit = region.initial / (REGION_PANEL.columns * REGION_PANEL.rows);
      const isLost = kind === 'lost';
      const total = isLost ? region.lost : region.remaining;
      const part = Number(icon.dataset[kind]);
      const approximate = Math.abs(unit - Math.round(unit * 100) / 100) > 1e-8;
      tooltip.replaceChildren();
      const heading = document.createElement('strong');
      heading.textContent = isLost ? 'Mass lost · 2000–2024' : 'Mass remaining · 2024';
      const detail = document.createElement('span');
      detail.textContent = `1 full triangle ${approximate ? '≈' : '='} ${formatMass(unit)} Gt\nRegion total: ${formatMass(total)} Gt`;
      if (part < unit - 1e-8) detail.textContent += `\nThis colored part: ${formatMass(part)} Gt`;
      tooltip.append(heading, detail);
      if (annotated && annotated !== icon) annotated.removeAttribute('aria-describedby');
      annotated = icon;
      icon.setAttribute('aria-describedby', tooltip.id);
      tooltip.hidden = false;
      const box = icon.getBoundingClientRect();
      const x = clientX ?? box.right;
      const y = clientY ?? box.top;
      const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
      tooltip.style.left = `${Math.max(8, Math.min(x + 14, window.innerWidth - width - 8))}px`;
      tooltip.style.top = `${Math.max(8, y + height + 20 > window.innerHeight ? y - height - 12 : y + 14)}px`;
    }
    function drawMassChart(region) {
      hideAnnotation();
      chart.replaceChildren();
      const count = REGION_PANEL.columns * REGION_PANEL.rows;
      chart.style.setProperty('--triangle-columns', REGION_PANEL.columns);
      chart.style.setProperty('--triangle-rows', REGION_PANEL.rows);
      const valid = Number.isFinite(region.initial) && region.initial > 0
        && Number.isFinite(region.lost) && region.lost >= 0 && region.lost <= region.initial;
      legend.hidden = !valid;
      if (!valid) {
        chart.setAttribute('aria-label', 'Glacier mass data unavailable');
        unitLabel.textContent = 'Glacier mass data pending';
        return;
      }
      const unit = region.initial / count;
      chart.setAttribute('aria-label', `${region.name}: ${formatMass(region.initial)} Gt in 2000; ${formatMass(region.lost)} Gt lost and ${formatMass(region.remaining)} Gt remaining in 2024.`);
      unitLabel.textContent = `2000 mass: ${formatMass(region.initial)} Gt · Unit varies by region`;
      for (let i = 0; i < count; i += 1) {
        const remaining = Math.max(0, Math.min(unit, region.remaining - i * unit));
        const lost = unit - remaining;
        const icon = document.createElement('button');
        icon.type = 'button';
        icon.className = 'region-panel-triangle';
        icon.dataset.remaining = String(remaining);
        icon.dataset.lost = String(lost);
        icon.setAttribute('aria-label', `${formatMass(remaining)} Gt remaining; ${formatMass(lost)} Gt lost. Full triangle: approximately ${formatMass(unit)} Gt.`);
        icon.innerHTML = '<svg viewBox="0 0 32 28" aria-hidden="true"><path class="region-triangle-base" data-kind="remaining" d="M16 0 32 28H0Z"/><path class="region-triangle-loss" data-kind="lost" d="M16 0 32 28H0Z"/></svg>';
        // A top cut at sqrt(remaining/unit) gives the brown bottom part exactly
        // lost/unit of the triangle's area (a triangular area scales quadratically).
        const lossPath = icon.querySelector('.region-triangle-loss');
        if (lost < 1e-8) lossPath.remove();
        else lossPath.style.clipPath = `inset(${Math.sqrt(remaining / unit) * 100}% 0 0)`;
        icon.addEventListener('pointermove', (event) => {
          const kind = event.target.dataset.kind || (lost > remaining ? 'lost' : 'remaining');
          annotate(icon, kind, event.clientX, event.clientY);
        });
        icon.addEventListener('pointerleave', hideAnnotation);
        icon.addEventListener('focus', () => annotate(icon, lost > remaining ? 'lost' : 'remaining'));
        icon.addEventListener('blur', hideAnnotation);
        icon.addEventListener('click', (event) => {
          const kind = event.target.dataset.kind || (lost > remaining ? 'lost' : 'remaining');
          annotate(icon, kind, event.clientX || undefined, event.clientY || undefined);
        });
        chart.append(icon);
      }
    }

    function layoutPanel() {
      const ocean = svg.querySelector('#ocean');
      if (!ocean) return;
      const globe = ocean.getBoundingClientRect(), frame = host.getBoundingClientRect();
      panel.style.left = `${globe.left - frame.left}px`;
      panel.style.top = `${globe.top - frame.top}px`;
      panel.style.width = `${globe.width}px`;
      panel.style.height = `${globe.height}px`;
    }
    function showRegion(index, opening = false) {
      clearTimeout(closeTimer);
      closing = false;
      activeIndex = (index + regions.length) % regions.length;
      const region = regions[activeIndex];
      number.textContent = String(Number(region.id));
      title.textContent = region.name;
      percent.textContent = Number.isFinite(region.massLoss)
        ? `${formatMass(region.massLoss)}% glacier mass loss · 2000–2024`
        : 'Glacier mass loss data pending';
      drawMassChart(region);
      markers.forEach((marker) => {
        marker.setAttribute('tabindex', '-1');
        marker.setAttribute('aria-expanded', String(marker === region.marker));
      });
      const readout = host.querySelector('.glacier-region-readout');
      if (readout) readout.hidden = true;
      svg.querySelectorAll('.is-hovered').forEach((item) => item.classList.remove('is-hovered'));
      svg.setAttribute('aria-hidden', 'true');
      layoutPanel();
      panel.hidden = false;
      // Commit the initial opacity before starting the fade.
      void panel.offsetWidth;
      host.classList.add('is-region-panel-open');
      if (opening) {
        openingScrollY = window.scrollY;
        panel.focus({ preventScroll: true });
      }
    }
    function finishClose() {
      if (!closing) return;
      clearTimeout(closeTimer);
      panel.hidden = true;
      closing = false;
      svg.removeAttribute('aria-hidden');
      markers.forEach((marker) => {
        marker.setAttribute('tabindex', '0');
        marker.setAttribute('aria-expanded', 'false');
      });
      if (panel.contains(document.activeElement) && activeIndex >= 0) {
        regions[activeIndex].marker.focus({ preventScroll: true });
      }
    }
    function closePanel() {
      if (panel.hidden || closing) return;
      closing = true;
      hideAnnotation();
      host.classList.remove('is-region-panel-open');
      const duration = getComputedStyle(panel).transitionDuration.split(',')
        .reduce((max, value) => Math.max(max, parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000)), 0);
      if (!duration) finishClose();
      else closeTimer = window.setTimeout(finishClose, duration + 50);
    }
    panel.addEventListener('transitionend', (event) => {
      if (event.target === panel && event.propertyName === 'opacity') finishClose();
    });
    panel.addEventListener('click', (event) => {
      if (event.target.closest('button, .region-panel-heading, .region-panel-unit, .region-panel-percent, .region-panel-legend')) return;
      const ocean = svg.querySelector('#ocean');
      const matrix = ocean && ocean.getScreenCTM();
      if (matrix && ocean.isPointInFill(new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()))) closePanel();
    });
    window.addEventListener('wheel', (event) => {
      if (event.deltaX || event.deltaY) closePanel();
    }, { passive: true });
    window.addEventListener('scroll', () => {
      if (Math.abs(window.scrollY - openingScrollY) > 1) closePanel();
    }, { passive: true });
    svg.addEventListener('click', (event) => {
      const region = event.target.closest('.glacier-region, .glacier-region-marker');
      if (!region || closing || host.classList.contains('is-region-panel-open')) return;
      const index = regions.findIndex((item) => item.id === region.dataset.regionId);
      if (index >= 0) showRegion(index, true);
    });
    svg.addEventListener('keydown', (event) => {
      const marker = event.target.closest('.glacier-region-marker');
      if (!marker || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      const index = regions.findIndex((item) => item.id === marker.dataset.regionId);
      if (index >= 0) showRegion(index, true);
    });
    panel.querySelector('.region-panel-prev').addEventListener('click', () => showRegion(activeIndex - 1));
    panel.querySelector('.region-panel-next').addEventListener('click', () => showRegion(activeIndex + 1));
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closePanel(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); showRegion(activeIndex - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); showRegion(activeIndex + 1); }
    });
    let touchStart = null;
    panel.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch' || !event.isPrimary || event.target.closest('button')) return;
      touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
      panel.setPointerCapture(event.pointerId);
    });
    panel.addEventListener('pointerup', (event) => {
      if (!touchStart || event.pointerId !== touchStart.id) return;
      const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        showRegion(activeIndex + (dx < 0 ? 1 : -1));
      }
    });
    ['pointercancel', 'lostpointercapture'].forEach((type) => panel.addEventListener(type, () => { touchStart = null; }));
    window.addEventListener('resize', () => { hideAnnotation(); layoutPanel(); });
    if (window.ResizeObserver) new ResizeObserver(layoutPanel).observe(svg);
    layoutPanel();
  }
  // The real map loads asynchronously; initialize only after all markers exist.
  const observer = new MutationObserver(initialize);
  observer.observe(host, { childList: true, subtree: true });
  initialize();
})();
