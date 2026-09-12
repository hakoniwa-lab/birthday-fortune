/*
 * 旧暦(太陰太陽暦)と暦注。astro.js の天体計算と chart.js の干支を使う。
 *
 * 六曜は「旧暦の月＋日」で決まるので、旧暦そのものを出さないと計算できない。
 * 旧暦は朔(新月の瞬間)と中気(太陽黄経が30度の倍数になる瞬間)の両方から決まる。
 * どちらも astro.js で出せるので、暦を丸ごと組み立てている。
 *
 * ★ 暦注には流派差がある ★
 * 六曜・天赦日・寅の日などは計算方法がはっきりしているが、
 * 一粒万倍日・不成就日・三隣亡は採用する表が資料によって異なることがある。
 * このファイルで使った表は画面にも明記すること。
 */

/* ---------- 日の通し番号(日本時間) ---------- */

/* ユリウス日(UT) → その瞬間が属する日本時間の日の通し番号(JDN) */
function jstDayIndex(jdUt) {
  const p = jdToJstParts(jdUt);
  return jdn(p.y, p.m, p.d);
}

/* 日の通し番号 → その日の日本時間の真ん中あたりのユリウス日(UT) */
function jstDayMidUt(dayIdx) {
  // JDN d の日本時間は UT の [d-0.875, d+0.125] にあたる
  return dayIdx - 0.375;
}

/* ---------- 朔(新月) ---------- */

/*
 * jd の近くの朔(新月)の瞬間を返す。
 * 月と太陽の黄経差が0になる点をニュートン法で追い込む。
 * 月は太陽に対して1日あたり約12.19度進むので、ずれた角度をその値で割れば
 * 修正すべき日数になる。数回で収束する。
 */
const _newMoonCache = new Map();

function newMoonNear(jd) {
  // Meeus の平均朔の式で当たりをつける。k は朔の通し番号なのでキャッシュのキーになる
  const k = Math.round((jd - 2451550.09766) / 29.530588861);
  if (_newMoonCache.has(k)) return _newMoonCache.get(k);
  let t = 2451550.09766 + 29.530588861 * k;

  for (let i = 0; i < 30; i++) {
    let p = norm360(moonLongitude(ttFrom(t)) - sunLongitude(ttFrom(t)));
    if (p > 180) p -= 360;
    if (Math.abs(p) < 1e-7) break;
    t -= p / 12.190749;
  }
  _newMoonCache.set(k, t);
  return t;
}

/* その日を含む朔望月の朔日(JDN) */
function lunarMonthStart(dayIdx) {
  const mid = jstDayMidUt(dayIdx);
  let d = jstDayIndex(newMoonNear(mid));
  // newMoonNear は「最も近い」朔なので、先の朔を拾うことがある。その場合は1か月戻す
  if (d > dayIdx) d = jstDayIndex(newMoonNear(mid - 29.53));
  return d;
}

/* 次の朔日(JDN) */
function nextLunarMonthStart(startDay) {
  return jstDayIndex(newMoonNear(jstDayMidUt(startDay) + 29.53));
}

/* ---------- 中気 ---------- */

/*
 * その瞬間の太陽黄経が、どの30度区画にいるか(0〜11)。
 * 区画が変わった月に中気が入っている、という判定に使う。
 * 冬至(270度)は区画9の始まり。
 */
function chuArea(jdUt) {
  return Math.floor(norm360(sunLongitude(ttFrom(jdUt))) / 30);
}

/* 日の始まり(日本時間0時)のユリウス日(UT) */
function jstDayStartUt(dayIdx) {
  return dayIdx - 0.875;
}

/* ---------- 旧暦の月立て(天保暦の手順) ---------- */

/*
 * winterYear 年の冬至を含む朔望月を「十一月」として、
 * 翌年の冬至の前月までの朔望月に番号を振る。
 *
 * 手順:
 *   1. 冬至を含む朔望月が十一月
 *   2. 次の冬至を含む朔望月までに朔望月が13個あれば、その年に閏月がある
 *   3. 閏月は、十一月の次から見ていって最初に「中気を含まない月」
 *   4. 閏月は前の月と同じ番号になる(閏◯月)
 */
const _lunarTableCache = new Map();

function lunarMonthTable(winterYear) {
  if (_lunarTableCache.has(winterYear)) return _lunarTableCache.get(winterYear);
  const v = _lunarMonthTableRaw(winterYear);
  _lunarTableCache.set(winterYear, v);
  return v;
}

function _lunarMonthTableRaw(winterYear) {
  const wsDay = jstDayIndex(solarTermJd(winterYear, 12, 270));       // 冬至
  const wsNextDay = jstDayIndex(solarTermJd(winterYear + 1, 12, 270)); // 翌年の冬至

  const m11 = lunarMonthStart(wsDay);
  const m11Next = lunarMonthStart(wsNextDay);

  // 朔日を並べる
  const starts = [m11];
  let cur = m11;
  let guard = 0;
  while (cur < m11Next && guard++ < 20) {
    cur = nextLunarMonthStart(cur);
    starts.push(cur);
  }
  // starts の最後は翌年の十一月。その手前までが今回の対象
  const count = starts.length - 1; // 十一月から翌十一月の前月までの月数
  const hasLeap = count === 13;

  // 各月が中気を含むか
  const hasChu = [];
  for (let i = 0; i < count; i++) {
    const a = chuArea(jstDayStartUt(starts[i]));
    const b = chuArea(jstDayStartUt(starts[i + 1]));
    hasChu.push(a !== b);
  }

  // 番号を振る。十一月から始めて、閏月だけ番号を進めない
  const months = [];
  let num = 11;
  let leapUsed = false;
  for (let i = 0; i < count; i++) {
    let leap = false;
    if (hasLeap && !leapUsed && i > 0 && !hasChu[i]) {
      leap = true;
      leapUsed = true;
    }
    if (!leap && i > 0) num = num % 12 + 1;
    months.push({ start: starts[i], end: starts[i + 1] - 1, num, leap });
  }
  return months;
}

/*
 * 西暦の日付 → 旧暦。
 * 戻り値 { num: 月, day: 日, leap: 閏月か }
 */
function lunarDate(y, m, d) {
  const dayIdx = jdn(y, m, d);
  // その日が入る表を探す。冬至基準なので前年と当年の2つを見る
  for (const wy of [y, y - 1, y - 2]) {
    const table = lunarMonthTable(wy);
    for (const mo of table) {
      if (dayIdx >= mo.start && dayIdx <= mo.end) {
        return { num: mo.num, day: dayIdx - mo.start + 1, leap: mo.leap };
      }
    }
  }
  return null;
}

/* ---------- 六曜 ---------- */

const ROKUYO = ["大安", "赤口", "先勝", "友引", "先負", "仏滅"];

const ROKUYO_TEXT = {
  大安: "何をするにも良いとされる日。六曜でいちばん良い日で、結婚式や開業に選ばれます。",
  赤口: "正午前後だけが吉で、それ以外は凶とされる日。祝い事には向かないとされます。",
  先勝: "先んずれば勝ち。午前が吉、午後は凶とされ、急ぐ用事に向くとされます。",
  友引: "友を引く日。祝い事には良く、葬儀は避けられます。正午だけは凶とされます。",
  先負: "先んずれば負け。午前は凶、午後は吉とされ、静かに待つのが良いとされます。",
  仏滅: "六曜でもっとも凶とされる日。ただし「一度終わって始まる日」と読む考え方もあります。",
};

/* 六曜は旧暦の「月＋日」を6で割った余りで決まる。閏月も同じ番号で数える */
function rokuyo(y, m, d) {
  const l = lunarDate(y, m, d);
  if (!l) return null;
  return { name: ROKUYO[(l.num + l.day) % 6], lunar: l };
}

/* ---------- 暦注(節月と日の干支から決まるもの) ---------- */

/*
 * 一粒万倍日。節切りの月ごとに、2つの十二支が当たる。
 * 一粒の籾が万倍になる日とされ、お金を出すこと・始めることに良いとされる。
 * ★この表は資料によって差があることがある★
 * キーは節月の十二支index(子0 丑1 寅2 …)、値は日の十二支index。
 */
const ICHIRYU = {
  2: [1, 6],   // 寅月: 丑・午
  3: [9, 2],   // 卯月: 酉・寅
  4: [0, 3],   // 辰月: 子・卯
  5: [3, 4],   // 巳月: 卯・辰
  6: [5, 6],   // 午月: 巳・午
  7: [9, 6],   // 未月: 酉・午
  8: [0, 7],   // 申月: 子・未
  9: [3, 8],   // 酉月: 卯・申
  10: [6, 9],  // 戌月: 午・酉
  11: [9, 10], // 亥月: 酉・戌
  0: [11, 0],  // 子月: 亥・子
  1: [3, 0],   // 丑月: 卯・子
};

/*
 * 天赦日。暦の上でもっとも良い日とされ、年に5〜6回しかない。
 * 季節ごとに決まった干支の日が当たる。
 *   春(寅卯辰月)=戊寅  夏(巳午未月)=甲午  秋(申酉戌月)=戊申  冬(亥子丑月)=甲子
 */
const TENSHA = {
  spring: { stem: 4, branch: 2 },  // 戊寅
  summer: { stem: 0, branch: 6 },  // 甲午
  autumn: { stem: 4, branch: 8 },  // 戊申
  winter: { stem: 0, branch: 0 },  // 甲子
};

function seasonOfMonthBranch(b) {
  if (b === 2 || b === 3 || b === 4) return "spring";  // 寅卯辰
  if (b === 5 || b === 6 || b === 7) return "summer";  // 巳午未
  if (b === 8 || b === 9 || b === 10) return "autumn"; // 申酉戌
  return "winter";                                     // 亥子丑
}

/*
 * 三隣亡。建築関係で避けられる凶日。節切りの月の十二支で決まる。
 *   寅巳申亥の月: 亥の日 / 卯午酉子の月: 寅の日 / 辰未戌丑の月: 午の日
 */
function sanrinboBranch(monthBranch) {
  if ([2, 5, 8, 11].includes(monthBranch)) return 11; // 亥
  if ([3, 6, 9, 0].includes(monthBranch)) return 2;   // 寅
  return 6;                                           // 午
}

/*
 * 不成就日。何を始めても成就しないとされる凶日。旧暦の月と日で決まる。
 * 1・7月:3,11,19,27 / 2・8月:2,10,18,26 / 3・9月:1,9,17,25
 * 4・10月:4,12,20,28 / 5・11月:5,13,21,29 / 6・12月:6,14,22,30
 */
const FUJOJU = {
  1: [3, 11, 19, 27], 7: [3, 11, 19, 27],
  2: [2, 10, 18, 26], 8: [2, 10, 18, 26],
  3: [1, 9, 17, 25], 9: [1, 9, 17, 25],
  4: [4, 12, 20, 28], 10: [4, 12, 20, 28],
  5: [5, 13, 21, 29], 11: [5, 13, 21, 29],
  6: [6, 14, 22, 30], 12: [6, 14, 22, 30],
};

/*
 * 十二直。節切りの月の十二支と同じ十二支の日が「建」で、そこから順に回る。
 * 六曜より古くから使われていた暦注。
 */
const JUNICHOKU = ["建", "除", "満", "平", "定", "執", "破", "危", "成", "納", "開", "閉"];

const JUNICHOKU_TEXT = {
  建: "万物を建て生じる日。神仏の祭祀や開店に良いとされます",
  除: "取り除く日。掃除や治療に良いとされます",
  満: "満ち足りる日。新築や移転、祝い事に良いとされます",
  平: "平らに成る日。旅行や結婚に良いとされます",
  定: "定まる日。開店や移転に良く、訴訟には向かないとされます",
  執: "執り行う日。祝い事や種まきに良いとされます",
  破: "破れる日。訴訟や談判には良いが、祝い事は避けるとされます",
  危: "危ぶむ日。何事も控えめにするのが良いとされます",
  成: "成し遂げる日。新しいことを始めるのに良いとされます",
  納: "納め入れる日。買い物や収穫に良いとされます",
  開: "開き通じる日。建築や結婚に良いとされます",
  閉: "閉じ塞がる日。金銭の収納や墓を建てるのに良いとされます",
};

/* ---------- まとめ ---------- */

/*
 * ある日の暦注を全部返す。
 * 節月は chart.js の solarMonthOf、日の干支は dayPillarIndex を使う。
 */
function dayKoyomi(y, m, d) {
  const dayIdx = jdn(y, m, d);
  const dIndex = dayPillarIndex(y, m, d);
  const dStem = dIndex % 10;
  const dBranch = dIndex % 12;

  const sm = solarMonthOf(y, m, d, 12, 0);
  const mBranch = sm.branch;

  const r = rokuyo(y, m, d);
  const lunar = r ? r.lunar : null;

  const good = [];
  const bad = [];

  // 一粒万倍日
  const ichiryu = (ICHIRYU[mBranch] || []).includes(dBranch);
  if (ichiryu) good.push("一粒万倍日");

  // 天赦日
  const ts = TENSHA[seasonOfMonthBranch(mBranch)];
  const tensha = ts.stem === dStem && ts.branch === dBranch;
  if (tensha) good.push("天赦日");

  // 寅の日・巳の日
  const tora = dBranch === 2;
  const mi = dBranch === 5;
  const tsuchinotoMi = mi && dStem === 5; // 己巳
  if (tora) good.push("寅の日");
  if (tsuchinotoMi) good.push("己巳の日");
  else if (mi) good.push("巳の日");

  // 大安
  if (r && r.name === "大安") good.push("大安");

  // 不成就日
  const fujoju = lunar && (FUJOJU[lunar.num] || []).includes(lunar.day);
  if (fujoju) bad.push("不成就日");

  // 三隣亡
  const sanrinbo = sanrinboBranch(mBranch) === dBranch;
  if (sanrinbo) bad.push("三隣亡");

  // 仏滅
  if (r && r.name === "仏滅") bad.push("仏滅");

  return {
    y, m, d, dayIdx,
    weekday: new Date(y, m - 1, d).getDay(),
    eto: KAN[dStem] + SHI[dBranch],
    stem: dStem,
    branch: dBranch,
    lunar,
    rokuyo: r ? r.name : null,
    junichoku: JUNICHOKU[((dBranch - mBranch) % 12 + 12) % 12],
    sekki: sm.sekki,
    flags: { ichiryu, tensha, tora, mi, tsuchinotoMi, fujoju, sanrinbo },
    good,
    bad,
  };
}

/* 指定した月の全日を返す */
function monthKoyomi(y, m) {
  const last = new Date(y, m, 0).getDate();
  const out = [];
  for (let d = 1; d <= last; d++) out.push(dayKoyomi(y, m, d));
  return out;
}
