import { useEffect, useRef } from "react";
import * as THREE from "three";

type SpotifyView = "taste" | "timeline" | "analytics" | "discovery";

const palettes: Record<SpotifyView, { primary: number; secondary: number; accent: number }> = {
  taste: { primary: 0xb7ff38, secondary: 0xff4f70, accent: 0x56e7c4 },
  timeline: { primary: 0xff5f45, secondary: 0xffd33d, accent: 0x78a8ff },
  analytics: { primary: 0x54e2c2, secondary: 0xffb84d, accent: 0xff526d },
  discovery: { primary: 0x72a8ff, secondary: 0xff5b89, accent: 0xc8ff52 }
};

export function SpotifyWrappedScene({ view }: { view: SpotifyView }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const palette = palettes[view];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 9.5);

    const rig = new THREE.Group();
    rig.position.set(2.65, 0.1, 0);
    scene.add(rig);

    const ambient = new THREE.AmbientLight(0xffffff, 1.3);
    const key = new THREE.DirectionalLight(palette.primary, 4.4);
    key.position.set(3, 5, 6);
    const rim = new THREE.DirectionalLight(palette.secondary, 3.2);
    rim.position.set(-5, -2, 4);
    scene.add(ambient, key, rim);

    const record = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 1.85, 0.16, 72),
      new THREE.MeshStandardMaterial({ color: 0x111319, metalness: 0.72, roughness: 0.28, emissive: palette.primary, emissiveIntensity: 0.08 })
    );
    record.rotation.set(1.12, 0.18, -0.35);
    rig.add(record);

    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.18, 48),
      new THREE.MeshStandardMaterial({ color: palette.primary, metalness: 0.25, roughness: 0.42 })
    );
    label.position.copy(record.position);
    label.rotation.copy(record.rotation);
    rig.add(label);

    const spindle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.28, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.2 })
    );
    spindle.rotation.copy(record.rotation);
    rig.add(spindle);

    const ringMaterial = new THREE.MeshStandardMaterial({ color: palette.secondary, emissive: palette.secondary, emissiveIntensity: 0.36, metalness: 0.4, roughness: 0.32 });
    const rings = [2.35, 2.78].map((radius, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035 + index * 0.012, 12, 96), ringMaterial);
      ring.rotation.set(0.22 + index * 0.35, 0.62, index * 0.5);
      rig.add(ring);
      return ring;
    });

    const slabGeometry = new THREE.BoxGeometry(1.05, 1.05, 0.09);
    const slabColors = [palette.primary, palette.secondary, palette.accent, 0xffffff];
    const slabs = slabColors.map((color, index) => {
      const slab = new THREE.Mesh(
        slabGeometry,
        new THREE.MeshStandardMaterial({ color, metalness: 0.12, roughness: 0.46, emissive: color, emissiveIntensity: 0.08 })
      );
      const angle = index / slabColors.length * Math.PI * 2 + 0.3;
      slab.position.set(Math.cos(angle) * 3.15, Math.sin(angle) * 2.25, -0.8 + index * 0.38);
      slab.rotation.set(0.38 + index * 0.16, -0.44 + index * 0.28, angle * 0.4);
      rig.add(slab);
      return slab;
    });

    const particleCount = 120;
    const positions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const offset = index * 3;
      const radius = 2.5 + (index % 13) * 0.12;
      const angle = index * 0.63;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = Math.sin(angle) * radius * 0.72;
      positions[offset + 2] = ((index % 11) - 5) * 0.24;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: palette.accent, size: 0.045, transparent: true, opacity: 0.72, sizeAttenuation: true })
    );
    rig.add(particles);

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 0.34;
      pointer.y = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 0.24;
    };
    host.addEventListener("pointermove", onPointerMove, { passive: true });

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      rig.position.x = width < 760 ? 1.35 : 2.65;
      rig.scale.setScalar(width < 560 ? 0.72 : width < 900 ? 0.86 : 1);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    let isVisible = true;
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false;
    }, { rootMargin: "180px" });
    visibilityObserver.observe(host);
    resize();

    let frame = 0;
    let renderChecked = false;
    const startedAt = window.performance.now();
    const markRenderHealth = () => {
      const gl = renderer.getContext();
      const pixel = new Uint8Array(4);
      let litSamples = 0;
      for (let x = 1; x < 8; x += 1) {
        for (let y = 1; y < 8; y += 1) {
          gl.readPixels(Math.floor(gl.drawingBufferWidth * x / 8), Math.floor(gl.drawingBufferHeight * y / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          if (pixel[0] + pixel[1] + pixel[2] > 18) litSamples += 1;
        }
      }
      canvas.dataset.rendered = litSamples > 0 ? "true" : "false";
      canvas.dataset.litSamples = String(litSamples);
      renderChecked = true;
    };
    const animate = (timestamp = window.performance.now()) => {
      const elapsed = (timestamp - startedAt) / 1000;
      if (isVisible) {
        rig.rotation.y += (pointer.x - rig.rotation.y) * 0.035;
        rig.rotation.x += (-pointer.y - rig.rotation.x) * 0.035;
        if (!reducedMotion) {
          record.rotation.y = elapsed * 0.52;
          label.rotation.y = elapsed * 0.52;
          spindle.rotation.y = elapsed * 0.52;
          rings[0].rotation.z = elapsed * 0.16;
          rings[1].rotation.z = -elapsed * 0.12;
          particles.rotation.z = elapsed * 0.025;
          slabs.forEach((slab, index) => {
            slab.position.y += Math.sin(elapsed * 0.8 + index) * 0.0018;
            slab.rotation.y += 0.0018 * (index % 2 ? -1 : 1);
          });
        }
        renderer.render(scene, camera);
        if (!renderChecked) markRenderHealth();
      }
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", onPointerMove);
      observer.disconnect();
      visibilityObserver.disconnect();
      rig.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
    };
  }, [view]);

  return <canvas ref={canvasRef} className="spotify-wrapped-canvas" aria-hidden="true" />;
}
