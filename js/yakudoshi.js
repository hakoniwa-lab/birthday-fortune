/*
 * 厄年と年祝い(長寿祝い)。数え年だけで決まる。
 *
 * 厄年は神社本庁の案内に合わせた。
 *   数え年 … 生まれたときが1歳、元日を迎えるたびに1つ増える
 *   本厄   … 男性 25・42・61歳、女性 19・33・37・61歳(数え年)
 *   前厄・後厄 … 本厄の前後1年
 *   大厄   … 男性42歳、女性33歳
 * 厄年の期間は「元日から大晦日まで」とするのが一般的だが、
 * 「立春から翌年の節分まで」とする寺社もあるので、両方の区切りを出す。
 *
 * 年祝いは、昔は数え年で祝ったが今は満年齢で祝うことも多いので両方の年を出す。
 * 還暦だけは「満60歳＝数え61歳」で、どちらで数えても同じ年になる。
 *
 * astro.js(risshunJd, jdToJstParts) に依存する。
 */

const YAKU_AGES = {
  男性: [25, 42, 61],
  女性: [19, 33, 37, 61],
};
const TAIYAKU = { 男性: 42, 女性: 33 };

function kazoeAge(birthY, year) {
  return year - birthY + 1;
}

/* その年がどの厄に当たるか。当たらなければ null */
function yakuOf(birthY, year, sex) {
  const age = kazoeAge(birthY, year);
  for (const hon of YAKU_AGES[sex]) {
    const kind = age === hon - 1 ? "前厄" : age === hon ? "本厄" : age === hon + 1 ? "後厄" : null;
    if (kind) return { kind, age, honAge: hon, taiyaku: hon === TAIYAKU[sex] };
  }
  return null;
}

/* 一生分の厄年。本厄ごとに前厄・後厄の年をまとめる */
function yakuYears(birthY, sex) {
  return YAKU_AGES[sex].map((hon) => ({
    honAge: hon,
    taiyaku: hon === TAIYAKU[sex],
    pre: birthY + hon - 2,
    main: birthY + hon - 1,
    post: birthY + hon,
  }));
}

/* 立春の日付(厄年を立春で区切る場合の始まり) */
function risshunDateOf(year) {
  const p = jdToJstParts(risshunJd(year));
  return { m: p.m, d: p.d };
}

const CHOJU = [
  { name: "還暦", yomi: "かんれき", age: 60, kanreki: true, text: "干支がひと回りして、生まれた年の干支に還る。赤いちゃんちゃんこで祝うのはこのため" },
  { name: "古希", yomi: "こき", age: 70, text: "杜甫の詩「人生七十古来稀なり」から" },
  { name: "喜寿", yomi: "きじゅ", age: 77, text: "「喜」の草書体が七十七に見えることから" },
  { name: "傘寿", yomi: "さんじゅ", age: 80, text: "「傘」の略字が八十に見えることから" },
  { name: "米寿", yomi: "べいじゅ", age: 88, text: "「米」の字を分けると八十八になることから" },
  { name: "卒寿", yomi: "そつじゅ", age: 90, text: "「卒」の略字「卆」が九十に見えることから" },
  { name: "白寿", yomi: "はくじゅ", age: 99, text: "「百」から「一」を取ると「白」になることから" },
  { name: "百寿", yomi: "ひゃくじゅ", age: 100, text: "百歳を祝う。紀寿(きじゅ)とも" },
];

/* 年祝いの年。manY=満年齢で祝う年、kazoeY=数え年で祝う年 */
function chojuYears(birthY) {
  return CHOJU.map((c) => ({
    ...c,
    manY: birthY + c.age,
    kazoeY: c.kanreki ? birthY + c.age : birthY + c.age - 1,
  }));
}
