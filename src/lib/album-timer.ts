export function startAlbumRotation(rotate: () => void | Promise<void>, onError: (error: unknown) => void, delay: number) {
  if (!Number.isFinite(delay) || delay <= 0) throw new RangeError("El intervalo debe ser positivo.");
  let stopped = false;
  let running = false;
  const interval = setInterval(async () => {
    if (running) return;
    running = true;
    try { await rotate(); }
    catch (error) { if (!stopped) onError(error); }
    finally { running = false; }
  }, delay);
  return () => { stopped = true; clearInterval(interval); };
}
