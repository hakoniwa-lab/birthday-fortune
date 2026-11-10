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
