import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createPaperActivation, affine, HEART_FRAMES, heartPlacement, largestFittingFont, PAPER_POSES, PAPER_TRIANGLES, paperTransition, smooth } from "../src/lib/origami";

test("paper transitions reproduce all nine reference poses continuously",()=>{
  for(let i=0;i<9;i++)assert.deepEqual(paperTransition(i/8).points,PAPER_POSES[i]);
  for(let i=1;i<800;i++){
    const a=paperTransition((i-1)/800),b=paperTransition(i/800);
    for(let p=0;p<a.points.length;p++)assert.ok(Math.hypot(a.points[p][0]-b.points[p][0],a.points[p][1]-b.points[p][1])<3);

  }
  assert.deepEqual(paperTransition(-1).points,PAPER_POSES[0]);
  assert.deepEqual(paperTransition(2).points,PAPER_POSES[8]);
});
test("every mesh triangle stays valid across the full unfolding",()=>{
  for(let i=0;i<=160;i++)for(const triangle of PAPER_TRIANGLES){
    const source=triangle.map(index=>PAPER_POSES[0][index]);
    const target=triangle.map(index=>paperTransition(i/160).points[index]);
    const transform=affine(source,target);
    assert.ok(transform.every(Number.isFinite));
    assert.ok(transform[0]*transform[3]-transform[1]*transform[2]>0,"No folded-over or inverted triangle");
    source.forEach(([x,y],j)=>{
      assert.ok(Math.abs(transform[0]*x+transform[2]*y+transform[4]-target[j][0])<1e-7);
      assert.ok(Math.abs(transform[1]*x+transform[3]*y+transform[5]-target[j][1])<1e-7);
    });
  }
  assert.throws(()=>affine([[0,0],[1,1],[2,2]],[[0,0],[1,1],[2,2]]),RangeError);
});
test("open paper fits desktop, portrait and short landscape viewports",()=>{
  for(const [width,height] of [[1440,900],[390,844],[844,390],[320,480],[736,668]]){
    const rect={left:12,top:height-174,width:200,height:200*560/720};
    const placement=heartPlacement(rect,{width,height});
    const cx=rect.left+rect.width/2+placement.x,cy=rect.top+rect.height/2+placement.y;
    const w=rect.width*placement.scale,h=rect.height*placement.scale;
    assert.ok(cx-w/2>=15.99&&cx+w/2<=width-15.99);
    assert.ok(cy-h/2>=23.99&&cy+h/2<=height-23.99);
  }
});
test("message fitting preserves preferred size or shrinks to a readable floor",()=>{
  assert.ok(largestFittingFont(14,22,size=>size<=22)>21.8);
  assert.ok(Math.abs(largestFittingFont(14,22,size=>size<=17)-17)<0.15);
  assert.equal(largestFittingFont(14,22,()=>false),14);
  assert.equal(smooth(-1),0);assert.equal(smooth(2),1);
});
test("all paper assets share a transparent canvas and a stable lower anchor",async()=>{
  assert.equal(HEART_FRAMES.length,9);
  for(const src of HEART_FRAMES){
    const bytes=await readFile(`public${src}`);
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,720);assert.equal(info.height,560);assert.equal(info.channels,4);
    assert.equal(data[3],0);assert.equal(data[(719*4)+3],0);
    let lowest=0,opaque=0;
    for(let y=0;y<560;y++)for(let x=0;x<720;x++)if(data[(y*720+x)*4+3]>200){lowest=Math.max(lowest,y);opaque++;}
    assert.ok(lowest>=505&&lowest<=515,`${src}: ${lowest}`);
    assert.ok(opaque>60000&&opaque<260000);
  }
});


test("the opening touch cannot immediately close the newly mounted paper",()=>{
  const activation=createPaperActivation();
  assert.equal(activation.click(1),false,"Ignore the compatibility click from the gallery tap");
  activation.pointerDown(0);
  assert.equal(activation.click(1),true,"A new tap on the paper can close it");
  assert.equal(activation.click(1),false,"A tap can only activate once");
});

test("cancelled gestures and secondary buttons do not activate paper",()=>{
  const activation=createPaperActivation();
  activation.pointerDown(0);
  activation.cancel();
  assert.equal(activation.click(1),false);
  activation.pointerDown(2);
  assert.equal(activation.click(1),false);
  activation.pointerDown(0);
  assert.equal(activation.click(1),true,"The next real tap still works");
});

test("keyboard and assistive activation remain available without a pointer press",()=>{
  const activation=createPaperActivation();
  assert.equal(activation.click(0),true);
  assert.equal(activation.click(0),true);
  activation.pointerDown(0);
  assert.equal(activation.click(0),true);
  assert.equal(activation.click(1),false,"Keyboard activation also consumes any prior press");
});
