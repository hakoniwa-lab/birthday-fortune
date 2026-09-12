/*
 * 世界の暦での誕生日。「こういうのもあるよ」の棚。
 *
 *   ユダヤ暦   … 太陽太陰暦。19年に7回の閏月に加えて、決められた曜日に新年が来ないよう
 *                1〜2日ずらす規則がある。全部計算で決まっていて観測に頼らない
 *   ヒジュラ暦 … 純粋な太陰暦で、季節とずれ続ける。ここでは30年に11回の閏年を置く
 *                【計算式による暦】を使う。実際の月初は新月を目で見て決めるので、
 *                国や年によって1日前後する
 *   インド暦   … 月の位置(ナクシャトラ)と、月と太陽の角度(ティティ)。
 *                歳差の補正(アヤナムシャ)を引いた恒星基準で測るのが西洋占星術との違い
 *
 * astro.js(jdn, jdFromJst, ttFrom, sunLongitude, moonLongitude, norm360) と
 * sukuyo.js(ayanamsha) に依存する。
 */

function _mod(a, b) { return ((a % b) + b) % b; }

/* ---------- ユダヤ暦 ---------- */

const HEBREW_EPOCH = 347995.5;

const HEBREW_MONTH = ["ニサン", "イヤル", "シヴァン", "タンムズ", "アヴ", "エルル",
  "ティシュレー", "ヘシュヴァン", "キスレヴ", "テベット", "シュヴァト", "アダル", "アダル第二"];

function hebrewLeap(year) { return _mod(year * 7 + 1, 19) < 7; }
function hebrewYearMonths(year) { return hebrewLeap(year) ? 13 : 12; }

/* 新年の基準になる日。モラド(朔の平均時刻)から出して、規則に従って後ろへずらす */
function hebrewDelay1(year) {
  const months = Math.floor((235 * year - 234) / 19);
  const parts = 12084 + 13753 * months;
  let day = months * 29 + Math.floor(parts / 25920);
  if (_mod(3 * (day + 1), 7) < 3) day++;
  return day;
}

function hebrewDelay2(year) {
  const last = hebrewDelay1(year - 1);
  const present = hebrewDelay1(year);
  const next = hebrewDelay1(year + 1);
  if (next - present === 356) return 2;
  if (present - last === 382) return 1;
  return 0;
}

function hebrewYearDays(year) {
  return hebrewToJd(year + 1, 7, 1) - hebrewToJd(year, 7, 1);
}

function hebrewMonthDays(year, month) {
  if (month === 2 || month === 4 || month === 6 || month === 10 || month === 13) return 29;
  if (month === 12 && !hebrewLeap(year)) return 29;
  if (month === 8 && _mod(hebrewYearDays(year), 10) !== 5) return 29;
  if (month === 9 && _mod(hebrewYearDays(year), 10) === 3) return 29;
  return 30;
}

function hebrewToJd(year, month, day) {
  const months = hebrewYearMonths(year);
  let jd = HEBREW_EPOCH + hebrewDelay1(year) + hebrewDelay2(year) + day + 1;
  if (month < 7) {
    for (let mon = 7; mon <= months; mon++) jd += hebrewMonthDays(year, mon);
    for (let mon = 1; mon < month; mon++) jd += hebrewMonthDays(year, mon);
  } else {
    for (let mon = 7; mon < month; mon++) jd += hebrewMonthDays(year, mon);
  }
  return jd;
}

/* jdn() が返すのは整数のユリウス日番号。古典的な暦の換算式は
   「その日の始まり(前日の正午から半日後)」を .5 で表す流儀なので 0.5 引いて渡す */
function jdToHebrew(jdInt) {
  const jd = jdInt - 0.5;
  const count = Math.floor(((jd - HEBREW_EPOCH) * 98496.0) / 35975351.0);
  let year = count - 1;
  for (let i = count; jd >= hebrewToJd(i, 7, 1); i++) year++;
  const first = jd < hebrewToJd(year, 1, 1) ? 7 : 1;
  let month = first;
  for (let i = first; jd > hebrewToJd(year, i, hebrewMonthDays(year, i)); i++) month++;
  const day = (jd - hebrewToJd(year, month, 1)) + 1;
  let name = HEBREW_MONTH[month - 1];
  if (month === 12 && hebrewLeap(year)) name = "アダル第一";
  return { year, month, day, name, leapYear: hebrewLeap(year) };
}

/* ---------- ヒジュラ暦(計算式による暦) ---------- */

const ISLAMIC_EPOCH = 1948439.5;

const ISLAMIC_MONTH = ["ムハッラム", "サファル", "ラビーウ・アルアウワル", "ラビーウ・アッサーニー",
  "ジュマーダー・アルウーラー", "ジュマーダー・アッサーニヤ", "ラジャブ", "シャアバーン",
  "ラマダーン", "シャウワール", "ズー・アルカアダ", "ズー・アルヒッジャ"];

function islamicToJd(year, month, day) {
  return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354
    + Math.floor((3 + 11 * year) / 30) + ISLAMIC_EPOCH - 1;
}

function jdToIslamic(jdInt) {
  const jd = jdInt - 0.5;
  const year = Math.floor((30 * (jd - ISLAMIC_EPOCH) + 10646) / 10631);
  const month = Math.min(12, Math.ceil((jd - (29 + islamicToJd(year, 1, 1))) / 29.5) + 1);
  const day = jd - islamicToJd(year, month, 1) + 1;
  return { year, month, day, name: ISLAMIC_MONTH[month - 1] };
}

/* ---------- インド暦 ---------- */

const NAKSHATRA = [
  ["アシュヴィニー", "婁"], ["バラニー", "胃"], ["クリッティカー", "昴"], ["ローヒニー", "畢"],
  ["ムリガシラー", "觜"], ["アールドラー", "参"], ["プナルヴァス", "井"], ["プシュヤ", "鬼"],
  ["アーシュレーシャー", "柳"], ["マガー", "星"], ["プールヴァ・パールグニー", "張"],
  ["ウッタラ・パールグニー", "翼"], ["ハスタ", "軫"], ["チトラー", "角"], ["スヴァーティー", "亢"],
  ["ヴィシャーカー", "氐"], ["アヌラーダー", "房"], ["ジェーシュター", "心"], ["ムーラ", "尾"],
  ["プールヴァ・アーシャーダー", "箕"], ["ウッタラ・アーシャーダー", "斗"], ["シュラヴァナ", "女"],
  ["ダニシュター", "虚"], ["シャタビシャー", "危"], ["プールヴァ・バードラパダー", "室"],
  ["ウッタラ・バードラパダー", "壁"], ["レーヴァティー", "奎"],
];

const RASHI = ["メーシャ", "ヴリシャバ", "ミトゥナ", "カルカ", "シンハ", "カニヤー",
  "トゥラー", "ヴリシュチカ", "ダヌ", "マカラ", "クンバ", "ミーナ"];

const RASHI_JP = ["牡羊", "牡牛", "双子", "蟹", "獅子", "乙女",
  "天秤", "蠍", "射手", "山羊", "水瓶", "魚"];

function indianOf(y, m, d, hour, minute) {
  const hasTime = hour !== null && hour !== undefined && hour !== "";
  const jd = jdFromJst(y, m, d, hasTime ? Number(hour) : 12, hasTime ? Number(minute || 0) : 0);
  const tt = ttFrom(jd);
  const ay = ayanamsha(jd);
  const moon = norm360(moonLongitude(tt) - ay);
  const sun = norm360(sunLongitude(tt) - ay);
  const nakIdx = Math.floor(moon / (360 / 27));
  const moonRashi = Math.floor(moon / 30);
  const sunRashi = Math.floor(sun / 30);
  /* ティティは月と太陽の角度を12度ずつ30に区切ったもの。15までが白分、16からが黒分 */
  const elong = norm360(moonLongitude(tt) - sunLongitude(tt));
  const tithiNo = Math.floor(elong / 12) + 1;
  return {
    nakshatra: NAKSHATRA[nakIdx][0],
    nakshatraShuku: NAKSHATRA[nakIdx][1],
    nakshatraNo: nakIdx + 1,
    moonRashi: RASHI[moonRashi],
    moonRashiJp: RASHI_JP[moonRashi],
    sunRashi: RASHI[sunRashi],
    sunRashiJp: RASHI_JP[sunRashi],
    tithiNo,
    paksha: tithiNo <= 15 ? "白分" : "黒分",
    tithiInPaksha: tithiNo <= 15 ? tithiNo : tithiNo - 15,
    ayanamsha: ay,
    estimated: !hasTime,
  };
}

/* ---------- まとめ ---------- */

function worldCalendarsOf(y, m, d, hour, minute) {
  const j = jdn(y, m, d);
  return {
    jdn: j,
    hebrew: jdToHebrew(j),
    islamic: jdToIslamic(j),
    indian: indianOf(y, m, d, hour, minute),
  };
}
