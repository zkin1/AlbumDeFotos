"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { OrigamiHeart } from "./OrigamiHeart";
import { withAlbumHearts, type HeartAnchor } from "@/lib/album-content";
import { heartMessages } from "@/config/heart-messages";
import { preloadPaper } from "@/lib/origami";
import { ALBUM_ROTATION_MS, INITIAL_PHOTO_COUNT, images, type GalleryImage } from "@/config/images";
import { createAlbum, rotateAlbum, type AlbumState } from "@/lib/album";
import { startAlbumRotation } from "@/lib/album-timer";
import { createSpaceScene, type SpaceScene } from "@/lib/space-scene";

export function CreativeSpace() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SpaceScene | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const alive = useRef(false);
  const [album, setAlbum] = useState<AlbumState<GalleryImage>>(() => ({ visible: images.slice(0, INITIAL_PHOTO_COUNT), remaining: images.slice(INITIAL_PHOTO_COUNT) }));
  const albumRef = useRef(album);
  const [selectedHeart, setSelectedHeart] = useState<{index:number;anchor:HeartAnchor}|null>(null);
  const selectedHeartRef = useRef<number|null>(null);
  const [heartOpen, setHeartOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current || !cursorRef.current) return;
    alive.current = true;
    void preloadPaper().catch(() => { /* Opening the paper offers a retry if preloading failed. */ });
    let mounted = true;
    const first = createAlbum(images, INITIAL_PHOTO_COUNT);
    albumRef.current = first;
    setAlbum(first);
    const cursor = cursorRef.current;
    gsap.set(cursor, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.6 });
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.5, ease: "power3.out" });
    try {
      sceneRef.current = createSpaceScene(hostRef.current, first.visible, {
        select(index) { if (mounted) { setSelected(index); setMessage(null); } },
        cursor(x, y) { xTo(x); yTo(y); },
        heart(index, anchor) {
          if (!mounted) return;
          setSelectedHeart(index === null || !anchor ? null : {index,anchor});
          if (index === null || selectedHeartRef.current !== index) setHeartOpen(index !== null);
          selectedHeartRef.current = index;
        },
        closeHeart() { if (mounted) setHeartOpen(false); },
        ready() { if (mounted) setReady(true); },
        failure(error) { if (mounted) setMessage(error); },
      });
    } catch (cause) {
      console.error("No se pudo iniciar el álbum:", cause);
      setMessage("Este álbum necesita WebGL. Activa la aceleración gráfica y vuelve a cargarlo.");
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") sceneRef.current?.select(null); };
    const onVisibility = () => setVisible(!document.hidden);
    onVisibility();
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false;
      alive.current = false;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      xTo.tween.kill(); yTo.tween.kill();
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!ready || selected !== null || !visible) return;
    return startAlbumRotation(async () => {
      const scene = sceneRef.current;
      if (!scene || !alive.current) return;
      const next = rotateAlbum(albumRef.current, images, INITIAL_PHOTO_COUNT);
      setBusy(true);
      setMessage(null);
      try {
        await scene.setImages(next.visible);
        if (alive.current && sceneRef.current === scene) { albumRef.current = next; setAlbum(next); }
      } finally {
        if (alive.current && sceneRef.current === scene) setBusy(false);
      }
    }, error => {
      if (alive.current) setMessage(error instanceof Error ? error.message : "No se pudieron barajar las fotos. Lo intentaremos de nuevo.");
    }, ALBUM_ROTATION_MS);
  }, [ready, selected, visible]);

  useEffect(() => {
    if (!cursorRef.current) return;
    const tween = gsap.to(cursorRef.current, {
      opacity: selected === null ? 0 : 1, scale: selected === null ? 0.6 : 1,
      duration: 0.45, ease: "power3.out", overwrite: "auto",
    });
    return () => { tween.kill(); };
  }, [selected]);

  const displayItems = withAlbumHearts(album.visible);
  const currentPhoto = selected === null ? null : displayItems[selected];
  return <main className="experience relative h-dvh w-full overflow-hidden bg-white">
    <h1 className="sr-only">Nuestro álbum de fotos</h1>
    <div ref={hostRef} className="space-canvas absolute inset-0" role="group" aria-busy={busy} aria-label={`${album.visible.length} fotos y 4 corazones de nuestro álbum. Arrastra o gira la rueda para moverlas. Selecciona una foto para ampliarla y pulsa Escape para cerrar. Se barajan automáticamente cada 40 segundos.`} />
    {!ready && !message && <div className="loading-frame" aria-hidden="true" />}
    {message && <div className="album-error" role="alert">
      <p>{message}</p>
      {!ready && <button type="button" onClick={() => window.location.reload()}>Recargar álbum</button>}
    </div>}
    <div ref={cursorRef} className="space-cursor" aria-hidden="true">Cerrar</div>
    <p className="sr-only" aria-live="polite">{currentPhoto ? `${currentPhoto.alt}, ampliado. El cambio automático está en pausa.` : busy ? "Barajando nuestros recuerdos." : `${album.visible.length} fotos visibles de ${images.length} recuerdos y 4 corazones con mensajes.`}</p>
    <div className="keyboard-tools" aria-label="Controles del álbum para teclado">
      {displayItems.map((image, index) => <button key={image.id} type="button" disabled={!ready || busy || selectedHeart !== null} onClick={() => sceneRef.current?.select(index)} aria-pressed={selected === index}>
        Abrir {image.alt.toLowerCase()}
      </button>)}
      {selected !== null && selectedHeart === null && <button type="button" onClick={() => sceneRef.current?.select(null)}>Cerrar foto</button>}
    </div>
    {selectedHeart && <aside className="selected-paper" aria-label="Mensaje de papel" style={{ left: selectedHeart.anchor.x-selectedHeart.anchor.width/2, top:selectedHeart.anchor.y-selectedHeart.anchor.width*560/720/2 }}>
      <OrigamiHeart key={selectedHeart.index} size={selectedHeart.anchor.width} floating={false} message={heartMessages[selectedHeart.index]} open={heartOpen} label={`corazón ${selectedHeart.index+1}`} hint="" onOpenChange={setHeartOpen} onClose={() => sceneRef.current?.select(null, true)} />
    </aside>}
    <noscript><p className="album-error">Activa JavaScript para explorar el álbum.</p></noscript>
  </main>;
}
