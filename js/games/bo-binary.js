'use strict';

const BO_SYMBOLS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT'];
const BO_ROUND_MS = 10000;
const BO_NEXT_ROUND_DELAY_MS = 5000;
const BO_PAYOUT = 0.8;
const BO_COLOR_PAYOUT = {RED:1.95,PURPLE:4.87,GREEN:1.95};
const BO_DIGITS = Array.from({length:10},(_,digit)=>digit);
const BO_DIGIT_PAYOUT = 9.7;

function boEmptyUserBets(){
  const user={UP:0,DOWN:0,RED:0,PURPLE:0,GREEN:0};
  BO_DIGITS.forEach(digit=>{user['DIGIT_'+digit]=0;});
  return user;
}

function boFormatPrice(value,symbol='BTCUSDT'){
  if(!Number.isFinite(value))return '—';
  const decimals=BINANCE_BO_PRICE_DECIMALS[symbol]||2;
  return value.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:value<1?Math.max(decimals,6):decimals});
}

function boColorOutcome(digit){
  if([1,3,7,9].includes(digit))return {label:'Xanh lá',shares:{GREEN:1}};
  if([2,4,6,8].includes(digit))return {label:'Đỏ',shares:{RED:1}};
  if(digit===0)return {label:'Nửa đỏ / nửa tím',shares:{RED:.5,PURPLE:.5}};
  if(digit===5)return {label:'Nửa xanh / nửa tím',shares:{GREEN:.5,PURPLE:.5}};
  throw new Error('Chữ số thanh toán không hợp lệ: '+digit);
}

class BinanceBOTable {
  constructor(){
    this.name='Binance BO'; this.id='BINANCE SPOT'; this.symbol='BTCUSDT'; this.interval='1m';
    this.phase='CONNECTING'; this.connectionState='connecting';
    this.price=null; this.candle=null; this.round=null; this.user=boEmptyUserBets(); this.lastResult=null;
    this.roundNumber=0; this.nextRoundAt=null; this.nextRoundTimer=null;
    this.history=[]; this.build(); this.market=new BinanceBOSimulation(this.$chart);
    this.$symbol.addEventListener('change',()=>this.changeMarket());
    this.$interval.addEventListener('change',()=>this.changeMarket());
    this.el.addEventListener('click',event=>{
      const button=event.target.closest('[data-k]');
      if(!button||!this.el.contains(button))return;
      this.placeBet(button.dataset.k);
    });
    this.startMarket();
    this.clockTimer=setInterval(()=>this.renderClock(),250);
  }
  build(){
    const el=document.createElement('section');
    el.className='table-card bo-table';
    el.setAttribute('aria-label','Binance BO nhị phân');
    const digitButtons=BO_DIGITS.map(digit=>{
      const colorClass=digit===0?'split-red':digit===5?'split-green':Object.keys(boColorOutcome(digit).shares)[0].toLowerCase();
      return '<button type="button" class="betbtn bo-digit-option bo-digit-'+colorClass+'" data-type="digit" data-k="DIGIT_'+digit+'" disabled>'+
        '<span class="b-name">'+digit+'</span><span class="b-odds">Trả 9.7×</span><span class="bo-stake b-user" hidden></span></button>';
    }).join('');
    el.innerHTML=
      '<div class="card-head"><div class="card-title"><div class="title-row"><div class="t-name">BO Nhị phân</div></div><div class="t-id">Phiên #<span class="bo-session">—</span></div></div><div class="bo-round-toolbar"><span>Giá vào <strong class="bo-entry">—</strong></span><span><span class="bo-countdown-label">Kết thúc</span> <strong class="bo-countdown">—</strong></span></div><div class="bo-feed-status connecting" aria-live="polite" hidden></div></div>'+
      '<div class="felt bo-felt"><div class="bo-market-controls"><div class="bo-market-price"><span class="bo-pair-label">BTC / USDT</span><strong class="bo-price">—</strong></div>'+
      '<div class="bo-selectors"><label>Cặp<select class="bo-symbol" aria-label="Cặp Binance"></select></label><label>TF<select class="bo-interval" aria-label="Khung nến"><option value="1s">1 giây</option><option value="1m">1 phút</option><option value="3m">3 phút</option></select></label></div></div>'+
      '<canvas class="bo-chart" role="img" aria-label="Biểu đồ giá Binance"></canvas>'+
      '<div class="bo-candle-info"></div></div>'+
      '<div class="bo-round-panel"><div class="bo-round-info"><span class="bo-round-phase">Chờ dữ liệu Binance</span></div>'+
      '<div class="bet-wrap bo-bet-wrap locked"><div class="bet-grid bo-bet-grid">'+
      '<button type="button" class="betbtn bo-option bo-up" data-k="UP" disabled><span class="b-name">LÊN</span><span class="b-odds">Trả 1.80×</span><span class="bo-stake b-user" hidden></span></button>'+
      '<button type="button" class="betbtn bo-option bo-down" data-k="DOWN" disabled><span class="b-name">XUỐNG</span><span class="b-odds">Trả 1.80×</span><span class="bo-stake b-user" hidden></span></button>'+
      '</div></div><div class="bo-color-panel"><div class="sec-title">Đoán màu theo số cuối</div><div class="bet-grid bo-color-grid">'+
      '<button type="button" class="betbtn bo-color-option bo-color-red" data-type="color" data-k="RED" disabled><span class="b-name">ĐỎ</span><span class="b-odds">Trả 1.95×</span><span class="bo-stake b-user" hidden></span></button>'+
      '<button type="button" class="betbtn bo-color-option bo-color-purple" data-type="color" data-k="PURPLE" disabled><span class="b-name">TÍM</span><span class="b-odds">Trả 4.87×</span><span class="bo-stake b-user" hidden></span></button>'+
      '<button type="button" class="betbtn bo-color-option bo-color-green" data-type="color" data-k="GREEN" disabled><span class="b-name">XANH</span><span class="b-odds">Trả 1.95×</span><span class="bo-stake b-user" hidden></span></button>'+
      '</div><div class="bo-color-result" aria-live="polite"></div></div><div class="bo-digit-panel"><div class="sec-title">Đoán số</div><div class="bet-grid bo-digit-grid">'+digitButtons+'</div></div></div>'+
      '<div class="stats bo-stats"><div class="sec-title">Cầu 50 round gần nhất</div><div class="bo-history" aria-label="Cầu 50 round gần nhất"></div></div>';
    document.getElementById('tables').appendChild(el);
    this.el=el; this.$status=el.querySelector('.bo-feed-status'); this.$price=el.querySelector('.bo-price');
    this.$pairLabel=el.querySelector('.bo-pair-label'); this.$symbol=el.querySelector('.bo-symbol');
    this.$interval=el.querySelector('.bo-interval'); this.$chart=el.querySelector('.bo-chart');
    this.$candleInfo=el.querySelector('.bo-candle-info'); this.$phase=el.querySelector('.bo-round-phase');
    this.$entry=el.querySelector('.bo-entry'); this.$countdown=el.querySelector('.bo-countdown');
    this.$countdownLabel=el.querySelector('.bo-countdown-label'); this.$session=el.querySelector('.bo-session');
    this.$betWrap=el.querySelector('.bo-bet-wrap'); this.$history=el.querySelector('.bo-history');
    this.$buttons={UP:el.querySelector('.bo-up'),DOWN:el.querySelector('.bo-down')};
    this.$colorButtons={RED:el.querySelector('.bo-color-red'),PURPLE:el.querySelector('.bo-color-purple'),GREEN:el.querySelector('.bo-color-green')};
    this.$colorResult=el.querySelector('.bo-color-result');
    this.$digitButtons={}; this.$digitStakes={};
    BO_DIGITS.forEach(digit=>{
      const key='DIGIT_'+digit;
      this.$digitButtons[key]=el.querySelector('[data-k="'+key+'"]');
      this.$digitStakes[key]=this.$digitButtons[key].querySelector('.bo-stake');
    });
    this.$stakes={UP:this.$buttons.UP.querySelector('.bo-stake'),DOWN:this.$buttons.DOWN.querySelector('.bo-stake')};
    this.$colorStakes={};
    Object.keys(this.$colorButtons).forEach(color=>{this.$colorStakes[color]=this.$colorButtons[color].querySelector('.bo-stake');});
    this.$symbol.innerHTML=BO_SYMBOLS.map(symbol=>'<option value="'+symbol+'">'+symbol.replace('USDT',' / USDT')+'</option>').join('');
    this.$symbol.value=this.symbol; this.$interval.value=this.interval;
  }
  startMarket(){
    this.market.start(this.symbol,this.interval,update=>this.updateMarket(update),(state,message)=>this.updateConnection(state,message));
  }
  changeMarket(){
    const hasBets=this.phase==='BETTING'&&Object.values(this.user).some(amount=>amount>0);
    if(hasBets){
      this.$symbol.value=this.symbol; this.$interval.value=this.interval;
      toast('Hãy chờ ván hiện tại kết thúc trước khi đổi cặp hoặc khung nến.');
      return;
    }
    clearTimeout(this.nextRoundTimer); this.nextRoundTimer=null; this.nextRoundAt=null;
    this.symbol=this.$symbol.value; this.interval=this.$interval.value;
    this.phase='CONNECTING';
    this.round=null; this.candle=null; this.price=null; this.user=boEmptyUserBets(); this.lastResult=null; this.history=[];
    this.$pairLabel.textContent=this.symbol.replace('USDT',' / USDT');
    this.$price.textContent='—'; this.$entry.textContent='—'; this.$countdown.textContent='—';
    this.$phase.textContent='Đang chờ dữ liệu Binance'; this.$history.innerHTML='';
    this.$colorResult.textContent=''; this.$colorResult.className='bo-color-result';
    this.renderBets(); this.startMarket();
  }
  updateConnection(state,message){
    this.connectionState=state;
    const showStatus=state==='error'||state==='reconnecting';
    this.$status.hidden=!showStatus; this.$status.textContent=showStatus?message:'';
    this.$status.className='bo-feed-status '+state;
    this.renderClock();
  }
  updateMarket(update){
    this.price=update.price; this.candle=update.candle;
    this.$price.textContent=boFormatPrice(this.price,this.symbol);
    this.$candleInfo.textContent='O '+boFormatPrice(update.candle.open,this.symbol)+'  H '+boFormatPrice(update.candle.high,this.symbol)+
      '  L '+boFormatPrice(update.candle.low,this.symbol)+'  C '+boFormatPrice(update.candle.close,this.symbol);
    if(!this.round){
      this.beginRound(this.price);
    }else if(this.phase==='BETTING'&&Date.now()>=this.round.expiresAt){
      this.settle(this.price);
    }else if(this.phase==='RESULT'&&this.nextRoundAt&&Date.now()>=this.nextRoundAt){
      this.startNextRound();
    }
    this.renderClock();
  }
  beginRound(price){
    clearLastBetAction(this);
    const time=Date.now();
    this.roundNumber++;
    this.round={id:this.roundNumber,time,entry:Number(price),expiresAt:time+BO_ROUND_MS};
    this.$session.textContent=String(this.roundNumber).padStart(6,'0');
    this.phase='BETTING'; this.user=boEmptyUserBets(); this.lastResult=null;
    this.$colorResult.textContent=''; this.$colorResult.className='bo-color-result';
    this.$entry.textContent=boFormatPrice(this.round.entry,this.symbol);
    this.$phase.textContent='Đặt cược trong 10 giây';
    this.renderBets(); this.renderHistory();
  }
  settle(closePrice){
    if(!this.round||this.phase!=='BETTING')return;
    clearLastBetAction(this);
    const close=Number(closePrice),entry=this.round.entry;
    const direction=close>entry?'UP':close<entry?'DOWN':'TIE';
    const displayedPrice=boFormatPrice(close,this.symbol).replace(/,/g,'');
    const digit=Number(displayedPrice.replace(/\D/g,'').slice(-1));
    const color=boColorOutcome(digit);
    this.lastResult={round:this.round.id,direction,entry,close,time:this.round.time,symbol:this.symbol,digit,colorShares:color.shares,colorLabel:color.label};
    this.history.unshift(this.lastResult); if(this.history.length>50)this.history.pop();
    let profit=0;
    ['UP','DOWN'].forEach(side=>{
      const stake=this.user[side];
      if(direction==='TIE')balance+=stake;
      else if(direction===side){balance+=stake*(1+BO_PAYOUT);profit+=stake*BO_PAYOUT;}
    });
    Object.keys(BO_COLOR_PAYOUT).forEach(colorKey=>{
      const stake=this.user[colorKey],share=color.shares[colorKey]||0;
      if(!stake||!share)return;
      const returned=stake*(1+(BO_COLOR_PAYOUT[colorKey]-1)*share);
      balance+=returned; profit+=returned-stake;
    });
    const digitStake=this.user['DIGIT_'+digit]||0;
    if(digitStake){
      const returned=digitStake*BO_DIGIT_PAYOUT;
      balance+=returned; profit+=returned-digitStake;
    }
    setBalance(profit>0?1:0);
    const directionLabel=direction==='TIE'?'Giá không đổi — hoàn vốn':direction==='UP'?'Giá tăng':'Giá giảm';
    this.phase='RESULT'; this.$phase.textContent=directionLabel+' · Số '+digit+' — '+color.label;
    const colorClass=Object.keys(color.shares).length>1?'split':Object.keys(color.shares)[0].toLowerCase();
    this.$colorResult.textContent='Số cuối '+digit+' · '+color.label;
    this.$colorResult.className='bo-color-result '+colorClass;
    this.renderBets(); this.renderHistory();
    if(profit>0)toast('Binance BO: Bạn thắng +'+fmtMoney(profit));
    this.nextRoundAt=Date.now()+BO_NEXT_ROUND_DELAY_MS;
    clearTimeout(this.nextRoundTimer);
    this.nextRoundTimer=setTimeout(()=>this.startNextRound(),BO_NEXT_ROUND_DELAY_MS);
  }
  startNextRound(){
    if(this.phase!=='RESULT'||!this.nextRoundAt||Date.now()<this.nextRoundAt)return;
    if(this.connectionState!=='live'||!Number.isFinite(this.price)){
      this.renderClock(); return;
    }
    clearTimeout(this.nextRoundTimer); this.nextRoundTimer=null; this.nextRoundAt=null;
    this.beginRound(this.price);
    this.renderClock();
  }
  placeBet(side){
    if(this.phase!=='BETTING'||this.connectionState!=='live'||!this.round||Date.now()>=this.round.expiresAt){
      toast('Chỉ nhận cược khi giá Binance đang cập nhật và round còn mở.');
      return;
    }
    if(balance<selectedChip){toast('Không đủ số dư');return;}
    balance-=selectedChip; this.user[side]+=selectedChip;
    rememberBetAction(this,side,selectedChip); setBalance(); this.renderBets();
  }
  renderBets(){
    const canBet=this.phase==='BETTING'&&this.connectionState==='live'&&this.round&&Date.now()<this.round.expiresAt;
    this.$betWrap.classList.toggle('locked',!canBet);
    Object.keys(this.$buttons).forEach(side=>{
      const button=this.$buttons[side],stake=this.user[side]||0;
      button.disabled=!canBet;
      button.classList.toggle('win',this.phase==='RESULT'&&this.lastResult&&this.lastResult.direction===side);
      button.classList.toggle('lose',this.phase==='RESULT'&&this.lastResult&&this.lastResult.direction!=='TIE'&&this.lastResult.direction!==side);
      this.$stakes[side].hidden=!stake;
      this.$stakes[side].textContent=stake?fmtChips(stake):'';
    });
    Object.keys(this.$colorButtons).forEach(color=>{
      const button=this.$colorButtons[color],stake=this.user[color]||0;
      const share=this.lastResult&&this.lastResult.colorShares[color]||0;
      button.disabled=!canBet;
      button.classList.toggle('win',this.phase==='RESULT'&&share>0);
      button.classList.toggle('lose',this.phase==='RESULT'&&!share);
      this.$colorStakes[color].hidden=!stake;
      this.$colorStakes[color].textContent=stake?fmtChips(stake):'';
    });
    Object.keys(this.$digitButtons).forEach(key=>{
      const button=this.$digitButtons[key],digit=Number(key.slice(6)),stake=this.user[key]||0;
      button.disabled=!canBet;
      button.classList.toggle('win',this.phase==='RESULT'&&this.lastResult&&digit===this.lastResult.digit);
      button.classList.toggle('lose',this.phase==='RESULT'&&this.lastResult&&digit!==this.lastResult.digit);
      this.$digitStakes[key].hidden=!stake;
      this.$digitStakes[key].textContent=stake?fmtChips(stake):'';
    });
  }
  renderClock(){
    if(this.phase==='RESULT'&&this.nextRoundAt){
      const seconds=Math.max(0,Math.ceil((this.nextRoundAt-Date.now())/1000));
      this.$countdownLabel.textContent='Round mới';
      this.$countdown.textContent=seconds+'s';
    }else if(this.round){
      this.$countdownLabel.textContent='Kết thúc';
      const seconds=Math.max(0,Math.ceil((this.round.expiresAt-Date.now())/1000));
      this.$countdown.textContent=seconds+'s';
      if(this.phase==='BETTING'&&seconds===0)this.$phase.textContent='Đang chờ giá chốt…';
    }
    this.renderBets();
  }
  renderHistory(){
    if(!this.history.length){this.$history.innerHTML='<span class="bo-road-empty">Chưa có round đã chốt</span>';return;}
    this.$history.innerHTML=this.history.slice(0,50).reverse().map(result=>{
      const label=result.direction==='TIE'?'HÒA':result.direction==='UP'?'LÊN':'XUỐNG';
      const colorClass=result.digit===0?'split-red':result.digit===5?'split-green':result.colorShares.GREEN?'green':'red';
      const details='Phiên #'+String(result.round).padStart(6,'0')+' · '+
        new Date(result.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' · '+
        boFormatPrice(result.entry,result.symbol)+' → '+boFormatPrice(result.close,result.symbol)+' · '+label+' · '+result.colorLabel;
      return '<span class="bo-road-cell bo-road-'+colorClass+'" title="'+details+'" aria-label="'+details+'">'+result.digit+'</span>';
    }).join('');
  }
}
