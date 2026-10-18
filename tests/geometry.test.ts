import assert from "node:assert/strict";
import test from "node:test";
import { CAMERA_Z, coverUv, expandedFrame, sceneMetrics, spherePoint, TILE_ASPECT } from "../src/lib/geometry";

test("any supported group size remains evenly ordered on the unit sphere", () => {
  for (const count of [1, 5, 18, 30, 61]) {
    const points = Array.from({ length: count }, (_, index) => spherePoint(index, count));
    for (const point of points) assert.ok(Math.abs(Math.hypot(...point) - 1) < 1e-12);
    if (count > 1) assert.ok(points[0][1] < 0 && points[count - 1][1] > 0);
  }
});

test("reference desktop sizes remain exact at eighteen photographs", () => {
  assert.ok(Math.abs(sceneMetrics(1039, 884).tileHeight / sceneMetrics(1039, 884).unit - 65.6) < 1e-9);
  assert.equal(sceneMetrics(1441, 900).tileHeight / sceneMetrics(1441, 900).unit, 82);
  const frame = expandedFrame(1039, 884);
  assert.ok(Math.abs(frame.height / sceneMetrics(1039, 884).unit - 618.8) < 1e-9);
  assert.equal(frame.width / frame.height, TILE_ASPECT);
});

test("portrait, square, landscape and panoramic photos fit without cropping when expanded", () => {
  for (const width of [280, 320, 390, 768, 1039, 1441]) {
    for (const height of [278, 500, 844, 900]) {
      const { unit } = sceneMetrics(width, height);
      for (const aspect of [0.25, 0.5625, 0.75, 1, 4 / 3, 16 / 9, 4]) {
        const frame = expandedFrame(width, height, 0, aspect);
        assert.ok(frame.width / unit <= width - (width <= 640 ? 16 : 32) + 1e-9);
        assert.ok(frame.height / unit <= height * 0.7 + 1e-9);
        assert.ok(Math.abs(frame.width / frame.height - aspect) < 1e-9);
        assert.deepEqual(coverUv(aspect, aspect), { x: 1, y: 1, offsetX: 0, offsetY: 0 });
      }
    }
  }
});

test("thumbnail cover keeps the image proportions and a centered crop throughout expansion", () => {
  for (const imageAspect of [0.25, 0.75, 1, 4 / 3, 4]) {
    for (const frameAspect of [0.75, (0.75 + imageAspect) / 2, imageAspect]) {
      const uv = coverUv(frameAspect, imageAspect);
      assert.ok(uv.x > 0 && uv.x <= 1 && uv.y > 0 && uv.y <= 1);
      assert.ok(uv.offsetX >= 0 && uv.offsetX < 0.5 && uv.offsetY >= 0 && uv.offsetY < 0.5);
      assert.ok(Math.abs(imageAspect * uv.x / uv.y - frameAspect) < 1e-9);
    }
  }
});

test("narrow and short viewports constrain the sphere and maintain finite dimensions", () => {
  for (const [width, height] of [[280, 340], [844, 278], [390, 844]]) {
    const layout = sceneMetrics(width, height);
    assert.ok(layout.radius >= 0 && Number.isFinite(layout.radius));
    assert.ok(layout.radius / layout.unit <= Math.max(0, (height - 100) / 2) + 1e-9);
    assert.ok(layout.tileHeight / layout.unit <= height / 4);
  }
});

test("all sphere cards stay inside short and narrow viewports under perspective", () => {
  for (const [width, height] of [[844, 390], [844, 278], [736, 668], [320, 568], [390, 844], [1440, 900], [280, 340]]) {
    const { radius, unit, tileHeight } = sceneMetrics(width, height);
    for (let index = 0; index < 400; index++) {
      const [x, y, z] = spherePoint(index, 400);
      const perspective = CAMERA_Z / (CAMERA_Z - radius * z);
      const halfWidth = tileHeight * TILE_ASPECT / unit / 2 * perspective;
      const halfHeight = tileHeight / unit / 2 * perspective;
      const centerX = width / 2 + radius * x / unit * perspective;
      const centerY = height / 2 + radius * y / unit * perspective;
      assert.ok(centerX - halfWidth >= 23.5 && centerX + halfWidth <= width - 23.5, `Horizontal clipping at ${width}x${height}`);
      assert.ok(centerY - halfHeight >= 15.5 && centerY + halfHeight <= height - 15.5, `Vertical clipping at ${width}x${height}`);
    }
  }
});
