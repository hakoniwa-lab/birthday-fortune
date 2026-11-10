/*
 * 紫微斗数の命盤。旧暦の生年月日と生まれた時刻から、十二宮・十四主星・補佐の星・四化・五行局・命主身主・大限を出す。
 * astro.js(天体計算)・chart.js(干支)・koyomi.js(朔・中気)を使う。
 *
 * 決まり(安星訣)は『紫微斗数全書』巻二(維基文庫)と、iztro の安星訣のページで突き合わせた。
 *   命宮 … 寅を正月として生まれ月まで順に数え、そこから子の刻として生まれた時刻まで逆に数える。身宮は順に数える
 *   十二宮 … 命宮から逆回りに 命・兄弟・夫妻・子女・財帛・疾厄・遷移・交友(奴僕)・官禄・田宅・福徳・父母
 *   宮の十干 … 生まれ年の十干で寅の宮の十干が決まる(甲己→丙寅・乙庚→戊寅・丙辛→庚寅・丁壬→壬寅・戊癸→甲寅)
 *   五行局 … 命宮の干支の納音(水二局・木三局・金四局・土五局・火六局)
 *   紫微星 … 局の数と旧暦の日から決まる。天府星は寅と申を結ぶ線で紫微星と線対称
 *   四化 … 生まれ年の十干で決まる。庚と壬の年は資料によって違う(SB_SIKA_VARIANTS)
 *
 * ★ 数え方で命盤が変わるところ ★ (SB_DEFAULT_OPT で既定を決め、画面で切り替えられる)
 *   cal     … 旧暦を日本時間(東経135度)で作るか、中国の農暦(東経120度)で作るか。朔が夜23時台に来る月は1日ずれる
 *   yearDiv … 生まれ年の干支を旧正月で切り替えるか、立春で切り替えるか
 *   leap    … 閏月生まれを、前の月として数えるか・次の月として数えるか(全書)・15日で分けるか(iztro の既定)
 *   lateZi  … 夜23時台(晩子時)を翌日として数えるか、その日のまま数えるか
 *   lonFix  … 生まれた場所の経度で時刻を直すか(1度で4分)
 */

const SB_BRANCH = "子丑寅卯辰巳午未申酉戌亥";
const SB_STEM = "甲乙丙丁戊己庚辛壬癸";
const SB_PALACE = ["命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮", "遷移宮", "交友宮", "官禄宮", "田宅宮", "福徳宮", "父母宮"];
const SB_MAJOR = ["紫微", "天機", "太陽", "武曲", "天同", "廉貞", "天府", "太陰", "貪狼", "巨門", "天相", "天梁", "七殺", "破軍"];
const SB_HOUR = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const SB_KYOKU_NAME = { 2: "水二局", 3: "木三局", 4: "金四局", 5: "土五局", 6: "火六局" };

const SB_DEFAULT_OPT = { cal: "jp", yearDiv: "lunar", leap: "split", lateZi: "next", lonFix: false, geng: "yin", ren: "zuo" };
const SB_OPT_LABEL = {
  cal: { jp: "日本の旧暦(東経135度)", cn: "中国の農暦(東経120度)" },
  yearDiv: { lunar: "旧正月で切り替え", risshun: "立春で切り替え" },
  leap: { split: "15日までは前の月・16日からは次の月", next: "丸ごと次の月(紫微斗数全書)", same: "丸ごと前の月" },
  lateZi: { next: "翌日として数える", same: "その日のまま数える" },
  lonFix: { false: "明石の時刻のまま", true: "生まれた場所の経度で直す" },
  geng: { yin: "太陽・武曲・太陰・天同", tong: "太陽・武曲・天同・太陰" },
  ren: { zuo: "天梁・紫微・左輔・武曲", fu: "天梁・紫微・天府・武曲" },
};
const SB_OPT_NAME = { cal: "旧暦", yearDiv: "生まれ年の区切り", leap: "閏月の数え方", lateZi: "夜23時台", lonFix: "時刻の直し", geng: "庚年の四化", ren: "壬年の四化" };
const SB_HOUR_RANGE = ["23:00〜0:59", "1:00〜2:59", "3:00〜4:59", "5:00〜6:59", "7:00〜8:59", "9:00〜10:59", "11:00〜12:59", "13:00〜14:59", "15:00〜16:59", "17:00〜18:59", "19:00〜20:59", "21:00〜22:59"];

const sbMod = (a, n) => ((a % n) + n) % n;

/* ---------- 旧暦(時差を変えられる版) ---------- */
/*
 * koyomi.js の lunarDate と同じ手順(冬至を含む月が十一月・中気のない最初の月が閏月)を、
 * 時差 tz(時間)を変えて組み立てる。tz=9 で koyomi.js と同じ結果になることを gen_shibi.js で確かめている。
 */
function sbDayOf(jdUt, tz) { return Math.floor(jdUt + 0.5 + tz / 24); }
function sbDayStartUt(dayIdx, tz) { return dayIdx - 0.5 - tz / 24; }
function sbMonthStart(dayIdx, tz) {
  const noon = sbDayStartUt(dayIdx, tz) + 0.5;
  let d = sbDayOf(newMoonNear(noon), tz);
  if (d > dayIdx) d = sbDayOf(newMoonNear(noon - 29.53), tz);
  return d;
}
function sbNextMonthStart(start, tz) { return sbDayOf(newMoonNear(sbDayStartUt(start, tz) + 0.5 + 29.53), tz); }

const _sbTableCache = new Map();
function sbLunarTable(wy, tz) {
  const key = wy + "|" + tz;
  if (_sbTableCache.has(key)) return _sbTableCache.get(key);
  const ws = sbDayOf(solarTermJd(wy, 12, 270), tz);
  const wsN = sbDayOf(solarTermJd(wy + 1, 12, 270), tz);
  const m11 = sbMonthStart(ws, tz), m11N = sbMonthStart(wsN, tz);
  const starts = [m11];
  let cur = m11, guard = 0;
  while (cur < m11N && guard++ < 20) { cur = sbNextMonthStart(cur, tz); starts.push(cur); }
  const count = starts.length - 1;
  const hasLeap = count === 13;
  const months = [];
  let num = 11, leapUsed = false;
  for (let i = 0; i < count; i++) {
    let leap = false;
    if (hasLeap && !leapUsed && i > 0) {
      const a = chuArea(sbDayStartUt(starts[i], tz)), b = chuArea(sbDayStartUt(starts[i + 1], tz));
      if (a === b) { leap = true; leapUsed = true; }
    }
    if (!leap && i > 0) num = num % 12 + 1;
    // 十一月・十二月(閏を含む)は冬至の年、正月からは翌年
    months.push({ start: starts[i], end: starts[i + 1] - 1, num, leap, year: num >= 11 && i < 3 ? wy : wy + 1 });
  }
  _sbTableCache.set(key, months);
  return months;
}

/* 日の通し番号(JDN) → 旧暦 { year, num, day, leap }。tz は 9(日本) か 8(中国) */
function sbLunar(dayIdx, tz) {
  const y = Math.floor((dayIdx - 1721426) / 365.2425) + 1; // おおよその西暦年
  for (const wy of [y, y - 1, y - 2, y + 1]) {
    for (const mo of sbLunarTable(wy, tz)) {
      if (dayIdx >= mo.start && dayIdx <= mo.end) return { year: mo.year, num: mo.num, day: dayIdx - mo.start + 1, leap: mo.leap };
    }
  }
  return null;
}

/* ---------- 納音と五行局 ---------- */
/* 六十干支を2つずつ組にした納音の五行(全書の「六十花甲子納音歌」の順)。水=2 木=3 金=4 土=5 火=6 で持つ */
const SB_NAYIN_NAME = ["海中金", "炉中火", "大林木", "路傍土", "剣鋒金", "山頭火", "澗下水", "城頭土", "白蝋金", "楊柳木",
  "泉中水", "屋上土", "霹靂火", "松柏木", "長流水", "沙中金", "山下火", "平地木", "壁上土", "金箔金",
  "覆灯火", "天河水", "大駅土", "釵釧金", "桑柘木", "大渓水", "沙中土", "天上火", "石榴木", "大海水"];
const SB_NAYIN_KYOKU = { 金: 4, 火: 6, 木: 3, 土: 5, 水: 2 };
function sbKanshi(stem, branch) { return sbMod(6 * stem - 5 * branch, 60); }
function sbNayin(stem, branch) { return SB_NAYIN_NAME[Math.floor(sbKanshi(stem, branch) / 2)]; }
function sbKyoku(stem, branch) { return SB_NAYIN_KYOKU[sbNayin(stem, branch).slice(-1)]; }

/* ---------- 星の位置 ---------- */
/* 紫微星の宮(十二支の番号)。日を局の数で割り切れるまで足し(足した数 x)、商の数だけ寅から進め、x が奇数なら x 戻し・偶数なら x 進める */
function sbZiwei(kyoku, day) {
  const q = Math.ceil(day / kyoku);
  const x = q * kyoku - day;
  return sbMod(2 + q - 1 + (x % 2 ? -x : x), 12);
}
/* 紫微星から逆回りに 紫微・天機・(1つ空き)・太陽・武曲・天同・(2つ空き)・廉貞 */
const SB_ZIWEI_OFFS = [["紫微", 0], ["天機", -1], ["太陽", -3], ["武曲", -4], ["天同", -5], ["廉貞", -8]];
/* 天府星から順回りに 天府・太陰・貪狼・巨門・天相・天梁・七殺・(3つ空き)・破軍 */
const SB_TIANFU_OFFS = [["天府", 0], ["太陰", 1], ["貪狼", 2], ["巨門", 3], ["天相", 4], ["天梁", 5], ["七殺", 6], ["破軍", 10]];

/* 四化。[化禄, 化権, 化科, 化忌]。庚と壬は opt で切り替える */
const SB_SIKA = {
  0: ["廉貞", "破軍", "武曲", "太陽"],
  1: ["天機", "天梁", "紫微", "太陰"],
  2: ["天同", "天機", "文昌", "廉貞"],
  3: ["太陰", "天同", "天機", "巨門"],
  4: ["貪狼", "太陰", "右弼", "天機"],
  5: ["武曲", "貪狼", "天梁", "文曲"],
  7: ["巨門", "太陽", "文曲", "文昌"],
  9: ["破軍", "巨門", "太陰", "貪狼"],
};
const SB_SIKA_VARIANTS = {
  geng: { yin: ["太陽", "武曲", "太陰", "天同"], tong: ["太陽", "武曲", "天同", "太陰"] }, // 庚: 陽武陰同 / 陽武同陰
  ren: { zuo: ["天梁", "紫微", "左輔", "武曲"], fu: ["天梁", "紫微", "天府", "武曲"] },    // 壬: 梁紫左武 / 梁紫府武
};
const SB_SIKA_NAME = ["化禄", "化権", "化科", "化忌"];
function sbSika(yStem, opt) {
  if (yStem === 6) return SB_SIKA_VARIANTS.geng[opt.geng];
  if (yStem === 8) return SB_SIKA_VARIANTS.ren[opt.ren];
  return SB_SIKA[yStem];
}

const SB_KUIYUE = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [6, 2], [3, 5], [3, 5]]; // 年干 → [天魁, 天鉞]
const SB_LUCUN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];                                                  // 年干 → 禄存
const SB_MA = [2, 11, 8, 5];                                                                       // 年支%4 → 天馬(申子辰=寅…)
const SB_FIRE_BELL = { 0: [2, 10], 1: [3, 10], 2: [1, 3], 3: [9, 10] };                            // 年支%4 → [火星, 鈴星] の子の刻の位置
const SB_MEISHU = ["貪狼", "巨門", "禄存", "文曲", "廉貞", "武曲", "破軍", "武曲", "廉貞", "文曲", "禄存", "巨門"]; // 命宮の支 → 命主
const SB_SHINSHU = ["火星", "天相", "天梁", "天同", "文昌", "天機"];                                  // 年支%6 → 身主

/* ---------- 入力の整理 ---------- */
/*
 * 西暦の生年月日・時刻 → 命盤に使う旧暦の年・月・日・時辰。
 * inp = { y, m, d, hour, minute, lon }   hour が null なら時刻不明(時辰は決めない)
 */
function sbBirth(inp, opt) {
  let dayIdx = jdn(inp.y, inp.m, inp.d);
  let hourBranch = null, lateZi = false, shiftMin = 0;
  if (inp.hour !== null && inp.hour !== undefined) {
    let t = inp.hour * 60 + (inp.minute || 0);
    if (opt.lonFix && inp.lon) { shiftMin = Math.round((inp.lon - 135) * 4); t += shiftMin; }
    dayIdx += Math.floor(t / 1440);
    t = sbMod(t, 1440);
    const h = Math.floor(t / 60);
    hourBranch = Math.floor(((h + 1) % 24) / 2);
    if (h === 23) { lateZi = true; if (opt.lateZi === "next") dayIdx += 1; }
  }
  const tz = opt.cal === "cn" ? 8 : 9;
  const lunar = sbLunar(dayIdx, tz);
  // 生まれ年の干支
  let year = lunar.year;
  if (opt.yearDiv === "risshun") {
    const t = inp.hour === null || inp.hour === undefined ? 12 * 60 : inp.hour * 60 + (inp.minute || 0);
    const jd = jdFromJst(inp.y, inp.m, inp.d, Math.floor(t / 60), t % 60);
    year = jd >= solarTermJd(inp.y, 2, 315) ? inp.y : inp.y - 1;
  }
  // 命宮を出すときの月。閏月の扱いで変わる
  let month = lunar.num;
  if (lunar.leap && (opt.leap === "next" || (opt.leap === "split" && lunar.day > 15))) month = month % 12 + 1;
  return { lunar, year, yStem: sbMod(year - 4, 10), yBranch: sbMod(year - 4, 12), month, day: lunar.day, hourBranch, lateZi, shiftMin, dayIdx };
}

/* ---------- 命盤 ---------- */
/* sex は "m" / "f" / null(大限を出さない)。時刻不明なら null を返す */
function shibiChart(inp, opt0) {
  const opt = Object.assign({}, SB_DEFAULT_OPT, opt0 || {});
  const b = sbBirth(inp, opt);
  if (b.hourBranch === null) return null;
  const h = b.hourBranch, M = b.month;
  const mei = sbMod(2 + (M - 1) - h, 12);
  const shin = sbMod(2 + (M - 1) + h, 12);
  const tiger = ((b.yStem % 5) * 2 + 2) % 10;
  const stemOf = (br) => (tiger + sbMod(br - 2, 12)) % 10;
  const kyoku = sbKyoku(stemOf(mei), mei);
  const zw = sbZiwei(kyoku, b.day);
  const tf = sbMod(4 - zw, 12);

  const palaces = [];
  for (let br = 0; br < 12; br++) {
    palaces.push({ branch: br, stem: stemOf(br), name: SB_PALACE[sbMod(mei - br, 12)], major: [], minor: [], body: br === shin });
  }
  const pos = {};
  const put = (name, br, kind) => { pos[name] = br; palaces[br][kind].push({ name, sika: null }); };
  for (const [n, o] of SB_ZIWEI_OFFS) put(n, sbMod(zw + o, 12), "major");
  for (const [n, o] of SB_TIANFU_OFFS) put(n, sbMod(tf + o, 12), "major");
  // 六吉星(文昌・文曲・左輔・右弼・天魁・天鉞)
  put("文昌", sbMod(10 - h, 12), "minor");
  put("文曲", sbMod(4 + h, 12), "minor");
  put("左輔", sbMod(4 + M - 1, 12), "minor");
  put("右弼", sbMod(10 - (M - 1), 12), "minor");
  put("天魁", SB_KUIYUE[b.yStem][0], "minor");
  put("天鉞", SB_KUIYUE[b.yStem][1], "minor");
  // 禄存・天馬
  const lu = SB_LUCUN[b.yStem];
  put("禄存", lu, "minor");
  put("天馬", SB_MA[b.yBranch % 4], "minor");
  // 六煞星(擎羊・陀羅・火星・鈴星・地空・地劫)
  put("擎羊", sbMod(lu + 1, 12), "minor");
  put("陀羅", sbMod(lu - 1, 12), "minor");
  const fb = SB_FIRE_BELL[b.yBranch % 4];
  put("火星", sbMod(fb[0] + h, 12), "minor");
  put("鈴星", sbMod(fb[1] + h, 12), "minor");
  put("地空", sbMod(11 - h, 12), "minor");
  put("地劫", sbMod(11 + h, 12), "minor");
  // 四化
  const sika = sbSika(b.yStem, opt);
  sika.forEach((star, i) => {
    for (const p of palaces) for (const s of p.major.concat(p.minor)) if (s.name === star) s.sika = SB_SIKA_NAME[i];
  });

  // 大限。陽男陰女は順回り、陰男陽女は逆回り。命宮から始まり、最初の歳は局の数(数え年)
  let taigen = null;
  if (inp.sex === "m" || inp.sex === "f") {
    const yang = b.yStem % 2 === 0;
    const dir = (yang === (inp.sex === "m")) ? 1 : -1;
    taigen = [];
    for (let i = 0; i < 12; i++) {
      const br = sbMod(mei + dir * i, 12);
      taigen.push({ branch: br, palace: palaces[br].name, from: kyoku + 10 * i, to: kyoku + 10 * i + 9 });
      palaces[br].taigen = [kyoku + 10 * i, kyoku + 10 * i + 9];
    }
  }

  return {
    opt, birth: b, mei, shin, kyoku, kyokuName: SB_KYOKU_NAME[kyoku], nayin: sbNayin(stemOf(mei), mei),
    ziwei: zw, tianfu: tf, palaces, pos, sika,
    meishu: SB_MEISHU[mei], shinshu: SB_SHINSHU[b.yBranch % 6],
    taigen,
  };
}

/* 命宮の主星(空なら対宮=遷移宮の主星を借りて見るのが通例なので、それも返す) */
function sbMeiStars(c) {
  const own = c.palaces[c.mei].major.map((s) => s.name);
  if (own.length) return { stars: own, borrowed: false };
  return { stars: c.palaces[sbMod(c.mei + 6, 12)].major.map((s) => s.name), borrowed: true };
}

/* 2つの命盤の違い(画面と集計で使う) */
function sbDiff(a, b) {
  const out = [];
  if (a.birth.year !== b.birth.year) out.push("year");
  if (a.mei !== b.mei) out.push("mei");
  if (a.kyoku !== b.kyoku) out.push("kyoku");
  if (a.ziwei !== b.ziwei) out.push("ziwei");
  if (sbMeiStars(a).stars.join() !== sbMeiStars(b).stars.join()) out.push("meiStars");
  if (a.sika.join() !== b.sika.join()) out.push("sika");
  else if (a.sika.some((s) => a.pos[s] !== b.pos[s])) out.push("sikaPos");
  return out;
}
