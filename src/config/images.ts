import album from "./photos.json";

export type GalleryImage = {
  id: string;
  src: string;
  thumbnailSrc: string;
  alt: string;
  width: number;
  height: number;
};

export const images: GalleryImage[] = album.photos;
export const albumInfo = { sourceCount: album.sourceCount, duplicateCount: album.duplicateCount };
export const INITIAL_PHOTO_COUNT = 14;
export const ALBUM_ROTATION_MS = 40_000;
