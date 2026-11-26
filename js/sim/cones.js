// Knockable traffic cones: a light plastic cone on a square base. Bob can push it along the floor
// (slow) or knock it over (faster). Each cone is a Group pivoting about the base rim it falls over.
const THREE = window.THREE;

export const MAXC = 40;                 // most cones in any arena (replay frames reserve room for this many)
const R = 60;                           // base rim radius the cone tips about (mm)
const HC = 78;                          // height of the centre of mass above the base (mm)
const G = 9810;
const INERT = 1.5 * (HC * HC + R * R);  // moment of inertia about the rim, per unit mass
const TIP = Math.atan(R / HC);          // angle past which gravity wins
const REST = 1.22;                      // lying on its slanted side (about 70 degrees from upright)

function coneGeo() {
  // lathe profile (radius, height): body with a rounded tip, along Y; turned upright afterwards
  const prof = [[0, 176], [10, 174], [15, 166], [30, 110], [46, 52], [60, 10], [62, 8], [0, 8]];
  const g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 28);
  g.rotateX(Math.PI / 2);               // axis Y -> Z
  return g;
}
function bandGeo(h0, h1) {
  const r = h => 62 - (h - 8) * (62 - 15) / (166 - 8) + 1.4;
  const g = new THREE.LatheGeometry([new THREE.Vector2(r(h0), h0), new THREE.Vector2(r(h1), h1)], 28);
  g.rotateX(Math.PI / 2);
  return g;
}

export function createCones(mat, parent) {
  const orange = mat({ color: 0xff6410, roughness: 0.5 });
  const white = mat({ color: 0xf1f1ee, roughness: 0.35, emissive: 0x303030, emissiveIntensity: 0.4 });
  const base = mat({ color: 0x1d2025, roughness: 0.7 });
  const geoCone = coneGeo(), geoB1 = bandGeo(64, 88), geoB2 = bandGeo(100, 118);
  const geoBase = new THREE.BoxGeometry(150, 150, 8);
  const list = [];
  const group = new THREE.Group();
  parent.add(group);
  let knocked = 0, hooks = {};

  function make(x, y) {
    const outer = new THREE.Group();        // at the rim pivot, turned to the fall direction
    const inner = new THREE.Group();        // rotates about the pivot (local Y)
    outer.add(inner);
    const body = new THREE.Group();
    body.position.set(-R, 0, 0);
    inner.add(body);
    for (const [g, m] of [[geoBase, base], [geoCone, orange], [geoB1, white], [geoB2, white]]) {
      const o = new THREE.Mesh(g, m);
      o.castShadow = o.receiveShadow = true;
      if (g === geoBase) o.position.z = 4;
      body.add(o);
    }
    body.userData.heat = 0.1;
    group.add(outer);
    const c = { x, y, x0: x, y0: y, vx: 0, vy: 0, dir: 0, ang: 0, w: 0, hit: false, counted: false, outer, inner, still: true };
    list.push(c);
    place(c);
    return c;
  }
  function place(c) {
    c.outer.position.set(c.x + Math.cos(c.dir) * R, c.y + Math.sin(c.dir) * R, 0);
    c.outer.rotation.z = c.dir;
    c.inner.rotation.y = c.ang;
  }
  function build(points) {
    for (const c of list) group.remove(c.outer);
    list.length = 0;
    knocked = 0;
    points.slice(0, MAXC).forEach(p => make(p[0], p[1]));
  }
  function reset() {
    knocked = 0;
    for (const c of list) { c.x = c.x0; c.y = c.y0; c.vx = c.vy = 0; c.ang = 0; c.w = 0; c.counted = false; c.still = true; place(c); }
  }

  // One physics step. B = {X,Y,psi,v,w (mm/s, rad/s)}; bounds = arena rectangle
  function step(dt, B, bounds) {
    const ch = Math.cos(B.psi), sh = Math.sin(B.psi);
    const sub = Math.max(1, Math.ceil(dt / 0.004)), h = dt / sub;
    for (const c of list) {
      // --- contact with Bob (rectangle in Bob's frame)
      const rx = c.x - B.X, ry = c.y - B.Y;
      const dx = rx * ch + ry * sh, dy = -rx * sh + ry * ch;
      const px = Math.max(-250, Math.min(250, dx)), py = Math.max(-140, Math.min(140, dy));
      const ex = dx - px, ey = dy - py, d = Math.hypot(ex, ey);
      if (d < R + 6) {
        let nx, ny;
        if (d > 1e-3) { nx = ex / d; ny = ey / d; } else { nx = dx >= 0 ? 1 : -1; ny = 0; }
        const wx = nx * ch - ny * sh, wy = nx * sh + ny * ch;                   // contact normal in world
        const vbx = B.v * ch - B.w * ry, vby = B.v * sh + B.w * rx;              // Bob's velocity at that point
        const rel = (vbx - c.vx) * wx + (vby - c.vy) * wy;                       // closing speed along the normal
        const pen = R + 6 - d;
        c.x += wx * pen; c.y += wy * pen;                                        // push the cone out of the robot
        if (rel > 0) {
          c.vx += wx * rel * 1.1; c.vy += wy * rel * 1.1;
          if (rel > 55 && c.ang < 0.6) {                                          // a firm hit tips it
            c.dir = Math.atan2(wy, wx);
            c.w = Math.max(c.w, rel / 45);
            c.still = false;
            if (hooks.hit) hooks.hit(c, rel);
          } else if (rel > 18 && hooks.nudge) hooks.nudge(c, rel);
        }
        c.still = false;
      }
      if (c.still) continue;
      // --- motion
      for (let i = 0; i < sub; i++) {
        const sp = Math.hypot(c.vx, c.vy);
        if (sp > 0) {
          const dec = (c.ang > 0.05 ? 1100 : 600) * h;
          if (sp <= dec) { c.vx = c.vy = 0; } else { c.vx -= c.vx / sp * dec; c.vy -= c.vy / sp * dec; }
          c.x += c.vx * h; c.y += c.vy * h;
        }
        if (c.ang > 0 || c.w > 0) {
          // gravity torque about the rim (restoring when the centre of mass is inboard of the rim)
          const alpha = -G * (R * Math.cos(c.ang) - HC * Math.sin(c.ang)) / INERT;
          c.w += alpha * h; c.w *= 1 - 1.4 * h;
          c.ang += c.w * h;
          if (c.ang <= 0) {
            c.ang = 0;
            if (c.w < -2.5 && hooks.land) hooks.land(c, 0.35);                   // rocks back onto its base
            c.w = Math.abs(c.w) > 1 ? -c.w * 0.2 : 0;
          }
          if (c.ang >= REST) {
            if (c.w > 1.2 && hooks.land) hooks.land(c, Math.min(1, c.w / 4));    // lands on its side
            c.ang = REST; c.w = c.w > 0.8 ? -c.w * 0.22 : 0;
          }
          if (!c.counted && c.ang > TIP + 0.15) { c.counted = true; knocked++; if (hooks.knock) hooks.knock(c); }
        }
      }
      c.x = Math.max(bounds.x0 + 90, Math.min(bounds.x1 - 90, c.x));
      c.y = Math.max(-bounds.yh + 90, Math.min(bounds.yh - 90, c.y));
      if (c.vx === 0 && c.vy === 0 && c.w === 0 && Math.hypot(dx, dy) > 400) c.still = true;
      place(c);
    }
  }

  // replay support: x, y, angle, direction per cone, MAXC slots
  function write(a, o) {
    for (let i = 0; i < MAXC; i++) {
      const c = list[i];
      a[o + i * 4] = c ? c.x : 0; a[o + i * 4 + 1] = c ? c.y : 0; a[o + i * 4 + 2] = c ? c.ang : 0; a[o + i * 4 + 3] = c ? c.dir : 0;
    }
    return o + MAXC * 4;
  }
  function read(a, o) {
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      c.x = a[o + i * 4]; c.y = a[o + i * 4 + 1]; c.ang = a[o + i * 4 + 2]; c.dir = a[o + i * 4 + 3];
      place(c);
    }
    return o + MAXC * 4;
  }
  return {
    build, reset, step, write, read, list,
    knocked: () => knocked,
    points: () => list.map(c => [c.x, c.y, c.ang]),
    on: (name, fn) => { hooks[name] = fn; },
  };
}
