'use strict';

const CRASH_BET_MS = 5000;
const CRASH_HISTORY_MAX = 16;
const CRASH_BET_KEYS = ['BET1', 'BET2'];

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
    this.user={BET1:0,BET2:0}; this.cashed={BET1:false,BET2:false}; this.cashoutMultiplier={BET1:null,BET2:null};
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
      '<div class="crash-winner-ticker" aria-live="polite"></div><div class="crash-highest-toggle"><button type="button" class="crash-highest-button" aria-label="Xem người thắng cao nhất" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v2h4v4a5 5 0 0 1-5 5h-.3A5 5 0 0 1 13 16v2h4v2H7v-2h4v-2a5 5 0 0 1-2.7-2H8a5 5 0 0 1-5-5V5h4V3zm10 4v5a3 3 0 0 0 2-3V7h-2zM5 7v2a3 3 0 0 0 2 3V7H5z"/></svg></button><div class="crash-highest-winner" hidden></div></div><div class="crash-fake-cashouts" aria-live="polite"></div>'+
      '<div class="crash-multiplier">×1.00</div>'+
      '<div class="crash-balloon"><div class="balloon-glow"></div><img class="balloon-art" src="asset/ballon/colorful-hot-air-balloon-sky/khinhkhicau.png" alt="" draggable="false"></div>'+
      '<div class="crash-lightning" aria-hidden="true"><svg viewBox="0 0 80 400" preserveAspectRatio="none"><path class="bolt-main" d="m49 0-13 47 7 3-17 63 8 3-24 67 8 3-18 58 11 3-13 54 11 3-12 49 14 4-8 43 23-45-13-3 15-48-12-3 17-52-13-3 24-67-11-3 18-63-8-3L66 0Z"/><path class="bolt-branch" d="m35 121-15-13m27 90 19-17m-36 93-17 17"/></svg></div>'+
      '<div class="crash-explosion"></div>'+
      '</div></div>'+
      '<div class="crash-control-panel">'+
      '<div class="crash-bet-box" data-bet-key="BET1"><div class="crash-bet-head"><span>Cược 1</span><strong class="crash-countdown">5s</strong></div><div class="crash-stake"><button type="button" class="crash-minus" aria-label="Giảm cược 1">−</button><strong class="crash-stake-value">10,000</strong><button type="button" class="crash-plus" aria-label="Tăng cược 1">＋</button></div><button type="button" class="crash-main-action">Đặt cược</button><div class="crash-bet-summary">Chưa đặt cược</div><div class="crash-potential">0.00</div></div>'+
      '<div class="crash-bet-box" data-bet-key="BET2"><div class="crash-bet-head"><span>Cược 2</span><strong class="crash-countdown">5s</strong></div><div class="crash-stake"><button type="button" class="crash-minus" aria-label="Giảm cược 2">−</button><strong class="crash-stake-value">10,000</strong><button type="button" class="crash-plus" aria-label="Tăng cược 2">＋</button></div><button type="button" class="crash-main-action">Đặt cược</button><div class="crash-bet-summary">Chưa đặt cược</div><div class="crash-potential">0.00</div></div>'+
      '</div>'+
      '<div class="crash-round-footer"><div class="sec-title">Lịch sử ván</div><div class="crash-history-grid"></div></div>';
    document.getElementById('tables').appendChild(el);
    this.el=el;
    this.$sky=el.querySelector('.crash-sky');
    this.$skyBackground=el.querySelector('.crash-sky-background');
    this.$canvas=el.querySelector('.crash-canvas');
    this.$ctx=this.$canvas.getContext('2d');
    this.$multiplier=el.querySelector('.crash-multiplier');
    this.$status=el.querySelector('.crash-status-text');
    this.$dot=el.querySelector('.crash-status-dot');
    this.$countdowns=el.querySelectorAll('.crash-countdown');
    this.$balloon=el.querySelector('.crash-balloon');
    this.$lightning=el.querySelector('.crash-lightning');
    this.$betBoxes=Array.from(el.querySelectorAll('.crash-bet-box'));
    this.$actions=this.$betBoxes.map(box=>box.querySelector('.crash-main-action'));
    this.$summaries=this.$betBoxes.map(box=>box.querySelector('.crash-bet-summary'));
    this.$potentials=this.$betBoxes.map(box=>box.querySelector('.crash-potential'));
    this.$stakeValues=this.$betBoxes.map(box=>box.querySelector('.crash-stake-value'));
    this.$history=el.querySelector('.crash-history-grid');
    this.$winnerTicker=el.querySelector('.crash-winner-ticker');
    this.$highestWinnerButton=el.querySelector('.crash-highest-button');
    this.$highestWinner=el.querySelector('.crash-highest-winner');
    this.$round=el.querySelector('.crash-round');
    this.$players=el.querySelector('.crash-player-count');
    this.$fakeCashouts=el.querySelector('.crash-fake-cashouts');
    this.$explosion=el.querySelector('.crash-explosion');
    this.$highestWinnerButton.addEventListener('click',()=>{
      const expanded=this.$highestWinner.hidden;
      this.$highestWinner.hidden=!expanded;
      this.$highestWinnerButton.setAttribute('aria-expanded',String(expanded));
    });
    this.$betBoxes.forEach((box,index)=>{
      const key=CRASH_BET_KEYS[index];
      box.querySelector('.crash-main-action').addEventListener('click',()=>this.action(key));
      box.querySelector('.crash-plus').addEventListener('click',()=>{
        if(this.phase!=='BETTING'||this.user[key]>0)return;
        const chips=CFG.chips,chipIndex=chips.indexOf(selectedChip);
        if(chipIndex<chips.length-1)this.selectChip(chips[chipIndex+1]);
      });
      box.querySelector('.crash-minus').addEventListener('click',()=>{
        if(this.phase!=='BETTING'||this.user[key]>0)return;
        const chips=CFG.chips,chipIndex=chips.indexOf(selectedChip);
        if(chipIndex>0)this.selectChip(chips[chipIndex-1]);
      });
    });
    document.querySelector('#chips').addEventListener('click',e=>{
      if(this.phase==='BETTING'&&CRASH_BET_KEYS.some(key=>!this.user[key]))this.updateStake();
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
  updateStake(){
    this.$stakeValues.forEach((el,index)=>{
      const amount=this.user[CRASH_BET_KEYS[index]]||selectedChip;
      el.textContent=fmtChips(amount);
    });
  }
  resizeCanvas(){
    const rect=this.$canvas.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    this.$canvas.width=Math.max(1,Math.floor(rect.width*dpr));
    this.$canvas.height=Math.max(1,Math.floor(rect.height*dpr));
    this.$ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  startBetting(){
    clearInterval(this.nextRoundTimer);
    this.$sky.classList.remove('camera-following');
    this.$sky.style.removeProperty('--camera-shift');
    this.$skyBackground.style.backgroundPosition='';
    this.phase='BETTING'; this.betLeft=5; this.user={BET1:0,BET2:0}; this.cashed={BET1:false,BET2:false}; this.cashoutMultiplier={BET1:null,BET2:null};
    this.multiplier=1; this.target=crashRandomMultiplier(); this.round++;
    this.$round.textContent='#'+this.round;
    if(this.$explosion)this.$explosion.innerHTML='';
    if(this.$fakeCashouts)this.$fakeCashouts.innerHTML='';
    this.$status.textContent='Đang chờ cược';
    this.$dot.className='crash-status-dot';
    this.$multiplier.className='crash-multiplier';
    this.$multiplier.textContent='×1.00';
    this.$balloon.style.transform=''; this.$lightning.classList.remove('show');
    this.$lightning.style.left='';
    this.$lightning.style.right='';
    this.$lightning.style.top='';
    this.$lightning.style.height='';
    this.$actions.forEach((action,index)=>{
      this.$countdowns[index].textContent='5s';
      action.disabled=false; action.className='crash-main-action'; action.textContent='Đặt cược';
      this.$summaries[index].textContent='Chưa đặt cược';
      this.$potentials[index].textContent='0.00';
    });
    this.updateStake(); this.draw(1);
    clearInterval(this.tickTimer);
    this.tickTimer=setInterval(()=>this.betTick(),1000);
  }
  betTick(){
    this.betLeft--;
    this.$countdowns.forEach(countdown=>countdown.textContent=this.betLeft+'s');
    if(this.betLeft<=0){ clearInterval(this.tickTimer); this.startFlying(); }
  }
  action(key){
    const index=CRASH_BET_KEYS.indexOf(key);
    const action=this.$actions[index],summary=this.$summaries[index],potential=this.$potentials[index];
    if(this.phase==='BETTING'){
      if(this.user[key]>0){ toast('Bạn đã đặt cược cho khung này'); return; }
      if(balance<selectedChip){ toast('Không đủ số dư'); return; }
      balance-=selectedChip; this.user[key]=selectedChip;
      rememberBetAction(this,key,selectedChip); setBalance();
      this.updateStake();
      action.textContent='Đã đặt cược';
      action.disabled=true;
      summary.textContent='Cược '+fmtMoney(selectedChip);
      potential.textContent=fmtMoney(selectedChip*this.multiplier);
      return;
    }
    if(this.phase==='FLYING'&&this.user[key]>0&&!this.cashed[key]){
      this.cashed[key]=true; this.cashoutMultiplier[key]=this.multiplier;
      const payout=this.user[key]*this.cashoutMultiplier[key];
      balance+=payout;
      setBalance(payout-this.user[key]>0?1:0);
      action.textContent='Đã rút ×'+this.cashoutMultiplier[key].toFixed(2);
      action.className='crash-main-action cashed';
      action.disabled=true;
      summary.textContent='Rút '+fmtMoney(payout);
      toast('Balloon: Bạn rút +'+fmtMoney(payout-this.user[key]));
    }
  }
  renderBets(){
    this.$betBoxes.forEach((box,index)=>{
      const key=CRASH_BET_KEYS[index],amount=this.user[key]||0;
      this.$stakeValues[index].textContent=fmtChips(amount||selectedChip);
      if(this.phase==='BETTING'){
        this.$actions[index].disabled=amount>0;
        this.$actions[index].className='crash-main-action';
        this.$actions[index].textContent=amount?'Đã đặt cược':'Đặt cược';
        this.$summaries[index].textContent=amount?'Cược '+fmtMoney(amount):'Chưa đặt cược';
        this.$potentials[index].textContent=fmtMoney(amount*this.multiplier);
      }
    });
  }
  startFlying(){
    this.phase='FLYING'; this.flyStarted=performance.now();
    this.$sky.classList.add('camera-following');
    this.$sky.style.setProperty('--camera-shift','0px');
    this.$skyBackground.style.backgroundPosition='0% 50%';
    clearLastBetAction(this);
    this.$countdowns.forEach(countdown=>countdown.textContent='Bay');
    this.$status.textContent='Khí cầu đang bay';
    this.$dot.className='crash-status-dot flying';
    this.$actions.forEach((action,index)=>{
      const key=CRASH_BET_KEYS[index];
      if(this.user[key]>0){
        action.disabled=this.cashed[key];
        action.className='crash-main-action '+(this.cashed[key]?'cashed':'cashout');
        if(!this.cashed[key])action.textContent='Rút tiền';
      }else{
        action.disabled=true; action.className='crash-main-action wait'; action.textContent='Chờ vòng sau';
      }
    });
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
    item.innerHTML='<span class="fake-name">'+crashMaskName(name)+'</span><strong>×'+multiplier.toFixed(2)+'</strong><b>+'+fmtChips(amount)+'</b>';
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
    this.renderFakeWinners({name,multiplier,amount});
  }
  fly(){
    if(this.phase!=='FLYING')return;
    const elapsed=(performance.now()-this.flyStarted)/1000;
    this.multiplier=Math.min(this.target,Math.pow(1.18,elapsed));
    this.multiplier=Math.max(1,this.multiplier);
    this.draw(this.multiplier);
    this.$multiplier.textContent='×'+this.multiplier.toFixed(2);
    this.$potentials.forEach((potential,index)=>{
      const key=CRASH_BET_KEYS[index];
      if(this.user[key]>0&&!this.cashed[key])potential.textContent=fmtMoney(this.user[key]*this.multiplier);
    });
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
    const centerX=Math.max(28,Math.min(w-140,(w-112)/2));
    const followStart=.35;
    const cameraProgress=Math.min(1,Math.max(0,(progress-followStart)/(1-followStart)));
    const x=progress<followStart?28+(centerX-28)*(progress/followStart):centerX;
    this.$skyBackground.style.backgroundPosition=(cameraProgress*100)+'% 50%';
    this.$sky.style.setProperty('--camera-shift',(-w*.5*cameraProgress)+'px');
    this.$balloon.style.left=x+'px';
    this.$balloon.style.bottom='28px';
  }
  crash(){
    cancelAnimationFrame(this.animationFrame);
    clearTimeout(this.fakeNameTimer);
    this.phase='CRASHED';
    this.$multiplier.textContent='×'+this.target.toFixed(2);
    this.$multiplier.className='crash-multiplier crashed';
    this.$status.textContent='Khí cầu nổ ở ×'+this.target.toFixed(2);
    this.$dot.className='crash-status-dot crashed';
    this.$lightning.classList.add('show');
    this.$sky.classList.add('lightning-flash');
    setTimeout(()=>this.$sky.classList.remove('lightning-flash'),240);
    const balloonRect=this.$balloon.getBoundingClientRect();
    const skyRect=this.$sky.getBoundingClientRect();
    this.$lightning.style.right='auto';
    this.$lightning.style.left=(balloonRect.left-skyRect.left+balloonRect.width*.5-9)+'px';
    this.$lightning.style.top='0px';
    this.$lightning.style.height=Math.max(140,balloonRect.top-skyRect.top+balloonRect.height*.65)+'px';
    this.$balloon.classList.add('exploded');
    this.makeExplosion();
    let lostBet=false;
    this.$actions.forEach((action,index)=>{
      const key=CRASH_BET_KEYS[index];
      action.disabled=true;
      action.textContent=this.cashed[key]?'Đã rút tiền':'Không kịp rút';
      action.className='crash-main-action '+(this.cashed[key]?'cashed':'crashed');
      if(this.user[key]>0&&!this.cashed[key]){
        this.$summaries[index].textContent='Nổ · mất '+fmtMoney(this.user[key]);
        lostBet=true;
      }
    });
    if(lostBet)toast('Balloon: Khí cầu nổ ở ×'+this.target.toFixed(2));
    this.history.unshift({multiplier:this.target});
    if(this.history.length>CRASH_HISTORY_MAX)this.history.pop();
    this.renderHistory();
    this.addFailedPlayers();
    clearLastBetAction(this);
    this.startNextRoundCountdown();
  }
  startNextRoundCountdown(){
    let seconds=5;
    const renderCountdown=()=>{
      this.$status.textContent='Ván mới sau '+seconds+'s';
      this.$countdowns.forEach(countdown=>countdown.textContent=seconds+'s');
      this.$multiplier.className='crash-multiplier next-round';
      this.$multiplier.textContent=seconds+'s';
    };
    renderCountdown();
    clearInterval(this.nextRoundTimer);
    this.nextRoundTimer=setInterval(()=>{
      seconds--;
      if(seconds<=0){
        clearInterval(this.nextRoundTimer);
        this.nextRoundTimer=null;
        this.$balloon.classList.remove('exploded');
        this.startBetting();
        return;
      }
      renderCountdown();
    },1000);
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
      if(i%3===0){
        particle.classList.add('spark');
        particle.style.setProperty('--angle',(Math.random()*360)+'deg');
      }
      const angle=(Math.PI*2*i)/26+(Math.random()-.5)*.22;
      const distance=particle.classList.contains('spark')?52+Math.random()*76:34+Math.random()*70;
      particle.style.setProperty('--dx',(Math.cos(angle)*distance)+'px');
      particle.style.setProperty('--dy',(Math.sin(angle)*distance)+'px');
      particle.style.setProperty('--color',particle.classList.contains('spark')?'#fff3a3':i%3===0?'#ff7a45':'#ffb52e');
      this.$explosion.appendChild(particle);
    }
  }
  renderHistory(){
    this.$history.innerHTML=this.history.slice(0,12).map((item,index)=>{
      const value=item.multiplier;
      const cls=value<2?'crash-low':value<10?'crash-mid':'crash-high';
      const row=index<6?2:1;
      const column=index<6?index+1:12-index;
      return '<span class="'+cls+'" style="grid-row:'+row+';grid-column:'+column+'">×'+value.toFixed(2)+'</span>';
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
  renderFakeWinners(newWinner){
    if(!this.$winnerTicker)return;
    if(!this.$winnerTickerList){
      this.$winnerTicker.innerHTML='<strong class="crash-ticker-title">Người chơi</strong><div class="crash-ticker-window"><div class="crash-ticker-track"><div class="crash-ticker-list"></div><div class="crash-ticker-list" aria-hidden="true"></div></div></div>';
      this.$tickerLists=Array.from(this.$winnerTicker.querySelectorAll('.crash-ticker-list'));
      this.tickerEntries=this.fakeWinners.slice(0,4).reverse();
      this.$tickerRows=this.$tickerLists.map(list=>this.tickerEntries.map(winner=>{
        const row=document.createElement('div');
        row.className='crash-ticker-entry';
        this.renderWinnerTickerRow(row,winner);
        list.appendChild(row);
        return row;
      }));
      this.highestWinner=this.fakeWinners.reduce((highest,winner)=>!highest||winner.amount>highest.amount?winner:highest,null);
      this.renderHighestWinner();
      return;
    }
    if(!newWinner)return;
    this.tickerEntries.shift();
    this.tickerEntries.push(newWinner);
    this.$tickerRows.forEach(rows=>rows.forEach((row,index)=>this.renderWinnerTickerRow(row,this.tickerEntries[index])));
    if(!newWinner.crashed&&newWinner.amount>this.highestWinner.amount){
      this.highestWinner=newWinner;
      this.renderHighestWinner();
    }
  }
  addFailedPlayers(){
    const names=['AnKhang','Linh22','MinhT','LuckyVN','Hana','TuấnAnh','MoonCat','BaoBoss','NhiXinh','Ace_77'];
    for(let i=names.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [names[i],names[j]]=[names[j],names[i]];
    }
    names.slice(0,3).forEach(name=>this.renderFakeWinners({name,crashed:true}));
  }
  renderWinnerTickerRow(row,winner){
    row.classList.toggle('crash-loser',!!winner.crashed);
    if(winner.crashed){
      row.innerHTML='<span>'+crashMaskName(winner.name)+'</span><b>NỔ</b><strong>Chưa rút</strong>';
      return;
    }
    row.innerHTML='<span>'+crashMaskName(winner.name)+'</span><b>×'+winner.multiplier.toFixed(2)+'</b><strong>+'+fmtChips(winner.amount)+'</strong>';
  }
  renderHighestWinner(){
    const winner=this.highestWinner;
    if(!winner||!this.$highestWinner)return;
    this.$highestWinner.innerHTML='<strong class="crash-highest-title">Thắng cao nhất</strong><div class="crash-highest-entry"><span>'+crashMaskName(winner.name)+'</span><b>×'+winner.multiplier.toFixed(2)+'</b><strong>+'+fmtChips(winner.amount)+'</strong></div>';
  }
  fluctuatePlayers(){
    this.players=Math.max(20,Math.min(80,this.players+(Math.random()<.5?-1:1)));
    this.$players.textContent=String(this.players);
  }
}
