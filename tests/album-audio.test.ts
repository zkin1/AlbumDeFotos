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
  volumes:number[]=[];
  constructor(readonly options:HowlOptions){}
  state(){return this.status;}
  playing(){return this.active;}
  play(){this.active=true;return ++this.plays;}
  stop(){this.active=false;}
  volume(value:number){this.volumes.push(value);}
  unload(){this.unloaded=true;this.active=false;}
  loaded(){this.status="loaded";this.options.onload?.(0);}
}
function setup(){
  const sounds:FakeSound[]=[];
  const audio=createAlbumAudio(options=>{const sound=new FakeSound(options);sounds.push(sound);return sound;});
  return {audio,sounds};
}
const gesture={isTrusted:true};

test("no sound is created or played before a real user gesture",()=>{
  const {audio,sounds}=setup();
  audio.motion(1);audio.paper(true);audio.unlock({isTrusted:false});
  assert.equal(sounds.length,0);
  audio.unlock(gesture);
  assert.equal(sounds.length,2);
  for(const sound of sounds){
    assert.equal(sound.options.autoplay,false);
    assert.ok(sound.options.volume!<=.14);
    sound.loaded();
    assert.equal(sound.plays,0,"Earlier automatic requests must never play after unlocking");
  }
});

test("sphere movement stays quiet and never stacks multiple copies",()=>{
  const {audio,sounds}=setup();audio.unlock(gesture);sounds.forEach(sound=>sound.loaded());
  const glide=sounds[0];
  audio.motion(0);assert.equal(glide.plays,0);
  audio.motion(.01);audio.motion(1);
  assert.equal(glide.plays,1);
  assert.ok(glide.volumes.every(value=>value<=.08));
  glide.active=false;
  audio.motion(1);
  assert.equal(glide.plays,2);
  assert.equal(glide.volumes.at(-1),.08);
});

test("paper plays on opening and cancels a late load when closed",()=>{
  const {audio,sounds}=setup();audio.unlock(gesture);
  const [glide,paper]=sounds;
  audio.paper(true);audio.paper(false);paper.loaded();
  assert.equal(paper.plays,0);
  glide.loaded();audio.motion(.1);assert.equal(glide.active,true);
  audio.paper(true);
  assert.equal(paper.plays,1);assert.equal(glide.active,false);
  audio.motion(1);assert.equal(glide.plays,1,"Paper and movement do not overlap");
  audio.paper(false);assert.equal(paper.active,false);
  audio.paper(true);assert.equal(paper.plays,2);
});

test("hiding the page stops playback and requires another gesture; disposal releases sounds",()=>{
  const {audio,sounds}=setup();audio.unlock(gesture);sounds.forEach(sound=>sound.loaded());
  audio.paper(true);audio.suspend();
  assert.ok(sounds.every(sound=>!sound.playing()));
  audio.motion(1);audio.paper(true);
  assert.equal(sounds[0].plays,0);assert.equal(sounds[1].plays,1);
  audio.unlock(gesture);audio.motion(.1);assert.equal(sounds[0].plays,1);
  audio.destroy();assert.ok(sounds.every(sound=>sound.unloaded));
  audio.unlock(gesture);audio.motion(1);audio.paper(true);
  assert.equal(sounds.length,2);assert.equal(sounds[1].plays,1);
});

test("local paper sounds are short mono PCM with soft levels and click-free edges",async()=>{
  for(const [name,duration] of [["sphere-glide",.36],["paper-open",1.08]] as const){
    const bytes=await readFile(`public/audio/${name}.wav`);
    assert.equal(bytes.toString("ascii",0,4),"RIFF");
    assert.equal(bytes.toString("ascii",8,12),"WAVE");
    assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),22050);assert.equal(bytes.readUInt16LE(34),16);
    const count=bytes.readUInt32LE(40)/2;
    assert.ok(Math.abs(count/22050-duration)<.001);
    let square=0,peak=0;
    for(let i=0;i<count;i++){const value=bytes.readInt16LE(44+i*2)/32768;square+=value*value;peak=Math.max(peak,Math.abs(value));}
    assert.ok(peak<=.65);assert.ok(Math.sqrt(square/count)<.15);
    assert.equal(bytes.readInt16LE(44),0);assert.equal(bytes.readInt16LE(bytes.length-2),0);
  }
});
