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
  function act(k){
    if(k==="zoom-in")z=clamp(z*1.2);
    else if(k==="zoom-out")z=clamp(z*0.83);
    else if(k==="auto-fit"){z=hz;tx=hx;ty=hy}
    else if(k==="fullscreen"){if(document.fullscreenElement)document.exitFullscreen();else s.requestFullscreen()}
    A();
  }
  var KMAP={"+":"zoom-in","=":"zoom-in","-":"zoom-out","_":"zoom-out","0":"auto-fit","f":"fullscreen","F":"fullscreen"};
  function btnAt(e){return e.target&&e.target.closest&&e.target.closest(".ctrl-btn")}
  s.addEventListener("keydown",function(e){
    var b=btnAt(e);if(b&&(e.key===" "||e.key==="Enter")){e.preventDefault();act(b.getAttribute("data-action"));return}
    var a=KMAP[e.key];if(a){e.preventDefault();act(a)}
  });
  s.addEventListener("click",function(e){var b=btnAt(e);if(b){e.stopPropagation();act(b.getAttribute("data-action"))}});
  new ResizeObserver(A).observe(s);A();
}
var svgs=document.querySelectorAll("svg[data-controls]");
for(var i=0;i<svgs.length;i++)I(svgs[i]);
})();`;
