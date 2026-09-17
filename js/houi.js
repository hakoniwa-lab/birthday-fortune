/*
 * 九星気学の年の吉方位・凶方位。表を持たず、年盤と五行の規則だけで出す。
 *
 * 年盤 … 中宮(まん中)の星が毎年1つずつ減り、残りの星は後天定位の順に並ぶ
 * 凶方位 … 五黄殺(五黄土星のいる方位) / 暗剣殺(その反対) /
 *          本命殺(自分の本命星のいる方位) / 本命的殺(その反対) /
 *          歳破(その年の十二支の反対側) / 定位対冲(星が本来の場所の反対側にいる方位)
 * 吉方位 … 本命星と相生・比和の関係にある星がいて、凶方位に当たらない方位
 *
 * 検証: 2026年(一白水星中宮)の本命星 一白・二黒・九紫 の3つで、
 *       公開されている九星気学サイトの吉方位・凶方位と全方位一致。
 *
 * 流派によって、月の凶方位や小児殺などを加える場合がある。ここでは年だけを扱う。
 *
 * fortune.js(kyuseiYearCenter) に依存する。
 */

/* 後天定位。宮の番号(＝本来そこにいる星)→方位 */
const HOUI_PALACE = { 1: "北", 2: "南西", 3: "東", 4: "東南", 6: "北西", 7: "西", 8: "北東", 9: "南" };
const HOUI_ORDER = ["北", "北東", "東", "東南", "南", "南西", "西", "北西"];
const HOUI_OPPOSITE = { 北: "南", 南: "北", 東: "西", 西: "東", 北東: "南西", 南西: "北東", 東南: "北西", 北西: "東南" };

/* 星の五行。一白=水 … 九紫=火 */
const STAR_GOGYO = [null, "水", "土", "木", "木", "土", "金", "金", "土", "火"];
const GOGYO_GEN = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };

/* 十二支(子=0)の方位 */
const BRANCH_DIR = ["北", "北東", "北東", "東", "東南", "東南", "南", "南西", "南西", "西", "北西", "北西"];

/* 中宮が center のとき、宮 palace にいる星 */
function starInPalace(palace, center) {
  return ((palace + center - 6) % 9 + 9) % 9 + 1;
}

/* 本命星と相性の良い星か(相生・比和。五黄は除く) */
function isFriendStar(honmei, star) {
  if (star === 5 || star === honmei) return false;
  const a = STAR_GOGYO[honmei], b = STAR_GOGYO[star];
  return a === b || GOGYO_GEN[a] === b || GOGYO_GEN[b] === a;
}

/* 相性の良い星の一覧(表示用) */
function friendStars(honmei) {
  return [1, 2, 3, 4, 6, 7, 8, 9].filter((s) => isFriendStar(honmei, s));
}

/* 年盤と方位ごとの吉凶。year は立春で始まる年 */
function yearDirections(year, honmei) {
  const center = kyuseiYearCenter(year);
  const branch = ((year - 4) % 12 + 12) % 12;
  const saiha = HOUI_OPPOSITE[BRANCH_DIR[branch]];

  const starByDir = {};
  const dirByStar = {};
  for (const [palace, dir] of Object.entries(HOUI_PALACE)) {
    const s = starInPalace(Number(palace), center);
    starByDir[dir] = s;
    dirByStar[s] = dir;
  }
  const gooDir = dirByStar[5] || null;                    // 五黄が中宮なら方位なし
  const honDir = dirByStar[honmei] || null;               // 本命星が中宮なら方位なし

  const dirs = HOUI_ORDER.map((dir) => {
    const star = starByDir[dir];
    const bad = [];
    if (dir === gooDir) bad.push("五黄殺");
    if (gooDir && dir === HOUI_OPPOSITE[gooDir]) bad.push("暗剣殺");
    if (dir === honDir) bad.push("本命殺");
    if (honDir && dir === HOUI_OPPOSITE[honDir]) bad.push("本命的殺");
    if (dir === saiha) bad.push("歳破");
    if (HOUI_PALACE[star] === HOUI_OPPOSITE[dir]) bad.push("定位対冲");
    const friend = isFriendStar(honmei, star);
    return { dir, star, bad, good: friend && bad.length === 0, friend };
  });

  return {
    year, center, honmei,
    hakkou: center === honmei,            // 本命星が中宮 ＝ 八方塞がり
    dirs,
    good: dirs.filter((d) => d.good).map((d) => d.dir),
  };
}

const HOUI_BAD_TEXT = {
  五黄殺: "五黄土星のいる方位。自分から災いに向かっていくとされる、もっとも重い凶方位",
  暗剣殺: "五黄殺の反対側。思いがけない災いを外から受けるとされる",
  本命殺: "自分の本命星のいる方位。体調や自分自身に影響が出やすいとされる",
  本命的殺: "本命殺の反対側。目標や判断を誤りやすいとされる",
  歳破: "その年の十二支の反対側。物事が破れやすいとされる",
  定位対冲: "星が本来の定位置の反対側に来ている方位。落ち着かず物事がこじれやすいとされる",
};
