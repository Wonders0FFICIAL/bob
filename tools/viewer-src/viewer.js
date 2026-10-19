import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, PointLight,
  Group, Color, Box3, Vector3, MathUtils, Mesh, MeshStandardMaterial, PlaneGeometry,
  CanvasTexture, SRGBColorSpace, DoubleSide
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const HOME = { azimuth: 0.85, polar: 1.22, distance: 0.95 };
const DOOR_OPEN_RAD = (110 * Math.PI) / 180;

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, "rgba(0,0,0,.42)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function mergeFaces(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.parent || o.parent === root || o.parent.isScene || o.parent.parent === root) return;
    if (!groups.has(o.parent)) groups.set(o.parent, []);
    groups.get(o.parent).push(o);
  });
  for (const [holder, meshes] of groups) {
    if (meshes.length < 2) continue;
    holder.updateMatrixWorld(true);
    const inverse = holder.matrixWorld.clone().invert();
    const geos = meshes.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
      g.morphAttributes = {};
      return g.index ? g.toNonIndexed() : g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new Mesh(merged, meshes[0].material);
    for (const m of meshes) { m.parent.remove(m); m.geometry.dispose(); }
    holder.add(mesh);
  }
}

function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

export async function createViewer({ canvas, modelUrl, calm = false }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.02, 20);
  const hemi = new HemisphereLight(0xffffff, 0x8a98a5, 1.55);
  const sun = new DirectionalLight(0xffffff, 2.1);
  sun.position.set(0.8, 1.6, 1.1);
  const torch = new PointLight(0xfff4e0, 0, 1.6, 1.4);
  scene.add(hemi, sun, torch);

  const shadow = new Mesh(
    new PlaneGeometry(0.9, 0.9),
    new MeshStandardMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, side: DoubleSide })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  shadow.material.emissive = new Color(0x000000);
  scene.add(shadow);

  const parts = new Map();
  const labelOf = (name) => name.replace(/_/g, " ");
  const models = {};
  const loader = new GLTFLoader();
  let active = "bob";

  async function loadModel(key, url) {
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    mergeFaces(root);
    root.visible = key === "bob";
    scene.add(root);
    const box = new Box3().setFromObject(root);
    const center = box.getCenter(new Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
    const size = box.getSize(new Vector3());
    const names = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.userData.base = { emissive: new Color(0x000000), intensity: 0 };
      const holder = o.parent && o.parent.name && o.parent.parent !== root ? o.parent : o;
      const label = labelOf(holder.name || o.name);
      if (!parts.has(label)) {
        parts.set(label, { node: holder, meshes: [] });
        names.push(label);
      }
      parts.get(label).meshes.push(o);
    });
    models[key] = { root, size, names, target: new Vector3(0, size.y * 0.42, 0), k: 1 };
    return models[key];
  }

  const bob = await loadModel("bob", modelUrl);
  const model = bob.root;
  const flights = {};

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = !calm;
  controls.dampingFactor = 0.09;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.52;
  controls.target.copy(bob.target);
  controls.rotateSpeed = 0.7;
  canvas.style.touchAction = "pan-y";

  const sph = { azimuth: HOME.azimuth, polar: HOME.polar, distance: HOME.distance };
  function placeCamera() {
    const s = Math.sin(sph.polar);
    camera.position.set(
      controls.target.x + sph.distance * s * Math.sin(sph.azimuth),
      controls.target.y + sph.distance * Math.cos(sph.polar),
      controls.target.z + sph.distance * s * Math.cos(sph.azimuth)
    );
    camera.lookAt(controls.target);
  }
  placeCamera();

  let autoRotate = !calm;
  let visible = true;
  let inView = true;
  let raf = 0;
  let disposed = false;
  let tween = null;
  let doors = [];
  let doorsOpen = 0;
  let doorsGoal = 0;
  let pulse = null;
  let last = performance.now();

  for (const side of ["left", "right"]) {
    const entry = parts.get("Hangar door " + side);
    if (!entry) continue;
    const door = entry.node;
    model.updateMatrixWorld(true);
    const wb = new Box3().setFromObject(door);
    const lo = door.parent.worldToLocal(wb.min.clone());
    const hi = door.parent.worldToLocal(wb.max.clone());
    const cx = (lo.x + hi.x) / 2;
    const cz = (lo.z + hi.z) / 2;
    const sy = lo.y + hi.y > 0 ? 1 : -1;
    const hinge = new Vector3(cx, sy > 0 ? Math.max(lo.y, hi.y) : Math.min(lo.y, hi.y), cz);
    const pivot = new Group();
    pivot.position.copy(hinge);
    door.parent.add(pivot);
    pivot.add(door);
    door.position.sub(hinge);
    doors.push({ pivot, sy });
  }

  function prepFlight(key) {
    const m = models[key];
    const list = key === "bob" ? m.names.filter((n) => n.startsWith("Pip ")) : m.names;
    const first = parts.get(list[0]).node;
    const parent = first.parent;
    const lift = new Group();
    parent.add(lift);
    m.root.updateMatrixWorld(true);
    const props = [];
    for (const n of list) {
      const node = parts.get(n).node;
      if (/Propeller/.test(n)) {
        const wb = new Box3().setFromObject(node);
        const c = lift.worldToLocal(wb.getCenter(new Vector3()));
        const pivot = new Group();
        pivot.position.copy(c);
        lift.add(pivot);
        pivot.add(node);
        node.position.sub(c);
        props.push(pivot);
      } else {
        lift.add(node);
      }
    }
    return { lift, props, t: 0, launch: false, spin: false, height: key === "bob" ? 0.15 : 0.03, k: m.k };
  }

  function readOrbit() {
    const off = camera.position.clone().sub(controls.target);
    sph.distance = off.length();
    sph.polar = Math.acos(MathUtils.clamp(off.y / sph.distance, -1, 1));
    sph.azimuth = Math.atan2(off.x, off.z);
  }

  function resize() {
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.3 ? 44 : 32;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => { resize(); wake(); });
  ro.observe(canvas);
  resize();

  function frame(now) {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let busy = false;

    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.ms);
      const k = tween.out ? 1 - (1 - t) * (1 - t) : ease(t);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
      sph.azimuth = tween.fromAz + (tween.toAz - tween.fromAz) * k;
      sph.polar = tween.fromPol + (tween.toPol - tween.fromPol) * k;
      sph.distance = tween.fromDist + (tween.toDist - tween.fromDist) * k;
      placeCamera();
      if (t >= 1) tween = null;
      busy = true;
    } else if (autoRotate && !calm) {
      readOrbit();
      sph.azimuth += dt * 0.28;
      placeCamera();
      busy = true;
    }

    if (Math.abs(doorsGoal - doorsOpen) > 0.001) {
      doorsOpen += (doorsGoal - doorsOpen) * Math.min(1, dt * (calm ? 60 : 5));
      for (const d of doors) d.pivot.rotation.x = -d.sy * DOOR_OPEN_RAD * doorsOpen;
      busy = true;
    } else if (doors.length && doorsOpen !== doorsGoal) {
      doorsOpen = doorsGoal;
      for (const d of doors) d.pivot.rotation.x = -d.sy * DOOR_OPEN_RAD * doorsOpen;
      busy = true;
    }

    for (const f of Object.values(flights)) {
      const goal = f.launch ? 1 : 0;
      if (Math.abs(goal - f.t) > 0.001) {
        f.t += (goal - f.t) * Math.min(1, dt * (calm ? 60 : 3.2));
        busy = true;
      } else {
        f.t = goal;
      }
      const hover = f.launch && !calm ? Math.sin(now / 420) * 0.004 * f.k : 0;
      f.lift.position.z = f.height * f.t + hover;
      if (f.spin && !calm) {
        for (const p of f.props) p.rotation.z += dt * 38;
        busy = true;
      }
      if (f.launch && !calm) busy = true;
    }

    if (pulse) {
      const age = (now - pulse.t0) / 1000;
      const k = 0.55 + 0.45 * Math.sin(age * 5);
      for (const m of pulse.list) {
        m.material.emissive.set(0xff9a1f);
        m.material.emissiveIntensity = calm ? 0.4 : 0.18 + 0.32 * k;
      }
      busy = true;
    }

    if (controls.update()) busy = true;
    renderer.render(scene, camera);
    if (busy && visible) wake();
  }

  function wake() {
    if (!raf && visible && !disposed) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  controls.addEventListener("start", () => { autoRotate = false; tween = null; wake(); });
  controls.addEventListener("change", () => { wake(); });
  document.addEventListener("visibilitychange", () => { visible = !document.hidden && inView; if (visible) wake(); });

  function boxOf(names) {
    const b = new Box3();
    for (const n of names) {
      const e = parts.get(n);
      if (e) b.expandByObject(e.node);
    }
    return b;
  }

  function flyTo(toTarget, toAz, toPol, toDist, ms = 700, out = false) {
    readOrbit();
    tween = {
      t0: performance.now(), ms: calm ? 1 : ms, out,
      fromTarget: controls.target.clone(), toTarget,
      fromAz: sph.azimuth, toAz: nearestAngle(sph.azimuth, toAz),
      fromPol: sph.polar, toPol,
      fromDist: sph.distance, toDist
    };
    autoRotate = false;
    wake();
  }
  function nearestAngle(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return from + d;
  }

  const api = {
    names: () => (models[active] ? models[active].names : []),
    hasPip: () => !!models.pip,
    mode: () => active,
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    setMaterial(names, { color, roughness, metalness, emissive, emissiveIntensity }) {
      for (const n of names) {
        const e = parts.get(n);
        if (!e) continue;
        for (const m of e.meshes) {
          if (color !== undefined) m.material.color.set(color);
          if (roughness !== undefined) m.material.roughness = roughness;
          if (metalness !== undefined) m.material.metalness = metalness;
          m.material.userData.base.emissive = new Color(emissive !== undefined ? emissive : 0x000000);
          m.material.userData.base.intensity = emissiveIntensity || 0;
          m.material.emissive.copy(m.material.userData.base.emissive);
          m.material.emissiveIntensity = m.material.userData.base.intensity;
        }
      }
      wake();
    },
    highlight(names) {
      if (pulse) {
        for (const m of pulse.list) {
          m.material.emissive.copy(m.material.userData.base.emissive);
          m.material.emissiveIntensity = m.material.userData.base.intensity;
        }
        pulse = null;
      }
      if (names && names.length) {
        const list = names.flatMap((n) => (parts.get(n) ? parts.get(n).meshes : []));
        pulse = { list, t0: performance.now() };
      }
      wake();
    },
    focus(names, view) {
      const b = boxOf(names);
      if (b.isEmpty()) return;
      const c = b.getCenter(new Vector3());
      const sz = b.getSize(new Vector3()).length();
      flyTo(c, view ? view.azimuth : Math.atan2(camera.position.x - c.x, camera.position.z - c.z), view ? view.polar : 1.15, Math.max(0.62, sz * 2.4 + 0.25) * models[active].k);
    },
    resetView() {
      flyTo(models[active].target.clone(), HOME.azimuth, HOME.polar, HOME.distance * models[active].k, 800);
    },
    zoom(factor) {
      readOrbit();
      const k = models[active].k;
      const to = MathUtils.clamp(sph.distance * factor, 0.35 * k, 1.6 * k);
      flyTo(controls.target.clone(), sph.azimuth, sph.polar, to, 220, true);
    },
    rotate(dAz, dPol) {
      readOrbit();
      const pol = MathUtils.clamp(sph.polar + dPol, 0.35, 1.52);
      flyTo(controls.target.clone(), sph.azimuth + dAz, pol, sph.distance, 200, true);
    },
    async loadPip(url) {
      if (models.pip) return;
      const m = await loadModel("pip", url);
      m.k = m.size.x / models.bob.size.x;
    },
    setMode(mode) {
      if (!models[mode]) return;
      active = mode;
      for (const [key, m] of Object.entries(models)) m.root.visible = key === mode;
      shadow.scale.setScalar(models[mode].k);
      flyTo(models[mode].target.clone(), HOME.azimuth, HOME.polar, HOME.distance * models[mode].k, 900);
    },
    setFlight(on) {
      const key = active;
      if (!flights[key]) flights[key] = prepFlight(key);
      const f = flights[key];
      f.launch = on;
      f.spin = on;
      wake();
    },
    setDoorsOpen(open) {
      doorsGoal = open ? 1 : 0;
      wake();
    },
    setHidden(names, hidden) {
      for (const n of names) {
        const e = parts.get(n);
        if (e) e.node.visible = !hidden;
      }
      wake();
    },
    setLightsOff(off) {
      hemi.intensity = off ? 0.1 : 1.55;
      sun.intensity = off ? 0.05 : 2.1;
      torch.intensity = off ? 0.55 : 0;
      shadow.visible = !off;
      wake();
    },
    setAutoRotate(on) { autoRotate = on && !calm; wake(); },
    setVisible(v) { inView = v; visible = v && !document.hidden; if (visible) wake(); },
    render() { renderer.render(scene, camera); },
    dispose() {
      disposed = true;
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    }
  };

  controls.addEventListener("change", () => {
    torch.position.copy(camera.position).add(new Vector3(0, 0.05, 0));
  });
  torch.position.copy(camera.position);
  wake();
  return api;
}
