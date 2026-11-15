'use strict';

class FantanTable{
  constructor(cfg){
    Object.assign(this,cfg);
    this.phase='BETTING';this.tLeft=CFG.betTime;this.firstBet=Math.floor(Math.random()*8);
    this.resLeft=CFG.resultTime;this.user={};this.bots={};this.timers=[];
    this.lastResult=null;
    this.hist=Array.from({length:60+Math.floor(Math.random()*33)},()=>ftAnalyze(txRoll()).result);
    this.build();this.sim=new GlassDiceSimulation(this.el.querySelector('.glass-stage'),3,GLASS_SHAKE_DURATION,false);startTableWithRandomPhase(this);
    setInterval(()=>this.fluctuate(),15000);
  }
  schedule(fn,ms){this.timers.push(setTimeout(fn,ms));}
  clearTimers(){this.timers.forEach(clearTimeout);this.timers=[];}
  build(){
    const el=document.createElement('section');
    el.className='table-card ft';el.setAttribute('aria-label',this.name);
    el.innerHTML='<div class="card-head"><div class="card-title"><div class="title-row"><div class="t-name">'+this.name+'</div><div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 0 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="p-count">'+this.players+'</span></div></div><div class="t-id"># '+this.id+'</div></div></div>'+
      '<div class="felt"><div class="f-status"></div><div class="ft-stage waiting" aria-label="Ba viên xúc xắc Fantan">'+
      '<div class="ft-glass-wrap"><div class="glass-stage" aria-label="Ống thủy tinh với ba xúc xắc">'+
      '<div class="glass-shell"><div class="glass-rear"></div></div><div class="glass-base"></div><div class="glass-camera"></div>'+
      '<div class="glass-shell glass-front"><div class="glass-rim top"></div><div class="glass-rim bottom"></div></div></div></div>'+
      '<div class="ft-roll-info" aria-live="polite"><span class="ft-roll-total">Tổng xúc xắc: <strong class="ft-total-value">—</strong></span>'+
      '<span class="ft-roll-separator" aria-hidden="true">·</span><span class="ft-result-label">Kết quả Fantan</span><strong class="ft-result-value">—</strong></div></div></div>'+
      '<div class="bet-wrap"><div class="bet-grid ft-bets"></div><div class="sec-title ft-side-title">Cửa cược phụ</div><div class="ft-side-bets"></div>'+
      '<div class="sec-title ft-triple-title">Bộ ba (3/4 kết quả)</div><div class="ft-triple-bets"></div></div>'+
      '<div class="stats"><div class="sec-title">Kết quả 100 ván trước</div><div class="road ft-road"></div><div class="summary"></div></div>';
    document.getElementById('tables').appendChild(el);this.el=el;
    this.$status=el.querySelector('.f-status');this.$badge=el.querySelector('.pbadge');
    this.$stage=el.querySelector('.ft-stage');
    this.$total=el.querySelector('.ft-total-value');
    this.$result=el.querySelector('.ft-result-value');
    this.$betWrap=el.querySelector('.bet-wrap');this.$bets=el.querySelector('.ft-bets');
    this.$sideBets=el.querySelector('.ft-side-bets');
    this.$tripleBets=el.querySelector('.ft-triple-bets');
    this.$road=el.querySelector('.ft-road');this.$summary=el.querySelector('.summary');
    this.$betWrap.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)this.placeBet(b.dataset.k);});
  }
  startBetting(){
    this.clearTimers();this.phase='BETTING';this.tLeft=CFG.betTime-this.firstBet;this.firstBet=0;
    this.user={};this.bots={};
    this.$betWrap.classList.remove('locked');
    this.$stage.classList.remove('rolling');this.$stage.classList.toggle('waiting',!this.lastResult);
    this.renderAll();
    for(let i=0;i<this.players;i++)this.schedule(()=>{if(this.phase==='BETTING')this.botBet();},Math.random()*6000);
    this.tick();
  }
  tick(){
    if(this.phase!=='BETTING')return;
    if(this.tLeft<=0){this.lock();return;}
    this.renderStatus();this.schedule(()=>{this.tLeft--;this.tick();},1000);
  }
  botBet(){
    const k=FT_OPTS[Math.floor(Math.random()*FT_OPTS.length)].k;
    this.bots[k]=(this.bots[k]||0)+(1+Math.floor(Math.random()*20))*1_000_000;this.renderBets();
  }
  fluctuate(){
    if(this.phase!=='BETTING')return;
    this.players=Math.max(6,Math.min(60,this.players+(Math.random()<.5?-1:1)));
    this.$badge.querySelector('.p-count').textContent=this.players;
  }
  placeBet(k){
    if(this.phase!=='BETTING')return;
    if(balance<selectedChip){toast('Không đủ số dư');return;}
    balance-=selectedChip;this.user[k]=(this.user[k]||0)+selectedChip;setBalance();this.renderBets();
    rememberBetAction(this,k,selectedChip);
  }
  lock(){
    clearLastBetAction(this);
    this.clearTimers();this.phase='SHAKING';this.$betWrap.classList.add('locked');
    this.$stage.classList.remove('waiting');this.$stage.classList.add('rolling');
    this.renderAll();
    this.sim.start(dice=>this.finish(dice),()=>this.renderStatus());
  }
  finish(dice){
    if(this.phase!=='SHAKING')return;
    const outcome=ftAnalyze(dice);
    this.lastResult=outcome.result;
    this.$total.textContent=outcome.total;
    this.$result.textContent=this.lastResult;
    this.phase='RESULT';this.resLeft=CFG.resultTime;let profit=0;
    for(const option of ftWinningOptions(this.lastResult)){
      const stake=this.user[option.k]||0;
      if(stake){const odds=Number(option.o);balance+=stake*(1+odds);profit+=stake*odds;}
    }
    setBalance(profit>0?1:0);this.hist.unshift(this.lastResult);if(this.hist.length>110)this.hist.pop();
    this.$stage.classList.remove('rolling');this.renderAll();
    if(profit>0)toast(this.name+': Bạn thắng +'+fmtMoney(profit));
    this.resultTick();
  }
  resultTick(){
    if(this.phase!=='RESULT')return;
    if(this.resLeft<=0){this.startBetting();return;}
    this.renderStatus();this.schedule(()=>{this.resLeft--;this.resultTick();},1000);
  }
  renderStatus(){
    if(this.phase==='BETTING')this.$status.textContent='Đặt cược — còn '+this.tLeft+'s';
    else if(this.phase==='SHAKING')this.$status.textContent='Đang lắc 3 viên xúc xắc…';
    else this.$status.innerHTML='<span class="f-result rt">Kết quả: '+this.lastResult+'</span> · Ván mới sau '+this.resLeft+'s';
  }
  renderBets(){
    const renderOption=o=>{
      const u=this.user[o.k]||0,bot=this.bots[o.k]||0;
      const state=this.phase==='RESULT'?(o.results.includes(this.lastResult)?' win':' lose'):'';
      return '<button type="button" class="betbtn'+state+'" data-k="'+o.k+'"><span class="b-name">'+o.n+'</span><span class="b-odds">'+o.o+'</span>'+
        (bot?'<span class="b-total">'+fmtChips(bot)+'</span>':'')+(u?'<span class="b-user">'+fmtChips(u)+'</span>':'')+'</button>';
    };
    this.$bets.innerHTML=FT_OPTS.filter(option=>option.group==='main').map(renderOption).join('');
    this.$sideBets.innerHTML=FT_OPTS.filter(option=>option.group==='side').map(renderOption).join('');
    this.$tripleBets.innerHTML=FT_OPTS.filter(option=>option.group==='triple').map(renderOption).join('');
  }
  renderStats(){
    const counts=[0,0,0,0];
    this.hist.slice(0,100).forEach(n=>counts[n-1]++);
    this.$road.innerHTML=this.hist.slice(0,100).map((n,index)=>'<span class="bead ft-history ft-r'+n+'" style="grid-column:'+(index%20+1)+';grid-row:'+(Math.floor(index/20)+1)+'" role="img" aria-label="Kết quả '+n+'"></span>').join('');
    this.$summary.textContent='1: '+counts[0]+' · 2: '+counts[1]+' · 3: '+counts[2]+' · 4: '+counts[3];
  }
  renderAll(){this.renderStatus();this.renderBets();this.renderStats();}
}

const FT_OPTS=[
  ...[1,2,3,4].map(n=>({k:String(n),n:'Cửa '+n,o:'3.00',results:[n],group:'main'})),
  {k:'even',n:'Chẵn (2-4)',o:'1.00',results:[2,4],group:'side'},
  {k:'odd',n:'Lẻ (1-3)',o:'1.00',results:[1,3],group:'side'},
  {k:'high',n:'Tài (3-4)',o:'1.00',results:[3,4],group:'side'},
  {k:'low',n:'Xỉu (1-2)',o:'1.00',results:[1,2],group:'side'},
  {k:'ends',n:'Đầu/đuôi (1-4)',o:'1.00',results:[1,4],group:'side'},
  {k:'middle',n:'Giữa (2-3)',o:'1.00',results:[2,3],group:'side'},
  {k:'set123',n:'1-2-3',o:'0.33',results:[1,2,3],group:'triple'},
  {k:'set234',n:'2-3-4',o:'0.33',results:[2,3,4],group:'triple'},
  {k:'set124',n:'1-2-4',o:'0.33',results:[1,2,4],group:'triple'},
  {k:'set134',n:'1-3-4',o:'0.33',results:[1,3,4],group:'triple'}
];
function ftWinningOptions(result){return FT_OPTS.filter(option=>option.results.includes(result));}
function ftAnalyze(dice){
  const total=dice.reduce((sum,value)=>sum+value,0);
  return {total,result:total%4||4};
}
