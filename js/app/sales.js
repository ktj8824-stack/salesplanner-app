/* =========================================
   세일즈플래너 — 고객 · 진행 단계 화면 (영업사원 앱 '고객' 탭 · customers.html 공용)
   업종 템플릿(js/shared/templates.js)을 바꾸면 단계 · 항목 · 다시 연락 알림이 함께 바뀜
   저장은 SalesStore (로그인 → 서버, 데모 → 이 기기)
   ========================================= */
const Sales = (() => {
  const T = window.Templates;
  const DB = SalesStore;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => U.today();
  const md = d => String(d || '').slice(5).replace('-', '.');
  let box = null, tab = 0, busy = false;

  // 데모에서 처음 그 업종을 고르면 넣어 주는 예시 고객 (가상 이름)
  const SEED = {
    insurance: [['류하나', '소개', -1, { family: '30대 맞벌이 · 자녀 1' }, '1990-02-11'], ['오태민', '상담', -3, { products: '실손' }, '1987-11-20'],
      ['남궁진', '설계', -5, { family: '배우자 · 자녀 2', products: '종신', expiry: '2027-03-01' }, '1984-11-25'], ['표지원', '설계', -9, { products: '암' }, null],
      ['윤보람', '청약', -28, { products: '운전자', referrer: '남궁진' }, null]],
    auto: [['송유리', '견적', -2, { model: '하이브리드 SUV', payment: '할부' }, null], ['장민석', '문의', 0, { household: 4 }, null], ['고은채', '출고', -29, {}, null]],
    pharma: [['김민호 원장', '샘플', -6, { dept: '내과' }, null], ['이수진 원장', '방문', -1, { dept: '정형외과' }, null], ['최현우 원장', '처방·도입', -20, {}, null]],
    realty: [['피주원', '현장 방문', -1, { area: '성수', budget: 30000 }, null], ['권도영', '문의', 0, { leaseEnd: '2027-01-20' }, null]],
    b2b: [['청운건설 이재훈 과장', '제안', -5, { items: '안전용품' }, null], ['한결테크', '발굴', -2, {}, null], ['동아정밀', '수주', -25, {}, null]],
  };

  const S = () => DB.data;
  const tpl = () => T.get(S().templateId);
  const mine = () => S().customers.filter(c => c.templateId === S().templateId);
  const customerWord = t => T.word(t, 'customer').replace(/님$/, '');

  async function seedDemo(id) {
    if (DB.live() || S().seeded[id]) return;
    for (const [name, stage, ago, fields, birthday] of SEED[id] || []) {
      const d = U.addDays(today(), ago);
      await DB.addCustomer({ templateId: id, name, phone: '010-0000-' + String(1000 + S().customers.length).slice(-4), stage, stageAt: d, lastActivityAt: d, fields, birthday, owner: 'personal', source: 'manual' });
    }
    S().seeded[id] = true; DB._saveLocal();
  }

  async function act(fn) {
    if (busy) return; busy = true;
    try { await fn(); } catch (e) { toast(e.message || String(e)); } finally { busy = false; render(); }
  }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'sp-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }

  // ---------- 화면 ----------
  function render() {
    if (!box || !document.body.contains(box)) return;
    if (!DB.loaded) { box.innerHTML = '<p class="sp-muted" style="padding:24px 0;text-align:center">고객을 불러오는 중…</p>'; return; }
    if (DB.error) { box.innerHTML = `<div class="sp-card"><b>고객을 불러오지 못했어요</b><p class="sp-muted">${esc(DB.error)}</p><button class="sp-btn" data-sp="reload">다시 시도</button></div>`; return; }
    if (!S().templateId) return renderPick();
    const t = tpl(), list = mine();
    if (tab >= t.stages.length) tab = 0;
    const stage = t.stages[tab];
    const rows = list.filter(c => c.stage === stage);
    const due = list.flatMap(c => T.followups(t, c, today()).map(f => Object.assign(f, { name: c.name })))
      .filter(f => f.date <= U.addDays(today(), 7))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    box.innerHTML = `
      <header class="sp-head">
        <div><div class="sp-sub">${esc(t.name)} 템플릿${DB.live() ? '' : ' · 데모 (이 기기에만 저장)'}</div><h1>고객 · 진행 단계</h1></div>
        <button class="sp-btn sp-dark" data-sp="add">+ ${esc(customerWord(t))} 등록</button>
      </header>
      <div class="sp-inds" role="radiogroup" aria-label="업종">
        ${T.list().map(x => `<button role="radio" aria-checked="${x.id === S().templateId}" class="sp-chip ${x.id === S().templateId ? 'on' : ''}" data-sp="ind" data-id="${x.id}">${esc(x.name)}</button>`).join('')}
      </div>
      <section class="sp-card">
        <h2>다시 연락할 일 <span class="sp-muted">${due.length}건 · 7일 안</span></h2>
        ${due.length ? due.map(f => `<button class="sp-due ${f.overdue ? 'late' : ''}" data-sp="open" data-id="${f.customerId}"><b>${esc(md(f.date))}</b><span>${esc(f.name)} — ${esc(f.task)}</span>${f.overdue ? '<em>지남</em>' : ''}</button>`).join('') : '<p class="sp-muted">가까운 할 일이 없어요</p>'}
        <p class="sp-note">입력하지 않아도 템플릿 규칙(단계 · 날짜 · 생일 · 연락 없음)으로 자동 계산돼요</p>
      </section>
      <div class="sp-tabs" role="tablist" aria-label="진행 단계" style="grid-template-columns:repeat(${t.stages.length},minmax(0,1fr))">
        ${t.stages.map((s, i) => `<button role="tab" aria-selected="${i === tab}" class="${i === tab ? 'on' : ''}" data-sp="tab" data-i="${i}"><b>${list.filter(c => c.stage === s).length}</b><span>${esc(s)}</span></button>`).join('')}
      </div>
      <div class="sp-list">
        ${rows.length ? rows.map(c => `<button class="sp-row" data-sp="open" data-id="${c.id}"><span class="sp-av">${esc(c.name[0])}</span><span class="sp-rt"><b>${esc(c.name)}</b><small>${esc(summary(t, c))}</small></span><span class="sp-muted">${esc(md(c.stageAt))}~</span></button>`).join('')
          : `<p class="sp-muted" style="text-align:center;padding:24px 0">'${esc(stage)}' 단계 고객이 없어요</p>`}
      </div>`;
  }

  function summary(t, c) {
    const f = t.fields.map(x => (c.fields || {})[x.key]).filter(v => v !== undefined && v !== null && v !== '');
    return f.slice(0, 2).join(' · ') || '항목을 채우면 여기에 보여요';
  }

  function renderPick() {
    box.innerHTML = `
      <div class="sp-pick">
        <small class="sp-step">시작</small>
        <h1>어떤 영업을 하세요?</h1>
        <p class="sp-muted">고르기만 하면 단계 · 고객 항목 · 알림이 맞춰져요. 나중에 바꿀 수 있어요</p>
        <div class="sp-grid">${T.list().map(x => `<button class="sp-ind" data-sp="ind" data-id="${x.id}"><b>${esc(x.name)}</b><small>${esc(x.stages.join(' → '))}</small></button>`).join('')}</div>
      </div>`;
  }

  // ---------- 창 ----------
  function modal(html) { closeModal(); const b = document.createElement('div'); b.className = 'sp-mback'; b.innerHTML = `<div class="sp-modal" role="dialog" aria-modal="true">${html}</div>`; b.addEventListener('click', onModalClick); document.body.appendChild(b); return b; }
  function closeModal() { document.querySelectorAll('.sp-mback').forEach(x => x.remove()); }
  function onModalClick(e) {
    if (e.target.classList.contains('sp-mback')) return closeModal();
    const el = e.target.closest('[data-sp]'); if (!el) return;
    if (el.dataset.sp === 'close') closeModal();
    if (el.dataset.sp === 'next') act(() => moveNext(el.dataset.id));
    if (el.dataset.sp === 'visit') planVisit(el.dataset.id);
    if (el.dataset.sp === 'call') markCall(el.dataset.id);          // 기본 동작(전화 앱 열기)은 그대로
    if (el.dataset.sp === 'note') noteSheet(el.dataset.id, null);
  }

  const RES = { good: '좋음', hold: '고민 중', later: '다시 연락', no: '거절' };
  const actText = a => a.kind === 'stage' ? `${a.body.from || '처음'} → ${a.body.to}` : a.kind === 'memo' ? a.body.text
    : a.kind === 'call' ? `통화 ${a.body.minutes || ''}분${a.body.result ? ' · ' + (RES[a.body.result] || '') : ''}${a.body.text ? ' — ' + a.body.text : ''}` : a.kind;

  function openCard(id) {
    const t = tpl(), c = S().customers.find(x => x.id === id); if (!c) return;
    const next = T.nextStage(t, c.stage);
    const acts = S().activities.filter(a => a.customerId === c.id).slice(0, 6);
    const inputs = t.fields.map(f => {
      const v = (c.fields || {})[f.key] ?? '';
      const ctl = f.type === 'select'
        ? `<select name="${f.key}"><option value="">선택</option>${f.options.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
        : `<input name="${f.key}" type="${f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}" value="${esc(v)}">`;
      return `<label class="sp-field"><span>${esc(f.label)}</span>${ctl}</label>`;
    }).join('');
    const m = modal(`
      <div class="sp-mhead"><span class="sp-av big">${esc(c.name[0])}</span><div><h2>${esc(c.name)}</h2>
        ${c.org || c.title ? `<p class="sp-muted">${esc([c.org, c.title].filter(Boolean).join(' · '))}</p>` : ''}
        <div class="sp-steps">${t.stages.map(s => `<span class="${t.stages.indexOf(s) <= t.stages.indexOf(c.stage) ? 'on' : ''}">${esc(s)}</span>`).join('')}</div></div></div>
      <div class="sp-quick">
        ${c.phone ? `<a class="sp-btn sp-call" data-sp="call" data-id="${c.id}" href="tel:${esc(c.phone.replace(/[^0-9+]/g, ''))}">전화 걸기</a>` : ''}
        <button type="button" class="sp-btn" data-sp="note" data-id="${c.id}">말로 남기기</button>
        ${hasPlanner() ? `<button type="button" class="sp-btn sp-dark" data-sp="visit" data-id="${c.id}">${esc(T.word(t, 'visit'))} 일정 잡기</button>` : ''}
      </div>
      ${c.nextContact ? `<p class="sp-next">다음 연락 <b>${esc(md(c.nextContact.date))}</b> · ${esc(c.nextContact.task || '다시 연락')}</p>` : ''}
      ${visitsOf(c).length ? `<div class="sp-visits">${visitsOf(c).map(v => `<div><b>${esc(md(v.date))} ${esc(v.start)}</b><span>${esc(v.location || '장소 미정')}</span></div>`).join('')}</div>` : ''}
      <form>${inputs}
        <label class="sp-field"><span>주소</span><input name="_address" maxlength="120" placeholder="동선 짤 때 써요" value="${esc(c.address || '')}"></label>
        <label class="sp-field"><span>생일</span><input name="_birthday" placeholder="MM-DD" value="${esc(c.birthday ? String(c.birthday).slice(-5) : '')}"></label>
        <label class="sp-field"><span>메모 남기기</span><input name="_memo" placeholder="예: 설계안 두 가지 비교 원함"></label>
        <div class="sp-err" aria-live="polite"></div>
        <div class="sp-actions">
          <button type="button" class="sp-btn" data-sp="close">닫기</button>
          <button type="submit" class="sp-btn sp-dark">저장</button>
          ${next ? `<button type="button" class="sp-btn sp-gold" data-sp="next" data-id="${c.id}">${esc(next)} 단계로 →</button>` : ''}
        </div>
      </form>
      <h3>활동 기록</h3>
      ${acts.length ? acts.map(a => `<div class="sp-act"><b>${esc(md(a.date))}</b><span>${esc(actText(a))}</span><em class="${a.by}">${a.by === 'auto' ? '자동' : '직접'}</em></div>`).join('') : '<p class="sp-muted">아직 기록이 없어요</p>'}`);
    m.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target), bad = [], fields = Object.assign({}, c.fields);
      for (const f of t.fields) {
        let v = fd.get(f.key); if (f.type === 'number' && v !== '') v = Number(v);
        if (!T.fieldOk(f, v)) bad.push(f.label); else if (v === '' || v == null) delete fields[f.key]; else fields[f.key] = v;
      }
      const b = String(fd.get('_birthday') || '').trim();
      if (b && !/^\d{2}-\d{2}$/.test(b)) bad.push('생일(MM-DD)');
      if (bad.length) { m.querySelector('.sp-err').textContent = '다시 확인해 주세요: ' + bad.join(', '); return; }
      const memo = String(fd.get('_memo') || '').trim();
      act(async () => {
        c.fields = fields; c.birthday = b || null; c.address = String(fd.get('_address') || '').trim().slice(0, 120);
        if (memo) await DB.addActivity(c, 'memo', { text: memo }, 'user', today());
        await DB.updateCustomer(c);
        closeModal();
      });
    };
  }

  async function moveNext(id) {
    const t = tpl(), c = S().customers.find(x => x.id === id), next = c && T.nextStage(t, c.stage);
    if (!next) return;
    const r = T.moveStage(t, c, next, today(), 'user');
    Object.assign(c, r.customer);
    await DB.addActivity(c, 'stage', { from: r.activity.from, to: r.activity.to }, r.activity.by, r.activity.date);
    await DB.updateCustomer(c);
    tab = t.stages.indexOf(next);
    closeModal();
  }

  // ---------- 입력 제로: 통화 후 기록창 · 말 한마디 정리 ----------
  const CALL_KEY = 'sp_pending_call';
  function markCall(id) { try { localStorage.setItem(CALL_KEY, JSON.stringify({ id, at: Date.now() })); } catch { /* */ } }
  /** 전화 앱에서 돌아오면 기록창 (5초 이상 · 3시간 안) */
  function checkReturn() {
    let p = null; try { p = JSON.parse(localStorage.getItem(CALL_KEY)); } catch { /* */ }
    if (!p) return;
    const sec = (Date.now() - p.at) / 1000;
    if (sec < 5) return;                                   // 아직 전화 앱으로 넘어가는 중
    try { localStorage.removeItem(CALL_KEY); } catch { /* */ }
    if (sec > 3 * 3600 || !DB.loaded) return;
    if (S().customers.some(x => x.id === p.id)) noteSheet(p.id, Math.max(1, Math.min(120, Math.round(sec / 60))));
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(checkReturn, 400); });

  const MOODS = [['good', '좋아요 · 다음 단계'], ['hold', '고민 중'], ['later', '다시 연락'], ['no', '거절']];
  const DEFAULT_DAYS = { good: 7, hold: 7, later: 3, no: 90 };
  const DEFAULT_TASK = { good: '다음 단계 진행', hold: '결정했는지 확인', later: '다시 연락', no: '안부 연락' };

  /** 결과 버튼 + 말(글)에서 저장할 일 목록 만들기 */
  function planFrom(t, c, choice, parsed) {
    const mood = (parsed && parsed.mood) || choice || null;
    const next = T.nextStage(t, c.stage);
    const items = [];
    if (mood === 'good' && next) items.push({ k: 'stage', on: true, label: `단계 이동: ${c.stage} → ${next}`, to: next });
    let date = parsed && parsed.date, why = parsed && parsed.dateText;
    if (!date && mood) { date = U.addDays(today(), DEFAULT_DAYS[mood]); why = `${DEFAULT_DAYS[mood]}일 뒤 (기본)`; }
    const todos = (parsed && parsed.todos) || [];
    const task = (parsed && parsed.dateSentence) || DEFAULT_TASK[mood] || '다시 연락';
    if (date) items.push({ k: 'next', on: true, label: `다음 연락: ${md(date)} — ${task}`, date, task, why });
    todos.forEach(td => items.push({ k: 'todo', on: true, label: `할 일: ${td}`, task: td }));
    return { mood, items };
  }

  function noteSheet(id, callMin) {
    const t = tpl(), c = S().customers.find(x => x.id === id); if (!c) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let choice = null, parsed = null, plan = { items: [] };
    const m = modal(`
      <h2>${callMin ? `${esc(c.name)}님과 통화했어요` : `${esc(c.name)} · 말로 남기기`}</h2>
      <p class="sp-muted">${callMin ? `약 ${callMin}분 · 한 번만 누르거나 한마디만 남기면 끝나요` : '말하거나 적으면 기록 · 단계 · 다음 연락을 알아서 정리해요'}</p>
      ${callMin ? `<div class="sp-moods" role="radiogroup" aria-label="통화 결과">${MOODS.map(([k, l]) => `<button type="button" role="radio" aria-checked="false" class="sp-mood" data-mood="${k}">${l}</button>`).join('')}</div>` : ''}
      <label class="sp-field"><span>한마디 (선택)</span><textarea name="note" rows="3" placeholder="예: 샘플 반응 좋대. 다음 주 화요일에 다시 보재. 자료 메일로 보내 달래"></textarea></label>
      <div class="sp-actions">${SR ? '<button type="button" class="sp-btn" data-mic>말하기</button>' : ''}<button type="button" class="sp-btn" data-parse>정리하기</button></div>
      <div class="sp-plan" aria-live="polite"></div>
      <div class="sp-actions"><button type="button" class="sp-btn" data-sp="close">${callMin ? '기록 안 함' : '닫기'}</button><button type="button" class="sp-btn sp-dark" data-save>저장</button></div>`);
    const ta = m.querySelector('textarea'), box2 = m.querySelector('.sp-plan');
    const draw = () => {
      plan = planFrom(t, c, choice, parsed);
      box2.innerHTML = plan.items.length ? `<h3>이렇게 저장할게요 <span class="sp-muted">틀린 건 체크 해제</span></h3>${plan.items.map((it, i) => `<label class="sp-chk"><input type="checkbox" data-i="${i}" ${it.on ? 'checked' : ''}><span>${esc(it.label)}${it.why ? ` <small>(${esc(it.why)})</small>` : ''}</span></label>`).join('')}` : '';
      box2.querySelectorAll('input[type=checkbox]').forEach(cb => cb.onchange = () => { plan.items[Number(cb.dataset.i)].on = cb.checked; });
    };
    m.querySelectorAll('[data-mood]').forEach(b => b.onclick = () => {
      choice = b.dataset.mood;
      m.querySelectorAll('[data-mood]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      draw();
    });
    m.querySelector('[data-parse]').onclick = () => { parsed = ta.value.trim() ? NoteParse.parse(ta.value, today()) : null; draw(); };
    const mic = m.querySelector('[data-mic]');
    if (mic) mic.onclick = () => {
      const r = new SR(); r.lang = 'ko-KR'; r.interimResults = false;
      mic.textContent = '듣는 중…'; mic.disabled = true;
      r.onresult = e => { ta.value = (ta.value ? ta.value + ' ' : '') + e.results[0][0].transcript; parsed = NoteParse.parse(ta.value, today()); draw(); };
      r.onend = () => { mic.textContent = '말하기'; mic.disabled = false; };
      r.onerror = () => { mic.textContent = '말하기'; mic.disabled = false; toast('음성을 못 알아들었어요. 글로 적어 주세요'); };
      r.start();
    };
    m.querySelector('[data-save]').onclick = () => {
      if (ta.value.trim() && !parsed) parsed = NoteParse.parse(ta.value, today());
      if (parsed) { const keep = plan.items.map(i => i.on); plan = planFrom(t, c, choice, parsed); plan.items.forEach((it, i) => { if (keep[i] === false) it.on = false; }); }
      const text = ta.value.trim();
      if (!callMin && !text) { toast('한마디를 적거나 말해 주세요'); return; }
      act(async () => {
        const d = today();
        if (callMin) await DB.addActivity(c, 'call', { minutes: callMin, result: plan.mood, text }, 'user', d);
        else await DB.addActivity(c, 'memo', { text }, 'user', d);
        for (const it of plan.items.filter(x => x.on)) {
          if (it.k === 'stage') { const r = T.moveStage(t, c, it.to, d, 'auto'); Object.assign(c, r.customer); await DB.addActivity(c, 'stage', { from: r.activity.from, to: r.activity.to }, 'auto', d); }
          if (it.k === 'next') c.nextContact = { date: it.date, task: it.task };
          if (it.k === 'todo') await DB.addActivity(c, 'memo', { text: '할 일: ' + it.task, todo: true }, 'auto', d);
        }
        await DB.updateCustomer(c);
        closeModal();
        toast(plan.items.some(x => x.on) ? '기록하고 다음 할 일까지 정리했어요' : '기록했어요');
      });
    };
    if (!callMin) ta.focus();
  }

  // ---------- 방문 일정 (플래너 일정 = 역산 알람 · 오늘 시간선에 그대로 들어감) ----------
  const hasPlanner = () => typeof Store !== 'undefined' && Store.data && typeof Store.upsert === 'function';
  function visitsOf(c) {
    if (!hasPlanner()) return [];
    return Store.list().filter(v => v.briefing && v.briefing.customerId === c.id && v.status !== 'cancelled' && v.date >= today())
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 3);
  }
  function planVisit(id) {
    const t = tpl(), c = S().customers.find(x => x.id === id); if (!c) return;
    const word = T.word(t, 'visit');
    const m = modal(`<h2>${esc(c.name)} · ${esc(word)} 일정</h2>
      <p class="sp-muted">저장하면 출발 시간을 거꾸로 계산해서 알람을 걸어 드려요</p>
      <form>
        <label class="sp-field"><span>날짜</span><input name="date" type="date" required value="${U.addDays(today(), 1)}"></label>
        <label class="sp-field"><span>시간</span><input name="start" type="time" required value="10:00"></label>
        <label class="sp-field"><span>장소</span><input name="location" placeholder="예: 성수동 ○○빌딩 3층" maxlength="80" value="${esc((c.address || '').slice(0, 80))}"></label>
        <label class="sp-field"><span>이동</span><select name="mode"><option value="car">자가용</option><option value="taxi">택시</option><option value="walk">도보</option><option value="none">이동 없음</option></select></label>
        <label class="sp-field"><span>이동 시간(분)</span><input name="travel" type="number" min="0" max="600" value="30"></label>
        <div class="sp-err" aria-live="polite"></div>
        <div class="sp-actions"><button type="button" class="sp-btn" data-sp="close">닫기</button><button class="sp-btn sp-dark">일정 저장</button></div>
      </form>`);
    m.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const f = e.target, travel = Math.max(0, Math.min(600, Number(f.travel.value) || 0));
      const [h, mi] = f.start.value.split(':').map(Number), endMin = Math.min(h * 60 + mi + 60, 23 * 60 + 59);
      const end = String(Math.floor(endMin / 60)).padStart(2, '0') + ':' + String(endMin % 60).padStart(2, '0');
      act(async () => {
        await Store.upsert({ title: `${c.name} ${word}`, category: 'external', date: f.date.value, start: f.start.value, end,
          location: f.location.value.trim(), mode: f.mode.value, travelMin: f.mode.value === 'none' ? 0 : travel, bufferMin: 10,
          visibility: 'normal', status: 'scheduled', ackAt: new Date().toISOString(),
          briefing: { customerId: c.id, who: c.name, purpose: `${c.stage} 단계 ${word}` } });
        closeModal(); toast(`${md(f.date.value)} ${f.start.value} ${word} 일정을 넣었어요`);
      });
    };
  }

  const CARD_KEYS = [['name', '이름', 40], ['phone', '연락처', 20], ['org', '회사', 60], ['title', '직함', 60], ['address', '주소', 120], ['email', '이메일', 80]];
  function custForm(v, unsure) {
    v = v || {}; unsure = unsure || [];
    return CARD_KEYS.map(([k, label, n]) => `<label class="sp-field ${unsure.includes(k) ? 'sp-unsure' : ''}"><span>${label}${unsure.includes(k) ? ' <em>확인해 주세요</em>' : ''}</span>
      <input name="${k}" maxlength="${n}" value="${esc(v[k] || '')}" ${k === 'name' ? 'required' : ''} ${k === 'phone' ? 'inputmode="tel"' : k === 'email' ? 'type="email"' : ''}
        ${k === 'address' ? 'placeholder="동선 짤 때 써요 (예: 성수이로 113)"' : ''}></label>`).join('');
  }
  async function saveNew(v, source) {
    const t = tpl();
    const c = await DB.addCustomer({ templateId: S().templateId, name: v.name, phone: v.phone || '', stage: t.stages[0],
      stageAt: today(), lastActivityAt: today(), fields: {}, birthday: null, owner: 'personal', source,
      org: v.org || '', title: v.title || '', email: v.email || '', address: v.address || '',
      nextContact: source === 'card' ? { date: U.addDays(today(), 1), task: '명함 받은 분께 인사 문자' } : null });
    await DB.addActivity(c, 'stage', { from: null, to: t.stages[0], source }, source === 'card' ? 'auto' : 'user', today());
    return c;
  }
  const digits = v => String(v || '').replace(/\D/g, '');
  /** 같은 번호로 이미 등록된 고객 */
  function dupOf(v) { const d = digits(v.phone); return d.length >= 9 ? S().customers.find(c => digits(c.phone) === d) : null; }
  function readOf(form) { const o = {}; CARD_KEYS.forEach(([k]) => { o[k] = String(form[k].value || '').trim(); }); return o; }

  function addCustomer(prefill, unsure) {
    const t = tpl();
    const m = modal(`<h2>${esc(customerWord(t))} 등록</h2>
      <button type="button" class="sp-btn sp-gold sp-wide" data-card>📇 명함 사진으로 채우기</button>
      <p class="sp-muted">${prefill ? '읽은 내용을 확인하고 등록을 눌러 주세요. 사진은 저장하지 않아요.' : '명함을 찍으면 이름 · 번호 · 회사 · 주소가 자동으로 채워져요'}</p>
      <form>${custForm(prefill, unsure)}
      <div class="sp-err" aria-live="polite"></div>
      <div class="sp-actions"><button type="button" class="sp-btn" data-sp="close">닫기</button><button class="sp-btn sp-dark">등록</button></div></form>`);
    const err = m.querySelector('.sp-err'), cardBtn = m.querySelector('[data-card]');
    cardBtn.onclick = async () => {
      err.textContent = '';
      try {
        const cards = await CardRead.run(b => { cardBtn.disabled = b; cardBtn.textContent = b ? '명함 읽는 중…' : '📇 명함 사진으로 채우기'; });
        if (cards == null) return;
        if (!cards.length) { err.textContent = '명함을 찾지 못했어요. 밝은 곳에서 명함만 크게 찍어 주세요.'; return; }
        if (cards.length === 1) addCustomer(cards[0], cards[0].unsure);
        else manyCards(cards);
      } catch (e2) { err.textContent = e2.message; }
    };
    m.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const v = readOf(e.target); if (!v.name) return;
      const dup = dupOf(v);
      if (dup && !e.target.dataset.dupOk) { e.target.dataset.dupOk = '1'; err.textContent = `같은 번호로 ${dup.name} 님이 이미 있어요. 그래도 등록하려면 한 번 더 눌러 주세요.`; return; }
      act(async () => {
        const c = await saveNew(v, prefill ? 'card' : 'manual');
        tab = 0; closeModal(); toast(`${c.name} 님을 등록했어요${prefill ? ' · 내일 인사 문자 알림을 넣었어요' : ''}`);
      });
    };
  }

  /** 한 사진에 명함이 여러 장 — 고른 것만 한 번에 등록 */
  function manyCards(cards) {
    const m = modal(`<h2>명함 ${cards.length}장을 읽었어요</h2>
      <p class="sp-muted">등록할 분만 남기고 등록을 눌러 주세요. 자세한 칸은 나중에 고칠 수 있어요.</p>
      <div class="sp-cards">${cards.map((c, i) => `<label class="sp-chk"><input type="checkbox" data-i="${i}" ${c.name && !dupOf(c) ? 'checked' : ''}>
        <span><b>${esc(c.name || '이름 없음')}</b> ${esc([c.org, c.title].filter(Boolean).join(' · '))}<br><small>${esc(c.phone || '번호 없음')}${dupOf(c) ? ' · 이미 등록됨' : ''}${c.unsure.length ? ' · 흐린 칸 있음' : ''}</small></span></label>`).join('')}</div>
      <div class="sp-actions"><button type="button" class="sp-btn" data-sp="close">닫기</button><button type="button" class="sp-btn sp-dark" data-save>등록</button></div>`);
    m.querySelector('[data-save]').onclick = () => {
      const pick = [...m.querySelectorAll('input[data-i]:checked')].map(x => cards[Number(x.dataset.i)]).filter(c => c.name);
      if (!pick.length) return;
      act(async () => { for (const c of pick) await saveNew(c, 'card'); tab = 0; closeModal(); toast(`${pick.length}명을 등록했어요 · 내일 인사 문자 알림을 넣었어요`); });
    };
  }

  function onClick(e) {
    const el = e.target.closest('[data-sp]'); if (!el || !box.contains(el)) return;
    const k = el.dataset.sp;
    if (k === 'ind') act(async () => { await DB.setTemplate(el.dataset.id); await seedDemo(el.dataset.id); tab = 0; });
    else if (k === 'tab') { tab = Number(el.dataset.i); render(); }
    else if (k === 'open') openCard(el.dataset.id);
    else if (k === 'add') addCustomer();
    else if (k === 'reload') { DB.loaded = false; render(); DB.load().then(render); }
  }

  /** 홈 화면용: 며칠 안의 다시 연락할 일 (날짜순) */
  function due(days) {
    if (!DB.loaded || !S().templateId) return [];
    const t = tpl();
    return mine().flatMap(c => T.followups(t, c, today()).map(f => Object.assign(f, { name: c.name })))
      .filter(f => f.date <= U.addDays(today(), days)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  /** 하루 마감 보고서 (글) — 방문은 플래너 일정에서, 통화 · 메모 · 단계 이동은 활동 기록에서 */
  function dayReport(ymd, visits, who) {
    const name = id => { const c = S().customers.find(x => x.id === id); return c ? c.name : '고객'; };
    const acts = S().activities.filter(a => a.date === ymd).slice().reverse();
    const calls = acts.filter(a => a.kind === 'call'), moves = acts.filter(a => a.kind === 'stage' && a.body.from), memos = acts.filter(a => a.kind === 'memo');
    const tomorrow = U.addDays(ymd, 1);
    const dueT = due(1).filter(f => f.date === tomorrow);
    const d = U.at(ymd, '00:00');
    const L = [`[${d.getMonth() + 1}월 ${d.getDate()}일 영업 일지] ${who || ''}`.trim()];
    L.push(`■ 방문 ${visits.length}곳${visits.length ? ': ' + visits.map(v => `${v.start} ${v.title}`).join(' / ') : ''}`);
    L.push(`■ 통화 ${calls.length}건${calls.length ? ': ' + calls.map(a => `${name(a.customerId)}(${a.body.minutes || '?'}분${a.body.result ? ', ' + (RES[a.body.result] || '') : ''})`).join(', ') : ''}`);
    if (moves.length) L.push('■ 단계 이동: ' + moves.map(a => `${name(a.customerId)} ${a.body.from}→${a.body.to}`).join(', '));
    if (memos.length) L.push('■ 메모: ' + memos.slice(0, 6).map(a => `${name(a.customerId)} — ${a.body.text}`).join(' / '));
    L.push(`■ 내일: 다시 연락 ${dueT.length}명${dueT.length ? ' (' + dueT.map(f => f.name).join(', ') + ')' : ''}`);
    return { text: L.join('\n'), counts: { visits: visits.length, calls: calls.length, moves: moves.length, memos: memos.length } };
  }

  return {
    dayReport,
    due, openCustomer: id => openCard(id), _checkReturn: () => checkReturn(),
    customer: id => S().customers.find(x => x.id === id) || null,
    templateName: () => (S().templateId ? tpl().name : ''),
    ready: () => (DB.loaded ? Promise.resolve() : DB.load()),
    /** 화면 붙이기. 처음 한 번 불러오고, 그다음부터는 그리기만 */
    mount(el, opts = {}) {
      if (box !== el) { box = el; box.addEventListener('click', onClick); }
      if (!DB.loaded) {
        render();
        DB.load().then(async () => {
          if (opts.template && !S().templateId && T.list().some(x => x.id === opts.template)) await DB.setTemplate(opts.template);
          if (S().templateId) await seedDemo(S().templateId);
          render();
        });
      } else render();
    },
  };
})();
