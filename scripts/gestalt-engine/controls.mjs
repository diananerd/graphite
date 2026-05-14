/**
 * Inline JS controller for viewport zoom + pan + auto-fit (§18).
 *
 *   wheel / pinch  → zoom around cursor
 *   pointer drag   → pan
 *   double-click   → auto-fit (reset)
 *   keys + - 0     → step zoom / reset
 *   f              → fullscreen
 *
 * Updates:
 *   • `<g.zoom-root>` outer transform — entire content scales
 *   • every `<g.screen-stable>` — counter-scale so text/strokes stay constant
 *
 * Budget: ≤2.5KB minified-ish. Single IIFE, no deps, no globals.
 *
 * Designed to be inlined as raw text inside `<script>` in each SVG. Reads
 * the SVG's own `viewBox` for cursor-relative zoom math.
 */

export const CONTROLS_SCRIPT = `(function(){
function I(s){
var hz=parseFloat(s.getAttribute("data-camera-z"))||1;
var hx=parseFloat(s.getAttribute("data-camera-tx"))||0;
var hy=parseFloat(s.getAttribute("data-camera-ty"))||0;
var z=hz,tx=hx,ty=hy,zr=s.querySelector(".zoom-root"),ss=s.querySelectorAll(".screen-stable"),bs=[],i;
for(i=0;i<ss.length;i++)bs.push(ss[i].getAttribute("transform")||"");
var rng=(s.getAttribute("data-zoom-range")||"0.5 4").split(" ").map(parseFloat);
function A(){
zr.setAttribute("transform","translate("+tx+" "+ty+") scale("+z+")");
var r=s.getBoundingClientRect(),vb=s.viewBox.baseVal,inv=1/(z*(r.width/vb.width));
for(var i=0;i<ss.length;i++){var m=bs[i].match(/translate\\(([^)]+)\\)/);ss[i].setAttribute("transform","translate("+(m?m[1]:"0 0")+") scale("+inv+")")}
s.setAttribute("data-zoom",z.toFixed(2));
}
function clamp(v){return Math.max(rng[0],Math.min(rng[1],v))}
  s.addEventListener("wheel",function(e){
    e.preventDefault();
    var d=e.deltaY>0?0.9:1.1, nz=clamp(z*d);
    var r=s.getBoundingClientRect(),vb=s.viewBox.baseVal;
    var px=(e.clientX-r.left)/r.width*vb.width, py=(e.clientY-r.top)/r.height*vb.height;
    tx=px-(px-tx)*(nz/z); ty=py-(py-ty)*(nz/z); z=nz; A();
  },{passive:false});
  var dg=0,sx=0,sy=0;
  s.addEventListener("pointerdown",function(e){
    if(e.target.closest(".ctrl-btn"))return;
    dg=1; sx=e.clientX-tx; sy=e.clientY-ty; s.setPointerCapture(e.pointerId); s.style.cursor="grabbing";
  });
  s.addEventListener("pointermove",function(e){
    if(!dg)return;
    var r=s.getBoundingClientRect(),vb=s.viewBox.baseVal;
    tx=(e.clientX-sx)/r.width*vb.width; ty=(e.clientY-sy)/r.height*vb.height; A();
  });
  function up(e){dg=0;s.releasePointerCapture(e.pointerId);s.style.cursor=""}
  s.addEventListener("pointerup",up); s.addEventListener("pointercancel",up);
  s.addEventListener("dblclick",function(e){e.preventDefault();z=1;tx=0;ty=0;A()});
  s.tabIndex=0; s.setAttribute("role","application");
  // Step FSM (optional).
  var stepData=s.getAttribute("data-steps"),steps=stepData?JSON.parse(stepData):null,stepIdx=0,tweening=0;
  var nodeStepData=s.getAttribute("data-node-steps"),nodeMap=nodeStepData?JSON.parse(nodeStepData):{};
  var autoDefault=parseInt(s.getAttribute("data-autoplay-default"))||2500,autoplayId=null;
  function stopAutoplay(){if(autoplayId){clearTimeout(autoplayId);autoplayId=null;s.removeAttribute("data-autoplay")}}
  function startAutoplay(){
    if(!steps||autoplayId)return;
    s.setAttribute("data-autoplay","1");
    function tick(){
      if(stepIdx>=steps.length-1){stopAutoplay();return}
      applyStep(stepIdx+1);
      var dur=(steps[stepIdx].autoDuration||autoDefault);
      autoplayId=setTimeout(tick,dur);
    }
    var d=(steps[stepIdx].autoDuration||autoDefault);
    autoplayId=setTimeout(tick,d);
  }
  function toggleAutoplay(){if(autoplayId)stopAutoplay();else startAutoplay()}
  function tweenCam(tz,ttx,tty,dur){
    var z0=z,x0=tx,y0=ty,t0=performance.now();tweening=1;
    function f(){var t=Math.min(1,(performance.now()-t0)/dur);var e=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
      z=z0+(tz-z0)*e;tx=x0+(ttx-x0)*e;ty=y0+(tty-y0)*e;A();if(t<1)requestAnimationFrame(f);else tweening=0}
    requestAnimationFrame(f);
  }
  function applyStep(i){
    if(!steps||i<0||i>=steps.length)return;
    stepIdx=i;var st=steps[i],vis=new Set(st.visible||[]),act=new Set(st.activated||[]),dim=new Set(st.dimmed||[]);
    var nodes=s.querySelectorAll(".g-node, .g-edge");
    for(var k=0;k<nodes.length;k++){
      var n=nodes[k],id=n.getAttribute("data-id");
      n.style.opacity=vis.has(id)?(dim.has(id)?"0.28":"1"):"0";
      n.classList.toggle("is-dimmed",dim.has(id));
      n.classList.toggle("is-activated",act.has(id));
    }
    for(var k=0;k<(st.pulse||[]).length;k++){
      var p=s.querySelector('[data-id="'+st.pulse[k]+'"]');
      if(p){p.classList.remove("is-pulsing");void p.offsetWidth;p.classList.add("is-pulsing")}
    }
    var cap=s.querySelector(".step-caption"),cnt=s.querySelector(".step-counter");
    if(cap)cap.textContent=st.caption||"";
    if(cnt)cnt.textContent=(i+1)+" / "+steps.length;
    if(st.camera)tweenCam(st.camera.z,st.camera.tx,st.camera.ty,st.duration||600);
    s.setAttribute("data-step",i);
  }
  function act(k){
    if(k==="zoom-in"){z=clamp(z*1.2);A()}
    else if(k==="zoom-out"){z=clamp(z*0.83);A()}
    else if(k==="auto-fit"){if(steps)applyStep(stepIdx);else{z=hz;tx=hx;ty=hy;A()}}
    else if(k==="fullscreen"){if(document.fullscreenElement)document.exitFullscreen();else s.requestFullscreen()}
    else if(k==="step-next"&&steps&&!tweening){stopAutoplay();applyStep(Math.min(steps.length-1,stepIdx+1))}
    else if(k==="step-prev"&&steps&&!tweening){stopAutoplay();applyStep(Math.max(0,stepIdx-1))}
    else if(k==="autoplay-toggle"){toggleAutoplay()}
  }
  var KMAP={"+":"zoom-in","=":"zoom-in","-":"zoom-out","_":"zoom-out","0":"auto-fit","f":"fullscreen","F":"fullscreen",
            "ArrowRight":"step-next","ArrowLeft":"step-prev","n":"step-next","p":"step-prev"," ":"autoplay-toggle"};
  function btnAt(e){return e.target&&e.target.closest&&e.target.closest(".ctrl-btn")}
  s.addEventListener("keydown",function(e){
    var b=btnAt(e);if(b&&(e.key===" "||e.key==="Enter")){e.preventDefault();act(b.getAttribute("data-action"));return}
    var a=KMAP[e.key];if(a){e.preventDefault();act(a)}
  });
  s.addEventListener("click",function(e){
    var b=btnAt(e);if(b){e.stopPropagation();act(b.getAttribute("data-action"));return}
    if(steps&&!tweening){
      var n=e.target.closest&&e.target.closest(".g-node");
      if(n){var nid=n.getAttribute("data-id"),tgt=nodeMap[nid];
        if(tgt!==undefined&&tgt!==stepIdx){e.stopPropagation();stopAutoplay();applyStep(tgt)}}
    }
  });
  new ResizeObserver(A).observe(s);A();
  if(steps)applyStep(0);
}
var svgs=document.querySelectorAll("svg[data-controls]");
for(var i=0;i<svgs.length;i++)I(svgs[i]);
})();`;
