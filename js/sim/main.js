// BOB rescue simulator: rocker-bogie motion, physics, mission, replay and the control link.
// Plain JavaScript on three.js r128 (vendor/three-r128.min.js, loaded as a classic script before this module).
(async function(){
const $=id=>document.getElementById(id);
const [mesh,sim,arena]=await Promise.all(['models/sim/mesh.json','models/sim/sim.json','models/sim/arena.json'].map(u=>fetch(u).then(r=>r.json())));
function dec(s,T){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new T(u.buffer);}
const F=dec(sim.data,Float32Array),NF=sim.names.length,N=sim.n,FPS=sim.fps,TOTAL=sim.total;
const IX={};sim.names.forEach((n,i)=>IX[n]=i);
const DISCRETE=new Set(['pkFree','mdFree','pipFly','phase']);

// ---------- three setup
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b0e13);scene.fog=new THREE.Fog(0x0b0e13,6000,14000);
const camera=new THREE.PerspectiveCamera(45,1,20,40000);
const root=new THREE.Group();root.rotation.x=-Math.PI/2;scene.add(root);   // model Z-up -> three Y-up
const W=(x,y,z)=>new THREE.Vector3(x,z,-y);                                  // model -> world
scene.add(new THREE.HemisphereLight(0xb5c6e6,0x20242c,0.85));
const sun=new THREE.DirectionalLight(0xfff1de,1.5);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);const sc=sun.shadow.camera;sc.left=sc.bottom=-1300;sc.right=sc.top=1300;sc.near=100;sc.far=6000;
sun.shadow.bias=-0.0006;sun.shadow.normalBias=2;
root.add(sun);root.add(sun.target);

const mat=(o)=>new THREE.MeshStandardMaterial(Object.assign({roughness:.6,metalness:.1,side:THREE.DoubleSide},o));
function geo(g){const q=new THREE.BufferGeometry();q.setAttribute('position',new THREE.BufferAttribute(dec(g.p,Float32Array),3));
 q.setAttribute('color',new THREE.BufferAttribute(dec(g.c,Uint8Array),3,true));q.setIndex(new THREE.BufferAttribute(dec(g.i,Uint32Array),1));q.computeVertexNormals();return q;}
const vcMat=mat({vertexColors:true,roughness:.55,metalness:.15});
function M(g,m){const o=new THREE.Mesh(geo(g),m||vcMat);o.castShadow=true;o.receiveShadow=true;return o;}
function grp(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}

// ---------- arena
function noiseTex(){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
 x.fillStyle='#2b3038';x.fillRect(0,0,512,512);
 for(let i=0;i<5000;i++){const v=40+Math.random()*26|0;x.fillStyle=`rgba(${v},${v+4},${v+10},.5)`;x.fillRect(Math.random()*512,Math.random()*512,2,2);}
 x.strokeStyle='rgba(255,255,255,.10)';x.lineWidth=3;x.strokeRect(0,0,512,512);
 x.strokeStyle='rgba(255,255,255,.04)';x.lineWidth=1;x.beginPath();x.moveTo(256,0);x.lineTo(256,512);x.moveTo(0,256);x.lineTo(512,256);x.stroke();
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.encoding=THREE.sRGBEncoding;return t;}
function stripeTex(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 x.fillStyle='#e9a21a';x.fillRect(0,0,128,128);x.fillStyle='#14161a';
 for(let i=-2;i<4;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64+32,0);x.lineTo(i*64+32+128,128);x.lineTo(i*64+128,128);x.fill();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;return t;}
const ft=noiseTex();const AX0=arena.x_min,AX1=arena.x_max,AYH=arena.y_half;
ft.repeat.set((AX1-AX0)/500,2*AYH/500);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(AX1-AX0,2*AYH),mat({map:ft,roughness:.95,metalness:0}));
floor.position.set((AX0+AX1)/2,0,0);floor.receiveShadow=true;root.add(floor);
const stripe=stripeTex();
function box(x0,x1,y0,y1,z0,z1,m,shadow=true,parent=root){const o=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m);
 o.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;}
// walls
const wallM=mat({color:0x232a34,roughness:.85,metalness:0}),amberM=new THREE.MeshStandardMaterial({color:0xff9a2a,emissive:0xff7a10,emissiveIntensity:.9});
const WH=arena.wall_h;
box(AX0-40,AX0,-AYH-40,AYH+40,0,WH,wallM);box(AX1,AX1+40,-AYH-40,AYH+40,0,WH,wallM);
box(AX0,AX1,-AYH-40,-AYH,0,WH,wallM);box(AX0,AX1,AYH,AYH+40,0,WH,wallM);
box(AX0,AX1,-AYH,-AYH+6,WH-30,WH-24,amberM,false);box(AX0,AX1,AYH-6,AYH,WH-30,WH-24,amberM,false);
box(AX1-6,AX1,-AYH,AYH,WH-30,WH-24,amberM,false);
// ramp (rebuilt when the angle slider changes)
const rp=arena.ramp;
const rampM=mat({color:0x3c424c,roughness:.85,metalness:.05});
const rampGroup=new THREE.Group();root.add(rampGroup);
const barM2=new THREE.MeshStandardMaterial({color:0x7b838f,roughness:.9});
function rampProfile(angDeg){const tan=Math.tan(angDeg*Math.PI/180),ease=rp.ease,L=rp.rise/tan+ease,step=2,n=Math.round(L/step);
 const s_=u=>{u=Math.min(Math.max(u,0),1);return u*u*(3-2*u);};const ws=[];
 for(let i=0;i<=n;i++){const x=i*step;ws.push(Math.min(s_(x/ease),s_((L-x)/ease)));}
 const zs=[0];let acc=0;for(let i=1;i<=n;i++){acc+=(ws[i]+ws[i-1])/2*step*tan;zs.push(acc);}
 const k=rp.rise/acc,prof=[];for(let i=0;i<=n;i+=10)prof.push([rp.x0+i*step,zs[i]*k]);
 return {prof,x1:rp.x0+n*step};}
function buildRamp(angDeg){
 const r=rampProfile(angDeg);rp.profile=r.prof;rp.x1=r.x1;rp.angle=angDeg;
 while(rampGroup.children.length){const o=rampGroup.children.pop();if(o.geometry)o.geometry.dispose();}
 const sh=new THREE.Shape();sh.moveTo(rp.x0,0);for(const p of rp.profile)sh.lineTo(p[0],p[1]);sh.lineTo(rp.x1,rp.rise);sh.lineTo(rp.x1,0);sh.lineTo(rp.x0,0);
 const rg=new THREE.ExtrudeGeometry(sh,{depth:2*rp.half_w,bevelEnabled:false});rg.translate(0,0,-rp.half_w);rg.rotateX(Math.PI/2);
 const ramp=new THREE.Mesh(rg,rampM);ramp.castShadow=ramp.receiveShadow=true;rampGroup.add(ramp);
 box(rp.x1-1,arena.platform.x_end,-arena.platform.half_w,arena.platform.half_w,0,rp.rise,rampM,true,rampGroup);
 const rs=rp.profile;
 for(const s of [-1,1]){const pts=rs.map(p=>new THREE.Vector3(p[0],s*(rp.half_w-8),p[1]+2));pts.push(new THREE.Vector3(arena.platform.x_end,s*(rp.half_w-8),rp.rise+2));
  rampGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xff9a2a})));}
 for(let i=0;i<rs.length;i+=3){const p=rs[i];const b=new THREE.Mesh(new THREE.BoxGeometry(6,2*rp.half_w-60,3),barM2);b.position.set(p[0],0,p[1]+1.5);rampGroup.add(b);}
}
buildRamp(20);
// start pad + drop zone
const dz=arena.drop_zone;
const dzMat=new THREE.MeshStandardMaterial({color:0x1aa88c,emissive:0x1fe0b8,emissiveIntensity:.6,roughness:.5});
const dzMesh=new THREE.Mesh(new THREE.BoxGeometry(dz.size,dz.size,4),dzMat);dzMesh.position.set(dz.x,dz.y,rp.rise+2);dzMesh.receiveShadow=true;root.add(dzMesh);
const dzRing=new THREE.Mesh(new THREE.RingGeometry(dz.size*.62,dz.size*.7,48),new THREE.MeshBasicMaterial({color:0x35f0c8,transparent:true,opacity:.8,side:THREE.DoubleSide}));
dzRing.position.set(dz.x,dz.y,rp.rise+5);root.add(dzRing);
const startPad=box(-250,250,-250,250,0,2,new THREE.MeshStandardMaterial({color:0x2b6cb0,roughness:.8}),false);
// hazard bars at the foot of the ramp and platform edge
const hz=new THREE.MeshStandardMaterial({map:stripe,roughness:.8});stripe.repeat.set(8,1);
box(rp.x0-60,rp.x0-20,-rp.half_w,rp.half_w,0,8,hz,false);
// ---------- arena layouts: the classic one plus seeded random ones
let BARRELS=[],glow=null,vRing=null,VICTIM={x:0,y:0};
const arenaGroup=new THREE.Group();root.add(arenaGroup);
const logM=mat({color:0x6b4a2b,roughness:.9,metalness:0});
const rubM=[mat({color:0x8b8f96,roughness:.95,metalness:0}),mat({color:0x9a7b5a,roughness:.95,metalness:0}),mat({color:0x70757c,roughness:.95,metalness:0})];
const CLASSIC={logs:JSON.parse(JSON.stringify(arena.logs)),boxes:JSON.parse(JSON.stringify(arena.boxes)),
 barrels:[[700,1300,0x2d6cdf],[2000,-1250,0xc23b3b],[2950,1300,0x2d6cdf],[3600,-1400,0xc23b3b],[5200,1250,0x2d6cdf]],
 cones:[[300,-1000],[300,1000],[1500,-1250],[2500,1150],[3000,-1100],[3700,-1250],[4400,-1100],[4400,1100]],
 debris:[[3500,1180,110,70,60],[4040,1230,90,130,45],[3950,640,70,60,35],[3420,760,100,80,40]],
 victim:{x:arena.victim.x,y:arena.victim.y,rot:.5}};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function genLayout(seed){if(!seed)return CLASSIC;
 const r=mulberry(seed*7919+13),R=(a,b)=>a+(b-a)*r();const L={logs:[],boxes:[],barrels:[],cones:[],debris:[]};
 const nl=2+(r()<.5?1:0);let px=-999;for(let i=0;i<nl;i++){let x=R(900,2900);for(let k=0;k<20&&Math.abs(x-px)<280;k++)x=R(900,2900);px=x;
  const sp=R(550,900);L.logs.push({x,r:R(24,42),y0:-sp*R(.8,1.2),y1:sp*R(.8,1.2)});}
 const nb=3+Math.floor(r()*3);for(let i=0;i<nb;i++){const w=R(180,300),d=R(220,380),x0=R(1300,3100),cy=R(-700,700);L.boxes.push({x0,x1:x0+w,y0:cy-d/2,y1:cy+d/2,h:R(25,48)});}
 const side=r()<.5?-1:1;L.victim={x:R(3300,4000),y:side*R(700,1200),rot:R(0,6.28)};
 const nbar=4+Math.floor(r()*3);let tries=0;
 while(L.barrels.length<nbar&&tries++<60){const x=R(600,5200),y=R(-1350,1350);
  if(Math.abs(y)<350&&x<4200)continue;if(x>4150&&Math.abs(y)<950)continue;if(x<550&&Math.abs(y)<550)continue;
  if(Math.hypot(x-L.victim.x,y-L.victim.y)<500)continue;if(L.barrels.some(b=>Math.hypot(b[0]-x,b[1]-y)<450))continue;
  L.barrels.push([x,y,L.barrels.length%2?0xc23b3b:0x2d6cdf]);}
 const nc=6+Math.floor(r()*4);for(let i=0;i<nc;i++){const x=R(200,4600),y=R(-1450,1450);if(Math.abs(y)<250||(x>4150&&Math.abs(y)<950))continue;L.cones.push([x,y]);}
 for(let i=0;i<4;i++){const a=R(0,6.28),d=R(260,520);L.debris.push([L.victim.x+Math.cos(a)*d,L.victim.y+Math.sin(a)*d,R(60,130),R(60,130),R(30,60)]);}
 return L;}
function cone(x,y){const g=new THREE.Group();const c=new THREE.Mesh(new THREE.ConeGeometry(55,170,20),mat({color:0xff6a14,roughness:.6}));c.rotation.x=Math.PI/2;c.position.z=95;
 const b=new THREE.Mesh(new THREE.BoxGeometry(150,150,10),mat({color:0x22262c}));b.position.z=5;
 const w=new THREE.Mesh(new THREE.CylinderGeometry(36,44,26,20),mat({color:0xf2f2f2}));w.rotation.x=Math.PI/2;w.position.z=95;
 [c,b,w].forEach(o=>{o.castShadow=o.receiveShadow=true;o.userData.heat=.1;g.add(o);});g.position.set(x,y,0);arenaGroup.add(g);}
function barrel(x,y,col){const o=new THREE.Mesh(new THREE.CylinderGeometry(150,150,380,24),mat({color:col,roughness:.5,metalness:.3}));o.rotation.x=Math.PI/2;o.position.set(x,y,190);o.castShadow=o.receiveShadow=true;o.userData.heat=.08;arenaGroup.add(o);
 const r=new THREE.Mesh(new THREE.CylinderGeometry(152,152,20,24),mat({color:0x1b1d21}));r.rotation.x=Math.PI/2;r.position.set(x,y,250);r.userData.heat=.08;arenaGroup.add(r);}
// a casualty dummy lying on their back in rubble: low, smooth shapes, nothing taller than the chest
function human(){const g=new THREE.Group();
 const skin=mat({color:0xd9a98a,roughness:.7}),vest=mat({color:0xff7a1a,roughness:.7}),tape=mat({color:0xe8f26a,roughness:.5,emissive:0x555500,emissiveIntensity:.3}),pants=mat({color:0x2f3f63,roughness:.85}),boot=mat({color:0x15171a,roughness:.7}),helmet=mat({color:0xf2c500,roughness:.4}),slab=mat({color:0x8b8f96,roughness:.95});
 const add=(geo,m,x,y,z,heat)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;o.userData.heat=heat;g.add(o);return o;};
 const ell=(m,rx,ry,rz,x,y,z,heat)=>{const o=add(new THREE.SphereGeometry(1,24,16),m,x,y,z,heat);o.scale.set(rx,ry,rz);return o;};
 const seg=(a,b,r0,r1,m,heat)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),L=d.length();
  const o=add(new THREE.CylinderGeometry(r1,r0,L,14),m,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,heat);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
 ell(vest,270,185,92,0,0,92,.85);                                   // torso in vest
 for(const sx of [-95,95])ell(tape,12,181,89,sx,0,92,.85);          // reflective bands
 ell(pants,115,150,78,330,0,78,.7);                                  // pelvis
 seg([-250,0,95],[-330,0,100],48,44,skin,1);                         // neck
 ell(skin,92,84,88,-410,0,100,1);                                     // head
 const hm=add(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),helmet,-410,0,112,.5);hm.scale.set(100,94,92);
 for(const s of [-1,1]){const sp=s*.06;
  seg([420,s*80,62],[840,s*(95+sp*400),50],62,50,pants,.7);          // thigh
  seg([840,s*(95+sp*400),48],[1250,s*(105+sp*800),38],48,38,pants,.7); // shin
  const b=add(new THREE.BoxGeometry(190,92,66),boot,1340,s*(110+sp*900),34,.4);b.rotation.z=s*.1;}
 // arm 1 lies along the body
 seg([-20,-250,50],[290,-262,40],40,34,vest,.85);seg([290,-262,38],[560,-270,32],34,28,skin,1);ell(skin,42,40,34,590,-270,32,1);
 // arm 2 bent, forearm raised a little, waving weakly
 seg([-20,250,50],[270,262,48],40,34,vest,.85);seg([270,262,48],[60,300,190],34,28,skin,1);ell(skin,42,40,38,30,305,200,1);
 // a slab and rocks have fallen across the shins
 const sl=add(new THREE.BoxGeometry(380,460,46),slab,1010,0,98,.12);sl.rotation.y=-.1;sl.rotation.z=.04;
 add(new THREE.BoxGeometry(120,110,70),slab,880,-250,35,.12);add(new THREE.BoxGeometry(110,100,60),slab,1230,250,30,.12);
 return g;}
const hotGeo=null;
function buildArena(seed){
 const L=genLayout(seed);arena.seed=seed;
 while(arenaGroup.children.length){const o=arenaGroup.children.pop();o.traverse(c=>{if(c.geometry)c.geometry.dispose();});}
 arena.logs=L.logs;arena.boxes=L.boxes;arena.victim={x:L.victim.x,y:L.victim.y};VICTIM=arena.victim;BARRELS=L.barrels.map(b=>[b[0],b[1]]);
 for(const l of L.logs){const o=new THREE.Mesh(new THREE.CylinderGeometry(l.r,l.r,l.y1-l.y0,28),logM);o.position.set(l.x,(l.y0+l.y1)/2,0);o.castShadow=o.receiveShadow=true;o.userData.heat=.12;arenaGroup.add(o);}
 L.boxes.forEach((b,i)=>{const o=box(b.x0,b.x1,b.y0,b.y1,0,b.h,rubM[i%3],true,arenaGroup);o.userData.heat=.12;});
 L.cones.forEach(p=>cone(p[0],p[1]));L.barrels.forEach(b=>barrel(b[0],b[1],b[2]));
 L.debris.forEach((d,i)=>{const o=box(d[0]-d[2]/2,d[0]+d[2]/2,d[1]-d[3]/2,d[1]+d[3]/2,0,d[4],rubM[i%3],true,arenaGroup);o.userData.heat=.12;});
 const V=L.victim,vg=new THREE.Group();vg.position.set(V.x,V.y,0);const hm=human();hm.scale.setScalar(.42);hm.position.set(-190,0,0);vg.add(hm);vg.rotation.z=V.rot;arenaGroup.add(vg);
 glow=new THREE.Mesh(new THREE.SphereGeometry(340,24,16),new THREE.MeshBasicMaterial({color:0xff5a1a,transparent:true,opacity:.10,depthWrite:false}));glow.position.set(V.x,V.y,90);glow.userData.hideThermal=true;arenaGroup.add(glow);
 vRing=new THREE.Mesh(new THREE.RingGeometry(230,250,48),new THREE.MeshBasicMaterial({color:0xff5a1a,transparent:true,opacity:.6,side:THREE.DoubleSide}));vRing.position.set(V.x,V.y,3);vRing.userData.hideThermal=true;arenaGroup.add(vRing);
}
let curSeed=0;buildArena(0);

// ---------- Bob
const bob=new THREE.Group();root.add(bob);
bob.add(M(mesh.body));
const shellMat=mat({vertexColors:true,roughness:.5,metalness:.1,transparent:false});const shell=M(mesh.shell,shellMat);bob.add(shell);
const P=[0,0,95],Q=[-100,0,75];
const side={};
for(const s of ['L','R']){
 const rk=grp(bob),bg=grp(rk);
 rk.add(M(mesh['rocker'+s]));bg.add(M(mesh['bogie'+s]));
 const spin=[];
 for(const [tag,x,par] of [['A',200,rk],['B',0,bg],['C',-200,bg]]){
  const mir=grp(par,x,0,50);if(s==='R')mir.scale.set(1,-1,1);
  const sp=grp(mir);sp.add(M(mesh.tire,mat({vertexColors:true,roughness:.95,metalness:0})));sp.add(M(mesh.rim));spin.push(sp);}
 const lk=M(mesh['link'+s]);bob.add(lk);
 const lt=grp(bob,-66,s==='L'?52:-52,0);lt.add(M(mesh['latch'+s]));
 side[s]={rk,bg,spin,lk,lt};
}
const barG=grp(bob);barG.add(M(mesh.bar));
const flapG=grp(bob,-194,0,67);flapG.add(M(mesh.flap));
// Pip
const pip=new THREE.Group();root.add(pip);
const pipBody=grp(pip);pipBody.add(M(mesh.pip));
const pk1=M(mesh.pkt1);pipBody.add(pk1);
const props=[];
for(const k of Object.keys(mesh.props_meta)){const c=mesh.props_meta[k];const g=grp(pipBody,c[0],c[1],0);g.add(M(mesh['prop_'+k]));props.push({g,dir:(k==='front_left'||k==='rear_right')?1:-1});}
// free packets
const pkG=geo(mesh.pkt1);pkG.translate(0,0,-21);
const pkFree=new THREE.Mesh(pkG,vcMat);pkFree.scale.setScalar(2.6);pkFree.castShadow=true;pkFree.visible=false;root.add(pkFree);
// medicine packet prop
const medG=new THREE.Group();
const mb=new THREE.Mesh(new THREE.BoxGeometry(60,40,25),mat({color:0xf4f4f0,roughness:.6}));mb.castShadow=true;medG.add(mb);
const rm=new THREE.MeshStandardMaterial({color:0xd91f2a,roughness:.5});
const c1=new THREE.Mesh(new THREE.BoxGeometry(22,8,1),rm),c2=new THREE.Mesh(new THREE.BoxGeometry(8,22,1),rm);c1.position.z=c2.position.z=13;medG.add(c1,c2);
medG.visible=false;root.add(medG);

// ---------- helpers
const m1=new THREE.Matrix4(),m2=new THREE.Matrix4(),m3=new THREE.Matrix4(),tmpV=new THREE.Vector3(),tmpQ=new THREE.Quaternion(),ONE=new THREE.Vector3(1,1,1);
function setM(o,m){m.decompose(o.position,o.quaternion,tmpV.set(1,1,1)===tmpV?o.scale:o.scale);o.scale.copy(o.userData.sc||ONE);}
function pivotRy(px,pz,a){m1.makeTranslation(px,0,pz);m1.multiply(m2.makeRotationY(a));m1.multiply(m3.makeTranslation(-px,0,-pz));return m1;}
function putPivot(o,px,pz,a){o.position.set(0,0,0);o.quaternion.identity();o.matrix.copy(pivotRy(px,pz,a));o.matrix.decompose(o.position,o.quaternion,tmpV);}
const frameBuf=new Float32Array(NF);let TIPM=null;
function sample(t){
 const f=Math.min(Math.max(t*FPS,0),N-1),i=Math.min(Math.floor(f),N-2),u=f-i;
 for(let k=0;k<NF;k++){const a=F[i*NF+k],b=F[(i+1)*NF+k];frameBuf[k]=DISCRETE.has(sim.names[k])?a:a+(b-a)*u;}
 return frameBuf;}
const bodyM=new THREE.Matrix4(),tm=new THREE.Matrix4();
const barM=new THREE.Matrix4(),rkM={L:new THREE.Matrix4(),R:new THREE.Matrix4()};
const eul=new THREE.Euler(0,0,0,'ZYX');
const pipW=new THREE.Vector3(),pipQ=new THREE.Quaternion(),pipM=new THREE.Matrix4();
const state={X:0,Y:0,Zb:0,psi:0,pipPos:new THREE.Vector3(),pipM:new THREE.Matrix4(),bobPos:new THREE.Vector3(),fly:0};
const I=n=>IX[n];
function apply(t,dd){
 const d=dd||sample(t),g=n=>d[IX[n]];
 const X=g('X'),Y=g('Y'),Zb=g('Zb'),psi=g('psi'),be=g('beta'),rh=g('rho'),th=g('theta');
 bodyM.makeTranslation(X,Y,Zb);bodyM.multiply(tm.makeRotationZ(psi)).multiply(tm.makeRotationY(be)).multiply(tm.makeRotationX(rh));
 if(TIPM)bodyM.premultiply(TIPM);
 bodyM.decompose(bob.position,bob.quaternion,bob.scale);bob.updateMatrixWorld(true);
 const ang={L:th,R:-th},ph={L:g('phiL'),R:g('phiR')},sp={L:g('spinL'),R:g('spinR')};
 for(const s of ['L','R']){const o=side[s];
  putPivot(o.rk,P[0],P[2],ang[s]);putPivot(o.bg,Q[0],Q[2],ph[s]);
  o.spin.forEach(q=>q.rotation.y=sp[s]);
  o.lt.rotation.z=(s==='L'?1:-1)*g('latch');
  rkM[s].copy(pivotRy(P[0],P[2],ang[s]));
 }
 const al=g('alpha')*Math.PI/180;
 barM.copy(pivotRy(0,0,0));barM.makeTranslation(0,0,77).multiply(tm.makeRotationX(al)).multiply(m3.makeTranslation(0,0,-77));
 barM.decompose(barG.position,barG.quaternion,tmpV);
 for(const s of ['L','R']){const sg=s==='L'?1:-1;
  const ball=new THREE.Vector3(25,sg*48,85).applyMatrix4(barM);
  const pin=new THREE.Vector3(25,sg*48,95).applyMatrix4(rkM[s]);
  const u=pin.sub(ball).normalize();side[s].lk.position.copy(ball);side[s].lk.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),u);}
 flapG.rotation.y=g('flap');
 // Pip
 const fly=g('pipFly')>.5;state.fly=fly;
 if(fly){eul.set(g('pRoll'),g('pPitch'),g('pYaw'),'ZYX');
  pip.position.set(g('pX'),g('pY'),g('pZ'));pip.quaternion.setFromEuler(eul);}
 else{m1.copy(bodyM).multiply(tm.makeTranslation(-66,0,196));m1.decompose(pip.position,pip.quaternion,tmpV);}
 pip.scale.set(1,1,1);
 props.forEach(p=>p.g.rotation.z=p.dir*g('prop'));
 const freePk=g('pkFree')>.5;pk1.visible=!freePk;pkFree.visible=freePk;
 if(freePk){pkFree.position.set(g('kX'),g('kY'),g('kZ'));pkFree.quaternion.setFromEuler(eul.set(g('kRX'),g('kRY'),g('kRZ'),'ZYX'));}
 const md=g('mdFree')>.5;medG.visible=md;
 if(md){medG.position.set(g('mX'),g('mY'),g('mZ'));medG.quaternion.setFromEuler(eul.set(g('mRX'),g('mRY'),g('mRZ'),'ZYX'));}
 pip.updateMatrixWorld(true);
 state.X=X;state.Y=Y;state.Zb=Zb;state.psi=psi;state.bobPos.set(X,Y,Zb);state.pipPos.copy(pip.position);
 // sun follows the action
 sun.position.set(X-900,Y-700,1800);sun.target.position.set(X+150,Y,0);
 const tt=t*6;dzRing.material.opacity=.55+.3*Math.sin(tt);dzMat.emissiveIntensity=.45+.25*Math.sin(tt);
 glow.material.opacity=.09+.04*Math.sin(t*3);
 // HUD
 $('h_th').textContent=(th*57.2958).toFixed(1)+'°';
 $('h_ph').textContent=(ph.L*57.2958).toFixed(1)+'° / '+(ph.R*57.2958).toFixed(1)+'°';
 $('h_pi').textContent=(-be*57.2958).toFixed(1)+'°';$('h_ro').textContent=(rh*57.2958).toFixed(1)+'°';
 $('h_sp').textContent=(g('speed')/1000).toFixed(2)+' m/s';
 $('h_pz').textContent=fly?Math.round(g('pZ')/10)+' cm':'docked';
 return d;
}

// ---------- cameras
let mode='auto',curShot=-1;const camPos=new THREE.Vector3(),camLook=new THREE.Vector3();let snap=true;
const controls=new THREE.OrbitControls(camera,canvas);controls.enableDamping=true;controls.enabled=false;controls.maxPolarAngle=Math.PI*.495;
function rotZ(v,a){const c=Math.cos(a),s=Math.sin(a);return [v[0]*c-v[1]*s,v[0]*s+v[1]*c,v[2]];}
function desired(t){
 const sh=sim.shots;let s=sh.find(x=>t>=x.t0&&t<x.t1)||sh[sh.length-1];
 const tgt=s.target==='pip'?state.pipPos:s.target==='point'?new THREE.Vector3(...s.tp):state.bobPos;
 let off=s.off,look=s.look;
 if(s.orbit){const a=-1.2+(t-s.t0)*s.orbit.speed;off=[Math.cos(a)*s.orbit.radius,Math.sin(a)*s.orbit.radius,s.orbit.height];}
 else if(s.frame==='heading'){off=rotZ(off,state.psi);look=rotZ(look,state.psi);}
 return {pos:[tgt.x+off[0],tgt.y+off[1],tgt.z+off[2]],look:[tgt.x+look[0],tgt.y+look[1],tgt.z+look[2]],fov:s.fov||45,s};
}
function fixed(m){const b=state.bobPos,h=state.psi;
 if(m==='chase'){const pf=ps&&ps.ctl==='pip';const o=rotZ(pf?[-420,-60,190]:[-950,-120,430],h);return{pos:[b.x+o[0],b.y+o[1],b.z+o[2]],look:[b.x,b.y,b.z+90],fov:50};}
 if(m==='side'){const o=rotZ([0,-1100,260],h);return{pos:[b.x+o[0],b.y+o[1],b.z+o[2]],look:[b.x,b.y,b.z+100],fov:40};}
 if(m==='top'){return{pos:[b.x-150,b.y,b.z+2100],look:[b.x,b.y,b.z],fov:45};}
}
function pipCam(){const p=state.pipPos;const mtx=new THREE.Matrix4().compose(pip.position,pip.quaternion,ONE);
 const a=new THREE.Vector3(21,-9,58).applyMatrix4(mtx),b=new THREE.Vector3(400,-9,-40).applyMatrix4(mtx);
 return{pos:[a.x,a.y,a.z],look:[b.x,b.y,b.z],fov:75};}
const MODES=[['auto','Auto'],['chase','Chase'],['side','Side'],['top','Top'],['pip','Pip cam'],['free','Free']];
const camsEl=$('cams');
MODES.forEach(([k,l])=>{const b=document.createElement('button');b.textContent=l;b.dataset.k=k;b.onclick=()=>setMode(k);camsEl.appendChild(b);});
function setMode(k){mode=k;snap=true;controls.enabled=(k==='free');
 camsEl.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));$('pipcam').style.display=k==='pip'?'block':'none';
 if(k==='free'){controls.target.copy(W(state.bobPos.x,state.bobPos.y,state.bobPos.z+80));}}
let DBG=null;
function updateCam(t,dt){
 if(DBG){camera.position.copy(W(...DBG.p));camera.lookAt(W(...DBG.l));return;}
 if(mode==='free'){const w=W(state.bobPos.x,state.bobPos.y,state.bobPos.z+80);controls.target.lerp(w,Math.min(1,dt*3));controls.update();return;}
 let d=mode==='auto'?desired(t):mode==='pip'?pipCam():fixed(mode);
 const p=W(...d.pos),l=W(...d.look);
 const k=snap?1:1-Math.exp(-dt*(mode==='pip'?14:2.6));
 camPos.lerp(p,k);camLook.lerp(l,k);if(snap){camPos.copy(p);camLook.copy(l);}
 camera.position.copy(camPos);camera.lookAt(camLook);
 if(camera.fov!==d.fov){camera.fov+=(d.fov-camera.fov)*(snap?1:.08);camera.updateProjectionMatrix();}
 snap=false;
}


// ---------- play mode: live terrain, contact solver, controls
const RAMP=arena.ramp,PF=arena.platform;
function rampZ(x){const PROF=RAMP.profile,n=PROF.length;if(x<=PROF[0][0])return 0;if(x>=PROF[n-1][0])return RAMP.rise;
 let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(PROF[m][0]<=x)lo=m;else hi=m;}
 const a=PROF[lo],b=PROF[hi],u=(x-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*u;}
function terrainH(x,y){let h=0;
 for(const l of arena.logs){if(y>=l.y0&&y<=l.y1){const d=l.r*l.r-(x-l.x)*(x-l.x);if(d>0)h=Math.max(h,Math.sqrt(d));}}
 for(const b of arena.boxes)if(x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1)h=Math.max(h,b.h);
 if(Math.abs(y)<=RAMP.half_w&&x>=RAMP.x0&&x<=PF.x_end)h=Math.max(h,rampZ(x));
 if(Math.abs(y)<=PF.half_w&&x>=RAMP.x1&&x<=PF.x_end)h=Math.max(h,RAMP.rise);
 return h;}
const RW=50,YC=107,Pp=[0,95],Qp=[-100,75],WA=[200,50],WB=[0,50],WC=[-200,50];
function rot2(a,x,z){const c=Math.cos(a),s=Math.sin(a);return [c*x+s*z,-s*x+c*z];}
function wheelsBody(th,pl,pr,out){let k=0;
 for(const [sg,phi,ths] of [[1,pl,th],[-1,pr,-th]]){
  let r=rot2(ths,WA[0]-Pp[0],WA[1]-Pp[1]);out[k++]=Pp[0]+r[0];out[k++]=sg*YC;out[k++]=Pp[1]+r[1];
  for(const W_ of [WB,WC]){const q=rot2(phi,W_[0]-Qp[0],W_[1]-Qp[1]);r=rot2(ths,Qp[0]+q[0]-Pp[0],Qp[1]+q[1]-Pp[1]);out[k++]=Pp[0]+r[0];out[k++]=sg*YC;out[k++]=Pp[1]+r[1];}}}
function rotMat(psi,be,rh){const cz=Math.cos(psi),sz=Math.sin(psi),cy=Math.cos(be),sy=Math.sin(be),cx=Math.cos(rh),sx=Math.sin(rh);
 // Rz*Ry*Rx
 return [cz*cy, cz*sy*sx-sz*cx, cz*sy*cx+sz*sx,
         sz*cy, sz*sy*sx+cz*cx, sz*sy*cx-cz*sx,
         -sy,   cy*sx,          cy*cx];}
const SOFF=[],CIRC=[];for(let s=-50;s<=50;s+=5){SOFF.push(s);CIRC.push(Math.sqrt(Math.max(0,2500-s*s)));}
const LOFF=[-16,0,16];
const wb=new Float64Array(18);
function residuals(u,X,Y,psi,out){
 wheelsBody(u[3],u[4],u[5],wb);const R=rotMat(psi,u[1],u[2]);const c=Math.cos(psi),s=Math.sin(psi);
 for(let i=0;i<6;i++){const bx=wb[i*3],by=wb[i*3+1],bz=wb[i*3+2];
  const wx=R[0]*bx+R[1]*by+R[2]*bz+X,wy=R[3]*bx+R[4]*by+R[5]*bz+Y,wz=R[6]*bx+R[7]*by+R[8]*bz+u[0];
  let best=-1e9;
  for(let a=0;a<SOFF.length;a++){for(let b=0;b<3;b++){
   const h=terrainH(wx+SOFF[a]*c-LOFF[b]*s,wy+SOFF[a]*s+LOFF[b]*c)+CIRC[a];if(h>best)best=h;}}
  out[i]=wz-best;}}
function solve6(A,b){const n=6;const M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){let p=i;for(let r=i+1;r<n;r++)if(Math.abs(M[r][i])>Math.abs(M[p][i]))p=r;[M[i],M[p]]=[M[p],M[i]];
  const d=M[i][i]||1e-12;for(let r=i+1;r<n;r++){const f=M[r][i]/d;for(let c=i;c<=n;c++)M[r][c]-=f*M[i][c];}}
 const x=new Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=M[i][n];for(let c=i+1;c<n;c++)s-=M[i][c]*x[c];x[i]=s/(M[i][i]||1e-12);}return x;}
const STEP=[0.05,1e-4,1e-4,1e-4,1e-4,1e-4];
const r0=new Float64Array(6),r1=new Float64Array(6),r2=new Float64Array(6);
function norm(a){let s=0;for(let i=0;i<6;i++)s+=a[i]*a[i];return Math.sqrt(s);}
function solvePose(X,Y,psi,u0){let u=u0.slice(),res=0;
 for(let it=0;it<50;it++){residuals(u,X,Y,psi,r0);let m=0;for(let i=0;i<6;i++)m=Math.max(m,Math.abs(r0[i]));res=m;if(m<1e-3)break;
  const J=[0,1,2,3,4,5].map(()=>new Array(6));
  for(let k=0;k<6;k++){const up=u.slice(),um=u.slice();up[k]+=STEP[k];um[k]-=STEP[k];residuals(up,X,Y,psi,r1);residuals(um,X,Y,psi,r2);
   for(let i=0;i<6;i++)J[i][k]=(r1[i]-r2[i])/(2*STEP[k]);}
  for(let i=0;i<6;i++)J[i][i]+=1e-9;
  const d=solve6(J,Array.from(r0,v=>-v));d[0]=Math.max(-25,Math.min(25,d[0]));for(let k=1;k<6;k++)d[k]=Math.max(-.08,Math.min(.08,d[k]));
  const n0=norm(r0);let lam=1,ok=false;
  while(lam>1e-3){const un=u.map((v,k)=>v+lam*d[k]);residuals(un,X,Y,psi,r1);if(norm(r1)<n0){u=un;ok=true;break;}lam*=.5;}
  if(!ok)break;}
 residuals(u,X,Y,psi,r0);let m=0;for(let i=0;i<6;i++)m=Math.max(m,Math.abs(r0[i]));return {u,res:m};}
// differential bar angle (deg) so the left link rod keeps its length
const D0=10;
function pinL(th){return [25*Math.cos(th),48,95-25*Math.sin(th)];}
function ballL(a){const c=Math.cos(a),s=Math.sin(a);return [25,48*c-8*s,77+48*s+8*c];}
function lerr(th,a){const p=pinL(th),b=ballL(a);return Math.hypot(p[0]-b[0],p[1]-b[1],p[2]-b[2])-D0;}
function barAlpha(th){if(Math.abs(th)<1e-9)return 0;const want=-th*57.2958;let best=null,bd=1e9;let prev=lerr(th,-40*Math.PI/180),pa=-40;
 for(let a=-39.5;a<=40;a+=.5){const v=lerr(th,a*Math.PI/180);
  if(prev*v<0){let lo=pa,hi=a;for(let k=0;k<30;k++){const mid=(lo+hi)/2;if(lerr(th,lo*Math.PI/180)*lerr(th,mid*Math.PI/180)<=0)hi=mid;else lo=mid;}
   const r=(lo+hi)/2;if(Math.abs(r-want)<bd){bd=Math.abs(r-want);best=r;}}
  prev=v;pa=a;}
 return best===null?want:best;}
// clearance sample points (body frame)
const UNDER=[];
for(let x=-100;x<=100;x+=25)for(const y of [-58,0,58])UNDER.push([x,y,56]);
for(const x of [196,206])for(let k=0;k<5;k++)UNDER.push([x,-58+k*29,66]);
for(let k=0;k<5;k++)for(const y of [-58,58])UNDER.push([-198+k*24,y,64]);
for(const x of [-200,200])for(const y of [-62,62])UNDER.push([x,y,126]);
function clearance(X,Y,psi,u){const R=rotMat(psi,u[1],u[2]);let mn=1e9;
 const test=(bx,by,bz)=>{const wx=R[0]*bx+R[1]*by+R[2]*bz+X,wy=R[3]*bx+R[4]*by+R[5]*bz+Y,wz=R[6]*bx+R[7]*by+R[8]*bz+u[0];const c=wz-terrainH(wx,wy);if(c<mn)mn=c;};
 for(const p of UNDER)test(p[0],p[1],p[2]);
 for(const [sg,phi,ths] of [[1,u[4],u[3]],[-1,u[5],-u[3]]]){
  for(const seg of [[Pp,WA],[Pp,Qp]])for(let t=0;t<=1;t+=1/7){const px=seg[0][0]+(seg[1][0]-seg[0][0])*t,pz=seg[0][1]+(seg[1][1]-seg[0][1])*t;
   const r=rot2(ths,px-Pp[0],pz-Pp[1]);test(Pp[0]+r[0],sg*71,Pp[1]+r[1]-5);}
  for(const seg of [[WC,Qp],[Qp,WB]])for(let t=0;t<=1;t+=1/7){const px=seg[0][0]+(seg[1][0]-seg[0][0])*t,pz=seg[0][1]+(seg[1][1]-seg[0][1])*t;
   let r=rot2(phi,px-Qp[0],pz-Qp[1]);r=rot2(ths,Qp[0]+r[0]-Pp[0],Qp[1]+r[1]-Pp[1]);test(Pp[0]+r[0],sg*82,Pp[1]+r[1]-5);}}
 return mn;}
function poseOK(X,Y,psi,u,res){
 if(res>8)return false;
 if(Math.abs(u[3])>25*Math.PI/180||Math.abs(u[4])>20*Math.PI/180||Math.abs(u[5])>20*Math.PI/180)return false;
 if(Math.abs(u[1])>32*Math.PI/180||Math.abs(u[2])>28*Math.PI/180)return false;
 return clearance(X,Y,psi,u)>2;}

function bodyMat(X,Y,Zb,psi,be,rh){const m=new THREE.Matrix4();m.makeTranslation(X,Y,Zb);m.multiply(new THREE.Matrix4().makeRotationZ(psi)).multiply(new THREE.Matrix4().makeRotationY(be)).multiply(new THREE.Matrix4().makeRotationX(rh));return m;}
const G=9810,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sm=u=>{u=clamp(u,0,1);return u*u*(3-2*u);};
let ps=null,playMode=true,msgT=0;
const held=new Set();
const down=(...c)=>$('help').style.display==='none'&&c.some(k=>held.has(k));
const pbuf=new Float32Array(NF);
const PK_POOL=[pkFree];for(let i=0;i<2;i++){const c=new THREE.Mesh(pkG,vcMat);c.scale.setScalar(2.6);c.castShadow=true;c.visible=false;root.add(c);PK_POOL.push(c);}
function say(t,ms=2200){if(/^Blocked|^Wheels|^Motors/.test(t))auBuzz();const m=$('msg');m.textContent=t;m.style.display='block';msgT=performance.now()+ms;}
function resetPlay(){
 const s=solvePose(0,0,0,[0,0,0,0,0,0]);
 clearMarks();TIPM=null;ps={load:0,slip:0,sat:0,tipm:null,tip:null,tipN:0,aLong:0,aLat:0,dmg:0,Q:0,volts:12.6,cur:.9,soc:1,dead:null,warn:false,hit:0,blockHit:0,cool:0,range:[2000,2000,2000],rangeT:0,smokeAcc:0,dustAcc:[0,0,0,0,0,0],uL:0,uR:0,bob:{X:0,Y:0,psi:0,vL:0,vR:0,v:0,w:0,sw:[0,0],sL:0,sR:0,u:s.u,flap:0,flapT:0,med:null,medUsed:false,speed:0},
  pip:{st:'docked',t:0,pos:[0,0,0],vel:[0,0,0],yaw:0,pitch:0,roll:0,prop:0,spin:0,latch:0,fly:0,s0:[0,0,0]},
  pk:[null,null,null],packets:3,ctl:'bob'};
 PK_POOL.forEach(m=>m.visible=false);medG.visible=false;
 if(typeof missionOff==='function')missionOff();
 if(typeof repReset==='function')repReset();
}
function fall(o,dt,restZ){const sub=10,h=dt/sub;
 for(let i=0;i<sub;i++){o.v[2]-=G*h;for(let k=0;k<3;k++){o.p[k]+=o.v[k]*h;o.a[k]+=o.w[k]*h;}
  const gz=terrainH(o.p[0],o.p[1])+restZ;
  if(o.p[2]<=gz){o.p[2]=gz;if(o.v[2]<-200&&!o.b){o.v[2]*=-.28;o.b=true;auThump(.16);}else{o.v[2]=0;
    const sp=Math.hypot(o.v[0],o.v[1]),dec=1500*h;if(sp<=dec){o.v[0]=o.v[1]=0;o.w[0]=o.w[1]=o.w[2]=0;o.rest=true;}else{o.rest=false;o.v[0]-=o.v[0]/sp*dec;o.v[1]-=o.v[1]/sp*dec;o.w[2]*=.995;o.w[0]*=.9;o.w[1]*=.9;}
    o.a[0]*=.7;o.a[1]*=.7;}}}}

const AX={ly:0,lx:0,ry:0,rx:0,tilt:0},GP={lx:0,ly:0,rx:0,ry:0,on:false,prev:[]};
const EXT={on:false,last:0,duty:null,state:'SAFE',armSeen:false,sock:null,stateT:0};
// ---------- realism: particles (dust, smoke, sparks), tyre tracks, battery, sensors
const NP=700,pPos=new Float32Array(NP*3),pCol=new Float32Array(NP*3),pAl=new Float32Array(NP),pSz=new Float32Array(NP);
const pVel=new Float32Array(NP*3),pLife=new Float32Array(NP),pMax=new Float32Array(NP),pGrow=new Float32Array(NP),pA0=new Float32Array(NP),pUp=new Float32Array(NP);let pHead=0;
const pgeo=new THREE.BufferGeometry();pgeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));pgeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));pgeo.setAttribute('alpha',new THREE.BufferAttribute(pAl,1));pgeo.setAttribute('size',new THREE.BufferAttribute(pSz,1));
const pmat=new THREE.ShaderMaterial({uniforms:{uScale:{value:600}},transparent:true,depthWrite:false,vertexColors:true,
 vertexShader:'attribute float alpha;attribute float size;varying float vA;varying vec3 vC;uniform float uScale;void main(){vA=alpha;vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*uScale/-mv.z;gl_Position=projectionMatrix*mv;}',
 fragmentShader:'varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.15,d)*vA;if(a<.01)discard;gl_FragColor=vec4(vC,a);}'});
const pts=new THREE.Points(pgeo,pmat);pts.frustumCulled=false;pts.userData.hideThermal=true;root.add(pts);
function emit(x,y,z,vx,vy,vz,life,size,grow,r,g,b,a,up){const i=pHead;pHead=(pHead+1)%NP;
 pPos[i*3]=x;pPos[i*3+1]=y;pPos[i*3+2]=z;pVel[i*3]=vx;pVel[i*3+1]=vy;pVel[i*3+2]=vz;pLife[i]=pMax[i]=life;pSz[i]=size;pGrow[i]=grow;pCol[i*3]=r;pCol[i*3+1]=g;pCol[i*3+2]=b;pA0[i]=a;pAl[i]=a;pUp[i]=up||0;}
function particlesStep(dt){for(let i=0;i<NP;i++){if(pLife[i]<=0){pAl[i]=0;continue;}pLife[i]-=dt;const k=Math.max(0,pLife[i]/pMax[i]);
  pPos[i*3]+=pVel[i*3]*dt;pPos[i*3+1]+=pVel[i*3+1]*dt;pPos[i*3+2]+=pVel[i*3+2]*dt;pVel[i*3]*=.97;pVel[i*3+1]*=.97;pVel[i*3+2]=pVel[i*3+2]*.97+pUp[i]*dt;
  pSz[i]+=pGrow[i]*dt;pAl[i]=pA0[i]*k*k;}
 pgeo.attributes.position.needsUpdate=pgeo.attributes.alpha.needsUpdate=pgeo.attributes.size.needsUpdate=pgeo.attributes.color.needsUpdate=true;
 pmat.uniforms.uScale.value=innerHeight*.5*camera.projectionMatrix.elements[5];}
function sparks(x,y,z,n=14){for(let k=0;k<n;k++){const a=Math.random()*6.28,s=300+Math.random()*500;emit(x,y,z,Math.cos(a)*s,Math.sin(a)*s,200+Math.random()*400,.25+Math.random()*.25,14,-10,1,.65,.2,1,-900);}}
const NMARK=2400,markGeo=new THREE.BoxGeometry(34,9,1.2),markMat=new THREE.MeshBasicMaterial({color:0x0b0c0f,transparent:true,opacity:.5,depthWrite:false});
const marks=new THREE.InstancedMesh(markGeo,markMat,NMARK);marks.frustumCulled=false;marks.userData.hideThermal=true;root.add(marks);
let markI=0;const _o=new THREE.Object3D(),lastMark=[null,null,null,null,null,null];
function clearMarks(){_o.scale.set(0,0,0);_o.updateMatrix();for(let i=0;i<NMARK;i++)marks.setMatrixAt(i,_o.matrix);marks.instanceMatrix.needsUpdate=true;markI=0;lastMark.fill(null);}
clearMarks();
function wheelWorld(){const B=ps.bob,u=B.u,bm=bodyMat(B.X,B.Y,u[0],B.psi,u[1],u[2]);wheelsBody(u[3],u[4],u[5],wb);const o=[];
 for(let i=0;i<6;i++)o.push(new THREE.Vector3(wb[i*3],wb[i*3+1],wb[i*3+2]).applyMatrix4(bm));return o;}
function wheelFx(dt){const B=ps.bob;if(ps.tip)return;const sp=Math.max(Math.abs(B.sw[0]),Math.abs(B.sw[1]))*1000;
 if(sp<25&&!(PH.on&&ps.slip>.3))return;const ww=wheelWorld(),slip=PH.on?ps.slip:0;
 for(let i=0;i<6;i++){const w=ww[i],gz=terrainH(w.x,w.y);
  ps.dustAcc[i]+=dt*(sp/480*7+slip*26);
  while(ps.dustAcc[i]>=1){ps.dustAcc[i]-=1;const bx=-Math.cos(B.psi),by=-Math.sin(B.psi),spd=60+sp*.35;
   emit(w.x,w.y,gz+10,bx*spd+(Math.random()-.5)*60,by*spd+(Math.random()-.5)*60,60+Math.random()*90,.7+Math.random()*.7,45+Math.random()*40,45,.66,.58,.46,.3+slip*.25,25);}
  if(i===0||i===2||i===3||i===5){const lm=lastMark[i];if(!lm||Math.hypot(w.x-lm[0],w.y-lm[1])>55){
    _o.position.set(w.x,w.y,gz+1.4);_o.rotation.set(0,B.u[1],B.psi,'ZYX');_o.scale.set(1,1,1);_o.updateMatrix();marks.setMatrixAt(markI,_o.matrix);markI=(markI+1)%NMARK;marks.instanceMatrix.needsUpdate=true;lastMark[i]=[w.x,w.y];}}}}
function smokeFx(dt){const d=ps.dmg;if(d<35||ps.tip&&false)return;ps.smokeAcc+=dt*(d-30)/70*9;
 while(ps.smokeAcc>=1){ps.smokeAcc-=1;const B=ps.bob,m=bodyMat(B.X,B.Y,B.u[0],B.psi,B.u[1],B.u[2]),p=new THREE.Vector3(-40,(Math.random()-.5)*80,150).applyMatrix4(m);
  emit(p.x,p.y,p.z,(Math.random()-.5)*40,(Math.random()-.5)*40,70,1.5+Math.random(),50,90,.12,.12,.12,.45,80);}}
// battery: 3S LiPo, OCV curve and internal resistance
const BAT={cap:2.5,stallA:3.0,idleA:.9,rint:.07};
function vCell(s){const t=[[0,3.0],[.1,3.5],[.2,3.65],[.5,3.8],[.9,4.05],[1,4.2]];s=clamp(s,0,1);for(let i=1;i<t.length;i++)if(s<=t[i][0]){const a=t[i-1],b=t[i];return a[1]+(b[1]-a[1])*(s-a[0])/(b[0]-a[0]);}return 4.2;}
function batteryStep(dt){const ld=ps.load||0,cur=BAT.idleA+6*(.12+BAT.stallA*(PH.stall/14)*ld);ps.cur=cur;
 ps.Q+=cur*dt/3600*(PH.drain||1);ps.soc=clamp(1-ps.Q/BAT.cap,0,1);ps.volts=3*vCell(ps.soc)-cur*BAT.rint;
 if(ps.volts<9.3&&!ps.dead){ps.dead='LOW BATTERY: motors cut';say('Low battery: motors cut (below 9.3 V)',5000);}
 else if(ps.volts<9.9&&!ps.warn){ps.warn=true;say('Battery low: speed limited to half',4000);}}
function addDamage(a,why){if(ps.dmg>=100)return;ps.dmg=Math.min(100,ps.dmg+a);const B=ps.bob;const w=wheelWorld()[0];sparks(w.x,w.y,w.z,12);auThump(.3);auNoise(2200,.15,.3,'bandpass');
 if(navigator.vibrate)try{navigator.vibrate(60)}catch(e){}
 say((why||'Impact')+': damage '+Math.round(ps.dmg)+'%',2500);if(ps.dmg>=100&&!ps.dead){ps.dead='DISABLED: too much damage';say('BOB is disabled. Press Backspace to reset',6000);}}
// ultrasonic sensors on the bumper (3 rays, 2 m range)
function ultrasonics(){const B=ps.bob,u=B.u,bm=bodyMat(B.X,B.Y,u[0],B.psi,u[1],u[2]),out=[];
 for(const [sy,ang] of [[40,.31],[0,0],[-40,-.31]]){const o=new THREE.Vector3(210,sy,75).applyMatrix4(bm),a=B.psi+ang,c=Math.cos(a),s=Math.sin(a);let d=2000;
  for(let r=30;r<=2000;r+=25){const x=o.x+c*r,y=o.y+s*r;
   if(x<arena.x_min||x>arena.x_max||Math.abs(y)>arena.y_half){d=r;break;}
   let hit=false;for(const b of BARRELS)if(Math.hypot(x-b[0],y-b[1])<150){hit=true;break;}
   if(hit||terrainH(x,y)>o.z-6){d=r;break;}}
  out.push(d);}return out;}
const PH={on:true,mBob:4.9,mPip:.5,stall:14,mu:.8,drain:1};
const PHD=JSON.parse(JSON.stringify(PH));
function massNow(){const s=ps.pip.st;return PH.mBob+((s==='docked'||s==='latching'||(s==='launching'&&ps.pip.t<1.2))?PH.mPip:0);}
function comBody(){const m1=PH.mBob,m2=massNow()-PH.mBob;return [(m1*-10+m2*-66)/(m1+m2),0,(m1*95+m2*234)/(m1+m2)];}
function extFailsafe(now){
 const E=EXT,hb=now-E.last<500,tilt=Math.max(Math.abs(ps.bob.u[1]),Math.abs(ps.bob.u[2]))>45*Math.PI/180;
 if(E.state==='ARMED'&&(!hb||tilt||ps.dead)){E.state='STOP';E.stateT=now;E.duty=null;say(!hb?'Link lost: STOP (no heartbeat for 500 ms)':ps.dead?'STOP: '+ps.dead:'STOP: tilt above 45 degrees',4000);}
 else if(E.state==='SAFE'&&hb&&!ps.dead)E.state='READY';
 else if(E.state==='STOP'&&hb&&!ps.dead&&now-E.stateT>300)E.state='READY';
 else if(E.state==='READY'&&!hb)E.state='SAFE';}
function tickBob(dt){
 const B=ps.bob,P=ps.pip,now=performance.now(),ctl=ps.ctl==='bob'&&!['launching','landing','latching'].includes(P.st)&&!ps.tip;
 let uL=0,uR=0;const slow=down('ShiftLeft','ShiftRight')?.4:1;
 if(EXT.on){extFailsafe(now);if(EXT.state==='ARMED'&&EXT.duty&&!ps.tip){uL=EXT.duty[0];uR=EXT.duty[1];}}
 else if(ctl){const fw=clamp((down('KeyW','ArrowUp')?1:0)-(down('KeyS','ArrowDown')?1:0)+AX.ly+GP.ly,-1,1),tr=clamp((down('KeyA','ArrowLeft')?1:0)-(down('KeyD','ArrowRight')?1:0)-AX.lx-GP.lx+AX.tilt,-1,1);
  uL=fw-tr*.55;uR=fw+tr*.55;const mx=Math.max(Math.abs(uL),Math.abs(uR),1);uL=uL/mx*slow;uR=uR/mx*slow;}
 uL=clamp(uL,-1,1);uR=clamp(uR,-1,1);
 if(ps.dead){uL=uR=0;}else if(ps.volts<9.9){uL*=.5;uR*=.5;}
 ps.uL=uL;ps.uR=uR;
 if(ps.tip){tickTip(dt);batteryStep(dt);particlesStep(dt);return;}
 let v,w;
 const dmgF=1-.0045*ps.dmg,pull=ps.dmg>20?1-.003*(ps.dmg-20):1;
 if(!PH.on){
  const acc=900*dt;
  const tL=uL*480*dmgF*pull,tR=uR*480*dmgF;
  B.vL+=clamp(tL-B.vL,-acc,acc);B.vR+=clamp(tR-B.vR,-acc,acc);
  v=(B.vL+B.vR)/2;w=(B.vR-B.vL)/(2*YC);B.speed=Math.abs(v);ps.slip=0;ps.sat=0;ps.tipm=null;
  ps.load=Math.min(1,(Math.abs(B.vL)+Math.abs(B.vR))/960*.2);
  B.sw=[B.vL/1000,B.vR/1000];B.v=v/1000;B.w=w;
 }else{
  const m=massNow(),Ts=PH.stall*.0980665,snl=.52,Rw=.05,Kx=300,Mw=2,Yc=.107,Iz=m*.3125/12,Vs=clamp(ps.volts/12,.5,1.1);
  const Rm=rotMat(B.psi,B.u[1],B.u[2]),gx=G/1000*Math.sin(B.u[1]);
  const N=m*G/1000*Math.max(Rm[8],.05),Fmax=PH.mu*N/2,n=Math.max(1,Math.ceil(dt/.003)),h=dt/n,us=[uL,uR],tf=[dmgF*pull,dmgF];
  let ld=0,sat=0;const v0=B.v;
  for(let i=0;i<n;i++){const vS=[B.v-B.w*Yc,B.v+B.w*Yc],F=[0,0];
   for(let k=0;k<2;k++){
    const T=clamp(Ts*tf[k]*(us[k]*Vs-B.sw[k]/snl),-Ts,Ts)-.04*Math.tanh(B.sw[k]/.02);
    const raw=Kx*(B.sw[k]-vS[k]);F[k]=clamp(raw,-Fmax,Fmax);if(Math.abs(raw)>Fmax)sat+=1/(2*n);
    B.sw[k]+=(3*T/Rw-F[k])/Mw*h;ld+=Math.abs(T)/Ts/(2*n);}
   B.v+=((F[0]+F[1]+m*gx-.03*N*Math.tanh(B.v/.01))/m)*h;
   B.w+=(((F[1]-F[0])*Yc-.35*PH.mu*N*.187*Math.tanh(B.w/.04))/Iz)*h;}
  v=B.v*1000;w=B.w;B.speed=Math.abs(v);ps.load=ld;ps.sat=sat;
  const sv=Math.max(Math.abs(B.sw[0]-(B.v-B.w*Yc)),Math.abs(B.sw[1]-(B.v+B.w*Yc)));ps.slip=clamp(sv/(Math.max(Math.abs(B.sw[0]),Math.abs(B.sw[1]))+.1),0,1);
  ps.aLong=(B.v-v0)*1000/dt;ps.aLat=B.v*1000*B.w;
  if(sat>.6&&Math.max(Math.abs(uL),Math.abs(uR))>.3&&now>(ps.slipMsg||0)){ps.slipMsg=now+3500;say('Wheels slipping: not enough grip');}
  else if(ld>.9&&B.speed<25&&Math.max(Math.abs(uL),Math.abs(uR))>.5&&now>(ps.slipMsg||0)){ps.slipMsg=now+3500;say('Motors stalled: needs more torque');}
 }
 ps.hit=0;let moved=true;
 if(Math.abs(v)>1e-3||Math.abs(w)>1e-5){
  const n=Math.max(1,Math.ceil(Math.max(Math.abs(v)*dt/6,Math.abs(w)*dt*260/6))),hs=dt/n;
  for(let i=0;i<n;i++){if(!stepBob(v,w,hs)){moved=false;break;}}}
 if(!moved){if(PH.on){B.v=0;B.w=0;}else{B.vL=B.vR=0;}B.speed=0;}
 if(ps.hit>80&&now>ps.cool){ps.cool=now+600;addDamage(ps.hit/1000*28,'Collision');if(PH.on)B.v=-.15*(v/1000);}
 ps.blockHit=0;
 if(PH.on){B.sL+=B.sw[0]*1000*dt/RW;B.sR+=B.sw[1]*1000*dt/RW;}else if(moved){B.sL+=B.vL*dt/RW;B.sR+=B.vR*dt/RW;}
 if(PH.on)tipCheck(dt);
 batteryStep(dt);wheelFx(dt);smokeFx(dt);particlesStep(dt);
 ps.rangeT=(ps.rangeT||0)-dt;if(ps.rangeT<=0){ps.rangeT=.066;ps.range=ultrasonics();}
}
function stepBob(v,w,dt){const B=ps.bob;
 let nx=B.X+v*Math.cos(B.psi)*dt,ny=B.Y+v*Math.sin(B.psi)*dt;const np=B.psi+w*dt;
 {const rx=nx,ry=ny;nx=clamp(nx,-420,6200);ny=clamp(ny,-1400,1400);if(nx!==rx||ny!==ry)ps.hit=Math.max(ps.hit,Math.abs(v));}
 for(const b of BARRELS){const dx=nx-b[0],dy=ny-b[1],d=Math.hypot(dx,dy),mind=150+290;if(d<mind&&d>1){nx=b[0]+dx/d*mind;ny=b[1]+dy/d*mind;ps.hit=Math.max(ps.hit,Math.abs(v));}}
 const hn=terrainH(nx,ny);
 if(hn>120||terrainH(B.X,B.Y)>120){const onPlat=nx>RAMP.x1+60;const lim=onPlat?PF.half_w-250:RAMP.half_w-250;if(nx>PF.x_end-280||Math.abs(ny)>lim)return false;}
 let s=solvePose(nx,ny,np,B.u);
 if(!poseOK(nx,ny,np,s.u,s.res)){for(const g of [[B.u[0]+12,B.u[1],B.u[2],0,0,0],[B.u[0],0,0,0,0,0],[B.u[0]+25,B.u[1],B.u[2],B.u[3],0,0]]){const s2=solvePose(nx,ny,np,g);if(poseOK(nx,ny,np,s2.u,s2.res)){s=s2;break;}}}
 if(!poseOK(nx,ny,np,s.u,s.res)){B.why='res='+s.res.toFixed(2)+' th='+(s.u[3]*57.3).toFixed(1)+' phi='+(s.u[4]*57.3).toFixed(1)+','+(s.u[5]*57.3).toFixed(1)+' pit='+(s.u[1]*57.3).toFixed(1)+' roll='+(s.u[2]*57.3).toFixed(1)+' clr='+clearance(nx,ny,np,s.u).toFixed(1);say('Blocked: too steep or too high for the arms');ps.blockHit=Math.max(ps.blockHit||0,Math.abs(v));return false;}
 B.X=nx;B.Y=ny;B.psi=np;B.u=s.u;return true;
}
// ---- tipping: where does the centre of mass fall relative to the wheel footprint?
const _v=()=>new THREE.Vector3();
function tipCheck(dt,oL,oT){
 const B=ps.bob,u=B.u,bm=bodyMat(B.X,B.Y,u[0],B.psi,u[1],u[2]),cb=comBody();
 const C=new THREE.Vector3(cb[0],cb[1],cb[2]).applyMatrix4(bm);
 wheelsBody(u[3],u[4],u[5],wb);const pts=[];for(let i=0;i<6;i++){const p=new THREE.Vector3(wb[i*3],wb[i*3+1],wb[i*3+2]).applyMatrix4(bm);p.z-=50;pts.push(p);}
 const mid=(a,b)=>a.clone().add(b).multiplyScalar(.5);
 const fr=mid(pts[0],pts[3]),rr=mid(pts[2],pts[5]),lf=pts[0].clone().add(pts[1]).add(pts[2]).multiplyScalar(1/3),rt=pts[3].clone().add(pts[4]).add(pts[5]).multiplyScalar(1/3);
 const e1=fr.clone().sub(rr).normalize(),n=new THREE.Vector3().crossVectors(e1,lf.clone().sub(rt)).normalize();if(n.z<0)n.negate();
 const e2=new THREE.Vector3().crossVectors(n,e1).normalize();
 const c0=pts.reduce((a,p)=>a.add(p),_v()).multiplyScalar(1/6);
 const ch=Math.cos(B.psi),sn=Math.sin(B.psi),aL=oL!=null?oL:(ps.aLong||0),aT=oT!=null?oT:(ps.aLat||0);
 const ge=new THREE.Vector3(-(ch*aL-sn*aT),-(sn*aL+ch*aT),-G).normalize();
 const tt=c0.clone().sub(C).dot(n)/ge.dot(n),Pj=C.clone().addScaledVector(ge,tt);
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
 for(const p of pts){const d=p.clone().sub(c0),a=d.dot(e1),b=d.dot(e2);x0=Math.min(x0,a);x1=Math.max(x1,a);y0=Math.min(y0,b);y1=Math.max(y1,b);}
 y0-=18;y1+=18;const d=Pj.clone().sub(c0),px=d.dot(e1),py=d.dot(e2);
 const edges=[[x1-px,e1,e1,x1],[px-x0,e1.clone().negate(),e1,x0],[y1-py,e2,e2,y1],[py-y0,e2.clone().negate(),e2,y0]];
 let best=edges[0];for(const e of edges)if(e[0]<best[0])best=e;
 ps.tipm=best[0];
 if(best[0]<-3){ps.tipN=(ps.tipN||0)+1;}else ps.tipN=0;
 if(ps.tipN>=3){const o=best[1],ax=new THREE.Vector3().crossVectors(n,o).normalize();
  const piv=c0.clone().addScaledVector(best[2],best[3]);
  ps.tip={ax,piv,ang:0,w:0,bounced:false};say('BOB tipped over. Press Backspace to reset',6000);auCrash();}
}
function tickTip(dt){const T=ps.tip;if(T.done)return;T.w+=9*Math.sin(Math.min(T.ang+.25,1.5))*dt*3;T.ang+=T.w*dt;
 if(T.ang>=Math.PI/2){T.ang=Math.PI/2;if(!T.bounced){T.bounced=true;T.w=-T.w*.22;auThump(.4);}else{T.done=true;T.w=0;}}
 const m=new THREE.Matrix4().makeTranslation(T.piv.x,T.piv.y,T.piv.z).multiply(new THREE.Matrix4().makeRotationAxis(T.ax,T.ang)).multiply(new THREE.Matrix4().makeTranslation(-T.piv.x,-T.piv.y,-T.piv.z));TIPM=m;}
function padWorld(){const B=ps.bob,u=B.u;const m=bodyMat(B.X,B.Y,u[0],B.psi,u[1],u[2]);return {p:new THREE.Vector3(-66,0,196).applyMatrix4(m),m};}
function tickPip(dt){
 const P=ps.pip,B=ps.bob;
 if(down('KeyP')&&!P.pLatch){P.pLatch=true;pipAction();}if(!down('KeyP'))P.pLatch=false;
 const pw=padWorld();
 if(P.st==='docked'){P.fly=0;P.latch=0;P.spin=0;}
 else if(P.st==='launching'){P.t+=dt;P.latch=Math.PI/2*sm(P.t/1.2);P.spin=sm((P.t-1.0)/1.4);
  if(P.t<1.2){P.fly=0;}else{P.fly=1;const k=sm((P.t-1.2)/1.8);const be=B.u[1]*(1-k),rh=B.u[2]*(1-k);
   P.pos=[pw.p.x,pw.p.y,pw.p.z+520*k];P.yaw=B.psi;P.pitch=be;P.roll=rh;P.vel=[0,0,0];
   if(P.t>=3.0){P.st='flying';P.t=0;if(ps.ctl==='bob'){ps.ctl='pip';say('Flying Pip. Press Tab to switch back to Bob.');}}}}
 else if(P.st==='flying'){
  let f=0,sx=0,yw=0,up=0;
  if(EXT.on&&EXT.state==='ARMED'&&EXT.pip){[f,sx,yw,up]=EXT.pip;}
  else if(ps.ctl==='pip'){f=(down('KeyW','ArrowUp')?1:0)-(down('KeyS','ArrowDown')?1:0);sx=(down('KeyA')?1:0)-(down('KeyD')?1:0);
   yw=(down('KeyQ','ArrowLeft')?1:0)-(down('KeyE','ArrowRight')?1:0);up=(down('KeyR','PageUp')?1:0)-(down('KeyF','PageDown')?1:0);}
  if(ps.ctl==='pip'&&!(EXT.on&&EXT.state==='ARMED'&&EXT.pip)){f=clamp(f+AX.ly+GP.ly,-1,1);sx=clamp(sx-AX.lx-GP.lx,-1,1);yw=clamp(yw-AX.rx-GP.rx,-1,1);up=clamp(up+AX.ry+GP.ry,-1,1);}
  const sl=down('ShiftLeft','ShiftRight')?.4:1;
  P.yaw+=yw*1.6*dt*sl;const c=Math.cos(P.yaw),s=Math.sin(P.yaw);
  const tvx=(f*c-sx*s)*750*sl,tvy=(f*s+sx*c)*750*sl,tvz=up*500*sl,acc=1400*dt;
  const ov=P.vel.slice();
  P.vel[0]+=clamp(tvx-P.vel[0],-acc,acc);P.vel[1]+=clamp(tvy-P.vel[1],-acc,acc);P.vel[2]+=clamp(tvz-P.vel[2],-acc,acc);
  P.pos[0]=clamp(P.pos[0]+P.vel[0]*dt,-600,6400);P.pos[1]=clamp(P.pos[1]+P.vel[1]*dt,-1600,1600);P.pos[2]=clamp(P.pos[2]+P.vel[2]*dt,terrainH(P.pos[0],P.pos[1])+4,1800);
  const ax=(P.vel[0]-ov[0])/dt,ay=(P.vel[1]-ov[1])/dt;
  const vf=P.vel[0]*c+P.vel[1]*s,vl=-P.vel[0]*s+P.vel[1]*c,af=ax*c+ay*s,al=-ax*s+ay*c;
  P.pitch=clamp(.0003*vf+1.6*Math.atan(af/G),-.4,.4);P.roll=clamp(-(.0003*vl+1.6*Math.atan(al/G)),-.4,.4);P.spin=1;P.latch=Math.PI/2;P.fly=1;}
 else if(P.st==='landing'){P.t+=dt;P.fly=1;P.spin=1;
  const tgtHigh=[pw.p.x,pw.p.y,pw.p.z+300],tgtLow=[pw.p.x,pw.p.y,pw.p.z];
  let pos;if(P.t<2.2){const k=sm(P.t/2.2);pos=P.s0.map((v,i)=>v+(tgtHigh[i]-v)*k);}else{const k=sm((P.t-2.2)/1.8);pos=tgtHigh.map((v,i)=>v+(tgtLow[i]-v)*k);}
  const k2=sm(P.t/3);P.pos=pos;P.vel=[0,0,0];
  let dy=B.psi-P.s0yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));P.yaw=P.s0yaw+dy*k2;P.pitch=P.s0p*(1-k2)+B.u[1]*k2;P.roll=P.s0r*(1-k2)+B.u[2]*k2;
  if(P.t>=4.0){P.st='latching';P.t=0;P.fly=0;P.spin=.35;}}
 else if(P.st==='latching'){P.t+=dt;P.fly=0;P.latch=Math.PI/2*(1-sm(P.t/1.2));P.spin=.35*(1-sm(P.t/.6));
  if(P.t>=1.3){P.st='docked';if(ps.ctl==='pip')ps.ctl='bob';say('Pip is secured on the roof pad');}}
 P.prop+=P.spin*36*dt;
}
function pipAction(){const P=ps.pip,B=ps.bob;
 if(P.st==='docked'){
  if(B.speed>40||Math.abs(B.u[1])>15*Math.PI/180||Math.abs(B.u[2])>15*Math.PI/180){say('Stop Bob and keep him level before launching Pip');return;}
  P.st='launching';P.t=0;say('Releasing latches');}
 else if(P.st==='flying'){
  if(B.speed>60){say('Stop Bob first, then land Pip');return;}
  P.st='landing';P.t=0;P.s0=P.pos.slice();P.s0yaw=P.yaw;P.s0p=P.pitch;P.s0r=P.roll;ps.ctl='bob';say('Pip is landing on the pad');}
 else say('Pip is busy');}
function dropPacket(){const P=ps.pip;if(P.st!=='flying'){say('Launch Pip first (P)');return;}
 const i=ps.pk.findIndex(v=>!v);if(i<0){say('No packets left');return;}
 auClick();ps.pk[i]={p:[P.pos[0],P.pos[1],P.pos[2]+21],v:P.vel.slice(),a:[0,0,P.yaw],w:[2.6,1.9,.9],b:false};ps.packets--;PK_POOL[i].visible=true;say('Packet dropped ('+ps.packets+' left)');}
function toggleFlap(){const B=ps.bob;if(B.speed>60){say('Stop Bob to use the cargo flap');return;}B.flapT=B.flapT>0.1?0:Math.PI*80/180;
 say(B.flapT>0?'Cargo flap open':'Cargo flap closed');}
function swap(){const P=ps.pip;if(P.st!=='flying'){say('Pip must be flying to switch');return;}ps.ctl=ps.ctl==='bob'?'pip':'bob';say('Controlling '+(ps.ctl==='bob'?'BOB':'PIP'));}
function playTick(dt){
 const B=ps.bob,P=ps.pip;
 pollGP();
 tickBob(dt);
 missionTick(dt);
 B.flap+=clamp(B.flapT-B.flap,-1.1*dt,1.1*dt);
 if(B.flap>.9&&!B.medUsed){B.medUsed=true;const m=bodyMat(B.X,B.Y,B.u[0],B.psi,B.u[1],B.u[2]);const p=new THREE.Vector3(-150,0,78).applyMatrix4(m);
  B.med={p:[p.x,p.y,p.z],v:[-700*Math.cos(B.psi),-700*Math.sin(B.psi),-150],a:[0,0,B.psi],w:[1.6,2.4,.7],b:false};}
 if(B.med)fall(B.med,dt,12.5);
 tickPip(dt);
 for(let i=0;i<3;i++)if(ps.pk[i])fall(ps.pk[i],dt,2.25);
 const u=B.u,set=(n,v)=>{pbuf[IX[n]]=v;};
 pbuf.fill(0);
 set('X',B.X);set('Y',B.Y);set('Zb',u[0]);set('psi',B.psi);set('beta',u[1]);set('rho',u[2]);set('theta',u[3]);set('phiL',u[4]);set('phiR',u[5]);
 set('alpha',barAlpha(u[3]));set('spinL',B.sL);set('spinR',B.sR);set('flap',B.flap);set('latch',P.latch);set('pipFly',P.fly);
 set('pX',P.pos[0]);set('pY',P.pos[1]);set('pZ',P.pos[2]);set('pYaw',P.yaw);set('pPitch',P.pitch);set('pRoll',P.roll);set('prop',P.prop);
 if(B.med){set('mdFree',1);set('mX',B.med.p[0]);set('mY',B.med.p[1]);set('mZ',B.med.p[2]);set('mRX',B.med.a[0]);set('mRY',B.med.a[1]);set('mRZ',B.med.a[2]);}
 set('speed',B.speed);
 apply(0,pbuf);
 pk1.visible=ps.packets>0;
 for(let i=0;i<3;i++){const o=ps.pk[i],m=PK_POOL[i];if(o){m.visible=true;m.position.set(o.p[0],o.p[1],o.p[2]);m.quaternion.setFromEuler(eul.set(o.a[0],o.a[1],o.a[2],'ZYX'));}}
 recPush(dt);
 // camera focus
 if(ps.ctl==='pip'||['landing','launching'].includes(P.st)&&ps.ctl==='pip'){state.bobPos.set(P.pos[0],P.pos[1],P.pos[2]);state.psi=P.yaw;}
 $('h_pz').textContent=P.fly?Math.round(P.pos[2]/10)+' cm':'docked';
 $('h_ld').textContent=PH.on?Math.round(ps.load*100)+'%':'-';
 $('h_sl').textContent=PH.on?Math.round(ps.slip*100)+'%':'-';
 $('h_tp').textContent=PH.on&&ps.tipm!=null?(ps.tip?'TIPPED':Math.round(ps.tipm)+' mm'):'-';
 $('h_bt').textContent=ps.volts.toFixed(1)+' V · '+Math.round(ps.soc*100)+'%';
 $('h_cu').textContent=ps.cur.toFixed(1)+' A';
 $('h_dm').textContent=Math.round(ps.dmg)+'%'+(ps.dead?' (DOWN)':'');
 $('h_rg').textContent=ps.range.map(d=>d>=2000?'--':Math.round(d/10)).join(' / ');
 $('h_st').textContent=EXT.on?EXT.state:'keyboard';
}
function playCaption(){const P=ps.pip;const who=ps.ctl==='bob'?'BOB':'PIP';
 const base=ps.ctl==='bob'?'Driving BOB: W/S drive, A/D turn':'Flying PIP: W/S/A/D move, Q/E turn, R/F up and down, Space drops a packet';
 return base+(P.st==='docked'?' · P launches Pip':P.st==='flying'?' · P lands Pip · Tab switches':'')+' · M cargo flap';}


// ---------- phone and gamepad controls
function mkStick(id,kx,ky){const el=$(id),knob=el.querySelector('i');let pid=null;const R=38;
 const set=(x,y)=>{knob.style.transform='translate('+x+'px,'+y+'px)';AX[kx]=x/R;AX[ky]=-y/R;};
 const mv=e=>{const r=el.getBoundingClientRect();let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);const m=Math.hypot(dx,dy);if(m>R){dx*=R/m;dy*=R/m;}set(dx,dy);};
 el.addEventListener('pointerdown',e=>{e.preventDefault();pid=e.pointerId;try{el.setPointerCapture(pid);}catch(_){}mv(e);});
 el.addEventListener('pointermove',e=>{if(e.pointerId===pid)mv(e);});
 const end=e=>{if(e.pointerId!==pid)return;pid=null;set(0,0);};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);}
mkStick('stL','lx','ly');mkStick('stR','rx','ry');
// tilt steering: gravity direction in the screen plane gives the wheel angle (works for any screen rotation)
const TILT={on:false,zero:null,deg:0};
function tiltAngle(beta,gamma,ang){const b=beta*Math.PI/180,g=gamma*Math.PI/180;const dx=Math.cos(b)*Math.sin(g),dy=-Math.sin(b);
 let sx,sy;ang=((Math.round(ang/90)*90)%360+360)%360;
 if(ang===0){sx=dx;sy=dy;}else if(ang===90){sx=-dy;sy=dx;}else if(ang===180){sx=-dx;sy=-dy;}else{sx=dy;sy=-dx;}
 return Math.atan2(sx,-sy)*180/Math.PI;}
function onTilt(e){if(e.beta==null)return;const ang=(screen.orientation&&screen.orientation.angle!=null)?screen.orientation.angle:(window.orientation||0);
 const a=tiltAngle(e.beta,e.gamma,ang);if(TILT.zero==null)TILT.zero=a;let d=a-TILT.zero;d=((d+540)%360)-180;TILT.deg=d;
 const dz=4,full=32;const m=Math.max(0,Math.abs(d)-dz)/(full-dz);AX.tilt=-clamp(m,0,1)*Math.sign(d);}
async function tiltToggle(){if(TILT.on){TILT.on=false;removeEventListener('deviceorientation',onTilt);AX.tilt=0;$('tiltb').classList.remove('on');say('Tilt steering off');return;}
 try{if(window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission){const r=await DeviceOrientationEvent.requestPermission();if(r!=='granted'){say('Tilt permission was denied');return;}}}catch(e){say('Tilt is not available');return;}
 if(!('DeviceOrientationEvent' in window)){say('This device has no tilt sensor');return;}
 TILT.on=true;TILT.zero=null;addEventListener('deviceorientation',onTilt);$('tiltb').classList.add('on');say('Tilt steering on: hold the phone like a steering wheel. Left stick = speed.',4000);}
$('tiltb').onclick=tiltToggle;
function pollGP(){const pads=navigator.getGamepads?navigator.getGamepads():[];const g=[...pads].find(p=>p&&p.connected);
 if(!g){if(GP.on){GP.on=false;GP.lx=GP.ly=GP.rx=GP.ry=0;}return;}
 if(!GP.on){GP.on=true;say('Gamepad connected');}
 const dz=v=>Math.abs(v)<.14?0:(v-Math.sign(v)*.14)/.86;GP.lx=dz(g.axes[0]||0);GP.ly=-dz(g.axes[1]||0);GP.rx=dz(g.axes[2]||0);GP.ry=-dz(g.axes[3]||0);
 const b=g.buttons.map(x=>x.pressed);const edge=i=>b[i]&&!GP.prev[i];
 if(edge(0))pipAction();if(edge(1))dropPacket();if(edge(2))toggleFlap();if(edge(3))swap();
 if(edge(4)||edge(5)){const i=CAMORDER.indexOf(mode);setMode(CAMORDER[(i+1)%CAMORDER.length]);}
 GP.prev=b;}
// ---------- replay: record every run at 30 Hz, replay, save/load, export video
const REC=[],RP={on:false,i:0,play:true,liveTIPM:null,rec:null,exp:false};let recAcc=0;const REC_LEN=NF+21+17+5,REC_MAX=18000;
const rbuf=new Float32Array(NF);
function repReset(){REC.length=0;recAcc=0;if(RP.on){RP.on=false;document.body.classList.remove('rp');$('rpb').textContent='Replay';$('seek').max=TOTAL;}}
function recPush(dt){recAcc+=dt;if(recAcc<1/30||REC.length>=REC_MAX)return;recAcc-=1/30;if(recAcc>1/30)recAcc=0;
 const r=new Float32Array(REC_LEN);r.set(pbuf,0);let o=NF;
 for(let i=0;i<3;i++){const p=ps.pk[i];r[o++]=p?1:0;if(p){r[o++]=p.p[0];r[o++]=p.p[1];r[o++]=p.p[2];r[o++]=p.a[0];r[o++]=p.a[1];r[o++]=p.a[2];}else o+=6;}
 r[o++]=TIPM?1:0;if(TIPM)r.set(TIPM.elements,o);o+=16;
 r[o++]=ps.packets;r[o++]=ps.ctl==='pip'?1:0;r[o++]=ps.dmg;r[o++]=ps.volts;r[o++]=MS.on?MS.t:0;REC.push(r);}
function repEnter(){if(REC.length<2){say('Nothing recorded yet. Drive for a moment first.');return;}
 RP.on=true;RP.i=0;RP.play=true;RP.liveTIPM=TIPM;document.body.classList.add('rp');$('rpb').textContent='Exit replay';
 $('seek').max=(REC.length-1)/30;$('play').textContent='Pause';$('mend').style.display='none';
 ['mis','lk','phys'].forEach(i=>$(i).style.display='none');}
function repExit(){if(RP.exp)return;RP.on=false;document.body.classList.remove('rp');$('rpb').textContent='Replay';TIPM=RP.liveTIPM;$('seek').max=TOTAL;
 PK_POOL.forEach((m,i)=>m.visible=!!ps.pk[i]);snap=true;}
function repFrame(dt){const N=REC.length;if(RP.play){RP.i+=dt*30*rate;if(RP.i>=N-1){RP.i=N-1;RP.play=false;$('play').textContent='Replay';if(RP.exp)repVideoStop();}}
 const i0=Math.min(N-2,Math.floor(RP.i)),u=clamp(RP.i-i0,0,1),a=REC[i0],b=REC[i0+1];
 for(let k=0;k<NF;k++)rbuf[k]=DISCRETE.has(sim.names[k])?a[k]:a[k]+(b[k]-a[k])*u;
 const r=u<.5?a:b;let o=NF;
 for(let i=0;i<3;i++){const m=PK_POOL[i];if(r[o]){m.visible=true;m.position.set(r[o+1],r[o+2],r[o+3]);m.quaternion.setFromEuler(eul.set(r[o+4],r[o+5],r[o+6],'ZYX'));}else m.visible=false;o+=7;}
 if(r[o]){TIPM=new THREE.Matrix4().fromArray(Array.from(r.subarray(o+1,o+17)));}else TIPM=null;o+=17;
 apply(0,rbuf);pk1.visible=r[o]>0;
 updateCam(RP.i/30,Math.max(dt,1e-3));
 $('seek').value=RP.i/30;$('time').textContent=(RP.i/30).toFixed(1)+' / '+((N-1)/30).toFixed(1)+' s';
 $('cap').textContent='Replay · battery '+r[o+3].toFixed(1)+' V · damage '+Math.round(r[o+2])+'%'+(r[o+4]>0?' · mission '+r[o+4].toFixed(1)+' s':'');
 audioFrame(0,rbuf,null,0);}
function b64(f32){const u8=new Uint8Array(f32.buffer,f32.byteOffset,f32.byteLength);let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);}
function unb64(s){const bin=atob(s),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return new Float32Array(u8.buffer);}
function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
function repSave(){if(REC.length<2)return;const all=new Float32Array(REC.length*REC_LEN);REC.forEach((r,i)=>all.set(r,i*REC_LEN));
 const o={bob_run:1,seed:curSeed,ramp:parseFloat($('s_r').value),fps:30,nf:NF,len:REC_LEN,frames:REC.length,data:b64(all)};
 download('bob_run_'+(curSeed||'classic')+'.json',new Blob([JSON.stringify(o)],{type:'application/json'}));say('Run saved');}
function repLoad(txt){try{const o=JSON.parse(txt);if(!o.bob_run||o.nf!==NF||o.len!==REC_LEN)throw new Error('not a compatible BOB run');
 const all=unb64(o.data);const ra=o.ramp||20;$('s_r').value=ra;$('v_r').textContent=ra+'°';buildRamp(ra);setSeed(o.seed|0);
 REC.length=0;for(let i=0;i<o.frames;i++)REC.push(all.slice(i*REC_LEN,(i+1)*REC_LEN));repEnter();say('Run loaded');}catch(e){say('Could not load: '+e.message,4000);}}
function repVideoStart(){if(!window.MediaRecorder){say('Video export is not supported in this browser');return;}
 const types=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'];const mt=types.find(t=>MediaRecorder.isTypeSupported(t));
 const stream=canvas.captureStream(30);const rec=new MediaRecorder(stream,{mimeType:mt,videoBitsPerSecond:6e6}),chunks=[];
 rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 rec.onstop=()=>{RP.exp=false;$('rpvid').textContent='Export video';download('bob_run_'+(curSeed||'classic')+(mt.includes('mp4')?'.mp4':'.webm'),new Blob(chunks,{type:mt}));say('Video saved');};
 RP.rec=rec;RP.exp=true;RP.i=0;RP.play=true;rate=1;$('rpvid').textContent='Recording…';rec.start(500);}
function repVideoStop(){if(RP.rec&&RP.rec.state!=='inactive')setTimeout(()=>RP.rec.stop(),400);}
$('rpb').onclick=()=>{RP.on?repExit():repEnter();};
$('rpsave').onclick=repSave;$('rpload').onclick=()=>$('rpfile').click();
$('rpfile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>repLoad(r.result);r.readAsText(f);e.target.value='';};
$('rpvid').onclick=()=>{if(RP.exp)return;repVideoStart();};
// ---------- mission mode
const MS={on:false,end:false,t:0,found:false,del:false,prec:false,med:false,done:false,score:0};
const MLIM=600;let MPEND=false;
function bestKey(){return 'bob_best_'+curSeed;}
function getBest(){try{return JSON.parse(localStorage.getItem(bestKey()));}catch(e){return null;}}
function missionOff(){MS.on=false;MS.end=false;MS.t=0;MS.found=MS.del=MS.prec=MS.med=MS.done=false;document.body.classList.remove('mis');if($('mend'))$('mend').style.display='none';}
function missionStart(){resetPlay();snap=true;MS.on=true;document.body.classList.add('mis');$('mis').style.display='none';$('mend').style.display='none';mUI();say('Mission started. Find the casualty!',3000);}
function mUI(){const f=(id,ok,t)=>{const e=$(id);e.className='ob'+(ok?' ok':'');e.textContent=(ok?'✓ ':'○ ')+t;};
 f('m_1',MS.found,'Find the casualty (thermal)');f('m_2',MS.del,'Drop a packet near the casualty'+(MS.prec?' (precise!)':''));f('m_3',MS.med,'Medicine packet into the drop zone');f('m_4',MS.done,'Land Pip and stop Bob');
 const s=Math.floor(MS.t);$('m_t').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');$('m_s').textContent=MS.end?'':'Damage '+Math.round(ps.dmg)+'%';}
function missionScore(){const base=(MS.found?100:0)+(MS.del?300:0)+(MS.prec?100:0)+(MS.med?300:0)+(MS.done?100:0);
 const tb=MS.done?Math.max(0,Math.round((300-MS.t)*2)):0,pen=Math.round(ps.dmg*3);return {base,tb,pen,total:Math.max(0,base+tb-pen)};}
function missionEnd(ok,why){if(MS.end)return;MS.end=true;const sc=missionScore();MS.score=sc.total;let best=getBest(),nb=false;
 if(ok){if(!best||sc.total>best.score){nb=true;best={score:sc.total,t:MS.t};try{localStorage.setItem(bestKey(),JSON.stringify(best));}catch(e){}}}
 const s=Math.floor(MS.t);$('mend').innerHTML='<h2>'+(ok?'Mission complete!':'Mission over')+'</h2><p class="why">'+why+' · time '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+' · arena '+(curSeed||'classic')+'</p><table><tr><td>Objectives</td><td>'+sc.base+'</td></tr><tr><td>Time bonus</td><td>+'+sc.tb+'</td></tr><tr><td>Damage penalty</td><td>-'+sc.pen+'</td></tr><tr><td><b>Score</b></td><td><b>'+sc.total+'</b></td></tr></table>'+(nb?'<p class="nb">New best for this arena!</p>':best?'<p class="bst">Best here: '+best.score+'</p>':'')+'<div class="row"><button id="m_again" class="on">Try again</button><button id="m_new">New arena</button><button id="m_close">Close</button></div>';
 $('mend').style.display='block';$('m_again').onclick=missionStart;$('m_new').onclick=()=>{setSeed(1+Math.floor(Math.random()*99999));missionStart();};$('m_close').onclick=()=>{$('mend').style.display='none';};
 mUI();}
function missionTick(dt){if(!MS.on||MS.end)return;const B=ps.bob,P=ps.pip;MS.t+=dt;
 if(!MS.found&&THERMAL.hot>=3){const src=THERMAL.src==='pip'?{x:P.pos[0],y:P.pos[1]}:{x:B.X,y:B.Y};if(Math.hypot(src.x-VICTIM.x,src.y-VICTIM.y)<4500){MS.found=true;say('Casualty found! +100',2500);auClick();}}
 if(!MS.del)for(const o of ps.pk){if(o&&o.rest){const d=Math.hypot(o.p[0]-VICTIM.x,o.p[1]-VICTIM.y);if(d<450){MS.del=true;MS.prec=d<200;say('Packet delivered to the casualty'+(MS.prec?' (precise!)':''),3000);break;}}}
 if(!MS.med&&B.med&&B.med.rest&&Math.hypot(B.med.p[0]-arena.drop_zone.x,B.med.p[1]-arena.drop_zone.y)<arena.drop_zone.size*.9){MS.med=true;say('Medicine delivered to the drop zone',3000);}
 if(MS.found&&MS.del&&MS.med&&P.st==='docked'&&B.speed<40){MS.done=true;mUI();missionEnd(true,'All objectives done');return;}
 if(ps.dead){missionEnd(false,ps.dead);return;}
 if(ps.tip){missionEnd(false,'BOB tipped over');return;}
 if(MS.t>=MLIM){missionEnd(false,'Time is up');return;}
 mUI();}
function setSeed(s){curSeed=s;buildArena(s);resetPlay();snap=true;$('m_seed').value=s;mBest();}
function mBest(){const b=getBest();$('m_best').textContent=b?'Best here: '+b.score+' points':'No score for this arena yet.';}
$('msb').onclick=()=>{const p=$('mis');const on=p.style.display!=='block';p.style.display=on?'block':'none';if(on){$('phys').style.display='none';mBest();}};
$('phb').addEventListener('click',()=>{if($('phys').style.display==='block')$('mis').style.display='none';});
$('m_rnd').onclick=()=>setSeed(1+Math.floor(Math.random()*99999));$('m_cls').onclick=()=>setSeed(0);
$('m_seed').onchange=e=>setSeed(Math.max(0,Math.min(99999,parseInt(e.target.value)||0)));
$('m_go').onclick=missionStart;$('m_x').onclick=()=>{$('mis').style.display='none';};
// ---------- API: drive BOB from real code (WebSocket client + postMessage), telemetry out
const API={ver:1,sock:null,tele:null,subs:[],allow:new URLSearchParams(location.search).get('origin')||null,thT:0,maxV:.52,half:.187};
const num=(v,d=0)=>(typeof v==='number'&&isFinite(v))?v:d;
function apiStatus(t){$('lk_st').textContent=t;}
function apiSend(o){const s=JSON.stringify(o);if(API.sock&&API.sock.readyState===1)API.sock.send(s);if(window.parent!==window&&API.post)try{window.parent.postMessage(o,API.allow||'*');}catch(e){}API.subs.forEach(f=>{try{f(o)}catch(e){}});}
function apiCmd(m){if(typeof m==='string'){try{m=JSON.parse(m)}catch(e){return}}if(!m||typeof m!=='object'||!ps||!playMode)return;
 const E=EXT,P=ps.pip;if(!E.on){E.on=true;E.state='SAFE';}E.last=performance.now();
 switch(m.t){
  case 'hb':break;
  case 'arm':if(E.state==='READY'){E.state='ARMED';say('Link ARMED');}else apiSend({t:'ack',of:'arm',ok:false,state:E.state});break;
  case 'disarm':E.state='READY';E.duty=null;E.pip=null;break;
  case 'cmd_vel':if(E.state==='ARMED'){const lin=num(m.lin),ang=num(m.ang),l=(lin-ang*API.half)/API.maxV,r=(lin+ang*API.half)/API.maxV,mx=Math.max(Math.abs(l),Math.abs(r),1);E.duty=[l/mx,r/mx];}break;
  case 'drive':if(E.state==='ARMED')E.duty=[clamp(num(m.l),-1,1),clamp(num(m.r),-1,1)];break;
  case 'pip_cmd':if(E.state==='ARMED')E.pip=[clamp(num(m.f),-1,1),clamp(num(m.sx),-1,1),clamp(num(m.yaw),-1,1),clamp(num(m.up),-1,1)];break;
  case 'pip':if(E.state==='ARMED'){if(m.a==='launch'&&P.st==='docked')pipAction();else if(m.a==='land'&&P.st==='flying')pipAction();else if(m.a==='drop')dropPacket();}break;
  case 'flap':if(E.state==='ARMED')toggleFlap();break;
  case 'reset':resetPlay();snap=true;E.state='READY';break;
  case 'mission':missionStart();break;
 }}
function telemetry(){const B=ps.bob,P=ps.pip,u=B.u;
 return {t:'tel',ts:Math.round(performance.now()),state:EXT.on?EXT.state:'KEYBOARD',
  pose:{x:B.X/1000,y:B.Y/1000,yaw:B.psi},
  imu:{pitch:u[1],roll:u[2],yaw_rate:B.w||0,ax:ps.aLong/1000,ay:ps.aLat/1000},
  vel:{lin:B.v||0,ang:B.w||0},wheels:{left:B.sw[0],right:B.sw[1]},
  joints:{rocker:u[3],bogie_l:u[4],bogie_r:u[5]},
  power:{volts:+ps.volts.toFixed(2),amps:+ps.cur.toFixed(2),soc:+ps.soc.toFixed(3)},
  load:ps.load||0,slip:ps.slip||0,damage:ps.dmg,fault:ps.dead||null,tipped:!!ps.tip,
  range:ps.range.map(d=>d/1000),
  pip:{state:P.st,x:P.pos[0]/1000,y:P.pos[1]/1000,z:P.pos[2]/1000,yaw:P.yaw},packets:ps.packets,flap:B.flap,
  mission:{on:MS.on,time:+MS.t.toFixed(1),found:MS.found,delivered:MS.del,medicine:MS.med,done:MS.done,score:MS.end?MS.score:null}};}
function thermalMsg(){const a=new Uint8Array(THW*THH);for(let i=0;i<a.length;i++)a[i]=Math.round(THERMAL.frame[i]*255);let s='';for(let i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);
 return {t:'thermal',w:THW,h:THH,src:THERMAL.src,hot:THERMAL.hot,data:btoa(s)};}
setInterval(()=>{if(!playMode||!ps)return;const now=performance.now();
 if(EXT.on&&!(API.sock&&API.sock.readyState===1)&&!API.post&&now-EXT.last>3000){EXT.on=false;EXT.state='SAFE';}
 if(!(API.sock&&API.sock.readyState===1)&&!API.post&&!API.subs.length)return;
 apiSend(telemetry());if(now-API.thT>250){API.thT=now;apiSend(thermalMsg());}},50);
function apiConnect(url){apiDisconnect();try{const s=new WebSocket(url);API.sock=s;apiStatus('Connecting…');
  s.onopen=()=>{apiStatus('Connected to '+url+'. Waiting for heartbeat.');EXT.on=true;EXT.state='SAFE';EXT.last=performance.now();s.send(JSON.stringify({t:'hello',api:API.ver,name:'BOB sim'}));};
  s.onmessage=e=>apiCmd(e.data);s.onerror=()=>apiStatus('Connection error. Is your program running?');
  s.onclose=()=>{if(API.sock===s){API.sock=null;apiStatus('Disconnected. Keyboard control is active.');EXT.on=false;EXT.duty=null;EXT.pip=null;}};}
 catch(e){apiStatus('Bad address: '+e.message);}}
function apiDisconnect(){if(API.sock){const s=API.sock;API.sock=null;try{s.close();}catch(e){}}EXT.on=false;EXT.duty=null;EXT.pip=null;}
addEventListener('message',e=>{if(e.source!==window.parent||e.source===window)return;if(API.allow&&e.origin!==API.allow)return;API.post=true;apiCmd(e.data);});
$('lkb').onclick=()=>{const p=$('lk');const on=p.style.display!=='block';p.style.display=on?'block':'none';if(on){$('phys').style.display='none';$('mis').style.display='none';}};
$('lk_go').onclick=()=>{const u=$('lk_url').value.trim();if(u)apiConnect(u);};$('lk_x').onclick=()=>{apiDisconnect();apiStatus('Disconnected. Keyboard control is active.');};$('lk_c').onclick=()=>{$('lk').style.display='none';};
{const q=new URLSearchParams(location.search).get('ws');if(q){$('lk_url').value=q;setTimeout(()=>apiConnect(q),500);}}
window.BOB_SIM={version:API.ver,command:apiCmd,telemetry:()=>telemetry(),thermal:()=>thermalMsg(),subscribe:f=>API.subs.push(f),connect:apiConnect,disconnect:apiDisconnect};
// ---------- audio (everything is synthesised, no files)
const AU={ctx:null,on:true};
function auInit(){if(AU.ctx||!AU.on)return;
 try{const C=new(window.AudioContext||window.webkitAudioContext)();AU.ctx=C;
  const m=C.createGain();m.gain.value=.55;const comp=C.createDynamicsCompressor();m.connect(comp);comp.connect(C.destination);AU.master=m;
  const nb=C.createBuffer(1,C.sampleRate*2,C.sampleRate),d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;AU.nb=nb;
  const noise=(f,type,q)=>{const s=C.createBufferSource();s.buffer=nb;s.loop=true;const fl=C.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q||.7;const g=C.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(m);s.start();return {g,fl};};
  const o1=C.createOscillator(),o2=C.createOscillator();o1.type='sawtooth';o2.type='square';const mf=C.createBiquadFilter();mf.type='lowpass';mf.frequency.value=900;const mg=C.createGain();mg.gain.value=0;
  o1.connect(mf);o2.connect(mf);mf.connect(mg);mg.connect(m);o1.start();o2.start();AU.motor={o1,o2,g:mg,f:mf};
  AU.rumble=noise(260,'lowpass');AU.slip=noise(2600,'bandpass',4);AU.wind=noise(420,'bandpass',1.2);
  const pg=C.createGain();pg.gain.value=0;const pf=C.createBiquadFilter();pf.type='lowpass';pf.frequency.value=1400;pf.connect(pg);pg.connect(m);
  AU.pbase=[150,152.5,231,233.7];AU.pipo=AU.pbase.map(f=>{const o=C.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(pf);o.start();return o;});AU.pipg=pg;
  const so=C.createOscillator();so.type='square';so.frequency.value=210;const sf=C.createBiquadFilter();sf.type='bandpass';sf.frequency.value=900;sf.Q.value=2;const sg=C.createGain();sg.gain.value=0;
  const lfo=C.createOscillator();lfo.frequency.value=38;const lg=C.createGain();lg.gain.value=40;lfo.connect(lg);lg.connect(so.frequency);lfo.start();so.connect(sf);sf.connect(sg);sg.connect(m);so.start();AU.servo={g:sg};
  m.gain.value=AU.on?.55:0;
 }catch(e){AU.ctx=null;}}
function auOK(){return AU.ctx&&AU.on;}
function auTone(type,f0,f1,dur,g){if(!auOK())return;const C=AU.ctx,t=C.currentTime,o=C.createOscillator(),e=C.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
 e.gain.setValueAtTime(g,t);e.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(e);e.connect(AU.master);o.start(t);o.stop(t+dur+.02);}
function auNoise(fc,dur,g,type='lowpass'){if(!auOK())return;const C=AU.ctx,t=C.currentTime,s=C.createBufferSource();s.buffer=AU.nb;const f=C.createBiquadFilter();f.type=type;f.frequency.value=fc;const e=C.createGain();
 e.gain.setValueAtTime(g,t);e.gain.exponentialRampToValueAtTime(.0008,t+dur);s.connect(f);f.connect(e);e.connect(AU.master);s.start(t,Math.random());s.stop(t+dur+.02);}
function auThump(g){auTone('sine',95,36,.22,g);auNoise(320,.12,g*.7);}
function auClick(){auTone('square',1800,900,.05,.12);auNoise(4000,.04,.08,'highpass');}
function auBuzz(){const t=performance.now();if(t<(AU.buzzT||0))return;AU.buzzT=t+900;auTone('sawtooth',150,95,.22,.14);}
function auCrash(){auNoise(900,.7,.5);auTone('sine',70,28,.6,.5);setTimeout(()=>auNoise(2500,.25,.25,'bandpass'),90);}
const AUP={lat:0,flap:0,th:0,pl:0,pr:0,sL:0,sR:0,prop:0,thump:0,pkL:false,mdL:false};
function auSync(d){const g=n=>d[IX[n]];AUP.lat=g('latch');AUP.flap=g('flap');AUP.th=g('theta');AUP.pl=g('phiL');AUP.pr=g('phiR');AUP.sL=g('spinL');AUP.sR=g('spinR');AUP.prop=g('prop');AUP.pkL=false;AUP.mdL=false;}
function audioFrame(dt,d,load,slip){
 if(dt<=0||dt>.25){auSync(d);return;}
 const g=n=>d[IX[n]];
 const rate=Math.max(Math.abs(g('theta')-AUP.th),Math.abs(g('phiL')-AUP.pl),Math.abs(g('phiR')-AUP.pr))/dt;
 const spL=Math.abs(g('spinL')-AUP.sL)/dt*RW,spR=Math.abs(g('spinR')-AUP.sR)/dt*RW,sp=(spL+spR)/2;
 const servo=Math.min(1,(Math.abs(g('latch')-AUP.lat)+Math.abs(g('flap')-AUP.flap))/dt/1.2);
 const spin=Math.min(1,Math.abs(g('prop')-AUP.prop)/dt/36);
 AUP.thump-=dt;if(rate>.7&&AUP.thump<=0&&sp>30&&auOK()){auThump(Math.min(.3,.08+rate*.07));AUP.thump=.18;}
 if(!playMode){const fk=g('pkFree')>.5,fm=g('mdFree')>.5;
  if(fk&&!AUP.pkL&&g('kZ')<6){AUP.pkL=true;auThump(.16);}if(!fk)AUP.pkL=false;
  if(fm&&!AUP.mdL&&g('mZ')<g('Zb')+16&&g('Zb')>=0&&Math.abs(g('mX')-g('X'))>60){AUP.mdL=true;auThump(.2);}if(!fm)AUP.mdL=false;}
 auSync(d);
 if(!auOK())return;
 const c=AU.ctx,tc=c.currentTime,sm_=(p,v,t)=>p.setTargetAtTime(v,tc,t||.06);
 const ld=load!=null?load:Math.min(1,sp/480*.35),sl=slip||0;
 const f=55+Math.min(sp,600)*.55+ld*35;
 AU.motor.o1.frequency.setTargetAtTime(f,tc,.05);AU.motor.o2.frequency.setTargetAtTime(f*2.01,tc,.05);AU.motor.f.frequency.setTargetAtTime(500+sp*1.4,tc,.1);
 sm_(AU.motor.g.gain,sp>6?.04+.06*Math.min(1,sp/480)+.05*ld:0);
 sm_(AU.rumble.g.gain,Math.min(.3,sp/480*.09+Math.min(.2,rate*.04)));
 sm_(AU.slip.g.gain,Math.max(0,sl-.25)*.16);
 const pw=W(pip.position.x,pip.position.y,pip.position.z),att=1/(1+camera.position.distanceTo(pw)/700);
 sm_(AU.pipg.gain,spin*.075*att);AU.pipo.forEach((o,i)=>o.frequency.setTargetAtTime(AU.pbase[i]*(.5+.7*spin),tc,.1));
 sm_(AU.wind.g.gain,spin*.14*att);
 sm_(AU.servo.g.gain,servo*.09,.03);
}


// ---------- camera insets: Bob webcam and 32x24 thermal array (Pip's thermal camera takes over while it flies)
function mountCam(parent,cam,x,y,z,pitchDeg){const piv=new THREE.Object3D();piv.matrixAutoUpdate=false;
 piv.matrix.makeBasis(new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0));piv.matrix.setPosition(x,y,z);parent.add(piv);piv.add(cam);cam.rotation.x=-pitchDeg*Math.PI/180;}
const camWeb=new THREE.PerspectiveCamera(62,4/3,8,14000),camThB=new THREE.PerspectiveCamera(55,4/3,8,14000),camThP=new THREE.PerspectiveCamera(55,4/3,8,14000);
mountCam(bob,camWeb,142,0,215,8);mountCam(bob,camThB,137,0,238,6);mountCam(pip,camThP,16,11,55,30);
// heat tags (0 cold .. 1 hot) for the thermal view
bob.userData.heat=.2;shell.userData.heat=.36;
for(const s of ['L','R']){side[s].rk.userData.heat=.42;side[s].bg.userData.heat=.42;side[s].spin.forEach(q=>q.userData.heat=.24);side[s].lt.userData.heat=.14;}
pip.userData.heat=.42;props.forEach(p=>p.g.userData.heat=.34);floor.userData.heat=.05;
const THW=32,THH=24,thRT=new THREE.WebGLRenderTarget(THW,THH,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
const thBuf=new Uint8Array(THW*THH*4),thCv=$('tcv'),thCtx=thCv.getContext('2d'),thImg=thCtx.createImageData(THW,THH),thMats=new Map();
const THERMAL={hot:0,peak:0,src:'bob',frame:new Float32Array(THW*THH)};
function heatMat(h){const k=Math.round(clamp(h,0,1)*50);let m=thMats.get(k);if(!m){const v=k/50;m=new THREE.MeshBasicMaterial({color:new THREE.Color(v,v,v),toneMapped:false,side:THREE.DoubleSide});thMats.set(k,m);}return m;}
function heatOf(o){for(let p=o;p;p=p.parent)if(p.userData&&p.userData.heat!=null)return p.userData.heat;return .1;}
const IRON=[[0,[0,0,22]],[.15,[40,0,100]],[.3,[120,0,135]],[.45,[190,40,90]],[.6,[235,100,30]],[.8,[255,200,40]],[1,[255,255,205]]];
function iron(v){v=clamp(v,0,1);for(let i=1;i<IRON.length;i++)if(v<=IRON[i][0]){const a=IRON[i-1],b=IRON[i],t=(v-a[0])/(b[0]-a[0]);return [0,1,2].map(k=>a[1][k]+(b[1][k]-a[1][k])*t);}return IRON[IRON.length-1][1];}
function thermalPass(){
 const usePip=ps&&ps.pip&&ps.pip.fly&&playMode||(!playMode&&frameBuf[IX.pipFly]>.5);const cam=usePip?camThP:camThB;THERMAL.src=usePip?'pip':'bob';
 const saved=[];root.traverse(o=>{if(o.userData&&o.userData.hideThermal||o.isLine||o.isInstancedMesh||o.isPoints){saved.push([o,o.visible,null]);o.visible=false;}
  else if(o.isMesh){saved.push([o,o.visible,o.material]);o.material=heatMat(heatOf(o));}});
 if(usePip){saved.push([pip,pip.visible,null]);pip.visible=false;}
 const bg=scene.background,fog=scene.fog;scene.background=new THREE.Color(0x000000);scene.fog=null;
 renderer.setRenderTarget(thRT);renderer.render(scene,cam);renderer.setRenderTarget(null);
 scene.background=bg;scene.fog=fog;for(const [o,v,m] of saved){o.visible=v;if(m)o.material=m;}
 renderer.readRenderTargetPixels(thRT,0,0,THW,THH,thBuf);
 let hot=0,peak=0;
 for(let y=0;y<THH;y++)for(let x=0;x<THW;x++){const si=((THH-1-y)*THW+x)*4,di=(y*THW+x)*4,g=thBuf[si]/255;THERMAL.frame[y*THW+x]=g;if(g>=.8)hot++;if(g>peak)peak=g;
  const c=iron(g);thImg.data[di]=c[0];thImg.data[di+1]=c[1];thImg.data[di+2]=c[2];thImg.data[di+3]=255;}
 thCtx.putImageData(thImg,0,0);THERMAL.hot=hot;THERMAL.peak=peak;
 $('camtl').textContent='THERMAL 32x24 · '+(usePip?'PIP':'BOB');$('thhot').textContent=hot>1?'HEAT SIGNATURE':'';}
function drawInset(cam,el){const r=el.getBoundingClientRect();if(r.width<2)return;
 renderer.setScissorTest(true);renderer.setViewport(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissor(r.left,innerHeight-r.bottom,r.width,r.height);
 renderer.render(scene,cam);renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);}
let thT=0;
function camsFrame(dt){thT-=dt;const need=document.body.classList.contains('cams')||(MS.on&&!MS.end)||EXT.on||API.post||API.subs.length;if(dt===0||(need&&thT<=0)){thT=.125;thermalPass();}
}
$('camb').onclick=()=>{const on=document.body.classList.toggle('cams');$('camb').classList.toggle('on',on);};

// ---------- UI
let T=0,playing=true,rate=1;
$('seek').max=TOTAL;
const tk=$('ticks');
const seen=new Set();sim.captions.forEach(([t,l])=>{const key=l.replace(/^(Pip|Scanning).*/,'$1');if(seen.has(key))return;seen.add(key);const i=document.createElement('i');i.style.left=(t/TOTAL*100)+'%';i.title=l;tk.appendChild(i);});
function setPlayMode(on){playMode=on;buildRamp(on?parseFloat($('s_r').value):20);buildArena(on?curSeed:0);TIPM=null;$('phb').style.display=on?'':'none';$('msb').style.display=on?'':'none';$('lkb').style.display=on?'':'none';if(!on){missionOff();$('mis').style.display='none';}if(!on){$('phys').style.display='none';['h_ld','h_sl','h_tp','h_bt','h_cu','h_dm','h_rg'].forEach(i=>$(i).textContent='-');}document.body.classList.toggle('play',on);$('mode').textContent=on?'Demo mode':'Play mode';
 $('play').style.display=on?'none':'';$('spd').style.display=on?'none':'';$('restart').textContent=on?'Reset':'Restart';
 camsEl.querySelector('[data-k=auto]').style.display=on?'none':'';
 $('hud').style.display='';
 if(on){resetPlay();setMode('chase');}else{T=0;playing=true;$('play').textContent='Pause';medG.visible=false;PK_POOL.forEach(m=>m.visible=false);pk1.visible=true;setMode('auto');}
 snap=true;}

$('snd').onclick=()=>{AU.on=!AU.on;$('snd').textContent='Sound: '+(AU.on?'on':'off');if(AU.on)auInit();if(AU.master)AU.master.gain.value=AU.on?.55:0;};
['pointerdown','keydown'].forEach(e=>addEventListener(e,()=>{auInit();if(AU.ctx&&AU.ctx.state==='suspended')AU.ctx.resume();},{passive:true}));
$('phb').onclick=()=>{$('lk').style.display='none';const p=$('phys');p.style.display=p.style.display==='block'?'none':'block';};
$('phOn').onclick=()=>{PH.on=!PH.on;$('phOn').classList.toggle('on',PH.on);$('phOn').textContent=PH.on?'On':'Off';};
const SL=[['s_m','v_m','mBob',v=>v.toFixed(1)+' kg'],['s_p','v_p','mPip',v=>v.toFixed(1)+' kg'],['s_t','v_t','stall',v=>v+' kg·cm'],['s_u','v_u','mu',v=>v.toFixed(2)]];
SL.forEach(([s,l,k,f])=>{$(s).oninput=e=>{PH[k]=parseFloat(e.target.value);$(l).textContent=f(PH[k]);};});
$('s_d').oninput=e=>{PH.drain=[1,10,60][+e.target.value];$('v_d').textContent='x'+PH.drain;};
$('s_r').oninput=e=>{$('v_r').textContent=e.target.value+'°';};
$('s_r').onchange=e=>{if(playMode){buildRamp(parseFloat(e.target.value));resetPlay();snap=true;say('Ramp set to '+e.target.value+'°');}};
$('phDef').onclick=()=>{Object.assign(PH,PHD);$('s_d').value=0;$('v_d').textContent='x1';SL.forEach(([s,l,k,f])=>{$(s).value=PH[k];$(l).textContent=f(PH[k]);});$('s_r').value=20;$('v_r').textContent='20°';if(playMode){buildRamp(20);resetPlay();}};
$('mode').onclick=()=>setPlayMode(!playMode);
$('play').onclick=()=>{if(RP.on){if(RP.i>=REC.length-1.01)RP.i=0;RP.play=!RP.play;$('play').textContent=RP.play?'Pause':'Play';return;}if(T>=TOTAL-.05){T=0;snap=true;}playing=!playing;$('play').textContent=playing?'Pause':'Play';};
$('restart').onclick=()=>{if(RP.on){RP.i=0;return;}if(playMode){resetPlay();snap=true;}else{T=0;snap=true;playing=true;$('play').textContent='Pause';}};
$('spd').onclick=()=>{rate=rate===1?2:rate===2?.5:1;$('spd').textContent=rate+'x';};
$('seek').oninput=e=>{if(RP.on){RP.i=clamp(parseFloat(e.target.value)*30,0,Math.max(0,REC.length-1));return;}T=parseFloat(e.target.value);snap=true;};
function toggleXray(){const on=$('xray').classList.toggle('on');shell.material.transparent=on;shell.material.opacity=on?.16:1;shell.material.depthWrite=!on;shell.material.needsUpdate=true;}
$('xray').onclick=toggleXray;
function showHelp(v){$('help').style.display=v?'block':'none';}
$('bHelp').onclick=()=>showHelp(true);
$('hPlay').onclick=()=>{showHelp(false);if(!playMode)setPlayMode(true);};
$('hDemo').onclick=()=>{showHelp(false);setPlayMode(false);};
$('bPip').onclick=()=>pipAction();$('bDrop').onclick=()=>dropPacket();$('bFlap').onclick=()=>toggleFlap();$('bSwap').onclick=()=>swap();
document.querySelectorAll('#dpad button').forEach(b=>{const k=b.dataset.k;
 const on=e=>{e.preventDefault();held.add(k);};const off=e=>{e.preventDefault();held.delete(k);};
 b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointerleave',off);b.addEventListener('pointercancel',off);});
if(matchMedia('(pointer:coarse)').matches)document.body.classList.add('touch');
const CAMORDER=['chase','side','top','pip','free'];
addEventListener('keydown',e=>{
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
 if(e.repeat){held.add(e.code);return;}
 held.add(e.code);
 if($('help').style.display!=='none'&&e.code==='Escape'){showHelp(false);return;}
 if(!playMode){if(e.code==='Space')$('play').click();return;}
 if($('help').style.display!=='none')return;
 if(e.code==='Space')dropPacket();else if(e.code==='KeyM')toggleFlap();else if(e.code==='Tab')swap();
 else if(e.code==='KeyC'){const i=CAMORDER.indexOf(mode);setMode(CAMORDER[(i+1)%CAMORDER.length]);}
 else if(e.code==='KeyX')toggleXray();else if(e.code==='Backspace'){resetPlay();snap=true;}
});
addEventListener('keyup',e=>held.delete(e.code));
addEventListener('blur',()=>held.clear());
function caption(t){let c=sim.captions[0][1];for(const [ct,l] of sim.captions){if(ct<=t+1e-6)c=l;else break;}return c;}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
// test hook for screenshots and scripted checks
window.__bob={tiltAngle,AX:()=>AX,rec:()=>REC.length,repEnter,repExit,repSave:()=>{},repFrame:(d)=>repFrame(d),RP:()=>({on:RP.on,i:RP.i}),mission:()=>JSON.parse(JSON.stringify(MS)),mstart:()=>missionStart(),setSeed:s=>setSeed(s),thermal:()=>(thermalPass(),{hot:THERMAL.hot,peak:THERMAL.peak,src:THERMAL.src}),victim:()=>VICTIM,seek:(t,m)=>{setPlayMode(false);T=t;snap=true;if(m)setMode(m);playing=false;$('play').textContent='Play';frame(0,true);},
 ready:true,total:TOTAL,dbg:(p,l)=>{DBG=p?{p,l}:null;},seed:s=>{curSeed=s;buildArena(s);},PH,tipCheck:(l,t)=>tipCheck(.016,l,t),tickTip:(n)=>{for(let i=0;i<n;i++)tickTip(1/60)},ps:()=>ps,setRamp:a=>{buildRamp(a);resetPlay();},
 playSteps:(codes,secs)=>{if(!playMode)setPlayMode(true);showHelp(false);codes.forEach(c=>held.add(c));const n=Math.round(secs*60);for(let i=0;i<n;i++)playTick(1/60);return ps;},
 release:(codes)=>codes.forEach(c=>held.delete(c)),act:(n)=>({pip:pipAction,drop:dropPacket,flap:toggleFlap,swap,reset:()=>resetPlay()})[n](),
 shot:(m)=>{if(m)setMode(m);snap=true;frame(0,true);},state:()=>JSON.parse(JSON.stringify({b:{X:ps.bob.X,Y:ps.bob.Y,psi:ps.bob.psi,u:ps.bob.u,speed:ps.bob.speed,why:ps.bob.why},p:{st:ps.pip.st,pos:ps.pip.pos,fly:ps.pip.fly},ctl:ps.ctl,packets:ps.packets}))};
let last=performance.now();
function frame(dt,force){
 if(playMode&&RP.on){repFrame(force?0:Math.min(dt,.05));}
 else if(playMode){if(!force)playTick(Math.min(dt,1/20));else apply(0,pbuf);updateCam(T,Math.max(dt,1e-3));$('cap').textContent=playCaption();audioFrame(force?0:Math.min(dt,.05),pbuf,PH.on?ps.load:null,PH.on?(ps.sat>.5?ps.slip:ps.slip*.4):0);
  if(msgT&&performance.now()>msgT){$('msg').style.display='none';msgT=0;}}
 else{if(playing&&!force){T+=dt*rate;if(T>=TOTAL){T=TOTAL;playing=false;$('play').textContent='Replay';}}
  const dd_=apply(T);updateCam(T,Math.max(dt,1e-3));audioFrame(force||!playing?0:dt*rate,dd_,null,0);
  $('seek').value=T;$('time').textContent=T.toFixed(1)+' / '+TOTAL.toFixed(1)+' s';$('cap').textContent=caption(T);}
  camsFrame(playMode?(force?0:Math.min(dt,.05)):(force?1:dt));
 renderer.render(scene,camera);
 if(document.body.classList.contains('cams'))drawInset(camWeb,$('camw'));
}
function loop(now){const dt=Math.min((now-last)/1000,.1);last=now;frame(dt);requestAnimationFrame(loop);}
setPlayMode(true);playTick(1/60);updateCam(0,1);snap=true;$('load').style.display='none';
requestAnimationFrame(loop);
})();
