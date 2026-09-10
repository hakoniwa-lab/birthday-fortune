/*
 * 四柱推命(命式)と、西洋占星術(出生図)の組み立て。
 * 天体位置と節気は astro.js、文章は data.js、画面は app.js。
 *
 * ここで扱う暦の計算は決定論的で、同じ入力からは必ず同じ結果になる。
 * 「時刻を入れていない場合」は正午(12:00)で計算し、画面側でその旨を出す。
 */

/* ---------- 干支の基礎データ ---------- */

const KAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const SHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/* 五行: 0=木 1=火 2=土 3=金 4=水 */
const GOGYO = ["木", "火", "土", "金", "水"];
/* 十干の五行は2つずつ。甲乙=木、丙丁=火… */
function kanElement(k) { return Math.floor(k / 2); }
/* 十干の陰陽。偶数番が陽(甲丙戊庚壬) */
function kanIsYang(k) { return k % 2 === 0; }
/* 十二支の五行 */
const SHI_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

/* ---------- 年柱・月柱・日柱・時柱 ---------- */

/*
 * 日柱。ユリウス日番号から60日周期で決まる。
 * (JDN + 49) mod 60 が干支の通し番号になる。
 * 検算: 1900-01-01 = 甲戌、2000-01-01 = 戊午。
 */
function dayPillarIndex(y, m, d) {
  return ((jdn(y, m, d) + 49) % 60 + 60) % 60;
}

/*
 * 生まれた瞬間が「どの節から始まる月」に入るかを返す。
 * 四柱推命の月は暦の月ではなく、節入り(立春・啓蟄…)で切り替わる。
 * 戻り値: { branch: 月の十二支index, yearForPillar: 年柱に使う年, sekki: その節 }
 */
function solarMonthOf(y, m, d, hour, minute) {
  const jd = jdFromJst(y, m, d, hour, minute);
  // 前年・当年・翌年の節を並べ、生まれた瞬間より前で一番新しい節を探す
  const terms = [];
  for (const yy of [y - 1, y, y + 1]) {
    for (const t of sekkiOfYear(yy)) terms.push(t);
  }
  terms.sort((a, b) => a.jd - b.jd);

  let current = terms[0];
  for (const t of terms) {
    if (t.jd <= jd) current = t; else break;
  }

  /*
   * 年柱は立春で切り替わる。節の名前から数えると年またぎで間違えるので、
   * その年の立春そのものと比べて決める。
   */
  const yearForPillar = jd >= risshunJd(y) ? y : y - 1;

  return { branch: current.branch, sekki: current, yearForPillar };
}

/*
 * 四柱を組む。hour が null のときは時柱を出さない。
 * lonEast を渡すと、標準時(東経135度)との経度差で時刻を補正する(地方時)。
 */
function fourPillars(y, m, d, hour, minute, lonEast) {
  const hasTime = hour !== null && hour !== undefined;
  const useHour = hasTime ? hour : 12;
  const useMin = hasTime ? (minute || 0) : 0;

  /*
   * 地方時への補正。東経135度(明石)から1度ずれるごとに4分ずれる。
   * ★ これは時支(2時間ごとの十二支)を決めるためだけに使う ★
   * 節入りや立春は天文現象なので、どこで生まれても同じ瞬間に起きる。
   * 経度補正した時刻で節入りと比べると、立春の前後1時間に生まれた人の年柱が
   * 九星気学とずれる(1922・1951・2025年の境目で実際に発生した)。
   */
  const shiftMin = lonEast ? (lonEast - 135) * 4 : 0;
  const localHour = ((Math.floor((useHour * 60 + useMin + shiftMin) / 60) % 24) + 24) % 24;

  // 節入り・年柱・日柱は、補正しない実際の日本時間で判定する
  const sm = solarMonthOf(y, m, d, useHour, useMin);

  // 年柱
  const yStem = ((sm.yearForPillar - 4) % 10 + 10) % 10;
  const yBranch = ((sm.yearForPillar - 4) % 12 + 12) % 12;

  /*
   * 月干は「五虎遁」で年干から決まる。
   * 甲己年の寅月は丙寅、乙庚年は戊寅、丙辛年は庚寅、丁壬年は壬寅、戊癸年は甲寅。
   */
  const tigerStem = ((yStem % 5) * 2 + 2) % 10;
  const monthsFromTiger = ((sm.branch - 2) % 12 + 12) % 12;
  const mStem = (tigerStem + monthsFromTiger) % 10;

  // 日柱。日の変わり目は0時とする(23時以降を翌日とする流派もある)。
  const dIndex = dayPillarIndex(y, m, d);
  const dStem = dIndex % 10;
  const dBranch = dIndex % 12;

  // 時柱。子の刻は23時から。23時台は当日の日干のまま子の刻とする。
  let hour4 = null;
  if (hasTime) {
    const hBranch = Math.floor(((localHour + 1) % 24) / 2);
    // 時干は「五鼠遁」で日干から決まる。甲己日の子刻は甲子、乙庚日は丙子…
    const ratStem = (dStem % 5) * 2;
    hour4 = { stem: (ratStem + hBranch) % 10, branch: hBranch };
  }

  const pillars = {
    year: { stem: yStem, branch: yBranch },
    month: { stem: mStem, branch: sm.branch },
    day: { stem: dStem, branch: dBranch },
    hour: hour4,
  };

  return {
    ...pillars,
    dayMaster: dStem,
    sekki: sm.sekki,
    localShiftMin: Math.round(shiftMin),
    tenGods: {
      year: tenGod(dStem, yStem),
      month: tenGod(dStem, mStem),
      hour: hour4 ? tenGod(dStem, hour4.stem) : null,
    },
    elements: countElements(pillars),
    kubo: kubo(dIndex),
    twelveFortune: twelveFortune(dStem, dBranch),
  };
}

/* ---------- 通変星(十干どうしの関係) ---------- */

const TEN_GODS = ["比肩", "劫財", "食神", "傷官", "偏財", "正財", "偏官", "正官", "偏印", "印綬"];

/*
 * 日干(自分)から見た、相手の十干の役割。
 * 五行の相生(木→火→土→金→水→木)と相剋(木剋土・火剋金・土剋水・金剋木・水剋火)、
 * それに陰陽が同じかどうかの組み合わせで10種類に分かれる。
 */
function tenGod(dayStem, other) {
  const a = kanElement(dayStem), b = kanElement(other);
  const same = kanIsYang(dayStem) === kanIsYang(other);
  if (b === a) return same ? "比肩" : "劫財";
  if (b === (a + 1) % 5) return same ? "食神" : "傷官";   // 自分が生む
  if (b === (a + 2) % 5) return same ? "偏財" : "正財";   // 自分が剋す
  if (a === (b + 2) % 5) return same ? "偏官" : "正官";   // 相手が自分を剋す
  return same ? "偏印" : "印綬";                          // 相手が自分を生む
}

/* ---------- 五行のバランス ---------- */

function countElements(p) {
  const c = [0, 0, 0, 0, 0];
  const add = (pl) => {
    if (!pl) return;
    c[kanElement(pl.stem)] += 1;
    c[SHI_ELEMENT[pl.branch]] += 1;
  };
  add(p.year); add(p.month); add(p.day); add(p.hour);
  return c;
}

/* ---------- 空亡(天中殺) ---------- */

/*
 * 十干は10、十二支は12あるので、10日でひと巡りする「旬」ごとに
 * 余った十二支が2つ出る。それが空亡。
 */
function kubo(dayIndex) {
  const head = dayIndex - (dayIndex % 10); // 旬の最初(甲◯)
  const headBranch = head % 12;
  return [(headBranch + 10) % 12, (headBranch + 11) % 12];
}

/* ---------- 十二運 ---------- */

const TWELVE_FORTUNE = ["長生", "沐浴", "冠帯", "建禄", "帝旺", "衰", "病", "死", "墓", "絶", "胎", "養"];

/*
 * 日干から見た十二支の勢い。陽干は順回り、陰干は逆回り。
 * 長生の位置: 甲=亥 乙=午 丙戊=寅 丁己=酉 庚=巳 辛=子 壬=申 癸=卯
 */
const CHOSEI = [
  [11, 1], [6, -1], [2, 1], [9, -1], [2, 1],
  [9, -1], [5, 1], [0, -1], [8, 1], [3, -1],
];

function twelveFortune(stem, branch) {
  const [start, dir] = CHOSEI[stem];
  const i = dir === 1 ? (branch - start + 12) % 12 : (start - branch + 12) % 12;
  return TWELVE_FORTUNE[i];
}

/* ---------- 西洋占星術の出生図 ---------- */

const PLANET_KEYS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];

/* 星座のエレメント(火地風水)と3区分(活動・不動・柔軟) */
function signElement(sign) { return sign % 4; }   // 0=火 1=地 2=風 3=水
function signQuality(sign) { return sign % 3; }   // 0=活動 1=不動 2=柔軟

/*
 * 出生図を組む。
 * hour が null なら正午で計算する(月は1日で約13度動くので、
 * 時刻がないと星座が1つずれることがある。画面側で注意書きを出す)。
 * place に { lat, lon } を渡したときだけアセンダントを出す。
 */
function westernChart(y, m, d, hour, minute, place) {
  const hasTime = hour !== null && hour !== undefined;
  const jdUt = jdFromJst(y, m, d, hasTime ? hour : 12, hasTime ? (minute || 0) : 0);
  const jdTt = ttFrom(jdUt);

  const positions = PLANET_KEYS.map((key) => {
    let lon;
    if (key === "sun") lon = sunLongitude(jdTt);
    else if (key === "moon") lon = moonLongitude(jdTt);
    else lon = planetLongitude(key, jdTt);
    return { key, lon, ...signOf(lon) };
  });

  let asc = null, mc = null;
  if (hasTime && place) {
    const a = ascendant(jdUt, place.lat, place.lon);
    asc = { lon: a.asc, ...signOf(a.asc) };
    mc = { lon: a.mc, ...signOf(a.mc) };
  }

  const elements = [0, 0, 0, 0];
  const qualities = [0, 0, 0];
  for (const p of positions) {
    elements[signElement(p.sign)] += 1;
    qualities[signQuality(p.sign)] += 1;
  }

  /* 月は1日で約13度動く。時刻が無いとき、その日のうちに星座が変わるなら印をつける */
  let moonUncertain = false;
  if (!hasTime) {
    const a = signOf(moonLongitude(ttFrom(jdFromJst(y, m, d, 0, 0)))).sign;
    const b = signOf(moonLongitude(ttFrom(jdFromJst(y, m, d, 23, 59)))).sign;
    moonUncertain = a !== b;
  }

  return { positions, asc, mc, elements, qualities, hasTime, moonUncertain };
}

/* ---------- 都道府県の座標(県庁所在地) ---------- */

const PREFS = [
  ["北海道", 43.064, 141.347], ["青森県", 40.824, 140.740], ["岩手県", 39.704, 141.153],
  ["宮城県", 38.269, 140.872], ["秋田県", 39.719, 140.102], ["山形県", 38.240, 140.364],
  ["福島県", 37.750, 140.468], ["茨城県", 36.342, 140.447], ["栃木県", 36.566, 139.884],
  ["群馬県", 36.391, 139.061], ["埼玉県", 35.857, 139.649], ["千葉県", 35.605, 140.123],
  ["東京都", 35.690, 139.692], ["神奈川県", 35.448, 139.643], ["新潟県", 37.902, 139.023],
  ["富山県", 36.695, 137.211], ["石川県", 36.595, 136.626], ["福井県", 36.065, 136.222],
  ["山梨県", 35.664, 138.568], ["長野県", 36.651, 138.181], ["岐阜県", 35.391, 136.722],
  ["静岡県", 34.977, 138.383], ["愛知県", 35.180, 136.907], ["三重県", 34.730, 136.509],
  ["滋賀県", 35.005, 135.869], ["京都府", 35.021, 135.756], ["大阪府", 34.686, 135.520],
  ["兵庫県", 34.691, 135.183], ["奈良県", 34.685, 135.833], ["和歌山県", 34.226, 135.167],
  ["鳥取県", 35.504, 134.238], ["島根県", 35.472, 133.051], ["岡山県", 34.662, 133.935],
  ["広島県", 34.396, 132.460], ["山口県", 34.186, 131.471], ["徳島県", 34.066, 134.559],
  ["香川県", 34.340, 134.043], ["愛媛県", 33.842, 132.766], ["高知県", 33.560, 133.531],
  ["福岡県", 33.607, 130.418], ["佐賀県", 33.249, 130.300], ["長崎県", 32.745, 129.874],
  ["熊本県", 32.790, 130.742], ["大分県", 33.238, 131.613], ["宮崎県", 31.911, 131.424],
  ["鹿児島県", 31.560, 130.558], ["沖縄県", 26.212, 127.681],
];
