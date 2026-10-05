/* Scroll connection: the existing world map → its actual Nepal path → Nepal story. */
(() => {
  'use strict';
  // 调整衔接节奏：总长度在 CSS 的 --map-journey-screens，以下数值是 0–1 的进度。
  const TIMING = {
    outlines: [0, .12],
    zoom: [.04, .58],
    grey: [.12, .58],
    details: [.58, .67], // 居中变灰后：三角标记、国家名和介绍占位淡入
    moveLeft: [.70, .96],
    worldFade: [.70, .95],
    sidebar: [.72, .98],
    handoff: [.98, 1]
  };
  // All glacier symbols use one screen size; area_km2 never controls their size.
  const GLACIERS = {
    csv: 'data/nepal_individual_glaciers.csv',
    sizePx: 4, // triangle width in CSS pixels (also compensated during zoom)
    color: 'var(--color-brown)',
    fadeIn: [.38, .58],
    fadeOut: [.12, .26] // local progress of the original Nepal story
  };
  const COUNTRY = { x: 340, y: 400, width: 440 }; // Nepal 插画内的位置及宽度
  const MOUNTAIN_LOCATION = { latitude: 28.2575, longitude: 85.5158 };
  const MOUNTAIN_MARKER = {
    grow: [.06, .22], // Nepal 章节进度：向 THE MOUNTAIN 过渡时加速放大
    maxSizePx: 64 // 从 GLACIERS.sizePx 放大到此屏幕宽度；坐标锚点不变
  };
  const host = document.getElementById('glacier-map');
  const mapSection = document.getElementById('global-retreat');
  const nepal = document.getElementById('nepal');
  if (!host || !mapSection || !nepal) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const phase = (p, limits) => {
    const t = clamp((p - limits[0]) / (limits[1] - limits[0]));
    return t * t * (3 - 2 * t);
  };
  const mix = (a, b, p) => a + (b - a) * p;
  let initialized = false;

  function initialize() {
    const svg = host.querySelector(':scope > svg');
    const sourceNepal = svg && svg.querySelector('#np');
    // Wait until map geometry and the click panel have both finished initializing.
    if (initialized || !sourceNepal || !host.querySelector('#glacier-region-panel')) return;
    initialized = true;
    observer.disconnect();
    const box = sourceNepal.getBBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    if (!box.width || !box.height) return;
    const countryScale = COUNTRY.width / box.width;
    const countryTransform = `translate(${COUNTRY.x} ${COUNTRY.y}) scale(${COUNTRY.width / box.width}) translate(${-cx} ${-cy})`;

    // Give the existing Nepal scene precisely the same silhouette as the map.
    const originalMap = nepal.querySelector('#nepal-map-layer');
    const countryGroup = document.createElementNS(ns, 'g');
    countryGroup.setAttribute('transform', countryTransform);
    const countryPath = document.createElementNS(ns, 'path');
    countryPath.setAttribute('d', sourceNepal.getAttribute('d'));
    countryPath.setAttribute('fill', 'var(--color-grey)');
    countryPath.setAttribute('class', 'nepal-country-shape');
    countryGroup.append(countryPath);
    originalMap.prepend(countryGroup);
    // Use the same geographic projection as the world map. The triangle's
    // bottom-center is the location anchor (longitude first, latitude second).
    const projection = svg.glacierProjection;
    const location = projection([MOUNTAIN_LOCATION.longitude, MOUNTAIN_LOCATION.latitude]);
    const markerX = COUNTRY.x + (location[0] - cx) * countryScale;
    const markerY = COUNTRY.y + (location[1] - cy) * countryScale;
    const details = document.createElementNS(ns, 'g');
    details.setAttribute('class', 'nepal-country-details');
    details.setAttribute('pointer-events', 'none');
    const mountainMark = document.createElementNS(ns, 'path');
    mountainMark.setAttribute('fill', 'var(--color-brown)');
    mountainMark.setAttribute('class', 'nepal-location-marker');
    mountainMark.setAttribute('d', 'M-1.5 0 L0 -2.598 L1.5 0 Z');
    mountainMark.setAttribute('transform', `translate(${markerX} ${markerY})`);
    mountainMark.setAttribute('data-latitude', MOUNTAIN_LOCATION.latitude);
    mountainMark.setAttribute('data-longitude', MOUNTAIN_LOCATION.longitude);
    const markerTitle = document.createElementNS(ns, 'title');
    markerTitle.textContent = '28.2575° N, 85.5158° E';
    mountainMark.append(markerTitle);
    const countryName = originalMap.querySelector('.scene-label');
    const introduction = originalMap.querySelector('.scene-note');
    countryName.setAttribute('x', COUNTRY.x);
    countryName.setAttribute('y', '580');
    countryName.setAttribute('text-anchor', 'middle');
    introduction.setAttribute('x', COUNTRY.x);
    introduction.setAttribute('y', '610');
    introduction.setAttribute('text-anchor', 'middle');
    // Introduction copy lives in index.html and is shared with the transition.
    details.append(mountainMark, countryName, introduction);
    const glacierCaption = nepal.querySelector('.nepal-glacier-caption');
    originalMap.append(details);

    // Reserve this space in HTML before the async SVG arrives, avoiding a
    // layout/scroll jump on refresh or on a slow map load.
    const journey = mapSection.querySelector('.map-journey');
    const stage = journey.querySelector('.map-journey-stage');
    mapSection.classList.add('has-map-journey');
    nepal.classList.add('nepal-after-map-journey');

    // A visual copy provides the right column during the transition. At the end,
    // the original sticky scene occupies exactly the same screen rectangle.
    const preview = nepal.querySelector('.nepal-stage').cloneNode(true);
    preview.classList.add('map-journey-nepal-preview');
    preview.setAttribute('aria-hidden', 'true');
    preview.inert = true;
    const previewMap = preview.querySelector('#nepal-map-layer');
    previewMap.removeAttribute('transform');
    // The camera carries these details until the original scene takes over.
    previewMap.querySelector('.nepal-country-details').remove();
    preview.querySelector('.nepal-glacier-caption').remove();
    const previewCountry = preview.querySelector('.nepal-country-shape');
    preview.querySelector('#nepal-mountain-layer').remove();
    preview.querySelector('#nepal-village-layer').remove();
    preview.querySelectorAll('.nepal-story').forEach((story, index) => {
      story.style.opacity = index === 0 ? '1' : '0';
      story.style.visibility = index === 0 ? 'visible' : 'hidden';
      story.style.transform = 'none';
    });
    preview.querySelectorAll('.nepal-progress i').forEach((mark, i) => mark.classList.toggle('is-active', i === 0));
    preview.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    preview.querySelectorAll('[aria-labelledby]').forEach((node) => node.removeAttribute('aria-labelledby'));
    stage.prepend(preview);
    // Fixed corner credit: outside both SVG cameras, so it never zooms with Nepal.
    const bridgeCaption = glacierCaption.cloneNode(true);
    stage.append(bridgeCaption);

    const camera = document.createElementNS(ns, 'g');
    const world = document.createElementNS(ns, 'g');
    camera.setAttribute('class', 'map-journey-camera');
    [...svg.children].forEach((node) => {
      if (!['defs', 'style', 'metadata', 'title', 'desc'].includes(node.localName)) world.append(node);
    });
    const isolated = document.createElementNS(ns, 'g');
    isolated.setAttribute('class', 'region-panel-map-detail');
    const focusCountry = document.createElementNS(ns, 'path');
    focusCountry.setAttribute('d', sourceNepal.getAttribute('d'));
    focusCountry.setAttribute('class', 'map-journey-country');
    const focusDetails = document.createElementNS(ns, 'g');
    focusDetails.setAttribute('class', 'map-journey-country-details');
    // Invert the country fit so labels and marker share the same camera and
    // match the original Nepal scene exactly at the scroll handoff.
    focusDetails.setAttribute('transform', `translate(${cx} ${cy}) scale(${1 / countryScale}) translate(${-COUNTRY.x} ${-COUNTRY.y})`);
    focusDetails.append(details.cloneNode(true));
    isolated.append(focusCountry, focusDetails);
    camera.append(world, isolated);
    svg.append(camera);
    const regions = world.querySelector('.glacier-regions-layer');
    const markers = [...world.querySelectorAll('.glacier-region-marker')];
    const mapIce = mapSection.querySelector('.map-ice');
    const grey = getComputedStyle(nepal).getPropertyValue('--color-grey').trim();
    const light = getComputedStyle(nepal).getPropertyValue('--color-light').trim();
    const color = d3.interpolateRgb(light, grey);
    // One keyed set of symbols is moved between the bridge and original scene,
    // never copied or recreated by scroll/resize. Both parents use map coordinates.
    const glacierLayer = document.createElementNS(ns, 'g');
    glacierLayer.setAttribute('class', 'nepal-glaciers');
    glacierLayer.setAttribute('pointer-events', 'none');
    glacierLayer.setAttribute('aria-hidden', 'true');
    glacierLayer.setAttribute('fill', GLACIERS.color);
    glacierLayer.style.opacity = '0';
    const symbolDefs = document.createElementNS(ns, 'defs');
    const triangle = document.createElementNS(ns, 'path');
    triangle.id = 'nepal-glacier-triangle-symbol';
    symbolDefs.append(triangle);
    glacierLayer.append(symbolDefs);
    isolated.insertBefore(glacierLayer, focusDetails);
    const captions = [glacierCaption, bridgeCaption];
    const locationMarkers = [mountainMark, focusDetails.querySelector('.nepal-location-marker')];
    const mountainMorph = createNepalMountainMorph(nepal, mountainMark);
    let glaciersReady = false;
    let glacierLoad = null;
    let symbolWidth = 0;

    function loadGlaciers() {
      if (glacierLoad) return glacierLoad;
      host.dataset.glaciersStatus = 'loading';
      glacierLoad = readMapAsset(GLACIERS.csv, 'Nepal glaciers').then((csv) => {
        const rows = d3.csvParse(csv);
        const unique = new Map();
        let invalid = 0, duplicates = 0;
        for (const row of rows) {
          const id = row.rgi_id?.trim();
          const lon = row.lon?.trim() ? Number(row.lon) : NaN;
          const lat = row.lat?.trim() ? Number(row.lat) : NaN;
          if (!id || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) { invalid++; continue; }
          if (unique.has(id)) { duplicates++; continue; }
          const [x, y] = projection([lon, lat]);
          unique.set(id, { id, lon, lat, x, y });
        }
        d3.select(glacierLayer).selectAll('use').data([...unique.values()], (d) => d.id)
          .join('use')
          .attr('href', '#nepal-glacier-triangle-symbol')
          .attr('data-rgi-id', (d) => d.id)
          .attr('data-lon', (d) => d.lon).attr('data-lat', (d) => d.lat)
          .attr('x', (d) => d.x).attr('y', (d) => d.y);
        host.dataset.glaciersLoaded = String(rows.length);
        host.dataset.glaciersDrawn = String(unique.size);
        host.dataset.glaciersInvalid = String(invalid);
        host.dataset.glaciersDuplicates = String(duplicates);
        host.dataset.glaciersStatus = 'ready';
        glaciersReady = true;
        requestRender();
      }).catch((error) => {
        host.dataset.glaciersStatus = 'error';
        console.error('[nepal-glaciers]', error);
      });
      return glacierLoad;
    }
    function updateGlaciers(p) {
      const inStory = p >= 1 && !motion.matches;
      const parent = inStory ? countryGroup : isolated;
      if (glacierLayer.parentNode !== parent) {
        if (inStory) parent.append(glacierLayer);
        else parent.insertBefore(glacierLayer, focusDetails);
      }
      const storyBounds = nepal.getBoundingClientRect();
      const storyStageHeight = nepal.querySelector('.nepal-stage').clientHeight;
      const storyProgress = clamp(-storyBounds.top / Math.max(1, storyBounds.height - storyStageHeight));
      const opacity = !glaciersReady || motion.matches ? 0 : inStory
        ? 1 - phase(storyProgress, GLACIERS.fadeOut)
        : phase(p, GLACIERS.fadeIn);
      glacierLayer.style.opacity = String(opacity);
      captions.forEach((caption) => { caption.style.opacity = String(opacity); });
      const growth = inStory ? phase(storyProgress, MOUNTAIN_MARKER.grow) : 0;
      const markerSize = mix(GLACIERS.sizePx, MOUNTAIN_MARKER.maxSizePx, growth);
      locationMarkers.forEach((marker) => {
        const matrix = marker.getScreenCTM();
        const scale = matrix && Math.hypot(matrix.a, matrix.b);
        if (!scale) return;
        // Scale the symbol around its fixed geographic base, not the location.
        const width = markerSize / scale;
        marker.setAttribute('d', `M${-width / 2} 0 L0 ${-width * Math.sqrt(3) / 2} L${width / 2} 0 Z`);
      });
      mountainMorph?.update(motion.matches ? 1 : storyProgress, inStory || motion.matches);
      if (!opacity) return;
      // The shared symbol cancels the complete screen scale (SVG fit + CSS scale
      // + scroll camera), without altering any projected position.
      const matrix = glacierLayer.getScreenCTM();
      const scale = matrix && Math.hypot(matrix.a, matrix.b);
      if (!scale) return;
      const width = GLACIERS.sizePx / scale;
      if (Math.abs(width - symbolWidth) > 1e-8) {
        const height = width * Math.sqrt(3) / 2;
        triangle.setAttribute('d', `M0 ${-height * 2 / 3} L${width / 2} ${height / 3} L${-width / 2} ${height / 3} Z`);
        symbolWidth = width;
      }
    }
    let geometry = null;
    let frame = 0;

    function measure() {
      if (motion.matches) { geometry = null; return; }
      const rootMatrix = svg.getScreenCTM();
      if (!rootMatrix) return;
      const bounds = stage.getBoundingClientRect();
      const countryBounds = previewCountry.getBoundingClientRect();
      const sceneBounds = preview.querySelector('.nepal-scene').getBoundingClientRect();
      bridgeCaption.style.left = `${sceneBounds.left - bounds.left + sceneBounds.width * .05}px`;
      // Root CTM is unaffected by the child camera transform.
      const relativeMatrix = new DOMMatrix([rootMatrix.a, rootMatrix.b, rootMatrix.c, rootMatrix.d,
        rootMatrix.e - bounds.left, rootMatrix.f - bounds.top]);
      const inverse = relativeMatrix.inverse();
      const center = new DOMPoint(bounds.width / 2, bounds.height / 2).matrixTransform(inverse);
      const destination = new DOMPoint(countryBounds.left + countryBounds.width / 2 - bounds.left,
        countryBounds.top + countryBounds.height / 2 - bounds.top).matrixTransform(inverse);
      geometry = {
        center, destination,
        zoom: countryBounds.width / (box.width * Math.hypot(rootMatrix.a, rootMatrix.b))
      };
    }
    function render() {
      frame = 0;
      if (motion.matches) {
        camera.removeAttribute('transform');
        world.style.opacity = '1';
        regions.style.opacity = '';
        sourceNepal.style.visibility = '';
        focusCountry.style.opacity = '0';
        focusDetails.style.opacity = '0';
        preview.style.opacity = '0';
        mapIce.style.opacity = '';
        nepal.style.visibility = '';
        nepal.style.opacity = '';
        nepal.inert = false;
        stage.style.opacity = '';
        host.classList.remove('is-map-journey-active');
        svg.removeAttribute('aria-hidden');
        updateGlaciers(0);
        return;
      }
      // Resolve the camera against the current centered SVG, not a cached
      // pre-layout position. CSS changes and late layout shifts need not fire
      // window.resize; using stale screen coordinates offsets Nepal after zoom.
      measure();
      if (!geometry) return;
      const bounds = journey.getBoundingClientRect();
      const distance = Math.max(1, bounds.height - stage.clientHeight);
      const p = clamp(-bounds.top / distance);
      const zoom = phase(p, TIMING.zoom);
      const left = phase(p, TIMING.moveLeft);
      const handoff = phase(p, TIMING.handoff);
      const z = Math.exp(Math.log(geometry.zoom) * zoom);
      const x = mix(mix(cx, geometry.center.x, zoom), geometry.destination.x, left);
      const y = mix(mix(cy, geometry.center.y, zoom), geometry.destination.y, left);
      camera.setAttribute('transform', `translate(${x} ${y}) scale(${z}) translate(${-cx} ${-cy})`);
      regions.style.opacity = String(1 - phase(p, TIMING.outlines));
      world.style.opacity = String(1 - phase(p, TIMING.worldFade));
      sourceNepal.style.visibility = p > 0 ? 'hidden' : '';
      focusCountry.style.fill = color(phase(p, TIMING.grey));
      // Keep the country opaque while labels fade in; the identical original
      // replaces it when the sticky screen hands over.
      focusCountry.style.opacity = p > 0 ? '1' : '0';
      focusDetails.style.opacity = String(phase(p, TIMING.details));
      preview.style.opacity = String(phase(p, TIMING.sidebar));
      previewMap.style.opacity = String(handoff);
      mapIce.style.opacity = String(1 - phase(p, [0, .25]));
      // The next section overlaps the final sticky screen, so there is no empty
      // screen or duplicate Nepal scene between the two scroll sequences.
      nepal.style.visibility = p >= 1 ? '' : 'hidden';
      nepal.style.opacity = p >= 1 ? '' : '0';
      nepal.inert = p < 1;
      stage.style.visibility = p >= 1 ? 'hidden' : '';
      stage.style.opacity = p >= 1 ? '0' : '1';
      const active = p > 0;
      host.classList.toggle('is-map-journey-active', active);
      if (active) {
        svg.setAttribute('aria-hidden', 'true');
        markers.forEach((marker) => marker.setAttribute('tabindex', '-1'));
        const readout = host.querySelector('.glacier-region-readout');
        if (readout) readout.hidden = true;
      } else if (!host.classList.contains('is-region-panel-open')) {
        svg.removeAttribute('aria-hidden');
        markers.forEach((marker) => marker.setAttribute('tabindex', '0'));
      }
      updateGlaciers(p);
      journey.dataset.progress = p.toFixed(3);
    }
    function requestRender() {
      if (!frame) frame = requestAnimationFrame(render);
    }
    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', requestRender);
    motion.addEventListener('change', () => { stage.style.visibility = ''; measure(); requestRender(); });
    measure();
    render();
    loadGlaciers();
    // Recalculate the existing ice field and Nepal progress after the new layout.
    window.dispatchEvent(new Event('resize'));
  }
  const observer = new MutationObserver(initialize);
  observer.observe(host, { childList: true, subtree: true });
  initialize();
})();
