import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

// The supplied sheet is normalized around the lower tip, at one shared scale.
const source = 'Secuencia de corazón de papel desplegable.png';
const boxes = [
  [50,45,325,285,215,320], [425,45,335,285,592,320],
  [810,45,345,280,984,315], [1200,45,350,280,1375,313],
  [1585,45,355,280,1773,312], [60,380,395,310,262,677],
  [485,380,435,315,705,684], [948,380,460,325,1180,697],
  [1425,363,510,362,1675,713],
];
const width = 720, height = 560, scale = 1.35;
await mkdir('public/origami', { recursive: true });
for (const [index, [left, top, w, h, anchorX, anchorY]] of boxes.entries()) {
  let crop = sharp(source).extract({ left, top, width:w, height:h });
  if (index === 8) {
    // Only the handwritten phrase is replaced; the reference edges and folds stay intact.
    const patchW=158, patchH=56;
    const patch = await sharp('docs/origami/open-paper-source.png')
      .extract({left:570,top:480,width:440,height:150}).resize(patchW,patchH).removeAlpha().raw().toBuffer();
    const rgba=Buffer.alloc(patchW*patchH*4);
    for(let y=0;y<patchH;y++) for(let x=0;x<patchW;x++) {
      const p=y*patchW+x, edge=Math.min(x,y,patchW-1-x,patchH-1-y);
      for(let c=0;c<3;c++) rgba[p*4+c]=patch[p*3+c];
      rgba[p*4+3]=Math.round(Math.min(1,edge/10)*255);
    }
    crop=crop.composite([{input:rgba,raw:{width:patchW,height:patchH,channels:4},left:174,top:156}]);
  }
  const {data,info}=await crop.removeAlpha().raw().toBuffer({resolveWithObject:true});
  // Flood only the connected black exterior, preserving the dark receipt ink inside.
  const outside=new Uint8Array(w*h), queue=[];
  const add=(p)=>{if(!outside[p] && Math.max(data[p*3],data[p*3+1],data[p*3+2])<75){outside[p]=1;queue.push(p)}};
  for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}
  for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
  for(let n=0;n<queue.length;n++){
    const p=queue[n],x=p%w,y=Math.floor(p/w);
    if(x>0)add(p-1);if(x<w-1)add(p+1);if(y>0)add(p-w);if(y<h-1)add(p+w);
  }
  const rgba=Buffer.alloc(w*h*4);
  for(let p=0;p<w*h;p++){
    for(let c=0;c<3;c++)rgba[p*4+c]=data[p*info.channels+c];
    rgba[p*4+3]=outside[p]?0:255;
  }
  const normalized=await sharp(rgba,{raw:{width:w,height:h,channels:4}})
    .resize(Math.round(w*scale),Math.round(h*scale)).png().toBuffer();
  await sharp({create:{width,height,channels:4,background:'#00000000'}})
    .composite([{input:normalized,left:Math.round(360+(left-anchorX)*scale),top:Math.round(510+(top-anchorY)*scale)}])
    .webp({lossless:true}).toFile(`public/origami/heart-${index+1}.webp`);
}
await writeFile('docs/origami/asset-provenance.md', `# Papel de origami\n\nLos nueve estados proceden de la referencia del proyecto. Se recortaron individualmente, se eliminó únicamente el fondo negro conectado al exterior y se alineó la punta inferior en (360, 510), canvas 720 × 560, escala 1,35. Se conserva la tinta de recibo.\n\nEl centro del estado nueve se limpió usando una pequeña muestra del papel preparado con la herramienta integrada imagegen. No hay mensaje fijo en los assets finales. El original generado se conserva en open-paper-source.png.\n\nPrompt de edición: extraer únicamente el noveno corazón abierto, mantener silueta, textura, tinta, pliegues y bordes; eliminar «siempre acá.» y continuar el papel; fondo transparente real, sin números, sin texto añadido y sin rediseñar el objeto.\n\nRegenerar: node scripts/prepare-origami.mjs\n`);
console.log('9 frames, 720 × 560, transparent and aligned.');
