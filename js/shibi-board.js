/*
 * 紫微斗数の命盤の盤面(HTML)。命盤ページ(shibi/)と流年ページ(shibi/ryunen/)で共通に使う。
 * deco で宮ごとの飾りを足せる。{ cls(p), head(p), star(name), foot(p), center }
 */
const SB_LUCKY = ["文昌", "文曲", "左輔", "右弼", "天魁", "天鉞", "禄存", "天馬"];
const SB_SIKA_SHORT = { 化禄: "禄", 化権: "権", 化科: "科", 化忌: "忌" };
// 盤の並び(上の段の左から 巳午未申、右の列 酉戌、下の段の右から 亥子丑寅、左の列 卯辰)
const SB_GRID = { 5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4], 9: [2, 4], 10: [3, 4], 11: [4, 4], 0: [4, 3], 1: [4, 2], 2: [4, 1], 3: [3, 1], 4: [2, 1] };

const sbEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sbLunarText = (l) => `${l.year}年${l.leap ? "閏" : ""}${l.num}月${l.day}日`;

function sbStarHtml(s, cls, deco) {
  const k = s.sika ? `<b class="sb-k sb-k--${SB_SIKA_SHORT[s.sika]}" title="${s.sika}">${SB_SIKA_SHORT[s.sika]}</b>` : "";
  const extra = deco && deco.star ? deco.star(s.name) : "";
  return `<span class="${cls}">${sbEsc(s.name)}${k}${extra}</span>`;
}

function sbBoardHtml(c, deco) {
  const S = SB_STEM, B = SB_BRANCH;
  let cells = "";
  for (const p of c.palaces) {
    const [r, col] = SB_GRID[p.branch];
    const major = p.major.map((s) => sbStarHtml(s, "sb-major", deco)).join("");
    const minor = p.minor.map((s) => sbStarHtml(s, SB_LUCKY.includes(s.name) ? "sb-minor" : "sb-minor sb-minor--bad", deco)).join("");
    const tg = deco && deco.foot ? deco.foot(p) : (p.taigen ? `<span class="sb-tg">${p.taigen[0]}〜${p.taigen[1]}歳</span>` : "");
    const extraCls = deco && deco.cls ? deco.cls(p) : "";
    const extraHead = deco && deco.head ? deco.head(p) : "";
    cells += `<div class="sb-cell${p.branch === c.mei ? " sb-cell--mei" : ""}${extraCls ? " " + extraCls : ""}" style="grid-row:${r};grid-column:${col}">`
      + `<div class="sb-head"><span class="sb-pname">${p.name}</span>${p.body ? '<span class="sb-body">身</span>' : ""}</div>${extraHead}`
      + `<div class="sb-stars">${major || '<span class="sb-empty">主星なし</span>'}</div>`
      + `<div class="sb-minors">${minor}</div>`
      + `<div class="sb-foot"><span class="sb-gz">${S[p.stem]}${B[p.branch]}</span>${tg}</div></div>`;
  }
  const b = c.birth;
  const center = `<div class="sb-center" style="grid-row:2/4;grid-column:2/4">`
    + (deco && deco.center ? deco.center : "")
    + `<p><span>旧暦</span>${sbLunarText(b.lunar)}</p>`
    + `<p><span>生まれ年</span>${S[b.yStem]}${B[b.yBranch]}年</p>`
    + `<p><span>時辰</span>${B[b.hourBranch]}の刻</p>`
    + `<p><span>五行局</span>${c.kyokuName}(${c.nayin})</p>`
    + `<p><span>命主</span>${c.meishu}　<span>身主</span>${c.shinshu}</p>`
    + `</div>`;
  return `<div class="sb-board" role="img" aria-label="紫微斗数の命盤">${cells}${center}</div>`;
}
