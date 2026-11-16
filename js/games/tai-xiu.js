'use strict';

class TaiXiuTable {
  constructor(cfg){
    Object.assign(this, cfg);
    this.phase = 'BETTING'; this.tLeft = CFG.betTime; this.firstBet = Math.floor(Math.random()*8);
    this.resLeft = CFG.resultTime; this.roll = null; this.lastRes = null;
    this.user = {}; this.bots = {}; this.timers = []; this.tab = 'res';
    this.hist = Array.from({length:60+Math.floor(Math.random()*33)},()=>txAnalyze(txRoll()));
    this.build();
    if(this.glass)this.sim=new GlassDiceSimulation(this.el.querySelector('.glass-stage'));
    startTableWithRandomPhase(this);
    setInterval(()=>this.fluctuate(),15000);
  }
  schedule(fn, ms){ this.timers.push(setTimeout(fn,ms)); }
  clearTimers(){ this.timers.forEach(clearTimeout); this.timers = []; }
  build(){
    const el = document.createElement('section');
    el.className = 'table-card tx'+(this.glass?' tx-glass':'');
    el.setAttribute('aria-label',this.name);
    el.innerHTML =
      '<div class="card-head"><div class="card-title"><div class="title-row"><div class="t-name">' + this.name + '</div>' +
      '<div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="p-count">' + this.players + '</span></div></div>' +
      '<div class="t-id"># ' + this.id + '</div></div></div>' +
      '<div class="felt"><div class="f-status"></div>'+(this.glass?
        '<div class="glass-stage" aria-label="Ống thủy tinh với ba xúc xắc"><div class="glass-shell"><div class="glass-rear"></div></div><div class="glass-base"></div><div class="glass-shell glass-back-rim"><div class="glass-rim bottom"></div></div><div class="glass-camera"></div><div class="glass-shell glass-front"><div class="glass-rim top"></div></div><div class="glass-result" role="group" aria-label="Kết quả xúc xắc" hidden></div></div>':
        '<div class="dish"><div class="plate"><div class="dice-set" aria-hidden="true"></div></div><div class="lid"></div></div>')+'</div>' +
      '<div class="bet-wrap"><div class="tx-bets"></div></div>' +
      '<div class="stats"><div class="sec-title">Thống kê 100 ván trước</div><div class="tabs"></div><div class="road"></div><div class="summary"></div></div>';
    document.getElementById('tables').appendChild(el);
    this.el = el;
    this.$fStatus = el.querySelector('.f-status'); this.$dish = el.querySelector('.dish');
    this.$glassResult = el.querySelector('.glass-result');
    this.$dice = el.querySelector('.dice-set'); this.$betWrap = el.querySelector('.bet-wrap');
    this.$betGrid = el.querySelector('.tx-bets'); this.$badge = el.querySelector('.pbadge');
    this.$tabs = el.querySelector('.tabs'); this.$road = el.querySelector('.road'); this.$summary = el.querySelector('.summary');
    this.$betGrid.addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(b) this.placeBet(b.dataset.k); });
    this.$tabs.addEventListener('click',e=>{ const t=e.target.closest('[data-tab]'); if(t){ this.tab=t.dataset.tab; this.renderStats(); } });
  }
  startBetting(){
    this.clearTimers();
    if(this.$glassResult)this.$glassResult.hidden=true;
    this.phase = 'BETTING'; this.tLeft = CFG.betTime-this.firstBet; this.firstBet = 0;
    this.user = {}; this.bots = {}; this.$betWrap.classList.remove('locked');
    this.renderAll();
    for(let i=0;i<this.players;i++) this.schedule(()=>{ if(this.phase==='BETTING') this.botBet(); },Math.random()*6000);
    this.tick();
  }
  tick(){
    if(this.phase!=='BETTING') return;
    if(this.tLeft<=0){ this.lock(); return; }
    this.renderStatus();
    this.schedule(()=>{ this.tLeft--; this.tick(); },1000);
  }
  botBet(){
    const k = TX_OPTS[Math.floor(Math.random()*TX_OPTS.length)].k;
    this.bots[k] = (this.bots[k]||0)+(1+Math.floor(Math.random()*20))*1_000_000;
    this.renderBetGrid();
  }
  fluctuate(){
    if(this.phase!=='BETTING') return;
    this.players = Math.max(6,Math.min(60,this.players+(Math.random()<.5?-1:1)));
    this.$badge.querySelector('.p-count').textContent = this.players;
  }
  placeBet(k){
    if(this.phase!=='BETTING') return;
    if(balance<selectedChip){ toast('Không đủ số dư'); return; }
    balance -= selectedChip; this.user[k] = (this.user[k]||0)+selectedChip;
    rememberBetAction(this,k,selectedChip);
    setBalance(); this.renderBetGrid();
  }
  lock(){
    clearLastBetAction(this);
    if(this.glass){
      this.clearTimers();this.phase='SHAKING';this.roll=null;
      this.$betWrap.classList.add('locked');this.renderBetGrid();this.renderStatus();
      this.sim.start(dice=>{
        this.roll=dice;this.phase='REVEAL';this.showGlassResult(dice);this.renderStatus();
        this.schedule(()=>{this.$glassResult.hidden=true;this.finish();},2000);
      },()=>this.renderStatus());
      return;
    }
    this.clearTimers(); this.phase = 'SHAKING'; this.roll = txRoll();
    this.$betWrap.classList.add('locked'); this.$dish.classList.add('shake');
    this.renderDish(); this.renderStatus();
    this.schedule(()=>{
      this.$dish.classList.remove('shake'); this.renderStatus();
      this.schedule(()=>{
        this.open(); this.schedule(()=>this.finish(),2000);
      },2000);
    },3000);
  }
  open(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      this.$dish.classList.add('open'); this.$dice.setAttribute('aria-hidden','false'); this.renderStatus();
    }));
  }
  finish(){
    if(this.glass)this.sim.stop();
    this.clearTimers(); this.lastRes = txAnalyze(this.roll);
    this.phase = 'RESULT'; this.resLeft = CFG.resultTime;
    let uwin = 0;
    for(const k in this.user){
      const st = this.user[k], m = txMult(k,this.lastRes);
      if(m>0){ balance += st*(1+m); uwin += st*m; }
    }
    setBalance(uwin>0?1:0);
    this.hist.unshift(this.lastRes); if(this.hist.length>110) this.hist.pop();
    this.$betWrap.classList.add('locked'); this.renderAll();
    if(uwin>0) toast(this.name+': Bạn thắng +'+fmtMoney(uwin));
    this.resultTick();
  }
  resultTick(){
    if(this.phase!=='RESULT') return;
    if(this.resLeft<=0){ this.startBetting(); return; }
    this.renderStatus();
    this.schedule(()=>{ this.resLeft--; this.resultTick(); },1000);
  }
  renderStatus(){
    if(this.phase==='BETTING') this.$fStatus.textContent = 'Đặt cược — còn '+this.tLeft+'s';
    else if(this.glass&&this.phase==='REVEAL') this.$fStatus.textContent = 'Kết quả xúc xắc';
    else if(this.phase==='SHAKING') this.$fStatus.textContent = this.glass?(this.sim.time<GLASS_SHAKE_DURATION?'Đang rung xúc xắc…':'Xúc xắc đang nảy và giảm tốc…'):this.$dish.classList.contains('open')?'Đang mở bát…':this.$dish.classList.contains('shake')?'Đang lắc xí ngầu…':'Chờ mở bát…';
    else {
      const r = this.lastRes, cls = r.winner==='T'?'rb':r.winner==='X'?'rp':'rt';
      this.$fStatus.innerHTML = '<span class="f-result '+cls+'">'+TX_NAMES[r.winner]+'</span> · '+r.total+' điểm · Ván mới sau '+this.resLeft+'s';
    }
  }
  renderDish(){
    if(this.glass){this.sim.render();return;}
    const dice = this.roll || [1,1,1];
    this.$dice.innerHTML = dice.map(diceHtml).join('');
    this.$dice.setAttribute('aria-hidden','true'); this.$dish.classList.remove('open');
  }
  showGlassResult(dice){
    this.$glassResult.innerHTML=dice.map((value,index)=>
      '<div class="glass-result-die'+(value===1?' single-pip':'')+(value===1||value===4?' red-pips':'')+'" role="img" aria-label="Xí ngầu '+(index+1)+': '+value+' điểm">'+
      DICE_PIPS[value].map(p=>'<i class="dice-pip" style="grid-column:'+((p-1)%3+1)+';grid-row:'+(Math.floor((p-1)/3)+1)+'"></i>').join('')+
      '</div>'
    ).join('');
    this.$glassResult.hidden=false;
  }
  renderBetGrid(){
    this.$betGrid.innerHTML = [['main','bet-grid'],['parity','tx-parity-grid'],['single','tx-single-grid']].map(([row,cls])=>
      '<div class="'+cls+'">'+TX_OPTS.filter(o=>o.row===row).map(o=>{
        const u = this.user[o.k]||0, bb = this.bots[o.k]||0;
        const state = this.phase==='RESULT'?(txMult(o.k,this.lastRes)>0?' win':' lose'):'';
        const label = row==='single' ? 'Cược số '+o.n+'; trả 2, 3, 4 lần vốn cho 1, 2, 3 viên trùng số' : 'Cược '+o.n+'; trả '+o.o+' lần vốn';
        return '<button type="button" class="betbtn'+state+'" data-k="'+o.k+'" aria-label="'+label+'"><span class="b-name">'+o.n+'</span><span class="b-odds">'+o.o+'</span>' +
          (bb?'<span class="b-total">'+fmtChips(bb)+'</span>':'')+(u?'<span class="b-user">'+fmtChips(u)+'</span>':'')+'</button>';
      }).join('')+'</div>'
    ).join('');
  }
  renderStats(){
    const H = this.hist.slice(0,100);
    this.$tabs.innerHTML = [['res','Kết quả'],['rate','Tỷ lệ'],['points','Điểm số']].map(t=>'<span class="tab'+(this.tab===t[0]?' active':'')+'" data-tab="'+t[0]+'">'+t[1]+'</span>').join('');
    const cnt = k=>H.filter(h=>h.winner===k).length;
    let body = '';
    if(this.tab==='res') body = renderBigRoad(H.slice().reverse().map(h=>({ w:h.winner==='T'?'B':h.winner==='X'?'P':'A', label:TX_NAMES[h.winner] })));
    else if(this.tab==='rate'){
      const row = (k,c)=>'<div class="pb-row"><span class="lbl">'+TX_NAMES[k]+'</span><div class="pb-bar"><div class="pb-fill" style="width:'+(H.length?cnt(k)/H.length*100:0)+'%;background:'+c+'"></div></div><span class="pct">'+(H.length?cnt(k)/H.length*100:0).toFixed(1)+'%</span></div>';
      body = row('X','#1d4ed8')+row('T','#b91c1c')+row('A','#2fa14f');
    } else {
      for(let i=0;i<100;i++){
        const h = H[i];
        body += h?'<span class="bead '+(h.winner==='T'?'b':h.winner==='X'?'p':'t')+'" role="img" aria-label="'+h.dice.join(' + ')+' = '+h.total+' điểm, '+TX_NAMES[h.winner]+'">'+h.total+'</span>':'<span class="bead empty"></span>';
      }
    }
    this.$road.classList.toggle('big',this.tab==='res'); this.$road.classList.toggle('pb',this.tab==='rate');
    this.$road.innerHTML = body; if(this.tab==='res') this.$road.scrollLeft = this.$road.scrollWidth;
    this.$summary.textContent = 'Xỉu '+cnt('X')+' · Tài '+cnt('T')+' · Tam Bảo '+cnt('A');
  }
  renderAll(){ this.renderStatus(); this.renderDish(); this.renderBetGrid(); this.renderStats(); }
}

const TAIXIU = [
  { name:'Tài Xỉu T1', id:'186269601', players:28 },
  { name:'Tài Xỉu T2', id:'186269602', players:28 },
  { name:'Tài Xỉu Ống', id:'186269603', players:28, glass:true }
];
const TX_OPTS = [
  { k:'T', n:'Tài', o:'2.00', row:'main' },
  { k:'A', n:'Tam Bảo', o:'31.00', row:'main' },
  { k:'X', n:'Xỉu', o:'2.00', row:'main' },
  { k:'C', n:'Chẵn', o:'2.00', row:'parity' },
  { k:'L', n:'Lẻ', o:'2.00', row:'parity' },
  ...Array.from({length:6},(_,i)=>({ k:'N'+(i+1), n:String(i+1), o:'2/3/4×', row:'single' }))
];
const TX_NAMES = { T:'Tài', X:'Xỉu', A:'Tam Bảo' };
const DICE_SIDES = [[],[2,3],[6,3],[2,6],[2,1],[1,3],[5,3]];
function txRoll(){ return Array.from({length:3},()=>1+Math.floor(Math.random()*6)); }
function txAnalyze(dice){
  const total = dice.reduce((a,n)=>a+n,0), triple = dice.every(n=>n===dice[0]);
  return { dice:dice.slice(), total, triple, winner:triple?'A':total>=11?'T':'X' };
}
function txMult(k, res){
  if(k==='A') return res.triple ? 30 : -1;
  if(k.startsWith('N')) return res.dice.filter(n=>n===Number(k.slice(1))).length || -1;
  if(res.triple) return -1;
  if(k==='C'||k==='L') return (res.total%2===0 ? 'C' : 'L')===k ? 1 : -1;
  return res.winner===k ? 1 : -1;
}
function diceHtml(value, index){
  const face = (n, side)=>'<span class="dice-face dice-' + side + (n===1?' single-pip':'') + (n===1||n===4?' red-pips':'') + '" aria-hidden="true">' +
    DICE_PIPS[n].map(p=>'<i class="dice-pip" style="grid-column:' + ((p-1)%3+1) + ';grid-row:' + (Math.floor((p-1)/3)+1) + '"></i>').join('') + '</span>';
  return '<span class="dice" data-value="' + value + '" role="img" aria-label="Xí ngầu ' + (index+1) + ': ' + value + ' điểm"><span class="dice-cube">' +
    face(7-DICE_SIDES[value][0],'front') + face(value,'top') + face(DICE_SIDES[value][1],'right') + '</span></span>';
}
