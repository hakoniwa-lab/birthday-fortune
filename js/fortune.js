/*
 * 生年月日からの計算ロジック(純粋関数、DOM非依存)。
 * 文章データは data.js、画面は app.js が持つ。
 *
 * ここで扱う暦の計算はすべて決定論的で、同じ生年月日を入れれば必ず同じ結果になる。
 * 「占い」の部分(今日の運勢)は生年月日と今日の日付から作る疑似乱数で、
 * 日が変わると変わり、同じ日のうちは何度押しても同じになる。
 */

/* ---------- 数字の共通処理 ---------- */

function digitSum(n) {
  return String(n).split("").reduce((a, c) => a + Number(c), 0);
}

/* 1桁になるまで足す */
function reduceToDigit(n) {
  let x = n;
  while (x > 9) x = digitSum(x);
  return x;
}

/* 数秘術用: 11・22・33(マスターナンバー)は途中で出たら残す */
function reduceKeepMaster(n) {
  let x = n;
  while (x > 9 && x !== 11 && x !== 22 && x !== 33) x = digitSum(x);
  return x;
}

/* ---------- 数秘術 ライフパスナンバー ---------- */

/*
 * 年・月・日をそれぞれ還元してから合計し、もう一度還元する流儀。
 * 例: 1990年12月25日 → 1990→19→10→1、12→3、25→7 → 1+3+7=11 → 11(マスター)
 */
function lifePathNumber(y, m, d) {
  const total = reduceKeepMaster(y) + reduceKeepMaster(m) + reduceKeepMaster(d);
  return reduceKeepMaster(total);
}

/* 誕生数(バースデーナンバー): 日にちだけを還元したもの */
function birthdayNumber(d) {
  return reduceKeepMaster(d);
}

/* ---------- 立春(九星の年の境目) ---------- */

/*
 * 立春は毎年2月3日〜5日のどれかで、年によって動く。
 * 2021年2月3日23:59(日本時間)を起点に、1太陽年=365.2422日ずつ進める線形モデルで求める。
 * 実際の天文計算とは数十分ずれることがあるため、境目ぴったりの日は前後する可能性がある。
 * 確認済み: 1984→2/5、2020→2/4、2021→2/3、2025→2/3
 */
function risshunDay(year) {
  const anchorUtc = Date.UTC(2021, 1, 3, 14, 59); // 2021-02-03 23:59 JST
  const t = anchorUtc + (year - 2021) * 365.2422 * 86400000;
  const jst = new Date(t + 9 * 3600000);
  return jst.getUTCDate(); // 3, 4, 5 のいずれか
}

/* 立春基準の「年」。1月と、2月の立春前日までは前年扱い */
function kyuseiYear(y, m, d) {
  if (m === 1 || (m === 2 && d < risshunDay(y))) return y - 1;
  return y;
}

/* ---------- 九星気学 本命星 ---------- */

/*
 * 年の各桁を1桁になるまで足し、11から引く。10になったら1、0になったら9。
 * 例: 2000年→2→11-2=9(九紫火星)、1990年→1→10→1(一白水星)、1985年→5→6(六白金星)
 * 戻り値は 1〜9(一白〜九紫)
 */
function honmeisei(y, m, d) {
  const yy = kyuseiYear(y, m, d);
  let k = (11 - reduceToDigit(yy)) % 9;
  if (k === 0) k = 9;
  return k;
}

/* ---------- 十干十二支 ---------- */

const JIKKAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const JIKKAN_YOMI = ["きのえ", "きのと", "ひのえ", "ひのと", "つちのえ", "つちのと", "かのえ", "かのと", "みずのえ", "みずのと"];
const JUNISHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const JUNISHI_YOMI = ["ね", "うし", "とら", "う", "たつ", "み", "うま", "ひつじ", "さる", "とり", "いぬ", "い"];

/*
 * 1984年が甲子。年賀状などで使う暦年基準(1月1日で切り替わる)。
 * 四柱推命・九星では立春で切り替わるため、その場合は kyuseiYear を渡す。
 */
function eto(year) {
  const k = ((year - 4) % 10 + 10) % 10;
  const s = ((year - 4) % 12 + 12) % 12;
  return {
    kan: JIKKAN[k],
    kanYomi: JIKKAN_YOMI[k],
    shi: JUNISHI[s],
    shiYomi: JUNISHI_YOMI[s],
    shiIndex: s,
    label: JIKKAN[k] + JUNISHI[s],
    yomi: JIKKAN_YOMI[k] + JUNISHI_YOMI[s],
  };
}

/* ---------- 西洋占星術 太陽星座 ---------- */

/*
 * 境目の日は年によって1日前後する。ここでは一般的な早見表の区切りを使う。
 * 戻り値は 0〜11(牡羊座〜魚座)
 */
function zodiacIndex(m, d) {
  const md = m * 100 + d;
  if (md >= 321 && md <= 419) return 0;  // 牡羊
  if (md >= 420 && md <= 520) return 1;  // 牡牛
  if (md >= 521 && md <= 621) return 2;  // 双子
  if (md >= 622 && md <= 722) return 3;  // 蟹
  if (md >= 723 && md <= 822) return 4;  // 獅子
  if (md >= 823 && md <= 922) return 5;  // 乙女
  if (md >= 923 && md <= 1023) return 6; // 天秤
  if (md >= 1024 && md <= 1122) return 7; // 蠍
  if (md >= 1123 && md <= 1221) return 8; // 射手
  if (md >= 1222 || md <= 119) return 9; // 山羊
  if (md >= 120 && md <= 218) return 10; // 水瓶
  return 11;                              // 魚 2/19〜3/20
}

/* ---------- 曜日 ---------- */

function weekdayIndex(y, m, d) {
  return new Date(y, m - 1, d).getDay(); // 0=日
}

/* ---------- 月齢 ---------- */

/*
 * 2000年1月6日18:14(UTC)の新月を基準に、朔望月29.530589日で割った余り。
 * 生まれた日の正午(日本時間)で評価する。平均値なので実際とは最大で半日ほどずれる。
 */
function moonAge(y, m, d) {
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const t = Date.UTC(y, m - 1, d, 3, 0); // 12:00 JST
  const synodic = 29.530589;
  let age = ((t - ref) / 86400000) % synodic;
  if (age < 0) age += synodic;
  return age;
}

/* 月齢 → 8段階のインデックス(0=新月 … 7=有明) */
function moonPhaseIndex(age) {
  const step = 29.530589 / 8;
  // 新月を中心に±半区間で区切る
  return Math.floor(((age + step / 2) % 29.530589) / step);
}

/* ---------- 年齢 ---------- */

function ageAt(y, m, d, today) {
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/* ---------- 今日の運勢(疑似乱数) ---------- */

/* 文字列 → 32bit のシード(xmur3) */
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/* mulberry32: 0以上1未満の乱数を返す関数を作る */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 1〜5の星。3〜4が出やすく、1と5は控えめ */
function starFrom(r) {
  if (r < 0.06) return 1;
  if (r < 0.24) return 2;
  if (r < 0.58) return 3;
  if (r < 0.88) return 4;
  return 5;
}

/*
 * 生年月日と日付から、その日の運勢を決める。
 * pools には data.js の配列(色・アイテム・一言)を渡す。
 */
function dailyFortune(y, m, d, date, pools) {
  const key = `${y}-${m}-${d}|${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const rng = makeRng(seedFromString(key));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return {
    overall: starFrom(rng()),
    love: starFrom(rng()),
    work: starFrom(rng()),
    money: starFrom(rng()),
    luckyNumber: 1 + Math.floor(rng() * 9),
    luckyColor: pick(pools.colors),
    luckyItem: pick(pools.items),
    message: pick(pools.messages),
    advice: pick(pools.advices),
  };
}

/* ---------- まとめ ---------- */

function buildProfile(y, m, d, today) {
  const age = moonAge(y, m, d);
  return {
    y, m, d,
    lifePath: lifePathNumber(y, m, d),
    birthdayNum: birthdayNumber(d),
    honmeisei: honmeisei(y, m, d),
    kyuseiYear: kyuseiYear(y, m, d),
    risshun: risshunDay(y),
    eto: eto(y),
    etoRisshun: eto(kyuseiYear(y, m, d)),
    zodiac: zodiacIndex(m, d),
    weekday: weekdayIndex(y, m, d),
    moonAge: age,
    moonPhase: moonPhaseIndex(age),
    age: ageAt(y, m, d, today),
  };
}

/* 日付の妥当性(2月30日などを弾く) */
function isValidDate(y, m, d) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
