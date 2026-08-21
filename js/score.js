/* 採点ロジック */

function visibleQuestions(answers) {
  return QUESTIONS.filter(q => !q.showIf || q.showIf(answers));
}

function bandOf(q, val) {
  if (val === null || val === undefined || val === '' || isNaN(val)) return null;
  const v = Number(val);
  for (const b of q.bands) {
    if (b.ge !== undefined && v >= b.ge) return b;
    if (b.le !== undefined && v <= b.le) return b;
  }
  return q.bands[q.bands.length - 1];
}

/* 1問の評価結果を返す */
function evalQuestion(q, answers) {
  const a = answers[q.id];
  if (q.domain === null) return null;

  if (a === '__unknown') {
    return { q, p: 0, max: 3, lv: 'bad', label: '把握していない',
      c: 'この数値を把握していない状態です。' + (q.help || '') + ' 経営判断の基準線が不在であることを意味するため、まず実測から始めることをおすすめします。' };
  }
  if (a === undefined || a === null || a === '') return { q, p: null, max: 3, lv: 'skip', label: '未回答', c: '' };

  if (q.type === 'number') {
    const b = bandOf(q, a);
    if (!b) return { q, p: null, max: 3, lv: 'skip', label: '未回答', c: '' };
    return { q, p: b.p, max: 3, lv: b.lv, label: a + (q.unit || ''), c: b.c };
  }
  const opt = (q.options || []).find(o => o.v === a);
  if (!opt || opt.p === null) return null;
  return { q, p: opt.p, max: 3, lv: opt.lv, label: opt.label, c: opt.c };
}

function scoreAll(answers) {
  const evals = [];
  for (const q of visibleQuestions(answers)) {
    const e = evalQuestion(q, answers);
    if (e) evals.push(e);
  }
  const domains = {};
  for (const d of DOMAINS) domains[d.id] = { sum: 0, max: 0, answered: 0, total: 0 };
  for (const e of evals) {
    const d = domains[e.q.domain];
    d.total++;
    if (e.p === null) continue;
    d.answered++;
    d.sum += e.p;
    d.max += e.max;
  }
  const radar = DOMAINS.map(d => {
    const s = domains[d.id];
    return {
      id: d.id, name: d.name, color: d.color,
      value: s.max > 0 ? Math.round((s.sum / s.max) * 100) : 0,
      answered: s.answered, total: s.total,
    };
  });

  // 生成AI成熟度（21点満点：ai ドメイン7問 ×3点）
  const aiEvals = evals.filter(e => e.q.domain === 'ai' && e.p !== null);
  const aiRaw = aiEvals.reduce((s, e) => s + e.p, 0);
  const aiMax = aiEvals.length * 3;
  const aiScaled = aiMax > 0 ? Math.round(aiRaw / aiMax * 21) : 0;
  // シャドーAI型（実装が進んでいるのにガバナンスが低い）の検出
  const gov = aiEvals.filter(e => e.q.ax === 'gov');
  const imp = aiEvals.filter(e => e.q.ax === 'imp');
  const govPct = gov.length ? Math.round(gov.reduce((s, e) => s + e.p, 0) / (gov.length * 3) * 100) : null;
  const impPct = imp.length ? Math.round(imp.reduce((s, e) => s + e.p, 0) / (imp.length * 3) * 100) : null;
  // Lv.2以上は「法人契約＋文書化されたルール」が前提。満たさず利用実態があれば Lv.1（シャドーAI）
  const govOK = ['a', 'b'].includes(answers.aiKeiyaku) && ['a', 'b'].includes(answers.aiRule);
  // 個人アカウント利用を黙認している回答（e）は、統制が整っていても実態としてシャドーAI
  const admittedShadow = answers.aiShadow === 'e';
  const inUse = admittedShadow || (answers.aiKeiyaku && answers.aiKeiyaku !== 'd') || (answers.aiGyoumu && answers.aiGyoumu !== 'd');
  const shadow = inUse && (!govOK || admittedShadow);
  let aiLevel;
  if (!inUse) aiLevel = AI_LEVELS.find(l => l.lv === 0);
  else if (shadow) aiLevel = AI_LEVELS.find(l => l.lv === 1);
  else aiLevel = AI_LEVELS.find(l => aiScaled >= l.min && l.lv >= 2) || AI_LEVELS.find(l => l.lv === 2);

  // 併設依存度（囲い込みリスク指数：高いほど危険）
  let heisetsuRisk = null;
  if (isSotozuke(answers) && answers.heisetsu && answers.heisetsu !== 'a') {
    const w = { heisetsu: 2, gendogaku: 4, caremane: 3, genzan: 1 };
    let s = 0, m = 0;
    for (const k in w) {
      const e = evals.find(x => x.q.id === k);
      if (e && e.p !== null) { s += (3 - e.p) * w[k]; m += 3 * w[k]; }
    }
    heisetsuRisk = m > 0 ? Math.round(s / m * 100) : null;
  }

  const total = Math.round(radar.reduce((s, r) => s + r.value, 0) / radar.length);
  return { evals, radar, total, aiScaled, aiMax: 21, aiLevel, govPct, impPct, shadow, heisetsuRisk };
}

const RANKS = [
  { min: 80, name: 'A', title: '優良', c: '主要指標が業界上位にあります。現状維持ではなく、この収益力をどこへ再投資するか（人材定着・テクノロジー・次期展開）が経営課題です。' },
  { min: 65, name: 'B', title: '良好', c: '大きな構造問題はありません。取りこぼしている加算と、リスク面の書面整備を潰すことで、A評価の水準に届きます。' },
  { min: 50, name: 'C', title: '要改善', c: '業界平均近辺です。特定施設の38.2%が赤字、収支差率の平均が5.3%という環境下で、現状のままでは物価・人件費の上昇を吸収しきれない可能性があります。優先課題の3点から着手することをおすすめします。' },
  { min: 35, name: 'D', title: '要注意', c: '複数の領域に改善余地があります。2025年の老人福祉・介護事業の倒産は176件と過去最多、休廃業・解散は653件で4年連続最多という環境です。優先順位をつけた早期の着手が必要です。' },
  { min: 0,  name: 'E', title: '要早期対応', c: '構造的な課題が重なっています。個別の改善策より先に、収支構造そのもの（価格・規模・固定費・人員配置）の再設計が必要な段階です。' },
];
const rankOf = (t) => RANKS.find(r => t >= r.min);

/* 優先課題：配点の低さ × 重要度 で並べる */
const PRIORITY_WEIGHT = {
  occRate: 10, laborRate: 9, profit: 9, shoguu: 8, capacity: 7, fixedCost: 7,
  gendogaku: 8, maebarai: 8, bcp: 7, jidan: 7, turnover: 7, aiRule: 7, aiShadow: 7,
  mitori: 6, ninchi: 6, iryou: 6, gyakutai: 6, goen: 6, hiyari: 6, risetsu: 6,
  kasanCheck: 6, bepKnown: 6, yakan: 5, caremane: 5, genzan: 5,
  kasuhara: 5, recruit: 5, aiKeiyaku: 5, aiKiki: 4, aiIinkai: 4,
  aiGyoumu: 4, shokai: 4, heisetsu: 3,
};

function priorities(res, n = 5) {
  return res.evals
    .filter(e => e.p !== null && e.p <= 1)
    .map(e => ({ e, w: (PRIORITY_WEIGHT[e.q.id] || 3) * (3 - e.p) }))
    .sort((x, y) => y.w - x.w)
    .slice(0, n)
    .map(x => x.e);
}

function strengths(res, n = 3) {
  return res.evals
    .filter(e => e.p === 3 && e.lv === 'good')
    .map(e => ({ e, w: PRIORITY_WEIGHT[e.q.id] || 3 }))
    .sort((x, y) => y.w - x.w)
    .slice(0, n)
    .map(x => x.e);
}
