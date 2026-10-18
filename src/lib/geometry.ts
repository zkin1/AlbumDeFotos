export const TILE_ASPECT = 3 / 4;
export const CAMERA_Z = 12;
export const FIELD_OF_VIEW = 60;

export function spherePoint(index: number, count: number): [number, number, number] {
  const y = (2 * index + 1) / count - 1;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = Math.PI * (3 - Math.sqrt(5)) * index;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

export function sceneMetrics(width: number, height: number) {
  const visibleHeight = 2 * CAMERA_Z * Math.tan(FIELD_OF_VIEW * Math.PI / 360);
  const unit = visibleHeight / height;
  const compact = width >= 1025 && width <= 1440 ? 0.8 : 1;
  const tileHeight = (width <= 640 ? 60 : 82 * compact) * unit;
  const radius = width <= 640
    ? Math.max(0, (width - 48) * unit / 2 - tileHeight / 2)
    : 250 * compact * unit;
  return { visibleHeight, unit, radius, tileHeight };
}

export function expandedFrame(width: number, height: number, reservedBottom = 0) {
  const metrics = sceneMetrics(width, height);
  const availableHeight = Math.max(0, height - reservedBottom);
  const maxWidth = width <= 640 ? width - 16 : width - 32;
  const frameHeight = Math.min(availableHeight * 0.7, maxWidth / TILE_ASPECT);
  return {
    width: frameHeight * TILE_ASPECT * metrics.unit,
    height: frameHeight * metrics.unit,
    y: reservedBottom * metrics.unit / 2,
  };
}
