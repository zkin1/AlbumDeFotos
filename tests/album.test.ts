import assert from "node:assert/strict";
import test from "node:test";
import { createAlbum, rotateAlbum, shuffle } from "../src/lib/album";
import { images, INITIAL_PHOTO_COUNT } from "../src/config/images";

function random(seed: number) {
  let state = seed;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
}

test("the album begins with fourteen different photographs and keeps the rest", () => {
  const album = createAlbum(images, INITIAL_PHOTO_COUNT, random(1));
  assert.equal(album.visible.length, INITIAL_PHOTO_COUNT);
  assert.equal(album.visible.length + album.remaining.length, images.length);
  assert.equal(new Set([...album.visible, ...album.remaining].map(photo => photo.id)).size, images.length);
});

test("all photos appear before a new cycle, with no duplicates inside or between consecutive groups", () => {
  for (const seed of [1, 7, 42, 2026]) {
    const rng = random(seed);
    let album = createAlbum(images, INITIAL_PHOTO_COUNT, rng);
    const seen = new Set(album.visible.map(photo => photo.id));
    for (let round = 1; round <= 20; round++) {
      const previous = new Set(album.visible.map(photo => photo.id));
      album = rotateAlbum(album, images, INITIAL_PHOTO_COUNT, rng);
      assert.equal(album.visible.length, INITIAL_PHOTO_COUNT);
      assert.equal(new Set(album.visible.map(photo => photo.id)).size, INITIAL_PHOTO_COUNT);
      assert.ok(album.visible.every(photo => !previous.has(photo.id)), `Repeated an adjacent photo in round ${round}`);
      album.visible.forEach(photo => seen.add(photo.id));
      if (round === Math.ceil(images.length / INITIAL_PHOTO_COUNT) - 1) assert.equal(seen.size, images.length);
    }
  }
});

test("small and empty albums rotate without inventing or losing photographs", () => {
  for (const size of [0, 1, 5, 18, 19, 35, 36]) {
    const photos = Array.from({ length: size }, (_, index) => ({ id: `photo-${index}` }));
    let album = createAlbum(photos, 18, random(size));
    const seen = new Set<string>();
    for (let round = 0; round < 12; round++) {
      assert.equal(album.visible.length, Math.min(18, size));
      assert.equal(new Set(album.visible.map(photo => photo.id)).size, album.visible.length);
      album.visible.forEach(photo => seen.add(photo.id));
      album = rotateAlbum(album, photos, 18, random(round + size));
    }
    assert.equal(seen.size, size);
  }
});

test("shuffling and rotating leave the source and previous state unchanged", () => {
  const source = Object.freeze([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
  const album = createAlbum(source, 2, random(9));
  const before = JSON.stringify(album);
  Object.freeze(album.visible); Object.freeze(album.remaining); Object.freeze(album);
  rotateAlbum(album, source, 2, random(2));
  assert.equal(JSON.stringify(album), before);
  const shuffled = shuffle(source, () => 0);
  assert.deepEqual(source.map(photo => photo.id), ["a", "b", "c", "d"]);
  assert.notDeepEqual(shuffled, source);
  assert.equal(new Set(shuffled.map(photo => photo.id)).size, 4);
});

test("duplicate IDs and invalid batch sizes are handled", () => {
  const photos = [{ id: "a" }, { id: "a" }, { id: "b" }];
  assert.equal(createAlbum(photos, 18).visible.length, 2);
  for (const invalid of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => createAlbum(photos, invalid), RangeError);
    assert.throws(() => rotateAlbum({ visible: [], remaining: [] }, photos, invalid), RangeError);
  }
});
