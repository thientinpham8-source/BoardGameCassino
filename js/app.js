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
  document.querySelectorAll('.table-card').forEach(card=>{
    const status=card.querySelector('.f-status'),badge=card.querySelector('.pbadge');
    if(status&&badge)badge.after(status);
  });
  const sideTabs = Array.from(document.querySelectorAll('.side-tab'));
  sideTabs.forEach(tab => tab.addEventListener('click', ()=>{
    sideTabs.forEach(x=>x.classList.toggle('active', x===tab));
    const category = tab.dataset.cat;
    document.querySelectorAll('.table-card').forEach(c=>{
      const cardCategory = c.classList.contains('bo-table') ? 'bo' : c.classList.contains('ab') ? 'ab' : c.classList.contains('bb-table') ? 'bb' : c.classList.contains('dt') ? 'dt' : c.classList.contains('ft') ? 'ft' : c.classList.contains('rl') ? 'rl' : c.classList.contains('monopoly') ? 'monopoly' : c.classList.contains('tx') ? 'tx' : c.classList.contains('slot') ? 'xd-slot' : c.classList.contains('xd') ? 'xd' : 'bac';
      const visible = category === cardCategory;
      c.style.display = visible ? '' : 'none';
      if (visible){
        const road = c.querySelector('.road.big');
        if (road) road.scrollLeft = road.scrollWidth;
      }
    });
  }));
  document.querySelectorAll('.table-card.ab,.table-card.bb-table,.table-card.xd,.table-card.tx,.table-card.monopoly,.table-card.rl,.table-card.dt,.table-card.ft,.table-card.bo-table').forEach(c=>{ c.style.display = 'none'; });
  setBalance();
})();
