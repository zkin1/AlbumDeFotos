import * as THREE from "three";
import gsap from "gsap";
import type { GalleryImage } from "@/config/images";
import { CAMERA_Z, FIELD_OF_VIEW, TILE_ASPECT, expandedFrame, sceneMetrics, spherePoint } from "./geometry";

type Callbacks = {
  select: (index: number | null) => void;
  cursor: (x: number, y: number, overSelected: boolean) => void;
  ready: () => void;
};

type Card = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  point: THREE.Vector3;
  base: THREE.Vector3;
  expand: number;
  reveal: number;
  collapse: number;
  spread: number;
  start: THREE.Vector3;
  startScale: THREE.Vector2;
};

export function createSpaceScene(host: HTMLElement, items: GalleryImage[], callbacks: Callbacks) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 1000);
  camera.position.z = CAMERA_Z;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  const group = new THREE.Group();
  scene.add(group);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const loader = new THREE.TextureLoader();
  const cards: Card[] = items.map((item, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: "#f2f2f2", transparent: true, opacity: reducedMotion ? 1 : 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.index = index;
    group.add(mesh);
    return {
      mesh, point: new THREE.Vector3(...spherePoint(index, items.length)),
      base: new THREE.Vector3(), expand: 0, reveal: 0, collapse: 0, spread: 0,
      start: new THREE.Vector3(), startScale: new THREE.Vector2(),
    };
  });
  let disposed = false;
  const textures: THREE.Texture[] = [];
  items.forEach((item, index) => {
    loader.load(item.src, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const aspect = texture.image.width / texture.image.height;
      // Cover the fixed portrait frame without changing the sphere geometry.
      if (aspect > TILE_ASPECT) {
        texture.repeat.x = TILE_ASPECT / aspect;
        texture.offset.x = (1 - texture.repeat.x) / 2;
      } else {
        texture.repeat.y = aspect / TILE_ASPECT;
        texture.offset.y = (1 - texture.repeat.y) / 2;
      }
      textures.push(texture);
      cards[index].mesh.material.color.set("#ffffff");
      cards[index].mesh.material.map = texture;
      cards[index].mesh.material.needsUpdate = true;
    }, undefined, () => {
      // An unavailable replacement remains a neutral frame and keeps all interactions.
    });
  });

  let width = 1, height = 1;
  let metrics = sceneMetrics(width, height);
  let selected: number | null = null;
  let ready = reducedMotion;
  let interacted = false;
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    metrics = sceneMetrics(width, height);
    cards.forEach(card => card.base.copy(card.point).multiplyScalar(metrics.radius));
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const rotation = new THREE.Quaternion();
  const inverse = new THREE.Quaternion();
  const increment = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisX = new THREE.Vector3(1, 0, 0);
  const autoAxis = new THREE.Vector3(Math.sin(23 * Math.PI / 180), Math.cos(23 * Math.PI / 180), 0);
  const spinAxis = autoAxis.clone();
  let migratedSpin = 0;
  const expandedPosition = new THREE.Vector3();
  let xTarget = 0, yTarget = 0, xSmooth = 0, ySmooth = 0;
  let previousX = 0, previousY = 0, velocityX = 0, velocityY = 0;

  const intro = { angle: 0, speed: 1 };
  const introTweens = gsap.timeline();
  if (!reducedMotion) {
    cards.slice(0, 10).forEach((card, index) => {
      introTweens.to(card, { reveal: 1, duration: 1, ease: "back.out(1.7)" }, 2 + index * 0.1);
      introTweens.to(card, { collapse: 1, duration: 1.25, ease: "power2.inOut" }, 4.1 + index * 0.05);
    });
    introTweens.to(intro, { speed: 7.3, duration: 1, ease: "power2.in" }, 3.3);
    introTweens.call(() => {
      const centerHeight = metrics.tileHeight * 120 / 82;
      cards.forEach((card, index) => {
        card.start.copy(index < 10 ? card.mesh.position : new THREE.Vector3());
        card.startScale.set(centerHeight * TILE_ASPECT, centerHeight);
      });
    }, [], 6);
    introTweens.to(cards, { spread: 1, duration: 1, ease: "power3.out" }, 6);
    introTweens.call(() => {
      ready = true;
      migratedSpin = 0.001;
      callbacks.ready();
      host.dataset.ready = "true";
    }, [], 7);
  } else {
    host.dataset.ready = "true";
    queueMicrotask(callbacks.ready);
  }

  const select = (index: number | null) => {
    if (index !== null && (!Number.isInteger(index) || !cards[index])) return;
    selected = index;
    interacted = true;
    velocityX = velocityY = 0;
    cards.forEach((card, current) => gsap.to(card, {
      expand: current === index ? 1 : 0,
      duration: reducedMotion ? 0 : 0.8, ease: "power4.out", overwrite: true,
    }));
    callbacks.select(index);
    host.dataset.selected = index === null ? "" : String(index);
  };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const meshes = cards.map(card => card.mesh);
  const hit = (x: number, y: number): number | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(selected === null ? meshes : [cards[selected].mesh], false);
    return hits.length ? hits[0].object.userData.index as number : null;
  };
  const updatePointer = (x: number, y: number) => {
    const target = hit(x, y);
    callbacks.cursor(x, y, selected !== null && target === selected);
    if (selected !== null) { host.style.cursor = "pointer"; return; }
    const bounds = canvas.getBoundingClientRect();
    const distance = Math.hypot(x - bounds.left - width / 2, y - bounds.top - height / 2);
    host.style.cursor = target !== null ? "pointer" : distance <= 250 ? "grab" : "default";
  };

  const pointers = new Map<number, { x: number; y: number }>();
  let downX = 0, downY = 0, lastX = 0, lastY = 0, distance = 0, pinchDistance = 0;
  let wasPinch = false;
  const onDown = (event: PointerEvent) => {
    if (!ready || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    interacted = true;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      wasPinch = true;
      return;
    }
    wasPinch = false;
    downX = lastX = event.clientX;
    downY = lastY = event.clientY;
    distance = 0;
    host.style.cursor = "grabbing";
  };
  const onMove = (event: PointerEvent) => {
    if (!ready) return;
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const nextDistance = Math.hypot(a.x - b.x, a.y - b.y);
        if (selected === null) velocityX += (pinchDistance - nextDistance) * 0.0002;
        pinchDistance = nextDistance;
      } else {
        const dx = event.clientX - lastX, dy = event.clientY - lastY;
        distance += Math.hypot(dx, dy);
        lastX = event.clientX; lastY = event.clientY;
        if (selected === null) { velocityX += dx * 0.001; velocityY += dy * 0.001; }
      }
    } else if (event.pointerType !== "touch") updatePointer(event.clientX, event.clientY);
  };
  const onUp = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size > 0) {
      const remaining = [...pointers.values()][0];
      lastX = remaining.x; lastY = remaining.y;
      return;
    }
    if (!wasPinch && distance < 10 && Math.hypot(event.clientX - downX, event.clientY - downY) < 6) {
      const target = hit(event.clientX, event.clientY);
      select(selected === null ? target : null);
    }
    if (event.pointerType === "touch") host.style.cursor = "default";
    else updatePointer(event.clientX, event.clientY);
  };
  const onCancel = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    wasPinch = true;
    host.style.cursor = "default";
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (!ready || selected !== null) return;
    interacted = true;
    velocityX += event.deltaY * (event.deltaMode === 1 ? 16 : 1) * 0.0002;
  };
  const onLeave = () => { if (!pointers.size) host.style.cursor = "default"; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerleave", onLeave);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);

  let animationFrame = 0, previousTime = performance.now();
  const render = (time: number) => {
    if (disposed) return;
    animationFrame = requestAnimationFrame(render);
    const frame = Math.min(2, Math.max(0.1, (time - previousTime) / (1000 / 60)));
    previousTime = time;
    if (document.hidden) return;
    if (ready) {
      xTarget += velocityX * frame;
      yTarget += velocityY * frame;
      velocityX *= 0.94 ** frame;
      velocityY *= 0.94 ** frame;
      const smoothing = 1 - 0.89 ** frame;
      xSmooth += (xTarget - xSmooth) * smoothing;
      ySmooth += (yTarget - ySmooth) * smoothing;
      increment.setFromAxisAngle(axisY, xSmooth - previousX); rotation.premultiply(increment);
      increment.setFromAxisAngle(axisX, ySmooth - previousY); rotation.premultiply(increment);
      previousX = xSmooth; previousY = ySmooth;
      if (!interacted && !reducedMotion) {
        if (migratedSpin) {
          spinAxis.lerp(autoAxis, 1 - 0.996 ** frame).normalize();
          increment.setFromAxisAngle(spinAxis, migratedSpin * frame);
        } else increment.setFromAxisAngle(autoAxis, 0.001 * frame);
        rotation.premultiply(increment);
      }
      rotation.normalize();
      group.quaternion.copy(rotation);
      inverse.copy(rotation).invert();

    }
    let expansion = 0;
    cards.forEach(card => { expansion = Math.max(expansion, card.expand); });
    const openFrame = expandedFrame(width, height);
    expandedPosition.set(0, openFrame.y, 0).applyQuaternion(inverse);
    if (!ready) intro.angle += 0.5 * intro.speed * Math.PI / 180 * frame;
    cards.forEach((card, index) => {
      card.mesh.quaternion.copy(inverse);
      if (!ready && card.spread === 0) {
        if (index >= 10) { card.mesh.material.opacity = 0; return; }
        const angle = (-90 + index * 36) * Math.PI / 180 + intro.angle;
        const radius = 240 * metrics.unit * (width <= 640 ? 0.75 : 1);
        const collapse = card.collapse;
        card.mesh.position.set(Math.cos(angle) * radius * (1 - collapse), Math.sin(angle) * radius * (1 - collapse), index * 1.5 * metrics.unit * collapse);
        const ringHeight = 70 * metrics.unit * (width <= 640 ? 0.75 : 1);
        const centerHeight = metrics.tileHeight * 120 / 82;
        const tileHeight = THREE.MathUtils.lerp(ringHeight, centerHeight, collapse) * card.reveal;
        card.mesh.scale.set(tileHeight * TILE_ASPECT, tileHeight, 1);
        card.mesh.material.opacity = Math.min(1, card.reveal);
        card.mesh.renderOrder = collapse > 0 ? 20 + index : 0;
        return;
      }
      if (!ready) {
        const spread = card.spread;
        card.mesh.position.lerpVectors(card.start, card.base, spread).multiplyScalar(1 + 0.1 * Math.sin(Math.PI * spread));
        card.mesh.scale.set(THREE.MathUtils.lerp(card.startScale.x, metrics.tileHeight * TILE_ASPECT, spread), THREE.MathUtils.lerp(card.startScale.y, metrics.tileHeight, spread), 1);
        card.mesh.material.opacity = 1;
        card.mesh.renderOrder = 0;
        return;
      }
      const t = card.expand;
      const push = t > 0.0001 ? 1 : 1 + 0.8 * expansion;
      card.mesh.position.copy(card.base).multiplyScalar(push).lerp(expandedPosition, t);
      card.mesh.scale.set(THREE.MathUtils.lerp(metrics.tileHeight * TILE_ASPECT, openFrame.width, t), THREE.MathUtils.lerp(metrics.tileHeight, openFrame.height, t), 1);
      card.mesh.material.opacity = t > 0.0001 ? 1 : 1 - expansion;
      card.mesh.renderOrder = t > 0.0001 ? 2 : 0;
    });
    renderer.render(scene, camera);
  };
  animationFrame = requestAnimationFrame(render);

  return {
    select,
    destroy() {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      introTweens.kill();
      gsap.killTweensOf(cards);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      geometry.dispose();
      cards.forEach(card => card.mesh.material.dispose());
      textures.forEach(texture => texture.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}

export type SpaceScene = ReturnType<typeof createSpaceScene>;
