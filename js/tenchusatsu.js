/*
 * 天中殺(空亡)の時期の計算。tenchusatsu/ の計算機と、記事の早見表
 * (tools/koyomi-articles/gen_tenchusatsu.js)が同じ関数を使う。
 *
 *   種類        … 日柱の干支が属する旬(10日ひと組)で決まる6種。chart.js の kubo() をそのまま使う
 *   年の天中殺  … 年の十二支が天中殺の2支にあたる2年。12年に一度。年は立春で切り替わる
 *   月の天中殺  … 節月の十二支が天中殺の2支にあたる2か月。毎年来る。月は節入りで切り替わる
 *   日の天中殺  … 日の十二支が天中殺の2支にあたる2日。12日に一度
 *
 * 区切りの日は「日切り」: 節入りの日を丸一日、新しい年・月として扱う。終わりは次の節入りの前日。
 * 吉日カレンダーの既定(koyomi.js の KOYOMI_DEFAULTS.sekkiByDay = true)と同じ扱い。
 * 節入りの時刻で切る流派のために、節入りの時刻も返す(画面と記事に両方書く)。
 *
 * 大運天中殺(大運の10年ごとの区切りで来る20年)と宿命天中殺は扱わない。
 * 依存: astro.js(jdn・sekkiOfYear・jdToJstParts) / chart.js(KAN・SHI・dayPillarIndex・kubo)
 */

const TCS_ORDER = ["子丑", "寅卯", "辰巳", "午未", "申酉", "戌亥"];
const TCS_YOMI = { 子丑: "ねうし", 寅卯: "とらう", 辰巳: "たつみ", 午未: "うまひつじ", 申酉: "さるとり", 戌亥: "いぬい" };
const TCS_WD = ["日", "月", "火", "水", "木", "金", "土"];

/* 日の通し番号(JDN) → 日本時間の年月日と曜日 */
function tcsDay(idx) {
  const p = jdToJstParts(idx - 0.375); // その日の日本時間の真ん中
  return { idx, y: p.y, m: p.m, d: p.d, wd: (idx + 1) % 7 };
}

/* 60干支の通し番号 → 2文字 */
function tcsKanshi(i) {
  return KAN[i % 10] + SHI[i % 12];
}

/*
 * 生年月日 → 天中殺の種類。日の変わり目は0時(chart.js の四柱推命と同じ)。
 * branches は [偶数の支, 奇数の支](子丑なら [0, 1])。
 */
function tcsTypeOf(y, m, d) {
  const di = dayPillarIndex(y, m, d);
  const branches = kubo(di);
  const name = SHI[branches[0]] + SHI[branches[1]];
  const head = di - (di % 10);
  return {
    name, yomi: TCS_YOMI[name], branches,
    dayIndex: di, dayKanshi: tcsKanshi(di),
    jun: tcsKanshi(head),                                   // 旬の最初(甲◯)
    members: Array.from({ length: 10 }, (_, i) => tcsKanshi(head + i)),
  };
}

/* 種類の名前("午未" など) → branches */
function tcsBranchesOf(name) {
  return [SHI.indexOf(name[0]), SHI.indexOf(name[1])];
}

/*
 * 立春で数えた年 Y の中で、十二支 b の月が始まる節。
 * 立春年は 寅(2月)…亥(11月)・子(12月)・丑(翌年1月) と並ぶので、丑だけ暦の翌年の節になる。
 */
function tcsSetsu(Y, b) {
  const calY = b === 1 ? Y + 1 : Y;
  const s = sekkiOfYear(calY).find((t) => t.branch === b);
  return { name: s.name, idx: jdn(s.y, s.m, s.d), y: s.y, m: s.m, d: s.d, hh: s.hh, mi: s.mi, jd: s.jd };
}

/* 立春年の中での順番(寅=0 … 丑=11) */
function tcsPos(b) {
  return (b - 2 + 12) % 12;
}

/* 立春年 Y の十二支 b の月から n か月後の節 */
function tcsSetsuAfter(Y, b, n) {
  const p = tcsPos(b) + n;
  const yy = Y + Math.floor(p / 12);
  return tcsSetsu(yy, (p % 12 + 2) % 12);
}

/*
 * 立春年 Y の「月の天中殺」。天中殺の2支は必ず続いた2か月(子丑は12月〜翌年2月の節分)なので1つの期間になる。
 * end は次の節入りの前日(日切り)、next はその節入り(時刻切りの終わり)。
 */
function tcsMonthPeriod(branches, Y) {
  const start = tcsSetsu(Y, branches[0]);
  const second = tcsSetsuAfter(Y, branches[0], 1);
  const next = tcsSetsuAfter(Y, branches[0], 2);
  return {
    year: Y, kind: "month",
    months: [SHI[branches[0]] + "月", SHI[branches[1]] + "月"],
    start, second, next, end: tcsDay(next.idx - 1),
  };
}

/* 立春年 Y の十二支 */
function tcsYearBranch(Y) {
  return ((Y - 4) % 12 + 12) % 12;
}

/*
 * 「年の天中殺」。立春年 Y(十二支が branches[0])と Y+1 の2年。
 * 立春年 Y の立春から、Y+2 の立春の前日まで。
 */
function tcsYearPeriodFrom(Y) {
  const start = tcsSetsu(Y, 2);
  const next = tcsSetsu(Y + 2, 2);
  return {
    years: [Y, Y + 1], kind: "year",
    start, second: tcsSetsu(Y + 1, 2), next, end: tcsDay(next.idx - 1),
  };
}

/* fromY〜toY(立春年)に1年でもかかる年の天中殺の一覧 */
function tcsYearPeriods(branches, fromY, toY) {
  const out = [];
  // 最初の候補: fromY-1 以前で十二支が branches[0] の年
  let Y = fromY - 1;
  while (tcsYearBranch(Y) !== branches[0]) Y--;
  for (; Y <= toY; Y += 12) if (Y + 1 >= fromY) out.push(tcsYearPeriodFrom(Y));
  return out;
}

/* fromY〜toY(立春年)の月の天中殺 */
function tcsMonthPeriods(branches, fromY, toY) {
  const out = [];
  for (let Y = fromY; Y <= toY; Y++) out.push(tcsMonthPeriod(branches, Y));
  return out;
}

/* fromIdx から n 日のうち、日の天中殺にあたる日 */
function tcsDays(branches, fromIdx, n) {
  const out = [];
  for (let i = fromIdx; i < fromIdx + n; i++) {
    const x = tcsDay(i);
    const b = dayPillarIndex(x.y, x.m, x.d) % 12;
    if (b === branches[0] || b === branches[1]) out.push({ ...x, branch: SHI[b] });
  }
  return out;
}

/* 日(JDN)がその期間に入っているか(日切り) */
function tcsIn(period, idx) {
  return period.start.idx <= idx && idx <= period.end.idx;
}

/*
 * ある日(JDN)の状態。立春年と、その日が年・月・日の天中殺にあたるか。
 * 年・月の判定は、その日の節月で見る(日切りなので節入りの日はもう新しい月)。
 */
function tcsStatusOn(branches, idx) {
  const day = tcsDay(idx);
  let Y = day.y;
  if (idx < tcsSetsu(Y, 2).idx) Y -= 1;
  const yb = tcsYearBranch(Y);
  // その日の節月: 立春年 Y の節を順に見て、その日までに来た最後の節
  let mb = 2;
  for (let n = 0; n < 12; n++) {
    const s = tcsSetsuAfter(Y, 2, n);
    if (s.idx <= idx) mb = (2 + n) % 12; else break;
  }
  const db = dayPillarIndex(day.y, day.m, day.d) % 12;
  const hit = (b) => b === branches[0] || b === branches[1];
  return { Y, yearBranch: yb, monthBranch: mb, dayBranch: db, year: hit(yb), month: hit(mb), day: hit(db) };
}

/* 表示用: 2026年2月4日(水) */
function tcsFmt(x, withYear = true) {
  return `${withYear ? x.y + "年" : ""}${x.m}月${x.d}日(${TCS_WD[x.wd !== undefined ? x.wd : (x.idx + 1) % 7]})`;
}

/* 表示用: 節入りの時刻 5:02 */
function tcsTime(s) {
  return `${s.hh}:${String(s.mi).padStart(2, "0")}`;
}
