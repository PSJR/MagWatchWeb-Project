/**
 * Viewer for the 2 km x 2 km low-poly forest map.
 *
 * Reads the generated data in ../data and the Kenney kit in ../assets, then
 * renders the terrain, the water, the hand-placed landmarks and the instanced
 * vegetation, with wind applied in the vertex shader to everything the
 * generator flagged as foliage.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const DATA = '../data/';
const ASSETS = '../assets/';
const TILE = 250;                 // instancing tile size in metres (8x8 over the map)

const el = (id) => document.getElementById(id);
const progress = (pct, msg) => {
  document.querySelector('#bar i').style.width = pct + '%';
  if (msg) el('loading-msg').textContent = msg;
};

/* ------------------------------------------------------------------ *
 * Height field
 * ------------------------------------------------------------------ */
class HeightField {
  constructor(buffer, res, size, min, max) {
    this.data = new Uint16Array(buffer);
    this.res = res;
    this.size = size;
    this.min = min;
    this.span = max - min;
    this.step = size / (res - 1);
  }
  at(x, z) {
    const r = this.res;
    let fx = x / this.step, fz = z / this.step;
    fx = Math.min(Math.max(fx, 0), r - 1.0001);
    fz = Math.min(Math.max(fz, 0), r - 1.0001);
    const x0 = fx | 0, z0 = fz | 0, tx = fx - x0, tz = fz - z0;
    const d = this.data, s = this.span / 65535, m = this.min;
    const h00 = m + d[z0 * r + x0] * s;
    const h10 = m + d[z0 * r + x0 + 1] * s;
    const h01 = m + d[(z0 + 1) * r + x0] * s;
    const h11 = m + d[(z0 + 1) * r + x0 + 1] * s;
    return (h00 + (h10 - h00) * tx) * (1 - tz) + (h01 + (h11 - h01) * tx) * tz;
  }
}

/* ------------------------------------------------------------------ *
 * Wind: one shared uniform block patched into every foliage material
 * ------------------------------------------------------------------ */
const windUniforms = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0, 0) },
  uWindStrength: { value: 1 },
};

const WIND_GAIN = {
  'tree': 1.0, 'tree-high': 1.2, 'plant': 1.5,
  'patch-grass': 1.1, 'flag': 2.4, 'tent': 0.22,
};

/** Displace foliage vertices, weighted by height above the instance origin. */
function applyWind(material, modelHeight, gain) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindDir = windUniforms.uWindDir;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.uniforms.uModelHeight = { value: Math.max(modelHeight, 0.001) };
    shader.uniforms.uGain = { value: gain };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        uniform float uTime;
        uniform vec2 uWindDir;
        uniform float uWindStrength;
        uniform float uModelHeight;
        uniform float uGain;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        // Per-instance phase so the canopy ripples instead of moving as one block.
        vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float phase = instOrigin.x * 0.021 + instOrigin.z * 0.017;
        float k = clamp(transformed.y / uModelHeight, 0.0, 1.0);
        k = k * k;                                    // trunk stays put, crown moves
        float gust = 0.72 + 0.45 * sin(uTime * 0.31 + phase * 0.4);
        float sway = sin(uTime * 1.35 + phase) * 0.62
                   + sin(uTime * 2.60 + phase * 1.7) * 0.26
                   + sin(uTime * 4.10 + phase * 2.9) * 0.12;
        transformed.xz += uWindDir * (sway * gust * uWindStrength * uGain * k * uModelHeight * 0.16);
      `);
  };
  material.customProgramCacheKey = () => 'wind-' + modelHeight.toFixed(3) + '-' + gain;
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.6, 5200);
const topCamera = new THREE.OrthographicCamera(-1050, 1050, 1050, -1050, 1, 6000);
topCamera.position.set(1000, 2600, 1000);
topCamera.lookAt(1000, 0, 1000);
topCamera.up.set(0, 0, 1);
topCamera.updateProjectionMatrix();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

main().catch((err) => {
  console.error(err);
  el('loading-msg').textContent = 'Falha ao carregar: ' + err.message +
    ' — sirva a pasta game/ por HTTP (python3 -m http.server).';
});

async function main() {
  progress(5, 'lendo a definição do mapa…');
  const [world, scatter] = await Promise.all([
    fetch(DATA + 'forest_map_2k.json').then((r) => r.json()),
    fetch(DATA + 'forest_map_2k.scatter.json').then((r) => r.json()),
  ]);

  progress(18, 'carregando o heightmap…');
  const hm = world.world.heightmap;
  const buf = await fetch('../' + hm.raw_file).then((r) => r.arrayBuffer());
  const field = new HeightField(buf, hm.resolution, world.world.size_m[0],
    world.world.height_range_m[0], world.world.height_range_m[1]);

  progress(30, 'construindo o terreno…');
  buildSky(world);
  buildLights(world);
  const terrain = await buildTerrain(world, field);
  scene.add(terrain);
  buildWater(world);

  progress(48, 'carregando os modelos Kenney…');
  const models = await loadModels(world, scatter);

  progress(72, 'instanciando a floresta…');
  const tiles = buildInstances(world, scatter, models);

  progress(94, 'preparando a interface…');
  const ui = setupUI(world, field, tiles);
  await setupMinimap(world);

  progress(100, 'pronto');
  const loading = el('loading');
  loading.style.opacity = '0';
  setTimeout(() => loading.remove(), 550);

  animate(world, field, tiles, ui);
}

/* ------------------------------------------------------------------ *
 * Sky, light, fog
 * ------------------------------------------------------------------ */
let sun, hemi, skyMat, skyDome;

function buildSky(world) {
  const fog = world.lighting.fog;
  scene.fog = new THREE.Fog(new THREE.Color(fog.color), fog.near, fog.far);
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#3f8ad6') },
      uMid: { value: new THREE.Color(fog.color) },
      uBottom: { value: new THREE.Color(fog.color) },
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 uTop, uMid, uBottom;
      void main(){
        float h = vDir.y * 0.5 + 0.5;
        vec3 c = mix(uBottom, uMid, smoothstep(0.40, 0.505, h));
        c = mix(c, uTop, smoothstep(0.505, 0.94, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(4200, 32, 20), skyMat);
  skyDome.frustumCulled = false;
  scene.add(skyDome);
}

function buildLights(world) {
  const L = world.lighting;
  hemi = new THREE.HemisphereLight(new THREE.Color(L.ambient_sky), new THREE.Color(L.ambient_ground), 0.85);
  scene.add(hemi);

  sun = new THREE.DirectionalLight(new THREE.Color(L.sun_color), 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -300; c.right = 300; c.top = 300; c.bottom = -300; c.near = 1; c.far = 1400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.35;
  scene.add(sun, sun.target);
}

/** Move sun + sky to a given hour so the map can be checked at any light. */
function setTimeOfDay(hour) {
  const t = THREE.MathUtils.clamp((hour - 5) / 16, 0, 1);      // 05:00 -> 21:00
  const elevation = Math.sin(t * Math.PI) * 74 + 2;
  const azimuth = 95 + t * 170;
  const e = THREE.MathUtils.degToRad(elevation);
  const a = THREE.MathUtils.degToRad(azimuth);
  sunDir.set(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));

  const day = THREE.MathUtils.smoothstep(elevation, 2, 26);
  const warm = new THREE.Color('#ffb066').lerp(new THREE.Color('#fff4dc'), day);
  sun.color.copy(warm);
  sun.intensity = 0.35 + 2.1 * day;
  hemi.intensity = 0.28 + 0.62 * day;

  const skyTop = new THREE.Color('#12294d').lerp(new THREE.Color('#3f8ad6'), day);
  const skyMid = new THREE.Color('#8d6d84').lerp(new THREE.Color('#c9e6f5'), day);
  const skyLow = new THREE.Color('#e0a06d').lerp(new THREE.Color('#d9ecf3'), day);
  skyMat.uniforms.uTop.value.copy(skyTop);
  skyMat.uniforms.uMid.value.copy(skyMid);
  skyMat.uniforms.uBottom.value.copy(skyLow);
  scene.fog.color.copy(skyMid);
  renderer.setClearColor(skyMid);
}
const sunDir = new THREE.Vector3();

/* ------------------------------------------------------------------ *
 * Terrain
 * ------------------------------------------------------------------ */
async function buildTerrain(world, field) {
  const SIZE = world.world.size_m[0];
  const N = 768;                                    // 768x768 quads over 2 km (2.6 m)
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + SIZE / 2;
    const z = pos.getZ(i) + SIZE / 2;
    pos.setX(i, x);
    pos.setZ(i, z);
    pos.setY(i, field.at(x, z));
  }
  geo.computeVertexNormals();

  const loader = new THREE.TextureLoader();
  const splat = await loader.loadAsync('../' + world.world.splatmap.file);
  splat.colorSpace = THREE.NoColorSpace;
  splat.wrapS = splat.wrapT = THREE.ClampToEdgeWrapping;

  const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0.0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSplat = { value: splat };
    shader.uniforms.uWorldSize = { value: SIZE };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vWorld;
        uniform sampler2D uSplat;
        uniform float uWorldSize;

        // Cheap value noise, used only to break up the four flat splat colours
        // so the ground keeps detail no matter how close the camera gets.
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                     mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }
        vec3 SRGB(vec3 c){ return pow(c, vec3(2.2)); }   // authored sRGB -> linear
        float fbm(vec2 p){
          float a = 0.5, s = 0.0;
          for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
          return s;
        }
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec2 suv = vWorld.xz / uWorldSize;
        vec4 sp = texture2D(uSplat, suv);
        float total = max(sp.r + sp.g + sp.b + sp.a, 0.0001);
        sp /= total;

        vec3 grass = SRGB(vec3(0.322, 0.560, 0.259));
        vec3 dirt  = SRGB(vec3(0.639, 0.502, 0.322));
        vec3 rock  = SRGB(vec3(0.478, 0.443, 0.573));
        vec3 moss  = SRGB(vec3(0.157, 0.325, 0.204));

        float nBig = fbm(vWorld.xz * 0.035);
        float nMid = fbm(vWorld.xz * 0.21);
        float nFine = fbm(vWorld.xz * 1.35);

        grass = mix(grass * 0.82, grass * 1.22, nMid);
        grass = mix(grass, SRGB(vec3(0.451, 0.639, 0.302)), nBig);
        moss  = mix(moss * 0.85, moss * 1.25, nMid);
        rock  = mix(rock * 0.86, rock * 1.18, nFine);
        dirt  = mix(dirt * 0.88, dirt * 1.14, nMid);

        vec3 ground = grass * sp.r + dirt * sp.g + rock * sp.b + moss * sp.a;
        ground *= 0.93 + 0.14 * nFine;
        diffuseColor.rgb *= ground;
      `);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/* ------------------------------------------------------------------ *
 * Water
 * ------------------------------------------------------------------ */
const waterUniforms = { uTime: { value: 0 } };

function waterMaterial(color, opacity) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), transparent: true, opacity,
    roughness: 0.16, metalness: 0.05,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vW;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        transformed.y += sin(vW.x * 0.09 + uTime * 1.4) * 0.16
                       + sin(vW.z * 0.13 - uTime * 1.9) * 0.12;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vW;')
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        // Ripple normals: two crossing wave trains, enough for a stylised sheen.
        float a = sin(vW.x * 0.55 + uTime * 2.1) * cos(vW.z * 0.41 - uTime * 1.6);
        float b = sin(vW.z * 0.73 - uTime * 1.3) * cos(vW.x * 0.62 + uTime * 1.1);
        normal = normalize(normal + vec3(a, 0.0, b) * 0.16);
      `);
  };
  return mat;
}

function buildWater(world) {
  const group = new THREE.Group();
  group.name = 'water';

  for (const river of world.rivers) {
    const pts = river.centerline;
    const w = river.half_width * 1.35;
    const positions = [];
    const indices = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const p = pts[Math.max(i - 1, 0)];
      const n = pts[Math.min(i + 1, pts.length - 1)];
      let dx = n[0] - p[0], dz = n[1] - p[1];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const t = i / (pts.length - 1);
      const f = t * (river.elevation.length - 1);
      const k = Math.min(Math.floor(f), river.elevation.length - 2);
      const y = river.elevation[k] + (river.elevation[k + 1] - river.elevation[k]) * (f - k);
      positions.push(x - dz * w, y, z + dx * w, x + dz * w, y, z - dx * w);
      if (i < pts.length - 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, waterMaterial('#4aa3d8', 0.82));
    mesh.name = river.id;
    group.add(mesh);
  }

  for (const lake of world.lakes) {
    // Shoreline comes from the generator so water and carved bowl agree.
    // Author the outline as (x, -z) so rotating -90 deg about X lands it at the
    // right world position *and* leaves the face normal pointing up.
    const shape = new THREE.Shape();
    lake.outline.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape, 12);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, waterMaterial('#3f95cf', 0.88));
    mesh.position.y = lake.level;
    mesh.name = lake.id;
    group.add(mesh);
  }

  scene.add(group);
}

/* ------------------------------------------------------------------ *
 * Models
 * ------------------------------------------------------------------ */
async function loadModels(world, scatter) {
  const names = new Map();
  for (const s of world.structures) names.set(s.model, s.group);
  for (const l of scatter.layers) names.set(l.model, l.group);

  const loader = new GLTFLoader();
  const out = new Map();
  const list = [...names.entries()];
  let done = 0;
  await Promise.all(list.map(async ([model, group]) => {
    const gltf = await loader.loadAsync(`${ASSETS}models/${group}/${model}.glb`);
    const geoms = [];
    let material = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      for (const attr of Object.keys(g.attributes)) {
        if (!['position', 'normal', 'uv'].includes(attr)) g.deleteAttribute(attr);
      }
      geoms.push(g);
      material = material || o.material;
    });
    const geometry = geoms.length > 1 ? BufferGeometryUtils.mergeGeometries(geoms, false) : geoms[0];
    geometry.computeBoundingBox();
    out.set(model, { geometry, material, height: geometry.boundingBox.max.y });
    progress(48 + Math.round((++done / list.length) * 22));
  }));
  return out;
}

/* ------------------------------------------------------------------ *
 * Instancing
 * ------------------------------------------------------------------ */
/**
 * One InstancedMesh per (model, 250 m tile). Splitting by tile gives every
 * mesh a tight bounding sphere, so frustum culling and the draw-distance
 * slider both work on a map this size.
 */
function buildInstances(world, scatter, models) {
  const buckets = new Map();     // "model|tx|tz" -> array of {x,y,z,ry,scale}
  const push = (model, x, y, z, ry, scale) => {
    const key = `${model}|${Math.floor(x / TILE)}|${Math.floor(z / TILE)}`;
    let arr = buckets.get(key);
    if (!arr) buckets.set(key, arr = []);
    arr.push([x, y, z, ry, scale]);
  };

  for (const s of world.structures) {
    push(s.model, s.pos[0], s.pos[1], s.pos[2], s.ry, s.scale);
  }
  for (const layer of scatter.layers) {
    const d = layer.data;
    for (let i = 0; i < d.length; i += layer.stride) {
      push(layer.model, d[i], d[i + 1], d[i + 2], d[i + 3], d[i + 4]);
    }
  }

  const windModels = new Set();
  for (const s of world.structures) if (s.wind) windModels.add(s.model);
  for (const l of scatter.layers) if (l.wind) windModels.add(l.model);

  const materials = new Map();
  const tiles = [];
  const dummy = new THREE.Object3D();
  let total = 0;

  for (const [key, arr] of buckets) {
    const model = key.split('|')[0];
    const src = models.get(model);
    if (!src) continue;

    let mat = materials.get(model);
    if (!mat) {
      mat = src.material.clone();
      mat.side = THREE.DoubleSide;   // kit foliage is single-sided card-ish geometry
      if (windModels.has(model)) applyWind(mat, src.height, WIND_GAIN[model] ?? 1.0);
      materials.set(model, mat);
    }

    const mesh = new THREE.InstancedMesh(src.geometry, mat, arr.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    let cx = 0, cz = 0;
    for (let i = 0; i < arr.length; i++) {
      const [x, y, z, ry, scale] = arr[i];
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, THREE.MathUtils.degToRad(ry), 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      cx += x; cz += z;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.userData.center = new THREE.Vector2(cx / arr.length, cz / arr.length);
    scene.add(mesh);
    tiles.push(mesh);
    total += arr.length;
  }

  el('inst').textContent = total.toLocaleString('pt-BR');
  return tiles;
}

/* ------------------------------------------------------------------ *
 * UI, controls, labels
 * ------------------------------------------------------------------ */
function setupUI(world, field, tiles) {
  const state = {
    mode: 'fly',
    drawDistance: 1200,
    labels: true,
    velocity: new THREE.Vector3(),
    keys: new Set(),
    yaw: -2.3,
    pitch: -0.18,
    world, field,
  };

  const hub = world.landmarks.find((l) => l.id === 'H1') || world.landmarks[0];
  camera.position.set(hub.x - 210, hub.y + 130, hub.z - 210);

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI * 0.495;
  orbit.target.set(hub.x, hub.y + 20, hub.z);
  orbit.enabled = false;
  state.orbit = orbit;

  // -- landmark jump list
  const sel = el('goto');
  const zones = { A: 'A · Vale das Tendas', B: 'B · Planalto das Torres', C: 'C · Mata Antiga', D: 'D · Campos de Treino', H: 'Centro' };
  for (const zid of ['H', 'A', 'B', 'C', 'D']) {
    const group = document.createElement('optgroup');
    group.label = zones[zid];
    for (const lm of world.landmarks.filter((l) => l.zone === zid)) {
      const opt = document.createElement('option');
      opt.value = lm.id;
      opt.textContent = `${lm.id} — ${lm.name} (${lm.x}, ${lm.z})`;
      group.appendChild(opt);
    }
    sel.appendChild(group);
  }
  sel.addEventListener('change', () => {
    const lm = world.landmarks.find((l) => l.id === sel.value);
    if (!lm) return;
    camera.position.set(lm.x - 120, lm.y + 78, lm.z - 120);
    orbit.target.set(lm.x, lm.y + 14, lm.z);
    state.yaw = Math.atan2(lm.x - camera.position.x, lm.z - camera.position.z);
    state.pitch = -0.35;
  });

  // -- sliders
  el('wind').addEventListener('input', (e) => {
    windUniforms.uWindStrength.value = +e.target.value;
    el('wind-val').textContent = (+e.target.value).toFixed(2);
  });
  el('time').addEventListener('input', (e) => {
    const h = +e.target.value;
    setTimeOfDay(h);
    const m = Math.round((h % 1) * 60);
    el('time-val').textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
  el('dist').addEventListener('input', (e) => {
    state.drawDistance = +e.target.value;
    el('dist-val').textContent = state.drawDistance + ' m';
    scene.fog.far = Math.min(state.drawDistance * 1.5, 3400);
    scene.fog.near = scene.fog.far * 0.22;
  });

  // -- camera modes
  const buttons = { fly: el('m-fly'), orbit: el('m-orbit'), top: el('m-top') };
  const setMode = (mode) => {
    state.mode = mode;
    for (const [k, b] of Object.entries(buttons)) b.classList.toggle('on', k === mode);
    orbit.enabled = mode === 'orbit';
    if (mode === 'orbit') {
      orbit.target.set(camera.position.x + Math.sin(state.yaw) * 60, camera.position.y - 20,
        camera.position.z + Math.cos(state.yaw) * 60);
      document.exitPointerLock?.();
    }
  };
  for (const [k, b] of Object.entries(buttons)) b.addEventListener('click', () => setMode(k));

  el('t-labels').addEventListener('click', (e) => {
    state.labels = !state.labels;
    e.target.textContent = state.labels ? 'Ocultar rótulos' : 'Mostrar rótulos';
    el('labels').style.display = state.labels ? '' : 'none';
  });

  // -- fly controls
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    state.keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => state.keys.delete(e.code));
  renderer.domElement.addEventListener('click', () => {
    if (state.mode === 'fly') renderer.domElement.requestPointerLock();
  });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    state.yaw -= e.movementX * 0.0022;
    state.pitch = THREE.MathUtils.clamp(state.pitch - e.movementY * 0.0022, -1.45, 1.45);
  });

  // -- landmark labels
  state.labelNodes = world.landmarks.map((lm) => {
    const node = document.createElement('div');
    node.className = 'lab' + (lm.kind === 'hub' ? ' hub' : '');
    node.textContent = `${lm.id} · ${lm.name}`;
    el('labels').appendChild(node);
    return { lm, node, pos: new THREE.Vector3(lm.x, lm.y + 26, lm.z) };
  });

  setTimeOfDay(14);
  setMode('fly');
  return state;
}

async function setupMinimap(world) {
  const canvas = el('mini');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = '../' + world.world.minimap.file;
  await img.decode();
  minimapState = { ctx, img, world, size: canvas.width };
}
let minimapState = null;

function drawMinimap(camera) {
  if (!minimapState) return;
  const { ctx, img, world, size } = minimapState;
  ctx.drawImage(img, 0, 0, size, size);
  const S = world.world.size_m[0];
  const toPx = (x, z) => [x / S * size, size - (z / S * size)];

  ctx.fillStyle = 'rgba(12,20,16,.75)';
  for (const lm of world.landmarks) {
    const [px, py] = toPx(lm.x, lm.z);
    ctx.beginPath(); ctx.arc(px, py, 5, 0, 6.283); ctx.fill();
  }
  ctx.fillStyle = '#eaf5ec';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const lm of world.landmarks) {
    const [px, py] = toPx(lm.x, lm.z);
    ctx.fillText(lm.id, px, py + 0.5);
  }

  const [cx, cy] = toPx(camera.position.x, camera.position.z);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(dir.x, -dir.z));
  ctx.fillStyle = '#ff5a4d';
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Frame loop
 * ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let fpsAcc = 0, fpsFrames = 0, miniAcc = 0;

function animate(world, field, tiles, state) {
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    windUniforms.uTime.value = t;
    waterUniforms.uTime.value = t;
    const wdir = THREE.MathUtils.degToRad(world.wind.direction_deg);
    windUniforms.uWindDir.value.set(Math.sin(wdir), Math.cos(wdir));

    if (state.mode === 'fly') moveFly(state, dt, field);
    else if (state.mode === 'orbit') state.orbit.update();

    const cam = state.mode === 'top' ? topCamera : camera;
    skyDome.position.copy(cam.position);

    // Keep the shadow frustum around the viewer instead of the whole 2 km.
    const focus = state.mode === 'top' ? new THREE.Vector3(1000, 0, 1000) : cam.position;
    sun.target.position.set(focus.x, field.at(
      THREE.MathUtils.clamp(focus.x, 0, 2000), THREE.MathUtils.clamp(focus.z, 0, 2000)), focus.z);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 620);
    sun.target.updateMatrixWorld();

    // Draw-distance culling per instancing tile.
    const d2 = state.drawDistance * state.drawDistance;
    for (const tile of tiles) {
      const c = tile.userData.center;
      const dx = c.x - focus.x, dz = c.y - focus.z;
      tile.visible = state.mode === 'top' || dx * dx + dz * dz < d2;
    }

    updateLabels(state, cam);
    renderer.render(scene, cam);

    fpsAcc += dt; fpsFrames++; miniAcc += dt;
    if (fpsAcc > 0.5) {
      el('fps').textContent = Math.round(fpsFrames / fpsAcc);
      fpsAcc = 0; fpsFrames = 0;
    }
    if (miniAcc > 0.1) { drawMinimap(cam); miniAcc = 0; }

    const x = camera.position.x, z = camera.position.z;
    el('pos').textContent = `${Math.round(x)}, ${Math.round(z)}`;
    el('alt').textContent = `${Math.round(camera.position.y)} m`;
    el('zone').textContent = zoneLabel(world, x, z);
  });
}

function moveFly(state, dt, field) {
  const speed = (state.keys.has('ShiftLeft') || state.keys.has('ShiftRight') ? 220 : 70) * dt;
  const fwd = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  const move = new THREE.Vector3();
  if (state.keys.has('KeyW')) move.add(fwd);
  if (state.keys.has('KeyS')) move.sub(fwd);
  if (state.keys.has('KeyD')) move.add(right);
  if (state.keys.has('KeyA')) move.sub(right);
  if (state.keys.has('KeyE') || state.keys.has('Space')) move.y += 1;
  if (state.keys.has('KeyQ')) move.y -= 1;
  if (move.lengthSq() > 0) camera.position.addScaledVector(move.normalize(), speed);

  const gx = THREE.MathUtils.clamp(camera.position.x, 0, 2000);
  const gz = THREE.MathUtils.clamp(camera.position.z, 0, 2000);
  camera.position.y = Math.max(camera.position.y, field.at(gx, gz) + 2.4);

  camera.rotation.set(0, 0, 0);
  camera.rotateY(state.yaw + Math.PI);
  camera.rotateX(state.pitch);
}

const projected = new THREE.Vector3();
function updateLabels(state, cam) {
  if (!state.labels) return;
  for (const { node, pos } of state.labelNodes) {
    projected.copy(pos).project(cam);
    const dist = cam.position.distanceTo(pos);
    const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
    if (!onScreen || dist > state.drawDistance * 1.4) { node.style.display = 'none'; continue; }
    node.style.display = '';
    node.style.left = ((projected.x * 0.5 + 0.5) * innerWidth) + 'px';
    node.style.top = ((-projected.y * 0.5 + 0.5) * innerHeight) + 'px';
    node.style.opacity = String(THREE.MathUtils.clamp(1.25 - dist / (state.drawDistance * 1.2), 0.15, 1));
  }
}

function zoneLabel(world, x, z) {
  const id = z >= 1000 ? (x >= 1000 ? 'B' : 'A') : (x >= 1000 ? 'D' : 'C');
  const zone = world.zones.find((zz) => zz.id === id);
  return `${id} · ${zone ? zone.name : '—'}`;
}
