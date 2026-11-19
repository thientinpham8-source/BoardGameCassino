'use strict';

/* ================= KHỞI TẠO ================= */
(function init(){
  const chipsEl = document.getElementById('chips');
  const chipColors = ['#356a9e','#22816a','#b84747','#79509b','#258c9b','#bd7132','#516779','#283b4b','#993e66','#ba8d32'];
  CFG.chips.forEach((v,i)=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (v===selectedChip ? ' on' : '');
    b.innerHTML = '<span>' + fmtChips(v) + '</span>';
    b.style.setProperty('--chip-color', chipColors[i]);
    b.title = fmtMoney(v);
    b.setAttribute('aria-label', 'Chọn phỉnh ' + fmtMoney(v));
    b.setAttribute('aria-pressed', String(v===selectedChip));
    b.dataset.v = v;
    chipsEl.appendChild(b);
  });
  chipsEl.addEventListener('click', e=>{
    const b = e.target.closest('.chip');
    if (!b) return;
    selectedChip = +b.dataset.v;
    chipsEl.querySelectorAll('.chip').forEach(x=>{
      x.classList.toggle('on', x===b);
      x.setAttribute('aria-pressed', String(x===b));
    });
  });
  document.getElementById('undo-bet').addEventListener('click',undoLastBet);
  document.getElementById('cancel-bet').addEventListener('click',cancelCurrentBets);
  document.getElementById('double-bet').addEventListener('click',doubleLastBet);
  TABLES.forEach(cfg => new GameTable(cfg));
  new BacBoTable({name:'Bac Bo T1',id:'186269901',players:24});
  new AndarBaharTable({name:'Andar Bahar T1',id:'186269801',players:24});
  XOCDIA.forEach(cfg => new XocDiaTable(cfg));
  TAIXIU.forEach(cfg => new TaiXiuTable(cfg));
  new MonopolyTable();
  new RouletteTable({name:'Roulette T1',id:'186269701',players:28});
  new DragonTigerTable({name:'Long Hổ T1',id:'186269811',players:24});
  new FantanTable({name:'Fantan T1',id:'186269901',players:24});
  new BinanceBOTable();
  new BalloonCrashTable();
  document.querySelectorAll('.table-card').forEach(card=>{
    const status=card.querySelector('.f-status'),badge=card.querySelector('.pbadge');
    if(status&&badge)badge.after(status);
  });
  const gameHome = document.getElementById('game-home');
  const tables = document.getElementById('tables');
  const tableGridBack = document.getElementById('table-grid-back');
  const tableCards = Array.from(document.querySelectorAll('.table-card'));
  const sideTabs = Array.from(document.querySelectorAll('.side-tab'));
  const homeIcon = document.querySelector('.side-ic[title="Trang chủ"]');
  const gameIcon = document.querySelector('.side-ic[title="Game bàn"]');
  const getCardCategory = c => c.classList.contains('crash-table') ? 'crash' : c.classList.contains('bo-table') ? 'bo' : c.classList.contains('ab') ? 'ab' : c.classList.contains('bb-table') ? 'bb' : c.classList.contains('dt') ? 'dt' : c.classList.contains('ft') ? 'ft' : c.classList.contains('rl') ? 'rl' : c.classList.contains('monopoly') ? 'monopoly' : c.classList.contains('tx') ? 'tx' : c.classList.contains('slot') ? 'xd-slot' : c.classList.contains('xd') ? 'xd' : 'bac';
  let currentGameTab=null;
  let suppressGridClick=false;
  tableCards.forEach(card=>{
    const name=card.querySelector('.t-name');
    const openButton=document.createElement('button');
    openButton.type='button';
    openButton.className='table-open-button';
    openButton.textContent='Mở bàn';
    openButton.setAttribute('aria-label','Mở '+(name?name.textContent:'bàn game'));
    card.appendChild(openButton);
  });
  let switchingGame=false;
  let gameSwitchTimer=null;
  const showHome = activeIcon => {
    if(gameSwitchTimer!==null){
      clearTimeout(gameSwitchTimer);
      gameSwitchTimer=null;
      switchingGame=false;
      sideTabs.forEach(tab=>tab.classList.remove('launching'));
    }
    gameHome.hidden = false;
    tables.hidden = true;
    tables.classList.remove('preview-grid');
    tableGridBack.hidden=true;
    tableCards.forEach(card=>card.style.display='none');
    homeIcon.classList.toggle('active', activeIcon===homeIcon);
    gameIcon.classList.toggle('active', activeIcon===gameIcon);
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const showGame = tab => {
    currentGameTab=tab;
    const category=tab.dataset.cat;
    gameHome.hidden=true;
    tables.hidden=false;
    tables.classList.add('preview-grid');
    tableGridBack.hidden=true;
    sideTabs.forEach(item=>item.classList.toggle('active',item===tab));
    tableCards.forEach(card=>{
      const visible=getCardCategory(card)===category;
      card.style.display=visible?'':'none';
      if(visible){
        const road=card.querySelector('.road.big, .bo-history');
        if(road)road.scrollLeft=road.scrollWidth;
      }
    });
    homeIcon.classList.remove('active');
    gameIcon.classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const openTable = selectedCard => {
    tables.classList.remove('preview-grid');
    tableGridBack.hidden=false;
    tableCards.forEach(card=>card.style.display=card===selectedCard?'':'none');
    window.scrollTo({top:0,behavior:'smooth'});
  };
  tableGridBack.addEventListener('click',()=>{ if(currentGameTab)showGame(currentGameTab); });
  tables.addEventListener('click',event=>{
    if(!tables.classList.contains('preview-grid'))return;
    if(suppressGridClick){suppressGridClick=false;return;}
    const card=event.target.closest('.table-card');
    if(card&&card.style.display!=='none')openTable(card);
  });
  sideTabs.forEach(tab=>{
    tab.classList.add('game-tile');
    const icon=tab.querySelector('.st-ic');
    if(icon)icon.classList.add('game-tile-icon');
    gameHome.appendChild(tab);
    tab.addEventListener('click',()=>{
      if(switchingGame)return;
      switchingGame=true;
      sideTabs.forEach(item=>item.classList.toggle('active',item===tab));
      tab.classList.add('launching');
      gameSwitchTimer=setTimeout(()=>{
        tab.classList.remove('launching');
        showGame(tab);
        switchingGame=false;
        gameSwitchTimer=null;
      },420);
    });
  });
  homeIcon.addEventListener('click',()=>showHome(homeIcon));
  gameIcon.addEventListener('click',()=>showHome(gameIcon));
  showHome(homeIcon);
  let roadDrag = null;
  tables.addEventListener('pointerdown', e=>{
    if (e.isPrimary===false || (e.pointerType==='mouse' && e.button!==0)) return;
    const track = e.target.closest('.road.big, .bo-history');
    if (!track || track.scrollWidth<=track.clientWidth) return;
    roadDrag = { track, pointerId:e.pointerId, startX:e.clientX, startScrollLeft:track.scrollLeft, didDrag:false };
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
  });
  tables.addEventListener('pointermove', e=>{
    if (!roadDrag || e.pointerId!==roadDrag.pointerId) return;
    const delta = e.clientX-roadDrag.startX;
    if (Math.abs(delta)>3){
      roadDrag.didDrag=true;
      roadDrag.track.scrollLeft = roadDrag.startScrollLeft-delta;
      e.preventDefault();
    }
  },{passive:false});
  const stopRoadDrag = e=>{
    if (!roadDrag || e.pointerId!==roadDrag.pointerId) return;
    roadDrag.track.classList.remove('dragging');
    if(roadDrag.didDrag){
      suppressGridClick=true;
      setTimeout(()=>{suppressGridClick=false;},100);
    }
    roadDrag = null;
  };
  tables.addEventListener('pointerup',stopRoadDrag);
  tables.addEventListener('pointercancel',stopRoadDrag);
  tables.addEventListener('lostpointercapture',stopRoadDrag);
  setBalance();
})();
