/* 有料老人ホーム簡易経営診断 — アプリ本体 */

const KEY = 'yuro-shindan-records-v1';
let answers = {};
let editingId = null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 保存 ---------- */
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = (recs) => localStorage.setItem(KEY, JSON.stringify(recs));

function saveCurrent() {
  const recs = load();
  const now = new Date().toISOString();
  if (editingId) {
    const i = recs.findIndex(r => r.id === editingId);
    if (i >= 0) { recs[i].answers = { ...answers }; recs[i].updatedAt = now; save(recs); toast('上書き保存しました'); return; }
  }
  editingId = 'r' + Date.now();
  recs.push({ id: editingId, createdAt: now, updatedAt: now, answers: { ...answers } });
  save(recs);
  toast('保存しました');
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- 回答の送信 ---------- */
function mailSummary(res) {
  const ft = FTYPES.find(f => f.id === answers.ftype);
  const rank = rankOf(res.total);
  const L = [];
  L.push(`整理番号　：${answers.refNo || '（未記入）'}`);
  L.push(`施設種別　：${ft ? ft.label : '—'}${answers.capacity ? ' / 定員 ' + answers.capacity + '名' : ''}`);
  if (answers.openYear) L.push(`開設年　　：${answers.openYear}年`);
  L.push('');
  L.push(`総合評価　：${rank.name}（${rank.title}）　総合スコア ${res.total}`);
  L.push('領域別　　：' + res.radar.map(r => `${r.name} ${r.value}`).join(' / '));
  L.push(`生成AI　　：${res.aiLevel.name}（${res.aiScaled}/21）${res.shadow ? '　※シャドーAIの兆候あり' : ''}`);
  if (res.heisetsuRisk !== null) L.push(`併設依存度：囲い込みリスク指数 ${res.heisetsuRisk}`);
  L.push('');
  L.push('■ 優先課題');
  priorities(res).forEach((e, i) => L.push(`${i + 1}. ${e.q.text}　→ ${e.label}`));
  return L.join('\n');
}

async function submitAnswers() {
  if (!SUBMIT_ENDPOINT) return { skipped: true };
  const res = await fetch(SUBMIT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      cols: tableCols(),
      row: tableRow(answers, Date.now()),
      summary: mailSummary(scoreAll(answers)),
      ref: answers.refNo || '',
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'send failed');
  return data;
}

/* ---------- フォーム ---------- */
function renderForm() {
  const qs = visibleQuestions(answers);
  const sections = [];
  for (const q of qs) {
    const sec = q.section;
    if (!sections.length || sections[sections.length - 1].name !== sec) sections.push({ name: sec, items: [] });
    sections[sections.length - 1].items.push(q);
  }
  const scored = qs.filter(q => q.domain !== null);
  const done = scored.filter(q => answers[q.id] !== undefined && answers[q.id] !== '').length;

  let html = `<div class="progress"><div class="progress-bar" style="width:${Math.round(done / scored.length * 100)}%"></div></div>
    <p class="progress-txt">診断設問 ${done} / ${scored.length} 問にご回答いただきました</p>`;

  for (const s of sections) {
    html += `<section class="qsec"><h2>${esc(s.name)}</h2>`;
    for (const q of s.items) html += questionHTML(q);
    html += `</section>`;
  }
  html += `<div class="form-actions">
      <button class="btn primary" id="btnResult">${SUBMIT_ENDPOINT ? '回答を送信して診断結果を見る' : '診断結果を見る'}</button>
      <button class="btn" id="btnSave">この回答を保存</button>
      <button class="btn ghost" id="btnClear">入力をクリア</button>
    </div>`;
  $('#view').innerHTML = html;

  $('#view').addEventListener('change', onInput);
  $('#view').addEventListener('input', onInput);
  $('#btnResult').onclick = onSubmitClick;
  $('#btnSave').onclick = saveCurrent;
  $('#btnClear').onclick = () => { if (confirm('入力内容をすべて消去します。よろしいですか？')) { answers = {}; editingId = null; renderForm(); } };
}

function questionHTML(q) {
  const a = answers[q.id];
  let body = '';
  if (q.type === 'text') {
    body = `<input type="text" data-q="${q.id}" value="${esc(a || '')}" placeholder="${esc(q.placeholder || '')}">`;
  } else if (q.type === 'number') {
    const unk = a === '__unknown';
    body = `<div class="numrow">
      <input type="number" step="0.1" data-q="${q.id}" value="${unk ? '' : esc(a ?? '')}" ${unk ? 'disabled' : ''} placeholder="${esc(q.placeholder || '数値')}">
      <span class="unit">${esc(q.unit || '')}</span>
      ${q.unknownable ? `<label class="unk"><input type="checkbox" data-unk="${q.id}" ${unk ? 'checked' : ''}> 把握していない</label>` : ''}
    </div>`;
  } else {
    body = `<div class="opts">` + q.options.map(o => `
      <label class="opt ${a === o.v ? 'sel' : ''}">
        <input type="radio" name="${q.id}" data-q="${q.id}" value="${o.v}" ${a === o.v ? 'checked' : ''}>
        <span>${esc(o.label)}</span></label>`).join('') + `</div>`;
  }
  return `<div class="q" id="q-${q.id}">
    <div class="qtext">${q.domain ? `<span class="tag" style="background:${DOMAINS.find(d => d.id === q.domain).color}">${DOMAINS.find(d => d.id === q.domain).name}</span>` : ''}${esc(q.text)}</div>
    ${body}
    ${q.help ? `<details class="help"><summary>判定の基準（出典つき）</summary><p>${esc(q.help)}</p></details>` : ''}
  </div>`;
}

function onInput(ev) {
  const t = ev.target;
  if (t.dataset.unk) {
    answers[t.dataset.unk] = t.checked ? '__unknown' : '';
    renderForm(); return;
  }
  if (!t.dataset.q) return;
  const id = t.dataset.q;
  const prev = answers[id];
  answers[id] = t.value;
  const q = QUESTIONS.find(x => x.id === id);
  // 分岐に影響する設問だけ再描画（入力中のフォーカス喪失を避ける）
  if (['ftype', 'tokutei', 'heisetsu'].includes(id) && prev !== t.value) { renderForm(); return; }
  if (q && q.type === 'select') {
    document.querySelectorAll(`#q-${id} .opt`).forEach(el => el.classList.toggle('sel', el.querySelector('input').checked));
  }
  updateProgress();
}

async function onSubmitClick(ev) {
  if (!validate(true)) return;
  if (!SUBMIT_ENDPOINT) return show('result');

  const btn = ev.currentTarget, label = btn.textContent;
  btn.disabled = true; btn.textContent = '送信しています…';
  try {
    await submitAnswers();
    saveCurrent();
    show('result');
  } catch {
    btn.disabled = false; btn.textContent = label;
    alert('送信できませんでした。通信環境をご確認のうえ、もう一度お試しください。\n\nお急ぎの場合は、このまま「診断結果」タブを開いていただければ結果をPDFで保存できます。');
  }
}

function updateProgress() {
  const scored = visibleQuestions(answers).filter(q => q.domain !== null);
  const done = scored.filter(q => answers[q.id] !== undefined && answers[q.id] !== '').length;
  const bar = $('.progress-bar'); if (bar) bar.style.width = Math.round(done / scored.length * 100) + '%';
  const txt = $('.progress-txt'); if (txt) txt.textContent = `診断設問 ${done} / ${scored.length} 問にご回答いただきました`;
}

function validate(forSubmit) {
  if (!answers.ftype) { alert('施設種別をお選びください。'); $('#q-ftype').scrollIntoView({ block: 'center' }); return false; }
  const scored = visibleQuestions(answers).filter(q => q.domain !== null);
  const done = scored.filter(q => answers[q.id] !== undefined && answers[q.id] !== '').length;
  if (done < scored.length * 0.6) {
    return confirm(`未回答が ${scored.length - done} 問あります。回答が少ないと診断精度が下がります。このまま結果を表示しますか？`);
  }
  return true;
}

/* ---------- 診断結果 ---------- */
function renderResult() {
  const res = scoreAll(answers);
  const rank = rankOf(res.total);
  const pri = priorities(res);
  const str = strengths(res);
  const ft = FTYPES.find(f => f.id === answers.ftype);
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  let html = `<div class="report" id="report">
    <header class="rep-head">
      <div>
        <p class="rep-kicker">有料老人ホーム 簡易経営診断</p>
        <h1><span class="rep-name"></span><br><span class="rep-sub">経営診断・アドバイスシート</span></h1>
      </div>
      <div class="rep-meta">
        <div>診断日：${today}</div>
        <div>施設種別：${esc(ft ? ft.label : '—')}</div>
        ${answers.capacity ? `<div>定員：${esc(answers.capacity)}名</div>` : ''}
        ${answers.refNo ? `<div>整理番号：${esc(answers.refNo)}</div>` : ''}
      </div>
    </header>

    <section class="rep-score">
      <div class="rank rank-${rank.name}">
        <div class="rank-label">総合評価</div>
        <div class="rank-name">${rank.name}</div>
        <div class="rank-title">${rank.title}</div>
        <div class="rank-score">${res.total} <span>/ 100</span></div>
      </div>
      <p class="rank-comment">${esc(rank.c)}</p>
    </section>

    <section class="rep-chart">
      <h2>6領域の診断チャート</h2>
      <div class="chart-wrap">
        <div class="chart-radar">${radarSVG(res.radar)}<p class="legend"><span class="dash"></span>破線＝業界標準の目安</p></div>
        <div class="chart-bars">${barsHTML(res.radar)}</div>
      </div>
    </section>`;

  /* 生成AI */
  html += `<section class="rep-ai">
      <h2>生成AI活用度（AIオールイン度）</h2>
      <div class="ai-box">
        <div class="ai-level lv${res.aiLevel.lv}">
          <div class="ai-lv-num">${res.aiLevel.name}</div>
          <div class="ai-lv-score">${res.aiScaled} / ${res.aiMax} 点</div>
        </div>
        <div class="ai-gauges">
          ${res.govPct !== null ? gaugeSVG(res.govPct, 'ガバナンス（法人契約・ルール・実態把握）', false) : ''}
          ${res.impPct !== null ? gaugeSVG(res.impPct, '実装（業務組込み・測定・機器）', false) : ''}
        </div>
      </div>
      <p>${esc(res.aiLevel.c)}</p>
      ${res.shadow ? `<p class="alert">【要注意：シャドーAI型】現場での活用は進んでいる一方、法人としてのルール・実態把握が追いついていません。介護記録は要配慮個人情報にあたるため、漏えいが起きる前の段階でも、個人情報保護法第23条（安全管理措置）・第24条（従業者の監督）の履行不全を問われ得る状態です。活用を止めるのではなく、法人アカウントへの一本化と利用規程の整備によって、いま出ている成果を安全に確定させることをおすすめします。</p>` : ''}
    </section>`;

  /* 併設サービス */
  if (res.heisetsuRisk !== null) {
    const lvl = res.heisetsuRisk >= 66 ? '高' : res.heisetsuRisk >= 34 ? '中' : '低';
    html += `<section class="rep-heisetsu">
      <h2>併設サービス事業所との相関</h2>
      <div class="ai-gauges">${gaugeSVG(res.heisetsuRisk, '併設依存・囲い込み指摘リスク指数（高いほど要注意）', true)}</div>
      <p>リスク水準は「${lvl}」と評価されます。住宅型有料老人ホーム・一般型サービス付き高齢者向け住宅では、併設・隣接の自法人事業所が収益の柱になる一方、区分支給限度基準額の使用率とケアプランの中立性が行政の着目点になります。適切運営とされるサ高住の軽度者の使用率は5〜6割で在宅独居と同水準、一体提供型のモデルでは介護度によらず8〜9割に達するとされています。厚生労働省の検討会とりまとめ（2025年11月5日）では、届出制から登録制への移行、住まい事業と介護事業の会計区分・公表、ケアマネジャー変更の強要禁止、併設利用を条件とした家賃割引の禁止が方向性として示されました。2027年度の報酬改定に向けて、いま実態を数値で把握しておくことが最大の防御になります。</p>
    </section>`;
  }

  /* 優先課題 */
  html += `<section class="rep-pri page-break"><h2>優先的に着手すべき課題</h2>`;
  if (!pri.length) {
    html += `<p>大きな課題は検出されませんでした。すでに高い水準で運営されています。</p>`;
  } else {
    html += pri.map((e, i) => `
      <div class="pri-item lv-${e.lv}">
        <div class="pri-no">${i + 1}</div>
        <div>
          <div class="pri-q">${esc(e.q.text)}</div>
          <div class="pri-a">ご回答：${esc(e.label)}</div>
          <p>${esc(e.c)}</p>
        </div>
      </div>`).join('');
  }
  html += `</section>`;

  /* 強み */
  if (str.length) {
    html += `<section class="rep-str"><h2>すでに実現できている強み</h2>` +
      str.map(e => `<div class="str-item"><div class="str-q">${esc(e.q.text)}</div><div class="pri-a">ご回答：${esc(e.label)}</div><p>${esc(e.c)}</p></div>`).join('') +
      `</section>`;
  }

  /* 領域別の全所見 */
  html += `<section class="rep-detail page-break"><h2>領域別の詳細所見</h2>`;
  for (const d of DOMAINS) {
    const items = res.evals.filter(e => e.q.domain === d.id && e.p !== null);
    if (!items.length) continue;
    const rv = res.radar.find(r => r.id === d.id);
    html += `<h3 style="border-color:${d.color}">${d.name} <span style="color:${d.color}">${rv.value}点</span></h3>`;
    html += `<table class="dt"><tbody>` + items.map(e => `
      <tr class="lv-${e.lv}">
        <td class="dt-q">${esc(e.q.text)}</td>
        <td class="dt-a">${esc(e.label)}</td>
        <td class="dt-p"><span class="pip p${e.p}">${'●'.repeat(e.p) + '○'.repeat(3 - e.p)}</span></td>
      </tr>
      <tr class="dt-c-row"><td colspan="3" class="dt-c">${esc(e.c)}</td></tr>`).join('') + `</tbody></table>`;
  }
  html += `</section>`;

  html += `<section class="rep-foot page-break">
    <h2>本診断で用いた基準・出典</h2>
    <ul class="src">${Object.values(BENCH).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <p class="disclaimer">本シートは、ご回答いただいた内容にもとづく簡易的な傾向診断です。個別の経営判断にあたっては、決算書・実績データを用いた詳細な分析が必要です。記載の統計値は公表資料にもとづきますが、施設ごとの状況により当てはまらない場合があります。なお、入居率の全国平均、月額利用料の全国平均、および「入居率が何％を下回ると赤字になるか」という一律の閾値については、公的な統計が存在しないため、本診断では業界データとの相対比較にとどめています。</p>
    <p class="sign">診断者：谷本 雅紀</p>
  </section></div>

  <div class="result-actions no-print">
    <button class="btn primary" id="btnPrint">診断書をPDFで出力</button>
    <button class="btn" id="btnBack">回答を修正する</button>
    <button class="btn" id="btnSave2">この診断を保存</button>
  </div>`;

  $('#view').innerHTML = html;
  $('#btnPrint').onclick = () => window.print();
  $('#btnBack').onclick = () => show('form');
  $('#btnSave2').onclick = saveCurrent;
}

/* ---------- 保存一覧・集計 ---------- */
function renderRecords() {
  const recs = load();
  let html = `<section class="qsec"><h2>保存した診断（この端末内）</h2>
    <p class="note">データはこのパソコンのブラウザ内（localStorage）にのみ保存され、外部には送信されません。端末の変更・ブラウザデータの消去で失われるため、定期的な書き出しをおすすめします。</p>
    <div class="form-actions">
      <button class="btn" id="btnCsv">集計CSVを書き出す（Excel用）</button>
      <button class="btn" id="btnJson">全データをJSONで書き出す</button>
      <label class="btn file">JSONを読み込む（統合）<input type="file" id="fileJson" accept=".json" hidden></label>
    </div>`;

  if (!recs.length) {
    html += `<p class="note">まだ保存された診断はありません。</p></section>`;
    $('#view').innerHTML = html;
  } else {
    html += `<table class="rec"><thead><tr><th>診断日</th><th>整理番号</th><th>種別</th><th>定員</th><th>総合</th><th>AI</th><th></th></tr></thead><tbody>`;
    for (const r of recs.slice().reverse()) {
      const res = scoreAll(r.answers);
      const ft = FTYPES.find(f => f.id === r.answers.ftype);
      html += `<tr>
        <td>${new Date(r.createdAt).toLocaleDateString('ja-JP')}</td>
        <td>${esc(r.answers.refNo || '—')}</td>
        <td>${esc(ft ? ft.label.replace(/（.*/, '') : '—')}</td>
        <td>${esc(r.answers.capacity || '')}</td>
        <td><b>${rankOf(res.total).name}</b> ${res.total}</td>
        <td>Lv.${res.aiLevel.lv}</td>
        <td class="ta-r">
          <button class="mini" data-open="${r.id}">開く</button>
          <button class="mini del" data-del="${r.id}">削除</button>
        </td></tr>`;
    }
    html += `</tbody></table>`;

    // 集計サマリ
    const all = recs.map(r => scoreAll(r.answers));
    html += `<h2 style="margin-top:28px">全${recs.length}件の平均</h2><div class="chart-bars">` +
      barsHTML(DOMAINS.map(d => ({
        id: d.id, name: d.name, color: d.color,
        value: Math.round(all.reduce((s, x) => s + x.radar.find(r => r.id === d.id).value, 0) / all.length),
      }))) + `</div>`;
    const aiDist = [0, 0, 0, 0, 0];
    all.forEach(x => aiDist[x.aiLevel.lv]++);
    html += `<h2 style="margin-top:24px">生成AI成熟度の分布</h2><div class="chart-bars">` +
      aiDist.map((c, i) => `<div class="bar-row"><div class="bar-name">Lv.${i}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(c / recs.length * 100)}%;background:#ea580c"></div></div>
        <div class="bar-val">${c}件</div></div>`).join('') + `</div></section>`;
    $('#view').innerHTML = html;

    $('#view').querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
      const r = load().find(x => x.id === b.dataset.open);
      answers = { ...r.answers }; editingId = r.id; show('result');
    });
    $('#view').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('この診断を削除します。よろしいですか？')) return;
      save(load().filter(x => x.id !== b.dataset.del)); renderRecords();
    });
  }

  $('#btnCsv').onclick = exportCSV;
  $('#btnJson').onclick = exportJSON;
  $('#fileJson').onchange = importJSON;
}

function answerLabel(q, a) {
  if (a === undefined || a === null || a === '') return '';
  if (a === '__unknown') return '把握していない';
  if (q.type === 'select') { const o = (q.options || []).find(x => x.v === a); return o ? o.label : a; }
  return a;
}

const HEAD_IDS = ['refNo', 'ftype', 'capacity'];
const detailQuestions = () => QUESTIONS.filter(q => !HEAD_IDS.includes(q.id));

function tableCols() {
  const cols = ['診断日', '整理番号', '施設種別', '定員', '総合評価', '総合スコア'];
  DOMAINS.forEach(d => cols.push(d.name));
  cols.push('生成AIレベル', '生成AI点数', 'AIガバナンス', 'AI実装', '併設リスク指数');
  detailQuestions().forEach(q => cols.push(q.text.slice(0, 30)));
  return cols;
}

function tableRow(a, createdAt) {
  const res = scoreAll(a);
  const ft = FTYPES.find(f => f.id === a.ftype);
  const row = [new Date(createdAt).toLocaleDateString('ja-JP'), a.refNo || '',
    ft ? ft.label : '', a.capacity || '', rankOf(res.total).name, res.total];
  DOMAINS.forEach(d => row.push(res.radar.find(x => x.id === d.id).value));
  row.push(res.aiLevel.lv, res.aiScaled, res.govPct ?? '', res.impPct ?? '', res.heisetsuRisk ?? '');
  detailQuestions().forEach(q => row.push(answerLabel(q, a[q.id])));
  return row;
}

function exportCSV() {
  const recs = load();
  if (!recs.length) return alert('保存された診断がありません。');
  const rows = recs.map(r => tableRow(r.answers, r.createdAt));
  const csv = [tableCols(), ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download('﻿' + csv, `有老経営診断_集計_${stamp()}.csv`, 'text/csv');
}

function exportJSON() {
  const recs = load();
  if (!recs.length) return alert('保存された診断がありません。');
  download(JSON.stringify({ app: 'yuro-shindan', version: 1, records: recs }, null, 2),
    `有老経営診断_データ_${stamp()}.json`, 'application/json');
}

function importJSON(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d.records) throw 0;
      const cur = load(), ids = new Set(cur.map(r => r.id));
      let n = 0;
      d.records.forEach(r => { if (!ids.has(r.id)) { cur.push(r); n++; } });
      save(cur); renderRecords(); toast(`${n}件を追加しました`);
    } catch { alert('読み込めませんでした。本アプリで書き出したJSONファイルをお選びください。'); }
  };
  fr.readAsText(f);
  ev.target.value = '';
}

const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
function download(text, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- 画面切替 ---------- */
function show(v) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  window.scrollTo(0, 0);
  if (v === 'form') renderForm();
  else if (v === 'result') renderResult();
  else renderRecords();
}

document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  if (t.dataset.v === 'result' && !validate(false)) return;
  show(t.dataset.v);
});

$('#privacy').textContent = SUBMIT_ENDPOINT
  ? `本フォームでは法人名・施設名・氏名・連絡先を入力しません。送信ボタンを押すと、施設種別と各設問への回答が${SUBMIT_RECIPIENT}の集計表に記録されます。`
  : 'ご入力いただいた内容は、このパソコンのブラウザ内にのみ保存されます。外部のサーバーへ送信されることはありません。';

show('form');
