'use strict';

/* ================= BÀN GAME: VÒNG ĐỜI VÁN ĐẤU ================= */
class GameTable {
  constructor(cfg){
    Object.assign(this, cfg);
    this.shoe = makeShoe();
    this.phase = 'BETTING'; this.tLeft = CFG.betTime; this.firstBet = Math.floor(Math.random()*8);
    this.resLeft = CFG.resultTime;
    this.dealIdx = 0; this.reveal = { p:[0,0,0], b:[0,0,0] }; this.animCard = null;
    this.round = null; this.lastRes = null; this.lastCards = null;
    this.user = {}; this.bots = {};
    this.tab = 'res'; this.hist = seedHist(60 + Math.floor(Math.random()*33));
    this.paused = false; this.timers = [];
    this.build();
    this.renderAll();
    this.startBetting();
    setInterval(()=>this.fluctuate(), 15000);
  }
  draw(){
    if (this.shoe.length < 80) this.shoe = makeShoe();
    return this.shoe.pop();
  }
  schedule(fn, ms){
    const t = setTimeout(()=>{ fn(); }, ms);
    this.timers.push(t);
  }
  clearTimers(){ this.timers.forEach(clearTimeout); this.timers = []; }

  build(){
    const el = document.createElement('section');
    el.className = 'table-card';
    el.innerHTML =
      '<div class="card-head"><div class="card-title">' +
        '<div class="title-row"><div class="t-name">' + this.name + '</div><div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="p-count">' + this.players + '</span></div></div><div class="t-id"># ' + this.id + '</div></div>' +
        (this.autoBtn && this.showAutoBtn !== false ? '<div class="head-right"><div class="autobtn" title="Tạm dừng / tiếp tục">▶</div></div>' : '') +
      '</div>' +
      '<div class="felt">' +
        '<div class="f-status"></div>' +
        '<div class="hands">' +
          '<div class="hand" data-hand="b"><span class="h-label">BANKER</span><span class="h-cards"></span><span class="hz">莊</span><span class="h-score">–</span></div>' +
          '<div class="hand" data-hand="p"><span class="h-label">PLAYER</span><span class="h-cards"></span><span class="hz">閒</span><span class="h-score">–</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="bet-wrap"><div class="bet-grid"></div></div>' +
      '<div class="side-wrap">' +
        '<div class="sec-title">Sổ lá bài</div>' +
        '<div class="side-grid"></div><div class="mini-grid"></div>' +
      '</div>' +
      '<div class="stats">' +
        '<div class="sec-title">Thống kê 100 ván trước</div>' +
        '<div class="tabs"></div><div class="road"></div><div class="summary"></div>' +
      '</div>';
    document.getElementById('tables').appendChild(el);
    this.el = el;
    this.$fStatus = el.querySelector('.f-status');
    this.$pHand = el.querySelector('[data-hand="p"]'); this.$bHand = el.querySelector('[data-hand="b"]');
    this.$pCards = el.querySelector('[data-hand="p"] .h-cards'); this.$bCards = el.querySelector('[data-hand="b"] .h-cards');
    this.$pScore = el.querySelector('[data-hand="p"] .h-score'); this.$bScore = el.querySelector('[data-hand="b"] .h-score');
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
      else if (this.phase==='DEALING') this.schedule(()=>this.dealStep(), 60);
      else this.schedule(()=>this.resultTick(), 1000);
    }
    this.renderStatus();
  }

  /* ---------- PHASE: ĐẶT CƯỢC ---------- */
  startBetting(){
    this.clearTimers();
    this.phase='BETTING'; this.tLeft=CFG.betTime-this.firstBet; this.firstBet=0;
    this.user = {}; this.bots = {};
    this.setLocked(false);
    this.renderAll();
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
    if (r<0.42) keys = ['P']; else if (r<0.88) keys = ['B']; else if (r<0.96) keys = ['T'];
    if (Math.random() < 0.33){
      const pool = ['PP','BP','AP','CT','CX','PTAI','PXIU','BTAI','BXIU'];
      const w = pool.map(k => (k==='AP'||k==='CT') ? 2 : 1);
      keys.push(pickW(pool, w));
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

  /* ---------- PHASE: CHIA BÀI ---------- */
  lock(){
    clearLastBetAction(this);
    this.clearTimers();
    this.phase = 'DEALING'; this.dealIdx = 0;
    this.round = playRound(this.shoe);
    this.reveal = { p:[0,0,0], b:[0,0,0] };
    this.animCard = null;
    const S = this.steps = [];
    for (let i=0;i<2;i++) S.push({ run: ()=>this.setCard('p',i,1), d: 200 });   // chia úp 2 lá P
    for (let i=0;i<2;i++) S.push({ run: ()=>this.setCard('b',i,1), d: 200 });   // chia úp 2 lá B
    S.push({ run: ()=>{}, d: 340 });                                            // nhịp nghỉ
    for (let i=0;i<2;i++) S.push({ run: ()=>this.setCard('p',i,2), d: 720 });   // lật P từng lá
    for (let i=0;i<2;i++) S.push({ run: ()=>this.setCard('b',i,2), d: 720 });   // lật B từng lá
    if (this.round.p.length>2){
      S.push({ run: ()=>this.setCard('p',2,1), d: 420 });                       // lá 3 P (luật P<=5)
      S.push({ run: ()=>this.setCard('p',2,2), d: 720 });
    }
    if (this.round.b.length>2){
      S.push({ run: ()=>this.setCard('b',2,1), d: 420 });                       // lá 3 B (theo bảng luật)
      S.push({ run: ()=>this.setCard('b',2,2), d: 720 });
    }
    S.push({ run: ()=>{}, d: 460 });
    this.setLocked(true);
    this.renderStatus(); this.renderCards();
    this.dealStep();
  }
  setCard(side, i, st){
    this.reveal[side][i] = st;
    this.animCard = { side, i, st };
    this.renderCards();
  }
  dealStep(){
    if (this.paused || this.phase!=='DEALING') return;
    const s = this.steps[this.dealIdx];
    if (!s){ this.finish(); return; }
    s.run();
    this.dealIdx++;
    this.schedule(()=>this.dealStep(), s.d);
  }

  /* ---------- PHASE: KẾT QUẢ ---------- */
  finish(){
    this.clearTimers();
    this.lastRes = analyze(this.round);
    this.lastCards = { p: this.round.p.slice(), b: this.round.b.slice() };
    const res = this.lastRes;
    this.phase = 'RESULT'; this.resLeft = CFG.resultTime;
    let uwin = 0;
    for (const k in this.user){
      const m = multFor(k, res, this.nc), st = this.user[k];
      if (m > 0){ balance += st + st*m; uwin += st*m; }
      else if (m === 0){ balance += st; }
    }
    setBalance(uwin>0 ? 1 : 0);
    this.hist.unshift({ w: res.winner, pp: res.pPair, bp: res.bPair, c: res.cards, pt: res.pTotal, bt: res.bTotal });
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
      const m = multFor(k, this.lastRes, this.nc);
      return m>0 ? 'win' : m<0 ? 'lose' : '';
    }
    return '';
  }
  btnHtml(o, mini){
    const u = this.user[o.k]||0, bb = this.bots[o.k]||0;
    return '<button class="' + (mini?'minibtn':'betbtn') + ' ' + this.getBtnCls(o.k) + '" data-k="' + o.k + '">' +
      '<span class="b-name">' + o.n + '</span><span class="b-odds">' + o.o + '</span>' +
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
      if (this.lastRes) s += ' · Ván trước: ' + WIN_TXT[this.lastRes.winner];
    } else if (this.phase==='DEALING'){
      s = 'Đang chia bài…';
    } else {
      const w = this.lastRes.winner;
      s = '<span class="f-result ' + (w==='P'?'rp':w==='B'?'rb':'rt') + '">' + WIN_TXT[w] + '</span>' +
          ' · Ván mới sau ' + this.resLeft + 's';
    }
    this.$fStatus.innerHTML = s;
  }
  cardHtml(c, cls){
    return '<span class="pcard' + (c.s===1||c.s===2?' red':'') + (cls?' '+cls:'') + '"><b>' + RANKS[c.r] + '</b><i>' + SUITS[c.s] + '</i><b class="rank-bottom">' + RANKS[c.r] + '</b></span>';
  }
  renderCards(){
    const ph = this.phase;
    const src = ph==='BETTING' ? this.lastCards : this.round;
    const anim = this.animCard;
    const ghost = '<span class="pcard ghost"></span><span class="pcard ghost"></span>';
    const mk = (side, cs, sts)=>{
      if (!cs) return ghost;
      let h = '';
      for (let j=0;j<cs.length;j++){
        if (ph==='DEALING'){
          if (sts[j]===0) continue;                                                    // chưa chia đến
          if (sts[j]===1){
            const d = anim && anim.side===side && anim.i===j && anim.st===1 ? ' deal' : '';
            h += '<span class="pcard back' + d + '"></span>';
          } else {
            const f = anim && anim.side===side && anim.i===j && anim.st===2 ? 'flip' : '';
            h += this.cardHtml(cs[j], f);
          }
        } else {
          h += this.cardHtml(cs[j], ph==='BETTING' ? 'old' : '');
        }
      }
      return h || ghost;
    };
    const sts = ph==='DEALING' ? this.reveal : null;
    this.$pCards.innerHTML = mk('p', src && src.p, sts ? sts.p : null);
    this.$bCards.innerHTML = mk('b', src && src.b, sts ? sts.b : null);
    const faceTot = (cs, st)=> cs.reduce((a,c,j)=> a + (st[j]===2 ? vOf(c.r) : 0), 0) % 10;
    const sP = ph==='DEALING' ? faceTot(src.p, sts.p) : (src ? tot(src.p) : null);
    const sB = ph==='DEALING' ? faceTot(src.b, sts.b) : (src ? tot(src.b) : null);
    this.$pScore.textContent = sP===null ? '–' : sP;
    this.$bScore.textContent = sB===null ? '–' : sB;
    this.animCard = null;
    const w = ph==='RESULT' ? this.lastRes.winner : null;
    this.$pHand.classList.toggle('win', w==='P');
    this.$bHand.classList.toggle('win', w==='B');
  }
  renderBetGrid(){ this.$betGrid.innerHTML = MAIN_OPTS.map(o=>this.btnHtml(o,false)).join(''); }
  renderSideGrid(){
    this.$sideGrid.innerHTML = SIDE_OPTS.filter(o=>!o.mini).map(o=>this.btnHtml(o,false)).join('');
    this.$miniGrid.innerHTML = SIDE_OPTS.filter(o=>o.mini && (o.ncOnly ? this.nc : true)).map(o=>this.btnHtml(o,true)).join('');
  }
  renderStats(){
    const H = this.hist.slice(0,100);
    const hTabs = TABS.map(t=>'<span class="tab' + (this.tab===t[0]?' active':'') + '" data-tab="' + t[0] + '">' + t[1] + '</span>').join('');
    this.$tabs.innerHTML = hTabs;
    let body = '', sum = '';
    const grid100 = fn => {
      let s = '';
      for (let i=0;i<100;i++){ const h = H[i]; s += h ? fn(h) : '<span class="bead empty"></span>'; }
      return s;
    };
    if (this.tab==='res'){
      body = renderBigRoad(H.slice().reverse());
      const P = H.filter(h=>h.w==='P').length, T = H.filter(h=>h.w==='T').length;
      sum = 'Người chơi ' + P + ' · Hòa ' + T + ' · Nhà cái ' + (H.length-P-T);
    } else if (this.tab==='pb'){
      const P = H.filter(h=>h.w==='P').length, T = H.filter(h=>h.w==='T').length, B = H.length-P-T;
      const row = (l,c,n)=>'<div class="pb-row"><span class="lbl">' + l + '</span><div class="pb-bar"><div class="pb-fill" style="width:' + (H.length?n/H.length*100:0) + '%;background:' + c + '"></div></div><span class="pct">' + (H.length?(n/H.length*100).toFixed(1):'0.0') + '%</span></div>';
      body = row('Người chơi','#1d4ed8',P) + row('Hòa','#2fa14f',T) + row('Nhà cái','#b91c1c',B);
      sum = 'Người chơi ' + P + ' · Hòa ' + T + ' · Nhà cái ' + B;
    } else if (this.tab==='ou'){
      body = grid100(h=>'<span class="bead ' + (h.c>=5?'t2':'x2') + '">' + (h.c>=5?'T':'X') + '</span>');
      const T2 = H.filter(h=>h.c>=5).length;
      sum = 'Tài ' + T2 + ' · Xỉu ' + (H.length-T2);
    } else {
      const k = this.tab==='pbs' ? 'pt' : 'bt';
      body = grid100(h=>{
        const v = h[k];
        return '<span class="bead ' + (v>=8?'t2':v<=5?'x2':'h2') + '">' + (v>=8?'T':v<=5?'X':'–') + '</span>';
      });
      const T3 = H.filter(h=>h[k]>=8).length, X3 = H.filter(h=>h[k]<=5).length;
      sum = 'Tài ' + T3 + ' · Xỉu ' + X3 + ' · Hòa ' + (H.length-T3-X3);
    }
    this.$road.classList.toggle('big', this.tab==='res');
    this.$road.classList.toggle('pb', this.tab==='pb');
    this.$road.innerHTML = body;
    if (this.tab==='res') this.$road.scrollLeft = this.$road.scrollWidth;
    this.$summary.textContent = sum;
  }
  renderAll(){
    this.renderStatus(); this.renderCards(); this.renderBetGrid(); this.renderSideGrid();
    this.renderStats(); this.renderBadge();
  }
}
