import { Howl, Howler, type HowlOptions } from "howler";

type Sound = {
  state(): "unloaded"|"loading"|"loaded";
  playing(): boolean;
  play(): number;
  stop(): unknown;
  volume(value: number): unknown;
  unload(): unknown;
};

export function createAlbumAudio(makeSound: (options: HowlOptions) => Sound = options => new Howl(options)) {
  let enabled=false, disposed=false, paperRequested=false;
  let glide:Sound|undefined, paper:Sound|undefined;
  const playPaper=()=>{
    if(!enabled||!paperRequested||paper?.state()!=="loaded")return;
    paperRequested=false;
    glide?.stop();paper.stop();paper.play();
  };
  const suspend=()=>{enabled=false;paperRequested=false;glide?.stop();paper?.stop();};
  return {
    unlock(event: Pick<Event,"isTrusted">) {
      if(disposed||!event.isTrusted)return;
      enabled=true;
      if(!glide){
        glide=makeSound({src:["/audio/sphere-glide.wav"],autoplay:false,volume:.08,pool:1});
        paper=makeSound({src:["/audio/paper-open.wav"],autoplay:false,volume:.14,pool:1,onload:playPaper});
      }
      void Howler.ctx?.resume().catch(()=>{});
    },
    motion(speed:number) {
      if(!enabled||speed<.0008||!glide||glide.state()!=="loaded"||glide.playing()||paperRequested||paper?.playing())return;
      glide.volume(Math.min(.08,.03+speed*.8));
      glide.play();
    },
    paper(open:boolean) {
      paperRequested=open&&enabled;
      if(!paperRequested){paper?.stop();return;}
      playPaper();
    },
    suspend,
    destroy(){suspend();disposed=true;glide?.unload();paper?.unload();},
  };
}
