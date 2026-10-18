import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { withAlbumHearts, paperContains } from "../src/lib/album-content";
import { images, INITIAL_PHOTO_COUNT } from "../src/config/images";
import { heartMessages } from "../src/config/heart-messages";
import { OrigamiHeart } from "../src/components/OrigamiHeart";

test("four paper hearts replace four of the eighteen slots, preserving the fourteen photos",()=>{
  const photos=Object.freeze(images.slice(0,INITIAL_PHOTO_COUNT));
  const mixed=withAlbumHearts([...photos]);
  assert.equal(mixed.length,18);
  assert.equal(mixed.filter(item=>item.heartIndex!==undefined).length,4);
  assert.deepEqual(mixed.filter(item=>item.heartIndex===undefined),photos);
  assert.equal(new Set(mixed.map(item=>item.id)).size,18);
  assert.deepEqual(mixed.flatMap((item,i)=>item.heartIndex===undefined?[]:[i]),[2,6,11,16]);
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
