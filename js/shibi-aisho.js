/*
 * 紫微斗数の相性(shibi/aisho/)の計算。命盤は shibi.js の shibiChart で作り、2枚を重ねて読む材料を出す。
 *
 * 『紫微斗数全書』(維基文庫の本文)には合婚・合盤の語も章もなく、二人の命盤の比べ方に決まった手順はない。
 * ここでは現代の解説に出てくる見方を、点数にせず並べる。
 *   系統     … 命宮の主星を 紫府廉系(紫微・天府・廉貞・武曲・天相・七殺・破軍・貪狼)と 機月系(天機・太陰・天同・天梁・巨門・太陽)に分ける
 *   命宮の位置 … 相手の命宮が自分の命盤のどの宮にあたるか。二人の命宮が三合(4つ離れた宮)かどうか
 *   生年四化 … 生まれ年の十干で決まる4つの星(化禄・化権・化科・化忌)が、相手の命盤のどの宮にあるか
 *   夫妻宮   … 二人の夫妻宮の主星
 * どれも向きがあるので、両方の向きを出す。
 */

const SB_KEI = {
  紫微: "紫府廉系", 天府: "紫府廉系", 廉貞: "紫府廉系", 武曲: "紫府廉系", 天相: "紫府廉系", 七殺: "紫府廉系", 破軍: "紫府廉系", 貪狼: "紫府廉系",
  天機: "機月系", 太陰: "機月系", 天同: "機月系", 天梁: "機月系", 巨門: "機月系", 太陽: "機月系",
};
const SB_PALACE_MEANS = {
  命宮: "本人そのもの", 兄弟宮: "きょうだい・身近な仲間", 夫妻宮: "恋愛・結婚", 子女宮: "子ども・目下の相手",
  財帛宮: "お金の出入り", 疾厄宮: "体と心の調子", 遷移宮: "外での動き・移動", 交友宮: "友人・付き合い",
  官禄宮: "仕事", 田宅宮: "家・財産", 福徳宮: "楽しみ・心のゆとり", 父母宮: "親・目上の人",
};
const SB_SIKA_MEANS = { 化禄: "喜び・愛情", 化権: "主導権", 化科: "信頼・評価", 化忌: "執着・課題" };

/* 宮の主星。空なら向かいの宮から借りる(命宮の sbMeiStars と同じ扱い) */
function sbStarsAt(c, br) {
  const own = c.palaces[br].major.map((s) => s.name);
  if (own.length) return { stars: own, borrowed: false };
  return { stars: c.palaces[sbMod(br + 6, 12)].major.map((s) => s.name), borrowed: true };
}

/* 夫妻宮の十二支の番号(命宮から逆回りに2つ) */
function sbFusaiBranch(c) { return sbMod(c.mei - 2, 12); }

/* 主星の系統(重複なし)。同じ宮に入る主星はいつも同じ系統になる(gen_shibi_aisho.js で確かめている) */
function sbKeiOf(stars) { return [...new Set(stars.map((s) => SB_KEI[s]))]; }

/* 二人の命宮の位置関係。same=同じ宮 / sango=三合 / taikyu=向かい合う宮 / other=それ以外 */
function sbMeiRelation(a, b) {
  const d = sbMod(b.mei - a.mei, 12);
  if (d === 0) return "same";
  if (d === 4 || d === 8) return "sango";
  if (d === 6) return "taikyu";
  return "other";
}

/* from の生年四化の4つの星が、to の命盤のどの宮にあるか */
function sbSikaInto(from, to) {
  return from.sika.map((star, i) => ({ kind: SB_SIKA_NAME[i], star, branch: to.pos[star], palace: to.palaces[to.pos[star]].name }));
}

/* 二人の命盤を重ねた結果。a=あなた、b=相手 */
function sbPair(a, b) {
  const meiA = sbMeiStars(a), meiB = sbMeiStars(b);
  const fusaiA = sbStarsAt(a, sbFusaiBranch(a)), fusaiB = sbStarsAt(b, sbFusaiBranch(b));
  return {
    a, b, meiA, meiB, fusaiA, fusaiB,
    keiA: sbKeiOf(meiA.stars), keiB: sbKeiOf(meiB.stars),
    rel: sbMeiRelation(a, b),
    bInA: a.palaces[b.mei].name, // 相手の命宮は、あなたの命盤のどの宮か
    aInB: b.palaces[a.mei].name, // あなたの命宮は、相手の命盤のどの宮か
    sikaAtoB: sbSikaInto(a, b),  // あなたの四化が相手の命盤に入る宮
    sikaBtoA: sbSikaInto(b, a),  // 相手の四化があなたの命盤に入る宮
    overlapAB: fusaiA.stars.filter((s) => meiB.stars.includes(s)), // あなたの夫妻宮の星のうち、相手の命宮にもある星
    overlapBA: fusaiB.stars.filter((s) => meiA.stars.includes(s)), // 相手の夫妻宮の星のうち、あなたの命宮にもある星
  };
}

/* 2つの結果の違い(数え方を変えたときの比較)。[項目, 変更前, 変更後] の配列 */
function sbPairDiffs(p, q) {
  const mei = (m) => m.stars.join("・") + (m.borrowed ? "(借り)" : "");
  const sika = (l) => l.map((s) => `${s.kind}${s.star}${s.palace}`).join();
  const out = [];
  if (mei(p.meiA) !== mei(q.meiA)) out.push(["meiA", mei(p.meiA), mei(q.meiA)]);
  if (mei(p.meiB) !== mei(q.meiB)) out.push(["meiB", mei(p.meiB), mei(q.meiB)]);
  if (p.bInA !== q.bInA) out.push(["bInA", p.bInA, q.bInA]);
  if (p.aInB !== q.aInB) out.push(["aInB", p.aInB, q.aInB]);
  if (sika(p.sikaAtoB) !== sika(q.sikaAtoB)) out.push(["sikaAtoB", "", ""]);
  if (sika(p.sikaBtoA) !== sika(q.sikaBtoA)) out.push(["sikaBtoA", "", ""]);
  return out;
}
