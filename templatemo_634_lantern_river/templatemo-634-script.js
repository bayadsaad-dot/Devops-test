/*
  Lantern River Template
  https://templatemo.com/tm-634-lantern-river
*/

(function(){
'use strict';
// Lantern River // vanilla JS + Three.js r128

const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.prototype.slice.call((r||document).querySelectorAll(s));
const mqRM=matchMedia('(prefers-reduced-motion: reduce)');
let RM=mqRM.matches;
if(mqRM.addEventListener) mqRM.addEventListener('change',e=>{RM=e.matches;});
const COARSE=matchMedia('(pointer: coarse)').matches;
const isSmall=()=>innerWidth<=820;
const LOWQ=COARSE||innerWidth<820||(navigator.hardwareConcurrency||8)<=4;
const store={
  get(k){try{return localStorage.getItem(k);}catch(e){return null;}},
  set(k,v){try{localStorage.setItem(k,v);}catch(e){}}
};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
let _seed=661;
const rnd=()=>{_seed=(_seed*16807)%2147483647;return (_seed-1)/2147483646;};
const rr=(a,b)=>a+(b-a)*rnd();
const pick=a=>a[(rnd()*a.length)|0];
if(COARSE) document.body.classList.add('touch');

// toast
const toastEl=$('#toast'), toastText=$('#toastText');
let toastTimer=0;
function toast(msg,bad){
  toastText.textContent=msg;
  toastEl.classList.toggle('bad',!!bad);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toastEl.classList.remove('show'),3800);
}

// ---------------------------------------------------------------
// Sound: on by default, armed by a real gesture, one master level
// ---------------------------------------------------------------
const Sound=(function(){
  const LEVEL=2.25;
  const btn=$('#sndBtn');
  const saved=store.get('toro661-sound');
  let ctx=null,master=null,bus=null,mode=saved==='off'?'off':saved==='b'?'b':saved==='c'?'c':'a',enabled=mode!=='off',armed=false;
  const MODE_NAME={a:'River song',b:'Flute and bells',c:'Zither night',off:'Off'};
  let nextBell=0,nextFlute=0,fluteIdx=4,nextZ=0,nextPad=0,zIdx=4;
  let nextNote=0,nextDrop=0,nextDrone=0,droneNodes=null,phraseIdx=4,lastTry=0;
  const SCALE=[146.83,164.81,185.00,220.00,246.94,293.66,329.63,369.99,440.00,493.88,587.33];
  function paint(){
    btn.classList.toggle('off',!enabled);
    btn.classList.toggle('on',enabled&&armed);
    btn.classList.toggle('pending',enabled&&!armed);
    btn.dataset.mode=mode==='c'?'3':mode==='b'?'2':mode==='a'?'1':'';
    const lab=!enabled?'Sound off, click for River song':(armed?'Sound: ':'Sound: ')+MODE_NAME[mode]+(armed?'':', click once to wake it')+(mode==='a'?'. Click for Flute and bells':mode==='b'?'. Click for Zither night':'. Click to mute');
    btn.setAttribute('aria-label',lab);btn.title=lab;
  }
  function impulse(sec,decay){
    const rate=ctx.sampleRate,len=(rate*sec)|0,b=ctx.createBuffer(2,len,rate);
    for(let ch=0;ch<2;ch++){
      const d=b.getChannelData(ch);let y=0,e=0;
      for(let i=0;i<len;i++){
        const t=i/len,att=i<rate*.015?i/(rate*.015):1;
        const x=(Math.random()*2-1)*Math.pow(1-t,decay)*att;
        y+=(x-y)*.32;d[i]=y;e+=y*y;
      }
      const s=1/Math.sqrt(e||1);
      for(let i=0;i<len;i++) d[i]*=s;
    }
    return b;
  }
  function build(){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return false;
    try{ctx=new AC();}catch(e){return false;}
    master=ctx.createGain();master.gain.value=enabled?1.35:0;
    const shaper=ctx.createWaveShaper(),n=2048,c=new Float32Array(n);
    for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(x*1.12)/Math.tanh(1.12);}
    shaper.curve=c;shaper.oversample='2x';
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-16;comp.ratio.value=3;comp.knee.value=20;comp.attack.value=.01;comp.release.value=.3;
    bus=ctx.createGain();bus.gain.value=1;
    const conv=ctx.createConvolver();conv.normalize=false;conv.buffer=impulse(3.4,2.4);
    const wet=ctx.createGain();wet.gain.value=.5;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;lp.Q.value=.5;
    const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=130;hp.Q.value=.6;
    bus.connect(hp);hp.connect(lp);lp.connect(comp);lp.connect(conv);conv.connect(wet);wet.connect(comp);
    comp.connect(shaper);shaper.connect(master);master.connect(ctx.destination);
    return true;
  }
  function onRun(){
    if(armed) return;
    armed=true;paint();removeArm();
    nextNote=ctx.currentTime+1.2;nextDrop=ctx.currentTime+.6;nextDrone=ctx.currentTime+.1;nextBell=ctx.currentTime+2.5;nextFlute=ctx.currentTime+1.4;nextZ=ctx.currentTime+1.1;nextPad=ctx.currentTime+.2;
  }
  function tryArm(){
    if(!enabled) return;
    if(!ctx&&!build()) return;
    if(ctx.state==='running'){onRun();return;}
    const p=ctx.resume();
    if(p&&p.then) p.then(()=>{if(ctx.state==='running') onRun();}).catch(()=>{});
  }
  const EVS=['pointerdown','pointerup','click','keydown','touchstart','pointermove','wheel'];
  function armer(){const t=performance.now();if(t-lastTry<250) return;lastTry=t;tryArm();}
  function addArm(){EVS.forEach(e=>window.addEventListener(e,armer,{capture:true,passive:true}));}
  function removeArm(){EVS.forEach(e=>window.removeEventListener(e,armer,{capture:true}));}
  addArm();paint();
  btn.addEventListener('click',()=>{
    mode=mode==='a'?'b':mode==='b'?'c':mode==='c'?'off':'a';enabled=mode!=='off';store.set('toro661-sound',mode);
    if(ctx){const t=ctx.currentTime;nextDrone=t+.4;nextNote=t+1.2;nextFlute=t+.9;nextBell=t+1.6;nextZ=t+.9;nextPad=t+.3;}
    if(enabled){tryArm();if(!armed) addArm();}
    if(master){const t=ctx.currentTime;master.gain.cancelScheduledValues(t);master.gain.setTargetAtTime(enabled?1.35:0,t,.08);}
    paint();
    if(enabled&&armed) setTimeout(()=>knock(.9),40);
  });
  const ok=()=>ctx&&armed&&enabled&&ctx.state==='running';

  // one oscillator, one envelope; optional pitch points
  function voice(o){
    const t0=ctx.currentTime+(o.delay||0);
    const osc=ctx.createOscillator(),g=ctx.createGain();
    osc.type=o.type||'sine';
    const f=o.freq;
    osc.frequency.setValueAtTime(f[0][1],t0);
    for(let i=1;i<f.length;i++) osc.frequency.linearRampToValueAtTime(f[i][1],t0+f[i][0]);
    const gp=o.gain;g.gain.setValueAtTime(0.0001,t0);
    for(let i=0;i<gp.length;i++){
      const v=Math.max(.0001,gp[i][1]*LEVEL);if(i===0&&gp[i][0]<.018) gp[i]=[.018,gp[i][1],gp[i][2]];
      if(gp[i][2]==='exp') g.gain.exponentialRampToValueAtTime(v,t0+gp[i][0]);
      else g.gain.linearRampToValueAtTime(v,t0+gp[i][0]);
    }
    let node=osc;
    if(o.lp){const l=ctx.createBiquadFilter();l.type='lowpass';l.frequency.value=o.lp;l.Q.value=.7;osc.connect(l);node=l;}
    if(o.vib){const lf=ctx.createOscillator(),lg=ctx.createGain();lf.frequency.value=o.vib[0];lg.gain.setValueAtTime(0,t0);lg.gain.linearRampToValueAtTime(o.vib[1],t0+(o.vib[2]||.5));lf.connect(lg);lg.connect(osc.frequency);lf.start(t0);lf.stop(t0+o.dur+.1);}
    node.connect(g);g.connect(o.dest||bus);
    osc.start(t0);osc.stop(t0+o.dur+.05);
  }
  // dan bau style pluck: a bend up into the note, then a slow vibrato
  function bau(fr,g,delay){
    const d=2.8;
    voice({freq:[[0,fr*.93],[.16,fr],[d,fr*.998]],gain:[[.025,g],[.5,g*.55],[d,.0001,'exp']],dur:d,delay,lp:1600,vib:[5.2,fr*.007,.7]});
    voice({freq:[[0,fr*1.86],[.16,fr*2]],gain:[[.02,g*.18],[1.2,.0001,'exp']],dur:1.3,delay,lp:1200});
  }
  function plop(fr,g){
    if(!ok()) return;
    voice({freq:[[0,fr],[.11,fr*.46],[.26,fr*.4]],gain:[[.012,g],[.26,.0001,'exp']],dur:.28});
    voice({freq:[[0,fr*2.3],[.08,fr*1.2]],gain:[[.012,g*.25],[.12,.0001,'exp']],dur:.14});
  }
  function knock(scale){
    if(!ok()) return;scale=scale||1;
    voice({freq:[[0,300*scale],[.14,262*scale]],gain:[[.012,.05],[.14,.0001,'exp']],dur:.16});
    voice({freq:[[0,300*2.76*scale],[.08,280*2.6*scale]],gain:[[.01,.012],[.09,.0001,'exp']],dur:.1});
  }
  function hover(){
    if(!ok()) return;
    voice({freq:[[0,660],[.1,628]],gain:[[.018,.008],[.11,.0001,'exp']],dur:.12});
  }
  // single breathing envelope that dips mid travel and swells once on arrival
  function unfold(){
    if(!ok()) return;
    voice({freq:[[0,329.63],[.5,392]],gain:[[.06,.03],[.28,.012],[.5,.05],[1.6,.0001,'exp']],dur:1.62,lp:1400});
    voice({freq:[[0,164.81],[.5,196]],gain:[[.06,.022],[.28,.01],[.5,.035],[1.6,.0001,'exp']],dur:1.62,lp:900});
  }
  function glide(dir){
    if(!ok()) return;
    const a=dir>0?293.66:329.63,b=dir>0?329.63:293.66;
    voice({freq:[[0,a],[.3,b]],gain:[[.04,.022],[.18,.012],[.32,.026],[.9,.0001,'exp']],dur:.92,lp:1300});
  }
  function bloop(){
    if(!ok()) return;
    voice({freq:[[0,196],[.55,246.94]],gain:[[.16,.03],[.5,.04],[1.8,.0001,'exp']],dur:1.85,lp:900});
    [293.66,369.99,440].forEach((f,i)=>voice({freq:[[0,f]],gain:[[.4,.008],[1.4,.006],[2.4,.0001,'exp']],dur:2.45,lp:1200,delay:i*.02}));
  }
  // firework: whistle rises, dips, then blooms into a chord, all one envelope per voice
  function firework(root){
    if(!ok()) return;root=root||392;
    voice({freq:[[0,240],[.7,560],[.78,root],[2.6,root*.995]],gain:[[.05,.012],[.65,.02],[.76,.008],[.95,.05],[2.6,.0001,'exp']],dur:2.65,lp:1100});
    [root*1.25,root*1.5,root*.5].forEach((f,i)=>voice({freq:[[0,f]],gain:[[.76,.0001],[1+i*.03,.03],[2.8,.0001,'exp']],dur:2.85,lp:1000}));
  }
  function distantBloom(){
    if(!ok()) return;
    const r=pick([293.66,329.63,369.99,440]);
    [r,r*1.5,r*.5].forEach(f=>voice({freq:[[0,f]],gain:[[.25,.012],[2.2,.0001,'exp']],dur:2.25,lp:700}));
  }
  function release(){
    if(!ok()) return;
    voice({freq:[[0,293.66],[2.4,587.33]],gain:[[.3,.04],[1.4,.05],[3.4,.0001,'exp']],dur:3.45,lp:1500});
    voice({freq:[[0,146.83],[2.4,293.66]],gain:[[.3,.03],[1.4,.035],[3.4,.0001,'exp']],dur:3.45,lp:800});
    voice({freq:[[0,440],[2.4,880]],gain:[[.5,.0001],[1.6,.014],[3.4,.0001,'exp']],dur:3.45,lp:1400});
  }
  // two paper lanterns bumping: a soft hollow tap, no noise
  function bump(v){
    if(!ok()) return;v=clamp(v,0,1);
    const f=rr(200,250)*(1+v*.15);
    voice({freq:[[0,f*1.4],[.12,f*1.25]],gain:[[.02,.006+.018*v],[.2,.0001,'exp']],dur:.22,lp:700});
  }
  // light passing from one lantern to another: one rising envelope with an octave under it
  function swap(fast){
    if(!ok()) return;
    const r=fast?659.25:587.33;
    voice({freq:[[0,r],[1.6,r*.999]],gain:[[.04,.034],[.5,.02],[1.7,.0001,'exp']],dur:1.75,lp:1500});
    voice({freq:[[0,r*1.5]],gain:[[.07,.009],[.9,.0001,'exp']],dur:.95,lp:1800});
    voice({freq:[[0,r/2]],gain:[[.05,.014],[1.3,.0001,'exp']],dur:1.35,lp:900});
  }
  function chime(bad){
    if(!ok()) return;
    if(bad){voice({freq:[[0,233],[.45,207]],gain:[[.02,.05],[.5,.0001,'exp']],dur:.52,lp:900});return;}
    voice({freq:[[0,587.33]],gain:[[.012,.05],[1.5,.0001,'exp']],dur:1.55});
    voice({freq:[[0,880]],gain:[[.012,.016],[.9,.0001,'exp']],dur:.95});
    voice({freq:[[0,293.66]],gain:[[.02,.025],[1.3,.0001,'exp']],dur:1.35});
  }
  // second bed: bamboo flute phrases over an open fifth, with a far temple bell now and then
  function flute(fr,g,delay,dur){
    dur=dur||rr(1.8,3.2);
    voice({freq:[[0,fr*.97],[.22,fr],[dur,fr*.996]],gain:[[.28,g],[dur*.55,g*.8],[dur,.0001,'exp']],dur,delay,lp:1900,vib:[5.4,fr*.009,.9]});
    voice({freq:[[0,fr*1.94],[.22,fr*2]],gain:[[.3,g*.12],[dur*.6,g*.06],[dur,.0001,'exp']],dur,delay,lp:1600});
  }
  function bell(f){
    [[1,.03,6],[2.76,.009,3.6],[5.4,.0035,2]].forEach(([m,g,d])=>voice({freq:[[0,f*m],[d,f*m*.998]],gain:[[.01,g],[d,.0001,'exp']],dur:d+.05,lp:2400}));
  }
  const FLUTE=[293.66,329.63,369.99,440,493.88,587.33,659.25,739.99,880];
  function tickB(t){
    if(t>=nextDrone){nextDrone=t+11;[220,329.63].forEach((f,i)=>voice({freq:[[0,f],[11.5,f*(1+.0015*(i?1:-1))]],gain:[[3.5,.011-.003*i],[8,.009-.003*i],[11.6,.0001]],dur:11.7,lp:420}));}
    if(t>=nextFlute){
      const n=pick([2,3,3,4]);let d=0;
      for(let k=0;k<n;k++){fluteIdx=clamp(fluteIdx+pick([-2,-1,1,1,2]),1,FLUTE.length-2);const dur=k===n-1?rr(2.4,3.4):rr(.7,1.3);flute(FLUTE[fluteIdx],.034,d,dur);d+=dur*.82;}
      nextFlute=t+d+rr(3.5,6.5);
    }
    if(t>=nextBell){bell(pick([392,440,349.23]));nextBell=t+rr(13,21);}
  }
  // third bed: dan tranh zither rolls in G pentatonic over a slow warm pad, with the same far water drops
  const ZITHER=[196,220,246.94,293.66,329.63,392,440,493.88,587.33,659.25];
  function zither(fr,g,delay){
    const d=rr(1.6,2.2);
    voice({freq:[[0,fr*1.004],[.06,fr],[d,fr*.999]],gain:[[.02,g],[.35,g*.42],[d,.0001,'exp']],dur:d,delay,lp:1800});
    voice({freq:[[0,fr*2]],gain:[[.02,g*.16],[.6,.0001,'exp']],dur:.65,delay,lp:1700});
  }
  function tickC(t){
    if(t>=nextPad){nextPad=t+12;[98*2,146.83*2,196*2*.75].forEach((f,i)=>voice({freq:[[0,f],[12.5,f*(1+.0012*(i-1))]],gain:[[4,.01-.0025*i],[8.5,.008-.002*i],[12.6,.0001]],dur:12.7,lp:460}));}
    if(t>=nextZ){
      let d=0;const roll=rnd()<.22;
      if(roll){const up=rnd()<.6,st=up?2:7;for(let k=0;k<6;k++){zither(ZITHER[clamp(st+(up?k:-k),0,ZITHER.length-1)],.016+.004*k*(up?1:.5),d);d+=.09;}d+=.6;}
      const n=pick([3,4,4,5]);
      for(let k=0;k<n;k++){zIdx=clamp(zIdx+pick([-2,-1,1,1,2]),1,ZITHER.length-2);const last=k===n-1;zither(ZITHER[zIdx],last?.04:.032,d);if(rnd()<.25&&!last) zither(ZITHER[zIdx]/2,.014,d);d+=last?0:rr(.28,.4);}
      nextZ=t+d+rr(4.5,7.5);
    }
  }
  // ambient bed: soft drone, sparse dan bau phrases, distant water drops
  function tick(){
    if(!ok()) return;
    const t=ctx.currentTime;
    if(t>=nextDrop){plop(rr(330,520),rr(.014,.026));nextDrop=t+rr(1.4,3.6);}
    if(mode==='b'){tickB(t);return;}
    if(mode==='c'){tickC(t);return;}
    if(t>=nextDrone){
      nextDrone=t+9;
      [146.83,220,293.66].forEach((f,i)=>voice({freq:[[0,f],[9.5,f*(1+.002*(i-1))]],gain:[[3,.012-.003*i],[6.5,.01-.003*i],[9.6,.0001]],dur:9.7,lp:500}));
    }
    if(t>=nextNote){
      phraseIdx=clamp(phraseIdx+pick([-2,-1,-1,1,1,2,0]),2,SCALE.length-1);
      bau(SCALE[phraseIdx],.05,0);
      if(rnd()<.45){const j=clamp(phraseIdx+pick([-1,1,2]),2,SCALE.length-1);bau(SCALE[j],.038,.62);phraseIdx=j;}
      nextNote=t+rr(3.8,7);
    }
  }
  return {plop,knock,hover,unfold,glide,bloop,firework,distantBloom,release,chime,swap,bump,tick,ok};
})();

// ---------------------------------------------------------------
// canvas texture helpers
// ---------------------------------------------------------------
function cnv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function noiseFill(g,w,h,alpha,count,size,colors){
  for(let i=0;i<count;i++){
    g.fillStyle=colors?pick(colors):'rgba(0,0,0,'+alpha*rnd()+')';
    const s=size*rr(.4,1.6);g.fillRect(rnd()*w,rnd()*h,s,s);
  }
}

// ---------------------------------------------------------------
// Scene
// ---------------------------------------------------------------
function initScene(onProgress){
  if(!window.THREE) return null;
  const T3=THREE;
  const canvas=$('#scene');
  let renderer;
  try{
    renderer=new T3.WebGLRenderer({canvas,antialias:!LOWQ,powerPreference:'high-performance',stencil:false});
  }catch(e){return null;}
  if(!renderer.getContext()) return null;
  const PR=Math.min(window.devicePixelRatio||1,LOWQ?1.25:1.75);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.toneMapping=T3.NoToneMapping;
  const C=h=>new T3.Color(h).convertSRGBToLinear();
  const TAU=Math.PI*2;
  const tex=(c,rep)=>{const t=new T3.CanvasTexture(c);t.encoding=T3.sRGBEncoding;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(rep){t.wrapS=t.wrapT=T3.RepeatWrapping;}return t;};

  const scene=new T3.Scene();
  const FOG=C('#1d2124');
  scene.fog=new T3.FogExp2(FOG,LOWQ?.0068:.0056);
  const camera=new T3.PerspectiveCamera(46,innerWidth/innerHeight,.25,4200);
  camera.position.set(0,2,40);camera.layers.enable(1);
  const uTime={value:0};

  // ---------- river curve, sampled by arc length ----------
  const CP0=[[0,70],[0,0],[30,-120],[10,-240],[-50,-350],[-60,-470],[0,-580],[80,-660],[110,-780],[60,-890],[40,-1010],[40,-1110]];
  const LEN0=new T3.CatmullRomCurve3(CP0.map(p=>new T3.Vector3(p[0],0,p[1])),false,'centripetal').getLength();
  const CP=CP0.slice(0,11).concat([[30,-1130],[-10,-1250],[-20,-1400]]).map(p=>new T3.Vector3(p[0],0,p[1]));
  const curve=new T3.CatmullRomCurve3(CP,false,'centripetal');
  const LEN=curve.getLength();
  const UM=f=>f*LEN0/LEN;
  const NS=2400;
  const PX=new Float32Array(NS+1),PZ=new Float32Array(NS+1),TX=new Float32Array(NS+1),TZ=new Float32Array(NS+1);
  {
    const p=new T3.Vector3(),t=new T3.Vector3();
    for(let i=0;i<=NS;i++){curve.getPointAt(i/NS,p);curve.getTangentAt(i/NS,t);t.y=0;t.normalize();PX[i]=p.x;PZ[i]=p.z;TX[i]=t.x;TZ[i]=t.z;}
  }
  const HW=22;
  function frame(u,o){
    o=o||{};
    const f=clamp(u,0,1)*NS,i=Math.min(NS-1,Math.floor(f)),k=f-i;
    o.x=PX[i]+(PX[i+1]-PX[i])*k;o.z=PZ[i]+(PZ[i+1]-PZ[i])*k;
    let tx=TX[i]+(TX[i+1]-TX[i])*k,tz=TZ[i]+(TZ[i+1]-TZ[i])*k;const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
    o.tx=tx;o.tz=tz;o.sx=tz;o.sz=-tx;return o;
  }
  const _f=frame(0);
  function at(u,off,y,v){frame(u,_f);v=v||new T3.Vector3();return v.set(_f.x+_f.sx*off,y,_f.z+_f.sz*off);}
  function nearestU(x,z,guess,win){
    let best=1e9,bi=0,a=0,b=NS,step=6;
    if(guess!=null){const g=Math.round(guess*NS),w=win||90;a=Math.max(0,g-w);b=Math.min(NS,g+w);step=1;}
    for(let i=a;i<=b;i+=step){const d=(PX[i]-x)*(PX[i]-x)+(PZ[i]-z)*(PZ[i]-z);if(d<best){best=d;bi=i;}}
    if(step>1){const a2=Math.max(0,bi-8),b2=Math.min(NS,bi+8);for(let i=a2;i<=b2;i++){const d=(PX[i]-x)*(PX[i]-x)+(PZ[i]-z)*(PZ[i]-z);if(d<best){best=d;bi=i;}}}
    const seg=LEN/NS,along=(x-PX[bi])*TX[bi]+(z-PZ[bi])*TZ[bi];
    return clamp((bi+along/seg)/NS,0,1);
  }
  const M=u=>u*LEN;
  // beyond both town ends the river runs on and opens into a broad river between low hills
  const EXT_LEN=720;
  const ENDS=[{x:PX[0],z:PZ[0],dx:-TX[0],dz:-TZ[0]},{x:PX[NS],z:PZ[NS],dx:TX[NS],dz:TZ[NS]}];
  const extW=s=>HW+smooth(clamp((s-30)/520,0,1))*190;
  const hsh=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
  function vnoise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);const a=hsh(ix,iy),b=hsh(ix+1,iy),c=hsh(ix,iy+1),d=hsh(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}
  const fbm=(x,y)=>vnoise(x,y)*.55+vnoise(x*2.1+5.2,y*2.1+1.3)*.28+vnoise(x*4.3+9.1,y*4.3+3.7)*.17;
  function riverDist(x,z){
    let bi=0,bd=1e18;
    for(let i=0;i<=NS;i+=24){const d=(PX[i]-x)*(PX[i]-x)+(PZ[i]-z)*(PZ[i]-z);if(d<bd){bd=d;bi=i;}}
    const a=Math.max(0,bi-24),b=Math.min(NS,bi+24);
    for(let i=a;i<=b;i++){const d=(PX[i]-x)*(PX[i]-x)+(PZ[i]-z)*(PZ[i]-z);if(d<bd){bd=d;bi=i;}}
    let l=Math.sqrt(bd),s=0,w=HW;
    ENDS.forEach((E,ei)=>{const rx=x-E.x,rz=z-E.z,ss=rx*E.dx+rz*E.dz;if(ss>0){const sl=rx*E.dz-rz*E.dx,ll=Math.abs(sl);
      // each bank wanders in and out a little so the open river has natural bays and points
      const ww=extW(ss)+(vnoise(ss*.011+(sl>0?13:0)+ei*31,ei*7.7)-.5)*2*42*smooth(clamp((ss-40)/160,0,1));
      if(ll-ww<l-w){l=ll;s=ss;w=ww;}}});
    return {l,s,w};
  }
  const prof=L=>L<30.5?2.36:L<220?lerp(2.36,4.12,(L-30.5)/189.5):4.12;
  function terrH(x,z){
    const r=riverDist(x,z),e=r.l-r.w,L=e+HW,k=smooth(clamp(r.s/60,0,1));
    const town=e<6?-6:e<12?lerp(-6,2.36,(e-6)/6):prof(L);
    const nat=e<-3?-4:e<9?lerp(-4,2.3,smooth((e+3)/12)):prof(L);
    let y=lerp(town,nat,k);
    if(e>9){
      const start=lerp(232,40,k),hk=smooth(clamp((L-start)/380,0,1));
      y+=hk*(10+fbm(x*.006,z*.006)*72)+smooth(clamp((L-start-320)/600,0,1))*45;
      y+=(fbm(x*.03,z*.03)-.5)*2.4*Math.max(k,smooth(clamp((L-226)/40,0,1)))*smooth(clamp((e-9)/30,0,1));
    }
    return y;
  }
  const STOP=[.035,.205,.385,.565,.745,.925].map(UM);
  const U_BRIDGE=UM(.238),U_PIER=UM(.5946),U_WISH=UM(.9728),U_LAUNCH=UM(.027),U_FW=UM(.79);

  // ---------- textures ----------
  function stuccoTex(){
    const c=cnv(256,256),g=c.getContext('2d');
    g.fillStyle='#e8e0cf';g.fillRect(0,0,256,256);
    for(let i=0;i<70;i++){const x=rnd()*256,y=rnd()*256,r=rr(10,46);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(120,96,60,'+rr(.04,.12)+')');gr.addColorStop(1,'rgba(120,96,60,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}
    for(let i=0;i<26;i++){const x=rnd()*256,w=rr(2,9),h=rr(30,140);const gr=g.createLinearGradient(0,256-h,0,256);gr.addColorStop(0,'rgba(60,64,40,0)');gr.addColorStop(1,'rgba(60,64,40,'+rr(.12,.3)+')');g.fillStyle=gr;g.fillRect(x,256-h,w,h);}
    const gb=g.createLinearGradient(0,170,0,256);gb.addColorStop(0,'rgba(50,48,30,0)');gb.addColorStop(1,'rgba(50,48,30,.38)');g.fillStyle=gb;g.fillRect(0,170,256,86);
    noiseFill(g,256,256,.08,2600,1.4);
    g.strokeStyle='rgba(70,50,30,.18)';g.lineWidth=1;for(let i=0;i<6;i++){g.beginPath();let x=rnd()*256,y=rnd()*256;g.moveTo(x,y);for(let k=0;k<6;k++){x+=rr(-10,10);y+=rr(4,14);g.lineTo(x,y);}g.stroke();}
    return tex(c,false);
  }
  function wallGlowTex(){
    const c=cnv(128,128),g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,128,128);
    for(let i=0;i<4;i++){const x=16+i*32+rr(-4,4),y=10;const gr=g.createRadialGradient(x,y,0,x,y,40);gr.addColorStop(0,'rgba(255,180,90,.85)');gr.addColorStop(.5,'rgba(255,140,60,.25)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);}
    const gr=g.createRadialGradient(64,128,0,64,128,60);gr.addColorStop(0,'rgba(255,170,90,.7)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
    return tex(c,false);
  }
  function roofTex(){
    const c=cnv(256,256),g=c.getContext('2d');g.fillStyle='#4a2a1c';g.fillRect(0,0,256,256);
    const rows=16,cols=12,rh=256/rows,cw=256/cols;
    for(let r=0;r<rows;r++){for(let k=0;k<cols;k++){
      const x=k*cw+(r%2?cw/2:0),y=r*rh;const v=rr(.75,1.15);
      const gr=g.createLinearGradient(x,0,x+cw,0);
      gr.addColorStop(0,'rgba(30,14,8,.9)');gr.addColorStop(.35,'rgba('+(120*v|0)+','+(70*v|0)+','+(48*v|0)+',1)');gr.addColorStop(.6,'rgba('+(150*v|0)+','+(92*v|0)+','+(62*v|0)+',1)');gr.addColorStop(1,'rgba(30,14,8,.9)');
      g.fillStyle=gr;g.fillRect(x,y,cw-1,rh+2);
      g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x,y+rh-2,cw,2);
      if(rnd()<.18){g.fillStyle='rgba(70,90,50,'+rr(.2,.45)+')';g.fillRect(x+rr(0,cw*.5),y+rr(0,rh*.5),rr(3,9),rr(2,6));}
    }}
    return tex(c,true);
  }
  function stoneTex(){
    const c=cnv(256,256),g=c.getContext('2d');g.fillStyle='#4e534f';g.fillRect(0,0,256,256);
    const rows=8,rh=32;
    for(let r=0;r<rows;r++){let x=-(r%2)*24;while(x<256){const w=rr(36,62),v=rr(.78,1.12);g.fillStyle='rgb('+(96*v|0)+','+(100*v|0)+','+(94*v|0)+')';g.fillRect(x+1,r*rh+1,w-2,rh-2);
      g.fillStyle='rgba(255,255,255,.05)';g.fillRect(x+1,r*rh+1,w-2,3);g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x+1,r*rh+rh-5,w-2,4);x+=w;}}
    noiseFill(g,256,256,.18,3000,1.6);
    const gm=g.createLinearGradient(0,150,0,256);gm.addColorStop(0,'rgba(40,60,36,0)');gm.addColorStop(.6,'rgba(40,62,38,.55)');gm.addColorStop(1,'rgba(18,30,22,.85)');g.fillStyle=gm;g.fillRect(0,150,256,106);
    return tex(c,true);
  }
  function pavingTex(){
    const c=cnv(256,256),g=c.getContext('2d');g.fillStyle='#3a3936';g.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=32)for(let x=(y/32%2)*21;x<256+42;x+=42){const v=rr(.8,1.15);g.fillStyle='rgb('+(84*v|0)+','+(80*v|0)+','+(74*v|0)+')';g.fillRect(x-42+1,y+1,40,30);}
    noiseFill(g,256,256,.2,2500,1.5);
    return tex(c,true);
  }
  function groundTex(){
    const c=cnv(256,256),g=c.getContext('2d');g.fillStyle='#22261d';g.fillRect(0,0,256,256);
    noiseFill(g,256,256,.4,5000,2,['#2c3324','#1b1f17','#34352a','#262b1f']);
    return tex(c,true);
  }
  function shopTex(){
    const c=cnv(128,128),g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,0,128);gr.addColorStop(0,'#ffcf8a');gr.addColorStop(.55,'#f59a4a');gr.addColorStop(1,'#6b2c14');g.fillStyle=gr;g.fillRect(0,0,128,128);
    g.fillStyle='rgba(60,25,10,.55)';for(let i=0;i<3;i++) g.fillRect(6,30+i*26,116,4);
    for(let i=0;i<22;i++){g.fillStyle=pick(['rgba(200,40,30,.75)','rgba(255,220,120,.8)','rgba(120,40,20,.6)','rgba(40,90,80,.6)']);g.fillRect(rr(8,116),rr(10,100),rr(5,12),rr(6,14));}
    g.fillStyle='rgba(40,18,8,.9)';g.fillRect(0,0,6,128);g.fillRect(122,0,6,128);g.fillRect(0,0,128,5);
    g.fillStyle='rgba(30,12,6,.7)';g.fillRect(40,70,8,58);g.fillRect(80,76,9,52);
    return tex(c,false);
  }
  // eight different lit shopfronts in one atlas, 4 x 2 tiles of 256 px
  function shopAtlas(){
    const c=cnv(1024,512),g=c.getContext('2d');
    const T=256;
    const interior=(x,y,top,bot)=>{const gr=g.createLinearGradient(0,y,0,y+T);gr.addColorStop(0,top);gr.addColorStop(1,bot);g.fillStyle=gr;g.fillRect(x+6,y+6,T-12,T-12);};
    const frameT=(x,y,col)=>{g.fillStyle=col||'#2a170c';g.fillRect(x,y,T,8);g.fillRect(x,y,10,T);g.fillRect(x+T-10,y,10,T);g.fillRect(x,y+T-6,T,6);};
    const lamp=(cx,cy,r,col)=>{const gr=g.createRadialGradient(cx,cy,0,cx,cy,r*2.2);gr.addColorStop(0,col);gr.addColorStop(.45,col.replace(/[\d.]+\)$/,'.25)'));gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(cx-r*2.2,cy-r*2.2,r*4.4,r*4.4);g.beginPath();g.ellipse(cx,cy,r,r*1.2,0,0,TAU);g.fillStyle=col;g.fill();};
    const people=(x,y,n,col)=>{for(let i=0;i<n;i++){const px=x+rr(30,T-30),py=y+rr(150,190);g.fillStyle=col||'rgba(40,18,8,.8)';g.beginPath();g.arc(px,py,9,0,TAU);g.fill();g.fillRect(px-11,py+8,22,40);}};
    const tiles=[
      (x,y)=>{interior(x,y,'#ffd28c','#a7471c');for(let r=0;r<4;r++)for(let k=0;k<7;k++) lamp(x+28+k*33+(r%2)*14,y+38+r*40,11,pick(['rgba(255,80,50,1)','rgba(255,200,80,1)','rgba(255,140,60,1)','rgba(250,110,140,1)','rgba(120,210,180,1)']));g.fillStyle='rgba(50,20,8,.85)';g.fillRect(x+20,y+200,T-40,50);},
      (x,y)=>{interior(x,y,'#ffe0b0','#9c5a2c');for(let k=0;k<9;k++){g.fillStyle=pick(['#b8322a','#2f6d8f','#e0a63a','#6b2d5c','#2f7a5e','#d86c4a','#efe2c8']);g.fillRect(x+18+k*25,y+40+rr(0,30),20,150);}g.fillStyle='rgba(40,20,10,.8)';g.beginPath();g.ellipse(x+200,y+120,16,22,0,0,TAU);g.fill();g.fillRect(x+188,y+140,24,80);},
      (x,y)=>{interior(x,y,'#ffc78a','#5a2a12');for(let k=0;k<3;k++) lamp(x+50+k*78,y+46,10,'rgba(255,214,140,1)');for(let k=0;k<3;k++){g.fillStyle='rgba(35,16,6,.9)';g.beginPath();g.ellipse(x+52+k*76,y+190,26,8,0,0,TAU);g.fill();g.fillRect(x+49+k*76,y+190,6,40);}people(x,y,3);g.fillStyle='#1d2a22';g.fillRect(x+180,y+80,56,70);g.fillStyle='rgba(240,240,220,.5)';for(let k=0;k<5;k++) g.fillRect(x+186,y+90+k*11,rr(20,42),3);},
      (x,y)=>{g.fillStyle='#2a170c';g.fillRect(x,y,T,T);for(let k=0;k<6;k++){const px=x+12+k*39;const gr=g.createLinearGradient(px,0,px+36,0);gr.addColorStop(0,'#3e2414');gr.addColorStop(.5,'#5a351d');gr.addColorStop(1,'#331d10');g.fillStyle=gr;g.fillRect(px,y+10,36,T-20);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(px+4,y+40,28,60);g.fillRect(px+4,y+130,28,90);g.fillStyle='rgba(255,170,80,.75)';g.fillRect(px+36,y+14,3,T-28);g.fillStyle='#b98b3c';g.fillRect(px+30,y+120,4,8);}},
      (x,y)=>{interior(x,y,'#fff0d4','#8c5a36');for(let k=0;k<4;k++){g.fillStyle='#3a2416';g.fillRect(x+20+k*56,y+40,46,58);g.fillStyle=pick(['#c97a4a','#6c8fa6','#e3c27a','#8aa67a','#b55a4a']);g.fillRect(x+25+k*56,y+45,36,48);}g.fillStyle='rgba(60,30,14,.85)';g.fillRect(x+16,y+176,T-32,8);for(let k=0;k<7;k++){g.fillStyle=pick(['#2f5e7a','#c8b590','#7a3a28','#e0d3b6']);g.beginPath();g.ellipse(x+34+k*30,y+160,11,16,0,0,TAU);g.fill();}},
      (x,y)=>{interior(x,y,'#ff9a6a','#5c160c');for(let k=0;k<4;k++) lamp(x+40+k*58,y+40,13,'rgba(255,70,40,1)');people(x,y,4,'rgba(40,10,6,.85)');for(let k=0;k<2;k++){g.fillStyle='rgba(30,8,4,.9)';g.fillRect(x+40+k*110,y+205,70,8);}},
      (x,y)=>{interior(x,y,'#f6dca0','#4e3a1c');for(let r=0;r<3;r++){g.fillStyle='rgba(50,30,12,.9)';g.fillRect(x+16,y+66+r*52,T-32,5);for(let k=0;k<8;k++){g.fillStyle=pick(['#7a9a5a','#c9a14a','#9a5a2a','#d8c8a0','#5a7a6a']);g.fillRect(x+22+k*27,y+38+r*52,18,27);}}g.fillStyle='rgba(40,22,10,.9)';g.fillRect(x+30,y+210,T-60,40);},
      (x,y)=>{interior(x,y,'#ffd9a0','#7a3e1a');g.fillStyle='#2f4a44';g.fillRect(x+10,y+10,62,T-16);g.fillRect(x+T-72,y+10,62,T-16);g.fillStyle='rgba(0,0,0,.3)';for(let yy=20;yy<T-10;yy+=12){g.fillRect(x+14,y+yy,54,3);g.fillRect(x+T-68,y+yy,54,3);}for(let k=0;k<10;k++){g.fillStyle=pick(['#e9c46a','#d1495b','#edae49','#66a182','#f4f1de']);g.fillRect(x+80+rr(0,80),y+60+rr(0,120),rr(10,22),rr(10,26));}people(x,y,1);}
    ];
    tiles.forEach((f,i)=>{const x=(i%4)*T,y=Math.floor(i/4)*T;g.save();g.beginPath();g.rect(x,y,T,T);g.clip();f(x,y);if(i!==3) frameT(x,y);noiseFill(g,0,0,0,0,1);g.restore();});
    const t=tex(c,false);t.generateMipmaps=true;return t;
  }
  // window variants, 4 x 2 tiles of 128 x 176
  function windowAtlas(){
    const c=cnv(512,352),g=c.getContext('2d'),W=128,H=176;
    const sh=['#2f4a44','#2b4f6e','#4a2e1c','#3d5a2e','#2f4a44','#3b2414','#6e2a22','#4a2e1c'];
    for(let i=0;i<8;i++){
      const x=(i%4)*W,y=Math.floor(i/4)*H,lit=[1,.35,1,.8,0,1,1,.2][i];
      const gr=g.createRadialGradient(x+W/2,y+H/2,4,x+W/2,y+H/2,90);
      if(lit>0){gr.addColorStop(0,'rgba(255,232,175,'+lit+')');gr.addColorStop(1,'rgba(200,90,30,'+lit+')');}else{gr.addColorStop(0,'#1b1410');gr.addColorStop(1,'#0e0a08');}
      g.fillStyle='#120c08';g.fillRect(x,y,W,H);g.fillStyle=gr;g.fillRect(x+16,y+10,W-32,H-20);
      if(i===5){g.strokeStyle='#3a2414';g.lineWidth=4;for(let k=1;k<4;k++){g.beginPath();g.moveTo(x+16+k*24,y+10);g.lineTo(x+16+k*24,y+H-10);g.stroke();}for(let k=1;k<5;k++){g.beginPath();g.moveTo(x+16,y+10+k*31);g.lineTo(x+W-16,y+10+k*31);g.stroke();}}
      if(i===6){g.fillStyle='rgba(180,40,30,.55)';g.fillRect(x+16,y+10,30,H-20);g.fillRect(x+W-46,y+10,30,H-20);}
      const open=[1,0,1,.5,0,1,1,0][i];
      const pw=open>=1?20:open>0?34:(W-32)/2;
      g.fillStyle=sh[i];g.fillRect(x,y,pw+16,H);g.fillRect(x+W-pw-16,y,pw+16,H);
      g.fillStyle='rgba(0,0,0,.35)';for(let yy=8;yy<H;yy+=8){g.fillRect(x+3,y+yy,pw+10,2);g.fillRect(x+W-pw-13,y+yy,pw+10,2);}
      if(open===0){g.fillStyle='rgba(255,170,80,'+(lit*.9)+')';g.fillRect(x+W/2-1,y+8,2,H-16);}
      g.fillStyle='#24150c';g.fillRect(x,y,W,6);g.fillRect(x,y+H-6,W,6);
    }
    return tex(c,false);
  }
  // signboards with the shop's trade, 2 x 4 tiles of 256 x 64
  const SIGN_TXT=['ĐÈN LỒNG','MAY ĐO','CÀ PHÊ','HỘI AN','GỐM SỨ','QUÁN ĂN','TRÀ','TẠP HÓA'];
  function signAtlas(){
    const c=cnv(512,256),g=c.getContext('2d'),W=256,H=64;
    const styles=[['#14100c','#e8b84a'],['#7a1c14','#f2c45a'],['#5a3a1e','#f3e2c0'],['#1f3d3a','#eaf2ea'],['#2a1a10','#e8b84a'],['#8a2418','#ffe08a'],['#3a2a16','#e6d3a2'],['#173040','#f2d27a']];
    SIGN_TXT.forEach((t,i)=>{
      const x=(i%2)*W,y=Math.floor(i/2)*H,[bg,fg]=styles[i];
      g.fillStyle=bg;g.fillRect(x+2,y+4,W-4,H-8);
      g.strokeStyle=fg;g.globalAlpha=.55;g.lineWidth=2;g.strokeRect(x+8,y+9,W-16,H-18);g.globalAlpha=1;
      g.fillStyle=fg;g.font='600 30px "Cormorant Garamond", Georgia, serif';g.textAlign='center';g.textBaseline='middle';g.fillText(t,x+W/2,y+H/2+2);
    });
    return tex(c,false);
  }
  function windowTex(){
    const c=cnv(64,96),g=c.getContext('2d');
    g.fillStyle='#ffb868';g.fillRect(0,0,64,96);
    const gr=g.createRadialGradient(32,48,2,32,48,50);gr.addColorStop(0,'rgba(255,230,170,1)');gr.addColorStop(1,'rgba(200,90,30,1)');g.fillStyle=gr;g.fillRect(14,8,36,80);
    g.fillStyle='#2f4a44';g.fillRect(0,0,16,96);g.fillRect(48,0,16,96);
    g.fillStyle='rgba(0,0,0,.35)';for(let y=4;y<96;y+=6){g.fillRect(2,y,12,2);g.fillRect(50,y,12,2);}
    g.fillStyle='#2a1a10';g.fillRect(0,0,64,4);g.fillRect(0,92,64,4);g.fillRect(31,4,2,88);
    return tex(c,false);
  }
  function railTex(){
    const c=cnv(128,32),g=c.getContext('2d');g.clearRect(0,0,128,32);g.fillStyle='#3a2416';
    g.fillRect(0,0,128,4);g.fillRect(0,28,128,4);for(let x=2;x<128;x+=10){g.fillRect(x,4,4,24);}
    const t=tex(c,true);return t;
  }
  function latticeTex(){
    const c=cnv(128,64),g=c.getContext('2d');g.clearRect(0,0,128,64);g.strokeStyle='#5a1f16';g.lineWidth=3;
    g.strokeRect(1,1,126,62);for(let x=-64;x<128;x+=16){g.beginPath();g.moveTo(x,0);g.lineTo(x+64,64);g.stroke();g.beginPath();g.moveTo(x+64,0);g.lineTo(x,64);g.stroke();}
    return tex(c,true);
  }
  function ribTex(){
    const c=cnv(64,64),g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,0,64);gr.addColorStop(0,'#8a8a8a');gr.addColorStop(.45,'#ffffff');gr.addColorStop(.6,'#fff6e6');gr.addColorStop(1,'#7a7a7a');g.fillStyle=gr;g.fillRect(0,0,64,64);
    g.fillStyle='rgba(0,0,0,.28)';for(let x=0;x<64;x+=8) g.fillRect(x,0,1.5,64);
    return tex(c,true);
  }
  function petalTex(){
    const c=cnv(64,128),g=c.getContext('2d');
    const gr=g.createLinearGradient(0,128,0,0);gr.addColorStop(0,'#fff0c8');gr.addColorStop(.22,'#ffbf73');gr.addColorStop(.6,'#f2785a');gr.addColorStop(1,'#b8364a');g.fillStyle=gr;g.fillRect(0,0,64,128);
    g.strokeStyle='rgba(255,255,255,.25)';g.lineWidth=1;for(let i=0;i<7;i++){g.beginPath();g.moveTo(32,128);g.quadraticCurveTo(32+(i-3)*6,60,32+(i-3)*9,0);g.stroke();}
    return tex(c,false);
  }
  function glowTex(){
    const c=cnv(64,64),g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.14,'rgba(255,255,255,.62)');gr.addColorStop(.32,'rgba(255,255,255,.24)');gr.addColorStop(.55,'rgba(255,255,255,.07)');gr.addColorStop(.8,'rgba(255,255,255,.015)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
    const t=new T3.CanvasTexture(c);return t;
  }
  function moonTex(){
    const c=cnv(256,256),g=c.getContext('2d');
    const gr=g.createRadialGradient(118,112,10,128,128,124);gr.addColorStop(0,'#fffbee');gr.addColorStop(.8,'#ffe9b8');gr.addColorStop(1,'#f3c97e');
    g.beginPath();g.arc(128,128,124,0,TAU);g.fillStyle=gr;g.fill();
    g.save();g.clip();
    for(let i=0;i<14;i++){const x=rr(40,216),y=rr(40,216),r=rr(10,38);const m=g.createRadialGradient(x,y,0,x,y,r);m.addColorStop(0,'rgba(170,140,100,.32)');m.addColorStop(1,'rgba(170,140,100,0)');g.fillStyle=m;g.fillRect(x-r,y-r,r*2,r*2);}
    noiseFill(g,256,256,.05,1200,1.5);g.restore();
    return tex(c,false);
  }
  function cloudTex(){
    const c=cnv(256,128),g=c.getContext('2d');
    for(let i=0;i<40;i++){const x=rr(30,226),y=rr(40,90),r=rr(16,44);const m=g.createRadialGradient(x,y,0,x,y,r);m.addColorStop(0,'rgba(255,255,255,.22)');m.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=m;g.fillRect(x-r,y-r,r*2,r*2);}
    return new T3.CanvasTexture(c);
  }
  function hullTex(){
    const c=cnv(64,256),g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#2d6f6a');gr.addColorStop(.1,'#2d6f6a');gr.addColorStop(.11,'#d9cfae');gr.addColorStop(.135,'#d9cfae');gr.addColorStop(.14,'#3b2a1f');gr.addColorStop(.86,'#3b2a1f');gr.addColorStop(.865,'#d9cfae');gr.addColorStop(.89,'#d9cfae');gr.addColorStop(.9,'#2d6f6a');gr.addColorStop(1,'#2d6f6a');
    g.fillStyle=gr;g.fillRect(0,0,64,256);g.fillStyle='rgba(0,0,0,.25)';for(let y=40;y<220;y+=14) g.fillRect(0,y,64,1);
    noiseFill(g,64,256,.15,600,1.5);
    return tex(c,true);
  }
  function eyeTex(){
    const c=cnv(128,64),g=c.getContext('2d');g.clearRect(0,0,128,64);
    g.beginPath();g.ellipse(64,32,54,22,0,0,TAU);g.fillStyle='#b8321f';g.fill();
    g.beginPath();g.ellipse(64,32,46,16,0,0,TAU);g.fillStyle='#f4efe2';g.fill();
    g.beginPath();g.arc(66,32,13,0,TAU);g.fillStyle='#111';g.fill();
    g.beginPath();g.arc(62,28,3,0,TAU);g.fillStyle='#fff';g.fill();
    return tex(c,false);
  }
  function wovenTex(){
    const c=cnv(64,64),g=c.getContext('2d');g.fillStyle='#5b4326';g.fillRect(0,0,64,64);
    for(let y=0;y<64;y+=8)for(let x=0;x<64;x+=8){g.fillStyle=((x+y)/8)%2?'#6e5530':'#4a361f';g.fillRect(x,y,8,4);g.fillRect(x,y+4,4,4);}
    return tex(c,true);
  }
  function waterNormals(){
    const N=256,h=new Float32Array(N*N);
    [[8,1],[16,.55],[32,.3],[64,.16]].forEach(([P,amp])=>{
      const lat=new Float32Array(P*P);for(let i=0;i<P*P;i++) lat[i]=rnd()*2-1;
      for(let y=0;y<N;y++)for(let x=0;x<N;x++){
        const fx=x/N*P,fy=y/N*P,ix=Math.floor(fx),iy=Math.floor(fy);let tx=fx-ix,ty=fy-iy;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty);
        const a=lat[(iy%P)*P+ix%P],b=lat[(iy%P)*P+(ix+1)%P],c=lat[((iy+1)%P)*P+ix%P],d=lat[((iy+1)%P)*P+(ix+1)%P];
        h[y*N+x]+=amp*(a+(b-a)*tx+(c-a)*ty+(a-b-c+d)*tx*ty);
      }
    });
    const data=new Uint8Array(N*N*4),s=3.2;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const dx=h[y*N+(x+1)%N]-h[y*N+(x+N-1)%N],dy=h[((y+1)%N)*N+x]-h[((y+N-1)%N)*N+x];
      let nx=-dx*s,ny=-dy*s,nz=1;const l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;
      const i=(y*N+x)*4;data[i]=(nx*.5+.5)*255;data[i+1]=(ny*.5+.5)*255;data[i+2]=(nz*.5+.5)*255;data[i+3]=255;
    }
    const t=new T3.DataTexture(data,N,N,T3.RGBAFormat);t.wrapS=t.wrapT=T3.RepeatWrapping;t.magFilter=T3.LinearFilter;t.minFilter=T3.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;
    return t;
  }

  // ---------- geometry helpers ----------
  function merge(list){
    const geos=list.map(g=>g.index?g.toNonIndexed():g);
    let n=0;geos.forEach(g=>n+=g.attributes.position.count);
    const pos=new Float32Array(n*3),nor=new Float32Array(n*3),uv=new Float32Array(n*2),col=new Float32Array(n*3);
    let o=0;
    geos.forEach(g=>{
      const c=g.attributes.position.count;
      if(!g.attributes.normal) g.computeVertexNormals();
      pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);
      if(g.attributes.uv) uv.set(g.attributes.uv.array,o*2);
      if(g.attributes.color) col.set(g.attributes.color.array,o*3); else col.fill(1,o*3,(o+c)*3);
      o+=c;
    });
    const m=new T3.BufferGeometry();
    m.setAttribute('position',new T3.BufferAttribute(pos,3));m.setAttribute('normal',new T3.BufferAttribute(nor,3));
    m.setAttribute('uv',new T3.BufferAttribute(uv,2));m.setAttribute('color',new T3.BufferAttribute(col,3));
    return m;
  }
  function tinted(g,r,gg,b){const n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=r;a[i*3+1]=gg;a[i*3+2]=b;}g.setAttribute('color',new T3.BufferAttribute(a,3));return g;}
  // prism roof: ridge along x at y=1, eaves at y=0, z from -.5 to .5
  function roofGeo(){
    const p=[-.5,0,.5, .5,0,.5, .5,1,0, -.5,1,0,  .5,0,-.5, -.5,0,-.5, -.5,1,0, .5,1,0];
    const g=new T3.BufferGeometry();
    const pos=[],uv=[];
    const quad=(a,b,c,d,ua)=>{[a,b,c,a,c,d].forEach((v,i)=>{pos.push(p[v*3],p[v*3+1],p[v*3+2]);});const U=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];U.forEach(q=>uv.push(q[0]*ua,q[1]*1.4));};
    quad(0,1,2,3,3);quad(4,5,6,7,3);
    pos.push(-.5,0,.5, -.5,1,0, -.5,0,-.5,  .5,0,-.5, .5,1,0, .5,0,.5);
    uv.push(0,0,.5,.6,1,0, 0,0,.5,.6,1,0);
    g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T3.Float32BufferAttribute(uv,2));g.computeVertexNormals();
    return g;
  }
  // silk lantern hanging from y=0
  function lanternBodyGeo(){
    const pts=[];const top=-.13,bot=-.62,R=.24;
    for(let i=0;i<=8;i++){const t=i/8,y=top+(bot-top)*t;const r=.08+(R-.08)*Math.pow(Math.sin(Math.PI*t),.75);pts.push(new T3.Vector2(r,y));}
    const g=new T3.LatheGeometry(pts.reverse(),LOWQ?7:9);
    return g;
  }
  function lanternCapGeo(){
    const wire=new T3.CylinderGeometry(.006,.006,.13,4,1,true);wire.translate(0,-.065,0);
    const c1=new T3.CylinderGeometry(.09,.1,.04,6,1,true);c1.translate(0,-.13,0);
    const c2=new T3.CylinderGeometry(.1,.08,.04,6,1,true);c2.translate(0,-.62,0);
    const ts=new T3.ConeGeometry(.03,.2,4,1,true);ts.rotateX(Math.PI);ts.translate(0,-.74,0);
    return merge([tinted(wire,.15,.1,.08),tinted(c1,.3,.18,.1),tinted(c2,.3,.18,.1),tinted(ts,.8,.12,.08)]);
  }
  function petalGeo(len,wid,curl,cup,round){
    const su=4,sv=7,pos=[],uv=[],idx=[];round=round||0;
    for(let j=0;j<=sv;j++){const v=j/sv;const w=wid*Math.pow(Math.sin(Math.PI*Math.min(v*(1.08-.12*round)+.04,1)),.8-.45*round)*(1-.3*v*(1-round*.6));
      for(let i=0;i<=su;i++){const uu=i/su*2-1;const x=uu*w;const y=v*len;const z=-curl*v*v*len-cup*(1-uu*uu)*w;pos.push(x,y,z);uv.push(i/su,v);}}
    for(let j=0;j<sv;j++)for(let i=0;i<su;i++){const a=j*(su+1)+i,b=a+1,c=a+su+1,d=c+1;idx.push(a,c,b,b,c,d);}
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T3.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    return g;
  }
  function lotusGeo(detailRings,withColor){
    const parts=[];
    detailRings.forEach(r=>{
      for(let k=0;k<r.n;k++){
        const g=petalGeo(r.len,r.wid,r.curl,r.cup,r.round);
        g.rotateX(-r.tilt);g.translate(0,0,0);
        g.translate(0,0,-r.rad);
        g.rotateY(k/r.n*TAU+r.off);
        g.translate(0,r.y,0);
        if(withColor){
          const n=g.attributes.position.count,col=new Float32Array(n*3),uvA=g.attributes.uv.array;
          for(let i=0;i<n;i++){const v=uvA[i*2+1];const b=1.15-.62*v;col[i*3]=b;col[i*3+1]=b*(.92-.25*v);col[i*3+2]=b*(.82-.35*v);}
          g.setAttribute('color',new T3.BufferAttribute(col,3));
        }
        parts.push(g);
      }
    });
    return merge(parts);
  }
  function sampanGeo(len,wid){
    const NL=18,NC=10,pos=[],uv=[],idx=[];
    for(let i=0;i<=NL;i++){const u=i/NL,x=(u-.5)*len;const wf=Math.pow(Math.sin(Math.PI*u),.55);const w=wid*.5*Math.max(wf,.05);
      const top=.42+.55*Math.pow(Math.abs(2*u-1),3.2);const bd=.42*wf+.04;
      for(let j=0;j<=NC;j++){const a=j/NC*Math.PI;pos.push(x,top-(top+bd)*Math.sin(a),w*Math.cos(a));uv.push(u*3,j/NC);}}
    for(let i=0;i<NL;i++)for(let j=0;j<NC;j++){const a=i*(NC+1)+j,b=a+1,c=a+NC+1,d=c+1;idx.push(a,b,c,b,d,c);}
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T3.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    return g;
  }

  // ---------- shared materials ----------
  const T={stucco:stuccoTex(),wallGlow:wallGlowTex(),roof:roofTex(),stone:stoneTex(),paving:pavingTex(),ground:groundTex(),shop:shopAtlas(),win:windowAtlas(),sign:signAtlas(),rail:railTex(),lattice:latticeTex(),rib:ribTex(),petal:petalTex(),glow:glowTex(),moon:moonTex(),cloud:cloudTex(),hull:hullTex(),eye:eyeTex(),woven:wovenTex(),water:waterNormals()};
  onProgress(.2);
  const mat={
    wall:new T3.MeshStandardMaterial({map:T.stucco,emissiveMap:T.wallGlow,emissive:C('#ffae66'),emissiveIntensity:.42,roughness:.94}),
    roof:new T3.MeshStandardMaterial({map:T.roof,roughness:.82,side:T3.DoubleSide}),
    stone:new T3.MeshStandardMaterial({map:T.stone,roughness:.9,side:T3.DoubleSide}),
    paving:new T3.MeshStandardMaterial({map:T.paving,roughness:.86,side:T3.DoubleSide}),
    ground:new T3.MeshStandardMaterial({map:T.ground,roughness:1,side:T3.DoubleSide}),
    wood:new T3.MeshStandardMaterial({color:C('#3c2618'),roughness:.8}),
    darkwood:new T3.MeshStandardMaterial({color:C('#22160f'),roughness:.85}),
    lacquer:new T3.MeshStandardMaterial({color:C('#8e2a1c'),roughness:.55,emissive:C('#3a0e06'),emissiveIntensity:.4}),
    shop:new T3.MeshBasicMaterial({map:T.shop,color:new T3.Color(1.15,1.05,.95)}),
    win:new T3.MeshBasicMaterial({map:T.win,color:new T3.Color(1.05,.95,.85)}),
    sign:new T3.MeshStandardMaterial({map:T.sign,roughness:.6,emissive:new T3.Color(1,1,1),emissiveMap:T.sign,emissiveIntensity:.35}),
    rail:new T3.MeshStandardMaterial({map:T.rail,transparent:true,alphaTest:.5,side:T3.DoubleSide,roughness:.8}),
    lattice:new T3.MeshStandardMaterial({map:T.lattice,transparent:true,alphaTest:.5,side:T3.DoubleSide,roughness:.7,emissive:C('#7a2010'),emissiveIntensity:.55}),
    leaf:new T3.MeshStandardMaterial({color:C('#1f3a26'),roughness:.9}),
    trunk:new T3.MeshStandardMaterial({color:C('#2a1d14'),roughness:.95}),
    canvas:new T3.MeshStandardMaterial({color:C('#7a2e1d'),roughness:.9,side:T3.DoubleSide,emissive:C('#3a1006'),emissiveIntensity:.5}),
    rope:new T3.MeshBasicMaterial({color:C('#1a120c')})
  };
  const swayInject=(m)=>{
    m.onBeforeCompile=sh=>{
      sh.uniforms.uTime=uTime;
      sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat ph=instanceMatrix[3].x*.37+instanceMatrix[3].z*.23;\nfloat sa=sin(uTime*1.25+ph)*.07+sin(uTime*.67+ph*1.7)*.035;\nfloat sb=cos(uTime*1.05+ph*1.3)*.05;\ntransformed.yz=mat2(cos(sa),-sin(sa),sin(sa),cos(sa))*transformed.yz;\ntransformed.xy=mat2(cos(sb),-sin(sb),sin(sb),cos(sb))*transformed.xy;\n#endif');
    };
    return m;
  };

  // ---------- lights ----------
  const MOON_DIR=new T3.Vector3(.5,.3,-1).normalize();
  const hemi=new T3.HemisphereLight(C('#4a6a8a'),C('#3a2216'),.62);scene.add(hemi);
  const moonL=new T3.DirectionalLight(C('#c6d4f0'),.5);moonL.position.copy(MOON_DIR).multiplyScalar(100);scene.add(moonL);scene.add(moonL.target);
  const flashL=new T3.PointLight(C('#ffd08a'),0,320,1.6);scene.add(flashL);
  const lampLights=[];
  function lamp(pos,color,int,dist){const l=new T3.PointLight(C(color),int,dist,2);l.position.copy(pos);scene.add(l);lampLights.push(l);return l;}

  // ---------- sky ----------
  const skyG=new T3.Group();scene.add(skyG);
  const SKY={zen:C('#040b10'),mid:C('#0a1d24'),hor:FOG.clone()};
  const sky=new T3.Mesh(new T3.SphereGeometry(1800,32,16),new T3.ShaderMaterial({
    side:T3.BackSide,depthWrite:false,fog:false,
    uniforms:{uZen:{value:SKY.zen},uMid:{value:SKY.mid},uHor:{value:SKY.hor},uMoon:{value:MOON_DIR},uGlow:{value:C('#ffe3a6')},uFlash:{value:new T3.Color(0,0,0)}},
    vertexShader:'varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader:'uniform vec3 uZen,uMid,uHor,uMoon,uGlow,uFlash;varying vec3 vD;void main(){vec3 d=normalize(vD);float h=d.y;vec3 c=mix(uHor,uMid,smoothstep(-.02,.2,h));c=mix(c,uZen,smoothstep(.2,.85,h));float m=max(dot(d,uMoon),0.);c+=uGlow*(pow(m,12.)*.035+pow(m,90.)*.12+pow(m,600.)*.35);c+=vec3(.07,.035,.014)*exp(-max(h,0.)*12.);c+=uFlash*exp(-max(h,0.)*3.);gl_FragColor=vec4(c,1.);}'
  }));
  sky.renderOrder=-10;sky.frustumCulled=false;skyG.add(sky);
  {
    const n=LOWQ?900:1800,pos=new Float32Array(n*3),sz=new Float32Array(n),ph=new Float32Array(n);
    for(let i=0;i<n;i++){const y=Math.pow(rnd(),.7)*.95+.04,a=rnd()*TAU,r=Math.sqrt(1-y*y);pos[i*3]=Math.cos(a)*r*1700;pos[i*3+1]=y*1700;pos[i*3+2]=Math.sin(a)*r*1700;sz[i]=rr(1,2.6)*(rnd()<.05?1.8:1);ph[i]=rnd()*TAU;}
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.BufferAttribute(pos,3));g.setAttribute('size',new T3.BufferAttribute(sz,1));g.setAttribute('ph',new T3.BufferAttribute(ph,1));
    const st=new T3.Points(g,new T3.ShaderMaterial({transparent:true,depthWrite:false,blending:T3.AdditiveBlending,fog:false,uniforms:{uTime,uPR:{value:PR}},
      vertexShader:'attribute float size;attribute float ph;uniform float uTime,uPR;varying float vA;void main(){vA=(.55+.45*sin(uTime*1.3+ph))*smoothstep(.02,.3,normalize(position).y);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_PointSize=size*uPR;}',
      fragmentShader:'varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vec3(.8,.85,1.)*a*vA*.9,1.);}'}));
    st.frustumCulled=false;st.renderOrder=-9;st.layers.set(1);skyG.add(st);
  }
  const moon=new T3.Mesh(new T3.PlaneGeometry(64,64),new T3.MeshBasicMaterial({map:T.moon,transparent:true,depthWrite:false,fog:false,color:new T3.Color(1.35,1.22,.98)}));
  moon.position.copy(MOON_DIR).multiplyScalar(1500);moon.lookAt(0,0,0);moon.renderOrder=-8;skyG.add(moon);
  const mountains=new T3.Group();scene.add(mountains);
  {
    const LAY=[[1700,175,60,.0,C('#151a22'),.62,4.6],[1480,120,34,.35,C('#0f141a'),.4,7.4],[1260,64,14,.8,C('#090c10'),.18,12.5]];
    LAY.forEach(([R,H,base,lights,col,haze,sc],li)=>{
      const g=new T3.CylinderGeometry(R,R,H+base+240,256,1,true);g.translate(0,(H+base+240)/2-220,0);
      const m=new T3.ShaderMaterial({side:T3.BackSide,fog:false,
        uniforms:{uR:{value:R},uH:{value:H},uBase:{value:base},uSc:{value:sc},uSeed:{value:li*17.3+3.1},uCol:{value:col},uHaze:{value:FOG.clone().add(new T3.Color(.07,.035,.014))},uFog:{value:FOG},uMoon:{value:MOON_DIR},uRim:{value:new T3.Color(.05,.055,.07)},uHazeK:{value:haze},uLights:{value:lights},uTime},
        vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:['uniform float uR,uH,uBase,uSc,uSeed,uHazeK,uLights,uTime;uniform vec3 uCol,uHaze,uFog,uMoon,uRim;varying vec3 vP;',
          'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453);}',
          'float n2(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}',
          'float ridge(vec2 q){float h=0.,a=.52;for(int k=0;k<6;k++){float n=n2(q);h+=a*mix(n,1.-abs(n*2.-1.),.3);q=q*2.03+vec2(1.7,9.2);a*=.48;}return h;}',
          'void main(){vec2 d=normalize(vP.xz);float r=ridge(d*uSc);float top=uBase+uH*pow(r,1.45);',
          ' if(vP.y>top) discard;',
          ' float m=max(dot(d,normalize(uMoon.xz)),0.);',
          ' vec3 c=uCol*(.85+.3*r);',
          ' c+=uRim*smoothstep(3.,0.,top-vP.y)*m*m;',
          ' c=mix(c,uHaze,uHazeK+(1.-uHazeK)*.55*smoothstep(top,uBase-50.,vP.y));',
          ' c=mix(c,uFog,smoothstep(-20.,-160.,vP.y));',
          ' if(uLights>0.){float arc=atan(d.y,d.x)*uR;float cell=floor(arc/22.);float hr=h2(vec2(cell,7.));',
          '  if(hr>1.-uLights*.12){float lx=(cell+.2+.6*h2(vec2(cell,3.)))*22.;float ly=-8.+h2(vec2(cell,5.))*min(top-6.,uH*.25);',
          '   float dd=length(vec2(arc-lx,vP.y-ly));float tw=.75+.25*sin(uTime*(1.+hr*3.)+cell);c+=vec3(1.6,.75,.28)*exp(-dd*dd*.55)*tw*1.4;}}',
          ' gl_FragColor=vec4(c,1.);}'].join('\n')});
      const mesh=new T3.Mesh(g,m);mesh.renderOrder=-6+li;mesh.frustumCulled=false;mountains.add(mesh);
    });
  }
  const clouds=[];
  for(let i=0;i<5;i++){
    const m=new T3.Mesh(new T3.PlaneGeometry(rr(500,800),rr(110,180)),new T3.MeshBasicMaterial({map:T.cloud,transparent:true,depthWrite:false,fog:false,opacity:rr(.14,.26),color:new T3.Color(.36,.42,.52)}));
    const d=new T3.Vector3(MOON_DIR.x+rr(-.5,.5),MOON_DIR.y+rr(-.1,.18),MOON_DIR.z+rr(-.2,.2)).normalize();
    m.position.copy(d).multiplyScalar(1400);m.lookAt(0,0,0);m.renderOrder=-7;skyG.add(m);clouds.push({m,d,s:rr(-.004,.004)});
  }

  // ---------- water: reflector with ripple rings and lantern light pools ----------
  const RIP=24,POOL=16;
  const ripData=[];for(let i=0;i<RIP;i++) ripData.push(new T3.Vector4(0,0,-99,0));
  const poolData=[];for(let i=0;i<POOL;i++) poolData.push(new T3.Vector4(0,0,1,0));
  const waterShader={
    uniforms:T3.UniformsUtils.merge([T3.UniformsLib.fog,{
      color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},
      tNormal:{value:null},uTime:{value:0},uDeep:{value:C('#062a2c')},uMoon:{value:MOON_DIR},uMoonCol:{value:new T3.Color(1.1,.98,.76)},
      uRip:{value:ripData},uPool:{value:poolData},uWarm:{value:C('#ff9a3c')},uFlash:{value:new T3.Color(0,0,0)}
    }]),
    vertexShader:[
      'uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vW;',
      '#include <fog_pars_vertex>',
      'void main(){vUv=textureMatrix*vec4(position,1.);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;',
      '#include <fog_vertex>',
      '}'].join('\n'),
    fragmentShader:[
      'uniform vec3 color;uniform sampler2D tDiffuse,tNormal;uniform float uTime;uniform vec3 uDeep,uMoon,uMoonCol,uWarm,uFlash;',
      'uniform vec4 uRip['+RIP+'];uniform vec4 uPool['+POOL+'];varying vec4 vUv;varying vec3 vW;',
      '#include <fog_pars_fragment>',
      'void main(){',
      ' vec2 p=vW.xz;float t=uTime;',
      ' vec2 g=(texture2D(tNormal,p*.045+vec2(t*.011,t*.017)).xy*2.-1.)*.55;',
      ' vec2 g2=(texture2D(tNormal,p*.11+vec2(-t*.025,t*.012)).xy*2.-1.);g+=g2*.35;',
      ' vec2 gs=g*.8+g2*.5+(texture2D(tNormal,p*.23+vec2(t*.03,-t*.021)).xy*2.-1.)*.45;',
      ' g+=(texture2D(tNormal,p*.012+vec2(t*.003,-t*.005)).xy*2.-1.)*.5;',
      ' float ring=0.;',
      ' for(int i=0;i<'+RIP+';i++){vec4 r=uRip[i];float age=t-r.z;if(age<0.||age>7.)continue;vec2 d=p-r.xy;float dist=length(d)+1e-4;float k=11./(.45+r.w);float rad=age*(.55+r.w*.5);float x=dist-rad;float env=exp(-x*x*(2.2/(.3+r.w)))*exp(-age*.75)*r.w;g+=d/dist*(-sin(x*k))*env*1.4;ring+=cos(x*k)*env;}',
      ' vec3 V=normalize(cameraPosition-vW);float camD=length(cameraPosition-vW);',
      ' float fade=1./(1.+camD*.012);',
      ' vec3 N=normalize(vec3(g.x*.12*fade,1.,g.y*.12*fade));',
      ' vec2 off=vec2(g.x*.0035,g.y*.011)*fade;',
      ' vec4 q=vUv;q.xy+=off*q.w;float b=.0035*q.w;',
      ' vec3 refl=texture2DProj(tDiffuse,q).rgb*.32+texture2DProj(tDiffuse,q+vec4(0.,b,0.,0.)).rgb*.2+texture2DProj(tDiffuse,q+vec4(0.,-b,0.,0.)).rgb*.2+texture2DProj(tDiffuse,q+vec4(b*.35,b*2.2,0.,0.)).rgb*.14+texture2DProj(tDiffuse,q+vec4(-b*.35,-b*2.2,0.,0.)).rgb*.14;',
      ' float fr0=pow(1.-max(dot(V,N),0.),3.5);float fr=.06+.94*fr0;',
      // clear water: thin where you look straight down, a mirror at grazing angles and in the distance
      ' float a=clamp(fr+.26+camD*.006,0.,1.);',
      // looking down, a real river still shows its surface: soft sky sheen on the faces that tilt toward the light,
      // slightly deeper colour in the troughs, and lantern light broken into small glints
      ' float topW=smoothstep(.3,.92,V.y)/(1.+camD*.018);',
      ' float sl=gs.x*.62+gs.y*.48+ring*.6;',
      ' float sheen=clamp(sl,0.,1.3);sheen*=sheen*.7+.3;float trough=clamp(-sl,0.,1.2);',
      ' a=clamp(a+topW*(.06*trough+.025*sheen+.05*max(ring,0.)),0.,1.);',
      ' vec3 col=(refl*color*fr+uDeep*(a-fr))/a;',
      ' vec3 H=normalize(uMoon+V);col+=uMoonCol*pow(max(dot(N,H),0.),900.)*.9*smoothstep(.0,.35,1.-dot(V,vec3(0.,1.,0.)));',
      ' col+=uMoonCol*pow(max(dot(N,H),0.),40.)*.035;',
      ' vec3 pool=vec3(0.);',
      ' for(int j=0;j<'+POOL+';j++){vec4 o=uPool[j];vec2 d=p-o.xy;float dd=dot(d,d);pool+=uWarm*o.w/(1.+dd*o.z);}',
      ' col+=vec3(.042,.056,.066)*sheen*topW/a;',
      ' col+=pool*(.1+.9*fr0)*(.55+.9*max(g.x+g.y,0.)*.5+ring*.4+topW*(1.5*pow(max(sl,0.),2.)+.5*max(ring,0.)))/a;',
      ' col+=uFlash*.12*(.5+fr)/a;',
      ' gl_FragColor=vec4(col,a);',
      ' #include <fog_fragment>',
      '}'].join('\n')
  };
  let water,BEDMAT=null,BRF=null;
  {
    const pos=[],uvs=[],idx=[],rows=[];
    for(let i=0;i<=NS;i+=3) rows.push(i);
    const addRow=(x,z,sx,sz,W)=>{pos.push(x-sx*W,-(z-sz*W),0, x+sx*W,-(z+sz*W),0);uvs.push(0,0,1,0);};
    const EXT_S=[.5,8,30,70,130,210,310,440,580,EXT_LEN];
    const extRow=(E,s,sx,sz)=>addRow(E.x+E.dx*s,E.z+E.dz*s,sx,sz,extW(s)+18+50*smooth(clamp((s-40)/160,0,1)));
    for(let k=EXT_S.length-1;k>=0;k--) extRow(ENDS[0],EXT_S[k],TZ[0],-TX[0]);
    rows.forEach(i=>addRow(PX[i],PZ[i],TZ[i],-TX[i],HW+.8));
    EXT_S.forEach(sv=>extRow(ENDS[1],sv,TZ[NS],-TX[NS]));
    const nr=rows.length+2*EXT_S.length;
    for(let r=0;r<nr-1;r++){const a=r*2,b=a+1,c=a+2,d=a+3;idx.push(a,c,b,b,c,d);}
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T3.Float32BufferAttribute(uvs,2));g.setIndex(idx);g.computeVertexNormals();
    const rs=LOWQ?.4:.55;
    water=new T3.Reflector(g,{textureWidth:Math.round(innerWidth*PR*rs),textureHeight:Math.round(innerHeight*PR*rs),clipBias:.004,color:new T3.Color(.92,.95,1),shader:waterShader});
    water.rotation.x=-Math.PI/2;
    water.material.fog=true;
    water.material.uniforms.tNormal.value=T.water;
    water.material.side=T3.DoubleSide;water.material.transparent=true;water.renderOrder=-1;
    scene.add(water);
  }
  onProgress(.3);

  // ---------- riverbed seen through clear water: pebbles, caustics, lit by the lanterns above ----------
  function pebbleTex(){
    const c=cnv(512,512),g=c.getContext('2d');g.fillStyle='#4a4639';g.fillRect(0,0,512,512);
    noiseFill(g,512,512,.3,9000,2,['#555043','#3e3a30','#5d5747','#47432f']);
    for(let i=0;i<520;i++){const x=rnd()*512,y=rnd()*512,r=rr(4,16),v=rr(.6,1.15);
      const base=pick([[118,112,98],[96,92,84],[132,120,98],[86,80,70],[120,116,110],[104,92,74]]);
      for(const dx of [-512,0,512])for(const dy of [-512,0,512]){if(x+dx<-20||x+dx>532||y+dy<-20||y+dy>532) continue;
        const gr=g.createRadialGradient(x+dx-r*.3,y+dy-r*.3,1,x+dx,y+dy,r);gr.addColorStop(0,'rgb('+(base[0]*v*1.25|0)+','+(base[1]*v*1.25|0)+','+(base[2]*v*1.25|0)+')');gr.addColorStop(1,'rgb('+(base[0]*v*.6|0)+','+(base[1]*v*.6|0)+','+(base[2]*v*.6|0)+')');
        g.fillStyle=gr;g.beginPath();g.ellipse(x+dx,y+dy,r,r*rr(.6,.9),rnd()*3,0,TAU);g.fill();}}
    for(let i=0;i<40;i++){const x=rnd()*512,y=rnd()*512,r=rr(20,60);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(60,90,50,.28)');gr.addColorStop(1,'rgba(60,90,50,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}
    const t=tex(c,true);return t;
  }
  {
    const rows=[];
    const SB=[.5,12,40,80,130,200,280];
    for(let k=SB.length-1;k>=0;k--){const E=ENDS[0],sv=SB[k];rows.push([E.x+E.dx*sv,E.z+E.dz*sv,TZ[0],-TX[0],(extW(sv)+3)/22.4]);}
    for(let i=0;i<=NS;i+=6) rows.push([PX[i],PZ[i],TZ[i],-TX[i],1]);
    SB.forEach(sv=>{const E=ENDS[1];rows.push([E.x+E.dx*sv,E.z+E.dz*sv,TZ[NS],-TX[NS],(extW(sv)+3)/22.4]);});
    const cols=[-22.4,-19,-14,-7,0,7,14,19,22.4],dep=l=>-1.95+Math.pow(Math.abs(l)/22.4,2.4)*1.1;
    const pos=[],idx=[],nc=cols.length;
    rows.forEach(([x,z,sx,sz,sc])=>cols.forEach(l=>pos.push(x+sx*l*sc,dep(l),z+sz*l*sc)));
    for(let r=0;r<rows.length-1;r++)for(let c=0;c<nc-1;c++){const a=r*nc+c,b=a+1,d=a+nc,e=d+1;idx.push(a,b,d,b,e,d);}
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    const bedMat=new T3.ShaderMaterial({fog:true,side:T3.DoubleSide,
      uniforms:T3.UniformsUtils.merge([T3.UniformsLib.fog,{tBed:{value:null},tNormal:{value:null},uTime:{value:0},uPool:{value:poolData},uWarm:{value:C('#ffa24a')},uAmb:{value:C('#123a38')}}]),
      vertexShader:'varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader:['uniform sampler2D tBed,tNormal;uniform float uTime;uniform vec4 uPool['+POOL+'];uniform vec3 uWarm,uAmb;varying vec3 vW;',
        '#include <fog_pars_fragment>',
        'void main(){vec2 p=vW.xz;vec3 albedo=texture2D(tBed,p*.16).rgb*.9+texture2D(tBed,p*.043+.37).rgb*.25;',
        ' float c1=texture2D(tNormal,p*.21+vec2(uTime*.035,uTime*.02)).x,c2=texture2D(tNormal,p*.17-vec2(uTime*.025,-uTime*.03)).y;',
        ' float caus=pow(max(0.,1.-abs(c1-c2)*2.4),5.)*.9+.62;',
        ' vec3 light=uAmb*1.7;',
        ' for(int j=0;j<'+POOL+';j++){vec4 o=uPool[j];vec2 d=p-o.xy;float dd=dot(d,d);light+=uWarm*o.w*3.4/(1.+dd*o.z*.38);}',
        ' vec3 col=albedo*light*caus;',
        ' float path=length(cameraPosition-vW)*(-vW.y)/max(cameraPosition.y-vW.y,.3);',
        ' col*=exp(-vec3(.42,.2,.17)*path);',
        ' gl_FragColor=vec4(col,1.);',
        ' #include <fog_fragment>',
        '}'].join('\n')});
    bedMat.uniforms.tBed.value=pebbleTex();bedMat.uniforms.tNormal.value=T.water;bedMat.uniforms.uPool.value=poolData;
    const bed=new T3.Mesh(g,bedMat);bed.renderOrder=-2;scene.add(bed);
    BEDMAT=bedMat;
  }
  // ---------- koi under the clear water: shaped bodies, soft translucent fins, a gentle travelling swim wave ----------
  const KOI=[];let koiParts=[];const _fk={};
  {
    const L=.66;
    // body profile from tail (t=0) to nose (t=1): slim peduncle, full shoulders, rounded head
    const PROF=[[0,.009],[.08,.011],[.18,.02],[.3,.036],[.42,.05],[.55,.058],[.66,.06],[.76,.057],[.85,.049],[.92,.038],[.97,.024],[1,.005]];
    function rAt(t){for(let i=1;i<PROF.length;i++){if(t<=PROF[i][0]){const a=PROF[i-1],b=PROF[i],k=(t-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*k*k*(3-2*k);}}return .004;}
    function paint(pattern,x,y,z,seed){
      const t=z/L+.5,top=y>.0,side=Math.abs(x);
      const n=Math.sin(z*23+seed)+Math.sin(x*41+z*11+seed*1.7)*.7+Math.sin(z*7-seed)*.5;
      let c=[1,.97,.93];
      if(pattern===0){ if(top&&n>-.45) c=[1,.13,.035]; }                     // kohaku: deep red over white
      else if(pattern===1){ c=top?[1,.27,.03]:[1,.86,.7]; if(top&&n>.75) c=[1,.97,.92]; } // orange with white patches
      else if(pattern===2){ if(top){c=n>-.15?[1,.22,.05]:n<-.95?[.07,.06,.06]:[1,.96,.9];} } // sanke: red and white, a few small black marks
      else if(pattern===3){ c=top?(n>.9?[1,.95,.88]:[.95,.17,.04]):[1,.6,.42]; } // benigoi: red orange, a touch of white
      // three accent fish that swim with your lantern, so the school reads as a mixed group
      else if(pattern===4){ c=top?(n>1.2?[1,.68,.2]:[1,.5,.06]):[1,.72,.34]; } // yamabuki ogon: solid warm gold
      else if(pattern===5){ const scale=Math.sin(z*150)*Math.sin(x*150+z*75);c=top&&y>.02?(scale>.6?[.34,.48,.7]:[.2,.32,.52]):[1,.36,.09]; } // asagi: slate blue net over an orange belly
      else { c=top?(n>.25?[1,.3,.05]:[.07,.065,.075]):(n>-.3?[1,.42,.12]:[.1,.09,.1]); } // hi utsuri: charcoal with bold orange
      if(t>.9&&top&&pattern<3) c=c.map(v=>v*.92+.06);
      if(!top) c=c.map(v=>v*.88+.1);
      return c;
    }
    function bodyGeo(pattern,seed){
      const g=new T3.CylinderGeometry(1,1,1,20,44,false);
      const p=g.attributes.position,col=new Float32Array(p.count*3);
      for(let i=0;i<p.count;i++){
        const yy=p.getY(i)+.5,ang=Math.atan2(p.getZ(i),p.getX(i)),r=rAt(yy);
        const x=Math.cos(ang)*r*1.02,y=-Math.sin(ang)*r*.9+(yy>.3&&yy<.8?Math.max(0,-Math.sin(ang))*.006:0),z=(yy-.5)*L;
        p.setXYZ(i,x,y,z);
        let c=paint(pattern,x,y,z,seed);
        // eyes
        const ez=L*.42,ex=.036;if(Math.abs(z-ez)<.009&&Math.abs(Math.abs(x)-ex)<.011&&y>-.01&&y<.03) c=[.04,.04,.05];
        col[i*3]=c[0];col[i*3+1]=c[1];col[i*3+2]=c[2];
      }
      g.setAttribute('color',new T3.BufferAttribute(col,3));g.computeVertexNormals();
      return g;
    }
    function finGeo(pattern){
      const P=[],C=[],tz=-L/2;
      const tint=pattern===1?[1,.7,.42]:pattern===3?[1,.62,.4]:pattern===4?[1,.82,.42]:pattern===5?[1,.56,.34]:pattern===6?[1,.5,.26]:[1,.88,.82];
      const tri=(a,b,c)=>{P.push(...a,...b,...c);for(let k=0;k<3;k++) C.push(...tint);};
      // forked tail, almost flat so it reads from above, slightly lifted at the tips
      const fan=[[0,.0,tz+.015],[.016,.0,tz-.05],[.07,.01,tz-.15],[.04,.008,tz-.115],[0,.0,tz-.085],[-.04,.008,tz-.115],[-.07,.01,tz-.15],[-.016,0,tz-.05]];
      for(let k=1;k<fan.length-1;k++) tri(fan[0],fan[k],fan[k+1]);tri(fan[0],fan[fan.length-1],fan[1]);
      // pectoral fins: rounded paddles behind the head
      [-1,1].forEach(s=>{const o=[s*.05,-.022,L*.24];const pts=[];for(let k=0;k<=6;k++){const a=k/6*Math.PI;pts.push([o[0]+s*(.012+Math.sin(a)*.055),o[1]-.006*Math.sin(a),o[2]-.01-(1-Math.cos(a))*.032]);}for(let k=0;k<6;k++) tri(o,pts[k],pts[k+1]);});
      // pelvic fins and a low dorsal fin
      [-1,1].forEach(s=>{const o=[s*.035,-.04,-L*.02];tri(o,[s*.07,-.045,-L*.08],[s*.04,-.042,-L*.12]);});
      for(let k=0;k<6;k++){const z0=L*(.18-k*.07),z1=L*(.18-(k+1)*.07),h0=.018*Math.sin((k+.5)/6*Math.PI)+.004;tri([0,rAt(z0/L+.5)*.82,z0],[0,rAt(z0/L+.5)*.82+h0,z0-.01],[0,rAt(z1/L+.5)*.82,z1]);}
      const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(P,3));g.setAttribute('color',new T3.Float32BufferAttribute(C,3));g.computeVertexNormals();
      return g;
    }
    const zones=[[STOP[0]+9/LEN,4.5,4],[STOP[0]+18/LEN,-5,3],[U_BRIDGE-10/LEN,-6,4],[U_BRIDGE+14/LEN,5,3],[STOP[2]+12/LEN,3.5,4],[U_PIER+3/LEN,-9,4],[STOP[3]+16/LEN,6,3],[STOP[4]+9/LEN,2.5,3],[STOP[5]+11/LEN,-3,4],[U_WISH-4/LEN,-12,3]];
    const per=[[],[],[],[],[],[],[]];
    zones.forEach(([u,lat,n])=>{if(LOWQ) n=Math.max(1,n-2);const c=at(u,lat,0);
      for(let k=0;k<n;k++){const pat=pick([0,0,0,1,1,1,2,2,3]);
        const f={cx:c.x,cz:c.z,R:rr(3.2,4.8),x:c.x+rr(-2,2),z:c.z+rr(-2,2),h:rnd()*TAU,sp:rr(.18,.3),tx:0,tz:0,y:rr(-.8,-.38),pat,swim:.5,ph:rnd()*TAU,s:rr(.8,1.2),glide:0,pause:0};
        f.tx=f.cx+rr(-f.R,f.R);f.tz=f.cz+rr(-f.R,f.R);f.idx=per[pat].length;per[pat].push(f);KOI.push(f);}});
    // a small school that keeps company with your lantern wherever it drifts: their home pool follows the lantern
    {const c=at(STOP[0],0,0);for(let k=0;k<(LOWQ?8:14);k++){const pat=k<3?4+k:pick([0,0,0,1,1,1,2,2,3]);
      const a=rnd()*TAU,r=rr(3.5,6.5);
      const f={roam:true,cx:c.x,cz:c.z,R:6.5,x:c.x+Math.cos(a)*r,z:c.z+Math.sin(a)*r,h:rnd()*TAU,sp:rr(.22,.34),tx:c.x,tz:c.z,y:rr(-.85,-.45),pat,swim:.5,ph:rnd()*TAU,s:rr(.85,1.2),glide:0,pause:0,u:STOP[0]};f.y=rr(-.7,-.36);
      f.idx=per[pat].length;per[pat].push(f);KOI.push(f);}}
    const wag=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vColor*.42;');sh.uniforms.uTime=uTime;sh.vertexShader='uniform float uTime;\nattribute vec2 aSwim;\n'+sh.vertexShader.replace('#include <begin_vertex>',
      // a travelling wave, a few millimetres at the head growing to a few centimetres at the tail fork
      '#include <begin_vertex>\nfloat tz=clamp((.22-transformed.z)/.66,0.,1.);float amp=(.003+.024*tz*tz)*(.45+.55*aSwim.y);transformed.x+=sin(aSwim.x-transformed.z*8.)*amp;');};
    koiParts=[0,1,2,3,4,5,6].map(pat=>{
      const n=Math.max(1,per[pat].length),swim=new Float32Array(n*2);
      const bg=bodyGeo(pat,pat*1.9+.7),fg=finGeo(pat);
      const sa=new T3.InstancedBufferAttribute(swim,2);sa.setUsage(T3.DynamicDrawUsage);bg.setAttribute('aSwim',sa);fg.setAttribute('aSwim',sa);
      const bm=new T3.MeshStandardMaterial({vertexColors:true,roughness:.32,metalness:.06,emissive:new T3.Color(.07,.055,.05)});bm.onBeforeCompile=wag;bm.customProgramCacheKey=()=>'koibody';
      const fm=new T3.MeshStandardMaterial({vertexColors:true,roughness:.5,transparent:true,opacity:.55,side:T3.DoubleSide,depthWrite:false,emissive:new T3.Color(.06,.05,.045)});fm.onBeforeCompile=wag;fm.customProgramCacheKey=()=>'koifin';
      const b=new T3.InstancedMesh(bg,bm,n),f=new T3.InstancedMesh(fg,fm,n);
      b.count=f.count=per[pat].length;b.frustumCulled=f.frustumCulled=false;b.renderOrder=-1.6;f.renderOrder=-1.55;scene.add(b,f);
      return {b,f,swim,list:per[pat]};
    });
  }
  function updateKoi(dt,t){
    const hx=hero.position.x,hz=hero.position.z;const k=RM?.3:1;let respawned=false;
    KOI.forEach(f=>{
      if(f.roam){
        f.cx=damp(f.cx,hx,.9,dt);f.cz=damp(f.cz,hz,.9,dt);
        // left far behind by a fast lantern: slip back in quietly, deep and well ahead of it
        if(!respawned&&Math.hypot(f.x-hx,f.z-hz)>30){respawned=true;const hd=S.heading+rr(-.6,.6),r=rr(16,22);f.x=hx+Math.sin(hd)*r;f.z=hz+Math.cos(hd)*r;f.h=hd+Math.PI+rr(-.8,.8);f.v=.2;f.cx=hx;f.cz=hz;}
        // stay inside the river walls
        f.u=nearestU(f.x,f.z,f.u,14);frame(f.u,_fk);const lat=(f.x-_fk.x)*_fk.sx+(f.z-_fk.z)*_fk.sz,lim=HW-1.6;
        if(Math.abs(lat)>lim){const o=Math.abs(lat)-lim,sg=Math.sign(lat);f.x-=_fk.sx*sg*o;f.z-=_fk.sz*sg*o;f.tx=f.cx;f.tz=f.cz;}
      }
      // wander: steer softly toward a target inside the home pool, glide now and then, dart away from a lantern overhead
      const dxh=f.x-hx,dzh=f.z-hz,dh=Math.hypot(dxh,dzh);
      let tx=f.tx-f.x,tz=f.tz-f.z,dist=Math.hypot(tx,tz);
      if(dist<.6||Math.hypot(f.tx-f.cx,f.tz-f.cz)>f.R*1.2){const a=rnd()*TAU,r=f.roam?rr(3.4,f.R):Math.sqrt(rnd())*f.R;f.tx=f.cx+Math.cos(a)*r;f.tz=f.cz+Math.sin(a)*r;if(rnd()<.35) f.glide=rr(1.2,2.6);}
      let want=Math.atan2(tx,tz),spd=f.sp;
      if(f.roam){const dH=Math.hypot(f.x-f.cx,f.z-f.cz);spd=lerp(spd,1.7,clamp((dH-f.R*1.2)/9,0,1));}
      const fear=smooth(clamp((3-dh)/2,0,1));
      if(fear>0){const aw=Math.atan2(dxh,dzh);if(f.esc==null) f.esc=aw;let de=aw-f.esc;de=Math.atan2(Math.sin(de),Math.cos(de));f.esc+=de*Math.min(1,dt*1.5);const away=f.esc;let da=away-want;da=Math.atan2(Math.sin(da),Math.cos(da));want+=da*fear;spd=lerp(spd,.6,fear);f.glide=0;}
      else f.esc=null;
      if(f.glide>0){f.glide-=dt;spd*=.5;}
      let dhd=want-f.h;dhd=Math.atan2(Math.sin(dhd),Math.cos(dhd));
      f.turnV=damp(f.turnV||0,clamp(dhd*1.4,-1.5,1.5),3,dt);f.h+=f.turnV*dt;
      f.v=damp(f.v||0,spd,1.8,dt);
      f.x+=Math.sin(f.h)*f.v*dt*k;f.z+=Math.cos(f.h)*f.v*dt*k;
      const sw=clamp((f.v-.08)*2.2,0,1)*(f.glide>0?.25:1);f.swimV=damp(f.swimV||.4,sw,1.6,dt);
      f.wp=(f.wp||f.ph)+dt*k*(2.6+f.swimV*3.4);
      const turn=clamp(f.turnV*.12,-.14,.14);
      _m.compose(_v.set(f.x,f.y+Math.sin(t*.6+f.ph)*.04,f.z),_q.setFromEuler(_e.set(0,f.h,-turn)),_s.set(f.s,f.s,f.s));
      const P=koiParts[f.pat];P.b.setMatrixAt(f.idx,_m);P.f.setMatrixAt(f.idx,_m);P.swim[f.idx*2]=f.wp;P.swim[f.idx*2+1]=f.swimV;
    });
    koiParts.forEach(P=>{P.b.instanceMatrix.needsUpdate=true;P.f.instanceMatrix.needsUpdate=true;P.b.geometry.attributes.aSwim.needsUpdate=true;});
  }
  // ---------- banks: quay wall, walkway, ground ----------
  function strip(side,cols,material,uvScale){
    const rows=[];for(let i=0;i<=NS;i+=4) rows.push(i);
    const pos=[],uv=[],idx=[],nc=cols.length;let acc=0;
    rows.forEach((i,ri)=>{
      if(ri>0){const j=rows[ri-1];acc+=Math.hypot(PX[i]-PX[j],PZ[i]-PZ[j]);}
      const sx=TZ[i]*side,sz=-TX[i]*side;let across=0;
      cols.forEach((c,ci)=>{
        let off=c[0];
        if(off>34){
          for(let it=0;it<4;it++){const x=PX[i]+sx*off,z=PZ[i]+sz*off;const u=nearestU(x,z,i/NS);const d=Math.hypot(PX[Math.round(u*NS)]-x,PZ[Math.round(u*NS)]-z);if(d<off*.97){off=Math.max(34,off-(off-d)*1.15);}else break;}
        }
        if(ci>0) across+=Math.hypot(c[0]-cols[ci-1][0],c[1]-cols[ci-1][1]);
        pos.push(PX[i]+sx*off,c[1],PZ[i]+sz*off);uv.push(acc/uvScale,across/uvScale);
      });
    });
    for(let r=0;r<rows.length-1;r++)for(let c=0;c<nc-1;c++){const a=r*nc+c,b=a+1,d=a+nc,e=d+1;idx.push(a,d,b,b,d,e);}
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T3.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    const m=new T3.Mesh(g,material);scene.add(m);return m;
  }
  [1,-1].forEach(sd=>{
    strip(sd,[[22,-3],[22,2.2],[22.2,2.46],[23.3,2.46]],mat.stone,6);
    strip(sd,[[23.3,2.46],[30.5,2.46]],mat.paving,5);
    strip(sd,[[30.5,2.44],[48,2.6],[90,3.1],[220,4.2]],mat.ground,10);
  });
  onProgress(.38);

  // ---------- terrain: the town ground continues into low hills, the river carves on past both ends ----------
  {
    let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
    const grow=(x,z)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);};
    for(let i=0;i<=NS;i+=40) grow(PX[i],PZ[i]);
    ENDS.forEach(E=>grow(E.x+E.dx*EXT_LEN,E.z+E.dz*EXT_LEN));
    const pad=520;minX-=pad;maxX+=pad;minZ-=pad;maxZ+=pad;
    const cell=LOWQ?16:10,nx=Math.ceil((maxX-minX)/cell),nz=Math.ceil((maxZ-minZ)/cell);
    const pos=new Float32Array((nx+1)*(nz+1)*3),uv=new Float32Array((nx+1)*(nz+1)*2),col=new Float32Array((nx+1)*(nz+1)*3),idx=[];
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const k=j*(nx+1)+i,x=minX+i*cell,z=minZ+j*cell,y=terrH(x,z);
      pos[k*3]=x;pos[k*3+1]=y;pos[k*3+2]=z;uv[k*2]=x/10;uv[k*2+1]=z/10;
      const wet=y<.6?.55:1,hill=clamp((y-5)/60,0,1);col[k*3]=wet*(1-hill*.25);col[k*3+1]=wet*(1-hill*.1);col[k*3+2]=wet*(1+hill*.15);
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;idx.push(a,c,b,b,c,d);}
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.BufferAttribute(pos,3));g.setAttribute('uv',new T3.BufferAttribute(uv,2));g.setAttribute('color',new T3.BufferAttribute(col,3));
    g.setIndex(idx);g.computeVertexNormals();
    const tm=mat.ground.clone();tm.vertexColors=true;tm.side=T3.FrontSide;
    const terr=new T3.Mesh(g,tm);scene.add(terr);
  }
  // ---------- instancing registries ----------
  const LAN=[];      // hanging lanterns {p,s,sy,c}
  const BOX=[];      // generic boxes {m: Matrix4, mat key}
  const LANTERN_COLS=[[1.9,.95,.35],[1.8,.55,.18],[1.7,.28,.16],[1.9,1.4,.5],[1.6,.42,.28],[1.85,1.2,.42],[.6,1.35,1.0],[1.7,.5,.6]];
  const warmCols=[[1.9,.95,.35],[1.8,.55,.18],[1.7,.28,.16],[1.9,1.4,.5],[1.85,1.2,.42]];
  function addLantern(p,opts){opts=opts||{};LAN.push({p:p.clone(),s:opts.s||rr(.85,1.25),sy:opts.sy||rr(.85,1.2),c:opts.c||pick(rnd()<.7?warmCols:LANTERN_COLS)});}
  const _m=new T3.Matrix4(),_q=new T3.Quaternion(),_v=new T3.Vector3(),_s=new T3.Vector3(),_e=new T3.Euler(),_up=new T3.Vector3(0,1,0);
  const yawFace=(dx,dz)=>Math.atan2(dx,dz);

  // ---------- shophouses ----------
  const B={body:[],roof:[],shop:[],win:[],slab:[],rail:[],spill:[]};
  const bodyCols=['#d8a647','#e2b552','#cf9b3e','#e0b860','#d4aa55','#c99a44','#7fa3a6','#d6c6a8','#cf8f5f','#e3bc68'];
  const skip=(u,side)=>{
    const m=M(u);
    if(Math.abs(m-M(U_BRIDGE))<16) return true;
    return false;
  };
  const TALL=[];
  const B2={sign:[],canopy:[]},B3={floor:[],beam:[],post:[],lattice:[],pot:[],plant:[]};
  function storeys(u){
    const nearTall=[STOP[2],STOP[5],UM(.47),UM(.83)].some(s=>Math.abs(M(u)-M(s))<28);
    const r=rnd(),t3=nearTall?.14:.04,t25=nearTall?.18:.07;
    if(r<t3) return 3;if(r<t3+t25) return 2.5;if(r<t3+t25+.55) return 2;return 1;
  }
  function shophouse(u,side){
    frame(u,_f);
    const st=storeys(u),w=rr(6.2,9.4)*(st>=2.5?rr(1,1.12):1),d=rr(8,10.5);
    const h=st===1?rr(4.4,5.2):st===2?rr(6.8,8.0):st===2.5?rr(8.6,9.3):rr(10.2,11.2);
    const front=30.8+rr(0,1.4),off=front+d/2;
    const cx=_f.x+_f.sx*off*side,cz=_f.z+_f.sz*off*side;
    const yaw=yawFace(-_f.sx*side,-_f.sz*side);
    const base=new T3.Matrix4().compose(new T3.Vector3(cx,2.45,cz),_q.setFromEuler(_e.set(0,yaw,0)),new T3.Vector3(1,1,1));
    const local=(x,y,z,sx,sy,sz,ry)=>{const m=new T3.Matrix4().compose(new T3.Vector3(x,y,z),new T3.Quaternion().setFromEuler(new T3.Euler(0,ry||0,0)),new T3.Vector3(sx,sy,sz));return base.clone().multiply(m);};
    const col=C(pick(bodyCols));col.multiplyScalar(rr(.82,1.05));
    B.body.push({m:local(0,h/2,0,w,h,d),c:col});
    const rh=rr(2,2.7)*(st>=2.5?1.1:1);
    B.roof.push({m:local(0,h-.05,0,w+1.1,rh,d+1.8),c:new T3.Color(rr(.7,1),rr(.68,.9),rr(.62,.85))});
    // ground floor: a different trade behind every front
    const fz=d/2+.03,style=rnd();
    const tile=()=>(rnd()*8)|0;
    const shopBright=t=>new T3.Color().setScalar(t===3?.62:rr(.82,1.12));
    let main=tile();
    if(style<.55){const sw=w*rr(.52,.7);B.shop.push({m:local(rr(-.4,.4)*w*.15,1.35,fz,sw,2.5,1),t:main,c:shopBright(main)});B.spill.push({m:local(0,.03,d/2+2.2,w*.95,1,3.8),c:new T3.Color().setScalar(main===3?.25:rr(.8,1.1))});}
    else if(style<.8){const t2=tile();[[-.24,main],[.24,t2]].forEach(([px,t])=>{B.shop.push({m:local(px*w,1.3,fz,w*.36,2.4,1),t,c:shopBright(t)});B.spill.push({m:local(px*w,.03,d/2+2,w*.42,1,3.4),c:new T3.Color().setScalar(t===3?.25:rr(.7,1))});});}
    else{const sx=rnd()<.5?-1:1;B.shop.push({m:local(sx*w*.18,1.3,fz,w*.42,2.4,1),t:main,c:shopBright(main)});B.win.push({m:local(-sx*w*.27,1.55,fz,1.15,1.5,1),t:pick([0,2,5,6]),c:new T3.Color().setScalar(rr(.8,1.05))});B.spill.push({m:local(sx*w*.18,.03,d/2+2,w*.5,1,3.4),c:new T3.Color().setScalar(main===3?.25:rr(.8,1))});}
    // signboard above the front, sometimes under a tiled canopy
    if(rnd()<.8){const sgW=Math.min(w*.7,4.8);B2.sign.push({m:local(rr(-.3,.3)*(w-sgW)*.5,3.0,fz+.02,sgW,Math.min(.8,sgW*.2),1),t:main===3?pick([0,1,2,4,5,6,7]):main,c:new T3.Color().setScalar(rr(.85,1.1))});}
    const canopy=st>=2&&rnd()<.45;
    if(canopy) B2.canopy.push({m:local(0,3.48,d/2+.05,w*1.01,.75,2.3),c:new T3.Color(rr(.7,1),rr(.68,.9),rr(.62,.85))});
    // upper floors: windows per storey, an attic window on two and a half storey houses
    const floors=Math.floor(st);
    const nw=w>8.4?3:2;
    for(let f=2;f<=floors;f++){
      const wy=(f-1)*3.15+1.75;
      for(let k=0;k<nw;k++){const px=(k-(nw-1)/2)*(w/(nw+.2));B.win.push({m:local(px,wy,fz,1.05,1.45,1),t:(rnd()*8)|0,c:new T3.Color().setScalar(rr(.75,1.08))});}
      if(f===2&&!canopy&&rnd()<.5){B.slab.push({m:local(0,3.5,d/2+.55,w*.92,.14,1.1)});B.rail.push({m:local(0,3.95,d/2+1.08,w*.92,.85,1)});
        const n=Math.max(2,Math.round(w/2.4));for(let k=0;k<n;k++){const lp=new T3.Vector3((k-(n-1)/2)*(w*.8/n),3.4,d/2+.9).applyMatrix4(base);addLantern(lp,{s:rr(.8,1)});}}
      if(f===3){
        TALL.push([u,side]);
        // third floor veranda: lacquered posts, lattice railing, its own tiled eave, lanterns and potted plants
        const z0=d/2,dp=1.75,fy=6.55,vw=w*.98;
        B3.floor.push({m:local(0,fy,z0+dp/2,vw,.16,dp)});
        for(const bx of [-.42,0,.42]) B3.beam.push({m:local(bx*vw,fy-.26,z0+dp*.45,.14,.36,dp*.9)});
        const np=vw>8.4?4:3;
        for(let k=0;k<np;k++){const px=(k/(np-1)-.5)*(vw-.2);B3.post.push({m:local(px,fy+1.36,z0+dp-.1,.16,2.6,.16)});B3.post.push({m:local(px,fy+.06,z0+dp-.1,.26,.12,.26)});}
        B3.lattice.push({m:local(0,fy+.52,z0+dp-.06,vw-.2,.82,1)});
        [-1,1].forEach(sx=>B3.lattice.push({m:local(sx*(vw/2-.1),fy+.52,z0+dp/2,dp-.12,.82,1,Math.PI/2)}));
        B3.beam.push({m:local(0,fy+.97,z0+dp-.06,vw-.1,.08,.12)});
        B3.beam.push({m:local(0,fy+2.62,z0+dp-.1,vw+.1,.18,.2)});
        B2.canopy.push({m:local(0,fy+2.66,z0+.02,vw+.9,.85,2*(dp+.55)),c:new T3.Color(rr(.8,1),rr(.6,.75),rr(.5,.62))});
        const nl=np-1;for(let k=0;k<nl;k++){const lp=new T3.Vector3(((k+.5)/nl-.5)*(vw-.2),fy+2.5,z0+dp-.12).applyMatrix4(base);addLantern(lp,{s:1.05,c:pick([[1.8,.36,.18],[1.9,1.05,.4],[1.75,.3,.2]])});}
        // flower boxes on the rail: bougainvillea spilling over the front
        const nbox=np-1;for(let k=0;k<nbox;k++){const px=((k+.5)/nbox-.5)*(vw-.2),bw=Math.min(1.3,(vw-.2)/nbox*.6);
          B3.pot.push({m:local(px,fy+1.13,z0+dp+.02,bw,.2,.3)});
          for(let b=0;b<5;b++){const pink=rnd()<.6;B3.plant.push({m:local(px+rr(-.45,.45)*bw,fy+1.26+rr(-.16,.12),z0+dp+.1+rr(-.05,.12),rr(.16,.26),rr(.12,.22),rr(.14,.22)),c:pink?new T3.Color(rr(1.3,1.6),rr(.35,.5),rr(.75,.95)):new T3.Color(rr(.55,.8),rr(.9,1.1),rr(.5,.7))});}}
      }
    }
    if(st===2.5) B.win.push({m:local(0,floors*3.15+1.05,fz,.9,.9,1),t:pick([0,2,5,6,1]),c:new T3.Color().setScalar(rr(.8,1.05))});
    const n=Math.max(3,Math.round(w/1.9));
    for(let k=0;k<n;k++){if(LOWQ&&k%2) continue;const lp=new T3.Vector3((k-(n-1)/2)*(w*.86/n),h-.1,d/2+.7).applyMatrix4(base);addLantern(lp);}
    return w;
  }
  [1,-1].forEach(sd=>{
    let m=4;
    while(m<LEN-4){const u=m/LEN;let w=8;if(!skip(u,sd)) w=shophouse(u,sd);m+=w+rr(.3,1.4);}
  });
  function inst(geo,material,list,colorKey){
    if(!list.length) return null;
    const im=new T3.InstancedMesh(geo,material,list.length);
    list.forEach((o,i)=>{im.setMatrixAt(i,o.m);if(colorKey&&o.c) im.setColorAt(i,o.c);});
    im.instanceMatrix.needsUpdate=true;if(im.instanceColor) im.instanceColor.needsUpdate=true;
    scene.add(im);return im;
  }
  const boxG=new T3.BoxGeometry(1,1,1);
  const planeG=new T3.PlaneGeometry(1,1);
  inst(boxG,mat.wall,B.body,true);
  const rg=roofGeo();inst(rg,mat.roof,B.roof,true);
  function instTiled(material,list,cols,rows,key){
    if(!list.length) return null;
    const g=planeG.clone(),at=new Float32Array(list.length*2);
    list.forEach((o,i)=>{const t=o.t||0,c=t%cols,r=Math.floor(t/cols);at[i*2]=c/cols;at[i*2+1]=(rows-1-r)/rows;});
    g.setAttribute('aTile',new T3.InstancedBufferAttribute(at,2));
    material.onBeforeCompile=sh=>{sh.vertexShader='attribute vec2 aTile;\n'+sh.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_UV\nvUv=vUv*vec2('+(1/cols).toFixed(4)+','+(1/rows).toFixed(4)+')+aTile;\n#endif');};
    material.customProgramCacheKey=()=>key;
    return inst(g,material,list,true);
  }
  instTiled(mat.shop,B.shop,4,2,'shopatlas');instTiled(mat.win,B.win,4,2,'winatlas');instTiled(mat.sign,B2.sign,2,4,'signatlas');
  inst(rg,mat.roof,B2.canopy,true);
  inst(boxG,mat.darkwood,B3.floor);inst(boxG,mat.wood,B3.beam);inst(boxG,mat.lacquer,B3.post);
  inst(planeG,mat.lattice,B3.lattice);
  inst(boxG,new T3.MeshStandardMaterial({color:C('#7a3a22'),roughness:.8}),B3.pot);
  inst(new T3.IcosahedronGeometry(.5,1),new T3.MeshBasicMaterial({color:new T3.Color(.42,.36,.32)}),B3.plant,true);
  inst(boxG,mat.wood,B.slab);inst(planeG,mat.rail,B.rail);
  {
    const spillG=new T3.PlaneGeometry(1,1);spillG.rotateX(-Math.PI/2);
    inst(spillG,new T3.MeshBasicMaterial({map:T.glow,color:C('#ff9a4a').multiplyScalar(.5),transparent:true,depthWrite:false,blending:T3.AdditiveBlending}),B.spill,true);
  }
  onProgress(.5);

  // ---------- lamp posts along walkways with garlands near zones ----------
  const CLOCK_SPOTS=[[STOP[2]+19/LEN,22.75,2.6,2.0,STOP[2]-10/LEN],[STOP[5]+26/LEN,-22.75,2.6,2.0,STOP[5]-10/LEN]];
  const CLOCK_BASES=CLOCK_SPOTS.map(c=>at(c[0],c[1],2.46));
  const nearClock=(p,r)=>CLOCK_BASES.some(b=>Math.hypot(b.x-p.x,b.z-p.z)<r);
  const POSTS=[],GARL=[];
  [1,-1].forEach(sd=>{
    for(let m=10;m<LEN-10;m+=LOWQ?24:18){
      const u=m/LEN;if(Math.abs(m-M(U_BRIDGE))<20) continue;
      const p=at(u,23.9*sd,2.46);if(nearClock(p,7)) continue;POSTS.push({p,sd,u});
    }
  });
  const postParts=[];
  POSTS.forEach((o,i)=>{
    postParts.push({m:new T3.Matrix4().compose(new T3.Vector3(o.p.x,o.p.y+2.3,o.p.z),_q.identity(),new T3.Vector3(.11,4.6,.11))});
    addLantern(new T3.Vector3(o.p.x,o.p.y+4.4,o.p.z),{s:1.3,sy:1.1});
    const nxt=POSTS[i+1];
    const nearZone=STOP.some(s=>Math.abs(o.u-s)<UM(.05))||(LOWQ?false:rnd()<.12);
    if(nxt&&nxt.sd===o.sd&&nearZone&&o.p.distanceTo(nxt.p)<30&&!nearClock(o.p.clone().lerp(nxt.p,.5),12)){
      const n=6;for(let k=1;k<n;k++){const t=k/n;const p=o.p.clone().lerp(nxt.p,t);p.y+=4.3-Math.sin(Math.PI*t)*.9;addLantern(p,{s:rr(.75,.95)});}
      GARL.push([o.p.clone().setY(o.p.y+4.3),nxt.p.clone().setY(nxt.p.y+4.3),.9]);
    }
  });
  inst(boxG,mat.darkwood,postParts);

  // ---------- strings of lanterns across the river ----------
  const ACROSS=[];
  function acrossString(u,height,sag,spacing){
    const a=at(u,-23.6,2.46),b=at(u,23.6,2.46);
    postParts2.push(a.clone(),b.clone());
    const A=a.clone().setY(height),Bp=b.clone().setY(height);
    ACROSS.push([A,Bp,sag]);
    const n=Math.floor(A.distanceTo(Bp)/spacing);
    for(let k=1;k<n;k++){const t=k/n;const p=A.clone().lerp(Bp,t);p.y-=Math.sin(Math.PI*t)*sag;addLantern(p,{s:rr(.95,1.3),c:pick(LANTERN_COLS)});}
  }
  const postParts2=[];
  [.052,.066,.081,.391,.403,.415,.428,.441,.951,.963,.976].map(UM).forEach((u,i)=>acrossString(u,rr(8.4,9.6),rr(1.8,2.6),rr(1.45,1.8)));
  {
    const list=postParts2.map(p=>({m:new T3.Matrix4().compose(new T3.Vector3(p.x,p.y+4.6,p.z),_q.identity(),new T3.Vector3(.16,9.2,.16))}));
    inst(boxG,mat.darkwood,list);
  }
  // cords as thin tubes merged into one mesh
  {
    const tubes=[];
    ACROSS.concat(GARL).forEach(([A,Bp,sag])=>{
      const pts=[];for(let k=0;k<=16;k++){const t=k/16;const p=A.clone().lerp(Bp,t);p.y-=Math.sin(Math.PI*t)*sag;pts.push(p);}
      tubes.push(new T3.TubeGeometry(new T3.CatmullRomCurve3(pts),16,.018,3,false));
    });
    if(tubes.length){const g=merge(tubes);scene.add(new T3.Mesh(g,mat.rope));}
  }
  onProgress(.58);

  // ---------- covered bridge ----------
  let bridgeClockAnchor=null,bridgeDigitalAnchor=null;
  {
    frame(U_BRIDGE,_f);
    const G=new T3.Group();
    const S=new T3.Vector3(_f.sx,0,_f.sz),Tg=new T3.Vector3(_f.tx,0,_f.tz);
    G.matrixAutoUpdate=false;
    G.matrix.makeBasis(S,_up,Tg).setPosition(_f.x,0,_f.z);
    scene.add(G);
    BRF={x:_f.x,z:_f.z,sx:_f.sx,sz:_f.sz,tx:_f.tx,tz:_f.tz};
    // stone arch body
    const sh=new T3.Shape();sh.moveTo(-28,-3);sh.lineTo(-28,7.2);sh.lineTo(28,7.2);sh.lineTo(28,-3);sh.lineTo(-28,-3);
    const hole=new T3.Path();hole.moveTo(-15,-2.9);hole.lineTo(-15,2.4);
    for(let k=0;k<=24;k++){const a=Math.PI-k/24*Math.PI;hole.lineTo(Math.cos(a)*15,2.4+Math.sin(a)*3.9);}
    hole.lineTo(15,-2.9);hole.lineTo(-15,-2.9);sh.holes.push(hole);
    const archG=new T3.ExtrudeGeometry(sh,{depth:6.4,bevelEnabled:false,curveSegments:24});
    archG.translate(0,0,-3.2);
    {const p=archG.attributes.position,uv=archG.attributes.uv;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=Math.abs(z)>3.1?[x/6,y/6]:[x/6+z/6,y/6+z/6];uv.setXY(i,n[0],n[1]);}uv.needsUpdate=true;}
    G.add(new T3.Mesh(archG,mat.stone));
    const deck=new T3.Mesh(new T3.BoxGeometry(57,.45,7.2),mat.darkwood);deck.position.set(0,7.4,0);G.add(deck);
    // pavilion
    const L2=12.5;
    const colG=new T3.CylinderGeometry(.19,.21,3.4,10);
    for(let x=-L2;x<=L2+.01;x+=L2/4)[-3.05,3.05].forEach(z=>{const c=new T3.Mesh(colG,mat.lacquer);c.position.set(x,9.3,z);G.add(c);});
    const beam=new T3.BoxGeometry(L2*2+.8,.32,.34);
    [-3.05,3.05].forEach(z=>{const b1=new T3.Mesh(beam,mat.lacquer);b1.position.set(0,11.05,z);G.add(b1);const b2=new T3.Mesh(beam,mat.darkwood);b2.position.set(0,8.05,z);G.add(b2);});
    const rail=new T3.PlaneGeometry(L2*2,1);
    [-3.1,3.1].forEach(z=>{const r=new T3.Mesh(rail,mat.lattice);r.position.set(0,8.65,z);r.material.map.repeat.set(10,1);G.add(r);});
    // curved tile roof with upturned eaves
    function curvedRoof(L,Wd,base,ridge,up,seg){
      const nx=seg,nv=14,pos=[],uv=[],idx=[];
      for(let i=0;i<=nx;i++){const x=(i/nx*2-1)*L;for(let j=0;j<=nv;j++){const v=j/nv*2-1;const av=Math.abs(v),ax=Math.abs(x)/L;
        const y=base+ridge*Math.pow(1-av,1.15)+up*Math.pow(ax,6)*av*av+.25*Math.pow(av,8);
        pos.push(x*(1+.04*av),y,v*Wd);uv.push(x/2.2,v*Wd/1.6);}}
      for(let i=0;i<nx;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+1,c=a+nv+1,d=c+1;idx.push(a,b,c,b,d,c);}
      const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T3.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
    }
    const roofM=mat.roof.clone();roofM.color=C('#c8a088');
    G.add(new T3.Mesh(curvedRoof(L2+1.6,4.9,11.2,2.6,1.4,40),roofM));
    G.add(new T3.Mesh(curvedRoof(3.6,3.4,13.2,1.5,.9,12),roofM));
    const ridgeB=new T3.Mesh(new T3.BoxGeometry(L2*2+2.6,.3,.34),mat.darkwood);ridgeB.position.set(0,13.85,0);G.add(ridgeB);
    const ridge2=new T3.Mesh(new T3.BoxGeometry(7.6,.28,.3),mat.darkwood);ridge2.position.set(0,14.75,0);G.add(ridge2);
    [-1,1].forEach(s=>{const tip=new T3.Mesh(new T3.ConeGeometry(.22,.9,8),mat.lacquer);tip.position.set(s*(L2+1.5),14.15,0);tip.rotation.z=-s*.7;G.add(tip);});
    // gable fills
    [-1,1].forEach(s=>{const sh2=new T3.Shape();sh2.moveTo(-3.4,0);sh2.lineTo(0,2.4);sh2.lineTo(3.4,0);sh2.lineTo(-3.4,0);const gm=new T3.Mesh(new T3.ShapeGeometry(sh2),mat.darkwood);gm.position.set(s*(L2+.6),11.2,0);gm.rotation.y=Math.PI/2;G.add(gm);});
    // shrine plaque and clock board facing upstream (-T side)
    // upstream face: a large analog TimerMo clock; downstream face: a TimerMo digital clock, so you always know which side you are on
    // upstream: analog clock 20% larger than the first cut; downstream: digital clock and a date panel side by side, centred over the arch
    const board=new T3.Mesh(new T3.BoxGeometry(3.45,4.25,.16),mat.darkwood);board.position.set(0,7.92,-3.5);
    const bTrim=new T3.Mesh(new T3.BoxGeometry(3.63,.14,.22),mat.lacquer);bTrim.position.set(0,10.09,-3.5);G.add(bTrim);const bTrim2=bTrim.clone();bTrim2.position.y=5.75;G.add(bTrim2);G.add(board);
    bridgeClockAnchor={group:G,pos:new T3.Vector3(0,8.56,-3.7),rotY:Math.PI,scale:2.45};
    // clock and date boards share one bottom line; the date board is wider and shorter
    [[-2.67,4.2,2.64],[2.25,5.04,1.9]].forEach(([x,w,h])=>{const cy=6.5+h/2;const b=new T3.Mesh(new T3.BoxGeometry(w,h,.16),mat.darkwood);b.position.set(x,cy,3.5);G.add(b);
      const tr=new T3.Mesh(new T3.BoxGeometry(w+.18,.14,.22),mat.lacquer);tr.position.set(x,cy+h/2+.04,3.5);G.add(tr);const tr2=tr.clone();tr2.position.y=6.46;G.add(tr2);});
    bridgeDigitalAnchor={group:G,pos:new T3.Vector3(-2.67,7.82,3.6),date:new T3.Vector3(2.25,7.45,3.6)};
    // lanterns: along eaves and under the arch
    for(let x=-L2-1;x<=L2+1.01;x+=1.6)[-4.6,4.6].forEach(z=>{const p=new T3.Vector3(x,11.15-.05*Math.pow(Math.abs(x)/L2,6),z).applyMatrix4(G.matrix);addLantern(p,{c:pick([[1.8,.36,.18],[1.9,.9,.3],[1.75,.3,.16]]),s:1.05});});
    for(let x=-11;x<=11.01;x+=2.75){if(Math.abs(x)<1.5) continue;const ay=2.4+Math.sqrt(Math.max(0,1-(x/15)*(x/15)))*3.9-.1;[-2.2,0,2.2].forEach(z=>{const p=new T3.Vector3(x,ay,z).applyMatrix4(G.matrix);addLantern(p,{s:.9,c:[1.9,1.1,.4]});});}
    lamp(new T3.Vector3(0,5.2,-6).applyMatrix4(G.matrix),'#ffa652',2.2,34);
  }
  onProgress(.64);

  // ---------- lantern market stalls ----------
  {
    const frameParts=[],awn=[];
    [1,-1].forEach(sd=>{
      for(let m=M(UM(.372));m<M(UM(.452));m+=rr(6.5,8.5)){
        const u=m/LEN;frame(u,_f);
        const off=27.2*sd,cx=_f.x+_f.sx*off,cz=_f.z+_f.sz*off;
        const yaw=yawFace(-_f.sx*sd,-_f.sz*sd);
        const base=new T3.Matrix4().compose(new T3.Vector3(cx,2.46,cz),_q.setFromEuler(_e.set(0,yaw,0)),new T3.Vector3(1,1,1));
        const W=rr(4.4,5.6);
        [-W/2,W/2].forEach(x=>frameParts.push({m:base.clone().multiply(new T3.Matrix4().compose(new T3.Vector3(x,2.4,0),_q.identity(),new T3.Vector3(.1,4.8,.1)))}));
        [4.7,3.85,3.0].forEach((y,ri)=>{
          frameParts.push({m:base.clone().multiply(new T3.Matrix4().compose(new T3.Vector3(0,y,0),_q.identity(),new T3.Vector3(W,.07,.07)))});
          const n=Math.round(W/.62);for(let k=0;k<n;k++){const p=new T3.Vector3((k-(n-1)/2)*(W/n),y,rr(-.05,.05)).applyMatrix4(base);addLantern(p,{s:rr(.85,1.15)*(ri===0?1.1:1),c:pick(LANTERN_COLS)});}
        });
        awn.push({m:base.clone().multiply(new T3.Matrix4().compose(new T3.Vector3(0,5.0,-1.1),_q.setFromEuler(_e.set(-.35,0,0)),new T3.Vector3(W+.4,.06,2.6)))});
      }
    });
    inst(boxG,mat.darkwood,frameParts);inst(boxG,mat.canvas,awn);
    lamp(at(UM(.405),14,6),'#ff9a4a',1.7,36);
  }

  // ---------- steps (launch and wishing pier) ----------
  function steps(u,sd,width){
    frame(u,_f);
    const yaw=yawFace(_f.tx,_f.tz);
    const list=[];
    for(let k=0;k<9;k++){
      const off=(22-.8*k)*sd,y=2.3-k*.34;
      const c=new T3.Vector3(_f.x+_f.sx*(off-sd*.4),y-.6,_f.z+_f.sz*(off-sd*.4));
      list.push({m:new T3.Matrix4().compose(c,_q.setFromEuler(_e.set(0,yaw,0)),new T3.Vector3(.8,1.2,width))});
    }
    inst(boxG,mat.stone,list);
    return list;
  }
  // where the town ends, the quay steps down into the river on both banks, with stone pillars and lanterns at the corner
  {
    const list=[],pil=[];
    ENDS.forEach((E,ei)=>{
      const yaw=Math.atan2(E.dx,E.dz),lx=E.dz,lz=-E.dx;
      [1,-1].forEach(sd=>{
        for(let k=0;k<9;k++){
          const sv=.35+k*.7,yt=2.46-k*.34,c=26.25*sd;
          list.push({m:new T3.Matrix4().compose(new T3.Vector3(E.x+E.dx*sv+lx*c,(yt-3.2)/2,E.z+E.dz*sv+lz*c),_q.setFromEuler(_e.set(0,yaw,0)),new T3.Vector3(8.5,yt+3.2,.72))});
        }
        [22.6,30.2].forEach(l=>{const px=E.x+lx*l*sd,pz=E.z+lz*l*sd;
          pil.push({m:new T3.Matrix4().compose(new T3.Vector3(px,2.46+.75,pz),_q.setFromEuler(_e.set(0,yaw,0)),new T3.Vector3(.55,1.5,.55))});
          pil.push({m:new T3.Matrix4().compose(new T3.Vector3(px,2.46+1.56,pz),_q.setFromEuler(_e.set(0,yaw,0)),new T3.Vector3(.75,.14,.75))});
          addLantern(new T3.Vector3(px,2.46+2.75,pz),{s:1.35,c:[1.9,1.0,.4]});
          lamp(new T3.Vector3(px+E.dx*1.5,2.46+2.2,pz+E.dz*1.5),'#ffb060',.9,14);
        });
      });
    });
    inst(boxG,mat.stone,list);inst(boxG,mat.paving,pil);
  }
  steps(U_LAUNCH,1,7);
  steps(U_WISH,-1,9);
  // candles on the wishing steps
  const CANDLES=[];
  for(let k=0;k<30;k++){const st=(k%8);const off=(21.9-.8*st)-.2;const u=U_WISH+rr(-1,1)*4/LEN;const p=at(u,-off,2.3-st*.34+.02);CANDLES.push(p);}
  lamp(at(U_WISH,-14,3.2),'#ffa652',2.0,30);

  // ---------- pier, sampans and a rower ----------
  const BOATS=[];
  {
    frame(U_PIER,_f);
    const yaw=yawFace(_f.tx,_f.tz);
    const deckParts=[],postP=[];
    for(let k=0;k<18;k++){const off=-(21.6-k*.82);const c=at(U_PIER,off,1.05);deckParts.push({m:new T3.Matrix4().compose(c,_q.setFromEuler(_e.set(0,yaw,0)),new T3.Vector3(.82,.12,3.6))});}
    for(let k=0;k<5;k++){const off=-(21-k*3.2);[-1.7,1.7].forEach(a=>{frame(U_PIER,_f);const c=new T3.Vector3(_f.x+_f.sx*off+_f.tx*a,0,_f.z+_f.sz*off+_f.tz*a);postP.push({m:new T3.Matrix4().compose(c,_q.identity(),new T3.Vector3(.2,2.6,.2))});});}
    inst(boxG,mat.wood,deckParts);inst(boxG,mat.darkwood,postP);
    for(let k=0;k<5;k++){const off=-(21-k*3.2);[-1.7,1.7].forEach(aa=>{frame(U_PIER,_f);addLantern(new T3.Vector3(_f.x+_f.sx*off+_f.tx*aa,1.32,_f.z+_f.sz*off+_f.tz*aa),{s:.8,c:[1.9,1.05,.4]});});}
    {frame(U_PIER,_f);const A=new T3.Vector3(_f.x-_f.sx*7.4-_f.tx*1.7,4.2,_f.z-_f.sz*7.4-_f.tz*1.7),Bq=new T3.Vector3(_f.x-_f.sx*7.4+_f.tx*1.7,4.2,_f.z-_f.sz*7.4+_f.tz*1.7);[A,Bq].forEach(p=>{const pl=new T3.Mesh(new T3.CylinderGeometry(.08,.09,4.2,6),mat.darkwood);pl.position.set(p.x,2.1,p.z);scene.add(pl);});for(let k=1;k<6;k++){const t=k/6;const p=A.clone().lerp(Bq,t);p.y-=Math.sin(Math.PI*t)*.5;addLantern(p,{s:1.05,c:pick(LANTERN_COLS)});}{const pts=[];for(let k=0;k<=12;k++){const t=k/12;const p=A.clone().lerp(Bq,t);p.y-=Math.sin(Math.PI*t)*.5;pts.push(p);}scene.add(new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(pts),12,.018,3,false),mat.rope));}}
    const pend=at(U_PIER,-7.6,1.1);
    addLantern(pend.clone().setY(3.4),{s:1.4});
    lamp(at(U_PIER,-9,3.2),'#ffa652',1.9,32);
    const hullG=sampanGeo(7.2,1.7),hullM=new T3.MeshStandardMaterial({map:T.hull,roughness:.75,side:T3.DoubleSide});
    const eyeM=new T3.MeshBasicMaterial({map:T.eye,transparent:true,alphaTest:.3,side:T3.DoubleSide,color:new T3.Color(.55,.5,.45)});
    const hoodG=new T3.CylinderGeometry(.85,.85,2.4,14,1,true,0,Math.PI);hoodG.rotateZ(Math.PI/2);hoodG.rotateX(-Math.PI/2);
    const hoodM=new T3.MeshStandardMaterial({map:T.woven,roughness:.9,side:T3.DoubleSide});
    function boat(hood){
      const g=new T3.Group();
      g.add(new T3.Mesh(hullG,hullM));
      [-1,1].forEach(s=>{const e=new T3.Mesh(new T3.PlaneGeometry(.55,.27),eyeM);e.position.set(3.05,.6,s*.415);e.rotation.y=s>0?0:Math.PI;e.rotation.z=-.08;g.add(e);});
      const th=new T3.Mesh(new T3.BoxGeometry(.18,.06,1.4),mat.wood);th.position.set(-1.2,.35,0);g.add(th);
      if(hood){const hd=new T3.Mesh(hoodG,hoodM);hd.position.set(-.2,.45,0);hd.scale.set(1,.85,.95);g.add(hd);}
      return g;
    }
    const moor=[[U_PIER-5/LEN,-9.6],[U_PIER+5/LEN,-9.2],[U_PIER+12/LEN,-17],[U_PIER-12/LEN,-16.4]];
    moor.forEach((mm,i)=>{const b=boat(i%2===0);const p=at(mm[0],mm[1],-.02);b.position.copy(p);frame(mm[0],_f);b.rotation.y=yawFace(_f.tx,_f.tz)-Math.PI/2+rr(-.12,.12);scene.add(b);
      b.updateMatrixWorld();const lp=new T3.Vector3(-3.1,1.9,0).applyMatrix4(b.matrixWorld);addLantern(lp,{s:1.1,c:[1.9,.9,.3]});
      const pole=new T3.Mesh(new T3.CylinderGeometry(.03,.03,1.6,5),mat.darkwood);pole.position.set(-3.1,1.25,0);b.add(pole);
      BOATS.push({g:b,base:p.clone(),ph:rnd()*TAU,ry:b.rotation.y,moored:true});});
    // rower boat crossing the river
    const rb=boat(false);scene.add(rb);
    const person=new T3.Group();
    const skin=new T3.MeshStandardMaterial({color:C('#a87458'),roughness:.7});
    const shirt=new T3.MeshStandardMaterial({color:C('#2e4a5c'),roughness:.85});
    const pants=new T3.MeshStandardMaterial({color:C('#1d1c22'),roughness:.9});
    const straw=new T3.MeshStandardMaterial({color:C('#d8c08a'),roughness:.8,side:T3.DoubleSide});
    const legs=new T3.Mesh(new T3.CylinderGeometry(.14,.12,.8,8),pants);legs.position.y=.8;person.add(legs);
    const torso=new T3.Mesh(new T3.CylinderGeometry(.2,.17,.62,10),shirt);torso.position.y=1.48;person.add(torso);
    const head=new T3.Mesh(new T3.SphereGeometry(.13,12,10),skin);head.position.y=1.92;person.add(head);
    const hat=new T3.Mesh(new T3.ConeGeometry(.42,.28,18,1,true),straw);hat.position.y=2.06;person.add(hat);
    const armG=new T3.CylinderGeometry(.05,.045,.62,6);armG.translate(0,-.31,0);
    const armL=new T3.Mesh(armG,shirt),armR=new T3.Mesh(armG,shirt);armL.position.set(0,1.72,.2);armR.position.set(0,1.72,-.2);person.add(armL,armR);
    const oar=new T3.Group();const shaft=new T3.Mesh(new T3.CylinderGeometry(.03,.03,3.4,6),mat.wood);shaft.position.y=-1.4;oar.add(shaft);
    const blade=new T3.Mesh(new T3.BoxGeometry(.04,.8,.2),mat.wood);blade.position.y=-3.0;oar.add(blade);
    oar.position.set(-.3,1.55,0);person.add(oar);
    person.position.set(-2.4,.12,0);rb.add(person);
    const rlp=new T3.Vector3(3,1.6,0);const rpole=new T3.Mesh(new T3.CylinderGeometry(.03,.03,1.4,5),mat.darkwood);rpole.position.set(3,.95,0);rb.add(rpole);
    const rLan=new T3.Mesh(lanternBodyGeo(),new T3.MeshBasicMaterial({map:T.rib,color:new T3.Color(1.9,.9,.3)}));rLan.position.copy(rlp).setY(1.72);rb.add(rLan);
    BOATS.push({g:rb,rower:{armL,armR,oar,torso},moving:true,u:U_PIER+UM(.016),ph:0});
  }
  onProgress(.7);

  // ---------- trees and the An Hoi islet ----------
  {
    // three tree kinds built once and instanced: a broad tamarind dome, a tall oval shade tree and a leaning coconut palm
    const treeMat=new T3.MeshStandardMaterial({vertexColors:true,roughness:.92,side:T3.DoubleSide});
    const lin=h=>{const c=C(h);return [c.r,c.g,c.b];};
    const BARK=lin('#3a2a1e'),BARK2=lin('#2a1d14');
    const paint=(g,f)=>{const p=g.attributes.position,n=p.count,col=new Float32Array(n*3);for(let i=0;i<n;i++){const c=f(p.getX(i),p.getY(i),p.getZ(i));col[i*3]=c[0];col[i*3+1]=c[1];col[i*3+2]=c[2];}g.setAttribute('color',new T3.BufferAttribute(col,3));return g;};
    const mix3=(a,b,k)=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];
    function blob(r,sx,sy,sz,x,y,z,seed){
      const g=new T3.SphereGeometry(r,11,8),p=g.attributes.position;
      for(let i=0;i<p.count;i++){const X=p.getX(i),Y=p.getY(i),Z=p.getZ(i);
        const n=1+.16*Math.sin(X*3.1/r+seed)*Math.sin(Y*2.7/r+seed*1.7)*Math.sin(Z*3.3/r+seed*.6)+.07*Math.sin((X+Z)*7/r+seed)-(Y<0?.18*Math.pow(-Y/r,2):0);
        p.setXYZ(i,X*n*sx+x,Y*n*sy+y,Z*n*sz+z);}
      g.computeVertexNormals();return g;
    }
    function limb(a,b,r0,r1){const d=new T3.Vector3().subVectors(b,a),L=d.length();const g=new T3.CylinderGeometry(r1,r0,L,7,1,true);g.translate(0,L/2,0);
      g.applyMatrix4(new T3.Matrix4().makeRotationFromQuaternion(new T3.Quaternion().setFromUnitVectors(new T3.Vector3(0,1,0),d.normalize())));g.translate(a.x,a.y,a.z);return g;}
    function trunk(h,r0,r1,bx,bz){const g=new T3.CylinderGeometry(r1,r0,h,8,6,true),p=g.attributes.position;
      for(let i=0;i<p.count;i++){const y=p.getY(i)+h/2,k=y/h;p.setXYZ(i,p.getX(i)+bx*k*k,y,p.getZ(i)+bz*k*k);}g.computeVertexNormals();return g;}
    const V3=(x,y,z)=>new T3.Vector3(x,y,z);
    function crownTint(g,y0,y1,dark,lite){return paint(g,(x,y,z)=>{const k=clamp((y-y0)/(y1-y0),0,1);const side=.5+.5*Math.sin(x*1.7+z*1.3);return mix3(dark,lite,Math.pow(k,.8)*.85+side*.15);});}
    const LEAF_D=lin('#0f2414'),LEAF_L=lin('#3f6a34');
    // A: tamarind dome
    const geoDome=(()=>{
      const parts=[paint(trunk(3.3,.34,.2,.25,0),()=>BARK)];
      [[1.5,4.2,.6],[-1.3,4.3,.9],[.1,4.6,-1.4]].forEach(([x,y,z])=>parts.push(paint(limb(V3(.2,2.6,0),V3(x,y,z),.16,.08),()=>BARK2)));
      const cr=[blob(1.9,1,.72,1,0,4.9,0,1)];
      for(let k=0;k<7;k++){const a=k/7*TAU+.4,rr2=1.75+.25*Math.sin(k*2.3);cr.push(blob(1.15+.2*Math.sin(k*1.7),1,.8,1,Math.cos(a)*rr2,4.25+.35*Math.sin(k*1.9),Math.sin(a)*rr2,k*1.3+2));}
      cr.push(blob(1.05,1,.8,1,.5,5.8,.3,9),blob(.95,1,.8,1,-.7,5.6,-.4,11));
      cr.forEach(g=>{crownTint(g,3.2,6.5,LEAF_D,LEAF_L);parts.push(g);});
      return merge(parts);
    })();
    // B: tall oval shade tree
    const geoTall=(()=>{
      const parts=[paint(trunk(4.2,.3,.17,-.2,.15),()=>BARK)];
      parts.push(paint(limb(V3(-.1,3.4,.05),V3(.8,5.2,.3),.11,.06),()=>BARK2),paint(limb(V3(-.15,3.8,.1),V3(-.9,5.6,-.2),.1,.05),()=>BARK2));
      const cr=[];
      [[0,4.9,0,1.5],[.7,5.9,.25,1.25],[-.65,5.8,-.3,1.2],[.1,6.9,0,1.1],[.6,4.3,-.55,1.05],[-.6,4.4,.55,1.05],[0,7.8,.1,.8],[-.2,3.9,-.1,1.0]].forEach(([x,y,z,r],k)=>cr.push(blob(r,1,1.15,1,x,y,z,k*1.9+3)));
      cr.forEach(g=>{crownTint(g,3,8.6,lin('#10241a'),lin('#3d6b3a'));parts.push(g);});
      return merge(parts);
    })();
    // C: coconut palm, a slim curved trunk with ring bands and drooping fronds
    const geoPalm=(()=>{
      const H=6.6,bx=1.3,parts=[];
      const tg=trunk(H,.2,.13,bx,0);paint(tg,(x,y)=>mix3(lin('#4a3828'),lin('#2c2016'),.5+.5*Math.sin(y*9)));parts.push(tg);
      const top=V3(bx,H,0);
      for(let k=0;k<11;k++){
        const a=k/11*TAU+Math.sin(k*3.7)*.25,len=2.5+.5*Math.sin(k*2.1),lift=.55+.35*Math.sin(k*1.3),N=9,pos=[],idx=[];
        for(let i=0;i<=N;i++){const t=i/N,d=len*t,y=lift*t*1.6-1.9*t*t*len/2.8,w=.42*Math.sin(Math.PI*Math.pow(t,.7))*(1-t*.3);
          [-1,0,1].forEach(j=>{const ox=Math.cos(a)*d-Math.sin(a)*w*j,oz=Math.sin(a)*d+Math.cos(a)*w*j;pos.push(top.x+ox,top.y+y+(j===0?.07:-.04*w),top.z+oz);});}
        for(let i=0;i<N;i++){const b=i*3;idx.push(b,b+3,b+1,b+1,b+3,b+4,b+1,b+4,b+2,b+2,b+4,b+5);}
        const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
        paint(g,(x,y,z)=>{const d=Math.hypot(x-top.x,z-top.z)/len;return mix3(lin('#4f7a32'),lin('#1c3a18'),d);});parts.push(g);
      }
      parts.push(paint(blob(.32,1,.8,1,bx,H-.15,0,4),()=>lin('#3a3a1a')));
      return merge(parts);
    })();
    const KINDS=[[],[],[]];
    const tree=(x,z,y,s,palm)=>{
      const kind=rnd()<(palm||0)?2:rnd()<.62?0:1;
      const sh=kind===0?s*.95:kind===1?s*.82:s*rr(.85,1.05);
      const m=new T3.Matrix4().compose(new T3.Vector3(x,y,z),_q.setFromEuler(_e.set(0,rnd()*TAU,0)),new T3.Vector3(sh*rr(.9,1.1),sh*rr(.92,1.12),sh*rr(.9,1.1)));
      const v=rr(.8,1.18);KINDS[kind].push({m,c:new T3.Color(v*rr(.92,1.06),v,v*rr(.9,1.04))});
    };
    [1,-1].forEach(sd=>{for(let m=8;m<LEN;m+=rr(9,16)){const u=m/LEN,off=sd*rr(44,80);const p=at(u,off,0);tree(p.x,p.z,2.6,rr(1.1,1.9),.3);}});
    for(let k=0;k<18;k++){const u=U_FW+UM(rr(-.03,.03)),off=rr(38,70);const p=at(u,off,0);tree(p.x,p.z,2.6,rr(1.4,2.4),.25);}
    for(let k=0;k<8;k++){const u=U_BRIDGE+rr(-.02,.02),off=(rnd()<.5?1:-1)*rr(31,36);const p=at(u,off,0);if(Math.abs(M(u)-M(U_BRIDGE))>12) tree(p.x,p.z,2.5,rr(1,1.4),.45);}
    // trees along the natural banks past the town and scattered over the hills
    for(let k=0;k<(LOWQ?110:220);k++){
      const E=ENDS[k%2],sv=rr(40,560),side=rnd()<.5?-1:1,w=extW(sv),lat=side*(w+rr(10,150));
      const x=E.x+E.dx*sv+E.dz*lat,z=E.z+E.dz*sv-E.dx*lat,y=terrH(x,z);if(y<1.5) continue;
      tree(x,z,y-.3,rr(1.2,2.6),y<6?.3:.05);
    }
    for(let k=0;k<(LOWQ?60:120);k++){const u=rnd(),sd=rnd()<.5?-1:1,p=at(u,sd*rr(235,420),0),y=terrH(p.x,p.z);tree(p.x,p.z,y-.3,rr(1.6,3.2));}
    KINDS.forEach((L,k)=>inst([geoDome,geoTall,geoPalm][k],treeMat,L,true));
  }

  // ---------- TimerMo clocks ----------
  const clockC=cnv(512,680),clockG=clockC.getContext('2d');
  const clockT=tex(clockC,false);
  function drawClock(){
    const g=clockG,W=512,cx=256,cy=250,R=212,now=new Date();
    g.clearRect(0,0,W,680);
    g.beginPath();g.arc(cx,cy,R+18,0,TAU);g.fillStyle='#2b1b14';g.fill();
    g.beginPath();g.arc(cx,cy,R+6,0,TAU);g.strokeStyle='#FFB300';g.lineWidth=3;g.stroke();
    const fg=g.createRadialGradient(cx,cy-40,20,cx,cy,R);fg.addColorStop(0,'#f6f8f6');fg.addColorStop(1,'#e2e7e4');
    g.beginPath();g.arc(cx,cy,R,0,TAU);g.fillStyle=fg;g.fill();
    for(let i=0;i<60;i++){const a=i/60*TAU,big=i%5===0;const r1=R-(big?34:18),r2=R-12;g.beginPath();g.moveTo(cx+Math.sin(a)*r1,cy-Math.cos(a)*r1);g.lineTo(cx+Math.sin(a)*r2,cy-Math.cos(a)*r2);g.strokeStyle=big?'#3E2723':'rgba(62,39,35,.45)';g.lineWidth=big?7:2.5;g.lineCap='round';g.stroke();}
    const s=now.getSeconds(),mi=now.getMinutes()+s/60,h=(now.getHours()%12)+mi/60;
    const hand=(a,len,w,col,tail)=>{g.beginPath();g.moveTo(cx-Math.sin(a)*(tail||0),cy+Math.cos(a)*(tail||0));g.lineTo(cx+Math.sin(a)*len,cy-Math.cos(a)*len);g.strokeStyle=col;g.lineWidth=w;g.lineCap='round';g.stroke();};
    hand(h/12*TAU,R*.5,14,'#3E2723',16);hand(mi/60*TAU,R*.76,9,'#3E2723',20);hand(s/60*TAU,R*.84,3.5,'#FF8F00',42);
    g.beginPath();g.arc(cx,cy,11,0,TAU);g.fillStyle='#FF8F00';g.fill();
    g.font='500 68px "Albert Sans", system-ui, sans-serif';g.textBaseline='alphabetic';
    const w1=g.measureText('Timer').width,w2=g.measureText('Mo').width,x0=cx-(w1+w2)/2,bw=w1+w2+64;
    g.fillStyle='#2b1b14';g.beginPath();if(g.roundRect) g.roundRect(cx-bw/2,546,bw,92,18);else g.rect(cx-bw/2,546,bw,92);g.fill();
    g.fillStyle='#F2F6F5';g.fillText('Timer',x0,614);g.fillStyle='#FFB300';g.fillText('Mo',x0+w1,614);
    clockT.needsUpdate=true;
  }
  drawClock();
  const clockM=new T3.MeshBasicMaterial({map:clockT,alphaTest:.5,side:T3.FrontSide,color:new T3.Color(.95,.93,.9),polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8});
  const clockGeo=new T3.PlaneGeometry(1.2,1.6);clockGeo.translate(0,-.26,0);
  const CLOCKS=[];
  function clock(parent,pos,rotY,scale){const m=new T3.Mesh(clockGeo,clockM);CLOCKS.push(m);m.position.copy(pos);m.rotation.y=rotY;m.scale.setScalar(scale||1);parent.add(m);return m;}
  if(bridgeClockAnchor){const a=bridgeClockAnchor;clock(a.group,a.pos,a.rotY,a.scale);}
  // TimerMo digital clock: seven segment digits with faint unlit segments, a soft blinking colon and the two colour wordmark
  const digC=cnv(1024,640),digG=digC.getContext('2d'),digT=tex(digC,false);
  const SEG={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgedc',7:'abc',8:'abcdefg',9:'abcdfg'};
  function seg7(g,x,y,w,h,t,on,off,ch){
    const L=SEG[ch]||'',hw=w-t,hh=(h-t)/2;
    const bar=(cx,cy,len,vert,lit)=>{g.fillStyle=lit?on:off;g.beginPath();const a=len/2,b=t/2;
      if(vert){g.moveTo(cx,cy-a);g.lineTo(cx+b,cy-a+b);g.lineTo(cx+b,cy+a-b);g.lineTo(cx,cy+a);g.lineTo(cx-b,cy+a-b);g.lineTo(cx-b,cy-a+b);}
      else{g.moveTo(cx-a,cy);g.lineTo(cx-a+b,cy-b);g.lineTo(cx+a-b,cy-b);g.lineTo(cx+a,cy);g.lineTo(cx+a-b,cy+b);g.lineTo(cx-a+b,cy+b);}
      g.closePath();g.fill();};
    const gap=t*.18,x0=x+t/2,x1=x+w-t/2,y0=y+t/2,ym=y+h/2,y1=y+h-t/2;
    bar((x0+x1)/2,y0,hw-gap*2,false,L.includes('a'));bar(x1,(y0+ym)/2,hh-gap*2,true,L.includes('b'));bar(x1,(ym+y1)/2,hh-gap*2,true,L.includes('c'));
    bar((x0+x1)/2,y1,hw-gap*2,false,L.includes('d'));bar(x0,(ym+y1)/2,hh-gap*2,true,L.includes('e'));bar(x0,(y0+ym)/2,hh-gap*2,true,L.includes('f'));
    bar((x0+x1)/2,ym,hw-gap*2,false,L.includes('g'));
  }
  // date panel beside the digital clock: day, month and year in amber, the weekday in cream
  const dateC=cnv(1228,448),dateG=dateC.getContext('2d'),dateT=tex(dateC,false);let dateKey='';
  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],WDAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function drawDate(now){
    const g=dateG,W=1228,H=448;g.clearRect(0,0,W,H);
    g.fillStyle='#1d130e';g.beginPath();if(g.roundRect) g.roundRect(14,14,W-28,H-28,46);else g.rect(14,14,W-28,H-28);g.fill();
    g.strokeStyle='#FFB300';g.lineWidth=4;g.beginPath();if(g.roundRect) g.roundRect(34,34,W-68,H-68,32);else g.rect(34,34,W-68,H-68);g.stroke();
    const scr=g.createLinearGradient(0,70,0,262);scr.addColorStop(0,'#120c09');scr.addColorStop(1,'#0b0706');
    g.fillStyle=scr;g.beginPath();if(g.roundRect) g.roundRect(70,70,W-140,192,22);else g.rect(70,70,W-140,192);g.fill();
    g.textAlign='center';g.textBaseline='alphabetic';
    g.save();g.shadowColor='rgba(255,170,0,.5)';g.shadowBlur=22;g.fillStyle='#FFB300';
    const line=now.getDate()+' '+MON[now.getMonth()]+' '+now.getFullYear();let fs=128;
    g.font='600 '+fs+'px "Albert Sans", system-ui, sans-serif';const tw=g.measureText(line).width;if(tw>980){fs=Math.floor(fs*980/tw);g.font='600 '+fs+'px "Albert Sans", system-ui, sans-serif';}
    g.fillText(line,W/2,166+fs*.36);g.restore();
    g.font='500 92px "Albert Sans", system-ui, sans-serif';g.fillStyle='#F2F6F5';g.fillText(WDAY[now.getDay()],W/2,H-80);
    dateT.needsUpdate=true;
  }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{dateKey='';});
  function drawDigital(){
    const g=digG,W=1024,H=640,now=new Date(),hh=String(now.getHours()).padStart(2,'0'),mm=String(now.getMinutes()).padStart(2,'0'),ss=String(now.getSeconds()).padStart(2,'0');
    g.clearRect(0,0,W,H);
    g.fillStyle='#1d130e';g.beginPath();if(g.roundRect) g.roundRect(14,14,W-28,H-28,46);else g.rect(14,14,W-28,H-28);g.fill();
    g.strokeStyle='#FFB300';g.lineWidth=4;g.beginPath();if(g.roundRect) g.roundRect(34,34,W-68,H-68,32);else g.rect(34,34,W-68,H-68);g.stroke();
    const scr=g.createLinearGradient(0,70,0,430);scr.addColorStop(0,'#120c09');scr.addColorStop(1,'#0b0706');
    g.fillStyle=scr;g.beginPath();if(g.roundRect) g.roundRect(70,70,W-140,370,22);else g.rect(70,70,W-140,370);g.fill();
    const on='#FFB300',off='rgba(255,179,0,.075)',dw=140,dh=270,t=29,y=120;
    g.save();g.shadowColor='rgba(255,170,0,.55)';g.shadowBlur=26;
    [[hh[0],80],[hh[1],236],[mm[0],470],[mm[1],626]].forEach(([c,x])=>seg7(g,x,y,dw,dh,t,on,off,c));
    const blink=now.getMilliseconds()<600||RM;g.fillStyle=blink?on:off;
    const cx=(236+140+470)/2;[[cx,y+dh*.3],[cx,y+dh*.7]].forEach(([x,yy])=>{g.beginPath();g.arc(x,yy,16,0,TAU);g.fill();});
    [[ss[0],810],[ss[1],882]].forEach(([c,x])=>seg7(g,x,y+dh-170,64,170,16,'rgba(255,179,0,.85)','rgba(255,179,0,.06)',c));
    g.restore();
    g.font='500 92px "Albert Sans", system-ui, sans-serif';g.textBaseline='alphabetic';
    const w1=g.measureText('Timer').width,w2=g.measureText('Mo').width,x0=W/2-(w1+w2)/2;
    g.fillStyle='#F2F6F5';g.fillText('Timer',x0,560);g.fillStyle='#FFB300';g.fillText('Mo',x0+w1,560);
    digT.needsUpdate=true;
    const dk=now.toDateString();if(dk!==dateKey){dateKey=dk;drawDate(now);}
  }
  drawDigital();
  if(bridgeDigitalAnchor){const a=bridgeDigitalAnchor;const dm=new T3.Mesh(new T3.PlaneGeometry(3.96,2.47),new T3.MeshBasicMaterial({map:digT,alphaTest:.5,color:new T3.Color(1,.97,.92),polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8}));dm.position.copy(a.pos);a.group.add(dm);
    const dd=new T3.Mesh(new T3.PlaneGeometry(4.75,1.73),new T3.MeshBasicMaterial({map:dateT,alphaTest:.5,color:new T3.Color(1,.97,.92),polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8}));dd.position.copy(a.date);a.group.add(dd);}
  // market clock kiosk, facing upstream-ish toward the river

  // free standing clock stands on the walkway, turned to face the scroll camera's approach
  // clock stands on the walkway: the post stays put, the head turns slowly to face your lantern
  const STANDS=[];
  function clockPost(u,off,h,scale,lookU){
    const base=at(u,off,2.46),look=at(lookU,0,0);
    const yaw=Math.atan2(look.x-base.x,look.z-base.z);
    const top=h+scale*1.5;
    const post=new T3.Mesh(new T3.BoxGeometry(.22,top,.22),mat.darkwood);post.position.set(base.x,base.y+top/2,base.z);scene.add(post);
    const g=new T3.Group();g.position.copy(base);g.rotation.y=yaw;scene.add(g);
    const cy=h+scale*.54;
    const back=new T3.Mesh(new T3.BoxGeometry(scale*1.32,scale*1.86,.1),mat.darkwood);back.position.set(0,cy+scale*.02,.14);g.add(back);
    const trimT=new T3.Mesh(new T3.BoxGeometry(scale*1.4,.08,.16),mat.lacquer);trimT.position.set(0,cy+scale*.97,.14);g.add(trimT);
    const trimB=trimT.clone();trimB.position.y=cy-scale*.93;g.add(trimB);
    const roofM=new T3.Mesh(roofGeo(),mat.roof);roofM.scale.set(scale*1.75,scale*.4,1.15);roofM.position.set(0,top-.02,.1);g.add(roofM);
    const m=clock(g,new T3.Vector3(0,h+scale*.8,.26),0,scale);
    const lA=new T3.Mesh(lanternBodyGeo(),new T3.MeshBasicMaterial({map:T.rib,color:new T3.Color(1.9,.95,.35)}));lA.position.set(-scale*.9,top-.12,.26);lA.scale.setScalar(1.1);g.add(lA);
    const lB=lA.clone();lB.position.x=scale*.9;g.add(lB);
    const L=new T3.PointLight(C('#ffd9a0'),.9,9,2);L.position.set(0,h+scale*.9,2.2);g.add(L);
    STANDS.push({g,yaw,base});
    return m;
  }
  function updateStands(dt){
    const hx=hero.position.x,hz=hero.position.z;
    STANDS.forEach(st=>{
      const d=Math.hypot(hx-st.base.x,hz-st.base.z);
      let want=d<140?Math.atan2(hx-st.base.x,hz-st.base.z):st.yaw;
      let dy=want-st.g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));
      st.g.rotation.y+=dy*(1-Math.exp(-dt*(RM?20:1.6)));
    });
  }
  // a TimerMo clock hung over the river from a festival rope, so it sits in open sky in the framed view
  function clockGantry(u,lat,scale,lookU){
    const A=at(u,-24,2.46),Bp=at(u,24,2.46),H=10.6;
    [A,Bp].forEach(p=>{const po=new T3.Mesh(new T3.BoxGeometry(.24,H-2.46,.24),mat.darkwood);po.position.set(p.x,2.46+(H-2.46)/2,p.z);scene.add(po);
      const cap=new T3.Mesh(new T3.BoxGeometry(.5,.14,.5),mat.darkwood);cap.position.set(p.x,H+.07,p.z);scene.add(cap);});
    const c=at(u,lat,0),look=at(lookU,lat*.4,0);
    const yaw=Math.atan2(look.x-c.x,look.z-c.z);
    const top=H-.9-(Math.abs(lat)/24)*.5;
    const g=new T3.Group();g.position.set(c.x,top,c.z);g.rotation.y=yaw;scene.add(g);
    const fw=scale*1.36,fh=scale*1.86;
    const board=new T3.Mesh(new T3.BoxGeometry(fw,fh,.12),mat.darkwood);board.position.set(0,-fh/2-.35,-.08);g.add(board);
    const trim=new T3.Mesh(new T3.BoxGeometry(fw+.16,.14,.2),mat.lacquer);trim.position.set(0,-.35,-.06);g.add(trim);
    const trim2=trim.clone();trim2.position.y=-fh-.35;g.add(trim2);
    clock(g,new T3.Vector3(0,-.35-scale*.8+scale*.26-scale*.0,.0+.0),0,scale).position.y=-.35-fh/2+scale*.26;
    // tassels and lanterns at the corners
    g.updateMatrixWorld(true);
    [-1,1].forEach(sx=>{const wp=new T3.Vector3(sx*fw*.42,-.35,0).applyMatrix4(g.matrixWorld);
      const cord=[new T3.Vector3(wp.x,wp.y,wp.z),new T3.Vector3(wp.x,top+.62-(Math.abs(lat+sx*fw*.42)/24)*.2,wp.z)];
      scene.add(new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(cord),2,.02,3,false),mat.rope));
      const lp=new T3.Vector3(sx*(fw/2+.35),-fh*.55-.35,0).applyMatrix4(g.matrixWorld);addLantern(lp.setY(lp.y+.6),{s:1.25,c:[1.9,.5,.22]});});
    // the rope itself, sagging gently between the two posts, with a few lanterns
    const pts=[];for(let k=0;k<=24;k++){const t=k/24;const p=A.clone().lerp(Bp,t);p.y=H-Math.sin(Math.PI*t)*.9;pts.push(p);}
    scene.add(new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(pts),24,.024,3,false),mat.rope));
    for(let k=1;k<12;k++){const t=k/12,l=-24+48*t;if(Math.abs(l-lat)<fw*.7+.6) continue;const p=A.clone().lerp(Bp,t);p.y=H-Math.sin(Math.PI*t)*.9;addLantern(p,{s:1.15,c:pick(LANTERN_COLS)});}
    lamp(new T3.Vector3(c.x+Math.sin(yaw)*3,top-fh*.5,c.z+Math.cos(yaw)*3),'#ffd9a0',1.1,12);
  }
  CLOCK_SPOTS.forEach(c=>clockPost(c[0],c[1],c[2],c[3],c[4]));

  // ---------- hanging lanterns: one instanced draw for bodies, one for caps ----------
  {
    const bodyG=lanternBodyGeo(),capG=lanternCapGeo();
    const n=LAN.length;
    const bodyM=swayInject(new T3.MeshBasicMaterial({map:T.rib,color:0xffffff}));
    const capM=swayInject(new T3.MeshBasicMaterial({vertexColors:true}));
    const ib=new T3.InstancedMesh(bodyG,bodyM,n),ic=new T3.InstancedMesh(capG,capM,n);
    const col=new T3.Color();
    LAN.forEach((o,i)=>{
      _m.compose(o.p,_q.setFromEuler(_e.set(0,rnd()*TAU,0)),_s.set(o.s,o.s*o.sy,o.s));
      ib.setMatrixAt(i,_m);ic.setMatrixAt(i,_m);
      col.setRGB(o.c[0],o.c[1],o.c[2]);ib.setColorAt(i,col);
    });
    ib.instanceMatrix.needsUpdate=true;ic.instanceMatrix.needsUpdate=true;ib.instanceColor.needsUpdate=true;
    scene.add(ib,ic);
  }
  onProgress(.78);

  // ---------- floating lotus lanterns: five designs, singles drifting and groups gathered ----------
  function petalGrayTex(){
    const c=cnv(64,128),g=c.getContext('2d');
    const gr=g.createLinearGradient(0,128,0,0);gr.addColorStop(0,'#ffffff');gr.addColorStop(.6,'#f1ece6');gr.addColorStop(1,'#d8cfc6');g.fillStyle=gr;g.fillRect(0,0,64,128);
    g.strokeStyle='rgba(120,90,70,.16)';g.lineWidth=1;for(let i=0;i<9;i++){g.beginPath();g.moveTo(32,128);g.quadraticCurveTo(32+(i-4)*5,60,32+(i-4)*7.5,0);g.stroke();}
    const eg=g.createLinearGradient(0,0,64,0);eg.addColorStop(0,'rgba(90,60,50,.28)');eg.addColorStop(.18,'rgba(90,60,50,0)');eg.addColorStop(.82,'rgba(90,60,50,0)');eg.addColorStop(1,'rgba(90,60,50,.28)');g.fillStyle=eg;g.fillRect(0,0,64,128);
    noiseFill(g,64,128,.05,300,1.2);
    return tex(c,false);
  }
  function radialTint(g,c0,c1,R){
    const p=g.attributes.position,n=p.count,col=new Float32Array(n*3);
    for(let i=0;i<n;i++){const d=clamp(Math.hypot(p.getX(i),p.getZ(i))/R,0,1);for(let k=0;k<3;k++) col[i*3+k]=lerp(c0[k],c1[k],d);}
    g.setAttribute('color',new T3.BufferAttribute(col,3));return g;
  }
  function heightTint(g,b0,b1,h){
    const p=g.attributes.position,n=p.count,col=new Float32Array(n*3);
    for(let i=0;i<n;i++){const k=clamp(p.getY(i)/h,0,1);const b=lerp(b0,b1,k);col[i*3]=b;col[i*3+1]=b*(.95-.12*k);col[i*3+2]=b*(.88-.2*k);}
    g.setAttribute('color',new T3.BufferAttribute(col,3));return g;
  }
  // a pad's solid edge: follows the outline of the leaf above it, so the water line meets a side wall, never the top
  function padSkirt(geo,y0,y1,shrink,cTop,cBot){
    const B=120,R=new Float32Array(B),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z),b=Math.min(B-1,((Math.atan2(z,x)/TAU+1)%1*B)|0);if(r>R[b]) R[b]=r;}
    for(let b=0;b<B;b++) if(!R[b]){let l=1,r=1;while(!R[(b-l+B)%B]&&l<B) l++;while(!R[(b+r)%B]&&r<B) r++;R[b]=lerp(R[(b-l+B)%B],R[(b+r)%B],l/(l+r));}
    // erode, so the edge tucks inside the notches between lobes and only shows as thickness under the leaf
    const Rs=R.map((v,b)=>{let m=v;for(let d=-2;d<=2;d++) m=Math.min(m,R[(b+d+B)%B]);return m*shrink;});
    const pos=[],col=[],idx=[];
    pos.push(0,y0,0,0,y1,0);col.push(...cTop,...cBot);
    for(let b=0;b<B;b++){const a=(b+.5)/B*TAU,r=Rs[b];pos.push(Math.cos(a)*r,y0,Math.sin(a)*r,Math.cos(a)*r,y1,Math.sin(a)*r);col.push(...cTop,...cBot);}
    for(let b=0;b<B;b++){const t0=2+b*2,t1=2+((b+1)%B)*2;idx.push(0,t1,t0, 1,t0+1,t1+1, t0,t1,t0+1, t1,t1+1,t0+1);}
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setAttribute('color',new T3.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
    return g;
  }
  const leafPad=(n,len,wid)=>{const top=radialTint(lotusGeo([{n,len,wid,curl:.04,cup:-.04,tilt:1.48,rad:.015,y:-.004,off:.2,round:.55}],false),[.34,.42,.14],[.05,.12,.06],len+.02);return merge([top,padSkirt(top,-.006,-.034,.9,[.04,.085,.04],[.012,.03,.016])]);};
  const discPad=(r,c0,c1)=>{const g=new T3.CylinderGeometry(r,r*.92,.05,22,1);g.translate(0,-.016,0);return radialTint(g,c0,c1,r);};
  const VAR=[
    {name:'classic',w:.3,glowY:.07,glow:1.0,
      petal:lotusGeo([{n:8,len:.24,wid:.09,curl:-.22,cup:.22,tilt:1.1,rad:.04,y:.02,off:0},{n:7,len:.2,wid:.08,curl:-.16,cup:.26,tilt:.7,rad:.03,y:.035,off:.35},{n:6,len:.15,wid:.065,curl:-.08,cup:.3,tilt:.36,rad:.015,y:.05,off:.1}],true),
      base:leafPad(8,.31,.18)},
    {name:'peony',w:.2,glowY:.06,glow:.9,
      petal:lotusGeo([{n:12,len:.16,wid:.085,curl:-.1,cup:.34,tilt:1.25,rad:.045,y:.02,off:0,round:1},{n:10,len:.145,wid:.08,curl:-.06,cup:.36,tilt:.95,rad:.035,y:.03,off:.3,round:1},{n:9,len:.12,wid:.07,curl:-.02,cup:.38,tilt:.66,rad:.025,y:.04,off:.15,round:1},{n:7,len:.09,wid:.06,curl:0,cup:.4,tilt:.36,rad:.012,y:.05,off:.4,round:1}],true),
      base:discPad(.2,[.3,.4,.13],[.06,.14,.07])},
    {name:'star',w:.2,glowY:.05,glow:.95,
      petal:lotusGeo([{n:10,len:.28,wid:.058,curl:-.5,cup:.14,tilt:1.36,rad:.035,y:.024,off:0},{n:8,len:.2,wid:.054,curl:-.32,cup:.18,tilt:1.0,rad:.025,y:.034,off:.31},{n:5,len:.11,wid:.05,curl:-.1,cup:.25,tilt:.4,rad:.01,y:.045,off:.1}],true),
      base:discPad(.17,[1.0,.86,.62],[.5,.4,.3])},
    {name:'bud',w:.15,glowY:.12,glow:1.15,
      petal:lotusGeo([{n:7,len:.3,wid:.1,curl:-.06,cup:.3,tilt:.34,rad:.03,y:.02,off:0},{n:6,len:.27,wid:.09,curl:0,cup:.32,tilt:.16,rad:.018,y:.03,off:.45},{n:9,len:.13,wid:.06,curl:-.35,cup:.2,tilt:1.3,rad:.05,y:.012,off:.2}],true),
      base:leafPad(7,.26,.16)},
    {name:'box',w:.15,glowY:.11,glow:1.1,
      petal:(()=>{const g=new T3.CylinderGeometry(.115,.14,.21,6,1,true);g.translate(0,.125,0);const r=new T3.CylinderGeometry(.122,.122,.016,6,1,true);r.translate(0,.232,0);return merge([heightTint(g,1.25,.62,.24),tinted(r,.45,.3,.22)]);})(),
      base:(()=>{const g=new T3.BoxGeometry(.33,.056,.33);g.translate(0,-.012,0);return radialTint(g,[1.0,.9,.7],[.55,.46,.34],.24);})()},
    {name:'golden',w:0,glowY:.1,glow:1.6,
      // a tall gold lotus in the centre with four small coral lotuses resting on a clean round pad
      petal:(()=>{
        const centre=lotusGeo([{n:10,len:.3,wid:.11,curl:-.2,cup:.24,tilt:1.08,rad:.05,y:.03,off:0},{n:9,len:.27,wid:.1,curl:-.14,cup:.28,tilt:.74,rad:.035,y:.045,off:.33},{n:7,len:.2,wid:.08,curl:-.06,cup:.32,tilt:.4,rad:.018,y:.06,off:.1}],true);
        const parts=[centre];
        for(let k=0;k<4;k++){
          const a=k/4*TAU+Math.PI/4;
          const m=lotusGeo([{n:8,len:.11,wid:.045,curl:-.24,cup:.24,tilt:1.05,rad:.018,y:.012,off:k*.3},{n:6,len:.085,wid:.038,curl:-.1,cup:.3,tilt:.5,rad:.01,y:.02,off:k*.3+.4}],true);
          const col=m.attributes.color;for(let i=0;i<col.count;i++){col.setXYZ(i,col.getX(i)*1.02,col.getY(i)*.62,col.getZ(i)*1.25);}
          m.translate(Math.cos(a)*.37,.005,Math.sin(a)*.37);parts.push(m);
        }
        return merge(parts);
      })(),
      base:(()=>{
        const pad=new T3.CylinderGeometry(.56,.52,.05,48,1,false);pad.translate(0,-.017,0);radialTint(pad,[.2,.36,.1],[.05,.15,.06],.56);
        const p=pad.attributes.position,c=pad.attributes.color;
        for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i)),r=Math.hypot(p.getX(i),p.getZ(i));const vein=Math.pow(Math.abs(Math.cos(a*8)),24)*(r/.56)*.25;c.setXYZ(i,c.getX(i)+vein*.2,c.getY(i)+vein*.28,c.getZ(i)+vein*.1);}
        const rim=new T3.TorusGeometry(.545,.012,6,64);rim.rotateX(Math.PI/2);rim.translate(0,.01,0);
        const hub=new T3.CylinderGeometry(.13,.15,.02,24);hub.translate(0,.012,0);
        return merge([pad,tinted(rim,.62,.48,.2),tinted(hub,.8,.62,.26)]);
      })()}
  ];
  // every lantern rides a little higher, so the bob and tilt never sink a pad under the water line
  const LIFT=.02;
  VAR.forEach(V=>{V.petal.translate(0,LIFT,0);V.base.translate(0,LIFT,0);V.glowY+=LIFT;});
  // a faded TimerMo wordmark set in an arc on the golden pad, twice, between the small lotuses
  function padLabelTex(){
    const N=1024,c=cnv(N,N),g=c.getContext('2d');
    const draw=()=>{
      g.clearRect(0,0,N,N);const px=N/2/.54,R=.452*px,fs=Math.round(.058*px);
      g.font='500 '+fs+'px "Albert Sans", system-ui, sans-serif';g.textAlign='center';g.textBaseline='alphabetic';
      const ch=[];[['Timer','#F4EAD6'],['Mo','#FFB300']].forEach(([w,col])=>[...w].forEach(l=>ch.push([l,col,g.measureText(l).width+fs*.05])));
      const tot=ch.reduce((a,q)=>a+q[2],0);
      [0,Math.PI].forEach(rot=>{let a=-tot/2/R;ch.forEach(([l,col,w])=>{g.save();g.translate(N/2,N/2);g.rotate(rot+a+w/2/R);g.fillStyle=col;g.fillText(l,0,-R);g.restore();a+=w/R;});});
    };
    draw();const t=tex(c,false);
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{draw();t.needsUpdate=true;});
    return t;
  }
  const padLabelGeo=new T3.PlaneGeometry(1.08,1.08);padLabelGeo.rotateX(-Math.PI/2);padLabelGeo.translate(0,.0095+LIFT,0);
  const padLabelMat=new T3.MeshBasicMaterial({map:padLabelTex(),transparent:true,opacity:.32,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const PET_COLS=[[1.75,.78,.86],[1.62,1.5,1.32],[1.8,1.08,.46],[1.72,.46,.4],[1.82,1.52,.56],[1.8,.82,.6],[1.7,.62,.78]];
  const BOX_COLS=[[1.75,.42,.3],[1.85,1.3,.42],[1.5,1.45,1.3],[.75,1.35,.95],[1.8,.75,.35]];
  const PT=petalGrayTex();
  const ITEMS=[];
  function pickVar(){let r=rnd(),k=0;for(;k<4;k++){r-=VAR[k].w;if(r<0) break;}return k;}
  function addItem(kind,u,lat,v,group){
    v=v==null?pickVar():v;
    const o={kind,u,lat,hu:u,hl:lat,al:0,va:0,vl:0,sp:rr(.12,.3),ph:rnd()*TAU,rot:rnd()*TAU,vr:rr(-.22,.22),w:rr(.12,.3),
      v,s:rr(.88,1.18)*(kind==='cluster'?1:1.1),c:v===5?[1.95,1.5,.55]:v===4?pick(BOX_COLS):pick(PET_COLS),g:group,x:0,z:0};
    ITEMS.push(o);return o;
  }
  const DRIFT_N=LOWQ?34:60;
  for(let i=0;i<DRIFT_N;i++) addItem('drift',rr(.02,.98),rr(-HW+2.5,HW-2.5));
  const GROUPS=[];
  function group(uC,a0,a1,l0,l1,n,bias){
    const gi=GROUPS.length,list=[];n=LOWQ?Math.ceil(n*.55):n;
    const nc=2+Math.floor(rnd()*3),cs=[];for(let c=0;c<nc;c++) cs.push([rr(a0,a1),rr(Math.min(l0,l1),Math.max(l0,l1))]);
    const gauss=()=>(rnd()+rnd()+rnd()-1.5)*1.15;
    const lo=Math.min(l0,l1),hi=Math.max(l0,l1);
    for(let k=0;k<n;k++){let tries=0,a,l;do{const c=cs[k%nc];a=clamp(c[0]+gauss()*1.3,a0-1,a1+1);l=clamp(c[1]+gauss(),lo-.6,hi+.6);tries++;}while(tries<12&&list.some(o=>Math.hypot(o.al0-a,o.hl-l)<.46));
      const v=bias&&rnd()<.35?bias:null;const o=addItem('cluster',uC+a/LEN,l,v,gi);o.al0=a;o.hu=uC;o.al=a;list.push(o);}
    GROUPS.push(list);
  }
  // near groups sit in the open half of each framed view, landmark groups gather at the bridge, pier and steps
  group(STOP[0],1.5,8,1.8,5.2,20);
  group(STOP[0],2.5,10,-1.9,-5.4,16,2);
  group(STOP[0],12,22,3,8,14);
  group(STOP[1],7,16,-1.4,-5.6,18);
  group(U_BRIDGE,-12,-4,-5.5,-12.5,22,4);
  group(STOP[2],6,16,.6,5.2,22,1);
  group(STOP[3],7,16,-1,-5.2,18,3);
  group(U_PIER,-9,9,-15.5,-8.5,20,1);
  group(STOP[4],6,14,.6,4.6,16,2);
  group(STOP[5],6,16,-1,-5.4,20);
  group(U_WISH,-9,9,-19.5,-11.5,40,3);
  [3,6,9].forEach(gi=>{const list=GROUPS[gi];if(!list||!list.length) return;const ref=list[(list.length/2)|0];const o=addItem('cluster',ref.hu+(ref.al0+1.2)/LEN,ref.hl+(ref.hl>0?1.1:-1.1),5,gi);o.al0=ref.al0+1.2;o.al=o.al0;o.hu=ref.hu;o.s=1;list.push(o);});
  // one instanced draw per design for petals and one for bases
  const petMat=new T3.MeshBasicMaterial({map:PT,vertexColors:true,side:T3.DoubleSide});
  const baseMat=new T3.MeshBasicMaterial({vertexColors:true,side:T3.DoubleSide});
  const VI=VAR.map(()=>[]);
  ITEMS.forEach(o=>{o.vi=VI[o.v].length;VI[o.v].push(o);});
  const CAP=ITEMS.length+2;
  const VMESH=VAR.map((V,k)=>{
    const pm=new T3.InstancedMesh(V.petal,petMat,CAP),bm=new T3.InstancedMesh(V.base,baseMat,CAP);
    pm.setColorAt(0,new T3.Color(1,1,1));
    pm.frustumCulled=bm.frustumCulled=false;scene.add(pm,bm);
    let lm=null;if(k===5){lm=new T3.InstancedMesh(padLabelGeo,padLabelMat,CAP);lm.frustumCulled=false;scene.add(lm);}
    return {pm,bm,lm};
  });
  const _col=new T3.Color();
  function refreshVariant(k){const vm=VMESH[k];VI[k].forEach((o,i)=>{o.vi=i;vm.pm.setColorAt(i,_col.setRGB(o.c[0],o.c[1],o.c[2]));});vm.pm.count=vm.bm.count=VI[k].length;if(vm.lm) vm.lm.count=VI[k].length;vm.pm.instanceColor.needsUpdate=true;}
  VAR.forEach((V,k)=>refreshVariant(k));
  const FL=ITEMS;const FLOAT_N=ITEMS.length;
  const glowPts=(n,size)=>{
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('col',new T3.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('sz',new T3.BufferAttribute(new Float32Array(n).fill(size),1));
    const m=new T3.ShaderMaterial({transparent:true,depthWrite:false,blending:T3.AdditiveBlending,uniforms:{uScale:{value:innerHeight*PR*.5},uTime},
      vertexShader:'attribute vec3 col;attribute float sz;uniform float uScale,uTime;varying vec3 vC;void main(){vC=col;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float fl=.9+.1*sin(uTime*13.+position.x*3.)*sin(uTime*7.3+position.z*2.);gl_PointSize=sz*fl*uScale/-mv.z;}',
      fragmentShader:'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*4.)*.9+exp(-d*d*28.)*.6;gl_FragColor=vec4(vC*a,1.);}'});
    const p=new T3.Points(g,m);p.frustumCulled=false;scene.add(p);return p;
  };
  const floatGlow=glowPts(FLOAT_N+CANDLES.length,1.1);
  function itemGlow(o,i){const c=floatGlow.geometry.attributes.col.array,s=floatGlow.geometry.attributes.sz.array;const gl=VAR[o.v].glow;c[i*3]=.95*gl;c[i*3+1]=.52*gl;c[i*3+2]=.19*gl;s[i]=(o.kind==='cluster'?.85:1.05)*o.s*(o.v===4?1.15:o.v===5?1.5:1);floatGlow.geometry.attributes.col.needsUpdate=true;floatGlow.geometry.attributes.sz.needsUpdate=true;}
  function setItemVariant(o,v,c){const old=o.v;const L=VI[old];L.splice(L.indexOf(o),1);o.v=v;o.c=c.slice();VI[v].push(o);refreshVariant(old);if(v!==old) refreshVariant(v);itemGlow(o,ITEMS.indexOf(o));}
  {
    const c=floatGlow.geometry.attributes.col.array,s=floatGlow.geometry.attributes.sz.array;
    ITEMS.forEach((o,i)=>itemGlow(o,i));
    CANDLES.forEach((p,k)=>{const i=FLOAT_N+k;c[i*3]=1.1;c[i*3+1]=.62;c[i*3+2]=.25;s[i]=.45;const a=floatGlow.geometry.attributes.position.array;a[i*3]=p.x;a[i*3+1]=p.y+.12;a[i*3+2]=p.z;});
  }

  // ---------- hero lotus lantern ----------
  const hero=new T3.Group();scene.add(hero);
  const heroModel=new T3.Group();hero.add(heroModel);
  const heroClassic=new T3.Group();heroModel.add(heroClassic);
  let heroPetM=null;
  {
    const petM=new T3.MeshStandardMaterial({color:C('#f7a184'),emissive:new T3.Color(1,1,1),emissiveMap:T.petal,emissiveIntensity:.72,roughness:.6,side:T3.DoubleSide});
    const rings=[{n:9,len:.32,wid:.12,curl:-.22,cup:.22,tilt:1.15,rad:.05,y:.02,off:0},{n:8,len:.28,wid:.11,curl:-.18,cup:.26,tilt:.72,rad:.035,y:.04,off:.35},{n:7,len:.22,wid:.09,curl:-.1,cup:.3,tilt:.38,rad:.02,y:.06,off:.1}];
    const pg=lotusGeo(rings,false);
    heroPetM=petM;heroClassic.add(new T3.Mesh(pg,petM));
    const leafM=new T3.MeshStandardMaterial({color:C('#2f5a35'),roughness:.7,side:T3.DoubleSide,emissive:C('#1a3a14'),emissiveIntensity:.3});
    const lg=lotusGeo([{n:8,len:.4,wid:.24,curl:.04,cup:-.04,tilt:1.48,rad:.02,y:-.005,off:.2}],false);
    heroClassic.add(new T3.Mesh(lg,leafM));
    heroClassic.add(new T3.Mesh(padSkirt(lg,-.008,-.036,.9,[.035,.075,.035],[.012,.03,.016]),new T3.MeshBasicMaterial({vertexColors:true})));
    heroClassic.position.y=LIFT;
    const candle=new T3.Mesh(new T3.CylinderGeometry(.045,.05,.16,12),new T3.MeshStandardMaterial({color:C('#fff2d8'),emissive:C('#ffcf8a'),emissiveIntensity:.6,roughness:.4}));
    candle.position.y=.1;heroClassic.add(candle);
  }
  const DESIGNS=[
    {name:'Lotus',v:0,speed:3.4,turn:1.25,accel:1.6,scale:1,glow:1,flameY:.27},
    {name:'Peony',v:1,speed:3.0,turn:1.6,accel:1.9,scale:1.5,glow:1,flameY:.17},
    {name:'Star',v:2,speed:4.0,turn:1.1,accel:1.5,scale:1.45,glow:1,flameY:.15},
    {name:'Bud',v:3,speed:3.2,turn:1.3,accel:1.6,scale:1.35,glow:1.1,flameY:.24},
    {name:'Paper box',v:4,speed:2.6,turn:1.7,accel:2,scale:1.55,glow:1.1,flameY:.2},
    {name:'Golden Festival',v:5,speed:7.8,turn:.95,accel:1.1,scale:1.55,glow:1.7,flameY:.27,fast:true},
    {name:'Chain',v:5,speed:5.4,turn:1.0,accel:1.15,scale:1.55,glow:1.7,flameY:.27,fast:true,chain:true}
  ];
  const VR0=[.33,.23,.31,.28,.21,.56];
  // visible pad radius of each design, for ropes, the hover ring and picking
  const VIS=[.31,.2,.17,.26,.17,.56];
  const pf2={};
  const heroBasic=new T3.MeshBasicMaterial({map:PT,vertexColors:true,side:T3.DoubleSide,color:new T3.Color(1.8,.9,.7)});
  const heroModels=DESIGNS.map((D,k)=>{
    if(k===0) return heroClassic;
    if(k===6) return null;
    const g=new T3.Group();g.add(new T3.Mesh(VAR[D.v].petal,heroBasic),new T3.Mesh(VAR[D.v].base,baseMat));if(D.v===5) g.add(new T3.Mesh(padLabelGeo,padLabelMat));g.scale.setScalar(D.scale);g.visible=false;heroModel.add(g);return g;
  });
  function showDesign(k,c){
    const vis=k===6?5:k;heroModels.forEach((m,i)=>{if(m) m.visible=i===vis;});
    if(k===6) spawnChain();else hideChain();
    const D=DESIGNS[k];
    if(c){if(k===0) heroPetM.color.setRGB(c[0]/1.95,c[1]/1.95,c[2]/1.95).convertSRGBToLinear();else heroBasic.color.setRGB(c[0],c[1],c[2]);}
    const fy=D.flameY+LIFT*(k===0?1:D.scale);flame.position.y=fy;halo.position.y=fy-.06;heroL.position.y=fy+.08;
  }
  const flame=new T3.Mesh(new T3.PlaneGeometry(.09,.2),new T3.ShaderMaterial({transparent:true,depthWrite:false,blending:T3.AdditiveBlending,uniforms:{uTime},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float uTime;varying vec2 vUv;void main(){vec2 p=vUv-vec2(.5,.25);float w=sin(uTime*9.+p.y*8.)*.04*p.y*2.5;p.x+=w;float r=length(vec2(p.x*(2.2+p.y*3.),max(p.y,0.)*1.05+min(p.y,0.)*2.4));float a=smoothstep(.34,.05,r);float core=smoothstep(.16,0.,r);vec3 c=mix(vec3(1.6,.5,.12),vec3(3.,2.4,1.5),core);gl_FragColor=vec4(c*a,1.);}'}));
  flame.position.y=.27;hero.add(flame);
  const halo=new T3.Sprite(new T3.SpriteMaterial({map:T.glow,color:new T3.Color(.8,.42,.16),transparent:true,depthWrite:false,blending:T3.AdditiveBlending}));
  halo.scale.set(.62,.62,1);halo.position.y=.2;hero.add(halo);
  const heroL=new T3.PointLight(C('#ffb35c'),2.4,20,2);heroL.position.y=.35;hero.add(heroL);
  // ---------- No. 7 chain: the golden lantern tows the other five on a fine white rope ----------
  const CHAIN_COLS=[[1.8,.95,.7],[1.75,.78,.86],[1.62,1.5,1.32],[1.8,1.08,.46],[1.85,1.3,.42]];
  const FOLL=[0,1,2,3,4].map(k=>{
    const D=DESIGNS[k],g=new T3.Group();
    const m=new T3.MeshBasicMaterial({map:PT,vertexColors:true,side:T3.DoubleSide,color:new T3.Color().setRGB(...CHAIN_COLS[k])});
    g.add(new T3.Mesh(VAR[D.v].petal,m),new T3.Mesh(VAR[D.v].base,baseMat));
    const sc=k===0?1.25:D.scale*.9;g.scale.setScalar(sc);g.visible=false;scene.add(g);
    return {g,x:0,z:0,vx:0,vz:0,rot:rnd()*TAU,vr:rr(-.3,.3),r:VR0[D.v]*sc,vis:VIS[D.v]*sc,m:0,hero:true,ph:rnd()*TAU,on:false,glowY:VAR[D.v].glowY*sc,y:.01};
  });
  FOLL.forEach(f=>f.m=f.r*f.r*14);
  const ropeGeo=new T3.BufferGeometry();const ROPE_SEG=8;
  ropeGeo.setAttribute('position',new T3.BufferAttribute(new Float32Array(5*ROPE_SEG*2*3),3));
  const rope=new T3.LineSegments(ropeGeo,new T3.LineBasicMaterial({color:new T3.Color(.86,.84,.8),transparent:true,opacity:.85}));
  rope.frustumCulled=false;rope.visible=false;scene.add(rope);
  const LINK=.5;
  function spawnChain(){
    const hx=hero.position.x,hz=hero.position.z,bx=-Math.sin(S.heading),bz=-Math.cos(S.heading);
    FOLL.forEach((f,i)=>{const d=(i+1)*(LINK+.6);f.x=hx+bx*d+rr(-.2,.2);f.z=hz+bz*d+rr(-.2,.2);f.vx=f.vz=0;f.on=true;f.g.visible=true;f.pop=0;});
    rope.visible=true;
  }
  function hideChain(){FOLL.forEach(f=>{f.on=false;f.g.visible=false;});rope.visible=false;}
  function updateChain(dt,t){
    if(!rope.visible) return;
    const arr=ropeGeo.attributes.position.array;let w=0;
    for(let i=0;i<5;i++){
      const f=FOLL[i],lead=i===0?{x:hero.position.x,z:hero.position.z,r:VR0[5]*1.55,vis:VIS[5]*1.55*heroModel.scale.x,y:hero.position.y}:FOLL[i-1];
      // water drag and the river current
      frame(nearestU(f.x,f.z,S.u,60),pf2);
      f.vx+=(pf2.tx*.2-f.vx)*(1-Math.exp(-dt*1.4));f.vz+=(pf2.tz*.2-f.vz)*(1-Math.exp(-dt*1.4));
      f.x+=f.vx*dt;f.z+=f.vz*dt;
      // rope: slack until it is taut, then it tows
      const dx=f.x-lead.x,dz=f.z-lead.z,d=Math.hypot(dx,dz)||1e-4,L=LINK+lead.r+f.r;
      if(d>L){const ex=(d-L),nx=dx/d,nz=dz/d;f.x-=nx*ex;f.z-=nz*ex;const vn=f.vx*nx+f.vz*nz;if(vn>0){f.vx-=nx*vn*1.05;f.vz-=nz*vn*1.05;}}
      // banks
      const lat=(f.x-pf2.x)*pf2.sx+(f.z-pf2.z)*pf2.sz,lim=HW-1-f.r;if(Math.abs(lat)>lim){const sg=Math.sign(lat),o=Math.abs(lat)-lim;f.x-=pf2.sx*sg*o;f.z-=pf2.sz*sg*o;}
      f.vr+=((f.vr0||(f.vr0=f.vr||.2))-f.vr)*(1-Math.exp(-dt*.8));f.rot+=f.vr*dt*(RM?0:1);
      f.pop=Math.min(1,(f.pop||0)+dt*2.2);const ps=f.pop<1?1-.94*Math.exp(-5*f.pop)*Math.cos(8*f.pop):1;
      f.g.position.set(f.x,.01+(RM?0:Math.sin(t*1.5+f.ph)*.012),f.z);f.g.rotation.set(RM?0:Math.sin(t*.9+f.ph)*.04,f.rot,RM?0:Math.cos(t*.8+f.ph)*.04);
      f.g.scale.setScalar((f.base||(f.base=f.g.scale.x))*Math.max(.05,ps));
      // rope from the leader's rim to this lantern's rim, sagging onto the water
      f.y=f.g.position.y;
      const lv=lead.vis*.97,fv=f.vis*f.g.scale.x/f.base*.97;
      const sx=lead.x+dx/d*lv,sz=lead.z+dz/d*lv,ex2=f.x-dx/d*fv,ez=f.z-dz/d*fv;
      const y0=lead.y+.012,y1=f.y+.012,slack=Math.max(0,L-d);
      for(let k=0;k<ROPE_SEG;k++){
        for(const q of [k/ROPE_SEG,(k+1)/ROPE_SEG]){
          // taut rope runs straight rim to rim; slack rope dips and rests on the water surface
          const yy=lerp(y0,y1,q)-Math.sin(Math.PI*q)*Math.min(.03,.01+slack*.08);
          arr[w++]=lerp(sx,ex2,q);arr[w++]=Math.max(.004,yy);arr[w++]=lerp(sz,ez,q);
        }
      }
      if(Math.hypot(f.vx,f.vz)>.6&&t-(f.lastRip||0)>.5){f.lastRip=t;ripple(f.x,f.z,.22);}
    }
    ropeGeo.attributes.position.needsUpdate=true;
  }
  // hover marker for lanterns you can take over in Free Drift
  const marker=new T3.Group();
  {
    // a soft lit halo: bright thin core ring fading out both ways, drawn once to a texture
    const c=cnv(256,256),g=c.getContext('2d'),gr=g.createRadialGradient(128,128,0,128,128,128);
    gr.addColorStop(0,'rgba(255,200,120,0)');gr.addColorStop(.52,'rgba(255,200,120,0)');gr.addColorStop(.7,'rgba(255,205,130,.32)');
    gr.addColorStop(.775,'rgba(255,236,190,1)');gr.addColorStop(.8,'rgba(255,214,150,.55)');gr.addColorStop(.9,'rgba(255,170,90,.14)');gr.addColorStop(1,'rgba(255,160,80,0)');
    g.fillStyle=gr;g.fillRect(0,0,256,256);
    const pg=new T3.PlaneGeometry(2,2);pg.rotateX(-Math.PI/2);
    const mm=new T3.MeshBasicMaterial({map:new T3.CanvasTexture(c),color:new T3.Color(1.5,1.2,.85),transparent:true,depthWrite:false,blending:T3.AdditiveBlending,opacity:.75});
    const glow=new T3.Mesh(pg,mm);glow.renderOrder=2;marker.add(glow);
  }
  marker.visible=false;scene.add(marker);

  // ---------- sky lanterns ----------
  const S0={u:STOP[0]};
  const SKY_N=LOWQ?14:26;
  const skyLGeo=(()=>{const pts=[];for(let i=0;i<=6;i++){const t=i/6;pts.push(new T3.Vector2(.26+.12*t-.05*t*t,t*.72));}const g=new T3.LatheGeometry(pts,12);const n=g.attributes.position.count,c=new Float32Array(n*3);for(let i=0;i<n;i++){const y=g.attributes.position.getY(i)/.72;const b=1.6-1.1*y;c[i*3]=b;c[i*3+1]=b*.62;c[i*3+2]=b*.3;}g.setAttribute('color',new T3.BufferAttribute(c,3));return g;})();
  const skyLM=new T3.MeshBasicMaterial({vertexColors:true,side:T3.DoubleSide,transparent:true,opacity:.96});
  const skyL=new T3.InstancedMesh(skyLGeo,skyLM,SKY_N);skyL.frustumCulled=false;scene.add(skyL);
  const skyGlow=glowPts(SKY_N,3.2);
  const SL=[];
  function spawnSky(o,init,wish,from){
    const base=S0.u||STOP[0];const u=clamp(base+rr(30,170)/LEN,0,1),p=from?from.clone():at(u,rr(-55,55),rr(2.6,8));
    o.x=p.x+(from?0:rr(-3,3));o.z=p.z+(from?0:rr(-3,3));o.y=init?rr(4,90):p.y+(from?.4:0);
    o.vy=rr(.7,1.15)*(wish?1.15:1);o.wx=rr(-.5,.3);o.wz=rr(-.4,.4);o.ph=rnd()*TAU;o.s=wish?1.5:rr(1.5,2.3);o.life=0;o.wish=!!wish;o.on=true;
  }
  for(let i=0;i<SKY_N;i++){const o={};spawnSky(o,true,false);if(i>=SKY_N-4) o.on=false;SL.push(o);}
  function releaseSky(from){
    let o=SL.find(s=>!s.on)||SL.reduce((a,b)=>a.y>b.y?a:b);
    spawnSky(o,false,true,from);
    return o;
  }
  {
    const c=skyGlow.geometry.attributes.col.array;for(let i=0;i<SKY_N;i++){c[i*3]=1.1;c[i*3+1]=.55;c[i*3+2]=.18;}
  }

  // ---------- fireworks ----------
  const FW_MAX=LOWQ?1400:2800;
  const fwG=new T3.BufferGeometry();
  const fwPos=new Float32Array(FW_MAX*3),fwCol=new Float32Array(FW_MAX*3),fwSz=new Float32Array(FW_MAX);
  fwG.setAttribute('position',new T3.BufferAttribute(fwPos,3));fwG.setAttribute('col',new T3.BufferAttribute(fwCol,3));fwG.setAttribute('sz',new T3.BufferAttribute(fwSz,1));
  const fwPts=new T3.Points(fwG,new T3.ShaderMaterial({transparent:true,depthWrite:false,blending:T3.AdditiveBlending,fog:false,uniforms:{uScale:{value:innerHeight*PR*.5}},
    vertexShader:'attribute vec3 col;attribute float sz;uniform float uScale;varying vec3 vC;void main(){vC=col;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=sz*uScale/-mv.z;}',
    fragmentShader:'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*5.);gl_FragColor=vec4(vC*a,1.);}'}));
  fwPts.frustumCulled=false;scene.add(fwPts);
  const FP=[];for(let i=0;i<FW_MAX;i++) FP.push({x:0,y:-999,z:0,vx:0,vy:0,vz:0,life:0,max:1,r:0,g:0,b:0,size:0,kind:0});
  let fwHead=0;const ROCKETS=[];
  const FW_COLS=[[2.4,1.5,.5],[2.4,.9,.3],[2.2,.5,.3],[1.0,2.0,1.5],[2.4,2.0,1.4],[2.4,1.1,.7]];
  function particle(x,y,z,vx,vy,vz,life,c,size,kind){const p=FP[fwHead];fwHead=(fwHead+1)%FW_MAX;p.x=x;p.y=y;p.z=z;p.vx=vx;p.vy=vy;p.vz=vz;p.life=0;p.max=life;p.r=c[0];p.g=c[1];p.b=c[2];p.size=size;p.kind=kind;}
  function burst(x,y,z,c,big){
    const n=big?(LOWQ?180:340):(LOWQ?110:220),sp=big?27:21;
    const c2=pick(FW_COLS);
    for(let i=0;i<n;i++){
      const u=rnd()*2-1,a=rnd()*TAU,r=Math.sqrt(1-u*u),s=sp*(.82+.18*rnd());
      const cc=i%5===0?c2:c;
      particle(x,y,z,Math.cos(a)*r*s,u*s,Math.sin(a)*r*s,rr(1.9,3.0),cc,rr(1.8,2.8),1);
    }
    flash.v=Math.min(1.4,flash.v+(big?1.1:.7));flash.c.setRGB(c[0]*.5,c[1]*.5,c[2]*.5);flashL.position.set(x,y,z);
  }
  function launch(color,big){
    camera.getWorldDirection(_v);_v.y=0;_v.normalize();const rx=-_v.z,rz=_v.x;
    const d=rr(75,120),sd=rr(-42,6);
    const p=new T3.Vector3(camera.position.x+_v.x*d+rx*sd,4,camera.position.z+_v.z*d+rz*sd);
    ROCKETS.push({x:p.x,y:p.y,z:p.z,vy:rr(22,27),c:color||pick(FW_COLS),big:!!big,t:0,apex:rr(1.45,1.75)});
  }
  const flash={v:0,c:new T3.Color()};

  // ---------- post: HDR bloom then ACES, vignette and grain ----------
  const isGL2=renderer.capabilities.isWebGL2;
  const canHalf=isGL2&&(renderer.extensions.get('EXT_color_buffer_float')||renderer.extensions.get('EXT_color_buffer_half_float'));
  const rt=new T3.WebGLRenderTarget(innerWidth*PR,innerHeight*PR,{type:canHalf?T3.HalfFloatType:T3.UnsignedByteType,minFilter:T3.LinearFilter,magFilter:T3.LinearFilter,format:T3.RGBAFormat});
  const composer=new T3.EffectComposer(renderer,rt);
  composer.setPixelRatio(PR);composer.setSize(innerWidth,innerHeight);
  composer.addPass(new T3.RenderPass(scene,camera));
  const bloom=new T3.UnrealBloomPass(new T3.Vector2(innerWidth*(LOWQ?.5:1),innerHeight*(LOWQ?.5:1)),.8,.42,canHalf?.9:.62);
  composer.addPass(bloom);
  const finalPass=new T3.ShaderPass({
    uniforms:{tDiffuse:{value:null},uExp:{value:canHalf?1.15:1.0},uTime:{value:0},uRes:{value:new T3.Vector2(innerWidth,innerHeight)}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform sampler2D tDiffuse;uniform float uExp,uTime;uniform vec2 uRes;varying vec2 vUv;vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}void main(){vec3 c=texture2D(tDiffuse,vUv).rgb*uExp;c=aces(c);vec2 q=vUv-.5;c*=mix(.62,1.,smoothstep(.95,.18,length(q*vec2(1.,.82))));c=srgb(c);float g=fract(sin(dot(vUv*uRes+fract(uTime)*91.,vec2(12.9898,78.233)))*43758.5453);c+=(g-.5)*.022;gl_FragColor=vec4(c,1.);}'
  });
  composer.addPass(finalPass);
  onProgress(.9);

  // ---------- runtime state ----------
  const MP={x:0,y:0};
  addEventListener('pointermove',e=>{if(e.pointerType!=='mouse') return;MP.x=e.clientX/innerWidth*2-1;MP.y=e.clientY/innerHeight*2-1;},{passive:true});
  const S={mx:0,my:0,design:0,heroColor:[1.8,.95,.7],morph:null,transfer:null,flare:0,hover:-1,u:STOP[0],lat:0,y:0,targetU:STOP[0],free:false,heading:0,speed:0,orbitYaw:0,orbitPitch:.18,orbitDist:6,camYaw:0,keys:{},joy:{x:0,y:0},lastRip:0,wakeT:0,bob:0,prevX:0,prevZ:0};
  const cam={pos:new T3.Vector3(),look:new T3.Vector3(),init:false};
  let ripHead=0;
  function ripple(x,z,amp){const r=ripData[ripHead];ripHead=(ripHead+1)%RIP;r.set(x,z,uTime.value,amp);}
  // framing per stop: dist, height, side, aimSide, aimAhead, aimUp
  const FR_D=[[4.3,1.25,0,0,9,1.05],[7.0,2.1,-.6,3.2,12,2.3],[5.8,1.8,-.4,3.4,10,1.6],[6.0,1.8,-.8,3.1,10,1.5],[6.4,1.6,.6,-3.2,10,3.4],[6.0,1.8,.5,-3.4,10,1.9]];
  const FR_M=[[4.6,1.5,0,0,9,.75],[6.6,2.2,0,0,12,1.0],[6.0,2.1,0,0,10,.4],[6.4,2.1,0,0,10,.5],[6.6,2.2,0,0,10,2.4],[6.4,2.1,0,0,10,.6]];
  function framing(u){
    const FR=isSmall()?FR_M:FR_D;
    if(u<=STOP[0]) return FR[0].slice();
    if(u>=STOP[5]) return FR[5].slice();
    let i=0;while(i<4&&u>STOP[i+1]) i++;
    const w=smooth(clamp((u-STOP[i])/(STOP[i+1]-STOP[i]),0,1));
    return FR[i].map((v,k)=>lerp(v,FR[i+1][k],w));
  }
  const hp=new T3.Vector3(),tmp=new T3.Vector3(),tmp2=new T3.Vector3();
  const clockTimer={t:0};
  const ray=new T3.Raycaster(),ndc=new T3.Vector2(),waterPlane=new T3.Plane(new T3.Vector3(0,1,0),0);

  function embers(x,y,z,n,col,spread,up){for(let i=0;i<n;i++) particle(x+rr(-spread,spread),y+rr(0,.2),z+rr(-spread,spread),rr(-.35,.35),rr(.4,1)*(up||1.6),rr(-.35,.35),rr(1,1.8),col||[1.9,1.1,.45],rr(.12,.24),3);}
  function updateHero(dt,t){
    const D=DESIGNS[S.design];
    if(!S.free){
      S.u=damp(S.u,S.targetU,2.4,dt);
      const wob=Math.sin(S.u*LEN*.045)*1.1+Math.sin(S.u*LEN*.013+1.3)*.7;
      S.lat=damp(S.lat,wob,1.4,dt);
    }else{
      const k=S.keys;
      const fwd=(k.w||k.arrowup?1:0)-(k.s||k.arrowdown?1:0)+(-S.joy.y);
      const turn=(k.a||k.arrowleft?1:0)-(k.d||k.arrowright?1:0)-S.joy.x;
      const boost=k.shift?1.4:1;
      S.heading+=turn*D.turn*dt;
      S.speed=damp(S.speed,fwd*D.speed*boost,D.accel,dt);
      frame(S.u,_f);
      // the lantern keeps its own world position; river coordinates are only read back for the bank limits
      if(S.wx==null){S.wx=_f.x+_f.sx*S.lat;S.wz=_f.z+_f.sz*S.lat;}
      let x=S.wx,z=S.wz;
      x+=Math.sin(S.heading)*S.speed*dt+_f.tx*.22*dt+(S.pushX||0)*dt+(S.corrX||0);z+=Math.cos(S.heading)*S.speed*dt+_f.tz*.22*dt+(S.pushZ||0)*dt+(S.corrZ||0);
      S.corrX=S.corrZ=0;{const pd=Math.exp(-dt*1.6);S.pushX=(S.pushX||0)*pd;S.pushZ=(S.pushZ||0)*pd;const along=(S.pushX*Math.sin(S.heading)+S.pushZ*Math.cos(S.heading));if(along<0){S.speed+=along*.6*dt*4;}}
      S.u=clamp(nearestU(x,z,S.u),.006,.994);frame(S.u,_f);
      let lat=(x-_f.x)*_f.sx+(z-_f.z)*_f.sz;
      const lim=Math.abs(M(S.u)-M(U_BRIDGE))<5?13.6:HW-1.4;
      if(Math.abs(lat)>lim){lat=Math.sign(lat)*lim;S.speed*=.6;}
      if(M(S.u)>M(U_PIER)-2.6&&M(S.u)<M(U_PIER)+2.6&&lat<-6.8&&lat>-22){lat=-6.8;S.speed*=.6;}
      {const raw=(x-_f.x)*_f.sx+(z-_f.z)*_f.sz,fix=lat-raw;if(fix){x+=_f.sx*fix;z+=_f.sz*fix;}}
      S.lat=lat;S.wx=x;S.wz=z;
      if(Math.abs(S.speed)>.3&&t-S.wakeT>(D.fast?.2:.32)){S.wakeT=t;ripple(x,z,(.32+Math.min(Math.abs(S.speed)/6,.3))*Math.min(1.5,D.scale));if(rnd()<.25) Sound.plop(rr(380,520),.012);}
      if(D.fast&&Math.abs(S.speed)>3&&!RM){const bx=x-Math.sin(S.heading)*.7,bz=z-Math.cos(S.heading)*.7;embers(bx,.15,bz,2,[2,1.5,.6],.25,.8);}
    }
    frame(S.u,_f);
    const useW=S.free&&S.wx!=null,x=useW?S.wx:_f.x+_f.sx*S.lat,z=useW?S.wz:_f.z+_f.sz*S.lat;
    const sp=Math.hypot(x-S.prevX,z-S.prevZ)/Math.max(dt,1e-3);{const id=1/Math.max(dt,1e-3);const ok=sp<40;S.hvx=ok?(x-S.prevX)*id:0;S.hvz=ok?(z-S.prevZ)*id:0;}S.prevX=x;S.prevZ=z;
    S.gs=damp(S.gs||0,Math.hypot(S.hvx||0,S.hvz||0),4,dt);
    if(!S.free&&sp>.6&&t-S.wakeT>.45&&sp<40){S.wakeT=t;ripple(x,z,.28+Math.min(sp/14,.35));}
    if(t-S.lastRip>2.2){S.lastRip=t;ripple(x,z,.14);}
    const bob=RM?0:Math.sin(t*1.6)*.018+Math.sin(t*2.7+1)*.008;
    hero.position.set(x,.012+bob,z);
    heroModel.rotation.y+=dt*(RM?0:.12);
    // switch effects: fold away, then bloom open with a little overshoot
    let ms=1;
    if(S.morph){
      const m=S.morph;m.t+=dt;const p=m.t/m.dur;
      if(!m.swapped&&p>=m.split){m.swapped=true;showDesign(m.to,m.color);S.flare=1;ripple(x,z,.9);ripple(x,z,.45);embers(x,.2,z,RM?0:24,DESIGNS[m.to].fast?[2,1.6,.7]:[1.9,1.05,.45],.35,1.8);}
      if(!m.swapped){const q=p/m.split;ms=1-.94*q*q;heroModel.rotation.y+=dt*8*q;}
      else{const q=clamp((p-m.split)/(1-m.split),0,1);ms=1-.94*Math.exp(-5.5*q)*Math.cos(8.5*q);if(q>=1) S.morph=null;}
    }
    heroModel.scale.setScalar(Math.max(.03,ms));
    S.flare=Math.max(0,(S.flare||0)-dt*1.4);
    if(S.transfer) stepTransfer(dt,t);
    heroModel.rotation.x=RM?0:Math.sin(t*1.3)*.035;heroModel.rotation.z=RM?0:Math.cos(t*1.1)*.035;
    const fl=RM?1:.86+.08*Math.sin(t*11)+.06*Math.sin(t*23.7+1.3);
    heroL.intensity=2.4*fl*D.glow*(1+S.flare*1.5);halo.material.opacity=Math.min(1,.5+.12*fl+S.flare*.4);halo.scale.setScalar(.62*Math.sqrt(D.scale)*(1+S.flare*.8));
    flame.quaternion.copy(camera.quaternion);
    if(!S.free){S.heading=Math.atan2(_f.tx,_f.tz);}
  }
  function updateCamera(dt,t){
    S.mx=damp(S.mx,S.free?0:MP.x,1.5,dt);S.my=damp(S.my,S.free?0:MP.y,1.5,dt);
    frame(S.u,_f);
    if(!S.free){
      const f=framing(S.u);
      const [dist,h,side,aimSide,ahead,aimUp]=f;
      hp.copy(hero.position);
      tmp.set(hp.x-_f.tx*dist+_f.sx*side,h,hp.z-_f.tz*dist+_f.sz*side);
      tmp2.set(hp.x+_f.tx*ahead+_f.sx*aimSide,aimUp,hp.z+_f.tz*ahead+_f.sz*aimSide);
      if(!RM){
        // travelling between two stops the camera lifts and swings to one side, then settles
        let i=0;while(i<4&&S.u>STOP[i+1]) i++;
        const ph=clamp((S.u-STOP[i])/(STOP[i+1]-STOP[i]),0,1),w=Math.sin(Math.PI*ph),sg=i%2?-1:1;
        const lat=w*2.6*sg+Math.sin(t*.23)*.35+S.mx*1.8,up=w*1.5+Math.sin(t*.31+1)*.22-S.my*.9;
        const vu=Math.abs(S.u-(cam.lastU==null?S.u:cam.lastU))*LEN/Math.max(dt,1e-3);cam.vu=damp(cam.vu||0,Math.min(vu,900),2.2,dt);
        const crane=Math.min(7,cam.vu*.016);
        tmp.x+=_f.sx*lat;tmp.z+=_f.sz*lat;tmp.y+=up+crane;
        tmp2.x+=_f.sx*lat*.35;tmp2.z+=_f.sz*lat*.35;tmp2.y+=up*.25+w*.4+crane*.2;
      }
      // passing under the covered bridge the camera eases down beneath the stone arch instead of through it
      if(BRF){const dx=tmp.x-BRF.x,dz=tmp.z-BRF.z,al=Math.abs(dx*BRF.tx+dz*BRF.tz),la=dx*BRF.sx+dz*BRF.sz;
        const wb=1-smooth(clamp((al-4.4)/9,0,1));
        if(wb>0){const q=clamp(Math.abs(la)/14.4,0,1),ceil=2.4+3.9*Math.sqrt(1-q*q)-.8;if(tmp.y>ceil) tmp.y=lerp(tmp.y,ceil,wb);}}
    }else{
      const k=S.keys;
      if(k.c) S.orbitYaw+=1.3*dt;if(k.v) S.orbitYaw-=1.3*dt;
      if(k.zin) S.orbitDist=clamp(S.orbitDist*Math.exp(-.95*dt),2.6,30);if(k.zout) S.orbitDist=clamp(S.orbitDist*Math.exp(.95*dt),2.6,30);
      if(k.z) S.orbitPitch=clamp(S.orbitPitch+.9*dt,-.05,1.2);if(k.x) S.orbitPitch=clamp(S.orbitPitch-.9*dt,-.05,1.2);
      S.camYaw=damp(S.camYaw,S.heading+S.orbitYaw,3.2,dt);
      const d=S.orbitDist,cp=Math.cos(S.orbitPitch);
      hp.copy(hero.position);
      tmp.set(hp.x-Math.sin(S.camYaw)*d*cp,.35+Math.sin(S.orbitPitch)*d+.9,hp.z-Math.cos(S.camYaw)*d*cp);
      tmp2.set(hp.x+Math.sin(S.camYaw)*2,.7,hp.z+Math.cos(S.camYaw)*2);
    }
    tmp.y=Math.max(tmp.y,.45);
    if(!cam.init){cam.pos.copy(tmp);cam.look.copy(tmp2);cam.init=true;}
    const kp=S.free?5:2.6;
    if(!S.free&&cam.off){
      // content mode rides the river path itself and only the offset from it eases out,
      // so a long jump between sections follows the water and never cuts across walls or roofs
      const e=Math.exp(-kp*dt);cam.off.multiplyScalar(e);cam.loff.multiplyScalar(e);
      cam.pos.copy(tmp).add(cam.off);cam.look.copy(tmp2).add(cam.loff);
    }else{
      cam.pos.x=damp(cam.pos.x,tmp.x,kp,dt);cam.pos.y=damp(cam.pos.y,tmp.y,kp,dt);cam.pos.z=damp(cam.pos.z,tmp.z,kp,dt);
      cam.look.x=damp(cam.look.x,tmp2.x,kp,dt);cam.look.y=damp(cam.look.y,tmp2.y,kp,dt);cam.look.z=damp(cam.look.z,tmp2.z,kp,dt);
    }
    if(!cam.off){cam.off=new T3.Vector3();cam.loff=new T3.Vector3();}
    cam.off.copy(cam.pos).sub(tmp);cam.loff.copy(cam.look).sub(tmp2);cam.lastU=S.u;
    camera.position.copy(cam.pos);camera.lookAt(cam.look);
    if(S.peek){camera.position.copy(S.peek[0]);camera.lookAt(S.peek[1]);}
    skyG.position.copy(camera.position);mountains.position.set(camera.position.x,0,camera.position.z);
  }
  const pf={};
  // ---------- floating bodies: water flow, home pull for groups, banks, and disc collisions ----------
  const VR=VR0;
  function placeItem(o,u,lat){frame(u,pf);o.u=u;o.lat=lat;o.x=pf.x+pf.sx*lat;o.z=pf.z+pf.sz*lat;o.vx=o.vz=0;}
  ITEMS.forEach(o=>{placeItem(o,o.u,o.lat);o.tx=o.tz=o.tvx=o.tvz=0;o.spin0=o.vr;o.r=VR[o.v]*o.s;o.m=o.r*o.r*(o.v===5?6:4);});
  function heroRadius(){const D=DESIGNS[S.design];return S.design===0?.42:VR0[D.v]*D.scale;}
  const HB={x:0,z:0,vx:0,vz:0,r:.4,m:1,hero:true};
  let ripT=0,bumpT=0;
  function updateFloats(dt,t){
    const arr=floatGlow.geometry.attributes.position.array;
    const hx=hero.position.x,hz=hero.position.z,cx=camera.position.x,cz=camera.position.z;
    const k=RM?.3:1;
    for(let i=0;i<FLOAT_N;i++){
      const o=ITEMS[i];
      if(S.transfer&&S.transfer.item===o){continue;}
      o.u=nearestU(o.x,o.z,o.u,14);frame(o.u,pf);
      let fx,fz;
      if(o.kind==='drift'){
        if(o.u>.99){placeItem(o,.02,rr(-HW+2.5,HW-2.5));continue;}
        const fv=o.sp*k;fx=(pf.tx*fv-o.vx)*.55;fz=(pf.tz*fv-o.vz)*.55;
      }else{
        const wa=o.al0+Math.sin(t*o.w*.8+o.ph)*.3*k,wl=o.hl+Math.cos(t*o.w+o.ph)*.3*k;
        frame(o.hu+wa/LEN,pf2);const hxw=pf2.x+pf2.sx*wl,hzw=pf2.z+pf2.sz*wl;
        fx=(hxw-o.x)*.28-o.vx*.85;fz=(hzw-o.z)*.28-o.vz*.85;
      }
      {const sp=Math.hypot(o.vx,o.vz),qd=sp*1.1;fx-=o.vx*qd;fz-=o.vz*qd;}
      o.vx+=fx*dt;o.vz+=fz*dt;o.x+=o.vx*dt;o.z+=o.vz*dt;
      // stone banks and the narrow bridge arch
      const lat=(o.x-pf.x)*pf.sx+(o.z-pf.z)*pf.sz;
      let lim=HW-.9-o.r;if(Math.abs(M(o.u)-M(U_BRIDGE))<5) lim=Math.min(lim,14.6-o.r);
      if(Math.abs(lat)>lim){const sg=Math.sign(lat),over=Math.abs(lat)-lim;o.x-=pf.sx*sg*over;o.z-=pf.sz*sg*over;const vn=o.vx*pf.sx+o.vz*pf.sz;if(vn*sg>0){o.vx-=pf.sx*vn*1.25;o.vz-=pf.sz*vn*1.25;o.tvx+=pf.sz*sg*vn*.4;o.tvz-=pf.sx*sg*vn*.4;}}
      o.lat=lat;
      // spin eases back to its own slow turn, tilt springs back level
      o.vr+=(o.spin0-o.vr)*(1-Math.exp(-dt*.7));o.rot+=o.vr*dt*k;
      o.tvx+=(-o.tx*30-o.tvx*3.4)*dt;o.tvz+=(-o.tz*30-o.tvz*3.4)*dt;o.tx+=o.tvx*dt;o.tz+=o.tvz*dt;
      o.tx=clamp(o.tx,-.35,.35);o.tz=clamp(o.tz,-.35,.35);
    }
    // collisions: discs on water, impulse with low restitution, rim friction turns into spin
    // the lantern you steer: kinematic while resting so it never jitters, heavy but pushable while moving
    const moving=S.free&&Math.abs(S.speed)>.35;
    HB.x=hx;HB.z=hz;HB.vx=S.free?Math.sin(S.heading)*S.speed:(S.hvx||0);HB.vz=S.free?Math.cos(S.heading)*S.speed:(S.hvz||0);HB.r=heroRadius();HB.m=moving?HB.r*HB.r*14:Infinity;
    const hvx0=HB.vx,hvz0=HB.vz,hx0=HB.x,hz0=HB.z;
    const N=FLOAT_N;
    function collide(a,b,pass,lockA){
      const dx=b.x-a.x;if(dx>2.2||dx<-2.2) return;
      const dz=b.z-a.z;if(dz>2.2||dz<-2.2) return;
      const rs=a.r+b.r,d2=dx*dx+dz*dz;if(d2>=rs*rs||d2<1e-8) return;
      const d=Math.sqrt(d2),nx=dx/d,nz=dz/d,ov=rs-d;
      const ia=(lockA||a.m===Infinity)?0:1/a.m,ib=b.m===Infinity?0:1/b.m,sum=ia+ib;if(sum<=0) return;
      const corr=ov*.85/sum;a.x-=nx*corr*ia;a.z-=nz*corr*ia;b.x+=nx*corr*ib;b.z+=nz*corr*ib;
      const rvx=b.vx-a.vx,rvz=b.vz-a.vz,vn=rvx*nx+rvz*nz;
      if(vn>=0) return;
      const jn=-(1.22)*vn/sum;
      a.vx-=nx*jn*ia;a.vz-=nz*jn*ia;b.vx+=nx*jn*ib;b.vz+=nz*jn*ib;
      const tx=-nz,tz=nx,vt=rvx*tx+rvz*tz,jt=clamp(-vt/sum,-.35*jn,.35*jn);
      a.vx-=tx*jt*ia;a.vz-=tz*jt*ia;b.vx+=tx*jt*ib;b.vz+=tz*jt*ib;
      if(!a.hero) a.vr=clamp(a.vr+jt*ia*.7/a.r,-3,3);
      if(!b.hero){b.vr=clamp(b.vr+jt*ib*.7/b.r,-3,3);const kb=Math.min(.35,jn*ib*.45);b.tvx+=nz*kb;b.tvz-=nx*kb;}
      else b.vr=clamp((b.vr||0)+jt*ib*.5/b.r,-2,2);
      if(!a.hero){const ka=Math.min(.35,jn*ia*.45);a.tvx-=nz*ka;a.tvz+=nx*ka;}
      if(pass===0&&-vn>.2){
        const px=a.x+nx*a.r,pz=a.z+nz*a.r;
        if(t-ripT>.07){ripT=t;ripple(px,pz,Math.min(.55,.15-vn*.5));}
        if(t-bumpT>.075&&(px-cx)*(px-cx)+(pz-cz)*(pz-cz)<900){bumpT=t;Sound.bump(Math.min(1,-vn*1.3));}
      }
    }
    const EX=[HB];FOLL.forEach(f=>{if(f.on) EX.push(f);});
    for(let pass=0;pass<2;pass++){
      for(let i=0;i<N;i++) for(let j=i+1;j<N;j++) collide(ITEMS[i],ITEMS[j],pass);
      for(let e=0;e<EX.length;e++) for(let j=0;j<N;j++) collide(EX[e],ITEMS[j],pass);
      // the chain itself: the leader shoulders its followers aside, followers bump each other
      for(let e=0;e<EX.length;e++) for(let k=e+1;k<EX.length;k++) collide(EX[e],EX[k],pass,e===0);
    }
    if(moving){S.pushX=(S.pushX||0)+(HB.vx-hvx0)*.6;S.pushZ=(S.pushZ||0)+(HB.vz-hvz0)*.6;S.corrX=(S.corrX||0)+(HB.x-hx0);S.corrZ=(S.corrZ||0)+(HB.z-hz0);}
    const near=[];
    for(let i=0;i<N;i++){
      const o=ITEMS[i];
      const y=.008+(RM?0:Math.sin(t*1.5+o.ph)*.01);
      _m.compose(_v.set(o.x,y,o.z),_q.setFromEuler(_e.set(o.tx+(RM?0:Math.sin(t*.9+o.ph)*.035),o.rot,o.tz+(RM?0:Math.cos(t*.8+o.ph)*.03))),_s.set(o.s,o.s,o.s));
      const vm=VMESH[o.v];vm.pm.setMatrixAt(o.vi,_m);vm.bm.setMatrixAt(o.vi,_m);if(vm.lm) vm.lm.setMatrixAt(o.vi,_m);
      arr[i*3]=o.x;arr[i*3+1]=y+VAR[o.v].glowY*o.s;arr[i*3+2]=o.z;
      const ddh=(o.x-hx)*(o.x-hx)+(o.z-hz)*(o.z-hz),cd=(o.x-cx)*(o.x-cx)+(o.z-cz)*(o.z-cz);
      if(cd<3600) near.push([ddh+cd*.25,i]);
    }
    VMESH.forEach(v=>{v.pm.instanceMatrix.needsUpdate=true;v.bm.instanceMatrix.needsUpdate=true;if(v.lm) v.lm.instanceMatrix.needsUpdate=true;});
    floatGlow.geometry.attributes.position.needsUpdate=true;
    near.sort((a,b)=>a[0]-b[0]);
    {const D=DESIGNS[S.design];poolData[0].set(hx,hz,2.4/D.glow,.34*D.glow);}
    for(let j=1;j<POOL;j++){const n=near[j-1];if(n){const o=ITEMS[n[1]];poolData[j].set(o.x,o.z,3.4,o.kind==='cluster'?.14:.2);}else poolData[j].set(0,0,1,0);}
  }
  function updateSky(dt,t){
    S0.u=S.u;const hf=frame(S.u,{});
    for(let i=0;i<SKY_N;i++){
      const o=SL[i];
      if(!o.on){_m.makeScale(0,0,0);skyL.setMatrixAt(i,_m);skyGlow.geometry.attributes.position.array[i*3+1]=-999;continue;}
      o.life+=dt;o.y+=o.vy*dt*(RM?.5:1);o.x+=(o.wx+Math.sin(t*.3+o.ph)*.3)*dt;o.z+=(o.wz+Math.cos(t*.25+o.ph)*.3)*dt;
      const behind=((o.x-hero.position.x)*hf.tx+(o.z-hero.position.z)*hf.tz)<-70;
      if(o.y>(o.wish?240:130)||(behind&&!o.wish)){if(o.wish||i>=SKY_N-4){o.on=false;}else spawnSky(o,false,false);}
      const sw=RM?0:Math.sin(t*.9+o.ph)*.06;
      _m.compose(_v.set(o.x,o.y,o.z),_q.setFromEuler(_e.set(sw,o.ph,sw*.6)),_s.set(o.s,o.s,o.s));skyL.setMatrixAt(i,_m);
      const a=skyGlow.geometry.attributes.position.array;a[i*3]=o.x;a[i*3+1]=o.y+.08*o.s;a[i*3+2]=o.z;
      skyGlow.geometry.attributes.sz.array[i]=(o.wish?3.6:5.2)*(o.wish?1:o.s*.5);
    }
    skyL.instanceMatrix.needsUpdate=true;skyGlow.geometry.attributes.position.needsUpdate=true;skyGlow.geometry.attributes.sz.needsUpdate=true;
  }
  let fwAuto=0;
  function updateFireworks(dt,t){
    const inZone=!S.free?(S.u>STOP[4]-UM(.06)&&S.u<STOP[4]+UM(.08)):(Math.abs(S.u-U_FW)<UM(.1));
    if(inZone&&!RM&&t>fwAuto){fwAuto=t+rr(1.4,3.2);launch(null,rnd()<.3);}
    for(let i=ROCKETS.length-1;i>=0;i--){
      const r=ROCKETS[i];r.t+=dt;r.y+=r.vy*dt;r.vy-=9*dt;
      particle(r.x+rr(-.1,.1),r.y,r.z+rr(-.1,.1),rr(-.4,.4),rr(-1,0),rr(-.4,.4),rr(.4,.7),[1.8,1.1,.5],.9,2);
      if(r.t>r.apex){burst(r.x,r.y,r.z,r.c,r.big);ROCKETS.splice(i,1);if(!r.manual) Sound.distantBloom();}
    }
    for(let i=0;i<FW_MAX;i++){
      const p=FP[i];
      if(p.life>=p.max){fwSz[i]=0;continue;}
      p.life+=dt;const k=Math.exp(-dt*(p.kind===1?1.25:p.kind===3?1.1:3));
      p.vx*=k;p.vy=p.vy*k-(p.kind===1?3.2:p.kind===3?-.4:1)*dt;p.vz*=k;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      const lf=Math.min(1,p.life/p.max);let a=lf<.08?lf/.08:Math.pow(1-lf,1.6);
      if(p.kind===1&&lf>.55) a*=.55+.45*Math.sin(p.life*40+i);
      if(p.kind===3) a*=.65+.35*Math.sin(p.life*23+i);
      fwPos[i*3]=p.x;fwPos[i*3+1]=p.y;fwPos[i*3+2]=p.z;fwCol[i*3]=p.r*a;fwCol[i*3+1]=p.g*a;fwCol[i*3+2]=p.b*a;fwSz[i]=p.size*(p.kind===1?(1-.4*lf):1);
    }
    fwG.attributes.position.needsUpdate=true;fwG.attributes.col.needsUpdate=true;fwG.attributes.sz.needsUpdate=true;
    flash.v=Math.max(0,flash.v-dt*1.8);
    flashL.intensity=flash.v*2.2;flashL.color.copy(flash.c).multiplyScalar(1.4);
    const f=flash.v*.18;sky.material.uniforms.uFlash.value.copy(flash.c).multiplyScalar(f);
    water.material.uniforms.uFlash.value.copy(flash.c).multiplyScalar(flash.v*.6);
  }
  function updateBoats(dt,t){
    BOATS.forEach(b=>{
      if(b.moored){b.g.position.y=b.base.y+(RM?0:Math.sin(t*1.1+b.ph)*.03);b.g.rotation.z=RM?0:Math.sin(t*.9+b.ph)*.025;return;}
      if(b.moving){
        if(!RM) b.ph+=dt*.022;
        const s=(Math.sin(b.ph)+1)/2;const lat=lerp(2,15,s);const dir=Math.cos(b.ph)>=0?1:-1;
        frame(b.u,_f);
        b.g.position.set(_f.x+_f.sx*lat,.0+(RM?0:Math.sin(t*1.3)*.025),_f.z+_f.sz*lat);
        const yaw=Math.atan2(_f.sx*dir,_f.sz*dir)-Math.PI/2;b.g.rotation.y=yaw;b.g.rotation.z=RM?0:Math.sin(t*1.05)*.02;
        const r=b.rower,c=RM?0:Math.sin(t*1.7);
        r.oar.rotation.z=.5+c*.35;r.oar.rotation.x=Math.cos(t*1.7)*.25;r.armL.rotation.z=-.9+c*.35;r.armR.rotation.z=-1.0+c*.32;r.torso.rotation.z=c*.08;
        if(!RM&&Math.sin(t*1.7)>.98&&t-(b.lastSplash||0)>1){b.lastSplash=t;const p=new T3.Vector3(-4.6,0,0).applyMatrix4(b.g.matrixWorld);ripple(p.x,p.z,.35);}
      }
    });
  }

  // ---------- take over a floating lantern: the light runs across the water, then you are that lantern ----------
  function itemPos(o){return new T3.Vector3(o.x,.1,o.z);}
  function stepTransfer(dt,t){
    const tr=S.transfer;tr.t+=dt;const p=clamp(tr.t/tr.dur,0,1);
    const a=hero.position,b=itemPos(tr.item);
    const e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const x=lerp(a.x,b.x,e),z=lerp(a.z,b.z,e),y=.25+Math.sin(Math.PI*e)*Math.min(2.2,.25*a.distanceTo(b)+.6);
    if(!RM) for(let i=0;i<3;i++) particle(x+rr(-.05,.05),y+rr(-.05,.05),z+rr(-.05,.05),rr(-.2,.2),rr(-.1,.3),rr(-.2,.2),rr(.5,.9),[2,1.25,.5],rr(.14,.26),3);
    if(p>=1){finishTransfer(tr.item);S.transfer=null;}
  }
  function finishTransfer(o){
    const D=DESIGNS[S.design],oldU=S.u,oldLat=S.lat,oldColor=S.heroColor.slice(),tx=o.x,tz=o.z,hx=hero.position.x,hz=hero.position.z;
    const nu=nearestU(o.x,o.z,o.u);frame(nu,_f);const nl=(o.x-_f.x)*_f.sx+(o.z-_f.z)*_f.sz;
    const newDesign=DESIGNS.findIndex(d=>d.v===o.v),newColor=o.c.slice();
    if(o.kind==='cluster'){o.hu=oldU;o.al=o.al0=0;o.hl=oldLat;}
    placeItem(o,oldU,oldLat);o.x=hx;o.z=hz;o.tvx+=.3;
    setItemVariant(o,D.v,oldColor);o.s=S.design===5?1:1.05;o.r=VR[o.v]*o.s;o.m=o.r*o.r*(o.v===5?6:4);
    S.u=nu;S.lat=nl;S.speed=0;S.wx=tx;S.wz=tz;S.prevX=tx;S.prevZ=tz;
    S.design=newDesign;S.heroColor=newColor;
    S.morph={t:0,dur:.75,split:0,to:newDesign,color:newColor,swapped:false};
    ripple(tx,tz,.6);
    if(api.onDesign) api.onDesign(newDesign);
  }
  function pickItem(cx,cy){
    camera.updateMatrixWorld();ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);
    const p=new T3.Vector3();if(!ray.ray.intersectPlane(waterPlane,p)) return -1;
    if(p.distanceTo(camera.position)>70) return -1;
    let best=-1,bd=1e9;
    for(let i=0;i<FLOAT_N;i++){const o=ITEMS[i];const r=VIS[o.v]*o.s*.9;const d=Math.hypot(o.x-p.x,o.z-p.z);if(d<r&&d<bd){bd=d;best=i;}}
    return best;
  }
  function updateMarker(t){
    const i=S.transfer?ITEMS.indexOf(S.transfer.item):S.hover;
    if(i<0||!S.free){marker.visible=false;return;}
    const o=ITEMS[i];marker.visible=true;marker.position.set(o.x,.02,o.z);
    const k=(VIS[o.v]*o.s+.18)*1.296*(1+(RM?0:Math.sin(t*2.4)*.035));marker.scale.set(k,1,k);marker.children[0].material.opacity=.248+(RM?0:Math.sin(t*2.4)*.056);
  }

  // ---------- public api ----------
  let running=true,lastT=performance.now(),elapsed=0;
  function render(){composer.render();}
  function loop(now){
    if(!running) return;
    requestAnimationFrame(loop);
    let dt=(now-lastT)/1000;lastT=now;dt=clamp(dt,0,.05);elapsed+=dt;const t=elapsed;
    uTime.value=t;water.material.uniforms.uTime.value=t;BEDMAT.uniforms.uTime.value=t;finalPass.uniforms.uTime.value=t;
    updateHero(dt,t);updateChain(dt,t);updateCamera(dt,t);updateFloats(dt,t);updateKoi(dt,t);updateStands(dt);updateSky(dt,t);updateFireworks(dt,t);updateBoats(dt,t);updateMarker(t);
    clouds.forEach(c=>{c.m.position.applyAxisAngle(_up,c.s*dt);c.m.lookAt(0,0,0);});
    clockTimer.t+=dt;if(clockTimer.t>1){clockTimer.t=0;drawClock();}clockTimer.d=(clockTimer.d||0)+dt;if(clockTimer.d>.5){clockTimer.d=0;drawDigital();}
    Sound.tick();
    render();
  }
  function resize(){
    const w=innerWidth,h=innerHeight;
    camera.aspect=w/h;camera.fov=w<h?58:46;camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);composer.setSize(w,h);
    bloom.resolution.set(w*(LOWQ?.5:1),h*(LOWQ?.5:1));
    const rs=LOWQ?.4:.55;water.getRenderTarget().setSize(Math.round(w*PR*rs),Math.round(h*PR*rs));
    finalPass.uniforms.uRes.value.set(w,h);
    [floatGlow,skyGlow,fwPts].forEach(p=>p.material.uniforms.uScale.value=h*PR*.5);
  }
  addEventListener('resize',resize);resize();
  onProgress(1);
  const api={
    start(){lastT=performance.now();requestAnimationFrame(loop);},
    setTarget(u){S.targetU=clamp(u,0,1);},
    jump(u){S.u=S.targetU=u;S.wx=null;cam.init=false;},
    stops:STOP,
    advance(sec){const h=1/30;for(let k=0;k<sec*30;k++){elapsed+=h;const t=elapsed;uTime.value=t;water.material.uniforms.uTime.value=t;updateHero(h,t);updateChain(h,t);updateCamera(h,t);updateFloats(h,t);updateKoi(h,t);updateStands(h);updateSky(h,t);updateFireworks(h,t);updateBoats(h,t);}},
    setFree(on){
      S.free=on;
      S.wx=null;
      if(on){frame(S.u,_f);S.heading=Math.atan2(_f.tx,_f.tz);S.camYaw=S.heading;S.orbitYaw=0;S.orbitPitch=.2;S.speed=0;}
      else{S.keys={};S.joy.x=S.joy.y=0;}
    },
    keys:S.keys,
    setKey(k,v){S.keys[k]=v;},
    clearKeys(){for(const k in S.keys) S.keys[k]=false;},
    joy:S.joy,
    orbit(dx,dy){S.orbitYaw-=dx*.005;S.orbitPitch=clamp(S.orbitPitch+dy*.004,-.05,1.2);},
    zoom(d){S.orbitDist=clamp(S.orbitDist*(1+d*.001),2.6,30);},
    setZoom(v){S.orbitDist=clamp(v,2.6,30);},
    clickWater(cx,cy){
      ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);
      const p=new T3.Vector3();if(!ray.ray.intersectPlane(waterPlane,p)) return false;
      const u=nearestU(p.x,p.z,S.u);frame(u,_f);const lat=(p.x-_f.x)*_f.sx+(p.z-_f.z)*_f.sz;
      if(Math.abs(lat)>HW-.3||p.distanceTo(camera.position)>160) return false;
      ripple(p.x,p.z,.95);
      FL.forEach(o=>{const dx=o.x-p.x,dz=o.z-p.z,d=Math.hypot(dx,dz);if(d<6){const f=(6-d)*.18/(d||1);o.vx+=dx*f;o.vz+=dz*f;o.tvx+=dz*f*.3;o.tvz-=dx*f*.3;}});
      return true;
    },
    firework(hex,root){
      const c=new T3.Color(hex);const col=[c.r*2.4,c.g*2.4,c.b*2.4];
      launch(col,true);const r=ROCKETS[ROCKETS.length-1];r.manual=true;r.vy=36;r.apex=.95;
    },
    releaseWish(){
      frame(S.u,_f);const from=hero.position.clone().add(new T3.Vector3(-_f.sx*1.4+_f.tx*2.2,.3,-_f.sz*1.4+_f.tz*2.2));
      const o=releaseSky(from);
      return o;
    },
    releaseFromHero(){const o=releaseSky(hero.position.clone().setY(.45));return o;},
    screenshot(){
      render();
      try{const url=renderer.domElement.toDataURL('image/png');const a=document.createElement('a');a.href=url;a.download='templatemo-634-lantern-river.png';document.body.appendChild(a);a.click();a.remove();return true;}catch(e){return false;}
    },
    designs:DESIGNS.map(d=>({name:d.name,speed:d.speed,fast:!!d.fast})),
    design(){return S.design;},
    // ground speed of the lantern you ride, one scene unit is about a metre
    speed(){return {kmh:(S.gs||0)*3.6,boost:!!(S.free&&S.keys.shift&&Math.abs(S.speed)>.3)};},
    setDesign(k){
      k=clamp(k|0,0,DESIGNS.length-1);if(k===S.design&&!S.morph) return false;
      const c=k===0?[1.8,.95,.7]:k===6?[1.95,1.5,.55]:DESIGNS[k].v===4?[1.85,1.3,.42]:DESIGNS[k].v===5?[1.95,1.5,.55]:[[1.75,.78,.86],[1.62,1.5,1.32],[1.8,1.08,.46]][k%3];
      S.design=k;S.heroColor=c;S.morph={t:0,dur:RM?.2:.95,split:.32,to:k,color:c,swapped:false};
      if(api.onDesign) api.onDesign(k);return true;
    },
    hoverAt(cx,cy){S.hover=S.free&&!S.transfer?pickItem(cx,cy):-1;return S.hover>=0;},
    takeAt(cx,cy){
      if(!S.free||S.transfer) return false;
      const i=pickItem(cx,cy);if(i<0) return false;
      const o=ITEMS[i];
      S.transfer={t:0,dur:RM?.05:clamp(.35+hero.position.distanceTo(itemPos(o))*.04,.4,1.1),item:o};S.hover=-1;
      return true;
    },
    onDesign:null,
    state:S,camera,
    debug:{scene,renderer,frame,at,LAN,FL,SL,FP,composer,water,GROUPS,VAR,clocks:CLOCKS,koi:KOI,hero,camera,bed:()=>BEDMAT,bloom,tall:TALL,foll:FOLL}
  };
  return api;
}

// ---------------------------------------------------------------
// Page wiring
// ---------------------------------------------------------------
const body=document.body;
const ldFill=$('#ldFill');
let scene3=null;
try{scene3=initScene(p=>{ldFill.style.width=Math.round(p*100)+'%';});}catch(err){console.warn('Scene unavailable',err);scene3=null;}
if(!scene3){$('#scene').style.display='none';}
const STOPS=scene3?scene3.stops:[.035,.205,.385,.565,.745,.925];

// loader
function hideLoader(){$('#loader').classList.add('done');}
if(scene3){scene3.start();setTimeout(hideLoader,420);}else setTimeout(hideLoader,200);
setTimeout(hideLoader,6000);

// ---------- nav glow on a spring ----------
const navEl=$('#nav'),glowEl=$('.nav-glow'),navLinks=$$('#nav a');
const gs={x:0,v:0,target:null,hover:false,acc:0,last:performance.now()};
function linkX(a){return a.offsetLeft+a.offsetWidth/2-20;}
function glowToActive(){if(gs.hover) return;const a=navLinks.find(l=>l.classList.contains('on'));gs.target=a?linkX(a):null;}
navLinks.forEach(a=>a.addEventListener('pointerenter',()=>{gs.hover=true;gs.target=linkX(a);}));
navEl.addEventListener('pointerleave',()=>{gs.hover=false;glowToActive();});
(function glowLoop(now){
  let dt=Math.min(.05,(now-gs.last)/1000);gs.last=now;gs.acc+=dt;
  if(gs.target!=null){
    if(!glowEl.classList.contains('show')){glowEl.classList.add('show');if(Math.abs(gs.x)<1) gs.x=gs.target;}
    while(gs.acc>=1/60){gs.acc-=1/60;const f=(gs.target-gs.x)*170-gs.v*17;gs.v+=f/60;gs.x+=gs.v/60;}
    const bob=RM?0:Math.sin(now/520)*2.2;
    glowEl.style.transform='translate3d('+gs.x.toFixed(1)+'px,'+bob.toFixed(1)+'px,0)';
  }else{glowEl.classList.remove('show');gs.acc=0;}
  requestAnimationFrame(glowLoop);
})(performance.now());

// ---------- scroll to river progress ----------
const zones=$$('.zone');
let centers=[],zoneNow=-1,userActed=false;
function measure(){centers=zones.map(z=>{const r=z.getBoundingClientRect();return r.top+scrollY+r.height/2;});}
measure();
addEventListener('resize',measure);addEventListener('load',measure);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(measure);
['wheel','touchstart','keydown','pointerdown'].forEach(e=>addEventListener(e,()=>{userActed=true;},{passive:true,once:true}));
function progress(){
  const vc=scrollY+innerHeight/2;
  if(!centers.length||vc<=centers[0]) return {u:STOPS[0],z:0};
  for(let i=0;i<centers.length-1;i++){
    if(vc<centers[i+1]){const f=clamp((vc-centers[i])/(centers[i+1]-centers[i]),0,1);const f2=f*.35+smooth(f)*.65;return {u:lerp(STOPS[i],STOPS[i+1],f2),z:f<.5?i:i+1};}
  }
  return {u:STOPS[5],z:5};
}
const routeLinks=$$('.rt');
function setZone(z){
  if(z===zoneNow) return;
  const first=zoneNow<0;zoneNow=z;
  navLinks.forEach(a=>a.classList.toggle('on',+a.dataset.z===z));
  routeLinks.forEach(a=>a.classList.toggle('on',+a.dataset.z===z));
  glowToActive();
  if(!first&&userActed&&!body.classList.contains('free')) Sound.bloop();
}
function tickScroll(){
  if(!body.classList.contains('free')){const p=progress();if(scene3) scene3.setTarget(p.u);setZone(p.z);}
  requestAnimationFrame(tickScroll);
}
{
  const p=progress();if(scene3) scene3.jump(p.u);setZone(p.z);
  addEventListener('load',()=>{measure();const q=progress();if(scene3&&location.hash) scene3.jump(q.u);});
}
requestAnimationFrame(tickScroll);

// ---------- menu and in-page links: an unhurried glide down the river, longer for far sections ----------
const glide={id:0};
function glideTo(el){
  const de=document.documentElement,pad=parseFloat(getComputedStyle(de).scrollPaddingTop)||0;
  const y0=scrollY,y1=clamp(el.getBoundingClientRect().top+scrollY-pad,0,de.scrollHeight-innerHeight);
  const zi=zones.indexOf(el.closest('.zone')),hops=zi<0?1:Math.max(1,Math.abs(zi-Math.max(zoneNow,0)));
  if(RM||Math.abs(y1-y0)<2){scrollTo(0,y1);return;}
  const dur=1300+600*hops,id=++glide.id,t0=performance.now();
  de.style.scrollBehavior='auto';
  const stop=()=>{if(glide.id===id) glide.id++;};
  const off=()=>{['wheel','touchstart','keydown'].forEach(e=>removeEventListener(e,stop));de.style.scrollBehavior='';};
  ['wheel','touchstart','keydown'].forEach(e=>addEventListener(e,stop,{passive:true}));
  (function step(now){
    if(glide.id!==id){off();return;}
    const k=clamp((now-t0)/dur,0,1),e=.5-.5*Math.cos(Math.PI*k);
    scrollTo(0,y0+(y1-y0)*e);
    if(k<1) requestAnimationFrame(step);else{glide.id++;off();}
  })(t0);
}
document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey) return;
  const id=a.getAttribute('href').slice(1),el=id&&document.getElementById(id);if(!el||body.classList.contains('free')) return;
  e.preventDefault();userActed=true;
  try{history.replaceState(null,'','#'+id);}catch(_){}
  glideTo(el);
});

// ---------- drawer ----------
const burger=$('#burger');
function setMenu(on){
  body.classList.toggle('menu',on);body.classList.toggle('lock',on||body.classList.contains('free'));
  burger.setAttribute('aria-expanded',on?'true':'false');burger.setAttribute('aria-label',on?'Close menu':'Open menu');
}
burger.addEventListener('click',()=>setMenu(!body.classList.contains('menu')));
$$('#drawer a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
addEventListener('resize',()=>{if(innerWidth>920&&body.classList.contains('menu')) setMenu(false);});

// ---------- reveals and counters ----------
const reveals=$$('.reveal');
function countUp(el){
  const end=+el.dataset.count;if(!end||el.dataset.done) return;el.dataset.done='1';
  if(RM){el.textContent=end;return;}
  const t0=performance.now(),d=1400;
  (function step(n){const k=Math.min(1,(n-t0)/d);el.textContent=Math.round(end*(1-Math.pow(1-k,3)));if(k<1) requestAnimationFrame(step);})(t0);
}
function reveal(el){el.classList.add('in');$$('[data-count]',el).forEach(countUp);}
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){reveal(e.target);io.unobserve(e.target);}}),{threshold:.18});
  reveals.forEach(r=>io.observe(r));
}
setTimeout(()=>reveals.forEach(reveal),3000);

// ---------- 03 lantern string rail: one lantern lit at a time, the light travels along the string ----------
(function(){
  const rail=$('#rail'),lane=$('#lane'),cards=$$('.card',lane),prev=$('#railPrev'),next=$('#railNext'),count=$('#railCount'),str=$('#railString');
  const dotsWrap=$('#railLights'),N=cards.length,scroller=$('#scroller');
  const NATIVE=matchMedia('(pointer: coarse)').matches||COARSE;
  if(NATIVE) rail.classList.add('native');
  const R={x:0,vx:0,target:null,press:null,dragging:false,blockUntil:0,active:0,acc:0,last:performance.now(),moved:false,cx:0,cy:22,w:0};
  const pend=cards.map(()=>({a:0,v:0}));
  const minX=()=>NATIVE?Math.min(0,scroller.clientWidth-scroller.scrollWidth):Math.min(0,lane.clientWidth-lane.scrollWidth);
  const cardX=i=>cards[i].offsetLeft-cards[0].offsetLeft;
  const hangX=i=>scroller.offsetLeft+cards[i].offsetLeft+R.x+cards[i].offsetWidth/2;
  // decorative glow layer per card and a spark with a short trail
  cards.forEach(c=>{const g=document.createElement('span');g.className='kindle';g.setAttribute('aria-hidden','true');c.appendChild(g);});
  const spark=document.createElement('span');spark.className='spark';spark.setAttribute('aria-hidden','true');rail.appendChild(spark);
  const ghosts=[];for(let k=0;k<6;k++){const g=document.createElement('span');g.className='spark ghost';g.setAttribute('aria-hidden','true');g.style.opacity=(.55-k*.08).toFixed(2);g.style.transform='scale('+(.85-k*.1).toFixed(2)+')';rail.appendChild(g);ghosts.push(g);}
  const trail=[];
  let flight=null;
  // index lights: jump to any lantern
  const dots=cards.map((c,i)=>{const d=document.createElement('button');d.type='button';d.className='lt';d.setAttribute('aria-label','Light '+c.dataset.title);d.innerHTML='<i></i>';d.addEventListener('click',()=>select(i));dotsWrap.appendChild(d);return d;});
  function centerTarget(i){const lw=scroller.clientWidth,cw=cards[i].offsetWidth;return clamp(lw/2-(cards[i].offsetLeft+cw/2),minX(),0);}
  function paintState(){
    cards.forEach((c,i)=>{const on=i===R.active;c.classList.toggle('on',on);c.setAttribute('aria-pressed',on?'true':'false');c.setAttribute('aria-label',c.dataset.title+(on?', lit, press to read its story':', press to light it'));});
    dots.forEach((d,i)=>{d.classList.toggle('on',i===R.active);d.setAttribute('aria-current',i===R.active?'true':'false');});
    count.innerHTML='<b>'+String(R.active+1).padStart(2,'0')+'</b> / '+String(N).padStart(2,'0');
    prev.disabled=R.active===0;next.disabled=R.active===N-1;
  }
  function select(i,opts){
    opts=opts||{};i=clamp(i,0,N-1);
    if(i===R.active){if(opts.recenter!==false){R.target=centerTarget(i);R.vx=0;}return;}
    const from=R.active,dir=i>from?1:-1;
    R.active=i;
    if(opts.recenter!==false){R.target=centerTarget(i);R.vx=0;}
    cards[from].classList.remove('ignite');
    if(RM){paintState();cards[i].classList.add('on');}
    else{
      cards.forEach((c,k)=>{if(k!==i) c.classList.remove('on');});
      cards[i].classList.remove('on');
      dots.forEach((d,k)=>d.classList.toggle('on',k===i));
      count.innerHTML='<b>'+String(i+1).padStart(2,'0')+'</b> / '+String(N).padStart(2,'0');
      prev.disabled=i===0;next.disabled=i===N-1;
      flight={from,to:i,t0:performance.now(),dur:clamp(380+Math.abs(i-from)*120,420,900)};
      trail.length=0;rail.classList.add('flying');
    }
    Sound.glide(dir);
  }
  function arrive(i){
    flight=null;rail.classList.remove('flying');
    paintState();
    const c=cards[i];c.classList.remove('ignite');void c.offsetWidth;c.classList.add('ignite');
    pend[i].v+=(Math.random()<.5?-1:1)*1.6;
    setTimeout(()=>c.classList.remove('ignite'),1100);
  }
  prev.addEventListener('click',()=>select(R.active-1));
  next.addEventListener('click',()=>select(R.active+1));
  rail.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'){e.preventDefault();select(R.active+1);if(e.target!==rail) cards[R.active].focus({preventScroll:true});}
    if(e.key==='ArrowLeft'){e.preventDefault();select(R.active-1);if(e.target!==rail) cards[R.active].focus({preventScroll:true});}
    if(e.key==='Home'){e.preventDefault();select(0);}
    if(e.key==='End'){e.preventDefault();select(N-1);}
  });
  function activate(c){const i=cards.indexOf(c);if(i===R.active) openLB(c);else select(i);}
  cards.forEach(c=>{
    c.addEventListener('dragstart',e=>e.preventDefault());
    c.addEventListener('pointerenter',()=>{if(!R.dragging){c.classList.add('hov');Sound.hover();}});
    c.addEventListener('pointerleave',()=>c.classList.remove('hov'));
    c.addEventListener('click',()=>{if(Date.now()<R.blockUntil||R.dragging) return;activate(c);});
    c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(c);}});
  });
  rail.addEventListener('dragstart',e=>e.preventDefault());
  rail.addEventListener('pointerdown',e=>{if(NATIVE&&e.pointerType!=='mouse') return;if(e.button!==0&&e.pointerType==='mouse') return;R.press={x:e.clientX,y:e.clientY,x0:R.x,id:e.pointerId,t:performance.now(),lx:e.clientX,lt:performance.now()};});
  rail.addEventListener('pointermove',e=>{
    const p=R.press;if(!p||e.pointerId!==p.id) return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    if(!R.dragging){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){R.press=null;return;}
      if(Math.abs(dx)>8){R.dragging=true;R.moved=true;R.target=null;rail.classList.add('dragging');cards.forEach(c=>c.classList.remove('hov'));try{rail.setPointerCapture(e.pointerId);}catch(_){}}
      else return;
    }
    let nx=p.x0+dx;const mn=minX();
    if(nx>0) nx*=.35;if(nx<mn) nx=mn+(nx-mn)*.35;
    const now=performance.now(),ddt=Math.max(1,now-p.lt);R.vx=lerp(R.vx,(e.clientX-p.lx)/ddt*1000,.5);p.lx=e.clientX;p.lt=now;
    if(NATIVE) scroller.scrollLeft=-nx;else R.x=nx;
  });
  function endDrag(){
    if(R.dragging){R.blockUntil=Date.now()+240;}
    R.dragging=false;R.press=null;rail.classList.remove('dragging');
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>rail.addEventListener(ev,endDrag));
  addEventListener('pointerup',endDrag);addEventListener('blur',endDrag);
  if(NATIVE){let last=0;scroller.addEventListener('scroll',()=>{R.moved=true;R.lastScroll=performance.now();},{passive:true});scroller.addEventListener('touchstart',()=>{R.target=null;R.touching=true;},{passive:true});scroller.addEventListener('touchend',()=>{R.touching=false;R.lastScroll=performance.now();},{passive:true});scroller.addEventListener('touchcancel',()=>{R.touching=false;},{passive:true});}
  rail.addEventListener('wheel',e=>{if(NATIVE) return;if(Math.abs(e.deltaX)>Math.abs(e.deltaY)){e.preventDefault();R.target=null;R.moved=true;R.x=clamp(R.x-e.deltaX,minX(),0);R.vx=0;}},{passive:false});
  // point on the string at a given x (quadratic curve from 0,2 to w,2)
  function stringY(X){
    const w=R.w||rail.clientWidth;let lo=0,hi=1;
    for(let k=0;k<16;k++){const t=(lo+hi)/2,x=2*(1-t)*t*R.cx+t*t*w;if(x<X) lo=t;else hi=t;}
    const t=(lo+hi)/2;return (1-t)*(1-t)*2+2*(1-t)*t*R.cy+t*t*2;
  }
  function place(el,x,y){el.style.left=x.toFixed(1)+'px';el.style.top=y.toFixed(1)+'px';}
  function paint(){
    if(!NATIVE) lane.style.transform='translate3d('+R.x.toFixed(2)+'px,0,0)';
    const w=rail.clientWidth;const sh=clamp(-R.vx*.01,-60,60);
    R.w=w;R.cx=w/2+sh;R.cy=22+Math.min(10,Math.abs(R.vx)*.004);
    str.setAttribute('d','M0 2 Q '+R.cx.toFixed(1)+' '+R.cy.toFixed(1)+' '+w+' 2');
    str.parentNode.setAttribute('viewBox','0 0 '+w+' 40');
    cards.forEach((c,i)=>c.style.transform='rotate('+pend[i].a.toFixed(4)+'rad)');
  }
  function flyTick(now){
    if(!flight) return;
    const p=clamp((now-flight.t0)/flight.dur,0,1);
    const e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    const a=hangX(flight.from),b=hangX(flight.to);
    // rise up the old cord, run along the string, drop down the new cord
    let x,y;
    if(p<.14){const q=p/.14;x=a;y=lerp(26,stringY(a),q);}
    else if(p<.84){const q=(p-.14)/.7,qe=q<.5?2*q*q:1-Math.pow(-2*q+2,2)/2;x=lerp(a,b,qe);y=stringY(x)-Math.sin(Math.PI*qe)*3;}
    else{const q=(p-.84)/.16;x=b;y=lerp(stringY(b),26,q*q);}
    place(spark,x,y);
    trail.unshift([x,y]);if(trail.length>24) trail.pop();
    ghosts.forEach((g,k)=>{const t=trail[Math.min(trail.length-1,(k+1)*3)];if(t) place(g,t[0],t[1]);});
    if(p>=1) arrive(flight.to);
  }
  (function loop(now){
    const dt=Math.min(.05,(now-R.last)/1000);R.last=now;R.acc+=dt;
    const mn=minX();
    if(NATIVE){
      const nx=-scroller.scrollLeft;R.vx=lerp(R.vx,(nx-R.x)/Math.max(dt,1/120),.35);R.x=nx;
      if(R.target!=null){scroller.scrollTo({left:-R.target,behavior:RM?'auto':'smooth'});R.target=null;}
    }
    while(R.acc>=1/60){
      R.acc-=1/60;const h=1/60;
      if(!R.dragging&&!NATIVE){
        if(R.target!=null){const d=R.target-R.x;R.vx=d*10;R.x+=d*.14;if(Math.abs(d)<.4){R.x=R.target;R.target=null;R.vx=0;}}
        else{R.x+=R.vx*h;R.vx*=.92;if(Math.abs(R.vx)<4) R.vx=0;
          if(R.x>0){R.x+=(0-R.x)*.18;R.vx*=.6;} if(R.x<mn){R.x+=(mn-R.x)*.18;R.vx*=.6;}}
      }
      const tgt=RM?0:clamp(-R.vx*(R.target!=null?.00009:.00028),-.22,.22);
      pend.forEach((p,i)=>{const k=60-i*2.2,c=4.2;p.v+=(-(p.a-tgt*(1-i*.04))*k-p.v*c)*h;p.a+=p.v*h;});
    }
    paint();flyTick(now);
    // after a free drag settles, hand the light to the lantern nearest the middle if the lit one scrolled away
    const settled=NATIVE?(!R.touching&&now-(R.lastScroll||0)>220):(R.vx===0);
    if(R.moved&&!R.dragging&&R.target==null&&settled&&!flight){
      R.moved=false;
      const lw=rail.clientWidth,c=cards[R.active],cx=hangX(R.active);
      if(cx<c.offsetWidth*.3||cx>lw-c.offsetWidth*.3){let b=0,bd=1e9;cards.forEach((cc,i)=>{const d=Math.abs(hangX(i)-lw/2);if(d<bd){bd=d;b=i;}});select(b,{recenter:false});}
    }
    requestAnimationFrame(loop);
  })(performance.now());
  paintState();
})();

// ---------- lightbox ----------
const lb=$('#lb'),lbImg=$('#lbImg');let lbReturn=null;
function openLB(c){
  const img=$('img',c);
  lbImg.style.display='';lbImg.src=(img&&(img.currentSrc||img.src))||'';lbImg.alt=img?img.alt:'';
  lbImg.onerror=()=>{lbImg.style.display='none';};
  $('#lbTitle').textContent=c.dataset.title;$('#lbMeta').textContent=c.dataset.meta;$('#lbText').textContent=c.dataset.text;
  lbReturn=c;lb.classList.add('open');body.classList.add('lock');Sound.knock(1);
  setTimeout(()=>$('#lbClose').focus(),60);
}
function closeLB(){if(!lb.classList.contains('open')) return;lb.classList.remove('open');if(!body.classList.contains('menu')&&!body.classList.contains('free')) body.classList.remove('lock');if(lbReturn) lbReturn.focus({preventScroll:true});}
$('#lbClose').addEventListener('click',closeLB);
lb.addEventListener('click',e=>{if(e.target===lb) closeLB();});
$('#lbCta').addEventListener('click',closeLB);

// ---------- 04 ribs: click to unfold ----------
(function(){
  const ribs=$$('.rib');
  function open(r){if(r.classList.contains('open')) return;ribs.forEach(x=>{const on=x===r;x.classList.toggle('open',on);x.setAttribute('aria-expanded',on?'true':'false');});Sound.unfold();}
  ribs.forEach(r=>{r.addEventListener('click',()=>open(r));r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(r);}});});
})();

// ---------- 05 tiers: light a lantern, fire a rocket ----------
(function(){
  const tiers=$$('.tier'),price=$('#tierPrice'),weeks=$('#tierWeeks'),items=$('#tierItems');
  const roots=[392,329.63,293.66];
  function sel(t,fire){
    tiers.forEach(x=>{const on=x===t;x.classList.toggle('on',on);x.setAttribute('aria-checked',on?'true':'false');x.tabIndex=on?0:-1;});
    price.textContent=t.dataset.price;weeks.textContent=t.dataset.weeks;
    items.innerHTML='';t.dataset.items.split('|').forEach(s=>{const li=document.createElement('li');li.textContent=s;items.appendChild(li);});
    const sel=$('#fType');if(sel){const name=$('b',t).textContent.replace(/\s+/g,' ').trim();[...sel.options].forEach(o=>{if(o.text===name) sel.value=o.text;});}
    if(fire){if(scene3) scene3.firework(t.dataset.color,roots[+t.dataset.i]);Sound.firework(roots[+t.dataset.i]);}
  }
  tiers.forEach((t,i)=>{
    t.addEventListener('click',()=>sel(t,true));
    t.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();sel(t,true);}
      if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();const n=tiers[(i+1)%tiers.length];sel(n,true);n.focus();}
      if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();const n=tiers[(i+tiers.length-1)%tiers.length];sel(n,true);n.focus();}
    });
  });
  tiers.forEach(t=>t.tabIndex=t.classList.contains('on')?0:-1);
  if(!RM) tiers.forEach((t,i)=>{t.animate([{transform:'rotate(-1.6deg)'},{transform:'rotate(1.6deg)'},{transform:'rotate(-1.6deg)'}],{duration:4200+i*700,iterations:Infinity,easing:'ease-in-out'});});
})();

// ---------- 06 wish form ----------
(function(){
  const f=$('#wishForm');
  f.addEventListener('submit',e=>{
    e.preventDefault();
    const name=$('#fName'),mail=$('#fMail'),msg=$('#fMsg');
    const bad=[];
    if(!name.value.trim()) bad.push(name);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) bad.push(mail);
    if(msg.value.trim().length<6) bad.push(msg);
    [name,mail,msg].forEach(el=>el.parentNode.classList.toggle('bad',bad.indexOf(el)>-1));
    if(bad.length){toast('Please add your name, a valid email and a short wish.',true);Sound.chime(true);bad[0].focus();return;}
    if(scene3) scene3.releaseWish();
    Sound.release();
    toast('Your lantern is on its way up, '+name.value.trim().split(' ')[0]+'. We reply within two days.');
    f.reset();$('#fType').value='Silk Lantern';
  });
  $$('input,textarea',f).forEach(el=>el.addEventListener('input',()=>el.parentNode.classList.remove('bad')));
})();

// ---------- dock, help, free drift ----------
const dock=$('#dock'),help=$('#helpBtn'),hint=$('#hint'),freeSw=$('#freeSwitch');
const HINT_SCROLL='Scroll to drift · click the water to ripple it';
const HINT_FREE='<span class="hg"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>&nbsp;drift</span><span class="hg"><kbd>Shift</kbd>&nbsp;power</span><span class="hg">drag to look</span><span class="hg"><kbd>Z</kbd><kbd>X</kbd>&nbsp;tilt</span><span class="hg"><kbd>C</kbd><kbd>V</kbd>&nbsp;turn</span><span class="hg"><kbd>+</kbd><kbd>-</kbd>&nbsp;zoom</span><span class="hg"><kbd>Space</kbd>&nbsp;wish</span><span class="hg">click a lantern to take it</span>';
function setDock(open){dock.classList.toggle('closed',!open);help.classList.toggle('show',!open);store.set('toro661-dock',open?'1':'0');}
$('#dockClose').addEventListener('click',()=>{setDock(false);help.focus();});
help.addEventListener('click',()=>{setDock(true);freeSw.focus();});
if(store.get('toro661-dock')==='0') setDock(false);
function setFree(on){
  if(!scene3){toast('Free Drift needs WebGL, which this browser has turned off.',true);return;}
  if(on===body.classList.contains('free')) return;
  if(on) setMenu(false);
  body.classList.toggle('free',on);body.classList.toggle('lock',on||body.classList.contains('menu'));
  freeSw.setAttribute('aria-checked',on?'true':'false');
  hint.innerHTML=on?(body.classList.contains('touch')?HINT_TOUCH:HINT_FREE):HINT_SCROLL;
  scene3.setFree(on);
  if(on){setDock(true);$('#scene').focus({preventScroll:true});measureTray();}
  Sound.knock(on?1.12:.9);
}
freeSw.addEventListener('click',()=>setFree(!body.classList.contains('free')));
$$('[data-free]').forEach(b=>b.addEventListener('click',()=>setFree(true)));

// lantern tray: choose a lantern, or take one from the water
const trayBtns=$$('#tray .ln');
function paintTray(k,pop){trayBtns.forEach((b,i)=>{const on=i===k;b.classList.toggle('on',on);b.setAttribute('aria-checked',on?'true':'false');b.tabIndex=on?0:-1;if(on&&pop){b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');}});}
const trayBtn=$('#trayBtn');
function setTray(show){body.classList.toggle('tray-off',!show);trayBtn.setAttribute('aria-pressed',show?'true':'false');trayBtn.setAttribute('aria-label',(show?'Hide':'Show')+' lantern choices (L)');store.set('toro661-tray',show?'1':'0');}
trayBtn.addEventListener('click',()=>{setTray(body.classList.contains('tray-off'));Sound.knock(body.classList.contains('tray-off')?.92:1.08);});
setTray(store.get('toro661-tray')!=='0');
// speedometer: ground speed of the lantern you ride, a short arc gauge up to 40 km/h
(function(){
  const box=$('#speedo'),num=$('#spNum'),arc=$('#spArc'),ndl=$('#spNdl');if(!box) return;let last=0,shown=-1;
  (function loop(now){
    requestAnimationFrame(loop);
    if(!scene3||!body.classList.contains('free')||now-last<100) return;last=now;
    const v=scene3.speed(),k=v.kmh<.05?0:v.kmh,txt=k<10?k.toFixed(1):String(Math.round(k));
    if(txt!==shown){shown=txt;num.textContent=txt;}
    const f=clamp(k/40,0,1),a=Math.PI*(1-f);
    arc.setAttribute('stroke-dasharray',(f*100).toFixed(1)+' 100');
    ndl.setAttribute('x2',(16+Math.cos(a)*10).toFixed(2));ndl.setAttribute('y2',(17-Math.sin(a)*10).toFixed(2));
    box.classList.toggle('boost',v.boost);
  })(performance.now());
})();
function measureFree(){const b=$('#freeSwitch');if(b&&b.offsetWidth) document.documentElement.style.setProperty('--fbw',b.offsetWidth+'px');}
addEventListener('resize',measureFree);addEventListener('load',measureFree);setTimeout(measureFree,300);
function measureTray(){const t=$('#tray');if(t&&t.offsetHeight) document.documentElement.style.setProperty('--trayH',(t.offsetHeight-6)+'px');}
addEventListener('resize',measureTray);measureTray();
function chooseDesign(k){if(!scene3) return;if(scene3.setDesign(k)){Sound.unfold();}}
if(scene3){
  scene3.onDesign=k=>{paintTray(k,true);};
  trayBtns.forEach((b,i)=>{
    b.addEventListener('click',()=>chooseDesign(i));
    b.addEventListener('keydown',e=>{const n=trayBtns.length;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const j=(i+(e.key==='ArrowRight'?1:n-1))%n;chooseDesign(j);trayBtns[j].focus();}});
  });
  paintTray(0);
}

// keyboard
const HINT_TOUCH='<span class="hg">stick to drift</span><span class="hg">drag to look</span><span class="hg">pinch to zoom</span><span class="hg">tap a lantern to take it</span>';
const KEYMAP={w:'w',a:'a',s:'s',d:'d',z:'z',x:'x',c:'c',v:'v',arrowup:'arrowup',arrowdown:'arrowdown',arrowleft:'arrowleft',arrowright:'arrowright',shift:'shift','=':'zin','+':'zin','-':'zout','_':'zout',pageup:'zin',pagedown:'zout'};
let lastWish=0;
addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(lb.classList.contains('open')){closeLB();return;}if(body.classList.contains('menu')){setMenu(false);burger.focus();return;}if(body.classList.contains('free')){setFree(false);return;}}
  if(!body.classList.contains('free')||!scene3) return;
  const tg=e.target;if(tg&&/input|textarea|select/i.test(tg.tagName)) return;
  const k=(e.key||'').toLowerCase();
  if(KEYMAP[k]){scene3.setKey(KEYMAP[k],true);if(k.indexOf('arrow')===0||k.indexOf('page')===0) e.preventDefault();}
  if(/^[1-7]$/.test(k)&&!e.repeat){chooseDesign(+k-1);}
  if(k==='l'&&!e.repeat){trayBtn.click();}
  if((k==='q'||k==='e')&&!e.repeat){const n=scene3.designs.length;chooseDesign((scene3.design()+(k==='e'?1:n-1))%n);}
  if(k===' '||e.code==='Space'){e.preventDefault();const n=performance.now();if(n-lastWish>900){lastWish=n;scene3.releaseFromHero();Sound.release();}}
});
addEventListener('keyup',e=>{if(!scene3) return;const k=(e.key||'').toLowerCase();if(KEYMAP[k]) scene3.setKey(KEYMAP[k],false);});
addEventListener('blur',()=>{if(scene3) scene3.clearKeys();});

// canvas: drag to look in free drift, tap the water to ripple it
(function(){
  const cv=$('#scene');if(!scene3) return;
  let pd=null;
  // two fingers pinch to zoom in Free Drift
  const tp=new Map();let pinch=null;
  const pdist=()=>{const [a,b]=[...tp.values()];return Math.hypot(a.x-b.x,a.y-b.y)||1;};
  cv.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse'){tp.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(tp.size===2&&body.classList.contains('free')){pd=null;pinch={d0:pdist(),z0:scene3.state.orbitDist};try{cv.setPointerCapture(e.pointerId);}catch(_){}return;}}
    if(pinch) return;
    pd={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,t:performance.now(),id:e.pointerId,drag:false};});
  const lift=e=>{tp.delete(e.pointerId);if(pinch&&tp.size<2){pinch=null;const r=[...tp.entries()][0];pd=r?{x:r[1].x,y:r[1].y,lx:r[1].x,ly:r[1].y,t:0,id:r[0],drag:true}:null;}};
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>cv.addEventListener(ev,lift));
  ['gesturestart','gesturechange'].forEach(ev=>document.addEventListener(ev,e=>{if(body.classList.contains('free')) e.preventDefault();},{passive:false}));
  cv.addEventListener('pointermove',e=>{
    if(tp.has(e.pointerId)) tp.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&tp.size>=2){scene3.setZoom(pinch.z0*pinch.d0/pdist());return;}
    if(body.classList.contains('free')&&(!pd||!pd.drag)&&e.pointerType==='mouse'){cv.classList.toggle('pick',scene3.hoverAt(e.clientX,e.clientY));}
    if(!pd||e.pointerId!==pd.id) return;
    if(!body.classList.contains('free')) return;
    const dx=e.clientX-pd.x,dy=e.clientY-pd.y;
    if(!pd.drag&&Math.hypot(dx,dy)>4){pd.drag=true;body.classList.add('orbiting');try{cv.setPointerCapture(e.pointerId);}catch(_){}}
    if(pd.drag){scene3.orbit(e.clientX-pd.lx,e.clientY-pd.ly);}
    pd.lx=e.clientX;pd.ly=e.clientY;
  });
  function up(e){
    if(!pd) return;
    const moved=Math.hypot(e.clientX-pd.x,e.clientY-pd.y);
    if(e.type==='pointerup'&&moved<7&&performance.now()-pd.t<600){
      if(body.classList.contains('free')&&scene3.takeAt(e.clientX,e.clientY)){cv.classList.remove('pick');const d=scene3.state.transfer&&scene3.state.transfer.item;Sound.swap(d&&d.v===5);}
      else if(scene3.clickWater(e.clientX,e.clientY)) Sound.plop(rr(250,340),.06);
    }
    pd=null;body.classList.remove('orbiting');
  }
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('lostpointercapture',()=>{pd=null;body.classList.remove('orbiting');});
  addEventListener('blur',()=>{pd=null;body.classList.remove('orbiting');});
  cv.addEventListener('wheel',e=>{if(!body.classList.contains('free')) return;e.preventDefault();scene3.zoom(e.deltaY);},{passive:false});
  // joystick
  const joy=$('#joy'),knob=$('i',joy);let jid=null;
  function jmove(e){const r=joy.getBoundingClientRect(),rad=r.width*.38;let x=(e.clientX-r.left-r.width/2)/rad,y=(e.clientY-r.top-r.height/2)/rad;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}scene3.joy.x=x;scene3.joy.y=y;const tr=r.width*.32;knob.style.transform='translate('+(x*tr).toFixed(1)+'px,'+(y*tr).toFixed(1)+'px)';}
  joy.addEventListener('pointerdown',e=>{jid=e.pointerId;joy.classList.add('live');try{joy.setPointerCapture(jid);}catch(_){}jmove(e);});
  joy.addEventListener('pointermove',e=>{if(e.pointerId===jid) jmove(e);});
  const jend=()=>{jid=null;joy.classList.remove('live');scene3.joy.x=scene3.joy.y=0;knob.style.transform='';};
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>joy.addEventListener(ev,jend));
  $('#wishBtn').addEventListener('click',()=>{scene3.releaseFromHero();Sound.release();});
})();

// fullscreen and screenshot
$('#fsBtn').addEventListener('click',()=>{
  const d=document;
  if(!d.fullscreenElement){const el=d.documentElement;(el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el);}
  else (d.exitFullscreen||d.webkitExitFullscreen).call(d);
});
$('#shotBtn').addEventListener('click',()=>{
  if(!scene3){toast('Screenshots need WebGL, which this browser has turned off.',true);return;}
  if(scene3.screenshot()){toast('Screenshot saved as templatemo-634-lantern-river.png');Sound.knock(1.2);}
  else toast('Could not save the screenshot in this browser.',true);
});

// expose a tiny hook for testing and tuning
window.TORO={scene:scene3,setFree,progress,Sound};
})();
