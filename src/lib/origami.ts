export type Point = readonly [number, number];
export const PAPER_WIDTH = 720;
export const PAPER_HEIGHT = 560;
export const HEART_FRAMES = Array.from({ length: 9 }, (_, i) => `/origami/heart-${i + 1}.webp`);

// Corresponding fold intersections, on the shared canvas. The exterior stays transparent.
const folds = [
  [166,211,315,242], [166,211,313,240], [166,216,306,238],
  [171,221,300,236], [175,221,293,232], [147,202,314,221],
  [137,188,283,214], [123,158,251,205], [68,124,207,200],
];
export const PAPER_POSES: Point[][] = folds.map(([peak, notch, crease, lower]) => [
  [0,0],[180,0],[360,0],[540,0],[720,0],
  [0,120],[250,peak],[360,notch],[470,peak],[720,120],
  [0,300],[190,crease],[360,crease],[530,crease],[720,300],
  [0,440],[lower,410],[360,455],[720-lower,410],[720,440],
  [0,560],[180,560],[360,560],[540,560],[720,560],
]);
export const PAPER_TRIANGLES: readonly [number, number, number][] = Array.from({ length: 16 }, (_, n) => {
  const a = Math.floor(n / 4) * 5 + n % 4;
  return [[a,a+1,a+6],[a,a+6,a+5]] as [number,number,number][];
}).flat();

export function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
export function paperTransition(progress: number) {
  const position = Math.max(0, Math.min(8, progress * 8));
  const from = Math.min(7, Math.floor(position));
  const mix = smooth(position - from);
  return { from, to: from + 1, mix, points: PAPER_POSES[from].map((point, i) => [
    point[0] + (PAPER_POSES[from+1][i][0] - point[0]) * mix,
    point[1] + (PAPER_POSES[from+1][i][1] - point[1]) * mix,
  ] as Point) };
}
export function affine(source: readonly Point[], target: readonly Point[]) {
  const [[x0,y0],[x1,y1],[x2,y2]] = source;
  const [[u0,v0],[u1,v1],[u2,v2]] = target;
  const determinant = (x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
  if (Math.abs(determinant) < 0.0001) throw new RangeError('Degenerate paper triangle');
  const a=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/determinant;
  const b=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/determinant;
  const c=((x1-x0)*(u2-u0)-(x2-x0)*(u1-u0))/determinant;
  const d=((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/determinant;
  return [a,b,c,d,u0-a*x0-c*y0,v0-b*x0-d*y0] as const;
}

export function drawPaper(context: CanvasRenderingContext2D, images: HTMLImageElement[], progress: number) {
  if(progress<=0||progress>=1) {
    context.clearRect(0,0,PAPER_WIDTH,PAPER_HEIGHT);
    context.drawImage(images[progress<=0?0:8],0,0,PAPER_WIDTH,PAPER_HEIGHT);
    return;
  }
  const {from,to,mix,points}=paperTransition(progress);
  context.clearRect(0,0,PAPER_WIDTH,PAPER_HEIGHT);
  const draw = (index: number, opacity: number) => {
    context.globalAlpha=opacity;
    for(const indices of PAPER_TRIANGLES) {
      const source=indices.map(i=>PAPER_POSES[index][i]);
      const target=indices.map(i=>points[i]);
      const cx=target.reduce((sum,p)=>sum+p[0],0)/3, cy=target.reduce((sum,p)=>sum+p[1],0)/3;
      context.save(); context.beginPath();
      // A small overlap avoids hairline seams between textured paper triangles.
      target.forEach(([x,y],i)=>context[i===0?'moveTo':'lineTo'](x+(x-cx)*0.003,y+(y-cy)*0.003));
      context.closePath(); context.clip();
      context.transform(...affine(source,target));
      context.drawImage(images[index],0,0,PAPER_WIDTH,PAPER_HEIGHT);
      context.restore();
    }
  };
  draw(from,1);
  if(mix>0)draw(to,mix);
  context.globalAlpha=1;
}

export function largestFittingFont(min: number, max: number, fits: (size: number)=>boolean) {
  let low=Math.min(min,max), high=max;
  if(!fits(low))return low;
  while(high-low>0.15) {
    const mid=(low+high)/2;
    if(fits(mid))low=mid; else high=mid;
  }
  return low;
}

export function paperCanvasSize(displayWidth: number, pixelRatio: number) {
  const ratio=Math.max(2,Math.min(3,Number.isFinite(pixelRatio)?pixelRatio:2));
  return {width:Math.ceil(displayWidth*ratio),height:Math.ceil(displayWidth*PAPER_HEIGHT/PAPER_WIDTH*ratio)};
}

export function heartPlacement(rect: {left:number;top:number;width:number;height:number}, viewport: {width:number;height:number}) {
  const width=Math.min(540,viewport.width-32,(viewport.height-48)*PAPER_WIDTH/PAPER_HEIGHT);
  const scale=Math.max(0.1,width/rect.width);
  return { scale, x:viewport.width/2-(rect.left+rect.width/2), y:viewport.height/2-(rect.top+rect.height/2) };
}


export function createPaperActivation() {
  let pressed = false;
  return {
    pointerDown(button: number) { pressed = button === 0; },
    cancel() { pressed = false; },
    click(detail: number) {
      // A touch that mounted the paper can send a delayed click to the new button.
      const accepted = detail === 0 || pressed;
      pressed = false;
      return accepted;
    },
  };
}

let paperAssets: Promise<HTMLImageElement[]> | undefined;
export function preloadPaper() {
  if(!paperAssets) {
    paperAssets=Promise.all(HEART_FRAMES.map(src=>new Promise<HTMLImageElement>((resolve,reject)=>{
      const image=new Image();
      const timer=window.setTimeout(()=>finish(new Error(`Paper timeout: ${src}`)),15_000);
      const finish=(error?:Error)=>{
        window.clearTimeout(timer);image.onload=null;image.onerror=null;
        if(error)reject(error);else resolve(image);
      };
      image.onload=()=>finish();image.onerror=()=>finish(new Error(`Paper asset missing: ${src}`));image.src=src;
    }))).catch(error=>{paperAssets=undefined;throw error;});
  }
  return paperAssets;
}
