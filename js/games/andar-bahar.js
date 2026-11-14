'use strict';

/* ================= GAME ENGINE: ANDAR BAHAR ================= */
const AB_OPTS = [{k:'A',n:'Andar',o:'1.90'},{k:'B',n:'Bahar',o:'1.90'}];
const AB_COUNT_OPTS = [
  {k:'C1',n:'1–5 lá',min:1,max:5,o:2},
  {k:'C2',n:'6–10 lá',min:6,max:10,o:3},
  {k:'C3',n:'11–15 lá',min:11,max:15,o:4},
  {k:'C4',n:'16–20 lá',min:16,max:20,o:5},
  {k:'C5',n:'21–25 lá',min:21,max:25,o:8},
  {k:'C6',n:'26–30 lá',min:26,max:30,o:12},
  {k:'C7',n:'31–35 lá',min:31,max:35,o:20},
  {k:'C8',n:'36–40 lá',min:36,max:40,o:40},
  {k:'C9',n:'41–45 lá',min:41,max:45,o:110},
  {k:'C10',n:'46–49 lá',min:46,max:49,o:800}
];
function makeAndarBaharRound(){
  const deck=[];
  for(let r=0;r<13;r++)for(let s=0;s<4;s++)deck.push({r,s});
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  const middle=deck.pop(),deals=[];
  let side='A';
  while(deck.length){
    const card=deck.pop();
    deals.push({side,card});
    if(card.r===middle.r)break;
    side=side==='A'?'B':'A';
  }
  return {middle,deals,winner:deals[deals.length-1].side};
}
function andarBaharCard(card,extra='',faceDown=false){
  if(faceDown)return '<span class="pcard back'+(extra?' '+extra:'')+'" aria-label="Lá bài úp"></span>';
  return '<span class="pcard'+(card.s===1||card.s===2?' red':'')+(extra?' '+extra:'')+'" aria-label="'+RANKS[card.r]+SUITS[card.s]+'"><b>'+RANKS[card.r]+'</b><i>'+SUITS[card.s]+'</i><b class="rank-bottom">'+RANKS[card.r]+'</b></span>';
}
class AndarBaharTable{
  constructor(cfg){
    Object.assign(this,cfg);
    this.phase='BETTING';this.tLeft=CFG.betTime;this.firstBet=Math.floor(Math.random()*8);this.resLeft=CFG.resultTime;
    this.user={};this.bots={};this.timers=[];this.round=null;this.lastRound=null;this.lastRes=null;this.dealt=[];
    this.hist=Array.from({length:60+Math.floor(Math.random()*33)},()=>Math.random()<.5?'A':'B');
    this.build();this.renderAll();this.startBetting();
    setInterval(()=>this.fluctuate(),15000);
  }
  schedule(fn,ms){this.timers.push(setTimeout(fn,ms));}
  clearTimers(){this.timers.forEach(clearTimeout);this.timers=[];}
  build(){
    const el=document.createElement('section');
    el.className='table-card ab';
    el.setAttribute('aria-label',this.name);
    el.innerHTML=
      '<div class="card-head"><div class="card-title"><div class="title-row"><div class="t-name">'+this.name+'</div><div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="p-count">'+this.players+'</span></div></div><div class="t-id"># '+this.id+'</div></div></div>'+
      '<div class="felt"><div class="f-status"></div><div class="ab-board"><div class="ab-middle"><span class="ab-label">LÁ CHỦ</span><div class="ab-middle-card"></div></div><div class="ab-lanes"><span class="ab-label">ANDAR</span><div class="ab-lane andar"><div class="h-cards ab-andar-cards"></div></div><div class="ab-lane bahar"><div class="h-cards ab-bahar-cards"></div></div><span class="ab-label">BAHAR</span></div></div></div>'+
      '<div class="bet-wrap"><div class="bet-grid"></div><div class="ab-count-bets"><div class="ab-count-head"><span>CƯỢC SỐ LÁ ĐƯỢC CHIA</span><span class="ab-deck-count" aria-live="polite"></span></div><div class="ab-count-grid"></div></div></div>'+
      '<div class="stats"><div class="sec-title">Kết quả 100 ván trước</div><div class="road big"></div><div class="summary"></div></div>';
    document.getElementById('tables').appendChild(el);
    this.el=el;this.$status=el.querySelector('.f-status');this.$badge=el.querySelector('.pbadge');
    this.$middle=el.querySelector('.ab-middle-card');this.$andar=el.querySelector('.ab-andar-cards');this.$bahar=el.querySelector('.ab-bahar-cards');
    this.$betWrap=el.querySelector('.bet-wrap');this.$betGrid=el.querySelector('.bet-grid');
    this.$countGrid=el.querySelector('.ab-count-grid');this.$deckCount=el.querySelector('.ab-deck-count');
    this.$road=el.querySelector('.road');this.$summary=el.querySelector('.summary');
    this.$betWrap.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)this.placeBet(b.dataset.k);});
  }
  startBetting(){
    this.clearTimers();this.phase='BETTING';this.tLeft=CFG.betTime-this.firstBet;this.firstBet=0;this.user={};this.bots={};
    this.$betWrap.classList.remove('locked');this.renderAll();
    for(let i=0;i<this.players;i++)this.schedule(()=>{if(this.phase==='BETTING')this.botBet();},Math.random()*6000);
    this.tick();
  }
  tick(){
    if(this.phase!=='BETTING')return;
    if(this.tLeft<=0){this.lock();return;}
    this.renderStatus();this.schedule(()=>{this.tLeft--;this.tick();},1000);
  }
  botBet(){
    if(this.phase!=='BETTING')return;
    const k=Math.random()<.5?'A':'B';
    this.bots[k]=(this.bots[k]||0)+(1+Math.floor(Math.random()*20))*1_000_000;
    this.renderBetGrid();
  }
  fluctuate(){
    if(this.phase!=='BETTING')return;
    this.players=Math.max(6,Math.min(60,this.players+(Math.random()<.5?-1:1)));
    this.$badge.querySelector('.p-count').textContent=this.players;
  }
  placeBet(k){
    if(this.phase!=='BETTING')return;
    if(balance<selectedChip){toast('Không đủ số dư');return;}
    balance-=selectedChip;this.user[k]=(this.user[k]||0)+selectedChip;
    rememberBetAction(this,k,selectedChip);
    setBalance();this.renderBetGrid();this.renderCountBets();
  }
  lock(){
    clearLastBetAction(this);
    this.clearTimers();this.phase='DEALING';this.round=makeAndarBaharRound();this.dealt=[];
    this.middleFaceDown=true;this.middleRevealing=false;this.sideDealCountdown=0;
    this.$betWrap.classList.add('locked');this.renderAll();this.schedule(()=>this.revealMiddle(),450);
  }
  revealMiddle(){
    if(this.phase!=='DEALING'||!this.middleFaceDown)return;
    this.middleFaceDown=false;this.middleRevealing=true;this.renderCards();this.renderStatus();
    this.schedule(()=>{
      this.middleRevealing=false;this.sideDealCountdown=2;this.renderCards();this.renderStatus();
      this.schedule(()=>{
        this.sideDealCountdown=1;this.renderStatus();
        this.schedule(()=>{this.sideDealCountdown=0;this.dealStep();},1000);
      },1000);
    },520);
  }
  dealStep(){
    if(this.phase!=='DEALING')return;
    const deal=this.round.deals[this.dealt.length];
    if(!deal){this.finish();return;}
    const dealtCard={...deal,faceDown:true,revealing:false};
    this.dealt.push(dealtCard);this.renderCards();this.renderStatus();
    this.schedule(()=>{
      dealtCard.faceDown=false;dealtCard.revealing=true;this.renderCards();
      this.schedule(()=>{dealtCard.revealing=false;this.dealStep();},520);
    },280);
  }
  finish(){
    if(this.phase!=='DEALING')return;
    this.clearTimers();this.lastRound=this.round;this.lastRes=this.round.winner;
    this.hist.unshift(this.lastRes);if(this.hist.length>110)this.hist.pop();
    this.phase='RESULT';this.resLeft=CFG.resultTime;
    let profit=0;
    for(const option of AB_OPTS)if(option.k===this.lastRes&&this.user[option.k]){
      balance+=this.user[option.k]*1.9;profit+=this.user[option.k]*.9;
    }
    const dealtCount=this.round.deals.length;
    for(const option of AB_COUNT_OPTS){
      const stake=this.user[option.k]||0;
      if(stake&&dealtCount>=option.min&&dealtCount<=option.max){
        balance+=stake*(option.o+1);profit+=stake*option.o;
      }
    }
    setBalance(profit>0?1:0);this.$betWrap.classList.add('locked');this.renderAll();
    if(profit>0)toast(this.name+': Bạn thắng +'+fmtMoney(profit));
    this.resultTick();
  }
  resultTick(){
    if(this.phase!=='RESULT')return;
    if(this.resLeft<=0){this.startBetting();return;}
    this.renderStatus();this.schedule(()=>{this.resLeft--;this.resultTick();},1000);
  }
  renderStatus(){
    if(this.phase==='BETTING'){
      this.$status.textContent='Đặt cược — còn '+this.tLeft+'s'+(this.lastRes?' · Ván trước: '+(this.lastRes==='A'?'Andar':'Bahar')+' thắng':'');
    }else if(this.phase==='DEALING'){
      if(this.middleFaceDown)this.$status.textContent='Đang chia lá chủ';
      else if(this.middleRevealing)this.$status.textContent='Đang lật lá chủ';
      else if(this.sideDealCountdown)this.$status.textContent='Lá chủ đã mở — chia bài sau '+this.sideDealCountdown+'s';
      else this.$status.textContent='Đang chia bài — '+this.dealt.length+' / 49 lá';
    }else{
      this.$status.innerHTML='<span class="f-result '+(this.lastRes==='A'?'rp':'rb')+'">'+(this.lastRes==='A'?'ANDAR':'BAHAR')+' THẮNG</span> · Ván mới sau '+this.resLeft+'s';
    }
  }
  renderCards(){
    const betting=this.phase==='BETTING',source=betting?this.lastRound:this.round;
    const deals=betting?(source?source.deals:[]):this.phase==='DEALING'?this.dealt:(source?source.deals:[]);
    const extra=betting?'old':'';
    let middleExtra=extra;
    if(this.phase==='DEALING'&&this.middleFaceDown)middleExtra+=' deal';
    if(this.phase==='DEALING'&&this.middleRevealing)middleExtra+=' flip';
    this.$middle.innerHTML=source?andarBaharCard(source.middle,middleExtra.trim(),this.phase==='DEALING'&&this.middleFaceDown):'<span class="pcard ghost" aria-hidden="true"></span>';
    const renderSide=side=>{
      const cards=deals.filter(d=>d.side===side);
      const lastMatch=source?source.deals.findIndex(d=>d.card.r===source.middle.r):-1;
      return cards.map(d=>{
        let cls=extra;
        if(this.phase==='DEALING'&&d===this.dealt[this.dealt.length-1]&&d.faceDown)cls+=' deal';
        if(this.phase==='DEALING'&&d.revealing)cls+=' flip';
        const globalIndex=deals.indexOf(d);
        if(this.phase==='RESULT'&&globalIndex===lastMatch)cls+=' ab-match';
        return andarBaharCard(d.card,cls.trim(),this.phase==='DEALING'&&d.faceDown);
      }).join('')||'<span class="pcard ghost" aria-hidden="true"></span>';
    };
    this.$andar.innerHTML=renderSide('A');this.$bahar.innerHTML=renderSide('B');
    const dealtCount=betting?(source?source.deals.length:0):this.dealt.length;
    this.$deckCount.textContent='ĐÃ CHIA '+dealtCount+' / 49';
  }
  renderBetGrid(){
    this.$betGrid.innerHTML=AB_OPTS.map(o=>{
      const state=this.phase==='RESULT'?(o.k===this.lastRes?' win':' lose'):'';
      const user=this.user[o.k]||0,bot=this.bots[o.k]||0;
      return '<button type="button" class="betbtn '+state+'" data-k="'+o.k+'" aria-label="Cược '+o.n+'; trả '+o.o+' lần vốn"><span class="b-name">'+o.n+'</span><span class="b-odds">'+o.o+'</span>'+(bot?'<span class="b-total">'+fmtChips(bot)+'</span>':'')+(user?'<span class="b-user">'+fmtChips(user)+'</span>':'')+'</button>';
    }).join('');
  }
  renderCountBets(){
    const dealtCount=this.round?this.round.deals.length:0;
    this.$countGrid.innerHTML=AB_COUNT_OPTS.map(o=>{
      const state=this.phase==='RESULT'?(dealtCount>=o.min&&dealtCount<=o.max?' win':' lose'):'';
      const user=this.user[o.k]||0;
      return '<button type="button" class="ab-count-btn'+state+'" data-k="'+o.k+'" aria-label="Cược '+o.min+' đến '+o.max+' lá; trả '+o.o+' lần tiền cược"><span class="ab-count-range">'+o.n+'</span><span class="ab-count-odds">'+o.o+':1</span>'+(user?'<span class="b-user">'+fmtChips(user)+'</span>':'')+'</button>';
    }).join('');
  }
  renderStats(){
    const history=this.hist.slice(0,100),andar=history.filter(w=>w==='A').length,bahar=history.length-andar;
    this.$road.innerHTML=renderBigRoad(history.slice().reverse().map(w=>({w:w==='A'?'P':'B',label:w==='A'?'Andar':'Bahar'})));
    this.$road.scrollLeft=this.$road.scrollWidth;
    this.$summary.textContent='Andar '+andar+' · Bahar '+bahar;
  }
  renderBadge(){this.$badge.querySelector('.p-count').textContent=this.players;}
  renderAll(){this.renderStatus();this.renderCards();this.renderBetGrid();this.renderCountBets();this.renderStats();this.renderBadge();}
}
