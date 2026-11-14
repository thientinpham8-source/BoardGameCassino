'use strict';

class MonopolyTable{
  constructor(){
    this.name='Monopoly Xúc xắc';this.id='186269611';this.players=32;
    this.phase='BETTING';this.tLeft=CFG.betTime;this.firstBet=Math.floor(Math.random()*8);this.resLeft=CFG.resultTime;
    this.roll=monopolyRoll();this.lastRes=null;this.user={};this.bots={};this.timers=[];this.tab='res';
    this.hist=Array.from({length:60+Math.floor(Math.random()*33)},()=>monopolyResult(monopolyRoll()));
    this.build();this.startBetting();
    setInterval(()=>this.fluctuate(),15000);
  }
  schedule(fn,ms){this.timers.push(setTimeout(fn,ms));}
  clearTimers(){this.timers.forEach(clearTimeout);this.timers=[];}
  build(){
    const el=document.createElement('section');
    el.className='table-card monopoly';
    el.setAttribute('aria-label',this.name);
    el.innerHTML=
      '<div class="card-head"><div class="card-title"><div class="title-row"><div class="t-name">'+this.name+'</div><div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="p-count">'+this.players+'</span></div></div><div class="t-id"># '+this.id+'</div></div></div>'+
      '<div class="felt"><div class="f-status"></div><div class="mono-board"><div class="mono-track"></div><div class="mono-tray"><div class="mono-sim-stage glass-stage" role="img" aria-label="Lồng kính với hai xúc xắc"><div class="glass-camera"></div></div><div class="mono-last" aria-live="polite">Chờ kết quả</div></div></div></div>'+
      '<div class="bet-wrap"><div class="mono-main-bets"></div></div>'+
      '<div class="stats"><div class="sec-title">Thống kê 100 ván trước</div><div class="tabs"></div><div class="road"></div><div class="summary"></div></div>';
    document.getElementById('tables').appendChild(el);
    this.el=el;this.$status=el.querySelector('.f-status');this.$badge=el.querySelector('.pbadge');
    this.$track=el.querySelector('.mono-track');
    this.$tray=el.querySelector('.mono-tray');this.$last=el.querySelector('.mono-last');
    this.$betWrap=el.querySelector('.bet-wrap');this.$mainBets=el.querySelector('.mono-main-bets');
    this.$tabs=el.querySelector('.tabs');this.$road=el.querySelector('.road');this.$summary=el.querySelector('.summary');
    this.$betWrap.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)this.placeBet(b.dataset.k);});
    this.$track.addEventListener('click',e=>{const tile=e.target.closest('.mono-number-bet');if(tile)this.placeBet(tile.dataset.number);});
    this.$tabs.addEventListener('click',e=>{const t=e.target.closest('[data-tab]');if(t){this.tab=t.dataset.tab;this.renderStats();}});
    this.renderTrack();
    this.sim=new GlassDiceSimulation(el.querySelector('.mono-sim-stage'),2,GLASS_SHAKE_DURATION,false);
  }
  renderTrack(){
    this.$track.innerHTML=MONOPOLY_TRACK.map(tile=>{
      const position='grid-row:'+tile.row+';grid-column:'+tile.column;
      return tile.go?
        '<span class="mono-tile mono-tile-go" data-number="'+tile.number+'" aria-label="GO, '+tile.number+'" style="'+position+'"><b>GO</b><small class="mono-go-arrow" aria-hidden="true">←</small></span>':
        '<button type="button" class="mono-tile mono-number-bet mono-tile-'+(tile.number<7?'blue':tile.number===7?'green':'red')+'" data-number="'+tile.number+'" style="'+position+'"><b>'+tile.number+'</b><small>'+MONOPOLY_PAYOUTS[tile.number]+'</small></button>';
    }).join('');
    this.renderTrackBets();
  }
  renderTrackBets(){
    this.$track.querySelectorAll('.mono-number-bet').forEach(tile=>{
      const number=tile.dataset.number,stake=this.user[number]||0;
      tile.disabled=this.phase!=='BETTING';
      tile.setAttribute('aria-pressed',String(stake>0));
      tile.setAttribute('aria-label','Cược tổng '+number+', trả '+MONOPOLY_PAYOUTS[number]+', đã cược '+fmtChips(stake));
      tile.title='Cược tổng '+number+' · '+MONOPOLY_PAYOUTS[number]+' · Đã cược '+fmtChips(stake);
      let stakeLabel=tile.querySelector('.mono-tile-stake');
      if(stake){
        if(!stakeLabel){stakeLabel=document.createElement('small');stakeLabel.className='mono-tile-stake';tile.appendChild(stakeLabel);}
        stakeLabel.textContent=fmtChips(stake);
      }else if(stakeLabel)stakeLabel.remove();
    });
  }
  startBetting(){
    this.clearTimers();this.phase='BETTING';this.tLeft=CFG.betTime-this.firstBet;this.firstBet=0;
    this.user={};this.bots={};this.roll=monopolyRoll();this.$betWrap.classList.remove('locked');
    this.renderTrackBets();
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
    const option=MONOPOLY_OPTS[Math.floor(Math.random()*MONOPOLY_OPTS.length)];
    this.bots[option.k]=(this.bots[option.k]||0)+(1+Math.floor(Math.random()*20))*1_000_000;
    this.renderBetGrid();
  }
  fluctuate(){
    if(this.phase!=='BETTING')return;
    this.players=Math.max(6,Math.min(60,this.players+(Math.random()<.5?-1:1)));
    this.$badge.querySelector('.p-count').textContent=this.players;
  }
  placeBet(key){
    if(this.phase!=='BETTING')return;
    if(balance<selectedChip){toast('Không đủ số dư');return;}
    balance-=selectedChip;this.user[key]=(this.user[key]||0)+selectedChip;
    rememberBetAction(this,key,selectedChip);
    setBalance();this.renderBetGrid();this.renderTrackBets();
  }
  animateTrackResult(total){
    this.$track.querySelectorAll('.mono-tile-active,.mono-tile-result').forEach(tile=>tile.classList.remove('mono-tile-active','mono-tile-result'));
    const resultIndex=MONOPOLY_ROUTE.indexOf(total);
    if(resultIndex<0)return;
    MONOPOLY_ROUTE.slice(0,resultIndex+1).forEach((number,index)=>{
      this.schedule(()=>{
        this.$track.querySelectorAll('.mono-tile-active').forEach(tile=>tile.classList.remove('mono-tile-active'));
        const tile=this.$track.querySelector('.mono-tile[data-number="'+number+'"]');
        if(tile)tile.classList.add(index===resultIndex?'mono-tile-result':'mono-tile-active');
      },index*180);
    });
  }
  lock(){
    clearLastBetAction(this);
    this.clearTimers();this.phase='SHAKING';this.$betWrap.classList.add('locked');
    this.renderBetGrid();this.renderTrackBets();this.renderStatus();
    this.sim.start(dice=>{
      this.$tray.classList.remove('shaking');this.roll=dice;
      this.lastRes=monopolyResult(this.roll);this.$last.textContent=this.roll[0]+' + '+this.roll[1]+' = '+this.lastRes.total+' · '+MONOPOLY_NAMES[this.lastRes.winner];
      this.animateTrackResult(this.lastRes.total);
      this.finish();
    },()=>{
      this.$tray.classList.toggle('shaking',this.sim.time<GLASS_SHAKE_DURATION);
      this.renderStatus();
    });
  }
  finish(){
    this.phase='RESULT';this.resLeft=CFG.resultTime;
    let profit=0;
    for(const key in this.user){
      const stake=this.user[key],multiplier=monopolyMultiplier(key,this.lastRes);
      if(multiplier>0){balance+=stake*multiplier;profit+=stake*(multiplier-1);}
    }
    setBalance(profit>0?1:0);this.hist.unshift(this.lastRes);if(this.hist.length>110)this.hist.pop();
    this.$betWrap.classList.add('locked');this.renderAll();
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
    else if(this.phase==='SHAKING')this.$status.textContent=this.sim.time<GLASS_SHAKE_DURATION?'Đang lắc xúc xắc…':'Xúc xắc đang nảy và giảm tốc…';
    else this.$status.innerHTML='<span class="f-result '+(this.lastRes.winner==='X'?'rp':this.lastRes.winner==='T'?'rb':'rt')+'">'+MONOPOLY_NAMES[this.lastRes.winner]+'</span> · '+this.lastRes.total+' điểm · Ván mới sau '+this.resLeft+'s';
  }
  renderBetGrid(){
    const render=option=>{
      const stake=this.user[option.k]||0,total=this.bots[option.k]||0;
      const result=this.phase==='RESULT'?(monopolyMultiplier(option.k,this.lastRes)>0?' win':' lose'):'';
      return '<button type="button" class="betbtn'+result+'" data-k="'+option.k+'" aria-label="Cược '+option.n+' tổng '+option.range+', trả '+option.o+' lần vốn"><span class="b-name">'+option.n+'</span><span class="b-range">'+option.range+'</span><span class="b-odds">'+option.o+'×</span>'+(total?'<span class="b-total">'+fmtChips(total)+'</span>':'')+(stake?'<span class="b-user">'+fmtChips(stake)+'</span>':'')+'</button>';
    };
    this.$mainBets.innerHTML=MONOPOLY_OPTS.map(render).join('');
  }
  renderStats(){
    const history=this.hist.slice(0,100),count=key=>history.filter(item=>item.winner===key).length;
    this.$tabs.innerHTML=[['res','Kết quả'],['rate','Tỷ lệ'],['points','Điểm số']].map(([key,label])=>'<span class="tab'+(this.tab===key?' active':'')+'" data-tab="'+key+'">'+label+'</span>').join('');
    let body='';
    if(this.tab==='res')body=renderBigRoad(history.slice().reverse().map(item=>({w:item.winner==='X'?'P':item.winner==='T'?'B':'A',label:MONOPOLY_NAMES[item.winner]})));
    else if(this.tab==='rate'){
      body=['X','7','T'].map((key,i)=>'<div class="pb-row"><span class="lbl">'+MONOPOLY_NAMES[key]+'</span><div class="pb-bar"><div class="pb-fill" style="width:'+(history.length?count(key)/history.length*100:0)+'%;background:'+['#1d4ed8','#2fa14f','#b91c1c'][i]+'"></div></div><span class="pct">'+(history.length?count(key)/history.length*100:0).toFixed(1)+'%</span></div>').join('');
    }else{
      for(let i=0;i<100;i++){const item=history[i];body+=item?'<span class="bead '+(item.winner==='X'?'p':item.winner==='T'?'b':'t')+'" role="img" aria-label="'+item.dice.join(' + ')+' = '+item.total+' điểm">'+item.total+'</span>':'<span class="bead empty"></span>';}
    }
    this.$road.classList.toggle('big',this.tab==='res');this.$road.classList.toggle('pb',this.tab==='rate');this.$road.innerHTML=body;
    if(this.tab==='res')this.$road.scrollLeft=this.$road.scrollWidth;
    this.$summary.textContent='Xỉu '+count('X')+' · 7 điểm '+count('7')+' · Tài '+count('T');
  }
  renderAll(){
    this.$last.textContent=this.lastRes?this.lastRes.dice.join(' + ')+' = '+this.lastRes.total+' · '+MONOPOLY_NAMES[this.lastRes.winner]:'Chờ kết quả';
    this.renderStatus();this.renderBetGrid();this.renderStats();
  }
}
const RL_ORDER = [0,7,2,9,4,1,6,12,8,3,10,5,11];
const RL_RED = new Set([1,3,5,7,9,12]);
const RL_OPTS = [
  { k:'X', n:'Xỉu', o:'2.00', row:'size' }, { k:'T', n:'Tài', o:'2.00', row:'size' },
  { k:'D', n:'Đen', o:'2.00', row:'color' }, { k:'R', n:'Đỏ', o:'2.00', row:'color' },
  { k:'C', n:'Chẵn', o:'2.00', row:'parity' }, { k:'L', n:'Lẻ', o:'2.00', row:'parity' },
  ...Array.from({length:13},(_,i)=>({ k:'N'+i, n:String(i), o:'12×', row:'number' }))
];
function rlRoll(){ return Math.floor(Math.random()*13); }
function rlColor(n){ return n===0 ? 'zero' : RL_RED.has(n) ? 'red' : 'black'; }
function rlMult(k,n){
  if(k.startsWith('N')) return Number(k.slice(1))===n ? 11 : -1;
  if(n===0) return -1;
  const win = k==='X' ? n<=6 : k==='T' ? n>=7 : k==='R' ? RL_RED.has(n) : k==='D' ? !RL_RED.has(n) : k==='C' ? n%2===0 : n%2===1;
  return win ? 1 : -1;
}
function rouletteSvg(){
  const point=(r,a)=>{const rad=a*Math.PI/180;return [100+r*Math.sin(rad),100-r*Math.cos(rad)];};
  const paths=RL_ORDER.map((n,i)=>{
    const a=i*360/13, p=point(98,a-180/13), q=point(98,a+180/13), s=point(62,a+180/13), t=point(62,a-180/13);
    const color=n===0?'#24754d':RL_RED.has(n)?'#a92124':'#151d24';
    const label=point(82,a);
    return '<g data-pocket="'+n+'"><path d="M '+p.join(' ')+' A 98 98 0 0 1 '+q.join(' ')+' L '+s.join(' ')+' A 62 62 0 0 0 '+t.join(' ')+' Z" fill="'+color+'" stroke="#d4b174" stroke-width="1.2"/><text x="'+label[0]+'" y="'+label[1]+'" transform="rotate('+a+' '+label.join(' ')+')" text-anchor="middle" dominant-baseline="central" fill="#fff4ce" font-family="Consolas,monospace" font-size="15" font-weight="700">'+n+'</text></g>';
  }).join('');
  return '<svg viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="rl-wood"><stop stop-color="#b78648"/><stop offset=".7" stop-color="#724b2e"/><stop offset="1" stop-color="#4b2f20"/></radialGradient></defs><circle cx="100" cy="100" r="100" fill="url(#rl-wood)"/>'+paths+'<circle cx="100" cy="100" r="59" fill="none" stroke="#d4b174" stroke-width="2"/><circle cx="100" cy="100" r="39" fill="none" stroke="#c9a765" stroke-width="1"/></svg>';
}
