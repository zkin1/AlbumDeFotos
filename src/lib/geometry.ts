export const TILE_ASPECT = 3 / 4;
export const CAMERA_Z = 12;
export const FIELD_OF_VIEW = 60;

export function spherePoint(index: number, count: number): [number, number, number] {
  const y = (2 * index + 1) / count - 1;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = Math.PI * (3 - Math.sqrt(5)) * index;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

export function sceneMetrics(width: number, height: number, count = 18) {
  const visibleHeight = 2 * CAMERA_Z * Math.tan(FIELD_OF_VIEW * Math.PI / 360);
  const unit = visibleHeight / height;
  const compact = width >= 1025 && width <= 1440 ? 0.8 : 1;
  const density = Math.min(1, Math.sqrt(18 / Math.max(1, count)));
  const tileHeight = Math.min(width <= 640 ? 60 : 82 * compact, height / 4) * density * unit;
  const tilePixels = tileHeight / unit;
  const intendedRadius = width <= 640 ? Math.max(0, (width - 48) / 2 - tilePixels / 2) : 250 * compact;
  // Front cards appear larger in perspective, so leave space for their projected corners.
  const fitRadius = (extent: number, halfSize: number) => Math.max(0, (extent - halfSize) / Math.hypot(1, extent * unit / CAMERA_Z));
  const radius = Math.min(intendedRadius, fitRadius(width / 2 - 24, tilePixels * TILE_ASPECT / 2), fitRadius(height / 2 - 16, tilePixels / 2)) * unit;
  return { visibleHeight, unit, radius, tileHeight };
}

export function expandedFrame(width: number, height: number, reservedBottom = 0, aspect = TILE_ASPECT) {
  const { unit } = sceneMetrics(width, height);
  const availableHeight = Math.max(0, height - reservedBottom);
  const maxWidth = Math.max(0, width - (width <= 640 ? 16 : 32));
  const frameHeight = Math.min(availableHeight * 0.7, maxWidth / aspect);
  return { width: frameHeight * aspect * unit, height: frameHeight * unit, y: reservedBottom * unit / 2 };
}

export function coverUv(frameAspect: number, imageAspect: number) {
  const x = Math.min(1, frameAspect / imageAspect);
  const y = Math.min(1, imageAspect / frameAspect);
  return { x, y, offsetX: (1 - x) / 2, offsetY: (1 - y) / 2 };
}
