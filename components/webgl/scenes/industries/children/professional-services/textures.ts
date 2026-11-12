'use client';

import * as THREE from 'three';

/**
 * Procedural CanvasTextures for the Professional Services miniature.
 * Strictly blue/ink/porcelain palette (#fafbfe, #e8efff, #9db2ff, #2e4bff, #16275c, #0a0c12).
 * Zero network requests, zero text strings (editorial bars, matrices, charts & grids only).
 */

export type FolioPageVariant = 'thesis' | 'evidence' | 'matrix' | 'brief';

export function createFolioPageTexture(variant: FolioPageVariant): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 700;
  const ctx = canvas.getContext('2d')!;

  // Cool architectural paper ground (toned slightly so studio lights don't blow it out)
  ctx.fillStyle = '#eaf0ff';
  ctx.fillRect(0, 0, 512, 700);

  // Outer & inner architectural borders
  ctx.strokeStyle = '#6b87ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, 480, 668);

  ctx.strokeStyle = 'rgba(22, 39, 92, 0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(34, 34, 444, 632);

  // Top header classification bar
  ctx.fillStyle = '#2e4bff';
  ctx.fillRect(52, 54, 58, 12);
  ctx.fillStyle = '#16275c';
  ctx.fillRect(122, 54, 150, 12);

  // Top-right folio page emblem
  ctx.strokeStyle = '#2e4bff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(438, 60, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#2e4bff';
  ctx.beginPath();
  ctx.arc(438, 60, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal divider under header
  ctx.strokeStyle = 'rgba(22, 39, 92, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(52, 84);
  ctx.lineTo(460, 84);
  ctx.stroke();

  if (variant === 'thesis') {
    // Bold headline bars
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(52, 106, 320, 18);
    ctx.fillStyle = '#16275c';
    ctx.fillRect(52, 134, 240, 16);

    // 2x2 Positioning Matrix diagram in electric blue
    const mx = 52;
    const my = 176;
    const mw = 408;
    const mh = 240;
    ctx.fillStyle = '#dce6ff';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#3b5bff';
    ctx.lineWidth = 3;
    ctx.strokeRect(mx, my, mw, mh);

    // Quadrant axes
    ctx.strokeStyle = 'rgba(22, 39, 92, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(mx + mw / 2, my + 12);
    ctx.lineTo(mx + mw / 2, my + mh - 12);
    ctx.moveTo(mx + 12, my + mh / 2);
    ctx.lineTo(mx + mw - 12, my + mh / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Muted competitor positions (lower-left & lower-right)
    ctx.fillStyle = '#6b87ff';
    ctx.beginPath();
    ctx.arc(mx + 95, my + 172, 11, 0, Math.PI * 2);
    ctx.arc(mx + 150, my + 145, 10, 0, Math.PI * 2);
    ctx.arc(mx + 275, my + 165, 11, 0, Math.PI * 2);
    ctx.fill();

    // Target Firm Position (upper-right quadrant) with concentric rings
    const tx = mx + 318;
    const ty = my + 66;
    ctx.strokeStyle = 'rgba(46, 75, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#2e4bff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2e4bff';
    ctx.beginPath();
    ctx.arc(tx, ty, 11, 0, Math.PI * 2);
    ctx.fill();

    // Two-column editorial thesis bars below
    for (let col = 0; col < 2; col++) {
      const cx = 52 + col * 214;
      ctx.fillStyle = '#2e4bff';
      ctx.fillRect(cx, 442, 48, 8);
      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(cx, 462, 172, 11);
      ctx.fillStyle = '#3b528c';
      for (let r = 0; r < 5; r++) {
        const w = r === 4 ? 120 : 186;
        ctx.fillRect(cx, 486 + r * 20, w, 8);
      }
    }
  } else if (variant === 'evidence') {
    // Evidence & Case Architecture page
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(52, 106, 290, 18);
    ctx.fillStyle = '#2e4bff';
    ctx.fillRect(52, 134, 185, 12);

    // Comparative Evidence Bar Chart box
    const bx = 52;
    const by = 170;
    const bw = 408;
    const bh = 230;
    ctx.fillStyle = '#dce6ff';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#3b5bff';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);

    // Horizontal grid lines
    ctx.strokeStyle = 'rgba(46, 75, 255, 0.32)';
    ctx.lineWidth = 1.5;
    for (let g = 1; g <= 3; g++) {
      const gy = by + (bh / 4) * g;
      ctx.beginPath();
      ctx.moveTo(bx + 16, gy);
      ctx.lineTo(bx + bw - 16, gy);
      ctx.stroke();
    }

    // 4 Comparative Case Pillars
    const heights = [68, 102, 142, 182];
    for (let i = 0; i < 4; i++) {
      const px = bx + 44 + i * 88;
      const h = heights[i];
      const py = by + bh - 20 - h;
      ctx.fillStyle = '#8ba2ff';
      ctx.fillRect(px - 14, by + bh - 20 - h * 0.52, 24, h * 0.52);
      ctx.fillStyle = i === 3 ? '#1226c8' : '#2e4bff';
      ctx.fillRect(px + 14, py, 28, h);
    }

    // Case citation rows at bottom
    for (let row = 0; row < 3; row++) {
      const ry = 424 + row * 70;
      ctx.fillStyle = '#dfe8ff';
      ctx.fillRect(52, ry, 408, 54);
      ctx.strokeStyle = '#5f7dff';
      ctx.lineWidth = 2;
      ctx.strokeRect(52, ry, 408, 54);
      ctx.fillStyle = '#2e4bff';
      ctx.fillRect(68, ry + 16, 22, 22);
      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(104, ry + 14, 195, 10);
      ctx.fillStyle = '#3b528c';
      ctx.fillRect(104, ry + 32, 285, 8);
    }
  } else if (variant === 'matrix') {
    // Shortlist Credential & Packaging Matrix
    ctx.fillStyle = '#16275c';
    ctx.fillRect(52, 104, 408, 42);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(72, 119, 210, 12);

    // Three-column tier structure
    for (let t = 0; t < 3; t++) {
      const tx = 52 + t * 140;
      const ty = 166;
      const tw = 128;
      const th = 298;
      const highlight = t === 1;
      ctx.fillStyle = highlight ? '#cfdcff' : '#dfe8ff';
      ctx.fillRect(tx, ty, tw, th);
      ctx.strokeStyle = highlight ? '#2e4bff' : '#7d97ff';
      ctx.lineWidth = highlight ? 3.5 : 2;
      ctx.strokeRect(tx, ty, tw, th);

      ctx.fillStyle = highlight ? '#2e4bff' : '#3b528c';
      ctx.fillRect(tx + 16, ty + 20, 62, 10);
      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(tx + 16, ty + 42, 92, 16);

      for (let line = 0; line < 7; line++) {
        ctx.fillStyle = line < 4 ? '#16275c' : '#5f7dff';
        ctx.fillRect(tx + 16, ty + 84 + line * 28, tw - 32, 8);
      }
    }

    // Bottom seal bar
    ctx.fillStyle = '#d8e3ff';
    ctx.fillRect(52, 490, 408, 126);
    ctx.strokeStyle = '#2e4bff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(52, 490, 408, 126);
    ctx.fillStyle = '#2e4bff';
    ctx.beginPath();
    ctx.arc(110, 553, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(110, 553, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(162, 526, 224, 14);
    ctx.fillStyle = '#2e4bff';
    ctx.fillRect(162, 552, 264, 10);
    ctx.fillStyle = '#3b528c';
    ctx.fillRect(162, 572, 184, 9);
  } else {
    // 'brief' — Partner Intake & Matter Brief Card
    ctx.fillStyle = '#2e4bff';
    ctx.fillRect(52, 104, 408, 48);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(74, 122, 190, 12);

    // 3 Qualification verification rows
    for (let q = 0; q < 3; q++) {
      const qy = 176 + q * 84;
      ctx.fillStyle = '#dce6ff';
      ctx.fillRect(52, qy, 408, 66);
      ctx.strokeStyle = '#3b5bff';
      ctx.lineWidth = 2;
      ctx.strokeRect(52, qy, 408, 66);

      ctx.fillStyle = '#2e4bff';
      ctx.beginPath();
      ctx.arc(88, qy + 33, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(81, qy + 33);
      ctx.lineTo(86, qy + 38);
      ctx.lineTo(96, qy + 27);
      ctx.stroke();

      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(120, qy + 18, 195, 11);
      ctx.fillStyle = '#2e4bff';
      ctx.fillRect(120, qy + 38, 295, 8);
    }

    // Bottom partner signature / brief block
    ctx.fillStyle = '#dfe8ff';
    ctx.fillRect(52, 444, 408, 178);
    ctx.strokeStyle = '#2e4bff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(52, 444, 408, 178);
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(78, 472, 245, 14);
    ctx.fillStyle = '#3b528c';
    ctx.fillRect(78, 502, 345, 9);
    ctx.fillRect(78, 522, 315, 9);
    ctx.fillRect(78, 542, 265, 9);
    ctx.strokeStyle = '#2e4bff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(78, 594);
    ctx.bezierCurveTo(118, 566, 145, 604, 188, 578);
    ctx.bezierCurveTo(212, 565, 230, 592, 272, 584);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function createCalendarSlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 440;
  const ctx = canvas.getContext('2d')!;

  // Cool architectural schedule ground
  ctx.fillStyle = '#dfe8ff';
  ctx.fillRect(0, 0, 640, 440);

  // Outer frame
  ctx.strokeStyle = '#2e4bff';
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 616, 416);

  // Top schedule header bar
  ctx.fillStyle = '#142354';
  ctx.fillRect(28, 28, 584, 50);
  ctx.fillStyle = '#2e4bff';
  ctx.fillRect(46, 45, 34, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(96, 48, 200, 11);

  // Status pill on top right of header
  ctx.fillStyle = '#2e4bff';
  ctx.fillRect(496, 42, 96, 22);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(512, 50, 64, 6);

  // 5-day column headers & 4 time-slot rows
  const cols = 5;
  const rows = 4;
  const gx = 28;
  const gy = 92;
  const gw = 584;
  const gh = 320;
  const cw = gw / cols;
  const rh = gh / rows;

  for (let c = 0; c < cols; c++) {
    const x = gx + c * cw;
    ctx.fillStyle = c === 3 ? 'rgba(46, 75, 255, 0.16)' : 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(x + 4, gy, cw - 8, gh);

    for (let r = 0; r < rows; r++) {
      const y = gy + r * rh;
      const isHeroSlot = c === 3 && r === 1;
      ctx.fillStyle = isHeroSlot ? '#2e4bff' : '#cad8ff';
      ctx.fillRect(x + 9, y + 7, cw - 18, rh - 14);
      ctx.strokeStyle = isHeroSlot ? '#0a0c12' : '#7d97ff';
      ctx.lineWidth = isHeroSlot ? 3 : 1.5;
      ctx.strokeRect(x + 9, y + 7, cw - 18, rh - 14);

      // Slot indicator bars
      ctx.fillStyle = isHeroSlot ? '#ffffff' : '#3b528c';
      ctx.fillRect(x + 18, y + 20, cw - 44, 8);
      ctx.fillStyle = isHeroSlot ? '#dce6ff' : '#6b87ff';
      ctx.fillRect(x + 18, y + 36, cw - 60, 6);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function createPlinthGridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e5edff';
  ctx.fillRect(0, 0, 512, 512);

  // Fine architectural grid lines
  ctx.strokeStyle = 'rgba(46, 75, 255, 0.14)';
  ctx.lineWidth = 1;
  const step = 32;
  for (let i = step; i < 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Outer double rule
  ctx.strokeStyle = 'rgba(46, 75, 255, 0.42)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 492, 492);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
