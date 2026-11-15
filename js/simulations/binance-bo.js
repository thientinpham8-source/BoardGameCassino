'use strict';

const BINANCE_BO_API = 'https://api.binance.com/api/v3';
const BINANCE_BO_STREAM = 'wss://stream.binance.com:9443/ws';
const BINANCE_BO_INTERVALS = {'1s':1000,'1m':60000,'3m':180000};
const BINANCE_BO_PRICE_DECIMALS = {BTCUSDT:2,ETHUSDT:2,BNBUSDT:2,SOLUSDT:2};
const BINANCE_BO_POLL_MS = 500;

class BinanceBOSimulation {
  constructor(canvas){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.symbol='BTCUSDT'; this.interval='1m'; this.intervalMs=BINANCE_BO_INTERVALS[this.interval];
    this.candles=[]; this.price=null; this.socket=null; this.active=false; this.generation=0;
    this.retryTimer=null; this.pollTimer=null; this.updateFrame=null; this.pendingUpdate=null; this.controller=null;
    this.lastTradeId=null;
    this.onUpdate=()=>{}; this.onStatus=()=>{};
  }
  start(symbol,interval,onUpdate,onStatus){
    this.stop();
    if(!BINANCE_BO_INTERVALS[interval])throw new Error('Khung nến không được hỗ trợ: '+interval);
    this.symbol=symbol; this.interval=interval; this.intervalMs=BINANCE_BO_INTERVALS[interval];
    this.candles=[]; this.price=null; this.lastTradeId=null; this.onUpdate=onUpdate; this.onStatus=onStatus;
    this.active=true; const generation=this.generation;
    this.onStatus('connecting','Đang tải dữ liệu Binance…');
    this.controller=new AbortController();
    this.loadHistory(generation).then(()=>{
      if(!this.isCurrent(generation))return;
      this.scheduleMarketPoll(generation);
      this.connectSocket(generation);
    }).catch(error=>{
      if(!this.isCurrent(generation)||error.name==='AbortError')return;
      this.onStatus('error','Không tải được dữ liệu Binance: '+error.message);
      this.retryTimer=setTimeout(()=>this.start(this.symbol,this.interval,this.onUpdate,this.onStatus),5000);
    });
  }
  stop(){
    this.active=false; this.generation++;
    if(this.controller)this.controller.abort();
    if(this.socket){
      this.socket.onclose=null; this.socket.close(); this.socket=null;
    }
    clearTimeout(this.retryTimer); this.retryTimer=null;
    clearTimeout(this.pollTimer); this.pollTimer=null;
    if(this.updateFrame!==null)cancelAnimationFrame(this.updateFrame);
    this.updateFrame=null; this.pendingUpdate=null;
  }
  isCurrent(generation){return this.active&&generation===this.generation;}
  async loadHistory(generation){
    if(!/^[A-Z0-9]{5,20}$/.test(this.symbol))throw new Error('Cặp giao dịch không hợp lệ.');
    const path=this.interval==='1s'
      ? null
      : '/klines?symbol='+this.symbol+'&interval='+this.interval+'&limit=100';
    if(this.interval==='1s'){
      const trades=await this.loadTradeHistory(generation);
      if(!this.isCurrent(generation))return;
      this.lastTradeId=trades.length?trades[trades.length-1].id:null;
      this.candles=this.aggregateTrades(trades);
    }else{
      const response=await fetch(BINANCE_BO_API+path,{cache:'no-store',signal:this.controller.signal});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(!this.isCurrent(generation))return;
      if(!Array.isArray(data)||data.length===0)throw new Error('Binance không trả về dữ liệu nến.');
      this.candles=data.map(row=>({
        time:Number(row[0]),open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),
        close:Number(row[4]),volume:Number(row[5]),closed:Number(row[6])<Date.now()
      }));
    }
    if(!this.candles.length)throw new Error('Không có dữ liệu giá hợp lệ.');
    const latest=this.candles[this.candles.length-1];
    this.price=latest.close;
    this.dispatch(latest,latest.closed);
  }
  async loadTradeHistory(generation){
    const now=Date.now(),historyDuration=this.interval==='1s'?100*this.intervalMs:9*this.intervalMs;
    const startTime=Math.floor(now/this.intervalMs)*this.intervalMs-historyDuration;
    const trades=[]; let fromId=null;
    for(let page=0;page<50;page++){
      const paging=fromId===null?'startTime='+startTime:'fromId='+fromId;
      const url=BINANCE_BO_API+'/aggTrades?symbol='+this.symbol+'&'+paging+'&limit=1000';
      const response=await fetch(url,{cache:'no-store',signal:this.controller.signal});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(!this.isCurrent(generation))return [];
      if(!Array.isArray(data))throw new Error('Dữ liệu giao dịch Binance không hợp lệ.');
      if(!data.length)break;
      trades.push(...data);
      fromId=Number(data[data.length-1].a)+1;
      if(data.length<1000||Number(data[data.length-1].T)>=now)break;
      if(page===49)throw new Error('Lịch sử giao dịch 30 giây vượt giới hạn tải an toàn.');
    }
    return trades.map(trade=>({id:Number(trade.a),time:Number(trade.T),price:Number(trade.p),volume:Number(trade.q)}))
      .sort((a,b)=>a.time-b.time);
  }
  aggregateTrades(trades){
    const candles=[];
    trades.forEach(trade=>{
      if(!Number.isFinite(trade.time)||!Number.isFinite(trade.price))return;
      const time=Math.floor(trade.time/this.intervalMs)*this.intervalMs;
      let candle=candles[candles.length-1];
      if(!candle||candle.time!==time){
        candle={time,open:trade.price,high:trade.price,low:trade.price,close:trade.price,volume:0,closed:false};
        candles.push(candle);
      }
      candle.high=Math.max(candle.high,trade.price);
      candle.low=Math.min(candle.low,trade.price);
      candle.close=trade.price; candle.volume+=Number.isFinite(trade.volume)?trade.volume:0;
    });
    const now=Date.now();
    candles.forEach(candle=>{candle.closed=candle.time+this.intervalMs<=now;});
    return candles.slice(-100);
  }
  connectSocket(generation){
    if(!this.isCurrent(generation))return;
    const stream=this.interval==='1s'?this.symbol.toLowerCase()+'@aggTrade':this.symbol.toLowerCase()+'@kline_'+this.interval;
    let socket;
    try {socket=new WebSocket(BINANCE_BO_STREAM+'/'+stream);}
    catch(error){
      this.onStatus('reconnecting','Không mở được luồng Binance: '+error.message);
      this.scheduleReconnect(generation); return;
    }
    this.socket=socket;
    socket.onopen=()=>{
      if(!this.isCurrent(generation))return;
      this.onStatus('live','');
      const latest=this.candles[this.candles.length-1];
      if(latest)this.dispatch(latest,latest.closed);
    };
    socket.onmessage=event=>{
      if(!this.isCurrent(generation))return;
      let message;
      try {message=JSON.parse(event.data);}
      catch(error){this.onStatus('error','Dữ liệu Binance không đọc được: '+error.message);return;}
      if(this.interval==='1s')this.handleTrade(message);
      else if(message.k)this.handleKline(message.k);
    };
    socket.onerror=()=>{if(this.isCurrent(generation))this.onStatus('reconnecting','Luồng Binance bị gián đoạn, đang kết nối lại…');};
    socket.onclose=()=>{
      if(this.socket===socket)this.socket=null;
      if(this.isCurrent(generation)){
        this.onStatus('reconnecting','Mất kết nối Binance, đang thử lại…');
        this.scheduleReconnect(generation);
      }
    };
  }
  scheduleReconnect(generation){
    clearTimeout(this.retryTimer);
    this.retryTimer=setTimeout(()=>this.connectSocket(generation),3000);
  }
  scheduleMarketPoll(generation){
    clearTimeout(this.pollTimer);
    this.pollTimer=setTimeout(()=>this.pollMarket(generation),BINANCE_BO_POLL_MS);
  }
  async pollMarket(generation){
    if(!this.isCurrent(generation))return;
    try{
      if(this.interval==='1s'){
        const paging=this.lastTradeId===null
          ? 'startTime='+Math.max(0,Date.now()-this.intervalMs)
          : 'fromId='+(this.lastTradeId+1);
        const response=await fetch(BINANCE_BO_API+'/aggTrades?symbol='+this.symbol+'&'+paging+'&limit=1000',{
          cache:'no-store',signal:this.controller.signal
        });
        if(!response.ok)throw new Error('HTTP '+response.status);
        const trades=await response.json();
        if(!this.isCurrent(generation))return;
        if(!Array.isArray(trades))throw new Error('Dữ liệu giao dịch Binance không hợp lệ.');
        trades.forEach(trade=>this.handleTrade(trade));
      }else{
        const path='/klines?symbol='+this.symbol+'&interval='+this.interval+'&limit=1';
        const response=await fetch(BINANCE_BO_API+path,{cache:'no-store',signal:this.controller.signal});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const data=await response.json();
        if(!this.isCurrent(generation))return;
        if(!Array.isArray(data)||!data.length)throw new Error('Binance không trả về dữ liệu nến.');
        const row=data[data.length-1];
        this.handleKline({t:row[0],o:row[1],h:row[2],l:row[3],c:row[4],v:row[5],x:Number(row[6])<Date.now()});
      }
      if(this.isCurrent(generation))this.onStatus('live','');
    }catch(error){
      if(this.isCurrent(generation)&&error.name!=='AbortError'){
        this.onStatus('reconnecting','Không lấy được dữ liệu Binance: '+error.message);
      }
    }finally{
      if(this.isCurrent(generation))this.scheduleMarketPoll(generation);
    }
  }
  handleKline(kline){
    const time=Number(kline.t), price=Number(kline.c);
    if(!Number.isFinite(time)||!Number.isFinite(price))return;
    this.price=price;
    const latest=this.candles[this.candles.length-1];
    if(latest&&time<latest.time)return;
    if(latest&&time>latest.time&&!latest.closed){
      latest.closed=true; this.dispatch(latest,true);
    }
    const candle={
      time,open:Number(kline.o),high:Number(kline.h),low:Number(kline.l),close:price,
      volume:Number(kline.v),closed:Boolean(kline.x)
    };
    if(latest&&latest.time===time)this.candles[this.candles.length-1]=candle;
    else this.candles.push(candle);
    this.trimCandles(); this.price=price; this.dispatch(candle,candle.closed);
  }
  handleTrade(trade){
    const time=Number(trade.T), price=Number(trade.p), volume=Number(trade.q);
    if(!Number.isFinite(time)||!Number.isFinite(price))return;
    this.price=price;
    const tradeId=Number(trade.a);
    if(Number.isFinite(tradeId)){
      if(this.lastTradeId!==null&&tradeId<=this.lastTradeId)return;
      this.lastTradeId=tradeId;
    }
    const bucket=Math.floor(time/this.intervalMs)*this.intervalMs;
    let candle=this.candles[this.candles.length-1];
    if(candle&&bucket<candle.time)return;
    if(!candle||bucket>candle.time){
      if(candle){
        candle.closed=true; this.dispatch(candle,true);
        const gap=Math.min(100,Math.floor((bucket-candle.time)/this.intervalMs)-1);
        for(let i=1;i<=gap;i++){
          const flat={time:candle.time+this.intervalMs,open:candle.close,high:candle.close,low:candle.close,close:candle.close,volume:0,closed:true};
          this.candles.push(flat); this.trimCandles(); this.dispatch(flat,true); candle=flat;
        }
      }
      candle={time:bucket,open:price,high:price,low:price,close:price,volume:0,closed:false};
      this.candles.push(candle);
    }
    candle.high=Math.max(candle.high,price); candle.low=Math.min(candle.low,price);
    candle.close=price; candle.volume+=Number.isFinite(volume)?volume:0;
    this.trimCandles(); this.price=price; this.dispatch(candle,false);
  }
  trimCandles(){if(this.candles.length>100)this.candles.splice(0,this.candles.length-100);}
  dispatch(candle,closed){
    this.pendingUpdate={candles:this.candles.slice(-100),candle:{...candle},price:this.price,closed};
    if(closed){
      if(this.updateFrame!==null)cancelAnimationFrame(this.updateFrame);
      this.updateFrame=null; this.flushUpdate(); return;
    }
    if(this.updateFrame===null)this.updateFrame=requestAnimationFrame(()=>this.flushUpdate());
  }
  flushUpdate(){
    this.updateFrame=null;
    const update=this.pendingUpdate; this.pendingUpdate=null;
    if(!update||!this.active)return;
    this.draw(update.candles);
    this.onUpdate(update);
  }
  draw(candles){
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight,dpr=window.devicePixelRatio||1;
    if(!width||!height)return;
    this.canvas.width=Math.round(width*dpr); this.canvas.height=Math.round(height*dpr);
    const ctx=this.ctx; ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#101b20'; ctx.fillRect(0,0,width,height);
    const bars=candles.slice(-100),left=8,right=58,top=10,bottom=18;
    if(!bars.length){
      ctx.fillStyle='#9fb0b4'; ctx.font='12px sans-serif'; ctx.textAlign='center';
      ctx.fillText('Đang chờ nến Binance…',width/2,height/2); return;
    }
    const min=Math.min(...bars.map(candle=>candle.low)),max=Math.max(...bars.map(candle=>candle.high));
    const padding=(max-min)*.08||max*.0004||1,low=min-padding,high=max+padding;
    const plotHeight=height-top-bottom,plotRight=width-right,plotWidth=plotRight-left;
    const y=value=>top+(high-value)/(high-low)*plotHeight;
    ctx.font='9px sans-serif'; ctx.textAlign='right'; ctx.strokeStyle='rgba(190,210,210,.12)'; ctx.fillStyle='#82969a';
    const priceDecimals=BINANCE_BO_PRICE_DECIMALS[this.symbol]||2;
    for(let i=0;i<4;i++){
      const lineY=top+plotHeight*i/3,price=high-(high-low)*i/3;
      ctx.beginPath(); ctx.moveTo(left,lineY); ctx.lineTo(plotRight,lineY); ctx.stroke();
      ctx.fillText(price.toFixed(price<1?Math.max(priceDecimals,5):priceDecimals),width-3,lineY-2);
    }
    const cell=Math.max(0,plotWidth-12)/bars.length;
    const points=bars.map((candle,index)=>({x:left+cell*(index+.5),y:y(candle.close)}));
    const area=ctx.createLinearGradient(0,top,0,height-bottom);
    area.addColorStop(0,'rgba(246,211,101,.18)'); area.addColorStop(1,'rgba(246,211,101,0)');
    ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y);
    points.slice(1).forEach(point=>ctx.lineTo(point.x,point.y));
    ctx.lineTo(points[points.length-1].x,height-bottom); ctx.lineTo(points[0].x,height-bottom);
    ctx.closePath(); ctx.fillStyle=area; ctx.fill();
    ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y);
    points.slice(1).forEach(point=>ctx.lineTo(point.x,point.y));
    ctx.strokeStyle='#f6d365'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
    const currentPrice=bars[bars.length-1].close;
    const currentY=y(currentPrice),tagY=Math.max(top+8,Math.min(height-bottom-2,currentY));
    ctx.setLineDash([4,3]); ctx.strokeStyle='#f6d365'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(left,currentY); ctx.lineTo(points[points.length-1].x,currentY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(points[points.length-1].x,currentY,3,0,Math.PI*2);
    ctx.fillStyle='#f6d365'; ctx.fill();
    const priceLabel=currentPrice.toLocaleString('en-US',{
      minimumFractionDigits:2,maximumFractionDigits:currentPrice<1?6:2
    });
    ctx.font='9px sans-serif'; ctx.textAlign='center';
    ctx.fillStyle='#f6d365'; ctx.fillRect(plotRight+2,tagY-7,right-4,14);
    ctx.fillStyle='#101b20'; ctx.fillText(priceLabel,plotRight+right/2,tagY+3);
    ctx.fillStyle='#82969a'; ctx.textAlign='left';
    const first=new Date(bars[0].time),last=new Date(bars[bars.length-1].time);
    const timeOptions=this.interval==='1s'
      ? {hour:'2-digit',minute:'2-digit',second:'2-digit'}
      : {hour:'2-digit',minute:'2-digit'};
    ctx.fillText(first.toLocaleTimeString([],timeOptions),left,height-4);
    ctx.textAlign='right'; ctx.fillText(last.toLocaleTimeString([],timeOptions),plotRight-2,height-4);
  }
}
