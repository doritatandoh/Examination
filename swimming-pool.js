/**
 * swimming-pool.js
 * Professional In-Ground Swimming Pool Component for A-Frame
 * Handles all animations, water shaders, and environmental details
 * via Three.js integration
 */

// Expose THREE globally from A-Frame
const THREE = AFRAME.THREE;

// ─────────────────────────────────────────────
//  WATER SHADER MATERIAL
// ─────────────────────────────────────────────
const WaterShader = {
  uniforms: {
    time:        { value: 0.0 },
    tileColor:   { value: new THREE.Color(0x4dd0e0) },
    deepColor:   { value: new THREE.Color(0x66ccdd) },
    shallowColor:{ value: new THREE.Color(0x99eeff) },
    sunDirection:{ value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() },
    opacity:     { value: 0.88 },
  },
  vertexShader: `
    uniform float time;
    varying vec2  vUv;
    varying float vWave;
    varying vec3  vNormal;
    varying vec3  vPosition;

    float wave(vec2 uv, float speed, float freq, float amp) {
      return sin(uv.x * freq + time * speed) *
             cos(uv.y * freq * 0.8 + time * speed * 0.9) * amp;
    }

    void main() {
      vUv = uv;
      vec3 pos = position;

      float w  = wave(uv, 1.2, 6.0,  0.018)
               + wave(uv, 0.8, 10.0, 0.010)
               + wave(uv, 1.6, 4.0,  0.012)
               + wave(uv, 0.5, 15.0, 0.005);

      pos.y   += w;
      vWave    = w;
      vNormal  = normal;
      vPosition = pos;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3  tileColor;
    uniform vec3  deepColor;
    uniform vec3  shallowColor;
    uniform vec3  sunDirection;
    uniform float opacity;
    varying vec2  vUv;
    varying float vWave;
    varying vec3  vNormal;
    varying vec3  vPosition;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      // Caustic-like ripple pattern
      float ripple = sin(vUv.x * 40.0 + time * 2.0) *
                     sin(vUv.y * 40.0 + time * 1.7) * 0.5 + 0.5;
      ripple      *= sin(vUv.x * 25.0 - time * 1.3) *
                     cos(vUv.y * 25.0 + time * 1.1) * 0.5 + 0.5;

      // Pool tile grid visible through water
      vec2  tile   = fract(vUv * 12.0);
      float grout  = step(0.92, tile.x) + step(0.92, tile.y);
      vec3  tileC  = mix(tileColor, tileColor * 0.75, grout);

      // Depth gradient
      float depth  = smoothstep(-0.02, 0.02, vWave);
      vec3  waterC = mix(deepColor, shallowColor, depth);

      // Caustics overlay
      vec3  caustic = vec3(ripple * 0.25);

      // Specular highlight
      vec3  viewDir = normalize(vec3(0.0, 1.0, 0.3));
      float spec    = pow(max(dot(reflect(-sunDirection, vNormal), viewDir), 0.0), 64.0);

      // Blend tile + water + caustics + spec
      vec3  col = mix(tileC * 0.35, waterC, 0.72)
                + caustic * 0.18
                + vec3(spec * 0.9);

      gl_FragColor = vec4(col, opacity - depth * 0.08);
    }
  `
};


// ─────────────────────────────────────────────
//  LOUNGE CHAIR — photo style: flat slatted, pale fabric
// ─────────────────────────────────────────────
function buildLoungeChair(){
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({color: 0xc8c0b0, roughness: 0.5, metalness: 0.5});
  const cushMat  = new THREE.MeshStandardMaterial({color: 0xf2ede0, roughness: 0.85});

  // Scale factor to match house model (3x)
  const scale = 3;

  // Bed frame
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.62 * scale, 0.04 * scale, 1.9 * scale), frameMat);
  bed.position.set(0, 0.19 * scale, 0);
  g.add(bed);

  // 5 cushion slats
  for(let i = 0; i < 5; i++){
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.56 * scale, 0.065 * scale, 0.3 * scale), cushMat);
    slat.position.set(0, 0.235 * scale, (-0.74 + i * 0.37) * scale);
    g.add(slat);
  }

  // Head section raised
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.58 * scale, 0.065 * scale, 0.36 * scale), cushMat);
  head.position.set(0, 0.27 * scale, -0.76 * scale);
  head.rotation.x = -0.42;
  g.add(head);

  // Side rails
  [-0.31, 0.31].forEach(x => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025 * scale, 0.03 * scale, 1.92 * scale), frameMat);
    rail.position.set(x * scale, 0.22 * scale, 0);
    g.add(rail);
  });

  // 4 legs
  [[0.27, 0.86], [0.27, -0.86], [-0.27, 0.86], [-0.27, -0.86]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.013 * scale, 0.013 * scale, 0.22 * scale, 6), frameMat);
    leg.position.set(x * scale, 0.11 * scale, z * scale);
    g.add(leg);
  });

  // Foot crossbar
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * scale, 0.011 * scale, 0.62 * scale, 6), frameMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.11 * scale, 0.87 * scale);
  g.add(bar);

  g.castShadow = true;
  g.receiveShadow = true;
  return g;
}


// ─────────────────────────────────────────────
//  HELPER: pool light ring glow (sprite)
// ─────────────────────────────────────────────
function buildPoolLight(color = 0x00aaff) {
  const geo = new THREE.SphereGeometry(0.07, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const m   = new THREE.Mesh(geo, mat);
  m.userData.isPoolLight = true;
  return m;
}


// ─────────────────────────────────────────────
//  MAIN A-FRAME COMPONENT
// ─────────────────────────────────────────────
AFRAME.registerComponent('swimming-pool', {

  schema: {
    width:        { type: 'number',  default: 6.0  },
    length:       { type: 'number',  default: 12.0 },
    depth:        { type: 'number',  default: 1.5  },
    chairCount:   { type: 'number',  default: 5    },
    waterOpacity: { type: 'number',  default: 0.88 },
    glowColor:    { type: 'color',   default: '#00aaff' },
  },

  init() {
    this.clock        = new THREE.Clock();
    this.waterMat     = null;
    this.poolLights   = [];
    this._buildPool();
  },

  _buildPool() {
    const { width: W, length: L, depth: D, waterOpacity } = this.data;
    const scene = this.el.sceneEl.object3D;
    const root  = this.el.object3D;

    // ── POOL SHELL ────────────────────────────────────────────────
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x5bb8d4, roughness: 0.3, metalness: 0.1
    });

    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, L), shellMat);
    floor.position.y = -D;
    floor.receiveShadow = true;
    root.add(floor);

    // ── WALLS REMOVED ────────────────────────────────────────────
    // The four thin wall panels that created the white deck rim
    // have been removed. The pool now sits flush with the ground plane.

    // Pool steps (one corner)
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x7ecfe0, roughness: 0.4 });
    [0, 1, 2].forEach(i => {
      const sw = W * 0.28;
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(sw, 0.12, 0.36), stepMat
      );
      step.position.set(
        -W/2 + sw/2,
        -(D - 0.12 * (3 - i)),
         L/2 - 0.18 - i * 0.36
      );
      root.add(step);
    });

    // ── WATER SURFACE ─────────────────────────────────────────────
    const waterGeo = new THREE.PlaneGeometry(W, L, 80, 80);
    this.waterMat  = new THREE.ShaderMaterial({
      uniforms:       THREE.UniformsUtils.clone(WaterShader.uniforms),
      vertexShader:   WaterShader.vertexShader,
      fragmentShader: WaterShader.fragmentShader,
      transparent:    true,
      side:           THREE.DoubleSide,
    });
    this.waterMat.uniforms.opacity.value = waterOpacity;
    const water = new THREE.Mesh(waterGeo, this.waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.05;
    root.add(water);

    // ── POOL LIGHTS (underwater glow) ────────────────────────────
    const lightColors = [0x00ccff, 0x00aaee, 0x44ddff];
    const lightPositions = [
      [ W/2 - 0.22,  -D + 0.15,  L/4 ],
      [-W/2 + 0.22,  -D + 0.15,  L/4 ],
      [ W/2 - 0.22,  -D + 0.15, -L/4 ],
      [-W/2 + 0.22,  -D + 0.15, -L/4 ],
    ];
    lightPositions.forEach((pos, i) => {
      const light = buildPoolLight(lightColors[i % lightColors.length]);
      light.position.set(...pos);
      this.poolLights.push(light);
      root.add(light);

      // Actual point light for scene illumination
      const ptLight = new THREE.PointLight(lightColors[i % 3], 0.6, 4.0);
      ptLight.position.set(...pos);
      root.add(ptLight);
    });

    // ── AMBIENT + SUN LIGHT ───────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xfff8ee, 0.5);
    root.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5cc, 1.4);
    sun.position.set(8, 14, 6);
    sun.castShadow            = true;
    sun.shadow.mapSize.width  = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near    = 0.5;
    sun.shadow.camera.far     = 50;
    sun.shadow.camera.left    = -12;
    sun.shadow.camera.right   =  12;
    sun.shadow.camera.top     =  12;
    sun.shadow.camera.bottom  = -12;
    root.add(sun);
  },

  tick(time, delta) {
    const t = time / 1000;

    // Animate water
    if (this.waterMat) {
      this.waterMat.uniforms.time.value = t;
    }

    // Pulse pool lights
    this.poolLights.forEach((light, i) => {
      const pulse = 0.75 + 0.25 * Math.sin(t * 1.8 + i * 1.1);
      if (light.material) light.material.opacity = pulse * 0.85;
    });
  },

  remove() {
    this.el.object3D.clear();
  }
});


// ─────────────────────────────────────────────
//  RIPPLE / SPLASH PARTICLE SYSTEM
// ─────────────────────────────────────────────
AFRAME.registerComponent('pool-ripples', {
  schema: {
    poolWidth:  { type: 'number', default: 6.0  },
    poolLength: { type: 'number', default: 12.0 },
    count:      { type: 'number', default: 18   },
  },

  init() {
    this.ripples = [];
    this.clock   = new THREE.Clock();
    this._initRipples();
  },

  _initRipples() {
    const { poolWidth: W, poolLength: L, count } = this.data;
    const root = this.el.object3D;

    for (let i = 0; i < count; i++) {
      const geo = new THREE.RingGeometry(0.0, 0.01, 24);
      const mat = new THREE.MeshBasicMaterial({
        color:       0xaaddff,
        transparent: true,
        opacity:     0.0,
        side:        THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(
        (Math.random() - 0.5) * (W - 0.5),
        0.01,
        (Math.random() - 0.5) * (L - 0.5)
      );
      ring.userData = {
        maxR:    0.25 + Math.random() * 0.35,
        speed:   0.4  + Math.random() * 0.5,
        delay:   Math.random() * 5.0,
        phase:   Math.random() * Math.PI * 2,
        elapsed: Math.random() * 6.0,
      };
      this.ripples.push(ring);
      root.add(ring);
    }
  },

  tick(time) {
    const t = time / 1000;
    this.ripples.forEach(ring => {
      const d = ring.userData;
      d.elapsed += 0.016;
      const cycle  = (d.elapsed % (d.maxR / d.speed + 1.2));
      const r      = Math.min(cycle * d.speed, d.maxR);
      const fade   = 1.0 - (r / d.maxR);
      ring.scale.setScalar(r / 0.01 || 0.01);
      ring.material.opacity = fade * 0.55;
      if (cycle > d.maxR / d.speed + 0.8) {
        d.elapsed = 0;
        ring.position.set(
          (Math.random() - 0.5) * (this.data.poolWidth  - 0.5),
          0.01,
          (Math.random() - 0.5) * (this.data.poolLength - 0.5)
        );
      }
    });
  }
});


// ─────────────────────────────────────────────
//  SWIMMING LANE LINES (optional visual detail)
// ─────────────────────────────────────────────
AFRAME.registerComponent('pool-lane-lines', {
  schema: {
    poolWidth:  { type: 'number', default: 6.0  },
    poolLength: { type: 'number', default: 12.0 },
    depth:      { type: 'number', default: 1.5  },
    lanes:      { type: 'number', default: 3    },
  },

  init() {
    const { poolWidth: W, poolLength: L, depth: D, lanes } = this.data;
    const root   = this.el.object3D;
    const colors = [0x1a7fc4, 0xf5c518, 0x1a7fc4];

    for (let i = 0; i < lanes - 1; i++) {
      const x   = -W/2 + (W / lanes) * (i + 1);
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
      const geo = new THREE.BoxGeometry(0.06, 0.04, L - 0.2);
      const line= new THREE.Mesh(geo, mat);
      line.position.set(x, -D + 0.06, 0);
      root.add(line);
    }
  }
}); 