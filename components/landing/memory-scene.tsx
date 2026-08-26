"use client";

import { useEffect, useRef } from "react";

/**
 * "Memory constellation" — a slowly rotating galaxy of glowing nodes and
 * synapse lines, drifting toward the pointer. A visual metaphor for the
 * app itself: familiar people as stars you never lose.
 *
 * Engineering guards (this is an assistive PWA used on modest phones):
 * - three.js is DYNAMICALLY imported inside the effect, so it lives in its
 *   own chunk and never touches the shared First Load JS budget.
 * - devicePixelRatio capped at 2; single RAF loop; paused when tab hidden.
 * - prefers-reduced-motion renders ONE static frame — no animation at all.
 * - Everything (geometry, materials, renderer) is disposed on unmount;
 * - WebGL failure falls back silently to the CSS gradient backdrop.
 */
export function MemoryScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let cleanup: () => void = () => undefined;

    void (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        return; // chunk failed to load — CSS backdrop carries the design
      }
      if (disposed || container.clientWidth === 0) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return; // no WebGL — graceful fallback
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x0a2e33, 0.05);
      const camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / Math.max(1, container.clientHeight),
        0.1,
        120,
      );
      camera.position.set(0, 0.6, 15);

      // --- Nodes: golden-angle spiral galaxy -----------------------------
      const COUNT = 240;
      const positions = new Float32Array(COUNT * 3);
      const drift = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        const t = i / COUNT;
        const radius = 0.8 + Math.sqrt(t) * 9.5;
        const angle = i * 2.399963229728653; // golden angle ⇒ even spread
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = (Math.random() * 2 - 1) * (1.15 - t) * 3.4;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
        drift[i] = Math.random();
      }

      const nodesGeo = new THREE.BufferGeometry();
      nodesGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const nodesMat = new THREE.PointsMaterial({
        color: 0x5eead4,
        size: 0.17,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const nodes = new THREE.Points(nodesGeo, nodesMat);

      // Soft halo layer — fewer, larger, fainter points for depth.
      const haloGeo = new THREE.BufferGeometry();
      const haloPos = new Float32Array(48 * 3);
      for (let i = 0; i < 48; i++) {
        const t = i / 48;
        const radius = 1.4 + Math.sqrt(t) * 10.5;
        const angle = i * 2.399963229728653 + 1.1;
        haloPos[i * 3] = Math.cos(angle) * radius;
        haloPos[i * 3 + 1] = (Math.random() * 2 - 1) * 2.6;
        haloPos[i * 3 + 2] = Math.sin(angle) * radius;
      }
      haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
      const haloMat = new THREE.PointsMaterial({
        color: 0x99f6e4,
        size: 0.55,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Points(haloGeo, haloMat);

      // --- Synapse lines: connect neighbors once (O(n²), 240² ≈ 57k) ----
      const linePositions: number[] = [];
      const MAX_D = 2.1;
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          if (dx * dx + dy * dy + dz * dz < MAX_D * MAX_D) {
            linePositions.push(
              positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
              positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2],
            );
          }
        }
      }
      const linesGeo = new THREE.BufferGeometry();
      linesGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linePositions, 3),
      );
      const linesMat = new THREE.LineBasicMaterial({
        color: 0x2dd4bf,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const lines = new THREE.LineSegments(linesGeo, linesMat);

      const group = new THREE.Group();
      group.add(lines, halo, nodes);
      scene.add(group);

      // Gentle pointer parallax.
      let pointerX = 0;
      let pointerY = 0;
      const onPointer = (e: PointerEvent): void => {
        pointerX = (e.clientX / window.innerWidth) * 2 - 1;
        pointerY = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let rafId = 0;
      const clock = new THREE.Clock();

      const frame = (): void => {
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        group.rotation.y += dt * 0.06;
        group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, pointerY * 0.12, 0.03);
        group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, pointerX * 0.08, 0.03);
        // Subtle breathing on the whole constellation.
        const breathe = 1 + Math.sin(t * 0.45) * 0.02;
        group.scale.setScalar(breathe);
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(frame);
      };

      const onVisibility = (): void => {
        if (document.hidden) {
          cancelAnimationFrame(rafId);
        } else {
          clock.getDelta(); // swallow the paused gap
          rafId = requestAnimationFrame(frame);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      const resize = (): void => {
        const w = container.clientWidth;
        const h = Math.max(1, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);

      if (reduced) {
        // Static composition — still beautiful, zero motion.
        group.rotation.y = 0.7;
        renderer.render(scene, camera);
      } else {
        rafId = requestAnimationFrame(frame);
      }

      cleanup = () => {
        cancelAnimationFrame(rafId);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pointermove", onPointer);
        observer.disconnect();
        nodesGeo.dispose();
        nodesMat.dispose();
        haloGeo.dispose();
        haloMat.dispose();
        linesGeo.dispose();
        linesMat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
    />
  );
}
