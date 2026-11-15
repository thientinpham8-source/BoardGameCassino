'use strict';

class DragonTigerTable{
  constructor(cfg){
    Object.assign(this,cfg);
    this.shoe=makeShoe();this.phase='BETTING';this.tLeft=CFG.betTime;this.firstBet=Math.floor(Math.random()*8);
    this.resLeft=CFG.resultTime;this.user={};this.bots={};this.timers=[];
    this.hist=Array.from({length:60+Math.floor(Math.random()*33)},()=>({winner:['D','T','E'][Math.floor(Math.random()*3)]}));
    this.build();startTableWithRandomPhase(this);
    setInterval(()=>this.fluctuate(),15000);
  }
  draw(){
    if(this.shoe.length<80)this.shoe=makeShoe();
    return this.shoe.pop();
  }
  schedule(fn,ms){this.timers.push(setTimeout(fn,ms));}
  clearTimers(){this.timers.forEach(clearTimeout);this.timers=[];}
  build(){
    const el=document.createElement('section');
    el.className='table-card dt';el.setAttribute('aria-label',this.name);
    el.innerHTML='<div class="card-head"><div class="card-title"><div class="title-row"><div class="t-name">'+this.name+'</div><div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="p-count">'+this.players+'</span></div></div><div class="t-id"># '+this.id+'</div></div></div>'+
      '<div class="felt"><div class="f-status"></div><div class="dt-arena">'+
      '<section class="dt-side dragon"><div class="dt-side-title">LONG</div><div class="dt-card-slot"></div><div class="dt-rank">—</div></section>'+
      '<section class="dt-side tiger"><div class="dt-side-title">HỔ</div><div class="dt-card-slot"></div><div class="dt-rank">—</div></section></div></div>'+
      '<div class="bet-wrap dt-bet-wrap"><div class="bet-grid dt-main-bets"></div><div class="dt-suit-groups">'+
      '<section class="dt-suit-group dragon"><div class="dt-suit-title">CƯỢC CHẤT LONG <span>龍</span></div><div class="bet-grid dt-suit-bets" data-side="D"></div></section>'+
      '<section class="dt-suit-group tiger"><div class="dt-suit-title">CƯỢC CHẤT HỔ <span>虎</span></div><div class="bet-grid dt-suit-bets" data-side="T"></div></section></div></div>'+
      '<div class="stats"><div class="sec-title">Kết quả 100 ván trước</div><div class="road big"></div><div class="summary"></div></div>';
    document.getElementById('tables').appendChild(el);this.el=el;
    this.$status=el.querySelector('.f-status');this.$badge=el.querySelector('.pbadge');
    this.$sides=Array.from(el.querySelectorAll('.dt-side'));this.$betWrap=el.querySelector('.bet-wrap');
    this.$mainBets=el.querySelector('.dt-main-bets');this.$suitGroups=Array.from(el.querySelectorAll('.dt-suit-bets'));
    this.$road=el.querySelector('.road');this.$summary=el.querySelector('.summary');
    this.$betWrap.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)this.placeBet(b.dataset.k);});
  }
  startBetting(){
    this.clearTimers();this.phase='BETTING';this.tLeft=CFG.betTime-this.firstBet;this.firstBet=0;
    this.user={};this.bots={};this.$betWrap.classList.remove('locked');this.renderAll();
    for(let i=0;i<this.players;i++)this.schedule(()=>{if(this.phase==='BETTING')this.botBet();},Math.random()*6000);
    this.tick();
  }
  tick(){
    if(this.phase!=='BETTING')return;
    if(this.tLeft<=0){this.lock();return;}
    this.renderStatus();this.schedule(()=>{this.tLeft--;this.tick();},1000);
  }
  botBet(){
    const k=DT_OPTS[Math.floor(Math.random()*DT_OPTS.length)].k;
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
    this.phase='DEALING';this.round={dragon:this.draw(),tiger:this.draw()};
    this.dealt={dragon:false,tiger:false};
    this.revealed={dragon:false,tiger:false};
    this.$betWrap.classList.add('locked');this.renderAll();
    this.schedule(()=>this.dealCard('dragon'),600);
  }
  dealCard(side){
    if(this.phase!=='DEALING')return;
    this.dealt[side]=true;this.renderCards(side);
    if(side==='dragon')this.schedule(()=>this.dealCard('tiger'),650);
    else this.schedule(()=>this.revealCard('dragon'),650);
  }
  revealCard(side){
    if(this.phase!=='DEALING')return;
    this.revealed[side]=true;this.renderCards(side);
    if(side==='dragon')this.schedule(()=>this.revealCard('tiger'),650);
    else this.schedule(()=>this.finish(),650);
  }
  finish(){
    if(this.phase!=='DEALING')return;
    const d=this.round.dragon.r,t=this.round.tiger.r;
    this.lastRes={winner:d===t?'E':d>t?'D':'T',dragon:this.round.dragon,tiger:this.round.tiger};
    this.lastRound=this.round;
    this.phase='RESULT';this.resLeft=CFG.resultTime;let profit=0;
    for(const k in this.user){
      const m=dtMultiplier(k,this.lastRes);
      if(m>0){balance+=this.user[k]*(1+m);profit+=this.user[k]*m;}
      else if(m===0)balance+=this.user[k];
    }
    setBalance(profit>0?1:0);this.hist.unshift(this.lastRes);if(this.hist.length>110)this.hist.pop();
    this.renderAll();if(profit>0)toast(this.name+': Bạn thắng +'+fmtMoney(profit));this.resultTick();
  }
  resultTick(){
    if(this.phase!=='RESULT')return;
    if(this.resLeft<=0){this.startBetting();return;}
    this.renderStatus();this.schedule(()=>{this.resLeft--;this.resultTick();},1000);
  }
  cardHtml(card,animationClass=''){
    return '<span class="pcard'+(card.s===1||card.s===2?' red':'')+(animationClass?' '+animationClass:'')+'"><b>'+RANKS[card.r]+'</b><i>'+SUITS[card.s]+'</i><b class="rank-bottom">'+RANKS[card.r]+'</b></span>';
  }
  renderStatus(){
    if(this.phase==='BETTING')this.$status.textContent='Đặt cược — còn '+this.tLeft+'s';
    else if(this.phase==='DEALING')this.$status.textContent='Đang chia bài…';
    else{
      const winner=this.lastRes.winner,label=winner==='D'?'Long thắng':winner==='T'?'Hổ thắng':'Hòa';
      this.$status.innerHTML='<span class="f-result '+(winner==='D'?'rp':winner==='T'?'rb':'rt')+'">'+label+'</span> · Ván mới sau '+this.resLeft+'s';
    }
  }
  renderCards(onlySide){
    this.$sides.forEach((side,index)=>{
      const key=index===0?'dragon':'tiger',card=this.phase==='BETTING'?this.lastRound&&this.lastRound[key]:this.round&&this.round[key];
      if(onlySide&&key!==onlySide)return;
      const visible=card&&(this.phase!=='DEALING'||this.revealed[key]);
      const dealt=this.phase==='DEALING'&&this.dealt[key];
      side.querySelector('.dt-card-slot').innerHTML=visible?this.cardHtml(card,this.phase==='DEALING'?'flip':''):dealt?'<span class="pcard back"></span>':'<span class="dt-card-placeholder">?</span>';
      side.querySelector('.dt-rank').textContent=visible?RANKS[card.r]:'—';
      side.classList.toggle('winner',this.phase==='RESULT'&&((index===0&&this.lastRes.winner==='D')||(index===1&&this.lastRes.winner==='T')));
      side.classList.toggle('tie',this.phase==='RESULT'&&this.lastRes.winner==='E');
    });
  }
  renderBets(){
    const buttonHtml=o=>{
      const u=this.user[o.k]||0,bot=this.bots[o.k]||0,m=this.phase==='RESULT'?dtMultiplier(o.k,this.lastRes):null;
      const state=m===null?'':m>0?' win':m===0?' push':' lose';
      return '<button type="button" class="betbtn'+(o.side?' dt-suit-bet':'')+state+'" data-k="'+o.k+'"'+(o.suit?' data-suit="'+o.suit+'"':'')+'><span class="b-name"'+(o.side?' aria-label="'+DT_SUITS.find(s=>s.k===o.suit).n+'"':'')+'>'+o.n+'</span><span class="b-odds">'+o.o+'</span>'+
        (bot?'<span class="b-total">'+fmtChips(bot)+'</span>':'')+(u?'<span class="b-user">'+fmtChips(u)+'</span>':'')+'</button>';
    };
    this.$mainBets.innerHTML=DT_MAIN_OPTS.map(buttonHtml).join('');
    this.$suitGroups[0].innerHTML=DT_SUIT_OPTS.filter(o=>o.side==='D').map(buttonHtml).join('');
    this.$suitGroups[1].innerHTML=DT_SUIT_OPTS.filter(o=>o.side==='T').map(buttonHtml).join('');
  }
  renderStats(){
    const history=this.hist.slice(0,100),counts={D:0,T:0,E:0};
    history.forEach(result=>counts[result.winner]++);
    this.$road.innerHTML=renderBigRoad(history.slice().reverse().map(result=>({
      w:result.winner==='D'?'P':result.winner==='T'?'B':'T',
      label:result.winner==='D'?'Long thắng':result.winner==='T'?'Hổ thắng':'Hòa'
    })));
    this.$road.scrollLeft=this.$road.scrollWidth;
    this.$summary.textContent='Long '+counts.D+' · Hổ '+counts.T+' · Hòa '+counts.E;
  }
  renderAll(){this.renderStatus();this.renderCards();this.renderBets();this.renderStats();}
}

const DT_MAIN_OPTS=[{k:'D',n:'Long',o:'1.97'},{k:'E',n:'Hòa',o:'8.00'},{k:'T',n:'Hổ',o:'1.97'}];
const DT_SUITS=[{k:'H',n:'Cơ',symbol:'♥',index:2},{k:'D',n:'Rô',symbol:'♦',index:1},{k:'C',n:'Chuồn',symbol:'♣',index:0},{k:'S',n:'Bích',symbol:'♠',index:3}];
const DT_SUIT_OPTS=['D','T'].flatMap(side=>DT_SUITS.map(suit=>({
  k:side+'_'+suit.k,n:suit.symbol,o:'4.00',side,suit:suit.k
})));
const DT_OPTS=DT_MAIN_OPTS.concat(DT_SUIT_OPTS);
function dtMultiplier(key,result){
  if(key.length===3&&key[1]==='_'){
    const side=key[0]==='D'?'dragon':'tiger',suit=DT_SUITS.find(item=>item.k===key[2]);
    return suit&&result[side].s===suit.index?3:-1;
  }
  if(key==='E')return result.winner==='E'?7:-1;
  if(result.winner==='E')return 0;
  return key===result.winner?0.97:-1;
}
