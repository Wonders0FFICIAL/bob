// Casualty dummy: a jointed rig built from nested THREE.Group "bones".
// Every body part hangs off its parent joint, so poses are just joint rotations and the
// whole figure moves, scales and gets heat-tagged as one. Units are millimetres at human size
// (1750 mm tall); the caller scales it down to arena size.
//
// Standing frame: +Z up, +X is the way the person faces, +Y is their left.
// The rig is laid on its back by rotating the root, then posed through the joint angles below.

const THREE = window.THREE;

// A tapered capsule (rounded cylinder) along -Z from the joint, built as a lathe so it is smooth.
function capsuleGeo(r0, r1, len, seg = 18) {
  const pts = [];
  const cap = 6;
  // start cap (around the joint, radius r0)
  for (let i = 0; i <= cap; i++) {
    const a = (Math.PI / 2) * (i / cap);
    pts.push(new THREE.Vector2(Math.sin(a) * r0, Math.cos(a) * r0));
  }
  // end cap (radius r1) at distance len below
  for (let i = 0; i <= cap; i++) {
    const a = (Math.PI / 2) * (i / cap);
    pts.push(new THREE.Vector2(Math.cos(a) * r1, -len - Math.sin(a) * r1));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateX(Math.PI / 2);   // lathe runs along Y; turn it so the limb hangs down -Z
  return g;
}

export function buildHuman(mat, opts = {}) {
  const heatBy = opts.heat !== false;
  const M = {
    skin: mat({ color: 0xd8a283, roughness: 0.62 }),
    skinDark: mat({ color: 0xc08a6c, roughness: 0.7 }),
    shirt: mat({ color: 0x5a6350, roughness: 0.9 }),
    vest: mat({ color: 0xff7414, roughness: 0.75 }),
    tape: mat({ color: 0xeaf27c, roughness: 0.35, emissive: 0x4a4a10, emissiveIntensity: 0.5 }),
    pants: mat({ color: 0x2a3550, roughness: 0.92 }),
    boot: mat({ color: 0x17181b, roughness: 0.6 }),
    sole: mat({ color: 0x0b0b0c, roughness: 0.8 }),
    helmet: mat({ color: 0xf0c000, roughness: 0.35, metalness: 0.05 }),
    strap: mat({ color: 0x1b1b1f, roughness: 0.8 }),
    hair: mat({ color: 0x2b1d14, roughness: 0.9 }),
    eye: mat({ color: 0x20120c, roughness: 0.5 }),
    lip: mat({ color: 0xa5584f, roughness: 0.6 }),
    glove: mat({ color: 0x555a63, roughness: 0.85 }),
    dust: mat({ color: 0x9a928a, roughness: 1 }),
    slab: mat({ color: 0x6a6e75, roughness: 0.95 }),
    rebar: mat({ color: 0x6a3d2a, roughness: 0.7, metalness: 0.4 }),
  };
  const root = new THREE.Group();          // lies the body on its back
  const J = {};                             // named joints for posing and animation

  const bone = (parent, name, x, y, z, heat) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (heatBy && heat != null) g.userData.heat = heat;
    parent.add(g);
    J[name] = g;
    return g;
  };
  const part = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const limb = (parent, m, r0, r1, len) => part(parent, capsuleGeo(r0, r1, len), m);
  const ell = (parent, m, rx, ry, rz, x, y, z) => {
    const o = part(parent, new THREE.SphereGeometry(1, 28, 18), m, x, y, z);
    o.scale.set(rx, ry, rz);
    return o;
  };

  // ---- pelvis (root of the skeleton)
  const pelvis = bone(root, 'pelvis', 0, 0, 0, 0.75);
  ell(pelvis, M.pants, 100, 128, 92, 0, 0, 0);
  // ---- spine, chest, shoulders
  const spine = bone(pelvis, 'spine', 0, 0, 80, 0.85);
  ell(spine, M.shirt, 96, 118, 124, 0, 0, 70);           // belly / lower torso
  const chest = bone(spine, 'chest', 0, 0, 200, 0.9);
  ell(chest, M.shirt, 112, 168, 150, 0, 0, 0);            // ribcage
  // hi-vis vest: slightly larger shell with reflective bands
  const vest = ell(chest, M.vest, 118, 176, 156, 0, 0, 6);
  vest.scale.set(116, 172, 154);
  // reflective bands: thin lunes of a slightly larger ellipsoid (poles along Z), so they hug the vest
  const lune = (phi0, phiLen, th0, thLen) => {
    const o = part(chest, new THREE.SphereGeometry(1, 10, 28, phi0, phiLen, th0, thLen), M.tape, 0, 0, 6);
    o.rotation.x = Math.PI / 2;
    o.scale.set(117.6, 155.6, 173.6);
    return o;
  };
  for (const s of [-1, 1]) lune(Math.PI + s * 0.36 - 0.07, 0.14, 0.25, 2.55);   // two vertical stripes
  lune(0, Math.PI * 2, 1.98, 0.13);                                           // waist band
  // ---- neck + head
  const neck = bone(chest, 'neck', 0, 0, 150, 1);
  { const n = part(neck, new THREE.CylinderGeometry(46, 52, 80, 16), M.skin, 0, 0, 30); n.rotation.x = Math.PI / 2; n.rotation.x = 0; n.rotation.set(Math.PI / 2, 0, 0); }
  const head = bone(neck, 'head', 0, 0, 100, 1);
  ell(head, M.skin, 98, 84, 112, 0, 0, 80);                // skull and face
  ell(head, M.skin, 54, 62, 50, 58, 0, 28);                // jaw / chin
  ell(head, M.skin, 22, 18, 30, 98, 0, 60).scale.set(30, 19, 34);  // nose
  for (const s of [-1, 1]) {
    ell(head, M.skinDark, 18, 12, 36, -4, s * 86, 76);      // ears
    const eye = ell(head, M.eye, 4, 15, 4, 88, s * 36, 100);// closed eyes: slim slits
    eye.scale.set(4, 17, 3);
    const brow = ell(head, M.hair, 5, 24, 4, 86, s * 36, 114);
    brow.scale.set(5, 24, 5);
  }
  ell(head, M.lip, 8, 26, 6, 80, 0, 22).scale.set(8, 26, 5);   // mouth
  // hair at the back / sides under the helmet
  ell(head, M.hair, 78, 74, 80, -34, 0, 118);
  // helmet: a dome, a brim and a chin strap
  const hel = part(head, new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), M.helmet, 0, 0, 100);
  hel.scale.set(116, 104, 112);
  const brim = part(head, new THREE.CylinderGeometry(112, 118, 8, 32), M.helmet, 8, 0, 112);
  brim.scale.set(1.08, 0.96, 1);
  part(head, new THREE.BoxGeometry(150, 14, 10), M.strap, 6, 0, 118).rotation.z = 0;   // front ridge shade
  for (const s of [-1, 1]) {
    const st = part(head, new THREE.CylinderGeometry(4, 4, 112, 8), M.strap, 14, s * 82, 24);
    st.rotation.x = 0.1 * s;
  }

  // ---- arms (rest pose hangs down -Z; shoulders rotate them out)
  const arm = (sgn) => {
    const sh = bone(chest, 'shoulder' + (sgn > 0 ? 'L' : 'R'), 0, sgn * 178, 110, 0.85);
    ell(sh, M.vest, 62, 60, 62, 0, 0, 0);                  // vest shoulder
    limb(sh, M.shirt, 54, 46, 250);                         // upper arm in shirt sleeve
    const el = bone(sh, 'elbow' + (sgn > 0 ? 'L' : 'R'), 0, 0, -262, 1);
    limb(el, M.skin, 44, 36, 230);                          // forearm (bare)
    const wr = bone(el, 'wrist' + (sgn > 0 ? 'L' : 'R'), 0, 0, -246, 1);
    part(wr, new THREE.BoxGeometry(34, 78, 94), M.glove, 0, 0, -46).scale.set(1, 1, 1);   // glove palm
    for (let f = 0; f < 4; f++) {
      const fg = bone(wr, 'finger' + (sgn > 0 ? 'L' : 'R') + f, 4, (f - 1.5) * 20, -92, 0.95);
      limb(fg, M.glove, 9, 8, 38);
      fg.rotation.y = 0.35;                                  // slightly curled
    }
    const th = bone(wr, 'thumb' + (sgn > 0 ? 'L' : 'R'), 18, -sgn * 40, -40, 0.95);
    limb(th, M.glove, 10, 8, 36);
    th.rotation.y = -0.5;
    th.rotation.x = -sgn * 0.7;
    return sh;
  };
  const armL = arm(1), armR = arm(-1);

  // ---- legs
  const leg = (sgn) => {
    const hp = bone(pelvis, 'hip' + (sgn > 0 ? 'L' : 'R'), 0, sgn * 85, -20, 0.7);
    ell(hp, M.pants, 72, 70, 74, 0, 0, 0);
    limb(hp, M.pants, 74, 58, 420);                          // thigh
    const kn = bone(hp, 'knee' + (sgn > 0 ? 'L' : 'R'), 0, 0, -435, 0.7);
    ell(kn, M.pants, 60, 58, 60, 0, 0, 0);
    limb(kn, M.pants, 58, 44, 400);                          // shin
    const an = bone(kn, 'ankle' + (sgn > 0 ? 'L' : 'R'), 0, 0, -412, 0.4);
    const boot = part(an, new THREE.BoxGeometry(205, 86, 78), M.boot, 52, 0, -36);
    boot.geometry.translate(0, 0, 0);
    ell(an, M.boot, 46, 44, 46, 6, 0, -8);                   // ankle cuff
    ell(an, M.boot, 78, 44, 40, 150, 0, -42);                // toe cap, rounded
    part(an, new THREE.BoxGeometry(220, 92, 14), M.sole, 56, 0, -76);
    return hp;
  };
  const legL = leg(1), legR = leg(-1);

  // ---- pose: lying on the back, left arm resting on the belly area, right arm raised weakly
  J.pelvis.position.set(0, 0, 0);
  // knees slightly bent, one leg dropped sideways
  J.hipL.rotation.set(0, -0.18, 0.06);
  J.kneeL.rotation.set(0, 0.28, 0);
  J.ankleL.rotation.set(0, -0.1, 0.12);
  J.hipR.rotation.set(0, -0.06, -0.12);
  J.kneeR.rotation.set(0, 0.12, 0);
  J.ankleR.rotation.set(0, -0.05, -0.2);
  J.spine.rotation.set(0, 0, 0.04);
  J.chest.rotation.set(0, 0, -0.06);
  J.head.rotation.set(0, 0.05, 0.28);
  J.neck.rotation.set(0, 0.04, 0.05);
  // left arm lies along the body with a slightly bent elbow
  J.shoulderL.rotation.set(0.22, 0.1, 0.0);
  J.elbowL.rotation.set(0, 0.35, 0);
  // right arm: raised, forearm up, waving weakly
  J.shoulderR.rotation.set(-1.15, 0.25, 0.0);
  J.elbowR.rotation.set(0, 1.05, 0);

  // ---- lay the whole figure on its back, resting on the ground (back thickness ~ 150 mm)
  const lay = new THREE.Group();
  lay.rotation.y = -Math.PI / 2;     // up (+Z) -> toward -X, face (+X) -> up (+Z)
  lay.add(root);
  const wrap = new THREE.Group();
  wrap.add(lay);
  wrap.position.set(0, 0, 150);
  wrap.userData.human = true;

  // ---- fallen debris on the shins: slab, broken rebar and rocks (in the lying frame: legs run +X)
  const debris = new THREE.Group();
  const sl = part(debris, new THREE.BoxGeometry(420, 520, 56), M.slab, 1020, 0, 100);
  sl.rotation.set(0.02, -0.07, 0.05);
  sl.userData.heat = 0.12;
  const sl2 = part(debris, new THREE.BoxGeometry(150, 130, 90), M.slab, 880, -300, 45);
  sl2.rotation.z = 0.3; sl2.userData.heat = 0.12;
  const sl3 = part(debris, new THREE.BoxGeometry(130, 120, 70), M.slab, 1260, 280, 36);
  sl3.rotation.z = -0.5; sl3.userData.heat = 0.12;
  for (let i = 0; i < 3; i++) {
    const rb = part(debris, new THREE.CylinderGeometry(6, 6, 300 + i * 50, 8), M.rebar, 1200 + i * 30, -120 + i * 70, 150 + i * 16);
    rb.rotation.set(0.5 + i * 0.1, 0.4 - i * 0.2, 0.3);
    rb.userData.heat = 0.1;
  }
  for (let i = 0; i < 9; i++) {      // rubble crumbs
    const s = 14 + ((i * 37) % 26);
    const c = part(debris, new THREE.DodecahedronGeometry(s, 0), M.dust, 820 + (i * 83) % 520, -260 + (i * 131) % 520, s * 0.5);
    c.rotation.set(i, i * 2, i * 3);
    c.userData.heat = 0.1;
  }
  wrap.add(debris);
  // a light dusting of grey on the vest and shoulder (looks lived-in)
  ell(chest, M.dust, 80, 60, 20, -10, -40, 150).material = mat({ color: 0x9a928a, roughness: 1, transparent: true, opacity: 0.35 });

  // ---- idle animation: breathing and a weak wave of the raised hand
  function animate(t) {
    const br = Math.sin(t * 1.55);
    J.chest.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.026);
    J.spine.scale.set(1, 1 + br * 0.008, 1 + br * 0.012);
    J.elbowR.rotation.x = Math.sin(t * 1.3) * 0.22;
    J.shoulderR.rotation.z = Math.sin(t * 0.9) * 0.07;
    J.wristR.rotation.x = Math.sin(t * 2.2) * 0.35;
    J.head.rotation.z = 0.28 + Math.sin(t * 0.37) * 0.04;
    for (let f = 0; f < 4; f++) J['fingerR' + f].rotation.x = Math.sin(t * 2.2 + f * 0.7) * 0.2;
  }
  animate(0);

  return { group: wrap, joints: J, animate, length: 1800 };
}
