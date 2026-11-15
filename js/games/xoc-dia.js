'use strict';

/* ================= GAME ENGINE: XÓC ĐĨA ================= */
const XOCDIA = [
  { name:'Xóc Đĩa X1', id:'186269501', players:18 },
  { name:'Xóc Đĩa X2', id:'186269502', players:32 },
  { name:'Xóc Đĩa X3', id:'186269503', players:24, autoBtn:true },
  { name:'Xóc Đĩa X4', id:'186269504', players:27 },
  { name:'Xóc Đĩa Slot X1', id:'186269505', players:24, slot:true },
  { name:'Xóc Đĩa Slot X2', id:'186269506', players:31, slot:true },
  { name:'Xóc Đĩa Slot 3 Quân', id:'186269507', players:26, slot:true, coinCount:3 }
];
const XD_MAIN = [
  {k:'C',  n:'Chẵn', o:'1.95', ico:'rrww'},
  {k:'2D', n:'2 Đỏ 2 Trắng', o:'2.50', ico:'rrww'},
  {k:'L',  n:'Lẻ', o:'1.95', ico:'rrrw'},
  {k:'DM', n:'4 Đỏ / 4 Trắng', o:'7.00', ico:'rrww'},
  {k:'3D', n:'1 Trắng 3 Đỏ', o:'3.60', ico:'rrrw'},
  {k:'3T', n:'3 Trắng 1 Đỏ', o:'3.60', ico:'rwww'}
];
const XD_THREE = [
  {k:'W', n:'Trắng', o:'1.95', ico:'www'},
  {k:'R', n:'Đỏ', o:'1.95', ico:'rrr'},
  {k:'W2', n:'2 Trắng 1 Đỏ', o:'2.60', ico:'wwr'},
  {k:'R2', n:'2 Đỏ 1 Trắng', o:'2.60', ico:'rrw'},
  {k:'W3', n:'3 Trắng', o:'7.80', ico:'www'},
  {k:'R3', n:'3 Đỏ', o:'7.80', ico:'rrr'}
];
const XD_SIDE = [
  {k:'T', n:'Tài [3-4 Đỏ]', o:'2.60', ico:'rrrw'},
  {k:'X', n:'Xỉu [3-4 Trắng]', o:'2.60', ico:'rwww'}
];
const XD_TABS = [['res','Kết quả'],['rate','Tỷ lệ'],['det','Chi tiết']];
const XD_NAMES = ['4 Trắng','3 Trắng 1 Đỏ','2 Đỏ 2 Trắng','3 Đỏ 1 Trắng','4 Đỏ'];
const XD_THREE_NAMES = ['3 Trắng','2 Trắng 1 Đỏ','2 Đỏ 1 Trắng','3 Đỏ'];
function xdCoins(red, coinCount=4){
  const a = [];
  for (let i=0;i<red;i++) a.push(1);
  for (let i=red;i<coinCount;i++) a.push(0);
  for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function xdSeed(n, coinCount=4){
  const a = [];
  for (let i=0;i<n;i++){
    const red = coinCount===3 ? pickW([0,1,2,3],[1,3,3,1]) : pickW([0,1,2,3,4],[1,4,6,4,1]);
    a.push({ red, dm: red===0 || red===coinCount });
  }
  return a;
}
function xdMult(k, red, coinCount=4){
  if (coinCount===3){
    switch(k){
      case 'W': return red<=1 ? 0.95 : -1;
      case 'R': return red>=2 ? 0.95 : -1;
      case 'W2': return red===1 ? 1.6 : -1;
      case 'R2': return red===2 ? 1.6 : -1;
      case 'W3': return red===0 ? 6.8 : -1;
      case 'R3': return red===3 ? 6.8 : -1;
    }
    return -1;
  }
  const even = red%2===0;
  switch(k){
    case 'C':  return even ? 0.95 : -1;
    case 'L':  return even ? -1 : 0.95;
    case 'T':  return red>=3 ? 1.6 : -1;
    case 'X':  return red<=1 ? 1.6 : -1;
    case '4D': return red===4 ? 12 : -1;
    case '4T': return red===0 ? 12 : -1;
    case '3D': return red===3 ? 2.6 : -1;
    case '3T': return red===1 ? 2.6 : -1;
    case '2D': return red===2 ? 1.5 : -1;
    case 'DM': return (red===4||red===0) ? 6 : -1;
  }
  return -1;
}
class XocDiaTable {
  constructor(cfg){
    Object.assign(this, cfg);
    this.coinCount = cfg.coinCount || 4;
    this.mainOpts = this.coinCount===3 ? XD_THREE : XD_MAIN;
    this.resultNames = this.coinCount===3 ? XD_THREE_NAMES : XD_NAMES;
    this.phase = 'BETTING'; this.tLeft = CFG.betTime; this.firstBet = Math.floor(Math.random()*8);
    this.resLeft = CFG.resultTime;
    this.stepIdx = 0; this.steps = [];
    this.red = null; this.lastRed = null; this.coins = null;
    this.user = {}; this.bots = {};
    this.tab = 'res'; this.hist = xdSeed(60 + Math.floor(Math.random()*33), this.coinCount);
    this.paused = false; this.timers = [];
    this.build();
    this.renderAll();
    startTableWithRandomPhase(this);
    setInterval(()=>this.fluctuate(), 15000);
  }
  schedule(fn, ms){
    const t = setTimeout(()=>{ fn(); }, ms);
    this.timers.push(t);
  }
  clearTimers(){ this.timers.forEach(clearTimeout); this.timers = []; }

  build(){
    const el = document.createElement('section');
    el.className = 'table-card xd' + (this.slot ? ' slot' : '') + (this.coinCount===3 ? ' slot-three' : '');
    el.innerHTML =
      '<div class="card-head"><div class="card-title">' +
        '<div class="title-row"><div class="t-name">' + this.name + '</div><div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="p-count">' + this.players + '</span></div></div><div class="t-id"># ' + this.id + '</div></div>' +
        (this.autoBtn ? '<div class="head-right"><div class="autobtn" title="Tạm dừng / tiếp tục">▶</div></div>' : '') +
      '</div>' +
      '<div class="felt">' +
        '<div class="f-status"></div>' +
        (this.slot ? '<div class="slot-machine"><div class="slot-header"><span>XÓC ĐĨA</span><span class="slot-tag">SLOT</span></div><div class="slot-display"><div class="slot-reels"></div></div><div class="slot-footer"><span>' + this.coinCount + ' quân vị · Đỏ / Trắng</span><span class="slot-lights" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div></div>' : '<div class="dish"><div class="plate"><div class="coins"></div></div><div class="lid"></div></div>') +
      '</div>' +
      '<div class="bet-wrap"><div class="bet-grid"></div></div>' +
      '<div class="side-wrap">' +
        '<div class="sec-title">' + (this.coinCount===3 ? 'Luật 3 quân' : 'Cửa phụ') + '</div>' +
        '<div class="side-grid"></div><div class="mini-grid"></div>' +
      '</div>' +
      '<div class="stats">' +
        '<div class="sec-title">Thống kê 100 ván trước</div>' +
        '<div class="tabs"></div><div class="road"></div><div class="summary"></div>' +
      '</div>';
    document.getElementById('tables').appendChild(el);
    this.el = el;
    this.$fStatus = el.querySelector('.f-status');
    this.$dish = el.querySelector(this.slot ? '.slot-machine' : '.dish');
    this.$coins = el.querySelector(this.slot ? '.slot-reels' : '.coins');
    this.$betGrid = el.querySelector('.bet-grid');
    this.$sideGrid = el.querySelector('.side-grid'); this.$miniGrid = el.querySelector('.mini-grid');
    this.$betWrap = el.querySelector('.bet-wrap'); this.$sideWrap = el.querySelector('.side-wrap');
    this.$tabs = el.querySelector('.tabs'); this.$road = el.querySelector('.road'); this.$summary = el.querySelector('.summary');
    this.$badge = el.querySelector('.pbadge'); this.$autoBtn = el.querySelector('.autobtn');
    const bind = (node)=>node.addEventListener('click', e=>{
      const b = e.target.closest('[data-k]'); if (b) this.placeBet(b.dataset.k); });
    bind(this.$betGrid); bind(this.$sideGrid); bind(this.$miniGrid);
    this.$tabs.addEventListener('click', e=>{
      const t = e.target.closest('[data-tab]'); if (t){ this.tab = t.dataset.tab; this.renderStats(); } });
    if (this.$autoBtn) this.$autoBtn.addEventListener('click', ()=>this.togglePause());
  }

  togglePause(){
    this.paused = !this.paused;
    this.clearTimers();
    if (this.paused){ this.$autoBtn.classList.add('paused'); this.$autoBtn.textContent = '❚❚'; }
    else {
      this.$autoBtn.classList.remove('paused'); this.$autoBtn.textContent = '▶';
      if (this.phase==='BETTING') this.tick();
      else if (this.phase==='SHAKING') this.schedule(()=>this.step(), 60);
      else this.schedule(()=>this.resultTick(), 1000);
    }
    this.renderStatus();
  }

  /* ---------- PHASE: ĐẶT CƯỢC ---------- */
  startBetting(){
    this.clearTimers();
    this.phase = 'BETTING'; this.tLeft = CFG.betTime - this.firstBet; this.firstBet = 0;
    this.user = {}; this.bots = {};
    this.setLocked(false);
    this.renderAll();
    if (this.slot) this.randomizeSlotReels();
    const n = this.players;
    for (let i=0;i<n;i++) this.schedule(()=>{ if (this.phase==='BETTING') this.botBet(); }, Math.random()*6000);
    this.tick();
  }
  tick(){
    if (this.paused || this.phase!=='BETTING') return;
    if (this.tLeft <= 0){ this.lock(); return; }
    this.renderStatus();
    this.schedule(()=>{ this.tLeft--; this.tick(); }, 1000);
  }
  botBet(){
    const r = Math.random();
    let keys = [];
    if (this.coinCount===3){
      keys = [r<0.5 ? 'W' : 'R'];
      if (Math.random() < 0.3) keys.push(pickW(['W2','R2','W3','R3'],[3,3,1,1]));
    } else {
      if (r<0.42) keys = ['C']; else if (r<0.84) keys = ['L'];
      else if (r<0.92) keys = ['T']; else keys = ['X'];
      if (Math.random() < 0.3){
        const pool = ['3D','3T','2D','DM','T','X'];
        const w = pool.map(k => (k==='2D'||k==='3D'||k==='3T') ? 2 : 1);
        keys.push(pickW(pool, w));
      }
    }
    keys.forEach(k=>{ this.bots[k] = (this.bots[k]||0) + (1 + Math.floor(Math.random()*20))*1_000_000; });
    this.renderBetGrid(); this.renderSideGrid();
  }
  fluctuate(){
    if (this.paused || this.phase!=='BETTING' || this.autoBtn) return;
    this.players = Math.max(6, Math.min(60, this.players + (Math.random()<0.5?-1:1)));
    this.renderBadge(true);
  }
  placeBet(k){
    if (this.phase!=='BETTING' || this.paused) return;
    if (balance < selectedChip){ toast('Không đủ số dư'); return; }
    balance -= selectedChip;
    this.user[k] = (this.user[k]||0) + selectedChip;
    rememberBetAction(this,k,selectedChip);
    setBalance();
    this.renderBetGrid(); this.renderSideGrid();
  }

  /* ---------- PHASE: XÓC ĐĨA ---------- */
  lock(){
    clearLastBetAction(this);
    this.clearTimers();
    this.phase = 'SHAKING'; this.stepIdx = 0;
    this.red = this.coinCount===3 ? pickW([0,1,2,3],[1,3,3,1]) : pickW([0,1,2,3,4],[1,4,6,4,1]);
    this.coins = xdCoins(this.red, this.coinCount);
    this.setLocked(true);
    this.$dish.classList.remove('open'); this.$dish.classList.add('shake');
    this.renderStatus(); this.renderDish();
    this.steps = [
      { run: ()=>{}, d: 3000 },
      ...(!this.slot ? [{ run: ()=>this.$dish.classList.remove('shake'), d: 2000 }] : []),
      { run: ()=>this.open(), d: 2000 }
    ];
    this.step();
  }
  open(){
    if (this.slot){
      this.$dish.querySelectorAll('.slot-reel').forEach((reel,i)=>
        this.schedule(()=>reel.classList.add('stopped'), i*180));
      this.schedule(()=>{
        this.$dish.classList.remove('shake');
        this.$dish.classList.add('open');
      }, (this.coinCount-1)*180);
      return;
    }
    this.$dish.classList.remove('shake');
    requestAnimationFrame(()=>requestAnimationFrame(()=>this.$dish.classList.add('open')));
  }
  step(){
    if (this.paused || this.phase!=='SHAKING') return;
    const s = this.steps[this.stepIdx];
    if (!s){ this.finish(); return; }
    s.run();
    this.stepIdx++;
    this.schedule(()=>this.step(), s.d);
  }

  /* ---------- PHASE: KẾT QUẢ ---------- */
  finish(){
    this.clearTimers();
    this.lastRed = this.red;
    this.phase = 'RESULT'; this.resLeft = CFG.resultTime;
    let uwin = 0;
    for (const k in this.user){
      const m = xdMult(k, this.lastRed, this.coinCount), st = this.user[k];
      if (m > 0){ balance += st + st*m; uwin += st*m; }
      else if (m === 0){ balance += st; }
    }
    setBalance(uwin>0 ? 1 : 0);
    this.hist.unshift({ red: this.lastRed, dm: this.lastRed===0 || this.lastRed===this.coinCount });
    if (this.hist.length > 110) this.hist.pop();
    this.setLocked(true);
    this.renderAll();
    if (uwin > 0) toast(this.name + ': Bạn thắng +' + fmtMoney(uwin));
    this.resultTick();
  }
  resultTick(){
    if (this.paused || this.phase!=='RESULT') return;
    if (this.resLeft <= 0){ this.startBetting(); return; }
    this.renderStatus();
    this.schedule(()=>{ this.resLeft--; this.resultTick(); }, 1000);
  }

  setLocked(v){
    this.$betWrap.classList.toggle('locked', v);
    this.$sideWrap.classList.toggle('locked', v);
  }
  getBtnCls(k){
    if (this.phase==='RESULT'){
      const m = xdMult(k, this.lastRed, this.coinCount);
      return m>0 ? 'win' : m<0 ? 'lose' : '';
    }
    return '';
  }
  btnHtml(o, mini){
    const u = this.user[o.k]||0, bb = this.bots[o.k]||0;
    const ico = o.ico ? '<span class="b-ico">' + o.ico.split('').map(ch=>'<i class="' + (ch==='r'?'r':'w') + '"></i>').join('') + '</span>' : '';
    return '<button class="' + (mini?'minibtn':'betbtn') + ' ' + this.getBtnCls(o.k) + '" data-k="' + o.k + '">' +
      ico + '<span class="b-name">' + o.n + '</span><span class="b-odds">' + o.o + '</span>' +
      (bb ? '<span class="b-total">' + fmtChips(bb) + '</span>' : '') +
      (u ? '<span class="b-user">' + fmtChips(u) + '</span>' : '') +
      '</button>';
  }
  renderBadge(pulse){
    if (!this.$badge) return;
    this.$badge.querySelector('.p-count').textContent = this.players;
    if (pulse){ this.$badge.classList.add('pulse'); setTimeout(()=>this.$badge.classList.remove('pulse'), 600); }
  }
  renderStatus(){
    let s = '';
    if (this.phase==='BETTING'){
      s = '⏳ Đặt cược — còn ' + this.tLeft + 's';
      if (this.lastRed !== null) s += ' · Ván trước: ' + this.resultNames[this.lastRed];
    } else if (this.phase==='SHAKING'){
      s = this.slot ? 'Đang quay quân vị…' : 'Đang xóc đĩa…';
    } else {
      const redSide = this.coinCount===3 ? this.lastRed>=2 : this.lastRed%2===0;
      const winner = this.coinCount===3 ? (redSide?'Đỏ':'Trắng') : (redSide?'Chẵn':'Lẻ');
      s = '<span class="f-result ' + (redSide?'rb':'rp') + '">' + winner + '</span> · ' +
          this.resultNames[this.lastRed] + ' · Ván mới sau ' + this.resLeft + 's';
    }
    this.$fStatus.innerHTML = s;
  }
  renderSlot(){
    const src = this.coins || Array.from({length:this.coinCount}, (_,i)=>i%2===0 ? 1 : 0);
    const betting = this.phase === 'BETTING';
    const symbolHtml = value=>'<div class="slot-symbol"><span class="coin ' + (value ? 'red' : 'white') + '"></span></div>';
    this.$coins.innerHTML = src.map((c,i)=>{
      const symbols = betting ? Array.from({length:3},()=>Math.random()<.5?1:0) : [c,1-c,c];
      return '<div class="slot-reel" style="--spin-speed:' + (.17 + i*.03) + 's;--spin-delay:-' + (i*.045) + 's" role="img" aria-label="' + (betting ? 'Quân vị đang quay' : c ? 'Quân đỏ' : 'Quân trắng') + '"><div class="slot-strip">' +
        symbols.map(symbolHtml).join('') + '</div></div>';
    }).join('');
    this.$dish.classList.toggle('spinning', betting);
    this.$dish.classList.remove('empty');
    if (betting) this.$dish.classList.remove('open');
  }
  randomizeSlotReels(){
    if (!this.slot || this.phase!=='BETTING' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.$coins.querySelectorAll('.slot-strip').forEach(strip=>{
      strip.innerHTML=Array.from({length:3},()=>'<div class="slot-symbol"><span class="coin '+(Math.random()<.5?'red':'white')+'"></span></div>').join('');
    });
    this.schedule(()=>this.randomizeSlotReels(),350);
  }
  renderDish(){
    if (this.slot){ this.renderSlot(); return; }
    let src = null, old = false;
    if (this.phase==='BETTING'){
      if (this.lastRed !== null){ src = xdCoins(this.lastRed); old = true; }
    } else src = this.coins;
    this.$coins.innerHTML = src ? src.map(c=>
      '<span class="coin ' + (c?'red':'white') + (old?' old':'') + '"></span>').join('') : '';
    this.$dish.classList.remove('open');
  }
  renderBetGrid(){ this.$betGrid.innerHTML = this.mainOpts.map(o=>this.btnHtml(o,false)).join(''); }
  renderSideGrid(){
    if (this.coinCount===3){
      this.$sideGrid.innerHTML = '<span class="slot-rule">Trắng = 2–3 quân trắng</span><span class="slot-rule">Đỏ = 2–3 quân đỏ</span>';
      this.$miniGrid.innerHTML = '<span class="minibtn legend">Mỗi ván 3 quân vị</span><span class="minibtn legend">Tiền trả gồm vốn cược</span>';
      return;
    }
    this.$sideGrid.innerHTML = XD_SIDE.map(o=>this.btnHtml(o,false)).join('');
    this.$miniGrid.innerHTML = '<span class="minibtn legend">Tài = 3-4 Đỏ</span><span class="minibtn legend">Xỉu = 3-4 Trắng</span>';
  }
  renderStats(){
    const H = this.hist.slice(0,100);
    const hTabs = XD_TABS.map(t=>'<span class="tab' + (this.tab===t[0]?' active':'') + '" data-tab="' + t[0] + '">' + t[1] + '</span>').join('');
    this.$tabs.innerHTML = hTabs;
    let body = '', sum = '';
    if (this.tab==='res'){
      if (this.coinCount===3){
        body = renderBigRoad(H.slice().reverse().map(h=>({ w:h.red>=2 ? 'C' : 'L', label:h.red>=2 ? 'Đỏ' : 'Trắng', dm:h.dm })));
        const R = H.filter(h=>h.red>=2).length;
        sum = 'Trắng ' + (H.length-R) + ' · Đỏ ' + R;
      } else {
        body = renderBigRoad(H.slice().reverse().map(h=>({ w:h.red%2===0 ? 'C' : 'L', dm:h.dm })));
        const C = H.filter(h=>h.red%2===0).length;
        sum = 'Chẵn ' + C + ' · Lẻ ' + (H.length-C);
      }
    } else if (this.tab==='rate'){
      const cnt = k => H.filter(h=>h.red===k).length;
      const row = (l,c,n)=>'<div class="pb-row"><span class="lbl">' + l + '</span><div class="pb-bar"><div class="pb-fill" style="width:' + (H.length?n/H.length*100:0) + '%;background:' + c + '"></div></div><span class="pct">' + (H.length?(n/H.length*100).toFixed(1):'0.0') + '%</span></div>';
      body = this.coinCount===3
        ? row('3 Đỏ','#e04848',cnt(3)) + row('2 Đỏ 1 Trắng','#e07a3c',cnt(2)) + row('2 Trắng 1 Đỏ','#2f6fed',cnt(1)) + row('3 Trắng','#9aa7b0',cnt(0))
        : row('4 Đỏ','#e04848',cnt(4)) + row('3 Đỏ','#e07a3c',cnt(3)) + row('2 Đỏ','#2fa14f',cnt(2)) + row('1 Đỏ','#2f6fed',cnt(1)) + row('0 Đỏ','#9aa7b0',cnt(0));
      sum = 'Tổng ' + H.length + ' ván';
    } else {
      for (let i=0;i<100;i++){
        const h = H[i];
        if (!h){ body += '<span class="cell4 empty"></span>'; continue; }
        let q = '';
        for (let j=0;j<this.coinCount;j++) q += '<span class="d4 ' + (j<h.red?'red':'white') + '"></span>';
        body += '<span class="cell4' + (this.coinCount===3?' cell3':'') + '" role="img" aria-label="' + this.resultNames[h.red] + '">' + q + '</span>';
      }
      const rd = H.reduce((a,h)=>a+h.red,0);
      sum = 'Đỏ ' + rd + ' · Trắng ' + (H.length*this.coinCount - rd);
    }
    this.$road.classList.toggle('big', this.tab==='res');
    this.$road.classList.toggle('pb', this.tab==='rate');
    this.$road.innerHTML = body;
    if (this.tab==='res') this.$road.scrollLeft = this.$road.scrollWidth;
    this.$summary.textContent = sum;
  }
  renderAll(){
    this.renderStatus(); this.renderDish(); this.renderBetGrid(); this.renderSideGrid();
    this.renderStats(); this.renderBadge();
  }
}
