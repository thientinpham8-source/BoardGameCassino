'use strict';

class RouletteTable {
  constructor(cfg){
    Object.assign(this,cfg);
    this.phase='BETTING'; this.tLeft=CFG.betTime; this.firstBet=Math.floor(Math.random()*8);
    this.resLeft=CFG.resultTime; this.roll=null; this.lastRes=null;
    this.user={}; this.bots={}; this.timers=[]; this.tab='res'; this.frame=null;
    this.wheelAngle=0; this.ballAngle=0; this.radius=99;
    this.hist=Array.from({length:80},rlRoll);
    this.build(); startTableWithRandomPhase(this);
    setInterval(()=>this.fluctuate(),15000);
  }
  schedule(fn,ms){ this.timers.push(setTimeout(fn,ms)); }
  clearTimers(){ this.timers.forEach(clearTimeout); this.timers=[]; }
  build(){
    const el=document.createElement('section');
    el.className='table-card rl'; el.setAttribute('aria-label',this.name);
    el.innerHTML='<div class="card-head"><div class="card-title"><div class="title-row"><div class="t-name">'+this.name+'</div>'+
      '<div class="pbadge" title="Số người chơi"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="6" r="2.5"/><path d="M2 16v-1a5 5 0 0 1 10 0v1M13 4a2.5 2.5 0 0 1 0 5M14 11a4 4 0 0 1 4 4v1"/></svg><span class="p-count">'+this.players+'</span></div></div><div class="t-id"># '+this.id+'</div></div></div>'+
      '<div class="felt"><div class="f-status"></div><div class="roulette-stage" role="img" aria-label="Bánh xe Roulette 13 ô, từ 0 đến 12"><div class="roulette-camera"><div class="roulette-wheel"></div><div class="roulette-rotor">'+rouletteSvg()+'</div><div class="roulette-track"></div><div class="roulette-hub"></div><div class="roulette-ball"></div></div></div></div>'+
      '<div class="bet-wrap"><div class="rl-bets"></div></div>'+
      '<div class="stats"><div class="sec-title">Thống kê 100 ván trước</div><div class="tabs"></div><div class="road"></div><div class="summary"></div></div>';
    document.getElementById('tables').appendChild(el); this.el=el;
    this.$status=el.querySelector('.f-status'); this.$stage=el.querySelector('.roulette-stage');
    this.$rotor=el.querySelector('.roulette-rotor'); this.$ball=el.querySelector('.roulette-ball');
    this.$betWrap=el.querySelector('.bet-wrap'); this.$bets=el.querySelector('.rl-bets');
    this.$tabs=el.querySelector('.tabs'); this.$road=el.querySelector('.road'); this.$summary=el.querySelector('.summary');
    this.$bets.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b)this.placeBet(b.dataset.k);});
    this.$tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){this.tab=b.dataset.tab;this.renderStats();}});
    this.renderWheel();
  }
  startBetting(){
    this.clearTimers(); this.phase='BETTING'; this.tLeft=CFG.betTime-this.firstBet; this.firstBet=0; this.highlightPocket(null);
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
    const k=RL_OPTS[Math.floor(Math.random()*RL_OPTS.length)].k;
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
    this.clearTimers(); this.phase='SPINNING'; this.roll=rlRoll();
    this.$betWrap.classList.add('locked'); this.renderBets(); this.renderStatus();
    this.$stage.setAttribute('aria-label','Bánh xe và viên bi đang quay');
    const norm=a=>(a%360+360)%360;
    const fromWheel=this.wheelAngle, fromBall=this.ballAngle;
    this.targetWheel=fromWheel+360*(5+Math.floor(Math.random()*3))+Math.random()*360;
    const pocketAngle=this.targetWheel+RL_ORDER.indexOf(this.roll)*360/13;
    this.targetBall=fromBall-360*(8+Math.floor(Math.random()*3))-norm(fromBall-pocketAngle);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=reduced?650:7000, started=performance.now();
    const animate=now=>{
      if(this.phase!=='SPINNING')return;
      const p=Math.min(1,(now-started)/duration);
      this.wheelAngle=fromWheel+(this.targetWheel-fromWheel)*(1-Math.pow(1-p,3));
      this.ballAngle=fromBall+(this.targetBall-fromBall)*(1-Math.pow(1-p,2.5));
      const drop=Math.max(0,Math.min(1,(p-.58)/.34));
      this.radius=99-30*drop*drop*(3-2*drop)+(drop>0&&drop<1?Math.sin(p*90)*2*(1-drop):0);
      this.renderWheel();
      if(p<1)this.frame=requestAnimationFrame(animate);
    };
    if(!reduced)this.frame=requestAnimationFrame(animate);
    this.schedule(()=>this.finish(),duration);
  }
  renderWheel(){
    this.$rotor.style.transform='rotate('+this.wheelAngle+'deg)';
    const angle=this.ballAngle*Math.PI/180;
    this.$ball.style.transform='translate('+(Math.sin(angle)*this.radius)+'px,'+(-Math.cos(angle)*this.radius)+'px)';
  }
  highlightPocket(number){
    this.$rotor.querySelectorAll('[data-pocket]').forEach(pocket=>{
      pocket.classList.toggle('winner',number!==null&&Number(pocket.dataset.pocket)===number);
    });
  }
  finish(){
    if(this.phase!=='SPINNING')return;
    this.clearTimers(); cancelAnimationFrame(this.frame); this.frame=null;
    this.wheelAngle=(this.targetWheel%360+360)%360; this.ballAngle=(this.targetBall%360+360)%360; this.radius=69; this.renderWheel();
    this.lastRes=this.roll; this.phase='RESULT'; this.resLeft=CFG.resultTime;
    this.highlightPocket(this.lastRes);
    let profit=0;
    for(const k in this.user){const m=rlMult(k,this.lastRes);if(m>0){balance+=this.user[k]*(1+m);profit+=this.user[k]*m;}}
    setBalance(profit>0?1:0);
    this.hist.unshift(this.lastRes); if(this.hist.length>100)this.hist.pop();
    this.$stage.setAttribute('aria-label','Viên bi dừng tại số '+this.lastRes+', '+(this.lastRes===0?'xanh':RL_RED.has(this.lastRes)?'đỏ':'đen'));
    this.renderAll(); if(profit>0)toast(this.name+': Bạn thắng +'+fmtMoney(profit));
    this.resultTick();
  }
  resultTick(){
    if(this.phase!=='RESULT')return;
    if(this.resLeft<=0){this.startBetting();return;}
    this.renderStatus();this.schedule(()=>{this.resLeft--;this.resultTick();},1000);
  }
  renderStatus(){
    if(this.phase==='BETTING')this.$status.textContent='Đặt cược — còn '+this.tLeft+'s';
    else if(this.phase==='SPINNING')this.$status.textContent='Bánh xe đang quay…';
    else {
      const n=this.lastRes, color=n===0?'Số 0':RL_RED.has(n)?'Đỏ':'Đen';
      this.$status.innerHTML='<span class="f-result '+(n===0?'rt':RL_RED.has(n)?'rb':'')+'">'+n+' · '+color+'</span> · Ván mới sau '+this.resLeft+'s';
    }
  }
  renderBets(){
    this.$bets.innerHTML=['size','color','parity','number'].map(row=>'<div class="rl-row'+(row==='number'?' rl-numbers':'')+'">'+RL_OPTS.filter(o=>o.row===row).map(o=>{
      const u=this.user[o.k]||0, bot=this.bots[o.k]||0;
      const color=row==='number'?rlColor(Number(o.n)):o.k==='D'?'black':o.k==='R'?'red':'';
      const state=this.phase==='RESULT'?(rlMult(o.k,this.lastRes)>0?' win':' lose'):'';
      return '<button type="button" class="betbtn '+(color?color+'-door':'')+state+'" data-k="'+o.k+'" aria-label="Cược '+(row==='number'?'số ':'')+o.n+'; trả '+(row==='number'?'12':o.o)+' lần vốn"><span class="b-name">'+o.n+'</span><span class="b-odds">'+o.o+'</span>'+
        (u?'<span class="b-user">'+fmtChips(u)+'</span>':'')+(bot?'<span class="b-total">'+fmtChips(bot)+'</span>':'')+'</button>';
    }).join('')+'</div>').join('');
  }
  renderStats(){
    const H=this.hist.slice(0,100), count=color=>H.filter(n=>rlColor(n)===color).length;
    this.$tabs.innerHTML=[['res','Kết quả'],['rate','Tỷ lệ'],['numbers','Số về']].map(([k,n])=>'<span class="tab'+(this.tab===k?' active':'')+'" data-tab="'+k+'">'+n+'</span>').join('');
    this.$road.classList.toggle('big',this.tab==='res');this.$road.classList.toggle('pb',this.tab==='rate');this.$road.classList.toggle('numbers',this.tab==='numbers');
    if(this.tab==='res'){
      this.$road.innerHTML=renderBigRoad(H.slice().reverse().map(n=>({w:n===0?'A':RL_RED.has(n)?'B':'P',label:'Số '+n+' · '+(n===0?'Xanh':RL_RED.has(n)?'Đỏ':'Đen')})));
      this.$road.scrollLeft=this.$road.scrollWidth;
    } else if(this.tab==='rate'){
      this.$road.innerHTML=[['black','Đen','#151d24'],['red','Đỏ','#a92124'],['zero','Số 0','#24754d']].map(([k,n,c])=>'<div class="pb-row"><span class="lbl">'+n+'</span><div class="pb-bar"><div class="pb-fill" style="width:'+(H.length?count(k)/H.length*100:0)+'%;background:'+c+'"></div></div><span class="pct">'+(H.length?count(k)/H.length*100:0).toFixed(1)+'%</span></div>').join('');
    } else {
      this.$road.innerHTML=Array.from({length:100},(_,i)=>i<H.length?'<span class="bead rl-'+rlColor(H[i])+'" role="img" aria-label="Số '+H[i]+'">'+H[i]+'</span>':'<span class="bead empty"></span>').join('');
    }
    this.$summary.textContent='Đen '+count('black')+' · Đỏ '+count('red')+' · Số 0 '+count('zero');
  }
  renderAll(){this.renderStatus();this.renderBets();this.renderStats();}
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
