// INTERACTIVE 3D BINDING DEFERRED — requires Blender rework to add semantic node names per component
//
// Interactive Digital Twin viewer: loads the Draco-compressed injection machine
// glb into an orbit-controlled canvas (drag to rotate, scroll to zoom), with a
// gentle auto-rotate when idle. The source model's nodes have only generic names,
// so live per-component health is shown via the gauges, not bound to meshes here.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const MODEL_URL = "/models/injection_machine.glb";
const DRACO_DECODER_PATH = "/draco/";

export function Twin3D(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let raf = 0;
    let disposed = false;
    let model: THREE.Object3D | null = null;

    const width = () => container.clientWidth;
    const height = () => Math.max(1, container.clientHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.1, 5000);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width(), height());
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xfff0d0, 1.15);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;

    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const dist = maxDim * 1.4;
        camera.position.set(dist * 0.7, dist * 0.4, dist * 0.95);
        camera.far = dist * 12;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.minDistance = maxDim * 0.6;
        controls.maxDistance = maxDim * 4;
        controls.update();

        scene.add(model);
      },
      undefined,
      (err) => console.warn("Twin3D: failed to load model", err),
    );

    const resizeObserver = new ResizeObserver(() => {
      renderer.setSize(width(), height());
      camera.aspect = width() / height();
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      controls.dispose();
      draco.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
      renderer.dispose();
      renderer.domElement.parentNode?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-md bg-slate-950/40">
      <div ref={containerRef} className="absolute inset-0" />
      <span className="pointer-events-none absolute bottom-1.5 left-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        drag to orbit · scroll to zoom
      </span>
    </div>
  );
}
