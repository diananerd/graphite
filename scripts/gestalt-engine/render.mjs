/**
 * P1 SVG renderer. Emits shapes + labels using projected coordinates.
 *
 * Only rect / round / pill / circle / ellipse / cylinder for the P1 testbench.
 * Full §2.1 shape catalogue lands in P3 alongside the layout engine.
 */

import { projectPoint } from './project.mjs';
import { routeEdge, defaultStyleFor } from './router.mjs';
import { CONTROLS_SCRIPT } from './controls.mjs';
import { resolveVariants, resolveEdgeVariants, fillFor, MARKER_SHAPES, SHADOW_DEFS } from './variants.mjs';
import { LEGIBILITY } from './legibility.mjs';

const ROLE_TO_TOKEN = {
  primary:    'accent',
  secondary:  'cyan',
  success:    'green',
  warning:    'yellow',
  danger:     'red',
  info:       'accent',
  data:       'purple',
  external:   'pink',
  muted:      'dim',
};

function tokenFor(node) {
  if (node.role) return ROLE_TO_TOKEN[node.role] ?? 'accent';
  return node.color ?? 'accent';
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[c]);
}

function emitShape(node, proj) {
  const [cx, cy] = projectPoint(proj, node.x, node.y);
  const w = node.w, h = node.h;
  const variants = resolveVariants(node);
  const colorToken = tokenFor(node);
  const color = `var(--${colorToken})`;
  const fill = fillFor(variants.fillMode, colorToken);
  const stroke = variants.borderWidth;
  const dashAttr = variants.borderDash ? ` stroke-dasharray="${variants.borderDash}"` : '';
  const filterAttr = variants.shadowFilter ? ` filter="url(#${variants.shadowFilter})"` : '';

  const SA = `fill="${fill}" stroke="${color}" stroke-width="${stroke}" vector-effect="non-scaling-stroke"${dashAttr}${filterAttr}`;
  // Inner ring for `border:double` — same colour, slightly inset, hairline.
  const inset = 4;
  const innerSA = `fill="none" stroke="${color}" stroke-width="${LEGIBILITY.stroke.border}" vector-effect="non-scaling-stroke"`;
  const dbl = variants.borderLayer === 'double';

  let geom = '';
  switch (node.shape) {
    case 'rect': {
      const rx = node.style?.corners ? variants.cornerRadius : 0;
      geom = `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${rx}" ${SA}/>`;
      if (dbl) geom += `<rect x="${cx - w / 2 + inset}" y="${cy - h / 2 + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${Math.max(0, rx - 2)}" ${innerSA}/>`;
      break;
    }
    case 'round': {
      const rx = variants.cornerRadius;
      geom = `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${rx}" ${SA}/>`;
      if (dbl) geom += `<rect x="${cx - w / 2 + inset}" y="${cy - h / 2 + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${Math.max(0, rx - 2)}" ${innerSA}/>`;
      break;
    }
    case 'pill':
      geom = `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" ${SA}/>`;
      if (dbl) geom += `<rect x="${cx - w / 2 + inset}" y="${cy - h / 2 + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${h / 2 - inset}" ${innerSA}/>`;
      break;
    case 'circle': {
      const r = Math.min(w, h) / 2;
      geom = `<circle cx="${cx}" cy="${cy}" r="${r}" ${SA}/>`;
      if (dbl) geom += `<circle cx="${cx}" cy="${cy}" r="${r - inset}" ${innerSA}/>`;
      break;
    }
    case 'ellipse':
      geom = `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" ${SA}/>`;
      if (dbl) geom += `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2 - inset}" ry="${h / 2 - inset}" ${innerSA}/>`;
      break;
    case 'cylinder': {
      const ry = Math.min(h * 0.18, 12);
      const top = cy - h / 2;
      const bot = cy + h / 2 - ry;
      geom = `
        <path d="M ${cx - w / 2} ${top + ry} A ${w / 2} ${ry} 0 0 0 ${cx + w / 2} ${top + ry} L ${cx + w / 2} ${bot} A ${w / 2} ${ry} 0 0 1 ${cx - w / 2} ${bot} Z" ${SA}/>
        <ellipse cx="${cx}" cy="${top + ry}" rx="${w / 2}" ry="${ry}" ${SA}/>`;
      if (dbl) {
        const k = inset, hw2 = (w - 2 * k) / 2, ry2 = Math.max(2, ry - 2);
        const top2 = top + k, bot2 = bot - k;
        geom += `<path d="M ${cx - hw2} ${top2 + ry2} A ${hw2} ${ry2} 0 0 0 ${cx + hw2} ${top2 + ry2} L ${cx + hw2} ${bot2} A ${hw2} ${ry2} 0 0 1 ${cx - hw2} ${bot2} Z" ${innerSA}/>
                 <ellipse cx="${cx}" cy="${top2 + ry2}" rx="${hw2}" ry="${ry2}" ${innerSA}/>`;
      }
      break;
    }
    case 'diamond': {
      const pts = `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
      geom = `<polygon points="${pts}" ${SA}/>`;
      if (dbl) {
        const k = inset;
        const inner = `${cx},${cy - h / 2 + k * 2} ${cx + w / 2 - k * 2},${cy} ${cx},${cy + h / 2 - k * 2} ${cx - w / 2 + k * 2},${cy}`;
        geom += `<polygon points="${inner}" ${innerSA}/>`;
      }
      break;
    }
    case 'hexagon': {
      // Flat-top hex.
      const dx = w / 4;
      const pts = `${cx - w / 2 + dx},${cy - h / 2} ${cx + w / 2 - dx},${cy - h / 2} ${cx + w / 2},${cy} ${cx + w / 2 - dx},${cy + h / 2} ${cx - w / 2 + dx},${cy + h / 2} ${cx - w / 2},${cy}`;
      geom = `<polygon points="${pts}" ${SA}/>`;
      if (dbl) {
        const k = inset, hw2 = (w - 2 * k) / 2, hh2 = (h - 2 * k) / 2, dx2 = (w - 2 * k) / 4;
        const pts2 = `${cx - hw2 + dx2},${cy - hh2} ${cx + hw2 - dx2},${cy - hh2} ${cx + hw2},${cy} ${cx + hw2 - dx2},${cy + hh2} ${cx - hw2 + dx2},${cy + hh2} ${cx - hw2},${cy}`;
        geom += `<polygon points="${pts2}" ${innerSA}/>`;
      }
      break;
    }
    case 'cloud': {
      // Scale a canonical cloud silhouette to the requested bbox.
      const sx = w / 90, sy = h / 60;
      const p = (px, py) => `${cx - w / 2 + px * sx} ${cy - h / 2 + py * sy}`;
      geom = `<path d="M ${p(20,52)} C ${p(8,52)} ${p(2,44)} ${p(2,36)} C ${p(2,28)} ${p(8,22)} ${p(16,22)} C ${p(16,12)} ${p(24,4)} ${p(36,4)} C ${p(46,4)} ${p(54,10)} ${p(56,20)} C ${p(60,18)} ${p(66,18)} ${p(70,22)} C ${p(76,22)} ${p(88,28)} ${p(88,38)} C ${p(88,46)} ${p(82,52)} ${p(74,52)} Z" ${SA}/>`;
      if (dbl) {
        // Scale-around-centre inner cloud.
        const s = 1 - (2 * inset) / Math.min(w, h);
        geom += `<g transform="translate(${cx} ${cy}) scale(${s.toFixed(3)}) translate(${-cx} ${-cy})">
                   <path d="M ${p(20,52)} C ${p(8,52)} ${p(2,44)} ${p(2,36)} C ${p(2,28)} ${p(8,22)} ${p(16,22)} C ${p(16,12)} ${p(24,4)} ${p(36,4)} C ${p(46,4)} ${p(54,10)} ${p(56,20)} C ${p(60,18)} ${p(66,18)} ${p(70,22)} C ${p(76,22)} ${p(88,28)} ${p(88,38)} C ${p(88,46)} ${p(82,52)} ${p(74,52)} Z" ${innerSA}/>
                 </g>`;
      }
      break;
    }
    case 'actor': {
      // Classic UML actor: head circle on top, a connected body silhouette
      // that flares from neck outward to wide shoulders/chest at the bottom.
      // The figure occupies the upper ~72% of the bbox; lower band holds
      // the label.
      const figH    = h * 0.72;
      const figTop  = cy - h / 2;
      const figBot  = figTop + figH;
      const headR   = Math.min(w * 0.28, figH * 0.22);
      const headCy  = figTop + headR + 2;
      const neckY   = headCy + headR + 1;     // top of body
      const bodyH   = figBot - neckY;
      const neckHW  = headR * 0.85;           // narrow at neck
      const bodyHW  = Math.max(neckHW + 8, w * 0.42); // wide at chest
      const ctrlYa  = neckY + bodyH * 0.30;
      const ctrlYb  = neckY + bodyH * 0.65;
      geom = `
        <circle cx="${cx}" cy="${headCy}" r="${headR}" ${SA}/>
        <path d="M ${cx - neckHW} ${neckY}
                 C ${cx - neckHW} ${ctrlYa}
                   ${cx - bodyHW} ${ctrlYb}
                   ${cx - bodyHW} ${figBot}
                 L ${cx + bodyHW} ${figBot}
                 C ${cx + bodyHW} ${ctrlYb}
                   ${cx + neckHW} ${ctrlYa}
                   ${cx + neckHW} ${neckY}
                 Z" ${SA}/>`;
      if (dbl) {
        const s = 0.78;
        geom += `<g transform="translate(${cx} ${headCy}) scale(${s}) translate(${-cx} ${-headCy})">
                   <circle cx="${cx}" cy="${headCy}" r="${headR}" ${innerSA}/>
                 </g>
                 <g transform="translate(${cx} ${(neckY + figBot) / 2}) scale(${s}) translate(${-cx} ${-((neckY + figBot) / 2)})">
                   <path d="M ${cx - neckHW} ${neckY}
                            C ${cx - neckHW} ${ctrlYa}
                              ${cx - bodyHW} ${ctrlYb}
                              ${cx - bodyHW} ${figBot}
                            L ${cx + bodyHW} ${figBot}
                            C ${cx + bodyHW} ${ctrlYb}
                              ${cx + neckHW} ${ctrlYa}
                              ${cx + neckHW} ${neckY}
                            Z" ${innerSA}/>
                 </g>`;
      }
      break;
    }
    case 'parallelogram': {
      const skew = Math.min(16, w * 0.18);
      const pts = `${cx - w / 2 + skew},${cy - h / 2} ${cx + w / 2},${cy - h / 2} ${cx + w / 2 - skew},${cy + h / 2} ${cx - w / 2},${cy + h / 2}`;
      geom = `<polygon points="${pts}" ${SA}/>`;
      if (dbl) {
        const sk2 = skew - 1.5, k = inset;
        const inner = `${cx - w / 2 + skew + k},${cy - h / 2 + k} ${cx + w / 2 - k},${cy - h / 2 + k} ${cx + w / 2 - skew - k + (sk2 - skew)},${cy + h / 2 - k} ${cx - w / 2 + k},${cy + h / 2 - k}`;
        geom += `<polygon points="${inner}" ${innerSA}/>`;
      }
      break;
    }
    case 'trapezoid': {
      // Wider at bottom (manual operation symbol).
      const slant = Math.min(14, w * 0.14);
      const pts = `${cx - w / 2 + slant},${cy - h / 2} ${cx + w / 2 - slant},${cy - h / 2} ${cx + w / 2},${cy + h / 2} ${cx - w / 2},${cy + h / 2}`;
      geom = `<polygon points="${pts}" ${SA}/>`;
      if (dbl) {
        const k = inset;
        const inner = `${cx - w / 2 + slant + k},${cy - h / 2 + k} ${cx + w / 2 - slant - k},${cy - h / 2 + k} ${cx + w / 2 - k},${cy + h / 2 - k} ${cx - w / 2 + k},${cy + h / 2 - k}`;
        geom += `<polygon points="${inner}" ${innerSA}/>`;
      }
      break;
    }
    case 'note': {
      // Rect with folded top-right corner.
      const fold = Math.min(16, w * 0.14, h * 0.30);
      const top = cy - h / 2, left = cx - w / 2, right = cx + w / 2, bot = cy + h / 2;
      geom = `<path d="M ${left} ${top} L ${right - fold} ${top} L ${right} ${top + fold} L ${right} ${bot} L ${left} ${bot} Z" ${SA}/>
              <path d="M ${right - fold} ${top} L ${right - fold} ${top + fold} L ${right} ${top + fold}" fill="none" stroke="${color}" stroke-width="${stroke}" vector-effect="non-scaling-stroke"${dashAttr}/>`;
      if (dbl) {
        const k = inset, f2 = fold - 2;
        geom += `<path d="M ${left + k} ${top + k} L ${right - fold - k * 0.3} ${top + k} L ${right - k} ${top + fold + k * 0.7} L ${right - k} ${bot - k} L ${left + k} ${bot - k} Z" ${innerSA}/>`;
      }
      break;
    }
    case 'triangle': {
      // Upward pointing.
      const pts = `${cx},${cy - h / 2} ${cx + w / 2},${cy + h / 2} ${cx - w / 2},${cy + h / 2}`;
      geom = `<polygon points="${pts}" ${SA}/>`;
      if (dbl) {
        const k = inset * 1.5;
        const inner = `${cx},${cy - h / 2 + k * 1.4} ${cx + w / 2 - k},${cy + h / 2 - k} ${cx - w / 2 + k},${cy + h / 2 - k}`;
        geom += `<polygon points="${inner}" ${innerSA}/>`;
      }
      break;
    }
    case 'document': {
      // Rect with wavy bottom (3 cycles).
      const wave = h * 0.12;
      const top = cy - h / 2, left = cx - w / 2, right = cx + w / 2, botMid = cy + h / 2 - wave / 2;
      const w3 = w / 3;
      geom = `<path d="M ${left} ${top} L ${right} ${top} L ${right} ${botMid}
                       C ${right - w3 * 0.5} ${botMid + wave} ${right - w3 * 0.5} ${botMid - wave} ${right - w3} ${botMid}
                       C ${left + w3 * 0.5}  ${botMid + wave} ${left + w3 * 0.5}  ${botMid - wave} ${left} ${botMid} Z" ${SA}/>`;
      if (dbl) {
        const k = inset;
        const botMid2 = botMid - k * 0.5;
        geom += `<path d="M ${left + k} ${top + k} L ${right - k} ${top + k} L ${right - k} ${botMid2}
                         C ${right - w3 * 0.5} ${botMid2 + wave * 0.8} ${right - w3 * 0.5} ${botMid2 - wave * 0.8} ${right - w3} ${botMid2}
                         C ${left + w3 * 0.5}  ${botMid2 + wave * 0.8} ${left + w3 * 0.5}  ${botMid2 - wave * 0.8} ${left + k} ${botMid2} Z" ${innerSA}/>`;
      }
      break;
    }
    case 'chevron': {
      // Right-pointing process arrow.
      const tip = Math.min(20, w * 0.18);
      const top = cy - h / 2, left = cx - w / 2, right = cx + w / 2, bot = cy + h / 2;
      const pts = `${left},${top} ${right - tip},${top} ${right},${cy} ${right - tip},${bot} ${left},${bot} ${left + tip},${cy}`;
      geom = `<polygon points="${pts}" ${SA}/>`;
      if (dbl) {
        const k = inset;
        const inner = `${left + k * 1.5},${top + k} ${right - tip},${top + k} ${right - k},${cy} ${right - tip},${bot - k} ${left + k * 1.5},${bot - k} ${left + tip},${cy}`;
        geom += `<polygon points="${inner}" ${innerSA}/>`;
      }
      break;
    }
    case 'subroutine': {
      // Rect with double vertical bars on left and right (UML subroutine).
      const rx = node.style?.corners ? variants.cornerRadius : 0;
      const bar = 8;
      const top = cy - h / 2, left = cx - w / 2, right = cx + w / 2, bot = cy + h / 2;
      geom = `<rect x="${left}" y="${top}" width="${w}" height="${h}" rx="${rx}" ${SA}/>
              <line x1="${left + bar}" y1="${top}" x2="${left + bar}" y2="${bot}" stroke="${color}" stroke-width="${stroke}" vector-effect="non-scaling-stroke"/>
              <line x1="${right - bar}" y1="${top}" x2="${right - bar}" y2="${bot}" stroke="${color}" stroke-width="${stroke}" vector-effect="non-scaling-stroke"/>`;
      break;
    }
    case 'junction':
    case 'port': {
      geom = `<circle cx="${cx}" cy="${cy}" r="${Math.min(w, h) / 2}" fill="${color}" opacity="0.7"/>`;
      break;
    }
    default:
      geom = `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="${fill}" stroke="${color}" stroke-width="${stroke}" vector-effect="non-scaling-stroke"/>`;
  }

  // Label placement:
  //   - actor: below the bbox (the figure occupies the bbox interior).
  //   - other: centred on bbox.
  let labelY, subY;
  if (node.shape === 'actor') {
    // Inside the bbox, below the figure (figure ends at ~72% of h).
    labelY = cy + h / 2 - 8;
    subY   = labelY + 12;
  } else {
    const hasSub = !!node.sublabel;
    labelY = hasSub ? cy - 2 : cy + 4;
    subY   = cy + 14;
  }

  // Label colour adapts to fill mode: on a solid `filled` body, the role colour
  // would be invisible — switch to the page bg so the label has contrast.
  const labelColor = variants.fillMode === 'filled' ? 'var(--bg)' : color;

  const sub = node.sublabel
    ? `<g class="screen-stable sublabel-stable" transform="translate(${cx},${subY}) scale(1)"><text text-anchor="middle" font-family="var(--font, monospace)" font-size="10" fill="${labelColor}" opacity="0.75">${escapeXml(node.sublabel)}</text></g>`
    : '';

  // Accessible name for the node: label, plus sublabel if present.
  const accName = node.label + (node.sublabel ? ` — ${node.sublabel}` : '');

  // Step-driven initial opacity: when steps are declared, only the elements
  // in step 0's visible set start opaque.
  const initVis = node._initialVisible;
  const initOpacityAttr = initVis === false ? ' opacity="0"' : '';

  return `
    <g class="g-node" data-id="${escapeXml(node.id)}" role="img" aria-label="${escapeXml(accName)}"${initOpacityAttr}>
      <title>${escapeXml(accName)}</title>
      ${geom}
      <g class="screen-stable" transform="translate(${cx},${labelY}) scale(1)">
        <text text-anchor="middle" font-family="var(--font, monospace)" font-size="13" fill="${labelColor}">${escapeXml(node.label)}</text>
      </g>
      ${sub}
    </g>`;
}

/**
 * Is (dx, dy) — an offset from the node centre — inside the node's outline?
 * Used by the radial router to anchor arrows at the actual shape border.
 * For shapes with non-convex outlines (cloud, document, ...) we fall back to
 * the bbox, which is a tight upper bound and visually correct since the
 * perimeter circle is locally near-radial at the entry point.
 */
function pointInShape(node, dx, dy) {
  const rx = node.w / 2, ry = node.h / 2;
  if (rx <= 0 || ry <= 0) return false;
  switch (node.shape) {
    case 'circle':
    case 'ellipse':
      return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
    case 'diamond':
      return Math.abs(dx) / rx + Math.abs(dy) / ry <= 1;
    case 'triangle': {
      // Apex at top, base at bottom. Linear-narrowing inside test.
      const t = (dy + ry) / (2 * ry);                // 0 at apex, 1 at base
      if (t < 0 || t > 1) return false;
      return Math.abs(dx) <= rx * t;
    }
    default:
      return Math.abs(dx) <= rx && Math.abs(dy) <= ry;
  }
}

/**
 * For a node sitting at angle `θ` on a circle of radius `R` centred at the
 * cluster centroid, return the angular offset δ (always positive) along the
 * perimeter where the circle exits the node's outline in direction `sign`.
 * The arrow anchor is placed at the intersection point, then nudged by a
 * small visual gap so the head/tail don't touch the stroke.
 */
function radialExitAngle(node, R, θ, sign) {
  const lo0 = 0, hi0 = Math.PI;
  let lo = lo0, hi = hi0;
  // Anchor node centre on the perimeter circle so the inside test reduces
  // to offsets from the node centre.
  const nx = R * Math.cos(θ);
  const ny = R * Math.sin(θ);
  for (let it = 0; it < 22; it++) {
    const mid = (lo + hi) / 2;
    const px = R * Math.cos(θ + sign * mid);
    const py = R * Math.sin(θ + sign * mid);
    if (pointInShape(node, px - nx, py - ny)) lo = mid;
    else hi = mid;
  }
  const δ = (lo + hi) / 2;
  const gap = 4 / R;                                  // ~4 px of arc
  return Math.min(δ + gap, Math.PI - 0.05);
}

function emitEdge(edge, nodesById, proj, defaultStyle, radialCtx) {
  const a = nodesById[edge.from];
  const b = nodesById[edge.to];
  if (!a || !b) return '';

  // Sequence-diagram messages: horizontal line at the edge's _seqY, between
  // the two lifeline x-coords. Self-messages render as a small loop.
  let aProj, bProj, override;
  // Radial layouts: arrows trace SVG arcs along the loop's perimeter circle.
  // Anchor points are the actual intersection of the perimeter with each
  // node's outline (per-shape, not a uniform bound), so a circle, a diamond
  // and a rect on the same loop each get their own correct anchor.
  if (radialCtx && radialCtx.angles[edge.from] !== undefined && radialCtx.angles[edge.to] !== undefined) {
    const [cx, cy] = radialCtx.centroid;
    const R = radialCtx.radius;
    const θA = radialCtx.angles[edge.from];
    const θB = radialCtx.angles[edge.to];
    let dθ = θB - θA;
    while (dθ > Math.PI)  dθ -= 2 * Math.PI;
    while (dθ < -Math.PI) dθ += 2 * Math.PI;
    const sign = dθ >= 0 ? 1 : -1;
    const δA = radialExitAngle(a, R, θA, sign);
    const δB = radialExitAngle(b, R, θB, -sign);
    const startθ = θA + sign * δA;
    const endθ   = θB - sign * δB;
    const sx = cx + R * Math.cos(startθ);
    const sy = cy + R * Math.sin(startθ);
    const ex = cx + R * Math.cos(endθ);
    const ey = cy + R * Math.sin(endθ);
    const sweep = sign > 0 ? 1 : 0;
    const largeArc = Math.abs(dθ) > Math.PI ? 1 : 0;
    const midθ = (startθ + endθ) / 2;
    aProj = { ...a, x: sx, y: sy };
    bProj = { ...b, x: ex, y: ey };
    override = {
      d: `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${R.toFixed(1)} ${R.toFixed(1)} 0 ${largeArc} ${sweep} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
      mid: {
        x: cx + (R + 14 * sign) * Math.cos(midθ),
        y: cy + (R + 14 * sign) * Math.sin(midθ),
      },
    };
  } else if (edge._seqY !== undefined) {
    const seqY = edge._seqY + proj.ty;
    const ax = a.x + proj.tx, bx = b.x + proj.tx;
    if (a.id === b.id) {
      // Self-message: small horizontal hook.
      const loopW = 40;
      override = {
        d: `M ${ax} ${seqY} L ${ax + loopW} ${seqY} L ${ax + loopW} ${seqY + 18} L ${ax + 4} ${seqY + 18}`,
        mid: { x: ax + loopW / 2, y: seqY - 4 },
      };
    } else {
      override = { d: `M ${ax} ${seqY} L ${bx} ${seqY}`, mid: { x: (ax + bx) / 2, y: seqY - 6 } };
    }
    aProj = { ...a, x: ax, y: seqY };
    bProj = { ...b, x: bx, y: seqY };
  } else {
    const [acx, acy] = projectPoint(proj, a.x, a.y);
    const [bcx, bcy] = projectPoint(proj, b.x, b.y);
    aProj = { ...a, x: acx, y: acy };
    bProj = { ...b, x: bcx, y: bcy };
  }

  const colorToken = ROLE_TO_TOKEN[edge.role] ?? edge.color ?? 'accent';
  const color = `var(--${colorToken})`;
  const { d, mid } = override ?? routeEdge(edge, aProj, bProj, { defaultStyle });

  const v = resolveEdgeVariants(edge);
  const dashAttr   = v.dashArray ? ` stroke-dasharray="${v.dashArray}"` : '';
  const filterAttr = v.shadowFilter ? ` filter="url(#${v.shadowFilter})"` : '';
  const headMk = v.headShape !== 'none' ? ` marker-end="url(#mk-${v.headShape}-${colorToken})"` : '';
  const tailMk = v.tailShape !== 'none' ? ` marker-start="url(#mk-${v.tailShape}-${colorToken})"` : '';

  const label = emitEdgeLabel(edge.label, mid.x, mid.y, color);

  let pathBlock;
  if (v.double) {
    // True parallel-line double using an SVG mask. The mask paints a
    // wide-stroke "white band" then knocks out a narrower "black gap" down
    // the middle, leaving a transparent (not bg-coloured) channel between
    // two parallel coloured strokes. Markers go on a separate centreline
    // path with the *normal* stroke-width so the arrowhead is proportional
    // to the visible lines rather than to the outer band — no fused blob.
    const outerW = v.width * 2.4 + 1;
    const gapW   = Math.max(LEGIBILITY.stroke.border, v.width * 0.9);
    const maskId = `dbl-${escapeXml(edge.from)}-${escapeXml(edge.to)}`;
    pathBlock = `<mask id="${maskId}" maskUnits="userSpaceOnUse">
        <path d="${d}" stroke="white" stroke-width="${outerW.toFixed(2)}" fill="none" stroke-linecap="butt" stroke-linejoin="miter" vector-effect="non-scaling-stroke"/>
        <path d="${d}" stroke="black" stroke-width="${gapW.toFixed(2)}" fill="none" stroke-linecap="butt" stroke-linejoin="miter" vector-effect="non-scaling-stroke"/>
      </mask>
      <path d="${d}" stroke="${color}" stroke-width="${outerW.toFixed(2)}" fill="none" vector-effect="non-scaling-stroke" opacity="0.9" mask="url(#${maskId})"${dashAttr}${filterAttr}/>
      <path d="${d}" stroke="none" stroke-width="${v.width.toFixed(2)}" fill="none"${headMk}${tailMk}/>`;
  } else {
    pathBlock = `<path d="${d}" stroke="${color}" stroke-width="${v.width.toFixed(2)}" fill="none" vector-effect="non-scaling-stroke" opacity="0.85"${headMk}${tailMk}${dashAttr}${filterAttr}/>`;
  }

  const initVis = edge._initialVisible;
  const initOp = initVis === false ? ' opacity="0"' : '';
  return `<g class="g-edge" data-id="${escapeXml(edge.from)}-${escapeXml(edge.to)}"${initOp}>
    ${pathBlock}
    ${label}
  </g>`;
}

/**
 * Emit one `<marker>` per (shape, colour) pair actually used. Skips `none`.
 */
function emitArrowMarkers(needs) {
  const out = [];
  for (const [shape, colors] of needs) {
    const sh = MARKER_SHAPES[shape];
    if (!sh) continue;
    for (const c of colors) {
      const fill = sh.filled ? `var(--${c})` : 'none';
      const stroke = sh.filled ? 'none' : `var(--${c})`;
      const strokeAttr = sh.filled
        ? ''
        : ` stroke="${stroke}" stroke-width="1.5" fill="none" stroke-linejoin="round" stroke-linecap="round"`;
      out.push(`<marker id="mk-${shape}-${c}" viewBox="0 0 10 10" refX="${sh.refX}" refY="${sh.refY}" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="${sh.path}" ${sh.filled ? `fill="${fill}"` : strokeAttr}/>
      </marker>`);
    }
  }
  return out.join('');
}

/**
 * Walk the spec, collect every (marker-shape × colour) actually referenced
 * by an edge's head or tail. Returns a Map<shape, Set<color>>.
 */
function collectMarkerNeeds(spec) {
  const needs = new Map();
  for (const e of spec.edges ?? []) {
    const v = resolveEdgeVariants(e);
    const c = ROLE_TO_TOKEN[e.role] ?? e.color ?? 'accent';
    for (const shape of [v.headShape, v.tailShape]) {
      if (shape === 'none') continue;
      if (!needs.has(shape)) needs.set(shape, new Set());
      needs.get(shape).add(c);
    }
  }
  return needs;
}

/**
 * Edge label with an opaque bg rect that cuts the line behind it, so the
 * text never overlaps the edge stroke and stays readable on any colour.
 * Wrapped in `.screen-stable` so the JS controller keeps it at a constant
 * rendered size at any zoom / display scale.
 */
function emitEdgeLabel(text, x, y, color, fontSize = 10) {
  if (!text) return '';
  const advance = fontSize * 0.62;
  const textW = String(text).length * advance;
  const padX = 5, padY = 2;
  const rectW = textW + 2 * padX;
  const rectH = fontSize + 2 * padY + 2;
  return `<g class="screen-stable edge-label" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(1)">
    <rect x="${(-rectW / 2).toFixed(1)}" y="${(-rectH / 2).toFixed(1)}" width="${rectW.toFixed(1)}" height="${rectH.toFixed(1)}" rx="2" fill="var(--bg)"/>
    <text text-anchor="middle" dy=".35em" font-family="var(--font, monospace)" font-size="${fontSize}" fill="${color}">${escapeXml(text)}</text>
  </g>`;
}

/**
 * Hyperedge: a single edge connecting ≥2 participants. Rendered as a
 * Steiner-tree-style junction at the centroid + a spoke to each participant.
 * The junction is a small filled dot; spokes share the edge's colour and
 * line style.
 */
function emitHyperEdge(edge, nodesById, proj) {
  const parts = edge.participants
    .map((id) => nodesById[id])
    .filter(Boolean);
  if (parts.length < 2) return '';

  const colorToken = ROLE_TO_TOKEN[edge.role] ?? edge.color ?? 'accent';
  const color = `var(--${colorToken})`;
  const v = resolveEdgeVariants(edge);
  const dashAttr = v.dashArray ? ` stroke-dasharray="${v.dashArray}"` : '';

  // Centroid in projected canvas coords.
  let sx = 0, sy = 0;
  const projected = parts.map((n) => {
    const [x, y] = projectPoint(proj, n.x, n.y);
    sx += x; sy += y;
    return { x, y, h: n.h, w: n.w };
  });
  const cx = sx / projected.length, cy = sy / projected.length;

  const spokes = projected.map((p) => `<path d="M ${p.x} ${p.y} L ${cx} ${cy}" stroke="${color}" stroke-width="${v.width.toFixed(2)}" fill="none" vector-effect="non-scaling-stroke" opacity="0.8"${dashAttr}/>`).join('');
  const junction = `<circle cx="${cx}" cy="${cy}" r="6" fill="${color}" stroke="var(--bg)" stroke-width="2"/>`;
  const label = emitEdgeLabel(edge.label, cx, cy - 14, color);
  return `<g class="g-hyperedge" data-id="hyper-${escapeXml(edge.from ?? 'h')}-${parts.map((p) => p.id ?? '').join('-')}" role="img" aria-label="hyperedge ${escapeXml(edge.label ?? '')}">
    ${spokes}
    ${junction}
    ${label}
  </g>`;
}

/** Swimlane bands: alternating tinted background strips with a header label. */
function emitSwimlaneBands(placed, proj) {
  if (!placed._swimlanes) return '';
  const { direction, bands } = placed._swimlanes;
  return bands.map((b, i) => {
    const tint = i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg)';
    if (direction === 'horizontal') {
      return `<g class="swimlane-band">
        <rect x="0" y="${b.crossStart + proj.ty}" width="${proj.canvasW}" height="${b.crossSize}" fill="${tint}" opacity="0.4"/>
        <line x1="0" y1="${b.crossStart + proj.ty}" x2="${proj.canvasW}" y2="${b.crossStart + proj.ty}" stroke="var(--border, #2c2c2a)" stroke-width="1"/>
        <g class="screen-stable" transform="translate(${proj.tx + 16},${b.crossStart + b.crossSize / 2 + proj.ty + 4}) scale(1)">
          <text font-family="var(--font)" font-size="11" fill="var(--fg-dim, #888)" letter-spacing="0.08em">${escapeXml((b.label || '').toUpperCase())}</text>
        </g>
      </g>`;
    } else {
      return `<g class="swimlane-band">
        <rect x="${b.crossStart + proj.tx}" y="0" width="${b.crossSize}" height="${proj.canvasH}" fill="${tint}" opacity="0.4"/>
        <line x1="${b.crossStart + proj.tx}" y1="0" x2="${b.crossStart + proj.tx}" y2="${proj.canvasH}" stroke="var(--border, #2c2c2a)" stroke-width="1"/>
        <g class="screen-stable" transform="translate(${b.crossStart + b.crossSize / 2 + proj.tx},${proj.ty + 16}) scale(1)">
          <text text-anchor="middle" font-family="var(--font)" font-size="11" fill="var(--fg-dim, #888)" letter-spacing="0.08em">${escapeXml((b.label || '').toUpperCase())}</text>
        </g>
      </g>`;
    }
  }).join('');
}

/** Lifelines: dashed vertical lines extending down from each sequence node. */
function emitLifelines(placed, proj) {
  if (!placed._lifelines) return '';
  return placed._lifelines.map((l) => {
    const x = l.x + proj.tx;
    return `<line x1="${x}" y1="${l.yTop + proj.ty}" x2="${x}" y2="${l.yBot + proj.ty}"
              stroke="var(--fg-dim, #888)" stroke-width="1" stroke-dasharray="4 4"
              vector-effect="non-scaling-stroke" opacity="0.6"/>`;
  }).join('');
}

function collectColorTokens(spec) {
  const tokens = new Set();
  for (const n of spec.nodes) tokens.add(tokenFor(n));
  for (const e of spec.edges ?? []) tokens.add(ROLE_TO_TOKEN[e.role] ?? e.color ?? 'accent');
  return tokens;
}

const STYLEKIT = `
  --bg: #181818; --bg-surface: #202020;
  --cyan: #00d8ff; --green: #4afa7a; --purple: #bd93f9; --pink: #ff79c6;
  --yellow: #f1fa8c; --orange: #ffb86c; --red: #ff5555;
  --accent: #bf7fff; --white: #f8f8f2; --dim: #6e6e6b;
  --font: 'Monaspace Neon', ui-monospace, monospace;
`;

/**
 * Render a placed-and-projected spec to SVG.
 * @param {object} placed   nodes carry {id, shape, label, x, y, w, h}
 * @param {Projection} proj
 * @returns {string} SVG markup
 */
export function renderSVG(placed, proj, opts = {}) {
  const camera = opts.camera ?? null;
  const stepPlan = opts.stepPlan ?? null;
  const nodeStepMap = opts.nodeStepMap ?? null;
  // For step 0: which elements are visible? If there's no plan, every
  // element is visible by default. Otherwise visibility is driven by
  // step 0's `visible` set.
  const initialVisible = stepPlan
    ? new Set(stepPlan[0]?.visible ?? [])
    : null;
  placed.__initialVisible = initialVisible;
  const nodesById = Object.fromEntries(placed.nodes.map((n) => [n.id, n]));
  const defaultStyle = defaultStyleFor(placed._layout);

  // Annotate each node with its initial visibility from step 0 (if steps exist).
  const annotatedNodes = placed.nodes.map((n) => ({
    ...n,
    _initialVisible: initialVisible ? initialVisible.has(n.id) : true,
  }));

  // Radial layout context — used by emitEdge to route arrows as SVG arcs
  // along the loop's perimeter circle instead of straight chords.
  const radialCtx = placed._radial ? {
    centroid: [proj.tx + placed._radial.centroid[0], proj.ty + placed._radial.centroid[1]],
    radius: placed._radial.radius * proj.scale,
    angles: placed._radial.angles,
  } : null;

  const edges = (placed.edges ?? []).map((e) => {
    const eid = `${e.from}-${e.to}`;
    const e2 = { ...e, _initialVisible: initialVisible ? initialVisible.has(eid) : true };
    return Array.isArray(e.participants) && e.participants.length >= 2
      ? emitHyperEdge(e2, nodesById, proj)
      : emitEdge(e2, nodesById, proj, defaultStyle, radialCtx);
  }).join('');
  const nodes = annotatedNodes.map((n) => emitShape(n, proj)).join('');
  const markers = emitArrowMarkers(collectMarkerNeeds(placed));

  const controls = Array.isArray(placed.controls) && placed.controls.length
    ? placed.controls.join(' ')
    : (typeof placed.controls === 'string' ? placed.controls : '');
  const controlsAttr = controls ? ` data-controls="${escapeXml(controls)}"` : '';
  const zoomRange = placed.zoomRange ?? [0.5, 4];
  const zoomAttr = controls ? ` data-zoom-range="${zoomRange[0]} ${zoomRange[1]}"` : '';
  const camAttr = camera
    ? ` data-camera-z="${camera.z}" data-camera-tx="${camera.tx}" data-camera-ty="${camera.ty}"`
    : '';
  // Wrap each step's caption to fit the canvas width. Mutates the plan in
  // place so the serialised `data-steps` payload below carries the lines.
  const captionMeta = stepPlan ? wrapCaptions(stepPlan, proj) : null;
  const stepsAttr = stepPlan
    ? ` data-steps='${escapeXml(JSON.stringify(stepPlan))}'`
    : '';
  const nodeMapAttr = nodeStepMap && Object.keys(nodeStepMap).length
    ? ` data-node-steps='${escapeXml(JSON.stringify(nodeStepMap))}'`
    : '';
  const autoplayDefault = placed.autoplayDuration ?? 2500;
  const autoplayAttr = stepPlan ? ` data-autoplay-default="${autoplayDefault}"` : '';
  const loopAttr = stepPlan ? ` data-loop="${placed.autoplayLoop ? 1 : 0}"` : '';
  const chromeAttr = controls ? ' data-chrome="1"' : '';
  const role = controls ? 'application' : 'img';
  const scriptBlock = controls ? `<script><![CDATA[${CONTROLS_SCRIPT}]]></script>` : '';
  const controlBar = controls ? emitControlBar(proj, !!stepPlan, placed) : '';
  const captionBar = stepPlan ? emitCaptionBar(proj, stepPlan, captionMeta) : '';
  const stepCounter = stepPlan ? emitStepCounter(proj, stepPlan) : '';

  // Container-query block (§17): hide sublabels at the smallest tier; ease
  // gaps at the largest. The container is the wrapping div in the host page.
  const cqStyle = `
    @container (max-width: 480px) { .gestalt-root .sublabel-stable { display: none; } }
    .g-node, .g-edge { transition: opacity 250ms ease-out; }
    .g-node.is-dimmed, .g-edge.is-dimmed { opacity: 0.28; }
    .g-node.is-pulsing { animation: gestalt-pulse 600ms ease-out; }
    @keyframes gestalt-pulse { 0%,100% { filter: none } 40% { filter: brightness(1.6) drop-shadow(0 0 6px currentColor) } }
    .gestalt-root[data-node-steps] .g-node { cursor: pointer; }
    .ctrl-btn[data-action="autoplay-toggle"] .icon-pause { display: none; }
    .gestalt-root[data-autoplay="1"] .ctrl-btn[data-action="autoplay-toggle"] .icon-play { display: none; }
    .gestalt-root[data-autoplay="1"] .ctrl-btn[data-action="autoplay-toggle"] .icon-pause { display: block; }
    .ctrl-btn[data-action="loop-toggle"] { opacity: 0.5; }
    .gestalt-root[data-loop="1"] .ctrl-btn[data-action="loop-toggle"] { opacity: 1; }
    .gestalt-root[data-chrome="0"] .controls-bar,
    .gestalt-root[data-chrome="0"] .caption-bar,
    .gestalt-root[data-chrome="0"] .step-counter { opacity: 0; pointer-events: none; transition: opacity 180ms ease-out; }
    .gestalt-root[data-chrome="1"] .controls-bar,
    .gestalt-root[data-chrome="1"] .caption-bar,
    .gestalt-root[data-chrome="1"] .step-counter { transition: opacity 180ms ease-out; }
    .gestalt-root:fullscreen { width: 100vw; height: 100vh; background: var(--bg); }
    .gestalt-root::backdrop { background: var(--bg); }
    /* A11y: visible focus ring for keyboard navigation. */
    .gestalt-root:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
    .gestalt-root:focus:not(:focus-visible) { outline: none; }
    .ctrl-btn:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
    .ctrl-btn:focus:not(:focus-visible) { outline: none; }
    /* A11y: respect prefers-reduced-motion — animations and step transitions
       collapse to instant updates so users sensitive to motion can still
       follow the sequence without vestibular discomfort. */
    @media (prefers-reduced-motion: reduce) {
      .g-node, .g-edge, .controls-bar, .caption-bar, .step-counter,
      .g-node.is-pulsing { transition: none !important; animation: none !important; }
    }
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${proj.canvasW} ${proj.canvasH}"
     role="${role}"
     class="gestalt-root"
     data-margin="${proj.margin}"
     data-layout="${escapeXml(placed._layout ?? '?')}"
     data-content-bbox="${proj.contentBBox.x},${proj.contentBBox.y},${proj.contentBBox.w},${proj.contentBBox.h}"${controlsAttr}${zoomAttr}${camAttr}${stepsAttr}${nodeMapAttr}${autoplayAttr}${loopAttr}${chromeAttr}
     aria-label="${escapeXml(placed.title ?? 'diagram')}"
     tabindex="${controls ? 0 : -1}">
  <title>${escapeXml(placed.title ?? 'diagram')}</title>
  <desc>${escapeXml(placed.title ?? '')} — gestalt diagram${controls ? ' with zoom and pan controls (keys: + - 0 f, drag to pan' + (controls.includes('wheel-zoom') ? ', wheel to zoom)' : ')') : ''}</desc>
  <defs>
    <style>:root { ${STYLEKIT} } .gestalt-root { background: var(--bg); cursor: ${controls ? 'grab' : 'default'}; } ${cqStyle}</style>
    ${SHADOW_DEFS}
    ${markers}
  </defs>
  <rect width="${proj.canvasW}" height="${proj.canvasH}" fill="var(--bg)"/>
  <g class="zoom-root"${camera ? ` transform="translate(${camera.tx} ${camera.ty}) scale(${camera.z})"` : ''}>
    ${emitSwimlaneBands(placed, proj)}
    ${emitLifelines(placed, proj)}
    ${edges}
    ${nodes}
  </g>
  ${controlBar}
  ${captionBar}
  ${stepCounter}
  ${scriptBlock}
</svg>`;
}

/**
 * Caption strip at the top — JS controller writes the current step's
 * `caption` text here on every step change.
 */
/**
 * Greedy word-wrap of `text` to at most `maxChars` per line. Long single
 * words are not split — they get their own (overflowing) line so the
 * algorithm never loses content.
 */
function wrapText(text, maxChars) {
  if (!text) return [''];
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [String(text)];
}

/**
 * Compute fs / line-wrapping metadata for the caption bar and mutate each
 * step in `stepPlan` to attach a `lines` array. Centralised here so the
 * `data-steps` JSON the JS controller reads already carries the wrapped
 * lines — no runtime wrapping logic needed.
 */
function wrapCaptions(stepPlan, proj) {
  // Everything below is in display-pixel units. The wrapping group will be
  // counter-scaled at runtime so these numbers always render at the same
  // size on screen.
  const fs       = 14;
  const advance  = fs * 0.62;
  const sidePad  = 16;
  // Controls reserve: ctrlW (32) + ctrlPad (14) + safe gap (14). The bar is
  // centred horizontally so we reserve symmetrically. We use an assumed
  // typical display width derived from the canvas aspect — the counter-
  // scaling means container width drives the runtime; we just want to pick
  // a reasonable upper bound for line length.
  const reserve  = 32 + 14 + 14;
  const assumedDisplayW = 640; // typical column width in blog/gallery
  const maxBarW  = Math.max(160, assumedDisplayW - 2 * reserve);
  const maxLineW = Math.max(40, maxBarW - 2 * sidePad);
  const maxChars = Math.max(10, Math.floor(maxLineW / advance));
  const minBarW  = 120;
  let maxLineCount = 1;
  for (const st of stepPlan) {
    st.lines = wrapText(st.caption ?? '', maxChars);
    let maxLen = 0;
    for (const ln of st.lines) if (ln.length > maxLen) maxLen = ln.length;
    st.barW = Math.round(Math.max(minBarW, Math.min(maxBarW, maxLen * advance + sidePad * 2)));
    if (st.lines.length > maxLineCount) maxLineCount = st.lines.length;
  }
  return { fs, advance, sidePad, maxLineCount };
}

/**
 * Caption strip. Sized algorithmically at compile time using metadata from
 * `wrapCaptions`. Long titles wrap to additional lines; the rect grows
 * vertically to fit the worst-case step. The JS controller swaps `<tspan>`
 * children per step — no runtime width or layout math.
 */
function emitCaptionBar(proj, stepPlan, meta) {
  const { fs, sidePad, maxLineCount } = meta;
  // All values in pixel-space; the wrapping group counter-scales to keep
  // them constant on screen.
  const padY       = 14;
  const lineHeight = Math.round(fs * 1.3);
  const innerPadY  = Math.round(fs * 0.55);
  const h          = maxLineCount * lineHeight + 2 * innerPadY - Math.round(lineHeight - fs);
  const radius     = Math.round(Math.min(h * 0.18, fs * 0.6));
  const initBarW   = stepPlan[0]?.barW ?? 160;
  const rectX      = -initBarW / 2;
  const firstLineY = padY + innerPadY + fs * 0.85;
  const firstLines = stepPlan[0]?.lines ?? [stepPlan[0]?.caption ?? ''];
  const tspans = firstLines.map((ln, i) =>
    `<tspan x="0"${i === 0 ? '' : ` dy="${lineHeight}"`}>${escapeXml(ln)}</tspan>`
  ).join('');
  return `<g class="caption-bar screen-stable-fixed" data-anchor="tc" role="status" aria-live="polite" transform="translate(${proj.canvasW / 2} 0) scale(1)">
    <rect class="caption-bg" x="${rectX.toFixed(1)}" y="${padY}" width="${initBarW}" height="${h}" rx="${radius}"
          fill="var(--bg-surface)" opacity="0.92"/>
    <text class="step-caption" x="0" y="${firstLineY.toFixed(1)}" text-anchor="middle"
          data-line-h="${lineHeight}" data-cx="0"
          font-family="var(--font)" font-size="${fs}" fill="var(--fg, #e0e0e0)">${tspans}</text>
  </g>`;
}

/**
 * Step counter rendered as a small standalone label in the bottom-right
 * corner of the canvas. Engine-positioned in viewBox coords; the JS
 * controller only swaps the text on step change.
 */
function emitStepCounter(proj, stepPlan) {
  // Pixel-space; wrapping group counter-scales for constant size.
  // Anchor at bottom-left, counter flush against the left edge — no left
  // button shares this corner so it can hug the border.
  const fs = 12;
  const total = stepPlan.length;
  const x = 14;
  const y = -14;
  return `<g class="step-counter-anchor screen-stable-fixed" data-anchor="bl" transform="translate(0 ${proj.canvasH}) scale(1)">
    <text class="step-counter" x="${x}" y="${y}" text-anchor="start"
        role="status" aria-live="polite" aria-atomic="true"
        aria-label="Step 1 of ${total}"
        font-family="var(--font)" font-size="${fs}" fill="var(--fg-dim, #999)">1 / ${total}</text>
  </g>`;
}

/**
 * Emit two button groups, sized and positioned algorithmically from the
 * canvas dimensions. No runtime DOM repositioning: the gallery / blog
 * wrapper is responsible for matching the SVG's viewBox aspect (via
 * `aspect-ratio` CSS), so positions in viewBox coords already land flush
 * with the container border.
 *
 *   • view group — top-right corner, vertical stack
 *     (zoom-out / auto-fit / zoom-in / fullscreen)
 *   • sequence  — bottom-centre, horizontal row
 *     (restart / prev / autoplay / loop / next)
 *
 * Button size and padding scale with the canvas so tiny fixtures don't get
 * lost-in-noise buttons and large ones don't get postage-stamps. Icons are
 * authored in a 32-unit grid and scaled via the outer transform.
 */
function emitControlBar(proj, hasSteps, placed) {
  // Constant display-pixel sizing. The wrapping groups are
  // `screen-stable-fixed`, anchored at a viewBox corner; at runtime the JS
  // controller appends `scale(1/ds)` so children — authored in a 32-unit
  // pixel-space — always render at the same display size regardless of
  // canvas, container, aspect, zoom, or camera.
  const w   = 32;
  const gap = 4;
  const pad = 14;

  const viewBtns = [
    { action: 'zoom-out',   label: 'Zoom out',  icon: 'M 9 16 L 23 16' },
    { action: 'auto-fit',   label: 'Reset view',icon: 'M 11 11 a 6 6 0 1 1 -2 4 M 9 11 l 2 0 l 0 -2' },
    { action: 'zoom-in',    label: 'Zoom in',   icon: 'M 9 16 L 23 16 M 16 9 L 16 23' },
    { action: 'fullscreen', label: 'Fullscreen',icon: 'M 9 13 L 9 9 L 13 9 M 23 13 L 23 9 L 19 9 M 9 19 L 9 23 L 13 23 M 23 19 L 23 23 L 19 23' },
  ];
  const seqBtns = hasSteps ? [
    { action: 'step-restart',    label: 'Restart sequence (R)', icon: 'M 21 9 L 13 16 L 21 23 Z M 11 9 L 11 23' },
    { action: 'autoplay-toggle', label: 'Toggle autoplay',
      iconDual: {
        play:  'M 12 9 L 22 16 L 12 23 Z',
        pause: 'M 12 9 L 14 9 L 14 23 L 12 23 Z M 18 9 L 20 9 L 20 23 L 18 23 Z',
      } },
    { action: 'loop-toggle',     label: 'Toggle loop',      icon: 'M 11 13 L 21 13 L 18 10 M 21 13 L 18 16 M 21 19 L 11 19 L 14 16 M 11 19 L 14 22' },
  ] : [];
  const prevBtn = hasSteps ? { action: 'step-prev', label: 'Previous step (←)', icon: 'M 20 9 L 12 16 L 20 23' } : null;
  const nextBtn = hasSteps ? { action: 'step-next', label: 'Next step (→)',     icon: 'M 12 9 L 20 16 L 12 23' } : null;

  const KEY_HINTS = {
    'zoom-in': '+', 'zoom-out': '-', 'auto-fit': '0', 'fullscreen': 'F',
    'step-prev': 'ArrowLeft', 'step-next': 'ArrowRight', 'step-restart': 'R',
    'autoplay-toggle': 'Space', 'loop-toggle': 'L',
  };
  const TOGGLE_PRESSED = {
    'autoplay-toggle': false,
    'loop-toggle': !!placed.autoplayLoop,
  };
  const renderBtn = (b, x, y) => {
    let iconBlock;
    if (b.iconDual) {
      iconBlock = `<path class="icon-play"  d="${b.iconDual.play}"  fill="var(--accent)" stroke="none"/>
                   <path class="icon-pause" d="${b.iconDual.pause}" fill="var(--accent)" stroke="none"/>`;
    } else {
      iconBlock = `<path d="${b.icon}" stroke="var(--accent)" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }
    const pressed = b.action in TOGGLE_PRESSED ? ` aria-pressed="${TOGGLE_PRESSED[b.action]}"` : '';
    const keyAttr = KEY_HINTS[b.action] ? ` aria-keyshortcuts="${KEY_HINTS[b.action]}"` : '';
    return `<g class="ctrl-btn" data-action="${b.action}" role="button" aria-label="${b.label}"${pressed}${keyAttr} tabindex="0" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <title>${b.label}</title>
      <rect x="0" y="0" width="32" height="32" rx="6" fill="var(--bg-surface)" stroke="var(--accent)" stroke-width="1" opacity="0.92" aria-hidden="true"/>
      ${iconBlock}
    </g>`;
  };

  // View controls — anchored top-right; children at negative-x local coords
  // so they grow inward from the corner.
  const viewButtons = viewBtns.map((b, i) => renderBtn(b, -pad - w, pad + i * (w + gap))).join('');
  const viewGroup = `<g class="controls-bar controls-view screen-stable-fixed" data-anchor="tr" role="group" aria-label="View controls" transform="translate(${proj.canvasW} 0) scale(1)">
    ${viewButtons}
  </g>`;

  if (!hasSteps) return viewGroup;

  // Sequence controls — anchored bottom-centre; row centred around 0 above
  // the bottom edge.
  const rowW = w * seqBtns.length + gap * (seqBtns.length - 1);
  const seqButtons = seqBtns.map((b, i) => renderBtn(b, -rowW / 2 + i * (w + gap), -pad - w)).join('');
  const seqGroup = `<g class="controls-bar controls-seq screen-stable-fixed" data-anchor="bc" role="group" aria-label="Sequence controls" transform="translate(${proj.canvasW / 2} ${proj.canvasH}) scale(1)">
    ${seqButtons}
  </g>`;

  // Prev + next grouped together at bottom-right — prev sits immediately to
  // the left of next so the two-arrow pair reads as a single nav cluster.
  const navGroup = `<g class="controls-bar controls-nav screen-stable-fixed" data-anchor="br" role="group" aria-label="Step navigation" transform="translate(${proj.canvasW} ${proj.canvasH}) scale(1)">
    ${renderBtn(prevBtn, -2 * w - gap - pad, -pad - w)}
    ${renderBtn(nextBtn, -w - pad, -pad - w)}
  </g>`;
  return `${viewGroup}${seqGroup}${navGroup}`;
}
