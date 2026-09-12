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
 * 太陽の視黄経が315度になる瞬間なので、astro.js の節気計算にそのまま任せる。
 * 確認済み: 1984→2/5、2020→2/4、2021→2/3(23:58)、2025→2/3
 */
function risshunDay(year) {
  return jdToJstParts(risshunJd(year)).d; // 3, 4, 5 のいずれか
}

/*
 * 立春基準の「年」。立春より前に生まれていれば前年扱い。
 * 四柱推命の年柱と同じ「瞬間」で判定する。日単位で判定すると、立春当日の朝に
 * 生まれた人だけ九星と四柱推命で年がずれる。
 * 時刻を渡さない場合は正午とみなす。
 */
function kyuseiYear(y, m, d, hour, minute) {
  const hasTime = hour !== null && hour !== undefined;
  const jd = jdFromJst(y, m, d, hasTime ? hour : 12, hasTime ? (minute || 0) : 0);
  return jd >= risshunJd(y) ? y : y - 1;
}

/* ---------- 九星気学 本命星 ---------- */

/*
 * 年の各桁を1桁になるまで足し、11から引く。10になったら1、0になったら9。
 * 例: 2000年→2→11-2=9(九紫火星)、1990年→1→10→1(一白水星)、1985年→5→6(六白金星)
 * 戻り値は 1〜9(一白〜九紫)
 */
function honmeisei(y, m, d, hour, minute) {
  const yy = kyuseiYear(y, m, d, hour, minute);
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
 * 太陽の実際の視黄経から星座を決める。早見表(3/21〜4/19 が牡羊座…)は
 * 境目の日が年によって1日ずれるため使わない。出生図の太陽と必ず一致する。
 * 戻り値は 0〜11(牡羊座〜魚座)
 */
function zodiacIndex(y, m, d, hour, minute) {
  const hasTime = hour !== null && hour !== undefined;
  const jd = jdFromJst(y, m, d, hasTime ? hour : 12, hasTime ? (minute || 0) : 0);
  return signOf(sunLongitude(ttFrom(jd))).sign;
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

function buildProfile(y, m, d, today, hour, minute) {
  const age = moonAge(y, m, d);
  const ky = kyuseiYear(y, m, d, hour, minute);
  const risshun = jdToJstParts(risshunJd(y));
  return {
    y, m, d,
    lifePath: lifePathNumber(y, m, d),
    birthdayNum: birthdayNumber(d),
    honmeisei: honmeisei(y, m, d, hour, minute),
    kyuseiYear: ky,
    risshun: risshun.d,
    risshunTime: risshun,
    /* 立春当日に生まれ、かつ時刻が未入力なら年の判定が確定しない */
    risshunAmbiguous: m === 2 && d === risshun.d
      && (hour === null || hour === undefined),
    eto: eto(y),
    etoRisshun: eto(ky),
    zodiac: zodiacIndex(y, m, d, hour, minute),
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


/* ---------- 九星の回座(年運・月運の骨組み) ---------- */

/*
 * 九星気学では、盤の中心(中宮)に入る星が毎年1つずつ減っていく。
 * 自分の本命星が「その年の盤のどの宮にいるか」で運気の段階が決まり、
 * 9年でひと回りする。これは占いの中では珍しく、完全に計算で決まる部分。
 *
 * 後天定位盤の宮番号: 1=坎(北) 2=坤(南西) 3=震(東) 4=巽(南東)
 *                     5=中宮   6=乾(北西) 7=兌(西) 8=艮(北東) 9=離(南)
 */

/* その年(立春基準)の年盤中宮。本命星と同じ式で出る */
function kyuseiYearCenter(year) {
  let k = (11 - reduceToDigit(year)) % 9;
  if (k === 0) k = 9;
  return k;
}

/*
 * 月盤中宮。年の十二支で「寅月(2月)の中宮」が決まり、そこから月ごとに1つ減る。
 *   子午卯酉の年 → 寅月は八白 / 辰戌丑未の年 → 五黄 / 寅申巳亥の年 → 二黒
 */
function kyuseiMonthCenter(yearBranch, monthBranch) {
  let tiger;
  if ([0, 6, 3, 9].includes(yearBranch)) tiger = 8;        // 子午卯酉
  else if ([4, 10, 1, 7].includes(yearBranch)) tiger = 5;  // 辰戌丑未
  else tiger = 2;                                          // 寅申巳亥
  const months = ((monthBranch - 2) % 12 + 12) % 12;
  let c = (tiger - months) % 9;
  if (c <= 0) c += 9;
  return c;
}

/*
 * 本命星 honmei が、中宮が center の盤でどの宮にいるか(1〜9)。
 * 中宮が自分の星と同じ年は宮5(中宮)＝八方塞がりになる。
 */
function kyuseiPalace(honmei, center) {
  return ((honmei - center + 4) % 9 + 9) % 9 + 1;
}

/* ---------- 年運・月運 ---------- */

/*
 * 段階ごとの基本の星数。運勢の星は、この回座から決まる数を軸にして、
 * 生年月日と期間から作る疑似乱数で ±1 だけ動かす。
 * (毎回まったくの乱数にすると、九星の周期と食い違って意味が消えるため)
 */
const PALACE_BASE_STARS = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 2, 6: 4, 7: 5, 8: 3, 9: 5 };

/*
 * 年運・月運の星は下限を2にする。1年ずっと星1つと出るのは、
 * 当たる当たらない以前に読んでいて気分の良いものではないため。
 * 日運(dailyFortune)は1日で終わるので、そちらは1つも出る。
 */
function shiftStar(base, r) {
  const v = base + (r < 0.25 ? -1 : (r > 0.75 ? 1 : 0));
  return Math.max(2, Math.min(5, v));
}

/*
 * 年運。targetYear は立春基準の年(1月〜節分は前年として渡すこと)。
 */
function yearlyFortune(y, m, d, targetYear, pools) {
  const honmei = honmeisei(y, m, d, null, null);
  const center = kyuseiYearCenter(targetYear);
  const palace = kyuseiPalace(honmei, center);
  const rng = makeRng(seedFromString(`${y}-${m}-${d}|Y${targetYear}`));
  const base = PALACE_BASE_STARS[palace];
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return {
    kind: "year",
    label: `${targetYear}年`,
    honmei, center, palace,
    overall: shiftStar(base, rng()),
    love: shiftStar(base, rng()),
    work: shiftStar(base, rng()),
    money: shiftStar(base, rng()),
    theme: pick(pools.yearThemes),
    advice: pick(pools.advices),
  };
}

/*
 * 月運。targetMonthBranch は節切りの月の十二支(chart.js の solarMonthOf から)。
 */
function monthlyFortune(y, m, d, targetYear, yearBranch, monthBranch, label, pools) {
  const honmei = honmeisei(y, m, d, null, null);
  const center = kyuseiMonthCenter(yearBranch, monthBranch);
  const palace = kyuseiPalace(honmei, center);
  const rng = makeRng(seedFromString(`${y}-${m}-${d}|M${targetYear}-${monthBranch}`));
  const base = PALACE_BASE_STARS[palace];
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return {
    kind: "month",
    label,
    honmei, center, palace,
    overall: shiftStar(base, rng()),
    love: shiftStar(base, rng()),
    work: shiftStar(base, rng()),
    money: shiftStar(base, rng()),
    theme: pick(pools.monthThemes),
    advice: pick(pools.advices),
  };
}
