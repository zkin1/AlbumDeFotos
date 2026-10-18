import * as THREE from "three";
import gsap from "gsap";
import type { GalleryImage } from "@/config/images";
import { paperContains, type AlbumItem, type HeartAnchor } from "./album-content";
import { CAMERA_Z, FIELD_OF_VIEW, TILE_ASPECT, coverUv, expandedFrame, sceneMetrics, spherePoint } from "./geometry";

type Callbacks = {
  select: (index: number | null) => void;
  cursor: (x: number, y: number) => void;
  motion: (speed: number) => void;
  ready: () => void;
  failure: (message: string) => void;
  heart: (index: number | null, anchor?: HeartAnchor) => void;
  closeHeart: () => void;
};

type Card = {
  item: AlbumItem;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  thumbnail: THREE.Texture | null;
  point: THREE.Vector3;
  base: THREE.Vector3;
  expand: number;
  appearance: number;
  reveal: number;
  collapse: number;
  spread: number;
  start: THREE.Vector3;
  startScale: THREE.Vector2;
};

export function createSpaceScene(host: HTMLElement, items: AlbumItem[], callbacks: Callbacks) {
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
  const textures = new Set<THREE.Texture>();
  const retiring = new Set<Card>();
  const thumbnails = new Map<string, Promise<THREE.Texture>>();
  const pendingLoads = new Set<() => void>();
  let disposed = false;
  let width = host.clientWidth || 1, height = host.clientHeight || 1;
  let selected: number | null = null;
  let ready = false, updating = false, interacted = false;
  let introComplete = reducedMotion, initialLoaded = false;
  let fullTexture: THREE.Texture | null = null;
  let fullCard: Card | null = null;
  let restoringHeart: Card | null = null;
  let selectionVersion = 0;
  let transition: gsap.core.Timeline | null = null;

  const release = (texture: THREE.Texture) => { if (textures.delete(texture)) texture.dispose(); };
  const loadTexture = (src: string) => new Promise<THREE.Texture>((resolve, reject) => {
    let settled = false;
    const cancel = () => finish(new Error("La carga de la foto se canceló."));
    const timer = window.setTimeout(() => finish(new Error("La foto tardó demasiado en cargar.")), 20000);
    const finish = (error?: Error, texture?: THREE.Texture) => {
      if (settled) { texture?.dispose(); return; }
      settled = true;
      clearTimeout(timer);
      pendingLoads.delete(cancel);
      if (error || !texture) { reject(error); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures.add(texture);
      resolve(texture);
    };
    pendingLoads.add(cancel);
    loader.load(src, texture => {
      if (disposed) { texture.dispose(); finish(new Error("La galería se cerró.")); }
      else finish(undefined, texture);
    }, undefined, () => finish(new Error("No se pudo cargar una foto. Inténtalo de nuevo.")));
  });
  const loadThumbnail = (item: GalleryImage) => {
    let pending = thumbnails.get(item.id);
    if (!pending) {
      pending = loadTexture(item.thumbnailSrc).catch(error => { thumbnails.delete(item.id); throw error; });
      thumbnails.set(item.id, pending);
    }
    return pending;
  };
  const makeCard = (item: AlbumItem, index: number, count: number, thumbnail: THREE.Texture | null = null): Card => {
    const material = new THREE.MeshBasicMaterial({
      color: thumbnail ? "#ffffff" : "#f2f2f2", map: thumbnail,
      transparent: true, opacity: reducedMotion ? 1 : 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.index = index;
    group.add(mesh);
    return {
      item, mesh, thumbnail, point: new THREE.Vector3(...spherePoint(index, count)), base: new THREE.Vector3(),
      expand: 0, appearance: 1, reveal: 0, collapse: 0, spread: 0,
      start: new THREE.Vector3(), startScale: new THREE.Vector2(),
    };
  };
  let cards = items.map((item, index) => makeCard(item, index, items.length));
  const meshes = cards.map(card => card.mesh);
  let metrics = sceneMetrics(width, height, cards.length);
  const layout = { tileHeight: metrics.tileHeight };
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    metrics = sceneMetrics(width, height, cards.length);
    gsap.killTweensOf(layout);
    layout.tileHeight = metrics.tileHeight;
    cards.forEach(card => { gsap.killTweensOf(card.base); card.base.copy(card.point).multiplyScalar(metrics.radius); });
    if (selected !== null && cards[selected].item.heartIndex !== undefined) publishHeartAnchor(cards[selected]);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const maybeReady = () => {
    if (disposed || ready || !introComplete || !initialLoaded) return;
    ready = true;
    host.dataset.ready = "true";
    callbacks.ready();
  };
  void Promise.all(cards.map(async card => {
    const texture = await loadThumbnail(card.item);
    if (disposed) return;
    card.thumbnail = texture;
    card.mesh.material.color.set("#ffffff");
    card.mesh.material.map = texture;
    card.mesh.material.needsUpdate = true;
  })).then(() => { initialLoaded = true; maybeReady(); }).catch(() => {
    if (!disposed) callbacks.failure("No se pudieron cargar las fotos. Recarga el álbum para volver a intentarlo.");
  });

  const rotation = new THREE.Quaternion();
  const inverse = new THREE.Quaternion();
  const increment = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisX = new THREE.Vector3(1, 0, 0);
  const autoAxis = new THREE.Vector3(Math.sin(23 * Math.PI / 180), Math.cos(23 * Math.PI / 180), 0);
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
      const centerHeight = layout.tileHeight * 120 / 82;
      cards.forEach((card, index) => {
        card.start.copy(index < 10 ? card.mesh.position : new THREE.Vector3());
        card.startScale.set(centerHeight * (card.item.heartIndex === undefined ? TILE_ASPECT : 720/560), centerHeight);
      });
    }, [], 6);
    introTweens.to(cards, { spread: 1, duration: 1, ease: "power3.out" }, 6);
    introTweens.call(() => { introComplete = true; maybeReady(); }, [], 7);
  }

  function publishHeartAnchor(card: Card) {
    group.updateMatrixWorld(true);
    const world = group.localToWorld(card.base.clone());
    const pixels = height / (2 * Math.tan(FIELD_OF_VIEW * Math.PI / 360) * (CAMERA_Z - world.z));
    const projected = world.clone().project(camera);
    callbacks.heart(card.item.heartIndex!, { x: (projected.x+1)*width/2, y: (1-projected.y)*height/2, width: layout.tileHeight*1.35*720/560*pixels });
  }
  const select = (index: number | null, finishHeartClose = false) => {
    if (!finishHeartClose && selected !== null && cards[selected]?.item.heartIndex !== undefined && index !== selected) { callbacks.closeHeart(); return; }
    if (disposed || (index !== null && (!ready || updating || !Number.isInteger(index) || !cards[index]))) return;
    const previous = selected === null ? null : cards[selected];
    restoringHeart = index === null && previous?.item.heartIndex !== undefined ? previous : null;
    selected = index;
    interacted = true;
    velocityX = velocityY = 0;
    xTarget = xSmooth; yTarget = ySmooth;
    const version = ++selectionVersion;
    if (fullCard) { fullCard.mesh.material.map = fullCard.thumbnail; fullCard.mesh.material.needsUpdate = true; fullCard = null; }
    if (fullTexture) { release(fullTexture); fullTexture = null; }
    cards.forEach((card, current) => gsap.to(card, {
      expand: current === index ? 1 : 0,
      duration: reducedMotion ? 0 : 0.8, ease: "power4.out", overwrite: "auto",
    }));
    callbacks.select(index);
    host.dataset.selected = index === null ? "" : String(index);
    if (index !== null && cards[index].item.heartIndex !== undefined) {
      publishHeartAnchor(cards[index]);
    } else callbacks.heart(null);
    if (index !== null && cards[index].item.heartIndex === undefined) {
      const card = cards[index];
      void loadTexture(card.item.src).then(texture => {
        if (disposed || version !== selectionVersion) { release(texture); return; }
        fullTexture = texture;
        fullCard = card;
        card.mesh.material.map = texture;
        card.mesh.material.needsUpdate = true;
      }).catch(() => {
        if (!disposed && version === selectionVersion) callbacks.failure("No se pudo cargar la foto grande. Puedes cerrarla y volver a abrirla.");
      });
    }
  };

  const setImages = async (nextItems: AlbumItem[]) => {
    if (nextItems.length === 0) throw new Error("La selección de fotos no es válida.");
    if (disposed || !ready || updating) throw new Error("Espera a que termine la animación.");
    const nextIds = new Set(nextItems.map(item => item.id));
    if (nextIds.size !== nextItems.length || nextItems.length === 0) throw new Error("La selección de fotos no es válida.");
    if (selected !== null) select(null);
    pointers.clear();
    velocityX = velocityY = 0;
    updating = true;
    try {
      const existing = new Map(cards.map(card => [card.item.id, card]));
      const newItems = nextItems.filter(item => !existing.has(item.id));
      const loaded = await Promise.all(newItems.map(loadThumbnail));
      if (disposed) return;
      const addedTextures = new Map(newItems.map((item, index) => [item.id, loaded[index]]));
      for (const card of cards) {
        if (nextIds.has(card.item.id)) continue;
        retiring.add(card);
        gsap.to(card.mesh.material, { opacity: 0, duration: reducedMotion ? 0 : 0.35, onComplete: () => { group.remove(card.mesh); card.mesh.material.dispose(); retiring.delete(card); } });
      }
      cards = nextItems.map((item, index) => {
        const previous = existing.get(item.id);
        const card = previous ?? makeCard(item, index, nextItems.length, addedTextures.get(item.id)!);
        card.mesh.userData.index = index;
        card.point.set(...spherePoint(index, nextItems.length));
        if (!previous) card.appearance = 0;
        return card;
      });
      meshes.splice(0, meshes.length, ...cards.map(card => card.mesh));
      metrics = sceneMetrics(width, height, cards.length);
      await new Promise<void>(resolve => {
        const timeline = gsap.timeline({ onComplete: resolve, onInterrupt: resolve });
        transition = timeline;
        timeline.to(layout, { tileHeight: metrics.tileHeight, duration: reducedMotion ? 0 : 1, ease: "power3.inOut" }, 0);
        let added = 0;
        cards.forEach(card => {
          const target = card.point.clone().multiplyScalar(metrics.radius);
          timeline.to(card.base, { x: target.x, y: target.y, z: target.z, duration: reducedMotion ? 0 : 1, ease: "power3.inOut", overwrite: "auto" }, 0);
          if (card.appearance === 0) timeline.to(card, { appearance: 1, duration: reducedMotion ? 0 : 0.7, ease: "power3.out" }, reducedMotion ? 0 : added++ * 0.025);
        });
      });
    } finally { updating = false; transition = null; }
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = (x: number, y: number): number | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(selected === null ? meshes : [cards[selected].mesh], false);
    const first = hits.find(result => {
      const card = cards[result.object.userData.index as number];
      return card.item.heartIndex === undefined || (result.uv && paperContains(result.uv.x, 1-result.uv.y));
    });
    return first ? first.object.userData.index as number : null;
  };
  const updatePointer = (x: number, y: number) => {
    const target = hit(x, y);
    callbacks.cursor(x, y);
    if (selected !== null) { host.style.cursor = "pointer"; return; }
    const bounds = canvas.getBoundingClientRect();
    const distance = Math.hypot(x - bounds.left - width / 2, y - bounds.top - height / 2);
    host.style.cursor = target !== null ? "pointer" : distance <= 250 ? "grab" : "default";
  };
  const pointers = new Map<number, { x: number; y: number }>();
  let downX = 0, downY = 0, lastX = 0, lastY = 0, distance = 0, pinchDistance = 0;
  let wasPinch = false;
  const onDown = (event: PointerEvent) => {
    if (!ready || updating || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    interacted = true;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      wasPinch = true;
      return;
    }
    wasPinch = false;
    downX = lastX = event.clientX; downY = lastY = event.clientY;
    distance = 0;
    host.style.cursor = "grabbing";
  };
  const onMove = (event: PointerEvent) => {
    if (!ready || updating) return;
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const nextDistance = Math.hypot(a.x - b.x, a.y - b.y);
        if (selected === null) velocityX += (pinchDistance - nextDistance) * 0.0002;
        pinchDistance = nextDistance;
      } else {
        const dx = event.clientX - lastX, dy = event.clientY - lastY;
        distance += Math.hypot(dx, dy); lastX = event.clientX; lastY = event.clientY;
        if (selected === null) { velocityX += dx * 0.001; velocityY += dy * 0.001; }
      }
    } else if (event.pointerType !== "touch" && canvas.contains(event.target as Node)) updatePointer(event.clientX, event.clientY);
  };
  const onUp = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size > 0) {
      const remaining = [...pointers.values()][0]; lastX = remaining.x; lastY = remaining.y;
      return;
    }
    if (!wasPinch && distance < 10 && Math.hypot(event.clientX - downX, event.clientY - downY) < 6) select(selected === null ? hit(event.clientX, event.clientY) : null);
    if (event.pointerType === "touch") host.style.cursor = "default";
    else updatePointer(event.clientX, event.clientY);
  };
  const onCancel = (event: PointerEvent) => { pointers.delete(event.pointerId); wasPinch = true; host.style.cursor = "default"; };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (!ready || updating || selected !== null) return;
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
      xTarget += velocityX * frame; yTarget += velocityY * frame;
      velocityX *= 0.94 ** frame; velocityY *= 0.94 ** frame;
      const smoothing = 1 - 0.89 ** frame;
      xSmooth += (xTarget - xSmooth) * smoothing; ySmooth += (yTarget - ySmooth) * smoothing;
      increment.setFromAxisAngle(axisY, xSmooth - previousX); rotation.premultiply(increment);
      increment.setFromAxisAngle(axisX, ySmooth - previousY); rotation.premultiply(increment);
      callbacks.motion(selected === null && !updating ? Math.hypot(xSmooth-previousX,ySmooth-previousY) : 0);
      previousX = xSmooth; previousY = ySmooth;
      if (!interacted && !reducedMotion) { increment.setFromAxisAngle(autoAxis, 0.001 * frame); rotation.premultiply(increment); }
      rotation.normalize(); group.quaternion.copy(rotation); inverse.copy(rotation).invert();
    }
    let expansion = 0;
    cards.forEach(card => { expansion = Math.max(expansion, card.expand); });
    if (!introComplete) intro.angle += 0.5 * intro.speed * Math.PI / 180 * frame;
    cards.forEach((card, index) => {
      card.mesh.quaternion.copy(inverse);
      if (!introComplete && card.spread === 0) {
        if (index >= 10) { card.mesh.material.opacity = 0; return; }
        const angle = (-90 + index * 36) * Math.PI / 180 + intro.angle;
        const radius = 240 * metrics.unit * (width <= 640 ? 0.75 : 1);
        const collapse = card.collapse;
        card.mesh.position.set(Math.cos(angle) * radius * (1 - collapse), Math.sin(angle) * radius * (1 - collapse), index * 1.5 * metrics.unit * collapse);
        const ringHeight = 70 * metrics.unit * (width <= 640 ? 0.75 : 1);
        const centerHeight = layout.tileHeight * 120 / 82;
        const tileHeight = THREE.MathUtils.lerp(ringHeight, centerHeight, collapse) * card.reveal;
        card.mesh.scale.set(tileHeight * (card.item.heartIndex === undefined ? TILE_ASPECT : 720/560), tileHeight, 1);
        card.mesh.material.opacity = Math.min(1, card.reveal);
        card.mesh.renderOrder = collapse > 0 ? 20 + index : 0;
      } else if (!introComplete) {
        const spread = card.spread;
        card.mesh.position.lerpVectors(card.start, card.base, spread).multiplyScalar(1 + 0.1 * Math.sin(Math.PI * spread));
        card.mesh.scale.set(THREE.MathUtils.lerp(card.startScale.x, layout.tileHeight * (card.item.heartIndex === undefined ? TILE_ASPECT : 1.35 * 720/560), spread), THREE.MathUtils.lerp(card.startScale.y, layout.tileHeight * (card.item.heartIndex === undefined ? 1 : 1.35), spread), 1);
        card.mesh.material.opacity = 1; card.mesh.renderOrder = 0;
      } else {
        const t = card.expand;
        if (card.item.heartIndex !== undefined) {
          card.mesh.position.copy(card.base).multiplyScalar(1 + 0.8 * expansion);
          if (selected === index || restoringHeart === card) card.mesh.position.copy(card.base);
          card.mesh.scale.set(layout.tileHeight * 1.35 * 720/560, layout.tileHeight * 1.35, 1);
          card.mesh.material.opacity = selected === index ? 0 : restoringHeart === card ? 1 : (1-expansion)*card.appearance;
          if (restoringHeart === card && expansion < 0.001) restoringHeart = null;
          card.mesh.renderOrder = 0;
          return;
        }
        const openFrame = expandedFrame(width, height, 0, card.item.width / card.item.height);
        expandedPosition.set(0, openFrame.y, 0).applyQuaternion(inverse);
        const push = t > 0.0001 ? 1 : 1 + 0.8 * expansion;
        card.mesh.position.copy(card.base).multiplyScalar(push).lerp(expandedPosition, t);
        card.mesh.scale.set(THREE.MathUtils.lerp(layout.tileHeight * TILE_ASPECT, openFrame.width, t), THREE.MathUtils.lerp(layout.tileHeight, openFrame.height, t), 1);
        card.mesh.material.opacity = (t > 0.0001 ? 1 : 1 - expansion) * card.appearance;
        card.mesh.renderOrder = t > 0.0001 ? 2 : 0;
      }
      const texture = card.mesh.material.map;
      if (texture && card.mesh.scale.y > 0) {
        const uv = coverUv(card.mesh.scale.x / card.mesh.scale.y, card.item.width / card.item.height);
        texture.repeat.set(uv.x, uv.y); texture.offset.set(uv.offsetX, uv.offsetY);
      }
    });
    renderer.render(scene, camera);
  };
  animationFrame = requestAnimationFrame(render);

  return {
    select,
    setImages,
    destroy() {
      disposed = true;
      selectionVersion++;
      cancelAnimationFrame(animationFrame);
      introTweens.kill(); transition?.kill();
      gsap.killTweensOf(cards); gsap.killTweensOf(layout);
      cards.forEach(card => gsap.killTweensOf(card.base));
      retiring.forEach(card => { gsap.killTweensOf(card.mesh.material); card.mesh.material.dispose(); });
      pendingLoads.forEach(cancel => cancel());
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onCancel);
      geometry.dispose(); cards.forEach(card => card.mesh.material.dispose()); textures.forEach(texture => texture.dispose());
      renderer.dispose(); canvas.remove();
    },
  };
}

export type SpaceScene = ReturnType<typeof createSpaceScene>;
