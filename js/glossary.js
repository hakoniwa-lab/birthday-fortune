/*
 * 用語一覧のページ。文章は koyomi.js の同じ定数から出す(カレンダーと食い違わないように)。
 */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function row(name, text, sub) {
  return `<div class="gl">
    <p class="gl__name">${escapeHtml(name)}${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</p>
    <p class="gl__text">${escapeHtml(text)}</p>
  </div>`;
}

/* 吉日・凶日。決まり方をそれぞれ書く */
const KICHI = [
  ["天赦日(てんしゃにち)", "暦の上でもっとも良いとされる日。年に5〜6回。", "季節ごとの干支: 春＝戊寅、夏＝甲午、秋＝戊申、冬＝甲子"],
  ["一粒万倍日(いちりゅうまんばいび)", "一粒の籾が万倍に育つ日。始めること・お金を出すことに良く、借金は避けるとされる。月に5〜6日。", "節切りの月ごとに決まった2つの十二支の日(資料によって差あり)"],
  ["寅の日", "出ていったお金が戻る日。財布の新調・旅行に良いとされる。12日に一度。", "日の十二支が寅"],
  ["巳の日", "弁財天に縁のある日。金運・芸事に良いとされる。12日に一度。", "日の十二支が巳"],
  ["己巳の日(つちのとみ)", "巳の日の中でも特別とされる日。60日に一度。", "日の干支が己巳"],
  ["甲子の日(きのえね)", "大黒天に縁のある日。干支の最初の組み合わせで、始まりに良いとされる。60日に一度。", "日の干支が甲子"],
  ["天恩日(てんおんにち)", "天の恩恵をすべての人が受ける日。祝い事に良く、凶事には向かないとされる。5日ずつ、60日に15日。", "日の干支が 甲子〜戊辰・己卯〜癸未・己酉〜癸丑"],
  ["母倉日(ぼそうにち)", "母が子を育てるように天が人を慈しむ日。結婚・建築に良いとされる。", "節切りの季節ごとに決まった十二支の日(春＝亥子、夏＝寅卯、秋＝辰戌丑未、冬＝申酉、土用の月＝巳午)"],
  ["大安", "六曜でいちばん良い日。", "旧暦の(月＋日)÷6 の余りが0"],
  ["仏滅", "六曜でもっとも凶とされる日。", "旧暦の(月＋日)÷6 の余りが5"],
  ["不成就日(ふじょうじゅび)", "何を始めても成就しないとされる凶日。月に4回ほど。", "旧暦の月と日による表(資料によって差あり)"],
  ["三隣亡(さんりんぼう)", "建築・棟上げで避けられる凶日。棟上げをすると近隣三軒を焼く、という言い伝えから。", "節切りの月の十二支による表(寅巳申亥月＝亥の日、卯午酉子月＝寅の日、辰未戌丑月＝午の日)"],
  ["鬼宿日(きしゅくにち)", "二十八宿でもっとも良いとされる日。婚礼だけは避けるとされる。28日に一度。", "二十八宿が「鬼」"],
  ["土用の丑の日", "夏の土用の期間にある丑の日。うなぎを食べる習慣で知られる。年に1〜2回。", "夏の土用(立秋前の約18日)の中の、日の十二支が丑の日"],
];

document.getElementById("g-kichi").innerHTML = KICHI.map(([n, t, h]) => row(n, t, h)).join("");

document.getElementById("g-rokuyo").innerHTML = ROKUYO
  .slice().sort((a, b) => ["先勝", "友引", "先負", "仏滅", "大安", "赤口"].indexOf(a) - ["先勝", "友引", "先負", "仏滅", "大安", "赤口"].indexOf(b))
  .map((n) => row(n, ROKUYO_TEXT[n])).join("");

document.getElementById("g-junichoku").innerHTML = JUNICHOKU.map((n) => row(n, JUNICHOKU_TEXT[n])).join("");

document.getElementById("g-shuku").innerHTML = SHUKU.map((n, i) => row(`${n}宿`, SHUKU_TEXT[n], `${i + 1}番目`)).join("");

/* 選日 */
const SENJITSU_ORDER = ["八専", "八専の間日", "十方暮", "天一天上", "大つち", "小つち", "つちの間日",
  "庚申", "初伏", "中伏", "末伏", "春社", "秋社", "臘日"];
const SENJITSU_HOW = {
  八専: "壬子から癸亥までの12日のうち、干と支の五行が同じ8日",
  "八専の間日": "同じ12日のうち、五行が食い違う4日(癸丑・丙辰・戊午・壬戌)",
  十方暮: "甲申から癸巳までの10日間",
  天一天上: "癸巳から戊申までの16日間",
  大つち: "庚午から丙子までの7日間",
  小つち: "戊寅から甲申までの7日間",
  "つちの間日": "大つちと小つちの間の丁丑の日",
  庚申: "干支が庚申の日。60日に一度",
  初伏: "夏至のあと3番目の庚の日",
  中伏: "夏至のあと4番目の庚の日",
  末伏: "立秋のあと最初の庚の日",
  春社: "春分にもっとも近い戊の日",
  秋社: "秋分にもっとも近い戊の日",
  臘日: "冬至のあと3番目の戌の日",
};
document.getElementById("g-senjitsu").innerHTML =
  SENJITSU_ORDER.map((n) => row(n, SENJITSU_TEXT[n], SENJITSU_HOW[n])).join("");

/* 二十四節気は今年の日付つきで */
const gy = new Date().getFullYear();
document.getElementById("g-sekki").innerHTML = sekki24OfYear(gy)
  .map((s) => row(s.name, SEKKI24_TEXT[s.name],
    `${s.kind === "節" ? "節(月の区切り)" : "中(月の中心)"}・太陽黄経${s.lon}度・${gy}年は ${s.m}月${s.d}日 ${s.hh}時${String(s.mi).padStart(2, "0")}分`)).join("");

/* 節句・行事 */
const GYOJI = [
  ["人日の節句", SEKKU["1-7"][1], "毎年1月7日"],
  ["上巳の節句", SEKKU["3-3"][1], "毎年3月3日"],
  ["端午の節句", SEKKU["5-5"][1], "毎年5月5日"],
  ["七夕の節句", SEKKU["7-7"][1], "毎年7月7日"],
  ["重陽の節句", SEKKU["9-9"][1], "毎年9月9日"],
  ["旧正月", EVENT_TEXT.旧正月, "旧暦1月1日"],
  ["十五夜", EVENT_TEXT.十五夜, "旧暦8月15日"],
  ["十三夜", EVENT_TEXT.十三夜, "旧暦9月13日"],
  ["十日夜", EVENT_TEXT.十日夜, "旧暦10月10日"],
  ["初午", EVENT_TEXT.初午, "2月最初の午の日"],
  ["二の午", EVENT_TEXT.二の午, "2月2番目の午の日"],
  ["二百二十日", EVENT_TEXT.二百二十日, "立春から220日目"],
];
document.getElementById("g-gyoji").innerHTML = GYOJI.map(([n, t, h]) => row(n, t, h)).join("");

/* 月の満ち欠け */
document.getElementById("g-moon").innerHTML = MOON_PHASES
  .map(([deg, name]) => row(name, MOON_PHASE_TEXT[name], `月と太陽の角度が${deg}度`)).join("");

/* 雑節は今年の日付つきで */
const y = new Date().getFullYear();
const P = (j) => { const p = jdToJstParts(j - 0.375); return `${p.m}月${p.d}日`; };
document.getElementById("g-zassetsu").innerHTML = zassetsuOfYear(y)
  .map((z) => row(z.name, z.text, `${y}年は ${P(z.start)}${z.end > z.start ? "〜" + P(z.end) : ""}`)).join("");
