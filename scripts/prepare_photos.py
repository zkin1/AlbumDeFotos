"""Prepare local album photos; keep originals and publish only metadata-free WebP copies."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def prepare(converter: str) -> None:
    originals = ROOT / 'photos-originals'
    output = ROOT / 'public' / 'photos'
    manifest_path = ROOT / 'src' / 'config' / 'photos.json'
    files = sorted((p for p in originals.rglob('*') if p.is_file() and p.suffix.lower() in {'.jpg', '.jpeg', '.heic', '.heif', '.png'}), key=lambda p: str(p).casefold())
    if not files:
        raise RuntimeError('No photographs found in photos-originals')
    output.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    photos = []
    duplicate_count = 0
    with tempfile.TemporaryDirectory(prefix='album-import-') as temporary:
        for source in files:
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            if digest in seen:
                duplicate_count += 1
                continue
            seen.add(digest)
            photo_id = f'photo-{digest[:16]}'
            decoded = source
            if source.suffix.lower() in {'.heic', '.heif'}:
                decoded = Path(temporary) / f'{photo_id}.png'
                result = subprocess.run([converter, '--quiet', '--png-compression-level', '0', str(source), str(decoded)], capture_output=True, text=True, encoding='utf-8', errors='replace')
                if result.returncode or not decoded.exists():
                    raise RuntimeError(f'Could not convert {source.name}: {result.stderr.strip()}')
            with Image.open(decoded) as original:
                photo = ImageOps.exif_transpose(original).convert('RGB')
                photo.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                photo.info.clear()
                full_path = output / f'{photo_id}.webp'
                photo.save(full_path, 'WEBP', quality=88, method=4)
                width, height = photo.size
                thumbnail = photo.copy()
                thumbnail.thumbnail((480, 480), Image.Resampling.LANCZOS)
                thumbnail.save(output / f'{photo_id}-thumb.webp', 'WEBP', quality=80, method=4)
            for name, maximum in [(f'{photo_id}.webp', 1600), (f'{photo_id}-thumb.webp', 480)]:
                with Image.open(output / name) as verified:
                    verified.load()
                    assert verified.format == 'WEBP' and max(verified.size) <= maximum
                    assert len(verified.getexif()) == 0, f'Unexpected EXIF metadata: {name}'
            photos.append({'id': photo_id, 'src': f'/photos/{photo_id}.webp', 'thumbnailSrc': f'/photos/{photo_id}-thumb.webp', 'alt': f'Recuerdo {len(photos) + 1} de nuestro álbum', 'width': width, 'height': height})
            if decoded != source:
                decoded.unlink()
            print(f'Prepared {len(photos)} photographs', flush=True)
    assert len(photos) + duplicate_count == len(files)
    assert len({photo['id'] for photo in photos}) == len(photos)
    manifest = {'sourceCount': len(files), 'duplicateCount': duplicate_count, 'photos': photos}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'originals': len(files), 'uniquePhotos': len(photos), 'duplicatesSkipped': duplicate_count, 'webBytes': sum(p.stat().st_size for p in output.glob('*.webp'))}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--converter', default=shutil.which('heif-convert'))
    arguments = parser.parse_args()
    if not arguments.converter:
        parser.error('Pass --converter with the path to heif-convert')
    prepare(arguments.converter)
