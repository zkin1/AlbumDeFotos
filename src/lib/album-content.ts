import type { GalleryImage } from "@/config/images";
import { heartMessages } from "@/config/heart-messages";

export type AlbumItem = GalleryImage & { heartIndex?: number };
export type HeartAnchor = { x: number; y: number; width: number };
export const HEART_COUNT = 4;
const slots = [2,6,11,16];

export function withAlbumHearts(photos: GalleryImage[]): AlbumItem[] {
  const result: AlbumItem[] = [...photos];
  heartMessages.slice(0,HEART_COUNT).forEach((_,index)=>{
    result.splice(Math.min(slots[index],result.length),0,{
      id:`paper-heart-${index}`,src:"/origami/heart-1.webp",thumbnailSrc:"/origami/heart-1.webp",
      alt:`Corazón ${index+1}`,width:720,height:560,heartIndex:index,
    });
  });
  return result;
}

export function paperContains(x:number,y:number) {
  const outline=[[.23,.45],[.24,.37],[.39,.29],[.5,.37],[.61,.29],[.75,.37],[.78,.49],[.74,.63],[.5,.92],[.27,.63]];
  let inside=false;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++){
    const [xi,yi]=outline[i],[xj,yj]=outline[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
