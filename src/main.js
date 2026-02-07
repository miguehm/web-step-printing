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
 contrast:{value:1.0},
 brightness:{value:0.0},
 resolution:{value:new THREE.Vector2(innerWidth,innerHeight)}
},
fragmentShader:`
uniform sampler2D tCurrent;
uniform sampler2D tAccum;
uniform float decay;
uniform float contrast;
uniform float brightness;
uniform vec2 resolution;

void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 vec4 cur=texture2D(tCurrent,uv);
 vec4 acc=texture2D(tAccum,uv);
 
 // Acumular usando una mezcla que preserva el contraste
 // En lugar de mezcla lineal simple, usamos un enfoque que mantiene
 // mejor el rango dinámico cuando el decay es alto
 vec4 accumulated=mix(cur,acc,decay);
 
 // Normalización tonal: mantiene el brillo promedio sin perder contraste
 // Esto ayuda cuando hay mucha acumulación
 float lumCur=dot(cur.rgb,vec3(0.299,0.587,0.114));
 float lumAcc=dot(acc.rgb,vec3(0.299,0.587,0.114));
 float targetLum=mix(lumCur,lumAcc,decay);
 
 // Si el brillo acumulado es muy bajo, aplicar boost sutil
 float lumBoost=1.0;
 if(targetLum<0.1){
   lumBoost=mix(1.0,1.5,0.1-targetLum);
 }
 
 // Aplicar contraste y brillo
 accumulated.rgb=(accumulated.rgb-0.5)*contrast+0.5;
 accumulated.rgb+=vec3(brightness);
 accumulated.rgb*=lumBoost;
 
 gl_FragColor=accumulated;
}`,
vertexShader:`void main(){gl_Position=vec4(position,1.0);}`
});

// Planes
const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);
scene.add(quad);

const screenMat=new THREE.MeshBasicMaterial({map:rtA.texture});
const screenQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),screenMat);
screenScene.add(screenQuad);

let a=rtA,b=rtB;
let videoTex=null;
let cameraActive=false;

// Canvas para renderizar cuando no hay fuente activa
const blankMat=new THREE.MeshBasicMaterial({color:0x000000});
const blankQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),blankMat);
const blankScene=new THREE.Scene();
blankScene.add(blankQuad);

// Ajustar proporción
function ajustarAspecto(){
 // Reintentar si aún no hay dimensiones
 if(!video.videoWidth || !video.videoHeight){
   setTimeout(ajustarAspecto, 100);
   return;
 }

 let vw=video.videoWidth;
 let vh=video.videoHeight;
 
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

// Función para actualizar la UI de controles de video
function actualizarControlesVideo(){
 if(!videoTex){
   videoControls.style.display="none";
   return;
 }
 videoControls.style.display="flex";
}

// Toggle menú con click en pantalla
let menuVisible=true;
document.addEventListener("click",e=>{
  // No ocultar si se clickeó dentro del menú
  if(menu.contains(e.target)) return;
  
  // Ocultar instrucciones si se clickeó fuera de ellas
  if(instructionsPanel.style.display==="flex" && !instructionsPanel.contains(e.target)){
    instructionsPanel.style.display="none";
  }
  
  // No ocultar herramientas si no hay contenido cargado ni cámara encendida
  if(!videoTex && !cameraActive){
    return;
  }
  
  menuVisible=!menuVisible;
  menu.style.opacity=menuVisible?"1":"0";
  menu.style.pointerEvents=menuVisible?"auto":"none";
});

// Botón play/pausa
playPauseBtn.onclick=(e)=>{
   e.stopPropagation();
   if(video.paused){
     video.play();
     actualizarPlayPauseSvg();
   }else{
     video.pause();
     actualizarPlayPauseSvg();
   }
};

// Actualizar icono play/pausa
function actualizarPlayPauseSvg(){
  const svg=document.getElementById('playPauseSvg');
  if(video.paused){
    // Mostrar icono de play (triángulo)
    svg.innerHTML='<polygon points="5 3 19 12 5 21 5 3"/>';
  }else{
    // Mostrar icono de pausa (dos barras)
    svg.innerHTML='<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  }
}

// Botón upload archivo
uploadBtn.onclick=(e)=>{
  e.stopPropagation();
  videoFile.click();
};

// Botón toggle instrucciones
instructionsToggleBtn.onclick=(e)=>{
  e.stopPropagation();
  if(instructionsPanel.style.display==="none"){
    instructionsPanel.style.display="flex";
  }else{
    instructionsPanel.style.display="none";
  }
};

// Botón pantalla completa
fullscreenBtn.onclick=async(e)=>{
   e.stopPropagation();
   try{
     if(!document.fullscreenElement){
       await document.documentElement.requestFullscreen();
     }else{
       await document.exitFullscreen();
     }
   }catch(e){
     console.error("Error al cambiar fullscreen:",e);
   }
};

// Actualizar slider cuando cambia el tiempo del video
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

// Actualizar icono cuando el video se pausa
video.onpause=()=>{
  actualizarPlayPauseSvg();
};

// Actualizar icono cuando el video se reanuda
video.onplay=()=>{
  actualizarPlayPauseSvg();
};

// Cuando el usuario mueve el slider
videoTime.oninput=e=>{
  e.stopPropagation();
  if(video.duration){
    video.currentTime=(parseFloat(e.target.value)/100)*video.duration;
  }
};

// Proteger slider de trail (intensidad del rastro)
trail.oninput=e=>{
   e.stopPropagation();
   // Actualizar display del valor
   trailValue.textContent=parseFloat(trail.value).toFixed(2);
};

// Proteger slider de contraste
contrast.oninput=e=>{
   e.stopPropagation();
   // Actualizar display del valor
   contrastValue.textContent=parseFloat(contrast.value).toFixed(2);
};

// Proteger slider de brillo
brightness.oninput=e=>{
   e.stopPropagation();
   // Actualizar display del valor
   brightnessValue.textContent=parseFloat(brightness.value).toFixed(2);
};

// Navegación entre sliders
let currentSliderPart=1;

nextSliderBtn.onclick=(e)=>{
   e.stopPropagation();
   if(currentSliderPart===1){
      slidersPart1.style.display="none";
      slidersPart2.style.display="flex";
      slidersPart2.style.flexDirection="column";
      slidersPart2.style.gap="4px";
      currentSliderPart=2;
   }
};

prevSliderBtn.onclick=(e)=>{
   e.stopPropagation();
   if(currentSliderPart===2){
      slidersPart2.style.display="none";
      slidersPart1.style.display="flex";
      slidersPart1.style.flexDirection="column";
      slidersPart1.style.gap="4px";
      currentSliderPart=1;
   }
};

// Loop
function loop(){
   requestAnimationFrame(loop);
   if(videoTex){
    mat.uniforms.tCurrent.value=videoTex;
    mat.uniforms.tAccum.value=a.texture;
    mat.uniforms.decay.value=parseFloat(trail.value);
    mat.uniforms.contrast.value=parseFloat(contrast.value);
    mat.uniforms.brightness.value=parseFloat(brightness.value);

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

// Cámara - Toggle
useCam.onclick=async(e)=>{
   e.stopPropagation();
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

// Archivo
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
    videoTex=new THREE.VideoTexture(video);
    actualizarPlayPauseSvg();
    video.onloadedmetadata=()=>{
      ajustarAspecto();
      actualizarControlesVideo();
      instructionsPanel.style.display="none";
    };
};

// Botón rotar video
window.addEventListener("resize",()=>{
 renderer.setSize(innerWidth,innerHeight);
 ajustarAspecto();
});
