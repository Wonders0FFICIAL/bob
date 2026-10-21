export const LOOKS = [
  { shirt: "#E4572E", pants: "#2F4B7C", skin: "#F1C27D", hair: "#2B1B12" },
  { shirt: "#2E86AB", pants: "#3D3D4E", skin: "#C68B59", hair: "#14100E" },
  { shirt: "#F2B705", pants: "#4A3F35", skin: "#8D5A3B", hair: "#0D0A08" },
  { shirt: "#7BB661", pants: "#2B3A55", skin: "#FFDBB0", hair: "#7A4A21" },
];

const limb = (ctx, pts, w, col) => {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
};

export function drawStanding(ctx, x, y, s, t, look = LOOKS[0], calm = false) {
  const sw = calm ? 0.4 : Math.sin(t / 6), sw2 = calm ? -0.4 : Math.sin(t / 6 + Math.PI);
  ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 11 * s, 3.2 * s, 0, 0, 7); ctx.fill();
  limb(ctx, [[x - 3.6 * s, y - 19 * s], [x - 4.2 * s, y - 2 * s]], 5.2 * s, look.pants);
  limb(ctx, [[x + 3.6 * s, y - 19 * s], [x + 4.2 * s, y - 2 * s]], 5.2 * s, look.pants);
  ctx.fillStyle = "#1B1612";
  ctx.beginPath(); ctx.ellipse(x - 4.6 * s, y - 0.6 * s, 3.6 * s, 1.8 * s, 0, 0, 7); ctx.ellipse(x + 4.6 * s, y - 0.6 * s, 3.6 * s, 1.8 * s, 0, 0, 7); ctx.fill();
  const arm = (side, sway) => {
    const sx = x + side * 8.4 * s, sy = y - 33 * s;
    const ex = sx + side * (5 + sway * 2) * s, ey = sy - 5 * s;
    const hx = ex + side * (2 + sway * 5) * s, hy = ey - (9 + sway * 2) * s;
    limb(ctx, [[sx, sy], [ex, ey]], 4.6 * s, look.shirt);
    limb(ctx, [[ex, ey], [hx, hy]], 3.6 * s, look.skin);
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(hx, hy, 2.6 * s, 0, 7); ctx.fill();
  };
  arm(-1, sw); arm(1, sw2);
  ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.roundRect(x - 8.6 * s, y - 35 * s, 17.2 * s, 18 * s, 5 * s); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(x - 8.6 * s, y - 24 * s, 17.2 * s, 2.2 * s);
  ctx.fillStyle = look.skin; ctx.fillRect(x - 2 * s, y - 38.5 * s, 4 * s, 4 * s);
  ctx.beginPath(); ctx.arc(x, y - 43 * s, 6.4 * s, 0, 7); ctx.fill();
  ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(x, y - 44.2 * s, 6.6 * s, Math.PI * 1.04, Math.PI * 1.96); ctx.closePath(); ctx.fill();
  if (s > 0.55) {
    ctx.fillStyle = "#1B1612"; ctx.beginPath(); ctx.arc(x - 2.3 * s, y - 42.6 * s, 0.8 * s, 0, 7); ctx.arc(x + 2.3 * s, y - 42.6 * s, 0.8 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = "#1B1612"; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.arc(x, y - 40.6 * s, 2 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
}

export function drawLying(ctx, x, y, s, ang, look = LOOKS[0], t = 0, calm = false) {
  const breathe = calm ? 0 : Math.sin(t / 22) * 0.35;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(1 * s, 2 * s, 24 * s, 9 * s, 0, 0, 7); ctx.fill();
  limb(ctx, [[-8 * s, -2.6 * s], [-17 * s, -3 * s], [-25 * s, -5 * s]], 4.6 * s, look.pants);
  limb(ctx, [[-8 * s, 2.6 * s], [-17 * s, 4 * s], [-24 * s, 3 * s]], 4.6 * s, look.pants);
  ctx.fillStyle = "#1B1612"; ctx.beginPath(); ctx.ellipse(-26.5 * s, -5 * s, 2.6 * s, 1.8 * s, 0, 0, 7); ctx.ellipse(-25.5 * s, 3 * s, 2.6 * s, 1.8 * s, 0, 0, 7); ctx.fill();
  limb(ctx, [[5 * s, -6.5 * s], [10 * s, -11 * s], [16 * s, -12 * s]], 3.8 * s, look.shirt);
  limb(ctx, [[5 * s, 6.5 * s], [9 * s, 11 * s], [4 * s, 14 * s]], 3.8 * s, look.shirt);
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(16.5 * s, -12 * s, 2.2 * s, 0, 7); ctx.arc(3.4 * s, 14.3 * s, 2.2 * s, 0, 7); ctx.fill();
  ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.roundRect(-9 * s, (-6.6 - breathe) * s, 19 * s, (13.2 + breathe * 2) * s, 5 * s); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.26)"; ctx.fillRect(-3 * s, -6.4 * s, 2.2 * s, 12.8 * s);
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(15 * s, 0, 5.6 * s, 0, 7); ctx.fill();
  ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(14 * s, 0, 5.8 * s, Math.PI * 0.55, Math.PI * 1.45); ctx.closePath(); ctx.fill();
  ctx.restore();
}
