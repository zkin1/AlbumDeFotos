import { Howl, Howler, type HowlOptions } from "howler";

type Sound = {
  state(): "unloaded"|"loading"|"loaded";
  play(): number;
  stop(): unknown;
  unload(): unknown;
};

export function createAlbumAudio(makeSound: (options: HowlOptions) => Sound = options => new Howl(options)) {
  let enabled=false, disposed=false, paperRequested=false;
  let paper:Sound|undefined;
  const playPaper=()=>{
    if(!enabled||!paperRequested||paper?.state()!=="loaded")return;
    paperRequested=false;
    paper.stop();paper.play();
  };
  const suspend=()=>{enabled=false;paperRequested=false;paper?.stop();};
  return {
    unlock(event: Pick<Event,"isTrusted">) {
      if(disposed||!event.isTrusted)return;
      enabled=true;
      if(!paper){
        paper=makeSound({src:["/audio/paper-open.wav"],autoplay:false,volume:.14,pool:1,onload:playPaper});
      }
      void Howler.ctx?.resume().catch(()=>{});
    },
    paper(open:boolean) {
      paperRequested=open&&enabled;
      if(!paperRequested){paper?.stop();return;}
      playPaper();
    },
    suspend,
    destroy(){suspend();disposed=true;paper?.unload();},
  };
}
