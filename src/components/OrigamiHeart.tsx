"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { createPaperActivation, drawPaper, HEART_FRAMES, heartPlacement, largestFittingFont, PAPER_HEIGHT, PAPER_WIDTH, preloadPaper, smooth } from "@/lib/origami";
const styles={root:"origami-root",stage:"origami-stage",float:"origami-float",button:"origami-button",paper:"origami-paper",canvas:"origami-canvas",fallback:"origami-fallback",messageStage:"origami-message-stage",message:"origami-message",readHint:"origami-readHint",hint:"origami-hint"};

export interface OrigamiHeartProps {
  message: string;
  size?: number;
  floating?: boolean;
  floatIntensity?: number;
  openDuration?: number;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  textAlign?: "left" | "center" | "right";
  className?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  hint?: string;
  onOpen?: () => void;
  onClose?: () => void;
}

export function OrigamiHeart({
  message, size=200, floating=true, floatIntensity=1, openDuration=1.4,
  fontFamily='Georgia, "Times New Roman", serif', fontSize=22, textColor="#302c29",
  textAlign="center", className="", defaultOpen=false, open:controlledOpen, onOpenChange, label="mensaje de papel", hint="para ti", onOpen, onClose,
}: OrigamiHeartProps) {
  const id=useId();
  const rootRef=useRef<HTMLDivElement>(null);
  const stageRef=useRef<HTMLDivElement>(null);
  const floatRef=useRef<HTMLDivElement>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const messageStageRef=useRef<HTMLDivElement>(null);
  const textRef=useRef<HTMLDivElement>(null);
  const paragraphRef=useRef<HTMLParagraphElement>(null);
  const animation=useRef<gsap.core.Timeline | null>(null);
  const activation=useRef(createPaperActivation());
  const target=useRef(controlledOpen??defaultOpen);
  const progressRef=useRef(defaultOpen?1:0);
  const callbacks=useRef({onOpen,onClose,onOpenChange});
  callbacks.current={onOpen,onClose,onOpenChange};
  const layoutRef=useRef<()=>void>(()=>{});
  const [open,setOpen]=useState(controlledOpen??defaultOpen);
  const [readable,setReadable]=useState(false);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState(false);
  const [overflow,setOverflow]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const safeSize=Number.isFinite(size)?Math.max(32,Math.min(600,size)):200;
  const safeFont=Number.isFinite(fontSize)?Math.max(14,fontSize):22;

  useEffect(()=>{
    const root=rootRef.current!,stage=stageRef.current!,float=floatRef.current!,canvas=canvasRef.current!,messageStage=messageStageRef.current!,text=textRef.current!;
    const context=canvas.getContext("2d");
    if(!context){setError(true);return;}
    let disposed=false;
    let frames:HTMLImageElement[]=[];
    let placement={scale:1,x:0,y:0};
    let reading=false;
    const resumeProgress=progressRef.current;
    const state={progress:0};
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");

    const floatAnimation=gsap.timeline({paused:true,repeat:-1})
      .to(float,{y:-3*floatIntensity,rotation:-1.5*floatIntensity,duration:3.7,ease:"sine.inOut"})
      .to(float,{y:2*floatIntensity,rotation:0.8*floatIntensity,duration:4.3,ease:"sine.inOut"})
      .to(float,{y:0,rotation:0,duration:3.9,ease:"sine.inOut"});
    const startFloating=()=>{if(floating&&!media.matches&&!target.current&&!document.hidden)floatAnimation.restart();};
    const stopFloating=()=>{
      floatAnimation.pause();
      gsap.to(float,{y:0,rotation:0,duration:media.matches?0:0.35,overwrite:true,ease:"sine.out"});
    };
    const render=()=>{
      if(disposed)return;
      progressRef.current=state.progress;
      const movement=smooth(state.progress/0.82);
      gsap.set(stage,{x:placement.x*movement,y:placement.y*movement,scale:1+(placement.scale-1)*movement});
      if(frames.length)drawPaper(context,frames,movement);
      const opacity=smooth((state.progress-0.78)/0.22);
      gsap.set(text,{autoAlpha:opacity,y:(1-opacity)*3});
      const canRead=state.progress>0.98;
      if(canRead!==reading){reading=canRead;setReadable(canRead);}
    };
    const layout=()=>{
      if(disposed || !paragraphRef.current || !root.isConnected)return;
      const rect=root.getBoundingClientRect();
      placement=heartPlacement(rect,{width:window.innerWidth,height:window.innerHeight});
      // Keep HTML text at native CSS pixels, outside the scaled and filtered paper.
      const width=rect.width*placement.scale, height=rect.height*placement.scale;
      gsap.set(messageStage,{left:(rect.width-width)/2+placement.x,top:(rect.height-height)/2+placement.y,width,height});
      const paragraph=paragraphRef.current!;
      text.style.overflow="hidden";
      const max=safeFont, min=Math.min(safeFont,14);
      const chosen=largestFittingFont(min,max,value=>{
        paragraph.style.fontSize=`${value}px`;
        return paragraph.scrollHeight<=text.clientHeight+0.25 && paragraph.scrollWidth<=text.clientWidth+0.25;
      });
      paragraph.style.fontSize=`${chosen}px`;
      const overflowing=paragraph.scrollHeight>text.clientHeight+1;
      text.style.overflow=overflowing?"auto":"hidden";
      setOverflow(overflowing);
      render();
    };
    layoutRef.current=layout;
    const duration=Number.isFinite(openDuration)?Math.max(0.2,openDuration):1.4;
    const timeline=gsap.timeline({paused:true,
      onComplete:()=>{if(!disposed&&target.current)callbacks.current.onOpen?.();},
      onReverseComplete:()=>{if(!disposed&&!target.current){startFloating();callbacks.current.onClose?.();}},
    }).to(state,{progress:1,duration,ease:"none",onUpdate:render});
    animation.current=timeline;
    setReady(false);setError(false);
    preloadPaper().then(loaded=>{
      if(disposed)return;
      frames=loaded;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(PAPER_WIDTH*ratio);canvas.height=Math.round(PAPER_HEIGHT*ratio);
      context.setTransform(ratio,0,0,ratio,0,0);
      timeline.progress(resumeProgress).pause();
      layout();
      if(media.matches)timeline.progress(target.current?1:0).pause();
      else if(target.current)timeline.play();else if(resumeProgress>0)timeline.reverse();
      render();setReady(true);startFloating();
    }).catch(cause=>{if(!disposed){console.error("No se pudo cargar el papel:",cause);setError(true);}});
    const observer=new ResizeObserver(layout);
    observer.observe(root);observer.observe(text);
    window.addEventListener("resize",layout);
    const visibility=()=>{if(document.hidden)floatAnimation.pause();else startFloating();};
    const preference=()=>{
      if(media.matches){stopFloating();timeline.progress(target.current?1:0).pause();render();}
      else startFloating();
    };
    document.addEventListener("visibilitychange",visibility);
    media.addEventListener("change",preference);
    const escape=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&target.current)animateTo(false);
    };
    window.addEventListener("keydown",escape);
    const beforeToggle=()=>{stopFloating();};
    root.addEventListener("origami-toggle",beforeToggle);
    return()=>{
      disposed=true;animation.current=null;layoutRef.current=()=>{};
      timeline.kill();floatAnimation.kill();gsap.killTweensOf(float);gsap.killTweensOf(stage);gsap.killTweensOf(text);
      observer.disconnect();
      window.removeEventListener("resize",layout);window.removeEventListener("keydown",escape);
      document.removeEventListener("visibilitychange",visibility);media.removeEventListener("change",preference);
      root.removeEventListener("origami-toggle",beforeToggle);
    };
  },[safeSize,safeFont,floatIntensity,floating,openDuration,attempt]);

  useEffect(()=>{layoutRef.current();},[message,fontFamily,textAlign]);

  function animateTo(next:boolean,notify=true) {
    if(next===target.current)return;
    target.current=next;setOpen(next);setReadable(false);
    rootRef.current?.dispatchEvent(new Event("origami-toggle"));
    if(notify)callbacks.current.onOpenChange?.(next);
    layoutRef.current();
    const timeline=animation.current;
    if(!timeline)return;
    if(!next&&timeline.progress()===0){callbacks.current.onClose?.();return;}
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)timeline.progress(next?1:0).pause();
    else if(next)timeline.play();else timeline.reverse();
  }
  useEffect(()=>{
    if(controlledOpen!==undefined)animateTo(controlledOpen,false);
  },[controlledOpen]);
  const toggle=()=>{
    if(error){setAttempt(value=>value+1);return;}
    animateTo(!target.current);
  };
  const style={width:safeSize,"--paper-font":fontFamily,"--paper-color":textColor,"--paper-align":textAlign} as CSSProperties;
  return <div ref={rootRef} className={`${styles.root} ${className}`} style={style} data-open={open} data-ready={ready}>
    <div ref={stageRef} className={styles.stage}>
      <div ref={floatRef} className={styles.float}>
        <button type="button" className={styles.button} onClick={event=>{if(activation.current.click(event.detail))toggle();}} disabled={!ready&&!error}
          onPointerDown={event=>{event.stopPropagation();activation.current.pointerDown(event.button);}}
          onPointerCancel={()=>activation.current.cancel()} onBlur={()=>activation.current.cancel()} aria-expanded={open} aria-controls={id}
          aria-label={error?"Reintentar cargar el corazón":open?`Cerrar ${label}`:`Abrir ${label}`}>
          <span className={styles.paper} data-ready={ready}>
            <img className={styles.fallback} src={HEART_FRAMES[0]} width={PAPER_WIDTH} height={PAPER_HEIGHT} alt="" draggable={false} />
            <canvas ref={canvasRef} className={styles.canvas} width={PAPER_WIDTH} height={PAPER_HEIGHT} aria-hidden="true" />
          </span>
        </button>
      </div>
    </div>
    <div ref={messageStageRef} className={styles.messageStage}>
      <div ref={textRef} id={id} className={styles.message} aria-hidden={!readable}
        inert={!readable} tabIndex={readable&&overflow?0:undefined} role={overflow?"region":undefined}
        aria-label={overflow?"Mensaje. Desplázate para seguir leyendo.":undefined}>
        <p ref={paragraphRef}>{message}</p>
      </div>
      {readable&&overflow&&<span className={styles.readHint} aria-hidden="true">Desliza para leer ↓</span>}
    </div>
    <span className={styles.hint} aria-hidden="true" data-hidden={open}>{error?"Reintentar":hint}</span>
    {error&&<span className="sr-only" role="status">No se pudo cargar el corazón. Pulsa para reintentar.</span>}
  </div>;
}
