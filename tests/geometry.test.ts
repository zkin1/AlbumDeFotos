import assert from "node:assert/strict";
import test from "node:test";
import { expandedFrame, sceneMetrics, spherePoint, TILE_ASPECT } from "../src/lib/geometry";
import { images } from "../src/config/images";
import { existsSync } from "node:fs";
import { join } from "node:path";

test("all 18 slots lie on a unit sphere and retain the reference's ordering", () => {
  assert.equal(images.length, 18);
  const points = images.map((_, index) => spherePoint(index, images.length));
  for (const point of points) assert.ok(Math.abs(Math.hypot(...point) - 1) < 1e-12);
  assert.ok(points[0][1] < 0 && points[17][1] > 0);
  assert.equal(new Set(images.map(item => item.id)).size, 18);
  for (const item of images) assert.ok(existsSync(join(process.cwd(), "public", item.src)), item.src);
});

test("reference desktop breakpoints and expanded 70vh frame stay exact", () => {
  assert.ok(Math.abs(sceneMetrics(1039, 884).tileHeight / sceneMetrics(1039, 884).unit - 65.6) < 1e-9);
  assert.equal(sceneMetrics(1441, 900).tileHeight / sceneMetrics(1441, 900).unit, 82);
  const frame = expandedFrame(1039, 884);
  assert.ok(Math.abs(frame.height / sceneMetrics(1039, 884).unit - 618.8) < 1e-9);
  assert.equal(frame.width / frame.height, TILE_ASPECT);
});

test("mobile expansion respects narrow screens and leaves room for overview", () => {
  for (const width of [280, 320, 390, 640]) {
    const { unit, radius } = sceneMetrics(width, 844);
    assert.ok(radius >= 0);
    const frame = expandedFrame(width, 844, 190);
    assert.ok(frame.width / unit <= width - 16 + 1e-9);
    assert.ok(frame.height / unit <= (844 - 190) * 0.7 + 1e-9);
    assert.ok(frame.y > 0);
  }
});
