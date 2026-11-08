let data = { stops: [], routes: [] };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const getNow = () => new Date().getHours() * 60 + new Date().getMinutes();
const isWk = () => [0, 6].includes(new Date().getDay());

// ดึงข้อมูล JSON จาก data/shuttle.json (F1)
async function loadData() {
  try {
    const res = await fetch('data/shuttle.json');
    if (!res.ok) throw new Error('โหลดไฟล์ไม่สำเร็จ');
    data = await res.json();
    init();
  } catch (e) {
    const el = document.getElementById('global-error');
    if (el) { el.textContent = 'กรุณาเปิดเว็บผ่าน Live Server'; el.classList.add('visible'); }
  }
}

// โหมดมืด บันทึกลง localStorage (ฟีเจอร์เสริม)
function setupTheme() {
  const cur = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', cur);
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.textContent = cur === 'dark' ? ' สว่าง' : '🌙 มืด';
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    btn.textContent = next === 'dark' ? 'สว่าง' : '🌙 มืด';
  });
}

// คำนวณเวลารถเที่ยวถัดไปของแต่ละสาย ณ จุดจอด (F2)
function getNextTrips(stopId) {
  const now = getNow();
  const day = isWk() ? 'weekend' : 'weekday';
  return data.routes.map(r => {
    const s = r.stops.find(x => x.stopId === stopId);
    if (!s) return null;
    for (const dep of r.departures[day]) {
      const arr = toMin(dep) + s.minutesFromStart;
      if (arr >= now) return { name: r.name, color: r.color, wait: arr - now, time: dep };
    }
    return { name: r.name, color: r.color, wait: null };
  }).filter(Boolean);
}

// 1. หน้าแรก (index.html) - จุดจอดโปรดและเวลารถคันถัดไป (F2, F5)
function initIndex() {
  const sel = document.getElementById('quick-stop-select');
  const box = document.getElementById('live-info-container');
  const favBox = document.getElementById('favorites-container');
  if (!sel) return;

  sel.innerHTML = '<option value="">-- เลือกจุดจอด --</option>' +
    data.stops.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  const renderFavs = () => {
    const favs = JSON.parse(localStorage.getItem('fav_stops') || '[]');
    if (!favs.length) { favBox.innerHTML = '<p class="empty-state">ยังไม่มีจุดจอดโปรด</p>'; return; }
    favBox.innerHTML = favs.map(id => {
      const s = data.stops.find(x => x.id === id);
      if (!s) return '';
      const trips = getNextTrips(id).map(t => `
        <div><b style="color:${t.color}">${t.name}</b>: ${t.wait !== null ? `<span style="color:var(--success)">อีก ${t.wait} นาที</span>` : '<span style="color:var(--danger)">หมดเที่ยวแล้ว</span>'}</div>
      `).join('');
      return `<div class="card" style="margin-bottom:1rem">
        <div class="card-title"><h3>📍 ${s.name}</h3><button class="theme-btn" data-del="${s.id}">ลบ </button></div>${trips}
      </div>`;
    }).join('');

    favBox.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', () => {
        const nextFavs = favs.filter(x => x !== b.dataset.del);
        localStorage.setItem('fav_stops', JSON.stringify(nextFavs));
        renderFavs();
      });
    });
  };

  const renderLive = id => {
    if (!id) { box.innerHTML = ''; return; }
    const s = data.stops.find(x => x.id === id);
    const favs = JSON.parse(localStorage.getItem('fav_stops') || '[]');
    const isFav = favs.includes(id);
    const trips = getNextTrips(id).map(t => `
      <div style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
        <b style="color:${t.color}">${t.name}</b><br>
        สถานะ: ${t.wait !== null ? `<span style="color:var(--success)">อีก ${t.wait} นาที (${t.time})</span>` : '<span style="color:var(--danger)">หมดเที่ยวแล้ว</span>'}
      </div>
    `).join('');

    box.innerHTML = `<div class="card" style="margin-top:1rem">
      <div class="card-title"><h3>${s.name}</h3><button id="btn-fav" class="theme-btn">${isFav ? ' บันทึกแล้ว' : '☆ เพิ่มเป็นรายการโปรด'}</button></div>
      ${trips}
    </div>`;

    document.getElementById('btn-fav').addEventListener('click', () => {
      const cur = JSON.parse(localStorage.getItem('fav_stops') || '[]');
      const updated = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
      localStorage.setItem('fav_stops', JSON.stringify(updated));
      renderLive(id);
      renderFavs();
    });
  };

  sel.addEventListener('change', e => renderLive(e.target.value));
  renderFavs();
  setInterval(() => { renderFavs(); if (sel.value) renderLive(sel.value); }, 30000);
}

// 2. หน้าสายรถ (routes.html) - รายการจุดจอดตามลำดับ (F1)
function initRoutes() {
  const box = document.getElementById('routes-container');
  if (!box) return;
  box.innerHTML = data.routes.map(r => `
    <article class="card" style="margin-bottom:1.5rem">
      <h2 style="color:${r.color}">${r.name}</h2>
      <div class="timeline">
        ${r.stops.map(st => {
          const s = data.stops.find(x => x.id === st.stopId);
          return `<div class="timeline-item"><b>${s ? s.name : st.stopId}</b> (+${st.minutesFromStart} นาที)</div>`;
        }).join('')}
      </div>
    </article>
  `).join('');
}

// 3. หน้าตารางเวลา (timetable.html) - ตารางเวลาตามหลัก Accessible (F4)
function initTimetable() {
  const sel = document.getElementById('table-route-select');
  const box = document.getElementById('timetable-result');
  const radios = document.getElementsByName('day-type');
  if (!sel) return;
  sel.innerHTML = data.routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  const render = () => {
    const isWeekend = Array.from(radios).find(r => r.checked).value === 'weekend';
    const r = data.routes.find(x => x.id === sel.value);
    if (!r) return;
    const trips = r.departures[isWeekend ? 'weekend' : 'weekday'] || [];
    const now = getNow();
    const nextIdx = trips.findIndex(t => toMin(t) >= now);

    box.innerHTML = `<div class="table-wrapper"><table>
      <caption>ตารางเวลาเดินรถ: ${r.name} (${isWeekend ? 'วันหยุด' : 'วันธรรมดา'})</caption>
      <thead><tr><th scope="col">เที่ยว</th><th scope="col">เวลาออก</th><th scope="col">สถานะ</th></tr></thead>
      <tbody>
        ${trips.map((t, i) => `
          <tr class="${i === nextIdx ? 'highlight-row' : ''}">
            <td>เที่ยวที่ ${i + 1}</td><td><b>${t} น.</b></td>
            <td>${i === nextIdx ? '<span class="badge-next">เที่ยวถัดไป</span>' : (toMin(t) < now ? 'ออกแล้ว' : 'รอเวลา')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>`;
  };
  sel.addEventListener('change', render);
  radios.forEach(rd => rd.addEventListener('change', render));
  render();
}

// 4. หน้าวางแผนเดินทาง (planner.html) - ต้นทาง-ปลายทาง (F3)
function initPlanner() {
  const oSel = document.getElementById('planner-origin');
  const dSel = document.getElementById('planner-dest');
  const btn = document.getElementById('btn-plan');
  const box = document.getElementById('planner-result');
  if (!btn) return;
  const opts = '<option value="">-- เลือกจุดจอด --</option>' + data.stops.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  oSel.innerHTML = opts; dSel.innerHTML = opts;

  btn.addEventListener('click', () => {
    const [o, d] = [oSel.value, dSel.value];
    if (!o || !d || o === d) {
      box.innerHTML = `<p style="color:var(--danger);margin-top:1rem">${!o || !d ? 'กรุณาเลือกทั้งสองจุด' : 'จุดเริ่มต้นและปลายทางต้องไม่ซ้ำกัน'}</p>`;
      return;
    }
    const now = getNow();
    const day = isWk() ? 'weekend' : 'weekday';
    const matches = [];

    data.routes.forEach(r => {
      const iO = r.stops.findIndex(s => s.stopId === o);
      const iD = r.stops.findIndex(s => s.stopId === d);
      if (iO !== -1 && iD !== -1 && iO < iD) {
        const dur = r.stops[iD].minutesFromStart - r.stops[iO].minutesFromStart;
        let wait = null;
        for (const dep of r.departures[day]) {
          const arr = toMin(dep) + r.stops[iO].minutesFromStart;
          if (arr >= now) { wait = arr - now; break; }
        }
        matches.push({ r, dur, wait });
      }
    });

    if (!matches.length) {
      box.innerHTML = '<div class="card" style="border-left:4px solid var(--danger);margin-top:1rem"><h3>❌ ไม่พบสายรถที่วิ่งตรง</h3><p>ไม่มีสายรถที่ผ่านทั้งสองจุดโดยต้นทางมาก่อนปลายทาง</p></div>';
      return;
    }

    box.innerHTML = `<div style="margin-top:1rem"><h3>พบ ${matches.length} เส้นทาง:</h3>
      ${matches.map(m => `
        <div class="card" style="margin-top:0.75rem;border-left:4px solid ${m.r.color}">
          <h4 style="color:${m.r.color}">${m.r.name}</h4>
          <p>⏱️ เวลาเดินทางบนรถ: <b>${m.dur} นาที</b></p>
          <p>🚌 รถเที่ยวถัดไป: ${m.wait !== null ? `<span style="color:var(--success)">อีก ${m.wait} นาที</span>` : '<span style="color:var(--danger)">หมดเที่ยวแล้ว</span>'}</p>
        </div>
      `).join('')}
    </div>`;
  });
}

// 5. หน้าแจ้งปัญหา (feedback.html) - ฟอร์ม Validation, ค่าเริ่มต้นอัตโนมัติ และ localStorage (F6)
function initFeedback() {
  const form = document.getElementById('feedback-form');
  const rSel = document.getElementById('fb-route');
  const dInp = document.getElementById('fb-date');
  const tInp = document.getElementById('fb-time');
  const desc = document.getElementById('fb-desc');
  const box = document.getElementById('my-feedback-list');
  const dErr = document.getElementById('date-error');
  const descErr = document.getElementById('desc-error');
  if (!form) return;

  rSel.innerHTML = '<option value="">-- เลือกสายรถ --</option>' + data.routes.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
  
  // ใส่วันที่และเวลาปัจจุบันเป็นค่าเริ่มต้นให้อัตโนมัติ
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  dInp.max = today;
  dInp.value = today;
  tInp.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const render = () => {
    const list = JSON.parse(localStorage.getItem('user_feedbacks') || '[]');
    box.innerHTML = list.length ? list.map((item, i) => `
      <div class="card" style="margin-bottom:1rem">
        <div class="card-title" style="margin-bottom:0.4rem">
          <h4 style="font-size:0.95rem">#${i + 1} ปัญหา: ${item.type}</h4>
          <button class="theme-btn" data-delfb="${i}" style="padding:0.2rem 0.5rem;font-size:0.75rem">ลบ</button>
        </div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.4rem">
          สายรถ: <b>${item.route}</b><br>
          วันที่เกิดเหตุ: <b>${item.date}</b> | เวลา: <b>${item.time} น.</b>
        </div>
        <p style="font-size:0.9rem;background:var(--bg-main);padding:0.6rem;border-radius:6px;border:1px solid var(--border)">${item.desc}</p>
      </div>
    `).join('') : '<p class="empty-state">ยังไม่มีประวัติการแจ้งปัญหา</p>';

    // จัดการลบรายการที่เลือก
    box.querySelectorAll('[data-delfb]').forEach(btn => {
      btn.addEventListener('click', () => {
        const curList = JSON.parse(localStorage.getItem('user_feedbacks') || '[]');
        curList.splice(Number(btn.dataset.delfb), 1);
        localStorage.setItem('user_feedbacks', JSON.stringify(curList));
        render();
      });
    });
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    dErr.classList.remove('visible');
    descErr.classList.remove('visible');
    let valid = true;

    if (!rSel.value) { alert('กรุณาเลือกสายรถที่พบปัญหา'); return; }
    if (!dInp.value) { dErr.textContent = 'กรุณาระบุวันที่'; dErr.classList.add('visible'); valid = false; }
    else if (dInp.value > today) { dErr.textContent = 'วันที่ต้องไม่เป็นวันในอนาคต'; dErr.classList.add('visible'); valid = false; }
    if (!tInp.value) { alert('กรุณาระบุเวลาที่พบปัญหา'); return; }

    if (desc.value.trim().length < 20) {
      descErr.textContent = `กรุณากรอกอย่างน้อย 20 ตัวอักษร (ปัจจุบันมี ${desc.value.trim().length} ตัวอักษร)`;
      descErr.classList.add('visible');
      valid = false;
    }
    if (!valid) return;

    const entry = {
      route: rSel.value,
      date: dInp.value,
      time: tInp.value,
      type: document.querySelector('input[name="problem-type"]:checked').value,
      desc: desc.value.trim()
    };
    const list = JSON.parse(localStorage.getItem('user_feedbacks') || '[]');
    list.unshift(entry);
    localStorage.setItem('user_feedbacks', JSON.stringify(list));
    
    form.reset();
    dInp.value = today;
    tInp.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    alert('ส่งรายงานปัญหาเรียบร้อยแล้ว');
    render();
  });

  render();
}

function init() {
  setupTheme();
  initIndex();
  initRoutes();
  initTimetable();
  initPlanner();
  initFeedback();
}

document.addEventListener('DOMContentLoaded', loadData);