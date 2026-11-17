'use strict';

const DICE_PIPS = [[],[5],[1,9],[1,5,9],[1,3,7,9],[1,3,5,7,9],[1,3,4,6,7,9]];
const GLASS_FACES = [
  {side:'top',value:1,normal:[0,1,0]}, {side:'bottom',value:6,normal:[0,-1,0]},
  {side:'front',value:2,normal:[0,0,1]}, {side:'back',value:5,normal:[0,0,-1]},
  {side:'right',value:3,normal:[1,0,0]}, {side:'left',value:4,normal:[-1,0,0]}
];
const GLASS_SHAKE_DURATION=4, GLASS_MAX_DURATION=10;

function glassDiceHtml(index){
  return '<div class="glass-die" role="img" aria-label="Xí ngầu '+(index+1)+'">'+GLASS_FACES.map(f=>
    '<span class="dice-face glass-'+f.side+'-face'+(f.value===1?' single-pip':'')+(f.value===1||f.value===4?' red-pips':'')+'" data-face="'+f.value+'" aria-hidden="true">'+DICE_PIPS[f.value].map(p=>
      '<i class="dice-pip" style="grid-column:'+((p-1)%3+1)+';grid-row:'+(Math.floor((p-1)/3)+1)+'"></i>'
    ).join('')+'</span>'
  ).join('')+'</div>';
}

class GlassDiceSimulation {
  constructor(stage,count=3,shakeDuration=GLASS_SHAKE_DURATION,snapOnSettle=true){
    this.stage=stage; this.count=count; this.shakeDuration=shakeDuration; this.snapOnSettle=snapOnSettle;
    this.scale=88; this.time=0; this.quietTime=0; this.nextRecovery=GLASS_MAX_DURATION; this.restPoses=null; this.frame=null; this.running=false;
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0),allowSleep:false});
    this.world.solver.iterations=20; this.world.solver.tolerance=1e-7;
    const diceMaterial=new CANNON.Material('ivory'), floorMaterial=new CANNON.Material('base'), wallMaterial=new CANNON.Material('glass');
    this.world.addContactMaterial(new CANNON.ContactMaterial(diceMaterial,floorMaterial,{friction:.48,restitution:.3}));
    this.world.addContactMaterial(new CANNON.ContactMaterial(diceMaterial,wallMaterial,{friction:.2,restitution:.42}));
    this.world.addContactMaterial(new CANNON.ContactMaterial(diceMaterial,diceMaterial,{friction:.35,restitution:.32}));
    this.floor=new CANNON.Body({type:CANNON.Body.KINEMATIC,material:floorMaterial,shape:new CANNON.Box(new CANNON.Vec3(1,.04,1)),position:new CANNON.Vec3(0,-.04,0)});
    this.world.addBody(this.floor);
    for(let i=0;i<32;i++){
      const angle=i*Math.PI/16, wall=new CANNON.Body({mass:0,material:wallMaterial,shape:new CANNON.Box(new CANNON.Vec3(.087,.52,.045)),position:new CANNON.Vec3(Math.sin(angle)*.82,.5,Math.cos(angle)*.82)});
      wall.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0),angle); this.world.addBody(wall);
    }
    this.world.addBody(new CANNON.Body({mass:0,material:wallMaterial,shape:new CANNON.Box(new CANNON.Vec3(1,.04,1)),position:new CANNON.Vec3(0,1.04,0)}));
    const starts=count===1?[[0,0]]:count===2?[[-.32,0],[.32,0]]:[[-.38,-.23],[.38,-.23],[0,.4]];
    this.bodies=starts.map(([x,z],i)=>{
      const body=new CANNON.Body({mass:.035,shape:new CANNON.Box(new CANNON.Vec3(.18,.18,.18)),material:diceMaterial,position:new CANNON.Vec3(x,.181,z),linearDamping:.06,angularDamping:.08,allowSleep:true,sleepSpeedLimit:.1,sleepTimeLimit:.75});
      if(i===1)body.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
      if(i===2)body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,0,1),Math.PI/2);
      this.world.addBody(body); body.sleep(); return body;
    });
    this.camera=stage.querySelector('.glass-camera');
    this.camera.innerHTML='<div class="glass-floor"></div>'+this.bodies.map(()=>'<div class="glass-die-shadow"></div>').join('')+this.bodies.map((_,i)=>glassDiceHtml(i)).join('');
    this.dice=[...this.camera.querySelectorAll('.glass-die')]; this.shadows=[...this.camera.querySelectorAll('.glass-die-shadow')]; this.$floor=this.camera.querySelector('.glass-floor');
    this.render();
  }
  readValues(){
    const up=new CANNON.Vec3();
    return this.bodies.map(body=>{
      let best=-Infinity,value=1;
      for(const f of GLASS_FACES){body.quaternion.vmult(new CANNON.Vec3(...f.normal),up);if(up.y>best){best=up.y;value=f.value;}}
      return value;
    });
  }
  step(dt){
    this.time+=dt;
    if(this.time<this.shakeDuration){
      const envelope=1-this.time/this.shakeDuration, a=.075, omega=48;
      this.floor.position.y=-.04+a*envelope*envelope*Math.sin(omega*this.time);
      this.floor.velocity.y=a*(envelope*envelope*omega*Math.cos(omega*this.time)-(2*envelope/this.shakeDuration)*Math.sin(omega*this.time));
    } else {this.floor.position.y=-.04;this.floor.velocity.set(0,0,0);}
    if(this.time<this.shakeDuration&&this.time>=this.nextJolt){
      this.nextJolt+=.28;
      this.bodies.forEach(body=>{
        body.wakeUp();
        body.velocity.x+=(Math.random()-.5)*2.2;
        body.velocity.y=Math.max(body.velocity.y,2.8+Math.random()*.8);
        body.velocity.z+=(Math.random()-.5)*2.2;
        body.angularVelocity.set((Math.random()-.5)*44,(Math.random()-.5)*44,(Math.random()-.5)*44);
      });
    }
    this.world.step(dt);
    if(this.time>=GLASS_MAX_DURATION&&this.count<2)return true;
    if(this.time<=this.shakeDuration)return false;
    const quiet=this.restPoses&&this.bodies.every((body,i)=>{
      const pose=this.restPoses[i],q=body.quaternion,r=pose.quaternion;
      return body.position.distanceSquared(pose.position)<.000016&&Math.abs(q.x*r.x+q.y*r.y+q.z*r.z+q.w*r.w)>.99996;
    });
    if(quiet)this.quietTime+=dt;
    else {this.quietTime=0;this.restPoses=this.bodies.map(body=>({position:body.position.clone(),quaternion:body.quaternion.clone()}));}
    if(this.time>2.8&&this.quietTime>.75){
      if(this.count>=2&&!this.areDiceSettledOnFloor()){
        this.nudgeUnsettledDice();
        this.quietTime=0; this.restPoses=null; this.nextRecovery=this.time+1;
        return false;
      }
      this.bodies.forEach(body=>body.sleep());
      return true;
    }
    if(this.count>=2&&this.time>=this.nextRecovery){
      this.nudgeUnsettledDice();
      this.quietTime=0; this.restPoses=null; this.nextRecovery=this.time+1;
    }
    return false;
  }
  dieSettledOnFloor(body){
    const q=body.quaternion,axis=new CANNON.Vec3();
    let highest=-Infinity;
    GLASS_FACES.forEach(face=>{
      q.vmult(new CANNON.Vec3(...face.normal),axis);
      highest=Math.max(highest,axis.y);
    });
    const xAxis=q.vmult(new CANNON.Vec3(1,0,0),new CANNON.Vec3());
    const yAxis=q.vmult(new CANNON.Vec3(0,1,0),new CANNON.Vec3());
    const zAxis=q.vmult(new CANNON.Vec3(0,0,1),new CANNON.Vec3());
    const halfHeight=.18*(Math.abs(xAxis.y)+Math.abs(yAxis.y)+Math.abs(zAxis.y));
    const bottom=body.position.y-halfHeight, floorTop=this.floor.position.y+.04;
    return highest>=.98&&Math.abs(bottom-floorTop)<=.04;
  }
  areDiceSettledOnFloor(){
    return this.bodies.every(body=>this.dieSettledOnFloor(body));
  }
  nudgeUnsettledDice(){
    this.bodies.forEach((body,i)=>{
      if(this.dieSettledOnFloor(body))return;
      let dx=0,dz=0;
      this.bodies.forEach((other,j)=>{
        if(i===j)return;
        if(body.position.y>other.position.y+.08){
          dx+=body.position.x-other.position.x;
          dz+=body.position.z-other.position.z;
        }
      });
      if(Math.hypot(dx,dz)<.001){
        const angle=i*Math.PI*2/this.bodies.length+this.time*.7;
        dx=Math.cos(angle); dz=Math.sin(angle);
      }
      const length=Math.hypot(dx,dz);
      const elevated=body.position.y>this.floor.position.y+.29;
      const speed=elevated?2.2:.3;
      body.wakeUp();
      body.velocity.x=dx/length*speed;
      body.velocity.z=dz/length*speed;
      if(elevated)body.velocity.y=Math.min(body.velocity.y,-.2);
      body.angularVelocity.x+=(Math.random()-.5)*(elevated?4:2.5);
      body.angularVelocity.z+=(Math.random()-.5)*(elevated?4:2.5);
    });
  }
  straightenDice(){
    const up=new CANNON.Vec3(0,1,0);
    let needsReposition=false;
    this.bodies.forEach((body,i)=>{
      let topFace=GLASS_FACES[0], highest=-Infinity;
      GLASS_FACES.forEach(face=>{
        const normal=new CANNON.Vec3(...face.normal);
        body.quaternion.vmult(normal,normal);
        if(normal.y>highest){highest=normal.y;topFace=face;}
      });
      body.quaternion.setFromVectors(new CANNON.Vec3(...topFace.normal),up);
      if(Math.hypot(body.position.x,body.position.z)>.52)needsReposition=true;
      for(let j=0;j<i;j++){
        const other=this.bodies[j];
        if(Math.abs(body.position.x-other.position.x)<.37&&Math.abs(body.position.z-other.position.z)<.37)needsReposition=true;
      }
      body.position.y=.181;
      body.velocity.set(0,0,0); body.angularVelocity.set(0,0,0);
    });
    if(needsReposition){
      const positions=this.bodies.length===1?[[0,0]]:this.bodies.length===2?[[-.32,0],[.32,0]]:[[-.38,-.23],[.38,-.23],[0,.4]];
      positions.forEach(([x,z],i)=>this.bodies[i].position.set(x,.181,z));
    }
    this.bodies.forEach(body=>{
      body.aabbNeedsUpdate=true; body.sleep();
    });
    this.render();
  }
  start(onSettled,onMotionChange){
    this.stop(); this.time=0; this.quietTime=0; this.nextRecovery=GLASS_MAX_DURATION; this.restPoses=null; this.nextJolt=.12; this.floor.position.y=-.04; this.floor.velocity.set(0,0,0);
    this.bodies.forEach(body=>{
      body.wakeUp(); body.velocity.set((Math.random()-.5)*2.2,3.4+Math.random()*1.3,(Math.random()-.5)*2.2);
      body.angularVelocity.set((Math.random()-.5)*40,(Math.random()-.5)*40,(Math.random()-.5)*40);
    });
    this.running=true; const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let previous=performance.now(),accumulator=0,driveEnded=false;
    onMotionChange();
    const animate=now=>{
      if(!this.running)return;
      accumulator+=Math.min(.08,(now-previous)/1000);previous=now;let settled=false;
      while(accumulator>=1/240){settled=this.step(1/240);accumulator-=1/240;if(settled)break;}
      if(!driveEnded&&this.time>=this.shakeDuration){driveEnded=true;onMotionChange();}
      if(!reduced||settled)this.render();
      if(settled){
        if(this.snapOnSettle&&this.count<2)this.straightenDice();
        else {this.bodies.forEach(body=>body.sleep());this.render();}
        this.running=false;this.frame=null;onSettled(this.readValues());
      } else this.frame=requestAnimationFrame(animate);
    };
    this.frame=requestAnimationFrame(animate);
  }
  stop(){cancelAnimationFrame(this.frame);this.frame=null;this.running=false;}
  render(){
    const values=this.readValues(), floorTop=this.floor.position.y+.04;
    this.$floor.style.transform='translateY('+(-floorTop*this.scale)+'px) rotateX(90deg)';
    this.bodies.forEach((body,i)=>{
      const p=body.position,q=body.quaternion,s=this.scale;
      this.dice[i].style.transform='translate3d('+(p.x*s)+'px,'+(-p.y*s)+'px,'+(p.z*s)+'px) rotate3d('+(-q.x)+','+q.y+','+(-q.z)+','+(2*Math.acos(Math.max(-1,Math.min(1,q.w))))+'rad)';
      this.dice[i].dataset.value=values[i];this.dice[i].setAttribute('aria-label','Xí ngầu '+(i+1)+': '+values[i]+' điểm');
      const height=Math.max(0,p.y-.18-floorTop);
      this.shadows[i].style.transform='translate3d('+(p.x*s)+'px,'+(-floorTop*s-.3)+'px,'+(p.z*s)+'px) rotateX(90deg) scale('+(1+height*.7)+')';
      this.shadows[i].style.opacity=.45/(1+height*3);this.shadows[i].style.filter='blur('+(1+height*3)+'px)';
    });
  }
}

class GlassCoinSimulation {
  constructor(camera,count=4){
    this.camera=camera;this.count=count;this.scale=88;this.maxCoinCenterRadius=.62;this.time=0;this.nextJolt=.12;this.frame=null;this.running=false;
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0),allowSleep:false});
    this.world.solver.iterations=18;this.world.solver.tolerance=1e-6;
    const coinMaterial=new CANNON.Material('xd-coin'),floorMaterial=new CANNON.Material('xd-coin-floor'),wallMaterial=new CANNON.Material('xd-coin-wall');
    this.world.addContactMaterial(new CANNON.ContactMaterial(coinMaterial,floorMaterial,{friction:.38,restitution:.38}));
    this.world.addContactMaterial(new CANNON.ContactMaterial(coinMaterial,wallMaterial,{friction:.24,restitution:.3}));
    this.world.addContactMaterial(new CANNON.ContactMaterial(coinMaterial,coinMaterial,{friction:.3,restitution:.24}));
    this.floor=new CANNON.Body({type:CANNON.Body.KINEMATIC,material:floorMaterial,shape:new CANNON.Box(new CANNON.Vec3(1,.04,1)),position:new CANNON.Vec3(0,-.04,0)});
    this.world.addBody(this.floor);
    for(let i=0;i<32;i++){
      const angle=i*Math.PI/16,wall=new CANNON.Body({mass:0,material:wallMaterial,shape:new CANNON.Box(new CANNON.Vec3(.075,.52,.04)),position:new CANNON.Vec3(Math.sin(angle)*.78,.5,Math.cos(angle)*.78)});
      wall.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0),angle);this.world.addBody(wall);
    }
    this.world.addBody(new CANNON.Body({mass:0,material:wallMaterial,shape:new CANNON.Box(new CANNON.Vec3(1,.04,1)),position:new CANNON.Vec3(0,1.04,0)}));
    this.bodies=Array.from({length:count},(_,i)=>{
      const body=new CANNON.Body({mass:.025,shape:new CANNON.Cylinder(.18,.18,.055,20),material:coinMaterial,position:new CANNON.Vec3(0,.0275,0),linearDamping:.12,angularDamping:.2,allowSleep:false});
      this.world.addBody(body);return body;
    });
    this.landed=new Set();
    this.placeCoinsAtRest();
    this.camera.innerHTML=this.bodies.map(()=>'<span class="xd-glass-coin-shadow"></span>').join('')+this.bodies.map((_,i)=>'<span class="xd-phys-coin" aria-hidden="true"><i class="xd-coin-side"></i><i class="xd-coin-face"></i><i class="xd-coin-back"></i></span>').join('');
    this.shadows=[...camera.querySelectorAll('.xd-glass-coin-shadow')];this.coins=[...camera.querySelectorAll('.xd-phys-coin')];
    this.render();
  }
  setCoins(values){this.coins.forEach((coin,i)=>coin.classList.toggle('red',!!values[i]));}
  start(values,onSettled=()=>{}){
    this.stop();this.setCoins(values);this.time=0;this.nextJolt=.12;
    this.landed.clear();
    this.placeCoinsAtRest();
    const liftVelocity=3.8;
    this.bodies.forEach((body,i)=>{
      body.quaternion.setFromEuler((Math.random()-.5)*1.8,Math.random()*Math.PI*2,(Math.random()-.5)*1.8);
      body.velocity.set((Math.random()-.5)*2.8,liftVelocity,(Math.random()-.5)*2.8);
      body.angularVelocity.set(i%2?-18:18,(Math.random()-.5)*8,0);
      body.aabbNeedsUpdate=true;
    });
    this.running=true;let previous=performance.now(),accumulator=0;
    const animate=now=>{
      if(!this.running)return;
      accumulator+=Math.min(.08,(now-previous)/1000);previous=now;
      while(accumulator>=1/180){
        this.time+=1/180;
        if(this.time<2.8&&this.time>=this.nextJolt){
          this.nextJolt+=.2;this.bodies.forEach((body,i)=>{
            if(this.landed.has(i)){
              this.landed.delete(i);body.type=CANNON.Body.DYNAMIC;body.mass=.025;body.updateMassProperties();body.aabbNeedsUpdate=true;
            }
            body.wakeUp();body.velocity.y=liftVelocity;
            body.angularVelocity.set(i%2?-18:18,(Math.random()-.5)*8,0);
          });
        }
        const descending=this.bodies.map(body=>body.velocity.y<0);
        this.world.step(1/180);this.containCoins();this.freezeLandedCoins(descending);accumulator-=1/180;
      }
      this.render();
      if(this.time>=5){
        this.bodies.forEach((body,i)=>{
          if(this.landed.has(i))return;
          const position=this.findLandingPosition(i);
          body.position.set(position.x,.0275,position.z);
          body.aabbNeedsUpdate=true;
          this.freezeCoin(body,i);
        });
        this.render();this.running=false;this.frame=null;onSettled();
      }else this.frame=requestAnimationFrame(animate);
    };
    this.frame=requestAnimationFrame(animate);
  }
  stop(){if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;this.running=false;}
  randomRestingPositions(existing=[]){
    const positions=existing.map(position=>({x:position.x,z:position.z})),minDistance=.54,maxRadius=.54;
    for(let attempt=0;attempt<250&&positions.length<this.bodies.length;attempt++){
      const angle=Math.random()*Math.PI*2,radius=Math.sqrt(Math.random())*maxRadius;
      const position={x:Math.cos(angle)*radius,z:Math.sin(angle)*radius};
      if(positions.every(other=>Math.hypot(position.x-other.x,position.z-other.z)>=minDistance))positions.push(position);
    }
    if(positions.length<this.bodies.length){
      if(existing.length===0){
        positions.length=0;
        const offset=Math.random()*Math.PI*2,radius=.4;
        for(let i=0;i<this.bodies.length;i++){
          const angle=offset+i*Math.PI*2/this.bodies.length;
          positions.push({x:Math.cos(angle)*radius,z:Math.sin(angle)*radius});
        }
      }else{
        const offset=Math.random()*Math.PI*2;
        for(let step=0;step<720&&positions.length<this.bodies.length;step++){
          const angle=offset+step*Math.PI*2/720,radius=.4+(step%4)*.04;
          const position={x:Math.cos(angle)*radius,z:Math.sin(angle)*radius};
          if(positions.every(other=>Math.hypot(position.x-other.x,position.z-other.z)>=minDistance))positions.push(position);
        }
      }
    }
    return positions;
  }
  placeCoinsAtRest(){
    const positions=this.randomRestingPositions();
    this.bodies.forEach((body,i)=>{
      const p=positions[i];
      body.type=CANNON.Body.DYNAMIC;body.mass=.025;body.updateMassProperties();body.wakeUp();
      body.position.set(p.x,.0275,p.z);
      body.quaternion.setFromEuler(0,Math.random()*Math.PI*2,0);
      body.velocity.set(0,0,0);body.angularVelocity.set(0,0,0);
      body.aabbNeedsUpdate=true;
    });
  }
  containCoins(){
    this.bodies.forEach(body=>{
      const radius=Math.hypot(body.position.x,body.position.z);
      if(radius<=this.maxCoinCenterRadius)return;
      const nx=body.position.x/radius,nz=body.position.z/radius;
      body.position.x=nx*this.maxCoinCenterRadius;body.position.z=nz*this.maxCoinCenterRadius;
      const outwardVelocity=body.velocity.x*nx+body.velocity.z*nz;
      if(outwardVelocity>0){
        body.velocity.x-=outwardVelocity*1.3*nx;body.velocity.z-=outwardVelocity*1.3*nz;
      }
      body.aabbNeedsUpdate=true;
    });
  }
  freezeLandedCoins(descending){
    this.bodies.forEach((body,i)=>{
      if(this.landed.has(i))return;
      const touchingFloor=this.world.contacts.some(contact=>
        (contact.bi===body&&contact.bj===this.floor)||(contact.bj===body&&contact.bi===this.floor)
      );
      if(descending[i]&&touchingFloor){
        const position=this.findLandingPosition(i);
        body.position.set(position.x,.0275,position.z);
        body.aabbNeedsUpdate=true;
        this.freezeCoin(body,i);
      }
    });
  }
  findLandingPosition(index){
    const position=this.bodies[index].position,maxRadius=.54,minDistance=.37;
    const isAvailable=(x,z)=>Math.hypot(x,z)<=maxRadius&&this.bodies.every((body,i)=>
      i===index||!this.landed.has(i)||Math.hypot(x-body.position.x,z-body.position.z)>=minDistance
    );
    if(isAvailable(position.x,position.z))return {x:position.x,z:position.z};
    let best=null,bestDistance=Infinity;
    for(let x=-maxRadius;x<=maxRadius;x+=.01){
      for(let z=-maxRadius;z<=maxRadius;z+=.01){
        if(!isAvailable(x,z))continue;
        const distance=(x-position.x)**2+(z-position.z)**2;
        if(distance<bestDistance){best={x,z};bestDistance=distance;}
      }
    }
    if(!best)throw new Error('Unable to place landed coin without overlap');
    return best;
  }
  freezeCoin(body,i){
    body.position.y=.0275;
    body.quaternion.setFromEuler(0,Math.random()*Math.PI*2,0);
    body.velocity.set(0,0,0);body.angularVelocity.set(0,0,0);
    body.type=CANNON.Body.KINEMATIC;body.updateMassProperties();body.aabbNeedsUpdate=true;
    this.landed.add(i);
  }
  render(){
    const floorTop=this.floor.position.y+.04;
    const oldOpacity=this.camera.classList.contains('old')?.6:1;
    this.bodies.forEach((body,i)=>{
      const p=body.position,q=body.quaternion,s=this.scale;
      this.coins[i].style.transform='translate3d('+(p.x*s)+'px,'+(-p.y*s)+'px,'+(p.z*s)+'px) rotate3d('+(-q.x)+','+q.y+','+(-q.z)+','+(2*Math.acos(Math.max(-1,Math.min(1,q.w))))+'rad) rotateX(-90deg)';
      this.coins[i].style.opacity=String(oldOpacity);
      const height=Math.max(0,p.y-.04-floorTop);
      this.shadows[i].style.transform='translate3d('+(p.x*s)+'px,'+(-floorTop*s-.3)+'px,'+(p.z*s)+'px) rotateX(90deg) scale('+(1+height*.6)+')';
      this.shadows[i].style.opacity=.38/(1+height*3);
    });
  }
}
