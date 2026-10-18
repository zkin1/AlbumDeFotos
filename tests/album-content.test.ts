import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { withAlbumHearts, paperContains, type AlbumItem } from "../src/lib/album-content";
import { images, INITIAL_PHOTO_COUNT } from "../src/config/images";
import { heartMessages } from "../src/config/heart-messages";
import { createAlbum, rotateAlbum, shuffle, type AlbumState } from "../src/lib/album";
import { readFile } from "node:fs/promises";
import { OrigamiHeart } from "../src/components/OrigamiHeart";

test("four paper hearts replace four of the eighteen slots, preserving the fourteen photos",()=>{
  const photos=Object.freeze(images.slice(0,INITIAL_PHOTO_COUNT));
  const mixed=withAlbumHearts([...photos]);
  assert.equal(mixed.length,18);
  assert.equal(mixed.filter(item=>item.heartIndex!==undefined).length,4);
  assert.deepEqual(mixed.filter(item=>item.heartIndex===undefined),photos);
  assert.equal(new Set(mixed.map(item=>item.id)).size,18);
  assert.deepEqual(mixed.filter(item=>item.heartIndex!==undefined).map(item=>item.heartIndex).sort(),[0,1,2,3]);
  assert.equal(new Set(heartMessages).size,4);
  const next=withAlbumHearts(images.slice(14,28));
  assert.deepEqual(next.filter(item=>item.heartIndex!==undefined),mixed.filter(item=>item.heartIndex!==undefined));
});
test("transparent space around a paper heart never intercepts a photo click",()=>{
  assert.equal(paperContains(.5,.6),true);
  assert.equal(paperContains(.4,.45),true);
  for(const [x,y] of [[0,0],[1,1],[.5,.3],[.2,.7],[.9,.4]])assert.equal(paperContains(x,y),false);
});
test("paper renders a semantic control and freely editable, safely escaped HTML text",()=>{
  const message="Hay cosas que no necesitan\nexplicarse.\n\nY tú eres una de ellas. <script>hola</script>";
  const html=renderToStaticMarkup(createElement(OrigamiHeart,{message,textAlign:"left",fontFamily:"Georgia",fontSize:24}));
  assert.match(html,/<button[^>]*type="button"/);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/aria-controls="[^"]+"/);
  assert.match(html,/aria-hidden="true"[^>]*inert=""/);
  assert.match(html,/Hay cosas que no necesitan\nexplicarse/);
  assert.match(html,/&lt;script&gt;hola&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  const open=renderToStaticMarkup(createElement(OrigamiHeart,{message:"Una frase diferente",defaultOpen:true}));
  assert.match(open,/aria-expanded="true"/);
  assert.match(open,/Una frase diferente/);
});

test("joint shuffling moves all four messages through every slot while photos keep cycling",()=>{
  let seed=2026;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  let album:AlbumState<AlbumItem>=createAlbum(images,INITIAL_PHOTO_COUNT,random);
  album.visible=shuffle(withAlbumHearts(album.visible),random);
  const slots=new Map([0,1,2,3].map(index=>[index,new Set<number>()]));
  const seen=new Set<string>();
  const photoIds=new Set(images.map(photo=>photo.id));
  for(let round=0;round<128;round++){
    assert.equal(album.visible.length,18);
    assert.equal(new Set(album.visible.map(item=>item.id)).size,18);
    const photos=album.visible.filter(item=>item.heartIndex===undefined);
    assert.equal(photos.length,14);
    photos.forEach(photo=>seen.add(photo.id));
    const hearts=album.visible.filter(item=>item.heartIndex!==undefined);
    assert.deepEqual(hearts.map(item=>item.heartIndex).sort(),[0,1,2,3]);
    album.visible.forEach((item,index)=>{if(item.heartIndex!==undefined){
      assert.equal(item.id,`paper-heart-${item.heartIndex}`);
      slots.get(item.heartIndex)!.add(index);
    }});
    assert.ok(album.remaining.every(photo=>photoIds.has(photo.id)),"Hearts never enter the photo deck");
    const previous=new Set(photos.map(photo=>photo.id));
    const next=rotateAlbum(album,images,INITIAL_PHOTO_COUNT,random);
    assert.ok(next.visible.every(photo=>!previous.has(photo.id)),"No repeated photo in adjacent batches");
    next.visible=shuffle(withAlbumHearts(next.visible),random);
    album=next;
  }
  assert.equal(seen.size,images.length);
  for(const positions of slots.values())assert.equal(positions.size,18,"Every heart can occupy every sphere slot");
});

test("the self-contained tab icon embeds the original paper heart without reducing its resolution",async()=>{
  const svg=await readFile("src/app/icon.svg","utf8");
  const embedded=svg.match(/href="data:image\/webp;base64,([^"]+)"/);
  assert.ok(embedded);
  assert.deepEqual(Buffer.from(embedded[1],"base64"),await readFile("public/origami/heart-1.webp"));
  assert.match(svg,/viewBox="154 130 416 416"/);
  assert.doesNotMatch(svg,/<rect|<path/);
});
