export type AlbumState<T> = { visible: T[]; remaining: T[] };
type Random = () => number;

export function shuffle<T>(values: readonly T[], random: Random = Math.random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const next = Math.floor(random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

function checkCount(count: number) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError("La cantidad de fotos debe ser un entero positivo.");
}

export function createAlbum<T extends { id: string }>(photos: readonly T[], count: number, random: Random = Math.random): AlbumState<T> {
  checkCount(count);
  const unique = [...new Map(photos.map(photo => [photo.id, photo])).values()];
  const deck = shuffle(unique, random);
  return { visible: deck.slice(0, count), remaining: deck.slice(count) };
}

export function rotateAlbum<T extends { id: string }>(album: AlbumState<T>, photos: readonly T[], count: number, random: Random = Math.random): AlbumState<T> {
  checkCount(count);
  const unique = [...new Map(photos.map(photo => [photo.id, photo])).values()];
  const size = Math.min(count, unique.length);
  const visible = album.remaining.slice(0, size);
  let remaining = album.remaining.slice(size);
  if (visible.length < size) {
    const used = new Set(visible.map(photo => photo.id));
    const previous = new Set(album.visible.map(photo => photo.id));
    const fresh = shuffle(unique.filter(photo => !used.has(photo.id) && !previous.has(photo.id)), random);
    const fallback = shuffle(unique.filter(photo => !used.has(photo.id) && previous.has(photo.id)), random);
    visible.push(...[...fresh, ...fallback].slice(0, size - visible.length));
    const selected = new Set(visible.map(photo => photo.id));
    remaining = shuffle(unique.filter(photo => !selected.has(photo.id)), random);
  }
  return { visible: shuffle(visible, random), remaining };
}
