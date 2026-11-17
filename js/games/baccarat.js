'use strict';

/* ================= GAME ENGINE: BACCARAT ================= */
function makeShoe(){
  const d = [];
  for (let i=0;i<8;i++) for (let r=0;r<13;r++) for (let s=0;s<4;s++) d.push({r,s});
  for (let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  return d;
}
const vOf = r => r >= 9 ? 0 : r + 1;              // A=1..9=9, 10/J/Q/K=0
const tot = cs => cs.reduce((a,c)=>a+vOf(c.r),0) % 10;
const BANKER_EIGHT_MARKER = {r:7,fixed:true};
function bDraw(b, p3){
  if (b<=2) return true;
  if (b===3) return p3!==8;
  if (b===4) return p3>=2 && p3<=7;
  if (b===5) return p3>=4 && p3<=7;
  if (b===6) return p3===6 || p3===7;
  return false;
}
function playRound(shoe, bankerMark=false){
  const p = [shoe.pop()], b = bankerMark ? [BANKER_EIGHT_MARKER] : [shoe.pop()];
  p.push(shoe.pop());
  b.push(shoe.pop());
  let p3 = null;
  if (tot(p)<8 && tot(b)<8){
    if (tot(p)<=5){ p3 = shoe.pop(); p.push(p3); }
    if (p3!==null){ if (bDraw(tot(b), vOf(p3.r))) b.push(shoe.pop()); }
    else if (tot(b)<=5) b.push(shoe.pop());
  }
  return {p, b};
}
function analyze(r){
  const pTotal = tot(r.p), bTotal = tot(r.b);
  const pair = cs => {
    const cards=cs.filter(c=>!c.fixed);
    return cards.length>1 && (cards[0].r===cards[1].r || (cards[2] && (cards[0].r===cards[2].r || cards[1].r===cards[2].r)));
  };
  return { pTotal, bTotal, winner: pTotal>bTotal?'P':bTotal>pTotal?'B':'T',
           pPair: pair(r.p), bPair: pair(r.b), cards: r.p.length + r.b.filter(c=>!c.fixed).length };
}
function multFor(key, res, nc, payouts){
  const payout = payouts && Object.prototype.hasOwnProperty.call(payouts,key) ? payouts[key]-1 : undefined;
  switch(key){
    case 'P': return res.winner==='P' ? (payout===undefined?1:payout) : res.winner==='T' ? 0 : -1;
    case 'B': if (res.winner!=='B') return res.winner==='T' ? 0 : -1;
              return payout===undefined ? (nc ? (res.bTotal===6 ? 0.5 : 1) : 0.95) : payout;
    case 'T': return res.winner==='T' ? (payout===undefined?8:payout) : -1;
    case 'PP': return res.pPair ? 11 : -1;
    case 'BP': return res.bPair ? 11 : -1;
    case 'AP': return (res.pPair||res.bPair) ? 5 : -1;
    case 'CT': return res.cards>=5 ? 0.5 : -1;
    case 'CX': return res.cards===4 ? 1.5 : -1;
    case 'PTAI': return res.pTotal>=8 ? 0.8 : res.pTotal<=5 ? -1 : 0;
    case 'PXIU': return res.pTotal<=5 ? 1.03 : res.pTotal>=8 ? -1 : 0;
    case 'BTAI': return res.bTotal>=8 ? 0.9 : res.bTotal<=5 ? -1 : 0;
    case 'BXIU': return res.bTotal<=5 ? 0.93 : res.bTotal>=8 ? -1 : 0;
  }
  return -1;
}
function ptRand(){ const r = Math.random(); return r<0.13 ? 0 : Math.ceil((r-0.13)/0.0967); }
function seedHist(n){
  const a = [];
  for (let i=0;i<n;i++){
    const r = Math.random();
    a.push({ w: r<0.452?'P':r<0.952?'B':'T', pp: Math.random()<0.09, bp: Math.random()<0.09,
             c: Math.random()<0.35?4:Math.random()<0.86?5:6, pt: ptRand(), bt: ptRand() });
  }
  return a;
}
