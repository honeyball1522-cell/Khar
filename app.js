(function(){
  const STORAGE_KEY = 'termeh_daily_expenses_v1';
  const dayNames = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  const jalaliMonthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

  // Gregorian -> Jalali (Shamsi) conversion
  function gregorianToJalali(gy, gm, gd){
    const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
    let jy;
    if (gy <= 1600){ gy -= 621; jy = 0; } else { jy = 979; gy -= 1600; }
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365*gy) + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400) - 80 + gd + g_d_m[gm-1];
    jy += 33 * Math.floor(days/12053);
    days %= 12053;
    jy += 4 * Math.floor(days/1461);
    days %= 1461;
    if (days > 365){
      jy += Math.floor((days-1)/365);
      days = (days-1) % 365;
    }
    const jm = (days < 186) ? 1 + Math.floor(days/31) : 7 + Math.floor((days-186)/30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days-186) % 30));
    return [jy, jm, jd];
  }
  function toJalali(date){
    const [jy, jm, jd] = gregorianToJalali(date.getFullYear(), date.getMonth()+1, date.getDate());
    return { y: jy, m: jm, d: jd };
  }
  function jalaliDateLabel(date){
    const j = toJalali(date);
    return toFaDigits(j.d) + ' ' + jalaliMonthNames[j.m-1];
  }

  function toFaDigits(n){
    const map = {'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
    return String(n).replace(/[0-9]/g, d => map[d]);
  }
  function formatMoney(n){
    if(!n) n = 0;
    return toFaDigits(Number(n).toLocaleString('en-US'));
  }
  function dateKey(d){
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function sameDay(a,b){ return dateKey(a) === dateKey(b); }

  // Convert JS getDay() (0=Sun..6=Sat) to Persian week index (0=Sat..6=Fri)
  function persianDayIndex(jsDay){
    // jsDay: 0 Sun,1 Mon,2 Tue,3 Wed,4 Thu,5 Fri,6 Sat
    return (jsDay + 1) % 7; // Sat(6)->0, Sun(0)->1, Mon(1)->2 ... Fri(5)->6
  }

  function startOfWeek(date){
    const d = new Date(date);
    const idx = persianDayIndex(d.getDay());
    d.setDate(d.getDate() - idx);
    d.setHours(0,0,0,0);
    return d;
  }

  // ---- data store ----
  function loadData(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
  }
  function saveData(data){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }catch(e){}
  }
  let data = loadData(); // { 'YYYY-M-D': [{id, desc, amount}] }

  let currentWeekStart = startOfWeek(new Date());

  function dayTotal(key){
    const list = data[key] || [];
    return list.reduce((s,e)=> s + Number(e.amount||0), 0);
  }

  function weekDates(){
    const arr = [];
    for(let i=0;i<7;i++){
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate()+i);
      arr.push(d);
    }
    return arr;
  }

  function render(){
    const container = document.getElementById('daysContainer');
    container.innerHTML = '';
    const today = new Date();
    let weekSum = 0;
    const dates = weekDates();

    dates.forEach((d, i) => {
      const key = dateKey(d);
      const total = dayTotal(key);
      weekSum += total;
      const isToday = sameDay(d, today);

      const card = document.createElement('div');
      card.className = 'day-card' + (isToday ? ' is-today' : '');

      const head = document.createElement('div');
      head.className = 'day-head';
      head.innerHTML = `
        <div class="day-name-wrap">
          <span class="day-name">${dayNames[i]}</span>
          <span class="day-date">${jalaliDateLabel(d)}</span>
        </div>
        <div class="day-total ${total===0?'zero':''}">${formatMoney(total)} تومان</div>
      `;
      card.appendChild(head);

      const list = document.createElement('div');
      list.className = 'expense-list';
      const items = data[key] || [];
      if(items.length === 0){
        const hint = document.createElement('div');
        hint.className = 'empty-hint';
        hint.textContent = 'هنوز خرجی ثبت نشده';
        list.appendChild(hint);
      } else {
        items.forEach(item => {
          const row = document.createElement('div');
          row.className = 'expense-item';
          row.innerHTML = `
            <button class="exp-del" data-key="${key}" data-id="${item.id}">✕</button>
            <span class="exp-amount">${formatMoney(item.amount)}</span>
            <span class="exp-desc">${escapeHtml(item.desc)}</span>
          `;
          list.appendChild(row);
        });
      }
      card.appendChild(list);

      const addRow = document.createElement('div');
      addRow.className = 'add-row';
      addRow.innerHTML = `
        <button class="add-btn" data-key="${key}">+</button>
        <input class="inp-amount" type="number" inputmode="numeric" placeholder="مبلغ" data-key="${key}">
        <input class="inp-desc" type="text" placeholder="توضیح خرج (مثلاً: نهار)" data-key="${key}">
      `;
      card.appendChild(addRow);

      container.appendChild(card);
    });

    document.getElementById('weekTotal').textContent = formatMoney(weekSum) + ' تومان';

    const first = dates[0], last = dates[6];
    document.getElementById('weekRangeSub').textContent =
      `${jalaliDateLabel(first)} تا ${jalaliDateLabel(last)}`;

    document.getElementById('weekLabel').textContent =
      `هفته ${jalaliDateLabel(first)} — ${jalaliDateLabel(last)}`;

    // month total: based on the Jalali month of the week's middle day (Wednesday of that week) for a stable choice
    const refDate = dates[3];
    const refJalali = toJalali(refDate);
    const monthSum = computeMonthTotal(refJalali.y, refJalali.m);
    document.getElementById('monthTotal').textContent = formatMoney(monthSum) + ' تومان';
    document.getElementById('monthNameSub').textContent = jalaliMonthNames[refJalali.m-1] + ' ' + toFaDigits(refJalali.y);

    attachRowHandlers();
  }

  function computeMonthTotal(jalaliYear, jalaliMonth){
    let sum = 0;
    Object.keys(data).forEach(key => {
      const [y,m,d] = key.split('-').map(Number);
      const j = toJalali(new Date(y, m-1, d));
      if(j.y === jalaliYear && j.m === jalaliMonth){
        sum += dayTotal(key);
      }
    });
    return sum;
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function attachRowHandlers(){
    document.querySelectorAll('.exp-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key, id = btn.dataset.id;
        data[key] = (data[key]||[]).filter(e => String(e.id) !== String(id));
        if(data[key].length === 0) delete data[key];
        saveData(data);
        render();
      });
    });
    document.querySelectorAll('.add-btn').forEach(btn => {
      btn.addEventListener('click', () => addExpense(btn.dataset.key));
    });
    document.querySelectorAll('.inp-desc, .inp-amount').forEach(inp => {
      inp.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') addExpense(inp.dataset.key);
      });
    });
  }

  function addExpense(key){
    const amountInp = document.querySelector(`.inp-amount[data-key="${key}"]`);
    const descInp = document.querySelector(`.inp-desc[data-key="${key}"]`);
    const amount = parseFloat(amountInp.value);
    const desc = descInp.value.trim();
    if(!amount || amount <= 0 || !desc){
      if(!desc) descInp.focus(); else amountInp.focus();
      return;
    }
    if(!data[key]) data[key] = [];
    data[key].push({ id: Date.now() + Math.random().toString(36).slice(2,6), desc, amount });
    saveData(data);
    render();
    // refocus new empty row for quick multi-entry
    setTimeout(() => {
      const newAmount = document.querySelector(`.inp-amount[data-key="${key}"]`);
      if(newAmount) newAmount.focus();
    }, 0);
  }

  document.getElementById('prevWeek').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    render();
  });
  document.getElementById('nextWeek').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    render();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    currentWeekStart = startOfWeek(new Date());
    render();
  });

  render();

  // ---- PWA service worker registration ----
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    });
  }
})();
