/* A scroll-driven contour morph, not a crossfade between two illustrations.
   Replacement SVG contract: #nepal-mountain-silhouette is one closed outer path
   inside #nepal-mountain-camera. Snow/ice remain separate siblings in that camera.
   The target contour is sampled from that path on load, so replacing its d works
   without rewriting the animation. Keep the scene's existing 680 × 800 viewBox. */
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
  const target = section.querySelector('#nepal-mountain-silhouette');
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
  const details = [...camera.children].filter((node) => node !== target);
  const overlay = document.createElementNS(ns, 'path');
  overlay.setAttribute('class', 'nepal-mountain-morph');
  overlay.setAttribute('fill', target.getAttribute('fill') || 'var(--color-brown)');
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
