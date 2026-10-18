import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { HowlOptions } from "howler";
import { createAlbumAudio } from "../src/lib/album-audio";

class FakeSound {
  status:"loading"|"loaded"="loading";
  active=false;
  plays=0;
  unloaded=false;
  constructor(readonly options:HowlOptions){}
  state(){return this.status;}
  play(){this.active=true;return ++this.plays;}
  stop(){this.active=false;}
  unload(){this.unloaded=true;this.active=false;}
  loaded(){this.status="loaded";this.options.onload?.(0);}
}
function setup(){
  const sounds:FakeSound[]=[];
  const audio=createAlbumAudio(options=>{const sound=new FakeSound(options);sounds.push(sound);return sound;});
  return {audio,sounds};
}
const gesture={isTrusted:true};

test("only paper is loaded after a real gesture, and interaction alone stays silent",()=>{
  const {audio,sounds}=setup();
  audio.paper(true);audio.unlock({isTrusted:false});
  assert.equal(sounds.length,0);
  audio.unlock(gesture);audio.unlock(gesture);
  assert.equal(sounds.length,1);
  const paper=sounds[0];
  assert.deepEqual(paper.options.src,["/audio/paper-open.wav"]);
  assert.equal(paper.options.autoplay,false);
  assert.equal(paper.options.volume,.14);
  paper.loaded();
  audio.unlock(gesture);
  assert.equal(sounds.length,1);
  assert.equal(paper.plays,0,"Gestures and earlier automatic requests must never trigger playback");
});

test("paper plays on opening and cancels a late load when closed",()=>{
  const {audio,sounds}=setup();audio.unlock(gesture);
  const paper=sounds[0];
  audio.paper(true);audio.paper(false);paper.loaded();
  assert.equal(paper.plays,0);
  audio.paper(true);
  assert.equal(paper.plays,1);assert.equal(paper.active,true);
  audio.paper(false);assert.equal(paper.active,false);
  audio.paper(true);assert.equal(paper.plays,2);
});

test("hiding the page stops playback and requires another gesture; disposal releases paper",()=>{
  const {audio,sounds}=setup();audio.unlock(gesture);sounds[0].loaded();
  const paper=sounds[0];
  audio.paper(true);audio.suspend();
  assert.equal(paper.active,false);
  audio.paper(true);
  assert.equal(paper.plays,1);
  audio.unlock(gesture);audio.paper(true);assert.equal(paper.plays,2);
  audio.destroy();assert.equal(paper.unloaded,true);assert.equal(paper.active,false);
  audio.unlock(gesture);audio.paper(true);
  assert.equal(sounds.length,1);assert.equal(paper.plays,2);
});

test("local paper sound is short mono PCM with soft levels and click-free edges",async()=>{
  const bytes=await readFile("public/audio/paper-open.wav");
  assert.equal(bytes.toString("ascii",0,4),"RIFF");
  assert.equal(bytes.toString("ascii",8,12),"WAVE");
  assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),22050);assert.equal(bytes.readUInt16LE(34),16);
  const count=bytes.readUInt32LE(40)/2;
  assert.ok(Math.abs(count/22050-1.08)<.001);
  let square=0,peak=0;
  for(let i=0;i<count;i++){const value=bytes.readInt16LE(44+i*2)/32768;square+=value*value;peak=Math.max(peak,Math.abs(value));}
  assert.ok(peak<=.65);assert.ok(Math.sqrt(square/count)<.15);
  assert.equal(bytes.readInt16LE(44),0);assert.equal(bytes.readInt16LE(bytes.length-2),0);
});
