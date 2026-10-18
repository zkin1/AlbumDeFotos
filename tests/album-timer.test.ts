import assert from "node:assert/strict";
import test from "node:test";
import { startAlbumRotation } from "../src/lib/album-timer";
import { ALBUM_ROTATION_MS } from "../src/config/images";

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const unexpected = (error: unknown) => assert.fail(String(error));

test("photos change at 40 seconds, never sooner, and continue on that cadence", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let rotations = 0;
  const stop = startAlbumRotation(() => { rotations++; }, unexpected, ALBUM_ROTATION_MS);
  t.mock.timers.tick(39999);
  assert.equal(rotations, 0);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(rotations, 1);
  t.mock.timers.tick(40000);
  await flush();
  assert.equal(rotations, 2);
  stop();
  t.mock.timers.tick(120000);
  await flush();
  assert.equal(rotations, 2);
});

test("pausing an expanded photo cancels the timer; resuming waits a complete forty seconds", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let rotations = 0;
  const rotate = () => { rotations++; };
  const pause = startAlbumRotation(rotate, unexpected, 40000);
  t.mock.timers.tick(39000);
  pause();
  t.mock.timers.tick(80000);
  assert.equal(rotations, 0);
  const stop = startAlbumRotation(rotate, unexpected, 40000);
  t.mock.timers.tick(39999);
  assert.equal(rotations, 0);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(rotations, 1);
  stop();
});

test("a slow load never overlaps another shuffle or queues additional ones", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let rotations = 0;
  let finish!: () => void;
  const stop = startAlbumRotation(() => { rotations++; return new Promise<void>(resolve => { finish = resolve; }); }, unexpected, 40000);
  t.mock.timers.tick(40000);
  assert.equal(rotations, 1);
  t.mock.timers.tick(120000);
  assert.equal(rotations, 1);
  finish();
  await flush();
  t.mock.timers.tick(40000);
  assert.equal(rotations, 2);
  stop(); finish();
  await flush();
});

test("a failed load is reported and the next interval can retry", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let rotations = 0;
  const errors: unknown[] = [];
  const stop = startAlbumRotation(() => { if (++rotations === 1) throw new Error("network"); }, error => errors.push(error), 40000);
  t.mock.timers.tick(40000);
  await flush();
  assert.equal(errors.length, 1);
  t.mock.timers.tick(40000);
  await flush();
  assert.equal(rotations, 2);
  stop();
});

test("stopping during an in-flight load suppresses late errors", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let reject!: (error: Error) => void;
  const errors: unknown[] = [];
  const stop = startAlbumRotation(() => new Promise<void>((_, fail) => { reject = fail; }), error => errors.push(error), 40000);
  t.mock.timers.tick(40000);
  stop();
  reject(new Error("cancelled"));
  await flush();
  assert.deepEqual(errors, []);
});

test("zero, negative or non-finite delays are rejected", () => {
  for (const delay of [0, -1, NaN, Infinity]) assert.throws(() => startAlbumRotation(() => {}, unexpected, delay), RangeError);
});
