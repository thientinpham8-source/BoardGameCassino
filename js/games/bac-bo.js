'use strict';

class BacBoTable {
  constructor(cfg){
    Object.assign(this,cfg);
    this.phase='BETTING'; this.tLeft=CFG.betTime; this.firstBet=Math.floor(Math.random()*8);
    this.resLeft=CFG.resultTime; this.values=[null,null,null,null]; this.lastRes=null;
    this.user={}; this.bots={}; this.timers=[]; this.hist=Array.from({length:60+Math.floor(Math.random()*33)},()=>{
      return bbAnalyze(Array.from({length:4},()=>1+Math.floor(Math.random()*6)));
    });
    this.build();
    this.simulations=[...this.el.querySelectorAll('.bb-cup .glass-stage')].map((stage,index)=>
      new GlassDiceSimulation(stage,1,index%2===0?6:4,false));
    this.startBetting();
    setInterval(()=>this.fluctuate(),15000);
  }
  schedule(fn,ms){this.timers.push(setTimeout(fn,ms));}
  clearTimers(){this.timers.forEach(clearTimeout);this.timers=[];}
  build(){
    const el=document.createElement('section');
    el.className='table-card bb-table'; el.setAttribute('aria-label',this.name);
    const cup=(side,index)=>'<div class="bb-cup"><div class="glass-stage" role="img" aria-label="Lồng kính '+side+', xúc xắc '+(index%2+1)+'"><div class="glass-shell"><div class="glass-rear"></div></div>'+
      '<div class="glass-base"></div><div class="glass-shell bb-back-rim"><div class="glass-rim bottom"></div></div><div class="glass-camera"></div><div class="glass-shell glass-front"><div class="glass-rim top"></div></div></div><div class="bb-cup-result" hidden></div></div>';
    el.innerHTML='<div class="card-head"><div class="card-title"><div class="title-row"><div class="t-name">'+this.name+'</div>'+
      '<div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 0 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="p-count">'+this.players+'</span></div></div><div class="t-id"># '+this.id+'</div></div></div>'+
      '<div class="felt"><div class="f-status"></div><div class="bb-arena">'+
      '<section class="bb-side banker"><div class="bb-side-head">BANKER <span class="bb-side-score" data-score="B">–</span></div><div class="bb-cups">'+cup('Banker',0)+cup('Banker',1)+'</div></section>'+
      '<section class="bb-side player"><div class="bb-side-head">PLAYER <span class="bb-side-score" data-score="P">–</span></div><div class="bb-cups">'+cup('Player',2)+cup('Player',3)+'</div></section>'+
      '</div></div><div class="bet-wrap bb-bet-wrap">'+
      '<div class="bb-bet-section"><div class="bb-bet-title">Kết quả ván</div><div class="bet-grid bb-bet-grid bb-main-bets"></div></div>'+
      '<div class="bb-side-bet-groups">'+
      '<div class="bb-bet-section bb-side-bet-section bb-banker-bet-section"><div class="bb-bet-title">Banker · tổng 2 viên</div><div class="bet-grid bb-bet-grid bb-side-bets" data-group="B"></div></div>'+
      '<div class="bb-bet-section bb-side-bet-section bb-player-bet-section"><div class="bb-bet-title">Player · tổng 2 viên</div><div class="bet-grid bb-bet-grid bb-side-bets" data-group="P"></div></div></div></div>'+
      '<div class="stats"><div class="sec-title">Kết quả 100 ván trước</div><div class="road bb-road"></div><div class="summary"></div></div>';
    document.getElementById('tables').appendChild(el);
    this.el=el; this.$status=el.querySelector('.f-status');
    this.$betWrap=el.querySelector('.bb-bet-wrap'); this.$mainBets=el.querySelector('.bb-main-bets');
    this.$bankerBets=el.querySelector('[data-group="B"]'); this.$playerBets=el.querySelector('[data-group="P"]');
    this.$road=el.querySelector('.bb-road'); this.$summary=el.querySelector('.summary');
    this.$betWrap.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)this.placeBet(b.dataset.k);});
  }
  startBetting(){
    this.clearTimers(); this.phase='BETTING'; this.tLeft=CFG.betTime-this.firstBet; this.firstBet=0;
    this.user={}; this.bots={}; this.$betWrap.classList.remove('locked'); this.renderAll();
    for(let i=0;i<this.players;i++)this.schedule(()=>{if(this.phase==='BETTING')this.botBet();},Math.random()*6000);
    this.tick();
  }
  tick(){
    if(this.phase!=='BETTING')return;
    if(this.tLeft<=0){this.lock();return;}
    this.renderStatus(); this.schedule(()=>{this.tLeft--;this.tick();},1000);
  }
  botBet(){
    const k=BB_OPTS[Math.floor(Math.random()*BB_OPTS.length)].k;
    this.bots[k]=(this.bots[k]||0)+(1+Math.floor(Math.random()*20))*1_000_000;
    this.renderBets();
  }
  fluctuate(){
    if(this.phase!=='BETTING')return;
    this.players=Math.max(6,Math.min(60,this.players+(Math.random()<.5?-1:1)));
    this.el.querySelector('.p-count').textContent=this.players;
  }
  placeBet(k){
    if(this.phase!=='BETTING')return;
    if(balance<selectedChip){toast('Không đủ số dư');return;}
    balance-=selectedChip; this.user[k]=(this.user[k]||0)+selectedChip;
    rememberBetAction(this,k,selectedChip);
    setBalance(); this.renderBets();
  }
  lock(){
    clearLastBetAction(this);
    this.clearTimers(); this.phase='SHAKING'; this.values=[null,null,null,null]; this.finishedDice=0;
    this.$betWrap.classList.add('locked'); this.renderBets(); this.renderStatus(); this.renderScores();
    this.simulations.forEach((sim,index)=>sim.start(values=>{
      if(this.phase!=='SHAKING')return;
      this.values[index]=values[0]; this.finishedDice++; this.renderScores();
      if(this.finishedDice===this.simulations.length)this.finish();
    },()=>{}));
  }
  finish(){
    this.lastRes=bbAnalyze(this.values); this.phase='RESULT'; this.resLeft=CFG.resultTime;
    let profit=0;
    for(const k in this.user){
      const m=bbMult(k,this.lastRes);
      if(m>0){balance+=this.user[k]*(1+m);profit+=this.user[k]*m;}
    }
    setBalance(profit>0?1:0);
    this.hist.unshift(this.lastRes); if(this.hist.length>110)this.hist.pop();
    this.$betWrap.classList.add('locked'); this.renderAll();
    if(profit>0)toast(this.name+': Bạn thắng +'+fmtMoney(profit));
    this.resultTick();
  }
  resultTick(){
    if(this.phase!=='RESULT')return;
    if(this.resLeft<=0){this.startBetting();return;}
    this.renderStatus(); this.schedule(()=>{this.resLeft--;this.resultTick();},1000);
  }
  renderStatus(){
    if(this.phase==='BETTING')this.$status.textContent='Đặt cược — còn '+this.tLeft+'s';
    else if(this.phase==='SHAKING')this.$status.textContent='Đang lắc xúc xắc…';
    else{
      const r=this.lastRes, name=r.winner==='B'?'Banker thắng':r.winner==='P'?'Player thắng':'Hòa';
      this.$status.innerHTML='<span class="f-result '+(r.winner==='B'?'rb':r.winner==='P'?'rp':'rt')+'">'+name+'</span> · Banker '+r.bankerTotal+' – '+r.playerTotal+' Player · Ván mới sau '+this.resLeft+'s';
    }
  }
  renderScores(){
    this.el.querySelectorAll('.bb-cup-result').forEach((el,index)=>{
      const value=this.values[index]; el.hidden=value===null; el.innerHTML=value===null?'':bbResultDieHtml(value,index%2);
    });
    const banker=this.values[0]===null||this.values[1]===null?'–':this.values[0]+this.values[1];
    const player=this.values[2]===null||this.values[3]===null?'–':this.values[2]+this.values[3];
    this.el.querySelector('[data-score="B"]').textContent=banker;
    this.el.querySelector('[data-score="P"]').textContent=player;
  }
  renderBets(){
    const renderGroup=(group,target)=>{target.innerHTML=BB_OPTS.filter(o=>o.group===group).map(o=>{
      const state=this.phase==='RESULT'?(bbMult(o.k,this.lastRes)>0?' win':' lose'):'';
      const user=this.user[o.k]||0, bots=this.bots[o.k]||0;
      const label=o.group==='main'?o.n:(o.group==='B'?'Banker':'Player')+' '+o.n.toLowerCase();
      return '<button type="button" class="betbtn'+state+'" data-k="'+o.k+'" aria-label="Cược '+label+', trả '+o.o+' lần vốn"><span class="b-name">'+o.n+'</span><span class="b-odds">'+o.o+'</span>'+
        (user?'<span class="b-user">'+fmtChips(user)+'</span>':'')+(bots?'<span class="b-total">'+fmtChips(bots)+'</span>':'')+'</button>';
    }).join('');};
    renderGroup('main',this.$mainBets); renderGroup('B',this.$bankerBets); renderGroup('P',this.$playerBets);
  }
  renderStats(){
    const history=this.hist.slice(0,100);
    this.$road.classList.add('big');
    this.$road.innerHTML=renderBigRoad(history.slice().reverse().map(r=>({w:r.winner,label:r.winner==='B'?'Banker':r.winner==='P'?'Player':'Hòa'})));
    this.$road.scrollLeft=this.$road.scrollWidth;
    this.$summary.textContent='Banker '+history.filter(r=>r.winner==='B').length+' · Player '+history.filter(r=>r.winner==='P').length+' · Hòa '+history.filter(r=>r.winner==='T').length;
  }
  renderAll(){
    this.renderStatus(); this.renderBets(); this.renderScores(); this.renderStats();
  }
}
