import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { images, albumInfo } from "../src/config/images";

const publicRoot = resolve(process.cwd(), "public");

test("every unique imported photo has valid full-size and thumbnail WebP files, without EXIF or XMP", () => {
  assert.equal(images.length + albumInfo.duplicateCount, albumInfo.sourceCount);
  assert.equal(albumInfo.sourceCount, 67);
  assert.equal(albumInfo.duplicateCount, 6);
  assert.equal(new Set(images.map(image => image.id)).size, images.length);
  const contents = new Set<string>();
  for (const image of images) {
    assert.ok(image.alt.trim().length > 0);
    assert.ok(Number.isInteger(image.width) && image.width > 0 && image.width <= 1600);
    assert.ok(Number.isInteger(image.height) && image.height > 0 && image.height <= 1600);
    for (const src of [image.src, image.thumbnailSrc]) {
      assert.match(src, /^\/photos\/photo-[a-f0-9]{16}(?:-thumb)?\.webp$/);
      const file = resolve(join(publicRoot, src));
      assert.ok(file.startsWith(publicRoot));
      const buffer = readFileSync(file);
      assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
      assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
      for (let offset = 12; offset + 8 <= buffer.length;) {
        const chunk = buffer.toString("ascii", offset, offset + 4);
        assert.ok(chunk !== "EXIF" && chunk !== "XMP ", src);
        const size = buffer.readUInt32LE(offset + 4);
        offset += 8 + size + size % 2;
      }
      if (src === image.src) contents.add(createHash("sha256").update(buffer).digest("hex"));
    }
  }
  assert.equal(contents.size, images.length, "Repeated full-size photo files");
});
