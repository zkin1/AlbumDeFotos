"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { images } from "@/config/images";
import { createSpaceScene, type SpaceScene } from "@/lib/space-scene";

export function CreativeSpace() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SpaceScene | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hostRef.current || !cursorRef.current) return;
    let mounted = true;
    const cursor = cursorRef.current;
    gsap.set(cursor, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.6 });
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.5, ease: "power3.out" });
    try {
      sceneRef.current = createSpaceScene(hostRef.current, images, {
        select: setSelected,
        cursor(x, y) { xTo(x); yTo(y); },
        ready() { if (mounted) setReady(true); },
      });
    } catch (cause) {
      console.error("The image gallery could not initialize WebGL:", cause);
      setError(true);
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") sceneRef.current?.select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      mounted = false;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      xTo.tween.kill(); yTo.tween.kill();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!cursorRef.current) return;
    const tween = gsap.to(cursorRef.current, {
      opacity: selected === null ? 0 : 1, scale: selected === null ? 0.6 : 1,
      duration: 0.45, ease: "power3.out", overwrite: "auto",
    });
    return () => { tween.kill(); };
  }, [selected]);

  return <main className="experience relative h-dvh w-full overflow-hidden bg-white">
    <h1 className="sr-only">Creative Space¹ — Image gallery</h1>
    <div ref={hostRef} className="space-canvas absolute inset-0" role="group" aria-label="Eighteen images. Drag or scroll to rotate. Select an image to expand it; select again or press Escape to close." />
    {!ready && !error && <div className="loading-frame" aria-hidden="true" />}
    {error && <div className="webgl-fallback">
      <p>This gallery needs WebGL. Enable hardware acceleration and reload the page.</p>
      <button type="button" onClick={() => window.location.reload()}>Reload</button>
    </div>}
    <div ref={cursorRef} className="space-cursor" aria-hidden="true">Close</div>
    <p className="sr-only" aria-live="polite">{selected === null ? "Image sphere" : `Image ${selected + 1} expanded`}</p>
    <div className="keyboard-tools" aria-label="Keyboard gallery controls">
      {images.map((image, index) => <button key={image.id} type="button" disabled={!ready} onClick={() => sceneRef.current?.select(index)} aria-pressed={selected === index}>
        Open image {String(index + 1).padStart(2, "0")}
      </button>)}
      {selected !== null && <button type="button" onClick={() => sceneRef.current?.select(null)}>Close image</button>}
    </div>
    <noscript><p className="webgl-fallback">Enable JavaScript to explore the images.</p></noscript>
  </main>;
}
