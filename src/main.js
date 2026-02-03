import * as THREE from 'three'
import './style.css'

let video=document.createElement("video");
video.muted=false;
video.playsInline=true;
video.loop=false;

const renderer=new THREE.WebGLRenderer();
renderer.setSize(innerWidth,innerHeight);
document.body.appendChild(renderer.domElement);

const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const scene=new THREE.Scene();
const screenScene=new THREE.Scene();

const rtA=new THREE.WebGLRenderTarget(innerWidth,innerHeight);
const rtB=new THREE.WebGLRenderTarget(innerWidth,innerHeight);

const mat=new THREE.ShaderMaterial({
uniforms:{
 tCurrent:{value:null},
 tAccum:{value:null},
 decay:{value:0.93},
 resolution:{value:new THREE.Vector2(innerWidth,innerHeight)}
},
fragmentShader:`
uniform sampler2D tCurrent;
uniform sampler2D tAccum;
uniform float decay;
uniform vec2 resolution;
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 vec4 cur=texture2D(tCurrent,uv);
 vec4 acc=texture2D(tAccum,uv);
 gl_FragColor=mix(cur,acc,decay);
}`,
vertexShader:`void main(){gl_Position=vec4(position,1.0);}`
});

// 🔲 Planos
const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);
scene.add(quad);

const screenMat=new THREE.MeshBasicMaterial({map:rtA.texture});
const screenQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),screenMat);
screenScene.add(screenQuad);

let a=rtA,b=rtB;
let videoTex=null;
let cameraActive=false;

// 🎨 Canvas para renderizar cuando no hay fuente activa
const blankMat=new THREE.MeshBasicMaterial({color:0x000000});
const blankQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),blankMat);
const blankScene=new THREE.Scene();
blankScene.add(blankQuad);

// 🎯 Ajustar proporción
function ajustarAspecto(){
 // Reintentar si aún no hay dimensiones
 if(!video.videoWidth || !video.videoHeight){
   setTimeout(ajustarAspecto, 100);
   return;
 }

 const vw=video.videoWidth;
 const vh=video.videoHeight;
 const videoAspect=vw/vh;
 const screenAspect=innerWidth/innerHeight;

 let scaleX=1, scaleY=1;

 if(videoAspect>screenAspect){
   scaleY=screenAspect/videoAspect;
 }else{
   scaleX=videoAspect/screenAspect;
 }

 quad.scale.set(scaleX,scaleY,1);
 screenQuad.scale.set(scaleX,scaleY,1);
}

// ⏯ Función para actualizar la UI de controles de video
function actualizarControlesVideo(){
 if(!videoTex){
   videoControls.style.display="none";
   return;
 }
 videoControls.style.display="flex";
}

// 🖱 Toggle menú con click en pantalla
let menuVisible=true;
document.addEventListener("click",e=>{
 // No ocultar si se clickeó dentro del menú
 if(menu.contains(e.target)) return;
 
 // Ocultar instrucciones si se clickeó fuera de ellas
 if(instructionsPanel.style.display==="flex" && !instructionsPanel.contains(e.target)){
   instructionsPanel.style.display="none";
 }
 
 menuVisible=!menuVisible;
 menu.style.opacity=menuVisible?"1":"0";
 menu.style.pointerEvents=menuVisible?"auto":"none";
});

// ⏸ Botón play/pausa
playPauseBtn.onclick=()=>{
 if(video.paused){
   video.play();
   playPauseBtn.textContent="⏸ ";
 }else{
   video.pause();
   playPauseBtn.textContent="⏯ ";
 }
};

// 📁 Botón upload archivo
uploadBtn.onclick=()=>{
 videoFile.click();
};

// ❓ Botón toggle instrucciones
instructionsToggleBtn.onclick=()=>{
 if(instructionsPanel.style.display==="none"){
   instructionsPanel.style.display="flex";
 }else{
   instructionsPanel.style.display="none";
 }
};

// ⛶ Botón pantalla completa
fullscreenBtn.onclick=async()=>{
 try{
   if(!document.fullscreenElement){
     await document.documentElement.requestFullscreen();
     fullscreenBtn.textContent="⛶";
   }else{
     await document.exitFullscreen();
     fullscreenBtn.textContent="⛶";
   }
 }catch(e){
   console.error("Error al cambiar fullscreen:",e);
 }
};

// ⏱ Actualizar slider cuando cambia el tiempo del video
video.ontimeupdate=()=>{
 if(video.duration){
   videoTime.value=(video.currentTime/video.duration)*100;
   
   const formatTime=t=>{
     const mins=Math.floor(t/60);
     const secs=Math.floor(t%60);
     return `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
   };
   
   timeLabel.textContent=`${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
 }
};

// ⏱ Cuando el usuario mueve el slider
videoTime.oninput=e=>{
 if(video.duration){
   video.currentTime=(parseFloat(e.target.value)/100)*video.duration;
 }
};

// 🔁 Loop
function loop(){
  requestAnimationFrame(loop);
  if(videoTex){
   mat.uniforms.tCurrent.value=videoTex;
   mat.uniforms.tAccum.value=a.texture;
   mat.uniforms.decay.value=parseFloat(trail.value);

   renderer.setRenderTarget(b);
   renderer.render(scene,camera);
   renderer.setRenderTarget(null);

   screenMat.map=b.texture;
   renderer.render(screenScene,camera);

   [a,b]=[b,a];
  }else{
   // Renderizar pantalla negra cuando no hay fuente activa
   renderer.setRenderTarget(null);
   renderer.render(blankScene,camera);
  }
}
loop();

// 📷 Cámara - Toggle
useCam.onclick=async()=>{
  if(cameraActive){
    // Apagar cámara
    if(video.srcObject){
      video.srcObject.getTracks().forEach(track=>track.stop());
      video.srcObject=null;
    }
    videoTex=null;
    cameraActive=false;
    useCam.style.opacity="1";
    instructionsPanel.style.display="flex";
    
    // Limpiar render targets para evitar mostrar último frame
    const clearColor=new THREE.Color(0x000000);
    renderer.setRenderTarget(rtA);
    renderer.setClearColor(clearColor);
    renderer.clear();
    renderer.setRenderTarget(rtB);
    renderer.clear();
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearColor);
    renderer.clear();
  }else{
    // Prender cámara
    // Ocultar instrucciones ANTES de cualquier otra cosa
    instructionsPanel.style.display="none";
    
    if(video.src){
      URL.revokeObjectURL(video.src);
      video.src="";
    }
    
    const stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:"environment"}}
    });
    video.srcObject=stream;
    
    // Asignar handlers ANTES de play
    video.onloadedmetadata=()=>{
      ajustarAspecto();
      // Ocultar controles de tiempo para cámara
      videoControls.style.display="none";
    };
    
    await video.play();
    videoTex=new THREE.VideoTexture(video);
    cameraActive=true;
    useCam.style.opacity="0.5";
  }
};

// 🎞️ Archivo
videoFile.onchange=e=>{
   const file=e.target.files[0];
   if(!file) return;
   
   // Detener stream de cámara anterior si existe
   if(video.srcObject){
     video.srcObject.getTracks().forEach(track=>track.stop());
     video.srcObject=null;
     cameraActive=false;
     useCam.style.opacity="1";
   }
   // Limpiar archivo anterior
   if(video.src){
     URL.revokeObjectURL(video.src);
   }
   
   video.src=URL.createObjectURL(file);
   video.play();
   playPauseBtn.textContent="⏸ ";
   videoTex=new THREE.VideoTexture(video);
   video.onloadedmetadata=()=>{
     ajustarAspecto();
     actualizarControlesVideo();
     instructionsPanel.style.display="none";
   };
};

window.addEventListener("resize",()=>{
 renderer.setSize(innerWidth,innerHeight);
 ajustarAspecto();
});
