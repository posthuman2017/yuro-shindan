/* SVG チャート（外部ライブラリ非依存） */

function radarSVG(radar, size = 380) {
  const cx = size / 2, cy = size / 2 + 6, r = size * 0.33;
  const n = radar.length;
  const pt = (i, ratio) => {
    const ang = -Math.PI / 2 + (Math.PI * 2 * i) / n;
    return [cx + Math.cos(ang) * r * ratio, cy + Math.sin(ang) * r * ratio];
  };
  let g = '';
  for (const lv of [0.25, 0.5, 0.75, 1]) {
    const pts = radar.map((_, i) => pt(i, lv).join(',')).join(' ');
    g += `<polygon points="${pts}" fill="none" stroke="#d8dee9" stroke-width="1"/>`;
  }
  radar.forEach((_, i) => {
    const [x, y] = pt(i, 1);
    g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#d8dee9" stroke-width="1"/>`;
  });
  // 業界標準ライン（50%）
  const base = radar.map((_, i) => pt(i, 0.5).join(',')).join(' ');
  g += `<polygon points="${base}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 3"/>`;

  const pts = radar.map((d, i) => pt(i, Math.max(d.value, 2) / 100).join(',')).join(' ');
  g += `<polygon points="${pts}" fill="rgba(37,99,235,.22)" stroke="#2563eb" stroke-width="2.5"/>`;
  radar.forEach((d, i) => {
    const [x, y] = pt(i, Math.max(d.value, 2) / 100);
    g += `<circle cx="${x}" cy="${y}" r="4" fill="${d.color}"/>`;
  });
  radar.forEach((d, i) => {
    const [x, y] = pt(i, 1.26);
    const anchor = Math.abs(x - cx) < 8 ? 'middle' : (x > cx ? 'start' : 'end');
    g += `<text x="${x}" y="${y}" text-anchor="${anchor}" class="rl">${d.name}</text>`;
    g += `<text x="${x}" y="${y + 15}" text-anchor="${anchor}" class="rv" fill="${d.color}">${d.value}</text>`;
  });
  const pad = 92; // 軸ラベルが見切れないよう左右に余白を確保する
  return `<svg viewBox="${-pad} 0 ${size + pad * 2} ${size + 26}" class="radar">
    <style>.rl{font-size:12px;fill:#334155;font-weight:600}.rv{font-size:13px;font-weight:700}</style>
    ${g}</svg>`;
}

function barsHTML(radar) {
  return radar.map(d => `
    <div class="bar-row">
      <div class="bar-name">${d.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${d.value}%;background:${d.color}"></div>
        <div class="bar-mark" title="業界標準の目安"></div></div>
      <div class="bar-val" style="color:${d.color}">${d.value}</div>
    </div>`).join('');
}

function gaugeSVG(pct, label, danger = true) {
  const w = 300, h = 74;
  const color = danger
    ? (pct >= 66 ? '#dc2626' : pct >= 34 ? '#f59e0b' : '#059669')
    : (pct >= 66 ? '#059669' : pct >= 34 ? '#f59e0b' : '#dc2626');
  return `<svg viewBox="0 0 ${w} ${h}" class="gauge">
    <rect x="0" y="26" width="${w}" height="16" rx="8" fill="#e5e9f0"/>
    <rect x="0" y="26" width="${w * pct / 100}" height="16" rx="8" fill="${color}"/>
    <line x1="${w / 3}" y1="22" x2="${w / 3}" y2="46" stroke="#94a3b8" stroke-width="1"/>
    <line x1="${w * 2 / 3}" y1="22" x2="${w * 2 / 3}" y2="46" stroke="#94a3b8" stroke-width="1"/>
    <text x="0" y="18" style="font-size:11px;fill:#64748b">${label}</text>
    <text x="${w}" y="18" text-anchor="end" style="font-size:14px;font-weight:700;fill:${color}">${pct}</text>
  </svg>`;
}
