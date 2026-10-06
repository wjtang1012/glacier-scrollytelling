// Combined warming chart: temperature anomaly and cumulative glacier mass loss.
// Scroll progress is local to #warming and does not replace the step observer above.
function initWarmingChart() {
  if (typeof d3 === 'undefined') {
    console.error('[warming] D3 v7 did not load. The warming chart was not initialized.');
    return;
  }

  const chart = document.getElementById('warming-chart');
  const scrolly = chart && chart.closest('.warming-scrolly');
  const svgElement = chart && chart.querySelector('svg');
  if (!chart || !scrolly || !svgElement) return;

  const YEAR_MIN = 1970;
  const YEAR_MAX = 2024;
  const TIMELINE_START = 1965;
  const TIMELINE_END = 2030;
  const GLACIER_START = 2000;
  const DRAW_LEAD = 0.33;
  const DRAW_LEAD_YEAR = 1990;
  const HOVER_THRESHOLD = 52;
  const TOUCH_THRESHOLD = 76;
  const TEMPERATURE_FOLLOW = { activate: 1975, fadeEnd: 1978 };
  const GLACIER_FOLLOW = { activate: 2005, fadeEnd: 2008 };
  const yearsPerViewport = 50;
  let contentEdgeX = 0;
  let yearSpacing = 40;

  // ========================================
  // VISUAL TUNING — vertical chart composition
  // ========================================
  // Fractions of the plot height, measured downward from the top of the plot.
  // Larger data values sit toward the smaller fraction (higher on screen).
  // These ranges position the lines only. They do not change the data domains.
  // Developer test for the glacier series only. No on-screen toggle.
  // 'mass-loss'   → published loss, 0% to +5.4%, curve rises
  // 'mass-change' → negated loss, 0% to −5.4%, curve descends from 2000
  const GLACIER_DISPLAY_MODE = 'mass-change';

  // Glacier occupies the upper field. Temperature occupies the lower field.
  const glacierBandTop = -0.05;
  const glacierBandBottom = 0.3;

  const temperatureBandTop = 0.3;
  const temperatureBandBottom = 1;

  // Far edge of each filled area, in the same fraction space.
  // Both fills grow downward from their curves to the timeline baseline.
  // 0 = top of the plot. 1 = timeline baseline.
  const temperatureAreaBottom = 1.00;
  const glacierAreaBottom = temperatureAreaBottom;

  // ========================================
  // VISUAL TUNING — AREA GRADIENTS
  // ========================================
  // Stop offset 0% is the strong end, nearest the curve.
  // Stop offset 100% is the transparent far end.
  // Raise an opacity to strengthen that part of the field.
  // Lower an opacity to let more blue background through.
  // Move the middle offsets toward 0% for a shorter fade.
  // Move them toward 100% for a longer fade.
  // temperatureAreaOpacity / glacierAreaOpacity scale the whole field.
  //
  // `from` is the plot-height fraction of offset 0%. `to` is offset 100%.
  // 0 = top of the plot, 1 = timeline. These are independent of the bands above.
  // Keep `from` on the curve side of the fill and `to` on the far edge.
  // The gradient is padded outside that span, so a short span turns the
  // leftover area into a solid block of the end color.
  // Pull `to` toward `from` for a shorter fade. Push them apart for a longer one.
  const temperatureAreaOpacity = 1;
  const glacierAreaOpacity = 1;

  const temperatureAreaColor = '--color-brown';
  const glacierAreaColor = '--color-light';

  const temperatureGradientFrom = 0.24;
  const temperatureGradientTo = 1.00;

  const glacierGradientFrom = glacierBandTop;
  const glacierGradientTo = glacierAreaBottom;

  const temperatureGradientStops = [
    { offset: '0%',   opacity: 1,    start: 0.00, end: 0.15 },
    { offset: '60%',  opacity: 0.95, start: 0.10, end: 0.40 },
    { offset: '85%',  opacity: 0.50, start: 0.30, end: 0.55 },
    { offset: '100%', opacity: 0,    start: 0.00, end: 0.00 }
  ];
  
  const glacierGradientStops = [
    { offset: '0%',   opacity: 1,    start: 0.00, end: 0.35 },
    { offset: '50%',  opacity: 0.85, start: 0.10, end: 0.50 },
    { offset: '85%',  opacity: 0.35, start: 0.30, end: 0.75 },
    { offset: '100%', opacity: 0,    start: 0.00, end: 0.00 }
  ];

  // Timeline vertical position: smaller = higher, larger = lower
  const timelineYRatio = 1;
  const FULL_TICKS = [1970, 1980, 1990, 2000, 2010, 2020];
  const NARROW_TICKS = [1970, 1980, 1990, 2000, 2010, 2020];

  const svg = d3.select(svgElement);

  function paletteColor(color) {
    if (typeof color === 'string' && color.startsWith('--')) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(color).trim();
      if (value) return value;
    }
    return color;
  }

  // Gradients and clips are created once. Scroll updates clip width and stop opacity.
  const defs = svg.append('defs');

  function addAreaGradient(id, color, stops) {
    const gradient = defs.append('linearGradient')
      .attr('id', id)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0)
      .attr('x2', 0);
    const resolved = paletteColor(color);
    const stopNodes = stops.map((stop) => gradient.append('stop')
      .attr('offset', stop.offset)
      .attr('stop-color', resolved)
      .attr('stop-opacity', 0));
    return { gradient, stopNodes };
  }

  function addAreaClip(id) {
    return defs.append('clipPath')
      .attr('id', id)
      .attr('clipPathUnits', 'userSpaceOnUse')
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 0)
      .attr('height', 0);
  }

  const temperatureAreaFill = addAreaGradient('warming-temperature-gradient', temperatureAreaColor, temperatureGradientStops);
  const glacierAreaFill = addAreaGradient('warming-glacier-gradient', glacierAreaColor, glacierGradientStops);
  const temperatureGradient = temperatureAreaFill.gradient;
  const glacierGradient = glacierAreaFill.gradient;
  const temperatureGradientStopNodes = temperatureAreaFill.stopNodes;
  const glacierGradientStopNodes = glacierAreaFill.stopNodes;
  const temperatureClipRect = addAreaClip('warming-temperature-area-clip');
  const glacierClipRect = addAreaClip('warming-glacier-area-clip');

  const tooltip = chart.querySelector('.warming-tooltip');
  const temperatureTitle = document.querySelector('#warming-title .warming-title-temperature');
  const glacierTitle = document.querySelector('#warming-title .warming-title-glacier');
  const description = document.getElementById('warming-chart-desc');
  const margin = { top: 28, right: 0, bottom: 56, left: 0 };
  let viewportWidth = 1200;
  let viewHeight = 560;
  let plotBottom = viewHeight - margin.bottom;
  let timelineY = plotBottom;
  let temperatureBandPixels = { top: 0, bottom: 0 };
  let glacierBandPixels = { top: 0, bottom: 0 };
  let temperatureAreaBottomY = 0;
  let glacierAreaBottomY = 0;
  let currentTranslateX = 0;
  let currentDrawYear = YEAR_MIN;

  const formatTemperature = d3.format('+0.2f');
  const formatLoss = d3.format('.1f');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let reduceMotion = motionQuery.matches;
  let temperatureData = [];
  let glacierData = [];
  let temperatureYScale = null;
  let glacierLossYScale = null;
  let scrollBound = false;
  let cameraFrame = 0;
  let temperaturePath = null;
  let glacierPath = null;
  let temperaturePathLength = 0;
  let glacierPathLength = 0;

  // Shared calendar scale across the long chart, not the viewport.
  // The axis line starts at 1965 with no label or tick. Temperature is still drawn from 1970, and the axis continues empty to 2030.
  const xScale = d3.scaleLinear()
    .domain([TIMELINE_START, TIMELINE_END])
    .range([0, (TIMELINE_END - TIMELINE_START) * yearSpacing]);

  const chartGroup = svg.append('g').attr('class', 'warming-chart-shift');
  const areaGroup = chartGroup.append('g').attr('class', 'warming-areas').attr('aria-hidden', 'true');
  const seriesGroup = chartGroup.append('g');
  const timeline = chartGroup.append('g')
    .attr('class', 'warming-axis')
    .attr('aria-hidden', 'true');
  const temperatureReader = createReader('temperature', 'is-temperature', tooltip);
  const glacierReader = createReader('glacier', 'is-glacier', null);
  temperatureReader.marker.raise();
  glacierReader.marker.raise();
  const pointerLayer = svg.append('rect')
    .attr('class', 'warming-pointer-layer')
    .attr('fill', 'transparent');

  function finiteNumber(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function columnList(rows) {
    const columns = (rows && rows.columns) || [];
    return columns.length ? columns.join(', ') : '(none)';
  }

  // 1. Load and parse CSV rows. Values are kept as published; nothing is estimated.
  function readAnnualRows(rows, valueKey, yearKey = 'year') {
    const result = {
      points: [],
      invalid: 0,
      outside: 0,
      beforeGlacierStart: 0,
      duplicates: 0
    };
    const seen = new Set();

    rows.forEach((row) => {
      const year = finiteNumber(row[yearKey]);
      const value = finiteNumber(row[valueKey]);
      if (year === null || value === null) {
        result.invalid += 1;
        return;
      }
      if (year < YEAR_MIN || year > YEAR_MAX) {
        result.outside += 1;
        return;
      }
      if (valueKey === 'cumulative_mass_loss_percent' && year < GLACIER_START) {
        result.beforeGlacierStart += 1;
        return;
      }
      if (seen.has(year)) {
        result.duplicates += 1;
        return;
      }
      seen.add(year);
      result.points.push({ year, value });
    });

    result.points.sort((a, b) => a.year - b.year);
    return result;
  }

  function warnRowIssues(datasetName, valueKey, parsed) {
    if (parsed.invalid > 0) {
      console.warn(`[warming] ${datasetName}: skipped ${parsed.invalid} row(s) without a numeric year and ${valueKey}.`);
    }
    if (parsed.outside > 0) {
      console.warn(`[warming] ${datasetName}: skipped ${parsed.outside} row(s) outside ${YEAR_MIN}–${YEAR_MAX}.`);
    }
    if (parsed.beforeGlacierStart > 0) {
      console.warn(`[warming] ${datasetName}: skipped ${parsed.beforeGlacierStart} row(s) before ${GLACIER_START}. Cumulative glacier mass loss is drawn from 2000 onward.`);
    }
    if (parsed.duplicates > 0) {
      console.warn(`[warming] ${datasetName}: ignored ${parsed.duplicates} duplicate year row(s). The first row for each year is kept.`);
    }
  }

  function parseTemperature(rows) {
    if (!rows) return [];
    const columns = rows.columns || [];
    const yearKey = ['Time', 'year'].find((key) => columns.includes(key));
    const valueKey = ['Anomaly (deg C)', 'temperature_anomaly_c'].find((key) => columns.includes(key));
    if (!yearKey || !valueKey) {
      console.warn(`[warming] temperature.csv is missing a year column (Time or year) and an anomaly column ("Anomaly (deg C)" or temperature_anomaly_c). Found columns: ${columnList(rows)}. The temperature curve will not be drawn.`);
      return [];
    }
    if (rows.length === 0) {
      console.warn('[warming] temperature.csv has no annual observations. The temperature curve will not be drawn.');
      return [];
    }
    const parsed = readAnnualRows(rows, valueKey, yearKey);
    warnRowIssues('temperature.csv', valueKey, parsed);
    if (parsed.points.length === 0) {
      console.warn(`[warming] temperature.csv has no usable annual observations for ${YEAR_MIN}–${YEAR_MAX}. The temperature curve will not be drawn.`);
    }
    return parsed.points;
  }

  function parseGlacier(rows) {
    if (!rows) return [];
    const columns = rows.columns || [];
    if (!columns.includes('cumulative_mass_loss_percent')) {
      const quantityNote = columns.includes('mass_change_gt')
        ? ' The column mass_change_gt is a different quantity and was not plotted or converted.'
        : '';
      console.warn(`[warming] glacier-mass.csv is missing required column "cumulative_mass_loss_percent". Found columns: ${columnList(rows)}.${quantityNote} The cumulative glacier mass-loss curve will not be drawn.`);
      return [];
    }
    if (!columns.includes('year')) {
      console.warn('[warming] glacier-mass.csv is missing required column "year". The cumulative glacier mass-loss curve will not be drawn.');
      return [];
    }
    if (rows.length === 0) {
      console.warn('[warming] glacier-mass.csv has column cumulative_mass_loss_percent but no annual observations. The glacier curve will not be drawn.');
      return [];
    }
    const parsed = readAnnualRows(rows, 'cumulative_mass_loss_percent');
    warnRowIssues('glacier-mass.csv', 'cumulative_mass_loss_percent', parsed);
    if (parsed.points.length === 0) {
      console.warn(`[warming] glacier-mass.csv has no usable cumulative_mass_loss_percent observations for ${GLACIER_START}–${YEAR_MAX}. The glacier curve will not be drawn.`);
    }
    // `loss` keeps the published positive percent. `value` is what the chart draws.
    return parsed.points.map((point) => ({
      year: point.year,
      loss: point.value,
      value: GLACIER_DISPLAY_MODE === 'mass-change' ? -point.value : point.value
    }));
  }

  function formatGlacierValue(value) {
    const magnitude = formatLoss(Math.abs(value));
    if (GLACIER_DISPLAY_MODE === 'mass-change' && value < 0) return `−${magnitude}`;
    return magnitude;
  }

  async function loadCsv(url) {
    try {
      return await d3.csv(url, { cache: 'reload' });
    } catch (error) {
      console.error(`[warming] Could not load ${url}. The page will continue without this series.`, error);
      return null;
    }
  }

  // 4. Independent vertical scales. Raw CSV values are not normalized or converted.
  function paddedDomain(values) {
    const min = d3.min(values);
    const max = d3.max(values);
    if (min === max) {
      const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.2 : 1;
      return [min - pad, max + pad];
    }
    const span = max - min;
    return [min - span * 0.08, max + span * 0.18];
  }

  function makeYScale(values, bandPixels) {
    return d3.scaleLinear()
      .domain(paddedDomain(values))
      .range([bandPixels.bottom, bandPixels.top]);
  }

  // The timeline origin sits on the page frame. Section text sits further in, with the page content gutter.
  function readPageContentEdge() {
    const frame = document.querySelector('.page-frame-left');
    if (frame) return frame.getBoundingClientRect().width;
    const frameValue = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-frame-width'));
    return Number.isFinite(frameValue) ? window.innerWidth * frameValue / 100 : 0;
  }

  function layoutViewport() {
    viewportWidth = Math.max(320, Math.round(chart.clientWidth));
    contentEdgeX = readPageContentEdge();
    viewHeight = Math.max(280, Math.round(chart.clientHeight));
    plotBottom = viewHeight - margin.bottom;
    yearSpacing = viewportWidth / yearsPerViewport;
    xScale.range([0, (TIMELINE_END - TIMELINE_START) * yearSpacing]);
    updateScrollTrack();
    svgElement.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewHeight}`);
    const plotHeight = plotBottom - margin.top;
    const yAt = (fraction) => margin.top + plotHeight * fraction;
    timelineY = yAt(timelineYRatio);
    temperatureBandPixels = {
      top: yAt(temperatureBandTop),
      bottom: yAt(temperatureBandBottom)
    };
    glacierBandPixels = {
      top: yAt(glacierBandTop),
      bottom: yAt(glacierBandBottom)
    };
    temperatureAreaBottomY = yAt(temperatureAreaBottom);
    glacierAreaBottomY = yAt(glacierAreaBottom);
    temperatureGradient
      .attr('y1', yAt(temperatureGradientFrom))
      .attr('y2', yAt(temperatureGradientTo));
    glacierGradient
      .attr('y1', yAt(glacierGradientFrom))
      .attr('y2', yAt(glacierGradientTo));
    const clipHeight = viewHeight + 80;
    temperatureClipRect.attr('y', -40).attr('height', clipHeight);
    glacierClipRect.attr('y', -40).attr('height', clipHeight);
    pointerLayer
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', viewportWidth)
      .attr('height', viewHeight);
    timeline.attr('transform', null);
  }

  // 5. Paths are generated once from observed points. Scroll does not rebuild them.
  // The area uses the same curve as its line. `baselineY` is the shared bottom
  // edge; the curve is the upper edge, so both fills extend downward.
  function drawArea(data, yScale, baselineY, areaClass, gradientId, clipId, opacity, baseFill) {
    if (data.length < 2 || !yScale) return;
    const area = d3.area()
      .x((d) => xScale(d.year))
      .y0(baselineY)
      .y1((d) => yScale(d.value))
      .curve(d3.curveLinear);
    const path = area(data);
    if (baseFill) {
      areaGroup.append('path')
        .attr('class', `${areaClass}-base`)
        .attr('fill', baseFill)
        .attr('fill-opacity', 1)
        .attr('stroke', 'none')
        .attr('pointer-events', 'none')
        .attr('clip-path', `url(#${clipId})`)
        .attr('d', path);
    }
    areaGroup.append('path')
      .attr('class', areaClass)
      .attr('fill', `url(#${gradientId})`)
      .attr('fill-opacity', opacity)
      .attr('stroke', 'none')
      .attr('pointer-events', 'none')
      .attr('clip-path', `url(#${clipId})`)
      .attr('d', path);
  }

  function drawSeries(data, yScale, lineClass, pointClass) {
    if (data.length >= 2) {
      const line = d3.line()
        .x((d) => xScale(d.year))
        .y((d) => yScale(d.value))
        .curve(d3.curveLinear);
      return seriesGroup.append('path')
        .attr('class', lineClass)
        .attr('fill', 'none')
        .attr('d', line(data));
    }

    if (data.length === 1) {
      seriesGroup.append('circle')
        .attr('class', pointClass)
        .attr('cx', xScale(data[0].year))
        .attr('cy', yScale(data[0].value))
        .attr('r', 4);
    }
  }

  // 6. Bottom timeline only. Every decade tick uses the same mark.
  function renderTimeline() {
    const years = window.innerWidth < 760 ? NARROW_TICKS : FULL_TICKS;
    const tickLength = 8;
    timeline.call(d3.axisBottom(xScale)
      .tickValues(years)
      .tickFormat((year) => String(year))
      .tickSizeInner(tickLength)
      .tickSizeOuter(0)
      .tickPadding(10));

    // timelineY is the center of the grey stroke. Ticks start at its top edge.
    const originX = xScale(TIMELINE_START);
    const domain = timeline.select('path.domain')
      .attr('d', `M${originX},${timelineY}H${xScale(TIMELINE_END)}`)
      .attr('stroke', 'var(--color-grey)')
      .attr('stroke-linecap', 'butt');
    const timelineStrokeWidth = parseFloat(getComputedStyle(domain.node()).strokeWidth);
    const timelineTopY = timelineY - timelineStrokeWidth / 2;

    timeline.selectAll('.tick')
      .attr('transform', (year) => `translate(${xScale(year)},${timelineY})`);

    timeline.selectAll('.tick line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', timelineTopY - timelineY)
      .attr('y2', tickLength)
      .attr('stroke', 'var(--color-brown)')
      .attr('stroke-linecap', 'butt');

    timeline.selectAll('.tick text')
      .classed('small-text-normal', true)
      .attr('text-anchor', 'middle');
  }

  function updateDescription() {
    const sentence = 'This chart compares global temperature anomaly over the longer historical timeline with cumulative global glacier mass loss beginning in 2000.';
    const scales = ' The lines share a calendar-time axis and use separate vertical scales, so the same height is not the same amount.';
    if (!temperatureData.length && !glacierData.length) {
      description.textContent = `${sentence}${scales} The annual observations are not loaded yet, so the curves are not drawn.`;
      return;
    }
    if (!temperatureData.length) {
      description.textContent = `${sentence}${scales} Temperature observations are not loaded yet.`;
      return;
    }
    if (!glacierData.length) {
      description.textContent = `${sentence}${scales} Cumulative glacier mass-loss observations are not loaded yet.`;
      return;
    }
    description.textContent = `${sentence}${scales}`;
  }

  // Vertical scroll progress, 0 at the top of the sticky sequence and 1 at the end.
  function scrollProgress() {
    const distance = scrolly.offsetHeight - window.innerHeight;
    if (distance <= 0) return 1;
    const travelled = -scrolly.getBoundingClientRect().top;
    return Math.min(1, Math.max(0, travelled / distance));
  }

  // The camera stays still for the first third, then pans the 1965 origin toward the 2030 edge.
  function cameraProgressFor(progress) {
    if (progress <= DRAW_LEAD) return 0;
    return (progress - DRAW_LEAD) / (1 - DRAW_LEAD);
  }

  function cameraTranslate(progress) {
    const cameraProgress = cameraProgressFor(progress);
    const startX = contentEdgeX - xScale(TIMELINE_START);
    const endX = viewportWidth - xScale(TIMELINE_END);
    return startX + cameraProgress * (endX - startX);
  }

  function updateScrollTrack() {
    const track = scrolly.querySelector('.warming-scroll-track');
    if (!track) return;
    const horizontalTravel = cameraTranslate(0) - cameraTranslate(1);
    // The pan occupies the last two thirds, so the stationary draw phase keeps the same pace.
    const travel = horizontalTravel / (1 - DRAW_LEAD);
    const sticky = scrolly.querySelector('.warming-sticky');
    const stickyGap = window.innerHeight - (sticky ? sticky.offsetHeight : window.innerHeight);
    track.style.height = `${Math.max(0, Math.round(travel + stickyGap))}px`;
  }

  // Temperature draws ahead of the camera: 1970 to 1990 in the first third, then on to 2024.
  function drawYear(progress) {
    if (progress <= DRAW_LEAD) {
      return YEAR_MIN + (DRAW_LEAD_YEAR - YEAR_MIN) * (progress / DRAW_LEAD);
    }
    const later = (progress - DRAW_LEAD) / (1 - DRAW_LEAD);
    return Math.min(YEAR_MAX, DRAW_LEAD_YEAR + (YEAR_MAX - DRAW_LEAD_YEAR) * later);
  }

  // Stroke offset follows the cached path length. The path itself is not rebuilt.
  function updateReveal(year) {
    currentDrawYear = year;
    const temperatureProgress = Math.min(1, Math.max(0, (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)));
    if (temperaturePath) {
      temperaturePath.attr('stroke-dashoffset', temperaturePathLength * (1 - temperatureProgress));
    }

    const glacierProgress = year < GLACIER_START
      ? 0
      : Math.min(1, Math.max(0, (year - GLACIER_START) / (YEAR_MAX - GLACIER_START)));
    if (glacierPath) {
      glacierPath.attr('stroke-dashoffset', glacierPathLength * (1 - glacierProgress));
    }

    // Areas open to the same point the stroke has reached. The dash offset is a
    // fraction of path length, so the clip uses that point rather than a raw year x.
    const revealedX = (path, length, progress) => (
      path && length > 0
        ? path.node().getPointAtLength(length * progress).x
        : null
    );
    const temperatureEdge = revealedX(temperaturePath, temperaturePathLength, temperatureProgress);
    temperatureClipRect
      .attr('x', xScale(YEAR_MIN))
      .attr('width', temperatureEdge === null ? 0 : Math.max(0, temperatureEdge - xScale(YEAR_MIN)));
    const glacierEdge = revealedX(glacierPath, glacierPathLength, glacierProgress);
    glacierClipRect
      .attr('x', xScale(GLACIER_START))
      .attr('width', glacierEdge === null || glacierProgress <= 0 ? 0 : Math.max(0, glacierEdge - xScale(GLACIER_START)));

    const applyStopOpacity = (nodes, stops, progress) => {
      nodes.forEach((node, index) => {
        const stop = stops[index];
        if (stop.opacity === 0) {
          node.attr('stop-opacity', 0);
          return;
        }
        const growth = clamp((progress - stop.start) / (stop.end - stop.start), 0, 1);
        node.attr('stop-opacity', stop.opacity * growth);
      });
    };
    applyStopOpacity(temperatureGradientStopNodes, temperatureGradientStops, temperatureProgress);
    applyStopOpacity(glacierGradientStopNodes, glacierGradientStops, glacierProgress);
  }

  function setTitleLine(line, amount) {
    if (!line) return;
    const progress = reduceMotion ? 1 : Math.min(1, Math.max(0, amount));
    line.style.opacity = String(progress);
    line.style.transform = progress === 1 ? 'none' : `translateX(${-35 * (1 - progress)}px)`;
  }

  function updateTitle(progress, year) {
    setTitleLine(temperatureTitle, progress / 0.26);
    setTitleLine(glacierTitle, (year - 1995) / (2002 - 1995));
  }

  function updateCamera() {
    const progress = reduceMotion ? 1 : scrollProgress();
    currentTranslateX = cameraTranslate(progress);
    chartGroup.attr('transform', `translate(${currentTranslateX},0)`);
    updateReveal(drawYear(progress));
    updateTitle(progress, currentDrawYear);
    updateAutoFollower(temperatureReader);
    updateAutoFollower(glacierReader);
    syncReader(temperatureReader);
    syncReader(glacierReader);
  }

  function requestCamera() {
    if (cameraFrame) return;
    cameraFrame = requestAnimationFrame(() => {
      cameraFrame = 0;
      updateCamera();
    });
  }

  function syncScrollBinding() {
    if (reduceMotion && scrollBound) {
      window.removeEventListener('scroll', requestCamera);
      scrollBound = false;
    } else if (!reduceMotion && !scrollBound) {
      window.addEventListener('scroll', requestCamera, { passive: true });
      scrollBound = true;
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // Pointer coordinates are already in the translated chart. The marker slides
  // along the drawn segments; the card still uses the nearest real annual point.
  function revealedPoints(data, minYear) {
    return data.filter((d) => d.year >= minYear && d.year <= currentDrawYear);
  }

  function markerAlong(points, yScale, year) {
    if (points.length === 1) {
      return { x: xScale(points[0].year), y: yScale(points[0].value) };
    }
    const hoverYear = clamp(year, points[0].year, points[points.length - 1].year);
    let upper = d3.bisector((d) => d.year).left(points, hoverYear);
    if (upper <= 0) upper = 1;
    if (upper >= points.length) upper = points.length - 1;
    const previous = points[upper - 1];
    const next = points[upper];
    const span = next.year - previous.year;
    const t = span === 0 ? 0 : clamp((hoverYear - previous.year) / span, 0, 1);
    const y0 = yScale(previous.value);
    const y1 = yScale(next.value);
    return {
      x: xScale(hoverYear),
      y: y0 + t * (y1 - y0)
    };
  }

  function trackSeries(data, yScale, chartX, chartY, threshold, minYear) {
    const points = revealedPoints(data, minYear);
    if (!points.length || !yScale) return null;

    const hoverYear = clamp(xScale.invert(chartX), points[0].year, points[points.length - 1].year);
    const placed = markerAlong(points, yScale, hoverYear);
    const viewportX = placed.x + currentTranslateX;
    if (viewportX < -8 || viewportX > viewportWidth + 8) return null;

    const distance = Math.hypot(chartX - placed.x, chartY - placed.y);
    if (distance > threshold) return null;

    const point = points[d3.bisector((d) => d.year).center(points, hoverYear)];
    if (!point || point.year > currentDrawYear) return null;
    return { placed, point, distance, yearFloat: hoverYear };
  }

  function seriesPoints(series) {
    const data = series === 'temperature' ? temperatureData : glacierData;
    const minYear = series === 'temperature' ? YEAR_MIN : GLACIER_START;
    return data.filter((d) => d.year >= minYear && d.year <= YEAR_MAX);
  }

  function createReader(series, seriesClass, existingTip) {
    const guide = chartGroup.append('line')
      .attr('class', `warming-hover-guide ${seriesClass}`)
      .attr('aria-hidden', 'true');
    const readerMarker = chartGroup.append('circle')
      .attr('class', `warming-hover-marker ${seriesClass}`)
      .attr('r', 10)
      .attr('aria-hidden', 'true');
    const tip = existingTip || document.createElement('div');
    tip.className = `warming-tooltip ${seriesClass}`;
    tip.setAttribute('role', 'status');
    tip.setAttribute('aria-live', 'polite');
    tip.setAttribute('aria-atomic', 'true');
    tip.hidden = true;
    const year = document.createElement('p');
    year.className = 'warming-tooltip-year';
    const seriesName = document.createElement('p');
    seriesName.className = 'warming-tooltip-series';
    const value = document.createElement('p');
    value.className = 'warming-tooltip-value';
    tip.replaceChildren(year, value, seriesName);
    if (!existingTip) chart.append(tip);
    return {
      series,
      guide,
      marker: readerMarker,
      tooltip: tip,
      year,
      seriesName,
      value,
      selection: null,
      hasUserSelection: false,
      needsIntro: false,
      shownYear: null,
      suspended: false
    };
  }

  function hostPoint(chartX, chartY) {
    const point = svgElement.createSVGPoint();
    point.x = chartX;
    point.y = chartY;
    const screen = point.matrixTransform(chartGroup.node().getScreenCTM());
    const hostRect = chart.getBoundingClientRect();
    return {
      x: screen.x - hostRect.left,
      y: screen.y - hostRect.top,
      hostWidth: hostRect.width
    };
  }

  function activeStrokeWidth(series) {
    const path = series === 'temperature' ? temperaturePath : glacierPath;
    const node = path && path.node();
    const width = node ? parseFloat(getComputedStyle(node).strokeWidth) : NaN;
    return Number.isFinite(width) && width > 0 ? width : 14;
  }

  function curveSamples(series) {
    const data = series === 'temperature' ? temperatureData : glacierData;
    const yScale = yScaleFor(series);
    const minYear = series === 'temperature' ? YEAR_MIN : GLACIER_START;
    if (!yScale) return [];
    return revealedPoints(data, minYear).map((d) => hostPoint(xScale(d.year), yScale(d.value)));
  }

  // Straight annual segments. The highest point inside an x span is an endpoint of the clipped segment.
  function highestCurveY(samples, x0, x1) {
    if (!samples.length) return null;
    let minY = null;
    const consider = (y) => {
      if (minY === null || y < minY) minY = y;
    };
    if (samples.length === 1) {
      const only = samples[0];
      if (only.x >= x0 && only.x <= x1) consider(only.y);
      return minY;
    }
    for (let i = 1; i < samples.length; i += 1) {
      const a = samples[i - 1];
      const b = samples[i];
      const left = a.x <= b.x ? a : b;
      const right = a.x <= b.x ? b : a;
      if (right.x < x0 || left.x > x1) continue;
      const span = right.x - left.x;
      const yAt = (x) => (
        span === 0
          ? Math.min(left.y, right.y)
          : left.y + ((x - left.x) / span) * (right.y - left.y)
      );
      consider(Math.min(yAt(Math.max(left.x, x0)), yAt(Math.min(right.x, x1))));
    }
    return minY;
  }

  function placeTooltip(reader, chartX, chartY) {
    // Mass panels stay above their curve, including above the SVG bounds when needed.
    const pointGap = reader.series === 'glacier' ? 10 : 18;
    const curveGap = reader.series === 'glacier' ? 4 : 12;
    const topPad = 16;
    const sidePad = 8;
    const shiftLimit = 72;
    const anchor = hostPoint(chartX, chartY);
    const tooltip = reader.tooltip;
    tooltip.hidden = false;
    const tipWidth = tooltip.offsetWidth;
    const tipHeight = tooltip.offsetHeight;
    const maxLeft = Math.max(sidePad, anchor.hostWidth - tipWidth - sidePad);
    let left = clamp(anchor.x - tipWidth / 2, sidePad, maxLeft);
    let top = anchor.y - tipHeight - pointGap;

    const stroke = activeStrokeWidth(reader.series);
    const clearance = curveGap + stroke / 2;
    const xPad = stroke / 2;
    const samples = curveSamples(reader.series);
    const curveTop = (candidateLeft) => highestCurveY(samples, candidateLeft - xPad, candidateLeft + tipWidth + xPad);
    const clearedTop = curveTop(left);
    if (clearedTop !== null) {
      const requiredTop = clearedTop - clearance - tipHeight;
      if (requiredTop < top) top = requiredTop;
    }

    if (reader.series !== 'glacier' && top < topPad) {
      top = topPad;
      const bottom = top + tipHeight;
      const overlaps = (candidateLeft) => {
        const minY = curveTop(candidateLeft);
        return minY !== null && bottom > minY - clearance;
      };
      if (overlaps(left)) {
        for (let step = 8; step <= shiftLimit; step += 8) {
          const clear = [left - step, left + step].find((value) => (
            value >= sidePad && value <= maxLeft && !overlaps(value)
          ));
          if (clear !== undefined) {
            left = clear;
            break;
          }
        }
      }
      // A taller panel may not fit above the curve. Keep the marker visible
      // by placing the panel just below this curve instead of covering it.
      if (overlaps(left)) {
        const belowCurve = highestCurveY(samples.map((p) => ({ x: p.x, y: -p.y })), left - xPad, left + tipWidth + xPad);
        top = Math.max(anchor.y + 20, belowCurve === null ? 0 : -belowCurve + clearance);
      }
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function showHover(event) {
    const threshold = event.pointerType === 'touch' ? TOUCH_THRESHOLD : HOVER_THRESHOLD;
    const [pointerX, pointerY] = d3.pointer(event, chartGroup.node());
    const temperatureHit = trackSeries(temperatureData, temperatureYScale, pointerX, pointerY, threshold, YEAR_MIN);
    const glacierHit = trackSeries(glacierData, glacierLossYScale, pointerX, pointerY, threshold, GLACIER_START);

    let hit = null;
    let series = '';
    if (temperatureHit && glacierHit) {
      series = glacierHit.distance < temperatureHit.distance ? 'glacier' : 'temperature';
      hit = series === 'glacier' ? glacierHit : temperatureHit;
    } else if (temperatureHit) {
      hit = temperatureHit;
      series = 'temperature';
    } else if (glacierHit) {
      hit = glacierHit;
      series = 'glacier';
    }

    if (!hit) return;

    const reader = series === 'temperature' ? temperatureReader : glacierReader;
    reader.hasUserSelection = true;
    reader.needsIntro = false;
    reader.suspended = false;
    setMarkOpacity(reader, 1);
    reader.tooltip.style.transition = 'none';
    reader.tooltip.style.opacity = '1';
    reader.selection = {
      markerYearFloat: hit.yearFloat,
      markerX: hit.placed.x,
      markerY: hit.placed.y,
      datum: hit.point
    };
    reader.guide
      .classed('is-visible', true)
      .attr('x1', hit.placed.x)
      .attr('x2', hit.placed.x)
      .attr('y1', hit.placed.y)
      .attr('y2', timelineY);
    reader.marker
      .classed('is-visible', true)
      .attr('cx', hit.placed.x)
      .attr('cy', hit.placed.y)
      .raise();
    showAnnotation(reader, hit.point);
  }

  function writeAnnotation(reader, point) {
    reader.year.textContent = String(point.year);
    reader.seriesName.textContent = reader.series === 'temperature'
      ? 'GLOBAL TEMPERATURE ANOMALY'
      : (GLACIER_DISPLAY_MODE === 'mass-change'
        ? 'CUMULATIVE GLACIER MASS CHANGE'
        : 'CUMULATIVE GLACIER MASS LOST');
    reader.value.textContent = reader.series === 'temperature'
      ? `${formatTemperature(point.value)} °C`
      : `${formatGlacierValue(point.value)} %`;
  }

  function showAnnotation(reader, point) {
    if (reader.shownYear !== point.year || reader.tooltip.hidden) {
      writeAnnotation(reader, point);
      reader.shownYear = point.year;
    }
    reader.tooltip.style.transition = 'none';
    placeTooltip(reader, xScale(point.year), yScaleFor(reader.series)(point.value));
  }

  function yScaleFor(series) {
    return series === 'temperature' ? temperatureYScale : glacierLossYScale;
  }

  function followWindow(series) {
    return series === 'temperature' ? TEMPERATURE_FOLLOW : GLACIER_FOLLOW;
  }

  function clearAutoReader(reader) {
    reader.selection = null;
    reader.autoOpacity = 0;
    reader.shownYear = null;
    hideReaderVisual(reader);
  }

  function autoFollowTarget(reader) {
    const follow = followWindow(reader.series);
    const curveStart = reader.series === 'temperature' ? YEAR_MIN : GLACIER_START;
    if (currentDrawYear + 1e-6 < follow.activate) return null;
    const points = seriesPoints(reader.series);
    const yScale = yScaleFor(reader.series);
    if (!points.length || !yScale) return null;
    const opacity = reduceMotion
      ? 1
      : clamp((currentDrawYear - follow.activate) / (follow.fadeEnd - follow.activate), 0, 1);
    if (opacity <= 0) return null;
    const revealed = points.filter((d) => d.year <= currentDrawYear + 1e-6);
    if (!revealed.length) return null;
    if (reduceMotion) {
      const datum = revealed[revealed.length - 1];
      return { markerYear: datum.year, datum, opacity };
    }
    const markerYear = curveStart + (currentDrawYear - curveStart) * (2 / 3);
    const datum = revealed[d3.bisector((d) => d.year).center(revealed, markerYear)];
    return { markerYear, datum, opacity };
  }

  function updateAutoFollower(reader) {
    if (reader.hasUserSelection) return;
    const target = autoFollowTarget(reader);
    if (!target) {
      clearAutoReader(reader);
      return;
    }
    const yScale = yScaleFor(reader.series);
    const placed = markerAlong(seriesPoints(reader.series), yScale, target.markerYear);
    reader.autoOpacity = target.opacity;
    reader.selection = {
      markerYearFloat: target.markerYear,
      markerX: placed.x,
      markerY: placed.y,
      datum: target.datum
    };
  }

  function setMarkOpacity(reader, opacity) {
    const value = String(opacity);
    reader.guide.node().style.transition = 'none';
    reader.marker.node().style.transition = 'none';
    reader.guide.node().style.opacity = value;
    reader.marker.node().style.opacity = value;
  }

  function renderFollowingReader(reader, placed) {
    const opacity = reader.autoOpacity;
    setMarkOpacity(reader, opacity);
    reader.guide
      .classed('is-visible', true)
      .attr('x1', placed.x)
      .attr('x2', placed.x)
      .attr('y1', placed.y)
      .attr('y2', timelineY);
    reader.marker
      .classed('is-visible', true)
      .attr('cx', placed.x)
      .attr('cy', placed.y)
      .raise();
    showAnnotation(reader, reader.selection.datum);
    reader.tooltip.style.opacity = String(opacity);
  }

  function hideReaderVisual(reader) {
    reader.guide.classed('is-visible', false);
    reader.marker.classed('is-visible', false);
    reader.tooltip.hidden = true;
  }

  function syncReader(reader) {
    if (!reader.selection) return;
    const points = seriesPoints(reader.series);
    const yScale = yScaleFor(reader.series);
    if (!points.length || !yScale) return;
    const placed = markerAlong(points, yScale, reader.selection.markerYearFloat);
    reader.selection.markerX = placed.x;
    reader.selection.markerY = placed.y;
    const viewportX = placed.x + currentTranslateX;
    const revealedAt = Math.max(reader.selection.datum.year, reader.selection.markerYearFloat);
    const available = revealedAt <= currentDrawYear + 1e-6
      && viewportX >= 0
      && viewportX <= viewportWidth;
    if (!available) {
      reader.suspended = true;
      hideReaderVisual(reader);
      return;
    }
    if (!reader.hasUserSelection) {
      reader.suspended = false;
      renderFollowingReader(reader, placed);
      return;
    }
    const restored = reader.suspended;
    reader.suspended = false;
    reader.guide
      .classed('is-visible', true)
      .attr('x1', placed.x)
      .attr('x2', placed.x)
      .attr('y1', placed.y)
      .attr('y2', timelineY);
    reader.marker
      .classed('is-visible', true)
      .attr('cx', placed.x)
      .attr('cy', placed.y);
    showAnnotation(reader, reader.selection.datum);
    if (!restored) return;
    reader.tooltip.style.transition = 'none';
    setMarkOpacity(reader, 1);
    reader.tooltip.style.opacity = '1';
  }

  function bindPointer() {
    let touchOrigin = null;
    pointerLayer
      .on('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        showHover(event);
      })
      .on('pointerdown', (event) => {
        if (event.pointerType !== 'touch') return;
        touchOrigin = { x: event.clientX, y: event.clientY };
      })
      .on('pointerup', (event) => {
        if (event.pointerType !== 'touch' || !touchOrigin) return;
        const dx = event.clientX - touchOrigin.x;
        const dy = event.clientY - touchOrigin.y;
        touchOrigin = null;
        if (dx * dx + dy * dy > 144) return;
        showHover(event);
      });
  }

  function prepareStroke(path) {
    const length = path.node().getTotalLength();
    path
      .attr('stroke-dasharray', `${length} ${length}`)
      .attr('stroke-dashoffset', length);
    return length;
  }

  function renderSeries() {
    temperaturePath = null;
    glacierPath = null;
    temperaturePathLength = 0;
    glacierPathLength = 0;

    // Painter order: glacier fill, opaque temperature base, temperature gradient,
    // glacier line, temperature line. Areas are drawn before lines.
    if (glacierData.length) {
      // Larger display values sit higher. In mass-change mode those values are
      // negative, so 2000 (0%) is the high point and 2024 is the low point.
      glacierLossYScale = makeYScale(glacierData.map((d) => d.value), glacierBandPixels);
      drawArea(
        glacierData,
        glacierLossYScale,
        glacierAreaBottomY,
        'warming-glacier-area',
        'warming-glacier-gradient',
        'warming-glacier-area-clip',
        glacierAreaOpacity
      );
      glacierPath = drawSeries(glacierData, glacierLossYScale, 'warming-glacier-line', 'warming-glacier-point');
      if (glacierPath) glacierPathLength = prepareStroke(glacierPath);
    }

    if (temperatureData.length) {
      temperatureYScale = makeYScale(temperatureData.map((d) => d.value), temperatureBandPixels);
      drawArea(
        temperatureData,
        temperatureYScale,
        temperatureAreaBottomY,
        'warming-temperature-area',
        'warming-temperature-gradient',
        'warming-temperature-area-clip',
        temperatureAreaOpacity,
        'var(--color-dark-blue)'
      );
      temperaturePath = drawSeries(temperatureData, temperatureYScale, 'warming-temperature-line', 'warming-temperature-point');
      if (temperaturePath) temperaturePathLength = prepareStroke(temperaturePath);
    }
  }

  // 2. Initialize the SVG, then 10. keep the timeline readable on resize.
  async function loadAndRender() {
    const [temperatureRows, glacierRows] = await Promise.all([
      loadCsv('data/temperature.csv'),
      loadCsv('data/glacier-mass.csv')
    ]);

    temperatureData = parseTemperature(temperatureRows);
    glacierData = parseGlacier(glacierRows);
    chart.classList.toggle('is-interactive', temperatureData.length + glacierData.length > 0);
    updateDescription();
    drawChart();
    bindPointer();
    syncScrollBinding();
    updateCamera();

    window.addEventListener('resize', () => {
      drawChart();
      updateCamera();
    });

    motionQuery.addEventListener('change', (event) => {
      reduceMotion = event.matches;
      syncScrollBinding();
      updateCamera();
    });
  }

  function drawChart() {
    layoutViewport();
    areaGroup.selectAll('*').remove();
    seriesGroup.selectAll('*').remove();
    renderSeries();
    renderTimeline();
    temperatureReader.marker.raise();
    glacierReader.marker.raise();
  }

  loadAndRender();
}

initWarmingChart();

// ========================================
// MAP PROJECTION ALIGNMENT — VISUAL TUNING
// ========================================
// world-map.svg is a Robinson projection centered on Greenwich.
// d3.geoRobinson scale is pixels per radian on the equator.
// 436.57 × π = 1372 px, the measured distance from Greenwich to ±180°.
// translateX moves the whole glacier overlay horizontally.
const GLACIER_MAP_PROJECTION = {
  scale: 436.57,
  translateX: 1275,
  translateY: 760,
  // Sample constant-latitude and constant-longitude box edges at this spacing.
  edgeStepDegrees: 2
};

// SVG user units added to each marker after its projected visual center.
// Change x/y here to nudge one number without moving the region.
const REGION_LABEL_OFFSETS = {
  "01": { x: -60, y: -40 },
  "02": { x: 40, y: 0 },
  "03": { x: 0, y: 0 },
  "04": { x: 0, y: 0 },
  "05": { x: 0, y: 0 },
  "06": { x: 0, y: 0 },
  "07": { x: 0, y: 0 },
  "08": { x: 0, y: 0 },
  "09": { x: 0, y: 0 },
  "10": { x: 0, y: 0 },
  "11": { x: 0, y: 0 },
  "12": { x: 0, y: 0 },
  "13": { x: 0, y: -40 },
  "14": { x: -30, y: 0 },
  "15": { x: 0, y: 0 },
  "16": { x: 300, y: 0 },
  "17": { x: 0, y: 0 },
  "18": { x: 0, y: 0 },
  "19": { x: 0, y: -80 }
};

function initGlacierMap() {
  const host = document.getElementById('glacier-map');
  if (!host) return;
  if (typeof d3 === 'undefined' || typeof d3.geoRobinson !== 'function') {
    console.error('[glacier-map] d3.geoRobinson did not load. The world map was not drawn.');
    return;
  }

  const projection = d3.geoRobinson()
    .scale(GLACIER_MAP_PROJECTION.scale)
    .translate([GLACIER_MAP_PROJECTION.translateX, GLACIER_MAP_PROJECTION.translateY]);
  const drawRegion = d3.geoPath(projection);

  loadGlacierMap(host, projection, drawRegion);
}

// Longitude/latitude boxes are stored as corners. A span such as -100° to 142°
// at one latitude is that parallel, in the direction written in the ring,
// including when that direction is the long way around the globe.
function densifyGlacierGeometry(geometry) {
  if (!geometry) return geometry;
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map(densifyGlacierRing) };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon) => polygon.map(densifyGlacierRing))
    };
  }
  return geometry;
}

function densifyGlacierRing(ring) {
  if (!ring || ring.length < 2) return ring;
  const step = GLACIER_MAP_PROJECTION.edgeStepDegrees;
  const densified = [];
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [lon1, lat1] = ring[index];
    const [lon2, lat2] = ring[index + 1];
    densified.push([lon1, lat1]);
    if (sameGeographic(lat1, lat2) && !sameGeographic(lon1, lon2)) {
      const span = lon2 - lon1;
      const count = Math.floor(Math.abs(span) / step);
      const direction = Math.sign(span);
      for (let sample = 1; sample < count; sample += 1) {
        densified.push([lon1 + direction * step * sample, lat1]);
      }
    } else if (sameGeographic(lon1, lon2) && !sameGeographic(lat1, lat2)) {
      const span = lat2 - lat1;
      const count = Math.floor(Math.abs(span) / step);
      const direction = Math.sign(span);
      for (let sample = 1; sample < count; sample += 1) {
        densified.push([lon1, lat1 + direction * step * sample]);
      }
    }
  }
  densified.push(ring[ring.length - 1]);
  return densified;
}

function sameGeographic(a, b) {
  return Math.abs(a - b) <= 1e-6;
}

// The drawn Robinson outline is the map's antimeridian. A vertex whose
// longitude falls west of that outline is the same place seen from the
// opposite edge, so it is shifted by 360° and drawn on the right.
function indexOutline(path) {
  const samples = [];
  const length = path.getTotalLength();
  let minX = Infinity;
  let maxX = -Infinity;
  for (let distance = 0; distance <= length; distance += 1.25) {
    const point = path.getPointAtLength(Math.min(distance, length));
    samples.push(point);
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
  }
  return { samples, center: (minX + maxX) / 2 };
}

// A single y can land on only one side of the oval. Keep samples west of
// the outline center so the right-hand meridian is never used as the cut.
function outlineLeft(outline, y) {
  const windows = [2.5, 8];
  for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
    const window = windows[windowIndex];
    let best = null;
    outline.samples.forEach((point) => {
      if (Math.abs(point.y - y) > window || point.x > outline.center) return;
      if (best == null || point.x < best) best = point.x;
    });
    if (best != null) return best;
  }
  return null;
}

function seamLongitudeAt(projection, outline, lat) {
  const origin = projection([0, lat]);
  const east = projection([180, lat]);
  if (!origin || !east) return -180;
  const left = outlineLeft(outline, origin[1]);
  const half = east[0] - origin[0];
  if (left == null || !half) return -180;
  const lon = ((left - origin[0]) / half) * 180;
  // The visible cut sits just east of -180°. A value in the interior means
  // the outline sample was wrong; leave that latitude uncut.
  if (lon < -180 || lon > -120) return -180;
  return lon;
}

function makeSeamLongitude(projection, outline) {
  const cache = new Map();
  return function seamLongitude(lat) {
    const key = Math.round(lat * 10) / 10;
    if (!cache.has(key)) cache.set(key, seamLongitudeAt(projection, outline, lat));
    return cache.get(key);
  };
}

function crossingOnSeam(start, end, seamLongitude) {
  const westOf = (lon, lat) => lon < seamLongitude(lat) - 1e-6;
  const startWest = westOf(start[0], start[1]);
  let low = 0;
  let high = 1;
  for (let step = 0; step < 28; step += 1) {
    const middle = (low + high) / 2;
    const lon = start[0] + (end[0] - start[0]) * middle;
    const lat = start[1] + (end[1] - start[1]) * middle;
    if (westOf(lon, lat) === startWest) low = middle;
    else high = middle;
  }
  const lat = start[1] + (end[1] - start[1]) * ((low + high) / 2);
  return [seamLongitude(lat), lat];
}

function closeSeamPiece(piece, seamLongitude) {
  const points = piece.points.slice();
  const first = points[0];
  const last = points[points.length - 1];
  const alreadyClosed = Math.abs(first[0] - last[0]) < 1e-4 && Math.abs(first[1] - last[1]) < 1e-4;
  if (!alreadyClosed) {
    const steps = Math.max(1, Math.round(Math.abs(first[1] - last[1]) / GLACIER_MAP_PROJECTION.edgeStepDegrees));
    for (let step = 1; step <= steps; step += 1) {
      const lat = last[1] + ((first[1] - last[1]) * step) / steps;
      let lon = seamLongitude(lat);
      if (piece.west) lon += 360;
      points.push([lon, lat]);
    }
  }
  if (points.length < 4) return null;
  const end = points[points.length - 1];
  if (Math.abs(end[0] - points[0][0]) > 1e-4 || Math.abs(end[1] - points[0][1]) > 1e-4) {
    points.push(points[0].slice());
  }
  return points;
}

function splitRingAtSeam(ring, seamLongitude) {
  const last = ring.length - 1;
  const closed = last > 0
    && Math.abs(ring[0][0] - ring[last][0]) < 1e-6
    && Math.abs(ring[0][1] - ring[last][1]) < 1e-6;
  const count = closed ? last : ring.length;
  const westOf = (lon, lat) => lon < seamLongitude(lat) - 1e-6;
  const located = (lon, lat, west) => [west ? lon + 360 : lon, lat];
  const pieces = [];
  let current = null;

  for (let index = 0; index < count; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % count];
    const startWest = westOf(start[0], start[1]);
    const endWest = westOf(end[0], end[1]);
    if (!current) current = { west: startWest, points: [located(start[0], start[1], startWest)] };
    if (startWest === endWest) {
      current.points.push(located(end[0], end[1], endWest));
    } else {
      const hit = crossingOnSeam(start, end, seamLongitude);
      current.points.push(located(hit[0], hit[1], startWest));
      pieces.push(current);
      current = {
        west: endWest,
        points: [located(hit[0], hit[1], endWest), located(end[0], end[1], endWest)]
      };
    }
  }
  if (current) pieces.push(current);

  if (pieces.length > 1 && pieces[0].west === pieces[pieces.length - 1].west) {
    const tail = pieces.pop();
    pieces[0].points = tail.points.concat(pieces[0].points.slice(1));
  }

  const east = [];
  const west = [];
  pieces.forEach((piece) => {
    const closedRing = closeSeamPiece(piece, seamLongitude);
    if (!closedRing) return;
    (piece.west ? west : east).push(closedRing);
  });
  return { east, west };
}

function geometryHasSeamVertex(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => rings.some((ring) => ring.some(([lon, lat]) => (
    Math.abs(Math.abs(lon) - 180) < 0.05 || lat <= -89.5 || lat >= 89.5
  ))));
}

// Robinson x is linear in longitude. Longitudes past +180° must stay on the
// right edge; projection() folds them back to the west side of ±180°.
function projectPlanar(point, projection) {
  const [lon, lat] = point;
  const origin = projection([0, lat]);
  if (!origin) return null;
  if (lon >= -180 && lon <= 180) return projection(point);
  const east = projection([180, lat]);
  return [origin[0] + (lon / 180) * (east[0] - origin[0]), origin[1]];
}

function pathFromRing(ring, projection) {
  let path = '';
  let started = false;
  ring.forEach((point) => {
    const projected = projectPlanar(point, projection);
    if (!projected) return;
    path += `${started ? 'L' : 'M'}${projected[0]},${projected[1]}`;
    started = true;
  });
  return `${path}Z`;
}

function pathFromGeometry(geometry, projection) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((rings) => rings.map((ring) => pathFromRing(ring, projection)).join('')).join('');
}

// Region 16 is not split: its long parallels stay between -100° and 142°.
function prepareGlacierFeature(feature, projection, outline) {
  const densified = {
    type: 'Feature',
    properties: feature.properties,
    geometry: densifyGlacierGeometry(feature.geometry)
  };
  if (feature.properties.region_id === '16' || !outline) {
    return { feature: densified, westRings: [], direct: false };
  }

  const seamLongitude = makeSeamLongitude(projection, outline);
  const geometry = densified.geometry;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const eastPolygons = [];
  const westRings = [];
  let crossed = false;

  polygons.forEach((rings) => {
    const outer = splitRingAtSeam(rings[0], seamLongitude);
    if (!outer.west.length) {
      eastPolygons.push(rings);
      return;
    }
    crossed = true;
    const holes = rings.slice(1).filter((hole) => !hole.some(([lon, lat]) => lon < seamLongitude(lat) - 1e-6));
    outer.east.forEach((ring, index) => {
      eastPolygons.push(index === 0 ? [ring, ...holes] : [ring]);
    });
    if (!outer.east.length && holes.length) eastPolygons.push([rings[0], ...holes]);
    outer.west.forEach((ring) => westRings.push(ring));
  });

  if (!crossed) {
    return { feature: densified, westRings: [], direct: geometryHasSeamVertex(geometry) };
  }

  const eastGeometry = eastPolygons.length === 1
    ? { type: 'Polygon', coordinates: eastPolygons[0] }
    : { type: 'MultiPolygon', coordinates: eastPolygons };
  return {
    feature: { type: 'Feature', properties: feature.properties, geometry: eastGeometry },
    westRings,
    direct: true
  };
}

const REGION_MASS_FIELDS = [
  'mass_2000_gt',
  'mass_change_2000_2024_gt',
  'mass_lost_2000_2024_gt',
  'mass_2024_gt',
  'mass_lost_percent'
];

function parseRegionMassRow(row) {
  const parsed = {
    region_id: regionKey(row.region_id),
    region: row.region
  };
  REGION_MASS_FIELDS.forEach((field) => {
    parsed[field] = Number(row[field]);
  });
  return parsed;
}

function regionMassRowIsComplete(row) {
  return REGION_MASS_FIELDS.every((field) => Number.isFinite(row[field]));
}

async function loadGlacierMap(host, projection, drawRegion) {
  let svgText;
  let regions;
  let massRows;
  try {
    svgText = await readMapAsset('assets/svg/world-map.svg', 'world-map.svg');
    regions = JSON.parse(await readMapAsset('data/glacier-regions-19.geojson', 'glacier-regions-19.geojson'));
    massRows = d3.csvParse(await readMapAsset('data/glacier-mass-by-region.csv', 'glacier-mass-by-region.csv'))
      .map(parseRegionMassRow);
  } catch (error) {
    console.error('[glacier-map] Failed to load the world map, glacier regions, or regional mass table. The schematic map was not restored.', error);
    return;
  }

  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const sourceSvg = parsed.documentElement;
  if (parsed.querySelector('parsererror') || !sourceSvg || sourceSvg.localName !== 'svg') {
    console.error('[glacier-map] world-map.svg could not be parsed as SVG. The schematic map was not restored.');
    return;
  }

  const features = regions && regions.features;
  if (!Array.isArray(features)) {
    console.error('[glacier-map] glacier-regions-19.geojson has no features array. The schematic map was not restored.');
    return;
  }

  const svg = document.importNode(sourceSvg, true);
  // Share this exact projection with the Nepal glacier/location layers.
  svg.glacierProjection = projection;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'World map with 19 glacier regions');
  // Country <title> nodes in the source map show as native tooltips. Region info stays on hover only.
  svg.querySelectorAll('title').forEach((title) => title.remove());

  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.setAttribute('class', 'glacier-regions-layer');
  svg.appendChild(layer);
  // The ocean outline can only be measured once the SVG is in the document.
  host.replaceChildren(svg);

  const massById = new Map(massRows.map((row) => [row.region_id, row]));
  const missingIds = [];
  const ocean = svg.querySelector('#ocean');
  const outline = ocean && ocean.getTotalLength() > 0 ? indexOutline(ocean) : null;
  const preparedRegions = features.map((feature) => prepareGlacierFeature(feature, projection, outline));

  if (ocean) {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(svgNamespace, 'defs');
    const clip = document.createElementNS(svgNamespace, 'clipPath');
    clip.setAttribute('id', 'glacier-region-clip');
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const oceanClip = ocean.cloneNode(true);
    oceanClip.removeAttribute('id');
    oceanClip.removeAttribute('class');
    clip.appendChild(oceanClip);
    defs.appendChild(clip);
    svg.insertBefore(defs, svg.firstChild);
    layer.setAttribute('clip-path', 'url(#glacier-region-clip)');
  }

  d3.select(layer)
    .selectAll('path.glacier-region')
    .data(preparedRegions)
    .join('path')
    .attr('class', 'glacier-region')
    .attr('data-region-id', (region) => region.feature.properties.region_id)
    .attr('data-region-name', (region) => region.feature.properties.name)
    .each(function attachRegionMass(region) {
      const row = massById.get(regionKey(region.feature.properties.region_id));
      const node = d3.select(this);
      if (!row || !regionMassRowIsComplete(row)) {
        missingIds.push(region.feature.properties.region_id);
        node.attr('data-mass-loss', null);
        return;
      }
      REGION_MASS_FIELDS.forEach((field) => {
        node.attr(`data-${field.replace(/_/g, '-')}`, row[field]);
      });
      // Existing hover still reads this attribute. The value now comes from the new CSV.
      node.attr('data-mass-loss', row.mass_lost_percent);
    })
    .attr('d', (region) => {
      const east = region.direct
        ? pathFromGeometry(region.feature.geometry, projection)
        : drawRegion(region.feature);
      const west = region.westRings.map((ring) => pathFromRing(ring, projection)).join('');
      return `${east}${west}`;
    });

  if (outline) appendGlacierSeamPatches(svg, layer, outline);
  appendGlacierRegionOutlines(layer, preparedRegions, projection, outline);
  appendGlacierRegionMarkers(layer, preparedRegions, projection);

  if (features.length !== 19 || massRows.length !== 19 || massById.size !== 19 || missingIds.length) {
    console.error('[glacier-map] Expected 19 glacier regions joined to 19 regional mass rows.', {
      geojsonFeatures: features.length,
      csvRows: massRows.length,
      joinedIds: massById.size,
      unmatchedRegionIds: missingIds
    });
  }

  const readout = document.createElement('div');
  readout.className = 'glacier-region-readout';
  readout.setAttribute('role', 'tooltip');
  readout.hidden = true;
  readout.innerHTML = `<h3 class="map-readout-title small-text-normal"></h3>
    <svg class="map-readout-triangle" viewBox="0 0 160 86" aria-hidden="true">
      <path class="map-readout-remaining" d="M80 0 160 86H0Z"/>
      <path class="map-readout-lost" d="M80 0 160 86H0Z"/>
    </svg>
    <strong class="map-readout-percent"></strong>
    <span class="map-readout-caption">glacier mass lost</span>`;
  const readoutTitle = readout.querySelector('.map-readout-title');
  const readoutLoss = readout.querySelector('.map-readout-lost');
  const readoutPercent = readout.querySelector('.map-readout-percent');
  let readoutRegionId = null;
  host.appendChild(readout);

  svg.addEventListener('pointermove', (event) => {
    const region = event.target.closest && event.target.closest('.glacier-region, .glacier-region-marker');
    svg.querySelectorAll('.glacier-region.is-hovered').forEach((item) => item.classList.remove('is-hovered'));
    if (!region || !svg.contains(region) || !region.dataset.massLoss || host.classList.contains('is-region-panel-open')) {
      readout.hidden = true;
      return;
    }
    svg.querySelectorAll(`.glacier-region[data-region-id="${region.dataset.regionId}"]`).forEach((item) => {
      item.classList.add('is-hovered');
    });
    readout.hidden = false;
    if (readoutRegionId !== region.dataset.regionId) {
      readoutRegionId = region.dataset.regionId;
      const row = massById.get(regionKey(readoutRegionId));
      const lossPercent = row && row.mass_2000_gt > 0
        ? row.mass_lost_2000_2024_gt / row.mass_2000_gt * 100
        : Number(region.dataset.massLoss);
      const fraction = Math.max(0, Math.min(1, lossPercent / 100));
      readoutTitle.textContent = region.dataset.regionName;
      readoutPercent.textContent = `${lossPercent.toLocaleString('en', { maximumFractionDigits: 2 })}%`;
      // Match the brown AREA to the loss percentage, not the triangle's height.
      readoutLoss.style.clipPath = `inset(${Math.sqrt(1 - fraction) * 100}% 0 0)`;
      readout.setAttribute('aria-label', `${region.dataset.regionName}: ${readoutPercent.textContent} glacier mass lost, 2000–2024`);
    }
    const bounds = host.getBoundingClientRect();
    const labelWidth = readout.offsetWidth;
    const labelHeight = readout.offsetHeight;
    const left = Math.max(8, bounds.left + 8);
    const right = Math.min(window.innerWidth - 8, bounds.right - 8);
    const top = Math.max(8, bounds.top + 8);
    const bottom = Math.min(window.innerHeight - 8, bounds.bottom - 8);
    const x = Math.max(left, Math.min(event.clientX + 16, right - labelWidth)) - bounds.left;
    const preferredY = event.clientY + 16 + labelHeight > bottom
      ? event.clientY - labelHeight - 16 : event.clientY + 16;
    const y = Math.max(top, Math.min(preferredY, bottom - labelHeight)) - bounds.top;
    readout.style.left = `${x}px`;
    readout.style.top = `${y}px`;
  });
  svg.addEventListener('pointerleave', () => {
    readout.hidden = true;
    svg.querySelectorAll('.glacier-region.is-hovered').forEach((item) => item.classList.remove('is-hovered'));
  });
}

// Display-only bridges for the wrapped right edge of regions 10 and 19.
// Geographic coordinates, the projection, and the other regions stay as they are.
function appendGlacierSeamPatches(svg, layer, oceanOutline) {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(svgNamespace, 'defs'), svg.firstChild);
  const patches = document.createElementNS(svgNamespace, 'g');
  patches.setAttribute('class', 'glacier-region-seam-patches');
  patches.setAttribute('clip-path', 'url(#glacier-region-clip)');
  layer.appendChild(patches);

  ['10', '19'].forEach((id) => {
    const regionPath = layer.querySelector(`.glacier-region[data-region-id="${id}"]`);
    const box = regionPath && wrappedSubpathBox(regionPath.getAttribute('d'));
    if (!box) return;
    const bridge = seamBridge(regionPath, oceanOutline, box.minY, box.maxY);
    if (!bridge) return;

    regionPath.classList.add('has-seam-patch');
    const unionD = `${regionPath.getAttribute('d')}${bridge.fill}`;
    const bridgeShape = maskPath(svgNamespace, bridge.fill, 'none');
    bridgeShape.setAttribute('class', 'glacier-seam-bridge');
    defs.appendChild(bridgeShape);

    const fillMask = document.createElementNS(svgNamespace, 'mask');
    const fillMaskId = `glacier-union-fill-${id}`;
    fillMask.setAttribute('id', fillMaskId);
    fillMask.setAttribute('maskUnits', 'userSpaceOnUse');
    fillMask.append(
      maskRect(svgNamespace, 'black'),
      maskPath(svgNamespace, unionD, 'white')
    );
    layer.querySelectorAll('.glacier-region:not(.has-seam-patch)').forEach((other) => {
      if (!regionCovers(svg, other, bridgeShape)) return;
      fillMask.appendChild(maskPath(svgNamespace, other.getAttribute('d'), 'black'));
    });
    defs.appendChild(fillMask);

    const union = document.createElementNS(svgNamespace, 'path');
    union.setAttribute('class', 'glacier-region glacier-region-union');
    union.setAttribute('data-region-id', id);
    union.setAttribute('data-region-name', regionPath.dataset.regionName || '');
    union.setAttribute('data-mass-loss', regionPath.dataset.massLoss || '');
    union.setAttribute('fill-rule', 'nonzero');
    union.setAttribute('d', unionD);
    union.setAttribute('mask', `url(#${fillMaskId})`);
    patches.appendChild(union);

    const outlineMask = document.createElementNS(svgNamespace, 'mask');
    const outlineMaskId = `glacier-union-outline-${id}`;
    outlineMask.setAttribute('id', outlineMaskId);
    outlineMask.setAttribute('maskUnits', 'userSpaceOnUse');
    outlineMask.append(
      maskRect(svgNamespace, 'white'),
      maskPath(svgNamespace, unionD, 'black')
    );
    defs.appendChild(outlineMask);

    const outlineStroke = document.createElementNS(svgNamespace, 'path');
    outlineStroke.setAttribute('class', 'glacier-region-seam-stroke');
    outlineStroke.setAttribute('d', unionD);
    outlineStroke.setAttribute('mask', `url(#${outlineMaskId})`);
    patches.appendChild(outlineStroke);

    const rim = document.createElementNS(svgNamespace, 'path');
    rim.setAttribute('class', 'glacier-region-outline');
    rim.setAttribute('fill', 'none');
    rim.setAttribute('d', oceanRimPath(oceanOutline, box.minY, box.maxY));
    patches.appendChild(rim);
  });

  // Keep any other region that the bridge crosses above the patch, so its
  // own fill, stroke, and hover stay intact.
  layer.querySelectorAll('.glacier-region:not(.glacier-region-union):not(.has-seam-patch)').forEach((region) => {
    const bounds = region.getBBox();
    if (bounds.x + bounds.width < 1900) return;
    const point = svg.createSVGPoint();
    let covered = false;
    svg.querySelectorAll('.glacier-seam-bridge').forEach((bridgeShape) => {
      if (covered) return;
      for (let row = 0; row < 6 && !covered; row += 1) {
        for (let column = 0; column < 6 && !covered; column += 1) {
          point.x = bounds.x + (bounds.width * (column + 0.5)) / 6;
          point.y = bounds.y + (bounds.height * (row + 0.5)) / 6;
          if (region.isPointInFill(point) && bridgeShape.isPointInFill(point)) covered = true;
        }
      }
    });
    if (covered) layer.appendChild(region);
  });
}

// Fills stay on the region polygons. Boundaries are one network: each shared
// geographic edge is stroked once, above the fills. Seam-bridge edges are omitted.
function appendGlacierRegionOutlines(layer, preparedRegions, projection, outline) {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const fills = document.createElementNS(svgNamespace, 'g');
  fills.setAttribute('class', 'glacier-region-fills');
  const patches = layer.querySelector('.glacier-region-seam-patches');
  [...layer.children].forEach((child) => {
    if (child === patches || !child.classList || !child.classList.contains('glacier-region')) return;
    const raised = patches && (child.compareDocumentPosition(patches) & Node.DOCUMENT_POSITION_PRECEDING);
    if (!raised) fills.appendChild(child);
  });
  if (patches) layer.insertBefore(fills, patches);
  else layer.prepend(fills);

  const boundaries = document.createElementNS(svgNamespace, 'g');
  boundaries.setAttribute('class', 'glacier-region-boundaries');
  const path = document.createElementNS(svgNamespace, 'path');
  path.setAttribute('class', 'glacier-region-boundaries');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-width', String(glacierStrokeWidth(layer)));
  path.setAttribute('d', glacierBoundaryPath(preparedRegions, projection, outline, layer));
  boundaries.appendChild(path);
  layer.appendChild(boundaries);
}

// One numbered circle per region, above the boundary network.
function appendGlacierRegionMarkers(layer, preparedRegions, projection) {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const metrics = glacierMarkerMetrics(layer);
  const markers = document.createElementNS(svgNamespace, 'g');
  markers.setAttribute('class', 'glacier-region-markers');
  preparedRegions.forEach((region) => {
    const id = region.feature.properties.region_id;
    const hit = layer.querySelector(`.glacier-region-union[data-region-id="${id}"]`)
      || layer.querySelector(`.glacier-region[data-region-id="${id}"]`);
    const base = glacierMarkerBase(region, projection, hit);
    const offset = REGION_LABEL_OFFSETS[id] || { x: 0, y: 0 };
    const x = base[0] + (offset.x || 0);
    const y = base[1] + (offset.y || 0);
    const group = document.createElementNS(svgNamespace, 'g');
    group.setAttribute('class', 'glacier-region-marker');
    group.setAttribute('data-region-id', id);
    group.setAttribute('data-region-name', (hit && hit.dataset.regionName) || '');
    group.setAttribute('data-mass-loss', (hit && hit.dataset.massLoss) || '');
    const circle = document.createElementNS(svgNamespace, 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', String(metrics.radius));
    const text = document.createElementNS(svgNamespace, 'text');
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y));
    text.setAttribute('font-size', String(metrics.fontSize));
    text.textContent = String(parseInt(id, 10));
    group.append(circle, text);
    markers.appendChild(group);
  });
  layer.appendChild(markers);
}

function glacierMarkerMetrics(layer) {
  const host = layer.ownerSVGElement && layer.ownerSVGElement.closest('#glacier-map');
  const style = host ? getComputedStyle(host) : null;
  const radius = style ? parseFloat(style.getPropertyValue('--map-region-marker-radius')) : NaN;
  const fontSize = style ? parseFloat(style.getPropertyValue('--map-region-marker-font-size')) : NaN;
  return {
    radius: Number.isFinite(radius) ? radius : 22,
    fontSize: Number.isFinite(fontSize) ? fontSize : 20
  };
}

// Projected visual center of the main piece. Wrapped copies are ignored so a
// marker is not pulled across the antimeridian.
function glacierMarkerBase(region, projection, hitPath) {
  const id = region.feature.properties.region_id;
  let candidate = null;
  if (id === '16') candidate = projectPlanar([-15, 0], projection);
  else if (id === '19') candidate = projectPlanar([0, -75], projection);
  else candidate = projectedRingCenter(markerRings(region), projection);
  if (!candidate) return [0, 0];
  return markerPointInside(hitPath, candidate[0], candidate[1]);
}

function markerRings(region) {
  const id = region.feature.properties.region_id;
  const rings = glacierBoundaryRings(region).filter((ring) => ring.every((point) => point[0] >= -180 && point[0] <= 180));
  if (id === '10') {
    const asia = rings.filter((ring) => ring.some((point) => point[0] > 0));
    if (asia.length) return asia;
  }
  return rings.length ? rings : glacierBoundaryRings(region);
}

function projectedRingCenter(rings, projection) {
  let best = null;
  let bestArea = -1;
  rings.forEach((ring) => {
    const xs = ring.map((point) => point[0]);
    const ys = ring.map((point) => point[1]);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  });
  if (!best) return null;
  const projected = best.map((point) => projectPlanar(point, projection)).filter(Boolean);
  if (!projected.length) return null;
  return [
    projected.reduce((sum, point) => sum + point[0], 0) / projected.length,
    projected.reduce((sum, point) => sum + point[1], 0) / projected.length
  ];
}

function markerPointInside(path, x, y) {
  if (!path || !path.ownerSVGElement) return [x, y];
  const svg = path.ownerSVGElement;
  const point = svg.createSVGPoint();
  point.x = x;
  point.y = y;
  if (path.isPointInFill(point)) return [x, y];
  const box = path.getBBox();
  let best = null;
  let bestDistance = Infinity;
  for (let row = 1; row < 14; row += 1) {
    for (let column = 1; column < 14; column += 1) {
      point.x = box.x + (box.width * column) / 14;
      point.y = box.y + (box.height * row) / 14;
      if (!path.isPointInFill(point)) continue;
      const distance = ((point.x - x) ** 2) + ((point.y - y) ** 2);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = [point.x, point.y];
      }
    }
  }
  return best || [x, y];
}

// Snap is wide enough to match the same corner stored at slightly different
// precision, and still far below one densified step.
function snapBoundaryCoordinate(value) {
  return Math.round(value * 100) / 100;
}

function snapBoundaryPoint(point) {
  return [snapBoundaryCoordinate(point[0]), snapBoundaryCoordinate(point[1])];
}

function boundaryPointKey(point) {
  return `${point[0]},${point[1]}`;
}

function glacierBoundaryRings(region) {
  const geometry = region.feature.geometry;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates || [];
  const rings = [];
  polygons.forEach((polygon) => polygon.forEach((ring) => rings.push(ring)));
  (region.westRings || []).forEach((ring) => rings.push(ring));
  return rings;
}

function pointOnSeamMeridian(point, seamLongitude) {
  const seam = seamLongitude(point[1]);
  return Math.abs(point[0] - seam) < 1e-3 || Math.abs(point[0] - seam - 360) < 1e-3;
}

// Collect snapped edges, drop the artificial antimeridian closures, then keep
// one copy of every overlapping piece. A→B and B→A are the same edge.
function collectUniqueBoundarySegments(preparedRegions, outline, projection) {
  const seamLongitude = outline ? makeSeamLongitude(projection, outline) : null;
  const horizontals = new Map();
  const verticals = new Map();
  const diagonals = new Map();

  preparedRegions.forEach((region) => {
    glacierBoundaryRings(region).forEach((ring) => {
      for (let index = 0; index < ring.length - 1; index += 1) {
        const start = ring[index];
        const end = ring[index + 1];
        if (sameGeographic(start[0], end[0]) && sameGeographic(start[1], end[1])) continue;
        if (seamLongitude && pointOnSeamMeridian(start, seamLongitude) && pointOnSeamMeridian(end, seamLongitude)) continue;
        const a = snapBoundaryPoint(start);
        const b = snapBoundaryPoint(end);
        if (a[0] === b[0] && a[1] === b[1]) continue;
        if (a[1] === b[1]) {
          const lat = a[1];
          const span = a[0] < b[0] ? [a[0], b[0]] : [b[0], a[0]];
          if (!horizontals.has(lat)) horizontals.set(lat, []);
          horizontals.get(lat).push(span);
        } else if (a[0] === b[0]) {
          const lon = a[0];
          const span = a[1] < b[1] ? [a[1], b[1]] : [b[1], a[1]];
          if (!verticals.has(lon)) verticals.set(lon, []);
          verticals.get(lon).push(span);
        } else {
          const keyA = boundaryPointKey(a);
          const keyB = boundaryPointKey(b);
          const key = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
          if (!diagonals.has(key)) diagonals.set(key, [a, b]);
        }
      }
    });
  });

  const segments = [];
  horizontals.forEach((spans, lat) => {
    atomicSpans(spans).forEach(([lo, hi]) => segments.push([[lo, lat], [hi, lat]]));
  });
  verticals.forEach((spans, lon) => {
    atomicSpans(spans).forEach(([lo, hi]) => segments.push([[lon, lo], [lon, hi]]));
  });
  diagonals.forEach((segment) => segments.push(segment));
  return segments;
}

function atomicSpans(spans) {
  const cuts = new Set();
  spans.forEach(([lo, hi]) => {
    cuts.add(lo);
    cuts.add(hi);
  });
  const points = [...cuts].sort((a, b) => a - b);
  const pieces = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const lo = points[index];
    const hi = points[index + 1];
    const mid = (lo + hi) / 2;
    if (spans.some(([start, end]) => start <= mid && mid <= end)) pieces.push([lo, hi]);
  }
  return pieces;
}

function chainBoundarySegments(segments) {
  const adjacency = new Map();
  segments.forEach((segment, index) => {
    [segment[0], segment[1]].forEach((point) => {
      const key = boundaryPointKey(point);
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(key).push(index);
    });
  });
  const unused = new Set(segments.map((_, index) => index));
  const polylines = [];

  function nextIndex(key) {
    const options = adjacency.get(key) || [];
    for (let index = 0; index < options.length; index += 1) {
      if (unused.has(options[index])) return options[index];
    }
    return -1;
  }

  function walk(startKey) {
    const line = [];
    let key = startKey;
    while (unused.size) {
      const index = nextIndex(key);
      if (index < 0) break;
      unused.delete(index);
      const segment = segments[index];
      const forward = boundaryPointKey(segment[0]) === key;
      const start = forward ? segment[0] : segment[1];
      const end = forward ? segment[1] : segment[0];
      if (!line.length) line.push(start);
      line.push(end);
      const endKey = boundaryPointKey(end);
      if ((adjacency.get(endKey) || []).length !== 2) break;
      key = endKey;
    }
    return line;
  }

  const startKeys = [];
  adjacency.forEach((list, key) => {
    if (list.length !== 2) startKeys.push(key);
  });
  startKeys.forEach((key) => {
    while (nextIndex(key) >= 0) {
      const line = walk(key);
      if (line.length >= 2) polylines.push(line);
    }
  });
  while (unused.size) {
    const index = unused.values().next().value;
    const line = walk(boundaryPointKey(segments[index][0]));
    if (line.length >= 2) polylines.push(line);
  }
  return polylines;
}

function glacierBoundaryPath(preparedRegions, projection, outline, layer) {
  const unions = layer ? [...layer.querySelectorAll('.glacier-region-union')] : [];
  const others = layer ? [...layer.querySelectorAll('.glacier-region:not(.glacier-region-union):not(.has-seam-patch)')] : [];
  const segments = collectUniqueBoundarySegments(preparedRegions, outline, projection)
    .filter((segment) => !edgeLiesInsideSeamRepair(segment, projection, unions, others));
  return chainBoundarySegments(segments).map((points) => {
    let path = '';
    let started = false;
    points.forEach((point) => {
      const projected = projectPlanar(point, projection);
      if (!projected) return;
      path += `${started ? 'L' : 'M'}${projected[0]},${projected[1]}`;
      started = true;
    });
    const closed = points.length > 2 && boundaryPointKey(points[0]) === boundaryPointKey(points[points.length - 1]);
    return closed ? `${path}Z` : path;
  }).join('');
}

// Regions 10 and 19 are one shape after the seam repair. Drop a boundary
// only when both sides sit inside that repaired fill, so the outer contour
// and borders with other regions stay.
function edgeLiesInsideSeamRepair(segment, projection, unions, others) {
  if (!unions.length || !segment.some((point) => point[0] > 150 || point[0] < -150)) return false;
  const start = projectPlanar(segment[0], projection);
  const end = projectPlanar(segment[1], projection);
  if (!start || !end) return false;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return false;
  const offset = 4;
  const ox = (-dy / length) * offset;
  const oy = (dx / length) * offset;
  const midX = (start[0] + end[0]) / 2;
  const midY = (start[1] + end[1]) / 2;
  const svg = unions[0].ownerSVGElement;
  const point = svg.createSVGPoint();
  const probe = (x, y) => {
    point.x = x;
    point.y = y;
    return {
      union: unions.some((union) => union.isPointInFill(point)),
      other: others.some((region) => region.isPointInFill(point))
    };
  };
  const left = probe(midX + ox, midY + oy);
  const right = probe(midX - ox, midY - oy);
  return left.union && right.union && !left.other && !right.other;
}

function glacierStrokeWidth(layer) {
  const host = layer.ownerSVGElement && layer.ownerSVGElement.closest('#glacier-map');
  const raw = host ? getComputedStyle(host).getPropertyValue('--map-region-stroke-width') : '';
  const width = parseFloat(raw);
  return Number.isFinite(width) ? width : 10;
}

function maskRect(svgNamespace, fill) {
  const rect = document.createElementNS(svgNamespace, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '4000');
  rect.setAttribute('height', '2200');
  rect.setAttribute('style', `fill:${fill};stroke:none`);
  return rect;
}

function maskPath(svgNamespace, d, fill) {
  const path = document.createElementNS(svgNamespace, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill-rule', 'nonzero');
  path.setAttribute('style', `fill:${fill};stroke:none`);
  return path;
}

function regionCovers(svg, region, bridgeShape) {
  const bounds = region.getBBox();
  if (bounds.x + bounds.width < 1900) return false;
  const point = svg.createSVGPoint();
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      point.x = bounds.x + (bounds.width * (column + 0.5)) / 6;
      point.y = bounds.y + (bounds.height * (row + 0.5)) / 6;
      if (region.isPointInFill(point) && bridgeShape.isPointInFill(point)) return true;
    }
  }
  return false;
}

function oceanRimPath(outline, yTop, yBot) {
  const topX = outlineRight(outline, yTop);
  const bottomX = outlineRight(outline, yBot);
  if (topX == null || bottomX == null) return '';
  let path = `M${topX - 1},${yTop}`;
  for (let y = yTop + 6; y < yBot; y += 6) {
    const x = outlineRight(outline, y);
    if (x != null) path += `L${x - 1},${y}`;
  }
  path += `L${bottomX - 1},${yBot}`;
  return path;
}

function rightSubpathPoints(d) {
  let best = null;
  d.trim().split(/(?=M)/).filter(Boolean).forEach((part) => {
    const points = [...part.matchAll(/[ML]([\d.\-]+),([\d.\-]+)/g)].map((match) => [+match[1], +match[2]]);
    if (points.length < 4) return;
    const maxX = Math.max(...points.map((point) => point[0]));
    if (!best || maxX > best.maxX) best = { maxX, points };
  });
  return best && best.points;
}

function crossSection(points, y) {
  let minX = Infinity;
  let maxX = -Infinity;
  let hit = false;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (Math.abs(end[1] - start[1]) < 1e-6) continue;
    const low = Math.min(start[1], end[1]);
    const high = Math.max(start[1], end[1]);
    if (y < low - 0.01 || y > high + 0.01) continue;
    const t = (y - start[1]) / (end[1] - start[1]);
    if (t < -0.02 || t > 1.02) continue;
    const x = start[0] + (end[0] - start[0]) * Math.min(1, Math.max(0, t));
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    hit = true;
  }
  return hit ? { minX, maxX } : null;
}

function wrappedSubpathBox(d) {
  let best = null;
  d.trim().split(/(?=M)/).filter(Boolean).forEach((part) => {
    const points = [...part.matchAll(/[ML]([\d.\-]+),([\d.\-]+)/g)].map((match) => [+match[1], +match[2]]);
    if (points.length < 4) return;
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const box = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
    if (!best || box.maxX > best.maxX) best = box;
  });
  return best;
}

function fillSpansAt(path, y) {
  const point = path.ownerSVGElement.createSVGPoint();
  const spans = [];
  let start = null;
  point.y = y;
  for (let x = 1500; x <= 2900; x += 3) {
    point.x = x;
    if (path.isPointInFill(point)) {
      if (start == null) start = x;
    } else if (start != null) {
      spans.push([start, x - 3]);
      start = null;
    }
  }
  if (start != null) spans.push([start, 2900]);
  return spans;
}

function outlineRight(outline, y) {
  const windows = [3, 10];
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];
    let best = null;
    outline.samples.forEach((point) => {
      if (Math.abs(point.y - y) > window || point.x < outline.center) return;
      if (best == null || point.x > best) best = point.x;
    });
    if (best != null) return best;
  }
  return null;
}

// The bridge overlaps the existing right edge, fills any slit between the
// wrapped piece and the main polygon, and runs out past the Robinson outline.
function seamBridge(regionPath, outline, yTop, yBot) {
  const overlap = 8;
  const far = 3200;
  const wrapped = rightSubpathPoints(regionPath.getAttribute('d'));
  const rows = [];
  for (let y = yTop; y <= yBot; y += 4) {
    const section = wrapped && crossSection(wrapped, y);
    const spans = fillSpansAt(regionPath, y);
    let coverFrom = section ? section.minX : null;
    if (spans.length >= 2) {
      const right = spans[spans.length - 1];
      const previous = spans[spans.length - 2];
      const gap = right[0] - previous[1];
      if (gap > 2 && gap < 220 && previous[1] > 1500) {
        coverFrom = coverFrom == null ? previous[1] : Math.min(coverFrom, previous[1]);
      }
    }
    if (coverFrom == null && spans.length) coverFrom = spans[spans.length - 1][1];
    if (coverFrom == null) continue;
    rows.push({ y, coverFrom });
  }
  if (rows.length < 2) return null;

  const top = rows[0];
  const bottom = rows[rows.length - 1];
  let fill = `M${top.coverFrom - overlap},${top.y}H${far}V${bottom.y}H${bottom.coverFrom - overlap}`;
  for (let index = rows.length - 2; index >= 0; index -= 1) {
    fill += `L${rows[index].coverFrom - overlap},${rows[index].y}`;
  }
  fill += 'Z';

  let edge = '';
  const topX = outlineRight(outline, top.y);
  const bottomX = outlineRight(outline, bottom.y);
  if (topX != null && bottomX != null) {
    edge = `M${top.coverFrom},${top.y}H${topX - 0.75}`;
    for (let y = top.y + 6; y < bottom.y; y += 6) {
      const x = outlineRight(outline, y);
      if (x != null) edge += `L${x - 0.75},${y}`;
    }
    edge += `L${bottomX - 0.75},${bottom.y}H${bottom.coverFrom}`;
  }
  return { fill, edge };
}

// Join key only. GeoJSON region_id values stay zero-padded ("01"…"19").
function regionKey(value) {
  return String(Number(value));
}

async function readMapAsset(url, label) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`${label} could not be fetched from ${url}. ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed to load from ${url} (${response.status} ${response.statusText}).`);
  }
  return response.text();
}

initGlacierMap();

// Consequences section only. Macro paths are tuned here.
// Offsets are pixels from each phrase's CSS anchor. Progress is 0–1
// across the sticky scroll of #consequences. Opacity is scroll-only.
const CONSEQUENCE_FLOAT_CONFIG = {
  fadeSpan: 0.18,
  mobileTravelScale: 0.48,
  // Short drift around the ring. endRotation sets each keyword's resting tilt in degrees.
  seaLevel: { startX: -6, startY: 18, endX: 0, endY: 0, startRotation: -9, endRotation: -7, startProgress: 0.00, endProgress: 0.70, maxOpacity: .9 },
  freshwater: { startX: 0, startY: 22, endX: 0, endY: 0, startRotation: 6, endRotation: 4, startProgress: 0.08, endProgress: 0.78, maxOpacity: .9 },
  hazards: { startX: 6, startY: 18, endX: 0, endY: 0, startRotation: -7, endRotation: -5, startProgress: 0.16, endProgress: 0.86, maxOpacity: .9 },
  ecosystem: { startX: -4, startY: 20, endX: 0, endY: 0, startRotation: -6, endRotation: -4, startProgress: 0.24, endProgress: 0.94, maxOpacity: .9 },
  habitat: { startX: 4, startY: 20, endX: 0, endY: 0, startRotation: 8, endRotation: 6, startProgress: 0.32, endProgress: 1.00, maxOpacity: .9 },
  waterQuality: { startX: 6, startY: 18, endX: 0, endY: 0, startRotation: 9, endRotation: 7, startProgress: 0.36, endProgress: 1.00, maxOpacity: .9 },
  food: { startX: -6, startY: 20, endX: 0, endY: 0, startRotation: -7, endRotation: -5, startProgress: 0.40, endProgress: 1.00, maxOpacity: .9 },
  hydropower: { startX: 0, startY: 22, endX: 0, endY: 0, startRotation: -8, endRotation: -6, startProgress: 0.44, endProgress: 1.00, maxOpacity: .9 },
  heritage: { startX: 4, startY: 18, endX: 0, endY: 0, startRotation: 7, endRotation: 5, startProgress: 0.48, endProgress: 1.00, maxOpacity: .9 }
};

function initConsequenceFloats() {
  const section = document.getElementById('consequences');
  if (!section || !section.querySelector('.consequence-float')) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const floats = [...section.querySelectorAll('.consequence-float')];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  function travelScale() {
    return window.innerWidth <= 760 ? CONSEQUENCE_FLOAT_CONFIG.mobileTravelScale : 1;
  }

  function sectionProgress() {
    const distance = section.offsetHeight - window.innerHeight;
    if (distance <= 0) return 1;
    return clamp(-section.getBoundingClientRect().top / distance);
  }

  function paint(element, config, progress, scale) {
    const span = Math.max(0.001, config.endProgress - config.startProgress);
    const local = clamp((progress - config.startProgress) / span);
    const x = (config.startX + (config.endX - config.startX) * local) * scale;
    const y = (config.startY + (config.endY - config.startY) * local) * scale;
    const rotation = config.startRotation + (config.endRotation - config.startRotation) * local;
    const fade = clamp((progress - config.startProgress) / CONSEQUENCE_FLOAT_CONFIG.fadeSpan);
    element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rotation.toFixed(3)}deg)`;
    element.style.opacity = String(config.maxOpacity * fade);
  }

  function render(progress) {
    const scale = travelScale();
    floats.forEach((element) => {
      const config = CONSEQUENCE_FLOAT_CONFIG[element.dataset.consequence];
      if (config) paint(element, config, progress, scale);
    });
  }

  function showResting() {
    const scale = travelScale();
    floats.forEach((element) => {
      const config = CONSEQUENCE_FLOAT_CONFIG[element.dataset.consequence];
      if (!config) return;
      element.style.transform = `translate3d(${(config.endX * scale).toFixed(2)}px, ${(config.endY * scale).toFixed(2)}px, 0) rotate(${config.endRotation}deg)`;
      element.style.opacity = String(config.maxOpacity);
    });
  }

  let frame = 0;
  let listening = false;

  function requestRender() {
    if (frame || motion.matches) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      render(sectionProgress());
    });
  }

  function bind() {
    if (motion.matches) {
      if (listening) {
        window.removeEventListener('scroll', requestRender);
        listening = false;
      }
      showResting();
      return;
    }
    if (!listening) {
      window.addEventListener('scroll', requestRender, { passive: true });
      listening = true;
    }
    render(sectionProgress());
  }

  window.addEventListener('resize', () => {
    if (motion.matches) showResting();
    else render(sectionProgress());
  });
  motion.addEventListener('change', bind);
  bind();
}

initConsequenceFloats();
