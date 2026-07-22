import * as THREE from 'three';

export class ThreeScene {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    // Viewport Size
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Scene & Camera
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 8);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // State Tracking
    this.scrollPercent = 0;
    this.targetScrollPercent = 0;
    this.mouse = { x: 0, y: 0 };
    this.targetMouse = { x: 0, y: 0 };
    this.activeDishIndex = 0;
    this.dishColors = [
      new THREE.Color(0xffaa44), // 0: Paneer (Saffron / Saffron Gold)
      new THREE.Color(0x7c4dff), // 1: Galouti (Infused Truffle Smoke / Violet)
      new THREE.Color(0x33ff99), // 2: Samosa Tart (Mint / Emerald)
      new THREE.Color(0xff4081)  // 3: Rabri (Rose Spherification / Magenta-Pink)
    ];

    // Initialize elements
    this.initLights();
    this.createKatoriBowl();
    this.createSpiceParticles();
    
    // Bind Event Listeners
    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));

    // Start Loop
    this.clock = new THREE.Clock();
    this.animate();
  }

  initLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional (Key) Light - mimicking studio gold highlight
    this.dirLight = new THREE.DirectionalLight(0xfff3d1, 3.5);
    this.dirLight.position.set(5, 5, 4);
    this.scene.add(this.dirLight);

    // Dynamic Color Spotlights (Gen Z Vibe)
    // Saffron Spot
    this.spotLightSaffron = new THREE.SpotLight(0xff9933, 15, 12, Math.PI / 4, 0.5, 1);
    this.spotLightSaffron.position.set(-4, 2, 3);
    this.scene.add(this.spotLightSaffron);

    // Emerald/Mint Spot
    this.spotLightTeal = new THREE.SpotLight(0x33ffaa, 8, 12, Math.PI / 4, 0.5, 1);
    this.spotLightTeal.position.set(4, -3, 3);
    this.scene.add(this.spotLightTeal);

    // Subtle blue fill light from below
    const pointLightFill = new THREE.PointLight(0x0066ff, 2, 10);
    pointLightFill.position.set(0, -4, 0);
    this.scene.add(pointLightFill);
  }

  createKatoriBowl() {
    // 1. Procedural Brass Bowl (Katori)
    // Create points for a double-sided bowl profile (with thickness)
    const points = [];
    const segments = 15;
    const radius = 2.0;
    const depth = 1.3;
    const thickness = 0.05;

    // Outer curve: base to rim
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 0.45; // slightly less than 90 deg for flared shape
      const x = Math.sin(angle) * radius;
      const y = (1.0 - Math.cos(angle)) * depth;
      points.push(new THREE.Vector2(x, y));
    }
    
    // Rim flat bridge
    const lastOuterX = points[points.length - 1].x;
    const lastOuterY = points[points.length - 1].y;
    points.push(new THREE.Vector2(lastOuterX - thickness * 0.4, lastOuterY + thickness * 0.6));

    // Inner curve: rim down to base
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const angle = t * Math.PI * 0.45;
      const x = Math.sin(angle) * (radius - thickness);
      const y = (1.0 - Math.cos(angle)) * (depth - thickness) + thickness;
      points.push(new THREE.Vector2(x, y));
    }

    const bowlGeometry = new THREE.LatheGeometry(points, 64);
    
    // Metallic Brass/Gold Material
    this.bowlMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.95,
      roughness: 0.15,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
      flatShading: false
    });

    this.bowl = new THREE.Mesh(bowlGeometry, this.bowlMaterial);
    
    // Anchor bowl at its center of gravity
    this.bowl.position.set(0, -depth / 2, 0);

    // Group to coordinate bowl & elephant rotation
    this.bowlGroup = new THREE.Group();
    this.bowlGroup.add(this.bowl);

    // 2. Stylized 3D Gold Elephant (floating centerpiece)
    const elephantShape = new THREE.Shape();
    
    // Scale shape coordinates to fit in the bowl (approx 1 unit wide/high)
    elephantShape.moveTo(-0.4, -0.3);
    elephantShape.lineTo(-0.25, -0.3);
    elephantShape.lineTo(-0.25, 0.0);
    elephantShape.lineTo(0.1, -0.3);
    elephantShape.lineTo(0.25, -0.3);
    elephantShape.lineTo(0.2, 0.1);
    
    // Trunk curve
    elephantShape.bezierCurveTo(0.35, 0.05, 0.45, 0.35, 0.35, 0.45);
    elephantShape.bezierCurveTo(0.25, 0.55, 0.2, 0.35, 0.3, 0.25);
    elephantShape.lineTo(0.18, 0.18);
    
    // Head & back
    elephantShape.bezierCurveTo(0.1, 0.35, -0.05, 0.4, -0.2, 0.4);
    elephantShape.bezierCurveTo(-0.45, 0.4, -0.55, 0.2, -0.5, 0.0);
    elephantShape.lineTo(-0.4, -0.3);

    // Extrude Options
    const extrudeSettings = {
      depth: 0.15,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02
    };

    const elephantGeometry = new THREE.ExtrudeGeometry(elephantShape, extrudeSettings);
    // Center geometry
    elephantGeometry.center();

    // High metal gold/copper material for elephant
    this.elephantMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe082,
      metalness: 0.98,
      roughness: 0.1,
      bumpScale: 0.05
    });

    this.elephant = new THREE.Mesh(elephantGeometry, this.elephantMaterial);
    
    // Elevate elephant slightly inside the bowl
    this.elephant.position.set(0, 0.3, 0);
    this.bowlGroup.add(this.elephant);

    // Add everything to scene
    this.scene.add(this.bowlGroup);

    // Set Initial Position targets (scaled for Hero section on desktop)
    this.bowlGroup.scale.set(1.1, 1.1, 1.1);
  }

  createSpiceParticles() {
    const particleCount = 400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    this.particleData = [];

    // Spice Color Palette
    const palette = [
      new THREE.Color(0xff9933), // Saffron (Orange)
      new THREE.Color(0x4f7942), // Cardamom (Green)
      new THREE.Color(0xd4af37), // Gold Dust
      new THREE.Color(0xdc143c)  // Chili (Red)
    ];

    for (let i = 0; i < particleCount; i++) {
      // Cylindrical distribution around center
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.0 + Math.random() * 4.0;
      const x = Math.sin(angle) * radius;
      const y = (Math.random() - 0.5) * 8.0;
      const z = Math.cos(angle) * radius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Assign random spice color
      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.05 + Math.random() * 0.15;

      // Save custom animation attributes
      this.particleData.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        angle: angle,
        radius: radius,
        speed: 0.2 + Math.random() * 0.5,
        wobbleSpeed: 0.5 + Math.random() * 1.5,
        wobbleAmp: 0.1 + Math.random() * 0.3,
        yOffset: y
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle Shading & Texture (using standard canvas particle)
    const particleTexture = this.generateParticleTexture();

    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.15,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, this.particleMaterial);
    this.scene.add(this.particles);
  }

  generateParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  setScrollPercent(percent) {
    this.targetScrollPercent = percent;
  }

  setMousePosition(x, y) {
    this.targetMouse.x = x;
    this.targetMouse.y = y;
  }

  setDishIndex(index) {
    this.activeDishIndex = index;
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  onMouseMove(e) {
    // Map mouse to -1 to +1 range
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.setMousePosition(x, y);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const time = this.clock.getElapsedTime();
    const delta = this.clock.getDelta();

    // Lerp values for smooth movement (scroll & mouse)
    this.scrollPercent += (this.targetScrollPercent - this.scrollPercent) * 0.08;
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;

    // Apply scroll-based transformations to bowl & lights
    this.update3DLayout();

    // Rotate Bowl centerpiece
    this.bowlGroup.rotation.y = time * 0.15 + (this.mouse.x * 0.25); // reacts slightly to mouse
    this.bowlGroup.rotation.x = (this.scrollPercent * Math.PI * 0.5) + (this.mouse.y * 0.2); // rotates up on scroll + mouse tilt

    // Rotate internal elephant separately for kinetic effect
    this.elephant.rotation.y = time * 0.4;
    this.elephant.position.y = 0.25 + Math.sin(time * 1.5) * 0.06; // float up and down

    // Update floating spice particles
    const posAttr = this.particles.geometry.attributes.position;
    const particlePositions = posAttr.array;

    for (let i = 0; i < this.particleData.length; i++) {
      const data = this.particleData[i];
      
      // Update rotation
      data.angle += data.speed * 0.008;
      
      // Drift upwards
      data.yOffset += data.speed * 0.01;
      if (data.yOffset > 4.5) data.yOffset = -4.5; // Loop position
      
      const wobble = Math.sin(time * data.wobbleSpeed) * data.wobbleAmp;

      // Apply coordinates (spinning swirl)
      particlePositions[i * 3] = Math.sin(data.angle) * data.radius + wobble + (this.mouse.x * 0.5);
      particlePositions[i * 3 + 1] = data.yOffset + (this.mouse.y * 0.3);
      particlePositions[i * 3 + 2] = Math.cos(data.angle) * data.radius + wobble;
    }
    posAttr.needsUpdate = true;

    // Dynamic coloring of spotlights depending on active dish index
    const targetColor = this.dishColors[this.activeDishIndex];
    this.spotLightSaffron.color.lerp(targetColor, 0.05);

    this.renderer.render(this.scene, this.camera);
  }

  update3DLayout() {
    // Translate the 3D model and camera based on scroll percentage to adapt to sections
    // Layout ranges:
    // Hero: 0.0 - 0.2
    // About: 0.2 - 0.45
    // Specialties: 0.45 - 0.7
    // Experience: 0.7 - 0.85
    // Reserve: 0.85 - 1.0

    const isMobile = this.width < 1024;

    if (this.scrollPercent <= 0.2) {
      // --- HERO ---
      const t = this.scrollPercent / 0.2;
      
      if (isMobile) {
        this.bowlGroup.position.x = 0;
        this.bowlGroup.position.y = -0.5 - t * 0.5;
        this.bowlGroup.scale.set(0.7, 0.7, 0.7);
      } else {
        // Slide rightward as we scroll out of Hero
        this.bowlGroup.position.x = THREE.MathUtils.lerp(1.3, 2.2, t);
        this.bowlGroup.position.y = THREE.MathUtils.lerp(-0.3, 0.2, t);
        this.bowlGroup.scale.set(1.15, 1.15, 1.15);
      }
      this.camera.position.z = 8;

    } else if (this.scrollPercent > 0.2 && this.scrollPercent <= 0.45) {
      // --- ABOUT ---
      const t = (this.scrollPercent - 0.2) / 0.25;
      
      if (isMobile) {
        this.bowlGroup.position.x = 0;
        this.bowlGroup.position.y = -1.0 + t * 0.2;
        this.bowlGroup.scale.set(0.65, 0.65, 0.65);
      } else {
        // Move to the right, scale slightly down to frame inside about grid right side card
        this.bowlGroup.position.x = THREE.MathUtils.lerp(2.2, 2.6, t);
        this.bowlGroup.position.y = THREE.MathUtils.lerp(0.2, -0.4, t);
        this.bowlGroup.scale.set(THREE.MathUtils.lerp(1.15, 1.0, t), THREE.MathUtils.lerp(1.15, 1.0, t), THREE.MathUtils.lerp(1.15, 1.0, t));
      }
      this.camera.position.z = 8;

    } else if (this.scrollPercent > 0.45 && this.scrollPercent <= 0.7) {
      // --- SPECIALTIES ---
      const t = (this.scrollPercent - 0.45) / 0.25;
      
      if (isMobile) {
        this.bowlGroup.position.x = 0;
        this.bowlGroup.position.y = -0.8 + t * 0.4;
        this.bowlGroup.scale.set(0.75, 0.75, 0.75);
      } else {
        // Move leftward/center-right to frame active dish description layout on the right
        // We zoom in slightly for extreme detail
        this.bowlGroup.position.x = THREE.MathUtils.lerp(2.6, 1.3, t);
        this.bowlGroup.position.y = THREE.MathUtils.lerp(-0.4, 0.1, t);
        
        const zoomScale = THREE.MathUtils.lerp(1.0, 1.3, t);
        this.bowlGroup.scale.set(zoomScale, zoomScale, zoomScale);
      }
      // Zoom camera slightly in for high detail of brass carvings
      this.camera.position.z = THREE.MathUtils.lerp(8, 7.2, t);

    } else if (this.scrollPercent > 0.7 && this.scrollPercent <= 0.85) {
      // --- EXPERIENCE ---
      const t = (this.scrollPercent - 0.7) / 0.15;
      
      if (isMobile) {
        this.bowlGroup.position.x = 0;
        this.bowlGroup.position.y = -0.4 - t * 0.6;
        this.bowlGroup.scale.set(0.5, 0.5, 0.5);
      } else {
        // Drop down to background, scale down to look like ambient backdrop
        this.bowlGroup.position.x = THREE.MathUtils.lerp(1.3, -1.8, t);
        this.bowlGroup.position.y = THREE.MathUtils.lerp(0.1, -1.2, t);
        
        const zoomScale = THREE.MathUtils.lerp(1.3, 0.75, t);
        this.bowlGroup.scale.set(zoomScale, zoomScale, zoomScale);
      }
      this.camera.position.z = THREE.MathUtils.lerp(7.2, 8.5, t);

    } else {
      // --- RESERVE / FOOTER ---
      const t = (this.scrollPercent - 0.85) / 0.15;
      
      if (isMobile) {
        this.bowlGroup.position.x = 0;
        this.bowlGroup.position.y = -1.0 + t * 0.4;
        this.bowlGroup.scale.set(0.6, 0.6, 0.6);
      } else {
        // Bring to the front center-left of the reservation layout
        this.bowlGroup.position.x = THREE.MathUtils.lerp(-1.8, -1.5, t);
        this.bowlGroup.position.y = THREE.MathUtils.lerp(-1.2, 0.3, t);
        
        const zoomScale = THREE.MathUtils.lerp(0.75, 1.1, t);
        this.bowlGroup.scale.set(zoomScale, zoomScale, zoomScale);
      }
      this.camera.position.z = 8;
    }
  }
}
