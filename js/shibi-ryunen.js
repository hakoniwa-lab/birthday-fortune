/*
 * 紫微斗数の流年(その年の運)の計算。shibi.js の命盤に、ある年の 流年命宮・流年四化・小限・大限 を重ねる。
 *
 * 決まり
 *   流年命宮 … その年の十二支の宮(太歳宮)。十二宮は命盤と同じく命宮から逆回りに並べる(iztro「紫微斗数运限」)
 *   流年四化 … その年の十干で、生まれ年の四化と同じ表を引く
 *   数え年   … 見る年 − 生まれた旧暦の年 + 1(iztro「运限」の虚岁の式)
 *   小限     … 数え年で1年に1宮進む。生まれ年の支で起点が決まり(寅午戌→辰・申子辰→戌・巳酉丑→未・亥卯未→丑)、男は順回り・女は逆回り(全書「安小限訣」)
 *   大限     … shibi.js と同じ。始まりの宮に2通りある
 *              mei  … 命宮から始める(iztro、「大限由命宫起」)
 *              next … 命宮の隣から始める(維基文庫の全書「安大限訣」: 陽男陰女は命の前の宮=父母宮から順行、陰男陽女は命の後の宮=兄弟宮から逆行)
 * 運勢の文章は持たない。どの宮に何が入るかだけを出す。
 */

const SB_SHOGEN_START = [10, 7, 4, 1]; // 年支%4 → 小限の起点(申子辰=戌・巳酉丑=未・寅午戌=辰・亥卯未=丑)
const SB_TAIGEN_FROM_LABEL = { mei: "命宮から始める", next: "命宮の隣の宮から始める(全書の安大限訣)" };

const sbYearStem = (y) => sbMod(y - 4, 10);
const sbYearBranch = (y) => sbMod(y - 4, 12);
const sbNominalAge = (c, y) => y - c.birth.year + 1;

/* 小限の宮。性別が分からなければ null */
function sbShogen(c, y, sex) {
  if (sex !== "m" && sex !== "f") return null;
  const age = sbNominalAge(c, y);
  if (age < 1) return null;
  return sbMod(SB_SHOGEN_START[c.birth.yBranch % 4] + (sex === "m" ? 1 : -1) * (age - 1), 12);
}

/* 大限の表(12行)。性別が分からなければ null */
function sbTaigenTable(c, sex, from) {
  if (sex !== "m" && sex !== "f") return null;
  const yang = c.birth.yStem % 2 === 0;
  const dir = (yang === (sex === "m")) ? 1 : -1;
  const shift = from === "next" ? 1 : 0;
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const br = sbMod(c.mei + dir * (i + shift), 12);
    rows.push({ branch: br, palace: c.palaces[br].name, from: c.kyoku + 10 * i, to: c.kyoku + 10 * i + 9 });
  }
  return rows;
}

/* ある年の流年。c は shibiChart の結果 */
function sbRyunen(c, y, sex, taigenFrom) {
  const stem = sbYearStem(y), branch = sbYearBranch(y);
  const age = sbNominalAge(c, y);
  const flowName = (br) => SB_PALACE[sbMod(branch - br, 12)];
  const sika = sbSika(stem, c.opt).map((star, i) => {
    const br = c.pos[star];
    return { kind: SB_SIKA_NAME[i], star, branch: br, palace: c.palaces[br].name, flow: flowName(br), natal: SB_SIKA_NAME[c.sika.indexOf(star)] || null };
  });
  const sg = sbShogen(c, y, sex);
  const table = sbTaigenTable(c, sex, taigenFrom || "mei");
  const taigen = table ? table.find((r) => age >= r.from && age <= r.to) || null : null;
  return {
    year: y, stem, branch, age, flowName, sika, taigenTable: table, taigen,
    natal: c.palaces[branch].name,
    stars: sbStarsAt(c, branch),
    shogen: sg === null ? null : { branch: sg, palace: c.palaces[sg].name, stars: sbStarsAt(c, sg) },
    beforeFirst: !!table && age >= 1 && age < c.kyoku,
    sameTaigen: !!taigen && taigen.branch === branch,
    sameShogen: sg === branch,
  };
}

/* 2つの流年の違い(数え方を変えたときの表示用)。[キー, 前, 後] の配列 */
function sbRyunenDiffs(p, q) {
  const out = [];
  if (p.natal !== q.natal) out.push(["natal", p.natal, q.natal]);
  if (p.stars.stars.join() !== q.stars.stars.join()) out.push(["stars", p.stars.stars.join("・"), q.stars.stars.join("・")]);
  if (p.age !== q.age) out.push(["age", p.age, q.age]);
  if ((p.shogen && p.shogen.palace) !== (q.shogen && q.shogen.palace)) out.push(["shogen", p.shogen && p.shogen.palace, q.shogen && q.shogen.palace]);
  if ((p.taigen && p.taigen.palace) !== (q.taigen && q.taigen.palace)) out.push(["taigen", p.taigen ? p.taigen.palace : "なし", q.taigen ? q.taigen.palace : "なし"]);
  p.sika.forEach((s, i) => { if (s.palace !== q.sika[i].palace || s.star !== q.sika[i].star) out.push(["sika", `${s.star}${s.kind} ${s.palace}`, `${q.sika[i].star}${q.sika[i].kind} ${q.sika[i].palace}`]); });
  return out;
}

/* その年の旧正月(日本の旧暦)。{ m, d } */
function sbLunarNewYear(y, tz) {
  for (let m = 1; m <= 2; m++) {
    for (let d = 1; d <= 31; d++) {
      if (m === 2 && d > 28) break;
      const l = sbLunar(jdn(y, m, d), tz || 9);
      if (l && l.year === y && l.num === 1 && l.day === 1 && !l.leap) return { m, d };
    }
  }
  return null;
}

/*
 * 流月(その年の月ごと)。
 *   斗君(流月の正月) … 流年の太歳宮を正月として生まれ月まで逆に数え、そこを子の刻として生まれた時刻まで順に数えた宮
 *                      (全書「安斗君訣」・iztro「安子斗诀」)。翌年の斗君は1宮先に進む
 *   流月命宮         … 斗君から1か月に1宮ずつ順回り
 *   月               … 旧暦の月。閏月は命盤の閏月の数え方(opt.leap)に合わせる(15日で分ける/丸ごと次の月/丸ごと前の月)
 *   流月四化の十干   … 流派で2通り(iztro「流月四化因派别不同会有差异」)
 *                      month  … その月の干支の十干(五虎遁。流年の十干で正月=寅月の十干が決まる)
 *                      palace … 流月命宮がある宮の十干
 */
const SB_RYUGETSU_SIKA_LABEL = { month: "月の干支の十干で引く(五虎遁)", palace: "流月命宮の宮の十干で引く" };
const SB_MONTH_NAME = ["", "正月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function sbDoukun(c, y) { return sbMod(sbYearBranch(y) - (c.birth.month - 1) + c.birth.hourBranch, 12); }

/* 日の通し番号 → { y, m, d } */
function sbYmd(J) {
  const a = J + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
  return { y: 100 * b + d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
}

/* 旧暦の y 年の月(正月〜十二月と閏月)。{ num, leap, start, end } */
function sbLunarMonthsOfYear(y, tz) {
  const out = [];
  for (const wy of [y - 1, y]) for (const mo of sbLunarTable(wy, tz)) if (mo.year === y) out.push(mo);
  return out;
}

/* 流月の表。行は月ごと(閏月を15日で分けるときは2行)。{ k(1〜12), label, start, end, branch, natal, stars, stem, sika[] } */
function sbRyugetsu(c, y, sikaFrom) {
  const tz = c.opt.cal === "cn" ? 8 : 9;
  const rows = [];
  const add = (yy, k, label, start, end, leapNote) => {
    const branch = sbMod(sbDoukun(c, yy) + k - 1, 12);
    const tiger = ((sbYearStem(yy) % 5) * 2 + 2) % 10;
    const stem = sikaFrom === "palace" ? c.palaces[branch].stem : (tiger + k - 1) % 10;
    const sika = sbSika(stem, c.opt).map((star, i) => ({ kind: SB_SIKA_NAME[i], star, branch: c.pos[star], palace: c.palaces[c.pos[star]].name }));
    rows.push({ y: yy, k, label, start, end, leapNote, branch, natal: c.palaces[branch].name, stars: sbStarsAt(c, branch), stem, sika });
  };
  // 閏月を k 番目の月として数えたとき、13 になったら翌年の正月
  const addK = (k, label, start, end, note) => (k > 12 ? add(y + 1, 1, label, start, end, note) : add(y, k, label, start, end, note));
  for (const mo of sbLunarMonthsOfYear(y, tz)) {
    if (!mo.leap) { addK(mo.num, SB_MONTH_NAME[mo.num], mo.start, mo.end, null); continue; }
    const name = `閏${SB_MONTH_NAME[mo.num]}`;
    if (c.opt.leap === "same") addK(mo.num, name, mo.start, mo.end, `${SB_MONTH_NAME[mo.num]}として数える`);
    else if (c.opt.leap === "next") addK(mo.num + 1, name, mo.start, mo.end, `${SB_MONTH_NAME[mo.num % 12 + 1]}として数える`);
    else {
      addK(mo.num, `${name}(1〜15日)`, mo.start, Math.min(mo.start + 14, mo.end), `${SB_MONTH_NAME[mo.num]}として数える`);
      if (mo.end > mo.start + 14) addK(mo.num + 1, `${name}(16日〜)`, mo.start + 15, mo.end, `${SB_MONTH_NAME[mo.num % 12 + 1]}として数える`);
    }
  }
  return rows;
}
