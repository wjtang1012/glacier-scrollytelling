/* Authored mountain artwork. Keep mountain-base, ice-top-left, ice-top-right,
   ice-falling and rock-* IDs when updating the source SVG. Both scroll consumers
   await this one load, so they always use the same live geometry. */
const nepalMountainReady = (async () => {
  const camera = document.getElementById('nepal-mountain-camera');
  if (!camera) return false;
  try {
    const response = await fetch('./assets/svg/nepal-glacier-mountain.svg');
    if (!response.ok) throw new Error(`Mountain SVG: ${response.status}`);
    const documentSvg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    if (documentSvg.querySelector('parsererror')) throw new Error('Invalid mountain SVG');
    const artwork = document.importNode(documentSvg.documentElement, true);
    for (const id of ['mountain-base', 'ice-top-left', 'ice-top-right', 'ice-falling']) {
      if (!artwork.querySelector(`#${id}`)) throw new Error(`Mountain SVG is missing ${id}`);
    }
    // Fit the original viewBox without distorting its proportions. The outer
    // 680 × 800 scene and its existing scroll camera remain unchanged.
    const viewBox = artwork.viewBox.baseVal;
    const width = 680;
    const unitsPerScene = viewBox.width / width;
    artwork.id = 'nepal-mountain-artwork';
    artwork.setAttribute('x', '0');
    artwork.setAttribute('y', '110');
    artwork.setAttribute('width', String(width));
    artwork.setAttribute('height', String(viewBox.height / unitsPerScene));
    artwork.setAttribute('overflow', 'visible');
    artwork.setAttribute('aria-hidden', 'true');
    artwork.style.pointerEvents = 'none';
    camera.dataset.artworkUnitsPerScene = String(unitsPerScene);
    // Illustrator's generic .cls-* rules must not recolor the world map.
    const classes = new Set([...artwork.querySelectorAll('[class]')].flatMap((node) => [...node.classList]));
    artwork.querySelectorAll('style').forEach((style) => {
      style.textContent = style.textContent.replace(/\.([a-zA-Z_][\w-]*)/g,
        (selector, name) => classes.has(name) ? `.nepal-art-${name}` : selector);
    });
    artwork.querySelectorAll('[class]').forEach((node) => {
      node.setAttribute('class', [...node.classList].map((name) => `nepal-art-${name}`).join(' '));
    });
    artwork.querySelectorAll('[id^="rock-"]').forEach((rock) => {
      rock.classList.add('falling-rock');
      rock.style.opacity = '0'; // Revealed only by the collapse scroll sequence.
    });
    artwork.querySelectorAll('[id^="water-"], [id^="building-"], [id^="window-"], [id^="line-"]').forEach((node) => {
      node.style.opacity = '0'; // The flood controller, not the mountain morph, reveals these.
    });
    camera.replaceChildren(artwork);
    // Continue the authored mountain's flat bottom without modifying the SVG file.
    const base = artwork.querySelector('#mountain-base');
    const baseBox = base.getBBox();
    const ground = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    ground.id = 'nepal-mountain-ground';
    ground.setAttribute('x', String(baseBox.x));
    ground.setAttribute('y', String(baseBox.y + baseBox.height - 1));
    ground.setAttribute('width', String(baseBox.width));
    ground.setAttribute('height', '500');
    ground.setAttribute('fill', getComputedStyle(base).fill);
    ground.setAttribute('pointer-events', 'none');
    ground.style.opacity = '0';
    base.before(ground);
    return true;
  } catch (error) {
    console.error('Nepal mountain artwork could not load:', error);
    return false;
  }
})();

/* Scroll-driven contour morph. The target may be an SVG path or polygon;
   getScreenCTM includes the artwork viewBox and the live camera transform. */
function createNepalMountainMorph(section, marker) {
  'use strict';
  const MORPH = {
    range: [.14, .34], // Nepal story progress: triangle expands into the mountain
    details: [.34, .40], // Snow and ice appear after the outer contour matches
    samples: 240 // Multiple of 3 retains all three triangle corners exactly
  };
  const ns = 'http://www.w3.org/2000/svg';
  const mountain = section.querySelector('#nepal-mountain-layer');
  const camera = section.querySelector('#nepal-mountain-camera');
  const target = section.querySelector('#mountain-base');
  const svg = marker.ownerSVGElement;
  if (!mountain || !camera || !target || !svg) return null;
  const length = target.getTotalLength();
  if (!length) return null;
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const phase = (p, [a, b]) => {
    const t = clamp((p - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const mix = (a, b, t) => a + (b - a) * t;

  // Anchor the target at its highest summit and preserve winding. This prevents
  // the triangle tip from rotating around the outline or crossing its sides.
  const sampled = Array.from({ length: MORPH.samples }, (_, i) => target.getPointAtLength(i / MORPH.samples * length));
  const peak = sampled.reduce((best, point, i) => point.y < sampled[best].y ? i : best, 0);
  const winding = sampled.reduce((sum, point, i) => {
    const next = sampled[(i + 1) % sampled.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  const targetPoints = sampled.map((_, i) => sampled[(peak + (winding >= 0 ? i : -i) + sampled.length) % sampled.length]);
  const details = [...target.parentElement.querySelectorAll('#ice-top-left, #ice-top-right, #ice-falling')];
  const overlay = document.createElementNS(ns, 'path');
  overlay.setAttribute('class', 'nepal-mountain-morph');
  overlay.setAttribute('fill', getComputedStyle(target).fill || 'var(--color-brown)');
  overlay.setAttribute('pointer-events', 'none');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.visibility = 'hidden';
  // Outside the fading country layer, but in the same SVG coordinate system.
  svg.insertBefore(overlay, mountain);
  mountain.dataset.morphManaged = 'true';

  function update(progress, enabled) {
    const t = phase(progress, MORPH.range);
    const started = enabled && progress >= MORPH.range[0];
    const finished = enabled && progress >= MORPH.range[1];
    marker.style.opacity = started ? '0' : '1';
    mountain.style.opacity = enabled ? '1' : '0';
    target.style.visibility = finished ? 'visible' : 'hidden';
    details.forEach((node) => { node.style.opacity = String(enabled ? phase(progress, MORPH.details) : 0); });
    overlay.style.visibility = started && !finished ? 'visible' : 'hidden';
    overlay.dataset.progress = t.toFixed(4);
    if (!started || finished) return;

    // Convert both live endpoints to the outer SVG's coordinates. The triangle
    // continues its geographic zoom, and the destination follows the mountain
    // camera. Recompute matrices on scroll/resize so neither endpoint drifts.
    const rootMatrix = svg.getScreenCTM();
    const markerMatrix = marker.getScreenCTM();
    const targetMatrix = target.getScreenCTM();
    if (!rootMatrix || !markerMatrix || !targetMatrix) return;
    const inverse = rootMatrix.inverse();
    const fromMatrix = inverse.multiply(markerMatrix);
    const toMatrix = inverse.multiply(targetMatrix);
    const box = marker.getBBox();
    const corners = [
      new DOMPoint(box.x + box.width / 2, box.y),
      new DOMPoint(box.x + box.width, box.y + box.height),
      new DOMPoint(box.x, box.y + box.height)
    ].map((point) => point.matrixTransform(fromMatrix));
    const points = targetPoints.map((point, i) => {
      const edge = i / MORPH.samples * 3;
      const corner = Math.floor(edge), along = edge - corner;
      const a = corners[corner], b = corners[(corner + 1) % 3];
      const destination = new DOMPoint(point.x, point.y).matrixTransform(toMatrix);
      return `${mix(mix(a.x, b.x, along), destination.x, t).toFixed(3)} ${mix(mix(a.y, b.y, along), destination.y, t).toFixed(3)}`;
    });
    overlay.setAttribute('d', `M${points.join('L')}Z`);
  }
  return { update };
}
