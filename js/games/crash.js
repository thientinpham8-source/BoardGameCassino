'use strict';

const CRASH_BET_MS = 5000;
const CRASH_HISTORY_MAX = 16;

function crashRandomMultiplier(){
  const random = Math.random();
  if(random < 0.055) return 1;
  const multiplier = Math.max(1.01, (0.94 / (1 - random)));
  return Math.min(50, Math.floor(multiplier * 100) / 100);
}

function crashMaskName(name){
  const chars=Array.from(name);
  return chars.length>1?chars[0]+'***'+chars[chars.length-1]:chars[0]+'***';
}

class BalloonCrashTable {
  constructor(){
    this.name='Balloon'; this.id='CRASH-01'; this.players=38;
    this.phase='BETTING'; this.betLeft=CRASH_BET_MS/1000;
    this.user={BET:0}; this.cashed=false; this.cashoutMultiplier=null;
    this.multiplier=1; this.target=crashRandomMultiplier();
    this.history=[]; this.round=1000; this.fakeWinners=[];
    for(let i=0;i<8;i++) this.history.unshift({multiplier:crashRandomMultiplier()});
    this.seedFakeWinners();
    this.build(); this.renderHistory(); this.renderFakeWinners(); this.startBetting();
    this.playerTimer=setInterval(()=>this.fluctuatePlayers(),12000);
    this.fakeNameTimer=null;
  }
  build(){
    const el=document.createElement('section');
    el.className='table-card crash-table';
    el.setAttribute('aria-label','Balloon Crash');
    el.innerHTML=
      '<div class="card-head"><div class="card-title"><div class="title-row"><div class="t-name">Balloon Crash</div><div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="crash-player-count">'+this.players+'</span></div></div><div class="t-id">Balloon · <span class="crash-round">#1000</span></div></div><div class="crash-top-status"><span class="crash-status-dot"></span><span class="crash-status-text">Đang chờ cược</span></div></div>'+
      '<div class="felt crash-felt">'+
      '<div class="crash-history"></div>'+
      '<div class="crash-sky"><div class="crash-sky-background" aria-hidden="true"></div><div class="crash-cloud cloud-one"></div><div class="crash-cloud cloud-two"></div><div class="crash-stars"></div><canvas class="crash-canvas"></canvas>'+
      '<div class="crash-fake-cashouts" aria-live="polite"></div>'+
      '<div class="crash-multiplier">1.00×</div>'+
      '<div class="crash-balloon"><div class="balloon-glow"></div><img class="balloon-art" src="asset/ballon/colorful-hot-air-balloon-sky/khinhkhicau.png" alt="" draggable="false"></div>'+
      '<div class="crash-lightning" aria-hidden="true"><svg viewBox="0 0 80 400" preserveAspectRatio="none"><path class="bolt-main" d="m49 0-13 47 7 3-17 63 8 3-24 67 8 3-18 58 11 3-13 54 11 3-12 49 14 4-8 43 23-45-13-3 15-48-12-3 17-52-13-3 24-67-11-3 18-63-8-3L66 0Z"/><path class="bolt-branch" d="m35 121-15-13m27 90 19-17m-36 93-17 17"/></svg></div>'+
      '<div class="crash-explosion"></div>'+
      '</div></div>'+
      '<div class="crash-control-panel">'+
      '<div class="crash-bet-box"><div class="crash-bet-head"><span>Cược</span><strong class="crash-countdown">5s</strong></div><div class="crash-stake"><button type="button" class="crash-minus" aria-label="Giảm cược">−</button><strong class="crash-stake-value">10,000</strong><button type="button" class="crash-plus" aria-label="Tăng cược">＋</button></div><button type="button" class="crash-main-action">Đặt cược</button><div class="crash-bet-summary">Chưa đặt cược</div></div>'+
      '<div class="crash-info"><div class="crash-winners-section"><div class="sec-title">Người chơi thắng <span class="crash-virtual-label">ảo</span></div><div class="crash-winners" aria-label="Lịch sử người chơi thắng"></div></div><div class="crash-win-info"><span>Tiền thắng dự kiến</span><strong class="crash-potential">0.00</strong></div></div>'+
      '</div>'+
      '<div class="crash-round-footer"><div class="sec-title">Lịch sử ván</div><div class="crash-history-grid"></div></div>';
    document.getElementById('tables').appendChild(el);
    this.el=el;
    this.$sky=el.querySelector('.crash-sky');
    this.$canvas=el.querySelector('.crash-canvas');
    this.$ctx=this.$canvas.getContext('2d');
    this.$multiplier=el.querySelector('.crash-multiplier');
    this.$status=el.querySelector('.crash-status-text');
    this.$dot=el.querySelector('.crash-status-dot');
    this.$countdown=el.querySelector('.crash-countdown');
    this.$balloon=el.querySelector('.crash-balloon');
    this.$lightning=el.querySelector('.crash-lightning');
    this.$action=el.querySelector('.crash-main-action');
    this.$summary=el.querySelector('.crash-bet-summary');
    this.$potential=el.querySelector('.crash-potential');
    this.$stakeValue=el.querySelector('.crash-stake-value');
    this.$history=el.querySelector('.crash-history-grid');
    this.$winners=el.querySelector('.crash-winners');
    this.$round=el.querySelector('.crash-round');
    this.$players=el.querySelector('.crash-player-count');
    this.$fakeCashouts=el.querySelector('.crash-fake-cashouts');
    this.$explosion=el.querySelector('.crash-explosion');
    this.$action.addEventListener('click',()=>this.action());
    el.querySelector('.crash-plus').addEventListener('click',()=>{
      if(this.phase!=='BETTING'||this.user.BET>0)return;
      const chips=CFG.chips,index=CFG.chips.indexOf(selectedChip);
      if(index<chips.length-1)this.selectChip(chips[index+1]);
    });
    el.querySelector('.crash-minus').addEventListener('click',()=>{
      if(this.phase!=='BETTING'||this.user.BET>0)return;
      const index=CFG.chips.indexOf(selectedChip);
      if(index>0)this.selectChip(CFG.chips[index-1]);
    });
    document.querySelector('#chips').addEventListener('click',e=>{
      if(this.phase==='BETTING'&&!this.user.BET)this.updateStake();
    });
    this.resizeCanvas();
    window.addEventListener('resize',()=>this.resizeCanvas());
  }
  selectChip(value){
    selectedChip=value;
    document.querySelectorAll('#chips .chip').forEach(chip=>{
      const active=+chip.dataset.v===value;
      chip.classList.toggle('on',active);
      chip.setAttribute('aria-pressed',String(active));
    });
    this.updateStake();
  }
  updateStake(){ this.$stakeValue.textContent=fmtChips(selectedChip); }
  resizeCanvas(){
    const rect=this.$canvas.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    this.$canvas.width=Math.max(1,Math.floor(rect.width*dpr));
    this.$canvas.height=Math.max(1,Math.floor(rect.height*dpr));
    this.$ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  startBetting(){
    this.phase='BETTING'; this.betLeft=5; this.user.BET=0; this.cashed=false; this.cashoutMultiplier=null;
    this.multiplier=1; this.target=crashRandomMultiplier(); this.round++;
    this.$round.textContent='#'+this.round;
    if(this.$explosion)this.$explosion.innerHTML='';
    if(this.$fakeCashouts)this.$fakeCashouts.innerHTML='';
    this.$status.textContent='Đang chờ cược';
    this.$dot.className='crash-status-dot';
    this.$multiplier.className='crash-multiplier';
    this.$balloon.style.transform=''; this.$lightning.classList.remove('show');
    this.$lightning.style.left='';
    this.$lightning.style.right='';
    this.$lightning.style.top='';
    this.$lightning.style.height='';
    this.$action.disabled=false; this.$action.className='crash-main-action';
    this.$action.textContent='Đặt cược';
    this.$summary.textContent='Chưa đặt cược';
    this.$potential.textContent='0.00';
    this.updateStake(); this.draw(1);
    clearInterval(this.tickTimer);
    this.tickTimer=setInterval(()=>this.betTick(),1000);
  }
  betTick(){
    this.betLeft--;
    this.$countdown.textContent=this.betLeft+'s';
    if(this.betLeft<=0){ clearInterval(this.tickTimer); this.startFlying(); }
  }
  action(){
    if(this.phase==='BETTING'){
      if(this.user.BET>0){ toast('Bạn đã đặt cược cho vòng này'); return; }
      if(balance<selectedChip){ toast('Không đủ số dư'); return; }
      balance-=selectedChip; this.user.BET=selectedChip;
      rememberBetAction(this,'BET',selectedChip); setBalance();
      this.$action.textContent='Đã đặt cược';
      this.$action.disabled=true;
      this.$summary.textContent='Cược '+fmtMoney(selectedChip);
      this.$potential.textContent=fmtMoney(selectedChip*this.multiplier);
      return;
    }
    if(this.phase==='FLYING'&&this.user.BET>0&&!this.cashed){
      this.cashed=true; this.cashoutMultiplier=this.multiplier;
      const payout=this.user.BET*this.cashoutMultiplier;
      balance+=payout;
      setBalance(payout-this.user.BET>0?1:0);
      this.$action.textContent='Đã rút '+this.cashoutMultiplier.toFixed(2)+'×';
      this.$action.className='crash-main-action cashed';
      this.$action.disabled=true;
      this.$summary.textContent='Rút '+fmtMoney(payout);
      toast('Balloon: Bạn rút +'+fmtMoney(payout-this.user.BET));
    }
  }
  startFlying(){
    this.phase='FLYING'; this.flyStarted=performance.now();
    clearLastBetAction(this);
    this.$countdown.textContent='Bay';
    this.$status.textContent='Khí cầu đang bay';
    this.$dot.className='crash-status-dot flying';
    if(this.user.BET>0){
      this.$action.disabled=false;
      this.$action.className='crash-main-action cashout';
      this.$action.textContent='Rút tiền';
    }else{
      this.$action.disabled=true;
      this.$action.className='crash-main-action wait';
      this.$action.textContent='Chờ vòng sau';
    }
    this.startFakeCashouts();
    this.animationFrame=requestAnimationFrame(()=>this.fly());
  }
  startFakeCashouts(){
    clearTimeout(this.fakeNameTimer);
    const names=['AnKhang','Linh22','Dragon88','MinhT','LuckyVN','Hana','VIP_Mai','TuấnAnh','MoonCat','BaoBoss','NhiXinh','Ace_77'];
    const schedule=()=>{
      if(this.phase!=='FLYING')return;
      if(Math.random()<.82){
        const name=names[Math.floor(Math.random()*names.length)];
        const multiplier=this.multiplier;
        if(multiplier>=1.12){
          const amount=Math.round((5000+Math.random()*495000)/1000)*1000;
          this.addFakeCashout(name,multiplier,amount);
        }
      }
      this.fakeNameTimer=setTimeout(schedule,650+Math.random()*950);
    };
    schedule();
  }
  addFakeCashout(name,multiplier,amount){
    if(!this.$fakeCashouts)return;
    const item=document.createElement('div');
    item.className='fake-cashout';
    item.innerHTML='<span class="fake-name">'+crashMaskName(name)+'</span><strong>'+multiplier.toFixed(2)+'×</strong><b>+'+fmtChips(amount)+'</b>';
    const balloonRect=this.$balloon.getBoundingClientRect();
    const skyRect=this.el.querySelector('.crash-sky').getBoundingClientRect();
    const left=balloonRect.left-skyRect.left+balloonRect.width*.35+(Math.random()*22-11);
    const bottom=skyRect.bottom-balloonRect.bottom+balloonRect.height*.46;
    item.style.left=Math.max(8,Math.min(skyRect.width-132,left))+'px';
    item.style.bottom=Math.max(30,Math.min(skyRect.height-70,bottom))+'px';
    this.$fakeCashouts.appendChild(item);
    setTimeout(()=>item.remove(),1800);
    this.fakeWinners.unshift({name,multiplier,amount});
    if(this.fakeWinners.length>18)this.fakeWinners.pop();
    this.renderFakeWinners();
  }
  fly(){
    if(this.phase!=='FLYING')return;
    const elapsed=(performance.now()-this.flyStarted)/1000;
    this.multiplier=Math.min(this.target,Math.pow(1.15,elapsed));
    this.multiplier=Math.max(1,this.multiplier);
    this.draw(this.multiplier);
    this.$multiplier.textContent=this.multiplier.toFixed(2)+'×';
    if(this.user.BET>0&&!this.cashed){
      this.$potential.textContent=fmtMoney(this.user.BET*this.multiplier);
    }
    if(this.multiplier>=this.target){
      this.multiplier=this.target;
      this.crash();
      return;
    }
    this.animationFrame=requestAnimationFrame(()=>this.fly());
  }
  draw(multiplier){
    const canvas=this.$canvas,ctx=this.$ctx;
    if(!canvas||!ctx)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    ctx.save();
    ctx.strokeStyle='rgba(164,224,220,.18)';
    ctx.lineWidth=1;
    ctx.setLineDash([4,7]);
    ctx.beginPath();
    ctx.moveTo(18,h-18);
    for(let i=1;i<=26;i++){
      const x=18+(w-36)*(i/26);
      const progress=i/26;
      const y=h*.68;
      ctx.lineTo(x,y);
    }
    ctx.stroke(); ctx.restore();
    const progress=Math.min(1,Math.max(0,(multiplier-1)/Math.max(1,this.target-1)));
    const x=28+progress*Math.max(0,w-190);
    this.$balloon.style.left=x+'px';
    this.$balloon.style.bottom='28px';
  }
  crash(){
    cancelAnimationFrame(this.animationFrame);
    clearTimeout(this.fakeNameTimer);
    this.phase='CRASHED';
    this.$multiplier.textContent=this.target.toFixed(2)+'×';
    this.$multiplier.className='crash-multiplier crashed';
    this.$status.textContent='Khí cầu nổ ở '+this.target.toFixed(2)+'×';
    this.$dot.className='crash-status-dot crashed';
    this.$lightning.classList.add('show');
    this.$sky.classList.add('lightning-flash');
    setTimeout(()=>this.$sky.classList.remove('lightning-flash'),240);
    const balloonRect=this.$balloon.getBoundingClientRect();
    const skyRect=this.$sky.getBoundingClientRect();
    this.$lightning.style.right='auto';
    this.$lightning.style.left=(balloonRect.left-skyRect.left+balloonRect.width*.5-15)+'px';
    this.$lightning.style.top='0px';
    this.$lightning.style.height=Math.max(100,balloonRect.top-skyRect.top+balloonRect.height*.35)+'px';
    this.$balloon.classList.add('exploded');
    this.makeExplosion();
    this.$action.disabled=true;
    this.$action.textContent=this.cashed?'Đã rút tiền':'Không kịp rút';
    this.$action.className='crash-main-action crashed';
    if(this.user.BET>0&&!this.cashed){
      this.$summary.textContent='Nổ · mất '+fmtMoney(this.user.BET);
      toast('Balloon: Khí cầu nổ ở '+this.target.toFixed(2)+'×');
    }
    this.history.unshift({multiplier:this.target});
    if(this.history.length>CRASH_HISTORY_MAX)this.history.pop();
    this.renderHistory();
    clearLastBetAction(this);
    setTimeout(()=>{
      this.$balloon.classList.remove('exploded');
      this.startBetting();
    },4200);
  }
  makeExplosion(){
    if(!this.$explosion)return;
    const rect=this.$balloon.getBoundingClientRect();
    const skyRect=this.el.querySelector('.crash-sky').getBoundingClientRect();
    this.$explosion.innerHTML='';
    this.$explosion.style.left=(rect.left-skyRect.left+rect.width*.5)+'px';
    this.$explosion.style.top=(rect.top-skyRect.top+rect.height*.38)+'px';
    for(let i=0;i<26;i++){
      const particle=document.createElement('i');
      const angle=(Math.PI*2*i)/26+(Math.random()-.5)*.22;
      const distance=34+Math.random()*70;
      particle.style.setProperty('--dx',(Math.cos(angle)*distance)+'px');
      particle.style.setProperty('--dy',(Math.sin(angle)*distance)+'px');
      particle.style.setProperty('--color',i%4===0?'#fff3a3':i%3===0?'#ff7a45':'#ffb52e');
      this.$explosion.appendChild(particle);
    }
  }
  renderHistory(){
    this.$history.innerHTML=this.history.slice(0,12).map(item=>{
      const value=item.multiplier;
      const cls=value<2?'crash-low':value<10?'crash-mid':'crash-high';
      return '<span class="'+cls+'">'+value.toFixed(2)+'×</span>';
    }).join('');
  }
  seedFakeWinners(){
    const names=['Linh22','Dragon88','Hana','LuckyVN','TuấnAnh','BaoBoss'];
    this.fakeWinners=names.map(name=>({
      name,
      multiplier:1.15+Math.random()*5.4,
      amount:Math.round((18000+Math.random()*480000)/1000)*1000
    }));
  }
  renderFakeWinners(){
    if(!this.$winners)return;
    this.$winners.innerHTML=this.fakeWinners.slice(0,10).map(winner=>
      '<div class="crash-winner" title="'+crashMaskName(winner.name)+' · '+winner.multiplier.toFixed(2)+'×"><span>'+crashMaskName(winner.name)+'</span><small>'+winner.multiplier.toFixed(2)+'×</small><strong>+'+fmtChips(winner.amount)+'</strong></div>'
    ).join('');
  }
  fluctuatePlayers(){
    this.players=Math.max(20,Math.min(80,this.players+(Math.random()<.5?-1:1)));
    this.$players.textContent=String(this.players);
  }
}
