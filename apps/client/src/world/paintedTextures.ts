import * as THREE from "three";
/** Original low-resolution hand-painted-style texture synthesis; no imported game assets. */
export type SurfaceKind="plaster"|"timber"|"slate"|"stone"|"ground";
function hash(x:number,y:number,salt:number):number{
 const a=Math.imul(x+salt,374761393)^Math.imul(y^salt,668265263);
 let z=Math.imul(a^(a>>>13),1274126177);
 return ((z^(z>>>16))>>>0)/4294967295;
}
export function samplePaintedSurface(kind:SurfaceKind,x:number,y:number):[number,number,number]{
 const rough=hash(x>>2,y>>2,27),grain=hash(x,y,71);
 let value=190+(rough-.5)*37+(grain-.5)*20;
 if(kind==="ground"){
   const tuft=hash(x>>1,y>>1,121),speck=hash(x,y,73);
   value=222+(rough-.5)*27+(tuft-.5)*28+(speck-.5)*16;
   if((x*7+y*17)%31===0)value-=22;
 }
 if(kind==="plaster")value+=8*Math.sin(x*.18+y*.07);
 if(kind==="timber")value+=14*Math.sin((x+y*.12)*.56);
 if(kind==="slate"){
   const row=Math.floor(y/16),col=Math.floor((x+(row%2)*8)/16);
   const edge=(y%16<=1||((x+(row%2)*8)%16<=1))?-42:0;
   value+=edge+(hash(col,row,54)-.5)*35;
 }
 if(kind==="stone"){
   const row=Math.floor(y/24),col=Math.floor((x+(row%2)*10)/25);
   if(y%24<2||(x+(row%2)*10)%25<2)value-=35;
   value+=(hash(col,row,87)-.5)*25;
 }
 const v=Math.max(80,Math.min(250,Math.round(value)));
 return [v,Math.max(0,v-(kind==="timber"?8:3)),Math.max(0,v-(kind==="slate"?6:0))];
}
export function paintedTexture(kind:SurfaceKind,size=64):THREE.DataTexture{
 const pixel=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const [r,g,b]=samplePaintedSurface(kind,x,y);
   const i=(y*size+x)*4;
   pixel[i]=r;pixel[i+1]=g;pixel[i+2]=b;pixel[i+3]=255;
 }
 const tex=new THREE.DataTexture(pixel,size,size,THREE.RGBAFormat);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
 tex.magFilter=THREE.NearestFilter;
 tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;
 tex.needsUpdate=true;
 return tex;
}
