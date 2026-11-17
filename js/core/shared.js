'use strict';

/* ================= CẤU HÌNH ================= */
const CFG = { startBalance: 100_000_000, chips: [5_000,10_000,20_000,50_000,100_000,200_000,500_000,1_000_000,5_000_000,10_000_000], betTime: 12, resultTime: 5 };
const TABLES = [
  { name:'Baccarat T1',    id:'186269422', players:10, nc:false },
  { name:'Baccarat NC T1', id:'186269411', players:24, nc:true, autoBtn:true, showAutoBtn:false },
  { name:'Baccarat T2',    id:'186269439', players:25, nc:false },
  { name:'Baccarat T3',    id:'186269452', players:39, nc:false },
  { name:'Baccarat T4',    id:'186269440', players:25, nc:false },
  { name:'Baccarat T5',    id:'186269453', players:39, nc:false },
  { name:'Baccarat NC T2', id:'186269423', players:9,  nc:true },
  { name:'Baccarat Luôn 8', id:'186269454', players:24, bankerMark:'8', payouts:{P:2.54,T:9,B:1.46} }
];
const MAIN_OPTS = [
  {k:'P', n:'Người chơi', o:'2.00'}, {k:'T', n:'Hòa', o:'9.00'}, {k:'B', n:'Nhà cái', o:'1.95'},
  {k:'PP', n:'Đôi Người Chơi', o:'12.00'}, {k:'AP', n:'Đôi Bất Kỳ', o:'6.00'}, {k:'BP', n:'Đôi Nhà Cái', o:'12.00'}
];
const SIDE_OPTS = [
  {k:'CT', n:'Tài [5-6]', o:'1.50'}, {k:'CX', n:'Xỉu [4]', o:'2.50'},
  {k:'PTAI', n:'P.Tài [8-9]', o:'1.80', mini:1}, {k:'PXIU', n:'P.Xỉu [0-5]', o:'2.03', mini:1},
  {k:'BTAI', n:'B.Tài [8-9]', o:'1.90', mini:1}, {k:'BXIU', n:'B.Xỉu [0-5]', o:'1.93', mini:1}
];
const TABS = [['res','P/B'],['pb','Tỷ lệ'],['ou','O/U'],['pbs','P-B/S'],['bbs','B-B/S']];
const WIN_TXT = {P:'Người chơi thắng', B:'Nhà cái thắng', T:'Hòa'};
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♣','♦','♥','♠'];

/* ================= STATE TOÀN CỤC ================= */
let balance = CFG.startBalance;
let selectedChip = CFG.chips[1];
let toastTimer;
let lastBetAction = null;
const $ = s => document.querySelector(s);

function fmtMoney(n){ return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtChips(n){
  const unit = n >= 1_000_000_000 ? 1_000_000_000 : n >= 1_000_000 ? 1_000_000 : n >= 1_000 ? 1_000 : 1;
  const suffix = unit === 1_000_000_000 ? 'B' : unit === 1_000_000 ? 'M' : unit === 1_000 ? 'k' : '';
  return (n/unit).toLocaleString('en-US',{maximumFractionDigits:1}) + suffix;
}
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('show'), 2200); }
function setBalance(flash){
  const el = $('#bal'); el.textContent = fmtMoney(balance);
  if (flash){ el.classList.remove('up','down'); void el.offsetWidth;
    el.classList.add(flash>0?'up':'down'); setTimeout(()=>el.classList.remove('up','down'),1200); }
}
function canChangeLastBet(){
  const action=lastBetAction;
  return !!action&&action.table.phase==='BETTING'&&action.amount>0&&(action.table.user[action.key]||0)>=action.amount;
}
function updateBetActions(){
  const disabled=!canChangeLastBet();
  $('#undo-bet').disabled=disabled;
  $('#double-bet').disabled=disabled;
}
function rememberBetAction(table,key,amount){
  lastBetAction={table,key,amount};
  updateBetActions();
}
function clearLastBetAction(table){
  if(lastBetAction&&lastBetAction.table===table){
    lastBetAction=null;
    updateBetActions();
  }
}
function renderUserBets(table){
  if(typeof table.renderBets==='function')table.renderBets();
  else{
    ['renderBetGrid','renderSideGrid','renderCountBets','renderTrackBets'].forEach(method=>{
      if(typeof table[method]==='function')table[method]();
    });
  }
}
function undoLastBet(){
  if(!canChangeLastBet()){lastBetAction=null;updateBetActions();return;}
  const {table,key,amount}=lastBetAction;
  table.user[key]-=amount;
  if(!table.user[key])delete table.user[key];
  balance+=amount;
  lastBetAction=null;
  setBalance(amount);
  renderUserBets(table);
  updateBetActions();
}
function doubleLastBet(){
  if(!canChangeLastBet()){lastBetAction=null;updateBetActions();return;}
  const {table,key}=lastBetAction,amount=table.user[key];
  if(balance<amount){toast('Không đủ số dư');return;}
  balance-=amount;
  table.user[key]=amount*2;
  lastBetAction={table,key,amount};
  setBalance(-amount);
  renderUserBets(table);
  updateBetActions();
}
function pickW(pool,w){
  let t = w.reduce((a,b)=>a+b,0), r = Math.random()*t;
  for (let i=0;i<pool.length;i++){ r -= w[i]; if (r<=0) return pool[i]; }
  return pool[pool.length-1];
}
function startTableWithRandomPhase(table){
  if(Math.random()<.5){
    table.firstBet=0;
    table.lock();
  } else table.startBetting();
}

function renderBigRoad(history, renderContent){
  const cells = [], occupied = new Set();
  let startCol = -1, col = 0, row = 0, tail = false, last = null;
  let leadingTies = 0, leadingPP = false, leadingBP = false;
  for (const h of history){
    if (h.w === 'T'){
      if (last){
        last.ties++;
        last.pp ||= h.pp;
        last.bp ||= h.bp;
      } else {
        leadingTies++;
        leadingPP ||= h.pp;
        leadingBP ||= h.bp;
      }
      continue;
    }
    if (!last || last.w !== h.w){
      col = ++startCol;
      row = 0;
      tail = false;
      while (occupied.has(col + ',0')) col = ++startCol;
    } else if (!tail && row < 5 && !occupied.has(col + ',' + (row + 1))){
      row++;
    } else {
      tail = true;
      do { col++; } while (occupied.has(col + ',' + row));
    }
    last = { ...h, col, row, ties:leadingTies, pp:h.pp || leadingPP, bp:h.bp || leadingBP };
    leadingTies = 0; leadingPP = false; leadingBP = false;
    cells.push(last);
    occupied.add(col + ',' + row);
  }
  if (!last && leadingTies) cells.push({ w:'T', col:0, row:0, ties:leadingTies, pp:leadingPP, bp:leadingBP });
  return cells.map(c=>{
    const cls = c.w === 'P' || c.w === 'L' ? 'p' : c.w === 'T' || c.w === 'A' ? 't' : 'b';
    const label = c.label || (c.w === 'P' ? 'Người chơi' : c.w === 'B' ? 'Nhà cái' : c.w === 'C' ? 'Chẵn' : c.w === 'L' ? 'Lẻ' : 'Hòa');
    const content = renderContent ? renderContent(c) :
      (c.bp ? '<i class="pair banker"></i>' : '') + (c.pp ? '<i class="pair player"></i>' : '') +
      (c.ties > 1 ? '<small class="tie-count">' + c.ties + '</small>' : '');
    return '<span class="bead ' + cls + (c.dm ? ' slash' : '') + (c.ties ? ' tslash' : '') + '" style="grid-column:' + (c.col + 1) + ';grid-row:' + (c.row + 1) + '" role="img" aria-label="' + label + (c.ties ? ', ' + c.ties + ' ván hòa' : '') + (c.pp ? ', đôi Người chơi' : '') + (c.bp ? ', đôi Nhà cái' : '') + (c.dm ? ', đồng màu' : '') + '">' + content + '</span>';
  }).join('');
}
