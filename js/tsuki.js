/*
 * 生まれた日の月の形。月齢・輝面比(光って見える割合)・旧暦の日の呼び名・形の絵(SVG)・二人の月を重ねたときの明るい部分。
 * 依存: astro.js(moonLongitude / sunLongitude / ttFrom / jdFromJst / jdn / norm360)
 *       koyomi.js(newMoonNear / lunarDate)、fortune.js(moonPhaseIndex)、data.js(MOON)
 *
 * 月齢は「直前の新月(朔)の瞬間からの経過日数」。朔は koyomi.js と同じ計算(国立天文台の朔望と2分以内で一致)。
 * 輝面比は太陽と月の黄経の差(離角)から (1 - cos 離角) / 2 で出す。月の緯度は無視しているので、ずれは1%ほど。
 */

/* 旧暦の日の呼び名(Wikipedia「月相」の月名の一覧。29・30日はどちらも晦) */
const TSUKI_KOSHO = {
  1: "朔(新月)", 2: "既朔", 3: "三日月", 7: "上弦", 8: "上弦", 13: "十三夜", 14: "小望月(幾望)",
  15: "望月(満月)", 16: "十六夜(既望)", 17: "立待月", 18: "居待月", 19: "寝待月(臥待月)", 20: "更待月",
  22: "下弦", 23: "下弦", 29: "晦(つごもり)", 30: "晦(つごもり)",
};

/* 時刻 jd(UT) の月。age は月齢(日)、elong は離角(0=新月 90=上弦 180=満月 270=下弦)、illum は輝面比(0〜1) */
function tsukiAt(jd) {
  let nm = newMoonNear(jd);
  if (nm > jd) nm = newMoonNear(jd - 29.53);
  const tt = ttFrom(jd);
  const elong = norm360(moonLongitude(tt) - sunLongitude(tt));
  return {
    jd,
    age: jd - nm,
    elong,
    illum: (1 - Math.cos(elong * Math.PI / 180)) / 2,
    waxing: elong < 180,
  };
}

/* 日本時間の年月日(時刻を省くと正午)の月 */
function tsukiOfDate(y, m, d, hh, mi) {
  const h = hh == null ? 12 : hh;
  const t = tsukiAt(jdFromJst(y, m, d, h, mi || 0));
  const lunar = typeof lunarDate === "function" ? lunarDate(y, m, d) : null;
  t.y = y; t.m = m; t.d = d; t.hh = h; t.mi = mi || 0; t.timeGiven = hh != null;
  t.phase = moonPhaseIndex(t.age);
  t.lunar = lunar;
  t.kosho = lunar ? (TSUKI_KOSHO[lunar.day] || "") : "";
  return t;
}

/* 1日のあいだに輝面比がどれだけ動くか(時刻が分からないときの幅) */
function tsukiDayRange(y, m, d) {
  const a = tsukiAt(jdFromJst(y, m, d, 0, 0));
  const b = tsukiAt(jdFromJst(y, m, d, 23, 59));
  let min = Math.min(a.illum, b.illum), max = Math.max(a.illum, b.illum);
  // その日のうちに満月(満ちる→欠ける)や新月(欠ける→満ちる)を通るなら、両端の間に100%・0%がある
  if (a.waxing && !b.waxing) max = 1;
  if (!a.waxing && b.waxing) min = 0;
  return { from: a.illum, to: b.illum, min, max };
}

/*
 * 点 (x, y)(円の中心が原点、半径1。y は下向き)が光っているか。
 * 北半球から見て、満ちていく月は右側、欠けていく月は左側が光る。
 * 明暗の境目は楕円で、x = ±cos(離角)・√(1 - y²)。
 */
function tsukiLit(x, y, elong) {
  const s = Math.sqrt(Math.max(0, 1 - y * y));
  const c = Math.cos(elong * Math.PI / 180);
  return elong <= 180 ? x > c * s : x < -c * s;
}

/*
 * 二人の月を重ねたとき、どちらかが光っている部分の割合。
 * 満ちていく月(右が光る)と欠けていく月(左が光る)なら、横に切ったどの段でも光る部分は端から伸びるので、
 * 重ねた割合は二人の輝面比の和(1で頭打ち)。同じ向き同士なら、明るい方の月にもう一方が含まれる。
 */
function tsukiOverlay(e1, e2) {
  const k1 = (1 - Math.cos(e1 * Math.PI / 180)) / 2, k2 = (1 - Math.cos(e2 * Math.PI / 180)) / 2;
  return (e1 <= 180) !== (e2 <= 180) ? Math.min(1, k1 + k2) : Math.max(k1, k2);
}

/* 同じ割合を円を細かく区切って数える(tsukiOverlay の検算用) */
function tsukiUnion(e1, e2, n) {
  const N = n || 240;
  let inside = 0, lit = 0;
  for (let i = 0; i < N; i++) {
    const y = -1 + (2 * i + 1) / N;
    for (let j = 0; j < N; j++) {
      const x = -1 + (2 * j + 1) / N;
      if (x * x + y * y > 1) continue;
      inside++;
      if (tsukiLit(x, y, e1) || tsukiLit(x, y, e2)) lit++;
    }
  }
  return lit / inside;
}

/* 光っている部分の形(SVG の path)。中心 (cx, cy)、半径 r */
function tsukiPath(elong, cx, cy, r) {
  const c = Math.cos(elong * Math.PI / 180);
  const rx = Math.abs(c) * r;
  const top = `${cx} ${cy - r}`, bottom = `${cx} ${cy + r}`;
  if (elong <= 180) {
    // 右半分の縁を上から下へ、境目を下から上へ。三日月(c>0)は境目が右へふくらむ
    return `M ${top} A ${r} ${r} 0 0 1 ${bottom} A ${rx} ${r} 0 0 ${c > 0 ? 0 : 1} ${top} Z`;
  }
  // 左半分の縁を上から下へ、境目を下から上へ。欠けていく三日月(c>0)は境目が左へふくらむ
  return `M ${top} A ${r} ${r} 0 0 0 ${bottom} A ${rx} ${r} 0 0 ${c > 0 ? 1 : 0} ${top} Z`;
}

/* 月の絵。lit / dark は塗りの色、id はクリップ用 */
function tsukiSvg(elong, size, opts) {
  const o = opts || {};
  const r = size / 2 - 2, cx = size / 2, cy = size / 2;
  const lit = o.lit || "#f3d98b", dark = o.dark || "#2b2a33";
  const label = o.label ? ` aria-label="${o.label}"` : "";
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"${label}>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${dark}"/>`
    + `<path d="${tsukiPath(elong, cx, cy, r)}" fill="${lit}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${o.stroke || "rgba(0,0,0,.25)"}" stroke-width="1"/></svg>`;
}

/* 二人の月を重ねた絵(どちらかが光っている部分を塗る) */
function tsukiSvgUnion(e1, e2, size, opts) {
  const o = opts || {};
  const r = size / 2 - 2, cx = size / 2, cy = size / 2;
  const lit = o.lit || "#f3d98b", dark = o.dark || "#2b2a33";
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${o.label || "二人の月を重ねた形"}">`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${dark}"/>`
    + `<path d="${tsukiPath(e1, cx, cy, r)}" fill="${lit}"/>`
    + `<path d="${tsukiPath(e2, cx, cy, r)}" fill="${lit}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${o.stroke || "rgba(0,0,0,.25)"}" stroke-width="1"/></svg>`;
}
