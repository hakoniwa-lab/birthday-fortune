/*
 * 方位神(八将神・金神・大金神・姫金神)の方位と、金神の遊行・間日。表を持たず、十干・十二支の決まりだけで出す。
 *
 * 方位は十二支で表す(子=北から時計回りに30度ずつ)。年は立春で切り替わる(恵方と同じ扱い)。
 *
 * 八将神 … 太歳(年の十二支)を基準に、ほかの7神の位置が決まる。
 *   大将軍 亥子丑の年=酉(西)・寅卯辰=子(北)・巳午未=卯(東)・申酉戌=午(南)。3年同じ方位にいる(三年塞がり)
 *   大陰 = 太歳の2つ手前 / 歳刑 = 三刑 / 歳破 = 太歳の反対 / 歳殺 = 三合の前の支 /
 *   黄幡 = 三合の墓(最後の支) / 豹尾 = 黄幡の反対
 *   Wikipedia「八将神」の十二支×八将神の表と、12年すべてで一致することを確かめている。
 * 金神 … 年の十干で決まる。Wikipedia「金神」の表(甲己=午未申酉 / 乙庚=辰巳 / 丙辛=子丑寅卯午未 /
 *   丁壬=寅卯戌亥 / 戊癸=子丑申酉)を使う。辞典(簠簋内伝による)には乙庚=辰巳戌亥・丙辛=子丑寅卯とする別の表もある。
 * 大金神・姫金神 … 年の十二支で決まり、子年は大金神が酉・姫金神が卯で、1年ごとに1つずつ進む。2神はいつも反対側。
 * 金神の遊行 … 日の干支で5日ずつ。甲寅から午(南)、丙寅から酉(西)、戊寅から中央、庚寅から子(北)、壬寅から卯(東)。
 *   季節による遊行もある(春は乙卯から卯、夏は丙午から午、秋は辛酉から酉、冬は壬子から子へ、それぞれ5日)。
 * 金神の間日 … 春は丑の日、夏は申の日、秋は未の日、冬は酉の日。季節は立春・立夏・立秋・立冬で区切る。
 */

const HJ_BRANCH = "子丑寅卯辰巳午未申酉戌亥";
const HJ_STEM = "甲乙丙丁戊己庚辛壬癸";
/* 十二支の方位(16方位の呼び名で近いもの)と、真北から時計回りの角度 */
const HJ_DIR = ["北", "北北東", "東北東", "東", "東南東", "南南東", "南", "南南西", "西南西", "西", "西北西", "北北西"];
const HJ_DIR4 = { 0: "北", 3: "東", 6: "南", 9: "西" };

const HJ_SANKEI = [3, 10, 5, 0, 4, 8, 6, 1, 2, 9, 7, 11]; // 三刑: 子→卯, 丑→戌, 寅→巳, 卯→子, 辰→辰, 巳→申, 午→午, 未→丑, 申→寅, 酉→酉, 戌→未, 亥→亥
const HJ_DAISHOGUN = [9, 9, 0, 0, 0, 3, 3, 3, 6, 6, 6, 9];
const HJ_KONJIN = [[6, 7, 8, 9], [4, 5], [0, 1, 2, 3, 6, 7], [2, 3, 10, 11], [0, 1, 8, 9]]; // 甲己・乙庚・丙辛・丁壬・戊癸
const HJ_KONJIN_HOKI = [[6, 7, 8, 9], [4, 5, 10, 11], [0, 1, 2, 3], [2, 3, 10, 11], [0, 1, 8, 9]]; // 辞典(簠簋内伝)の表

/* 年(立春から始まる年)の十干・十二支の番号 */
function hjYearStem(year) { return ((year - 4) % 10 + 10) % 10; }
function hjYearBranch(year) { return ((year - 4) % 12 + 12) % 12; }

/* 三合(申子辰・亥卯未・寅午戌・巳酉丑)の組の、最初の支 */
function hjSangoFirst(b) { return [8, 5, 2, 11][b % 4]; }

/* 八将神の位置(十二支の番号) */
function hasshojin(year) {
  const b = hjYearBranch(year);
  const first = hjSangoFirst(b);
  const ohban = (first + 8) % 12; // 三合の墓(最後の支)
  return {
    taisai: b,
    daishogun: HJ_DAISHOGUN[b],
    daion: (b + 10) % 12,
    saikyo: HJ_SANKEI[b],
    saiha: (b + 6) % 12,
    saisetsu: (first + 11) % 12, // 三合の最初の支の1つ手前
    ohban,
    hyobi: (ohban + 6) % 12,
  };
}

/* 金神の方位(十二支の番号の配列)。hoki=true で辞典(簠簋内伝)の表 */
function konjinDirs(year, hoki) {
  return (hoki ? HJ_KONJIN_HOKI : HJ_KONJIN)[hjYearStem(year) % 5].slice();
}

/* 大金神・姫金神 */
function daikonjin(year) {
  const b = hjYearBranch(year);
  return { daikonjin: (b + 9) % 12, himekonjin: (b + 3) % 12 };
}

/* 日の干支の番号(甲子=0〜癸亥=59) */
function hjKanshiIndex(stem, branch) { return ((6 * stem - 5 * branch) % 60 + 60) % 60; }

/* 金神の遊行(日の干支による)。遊行中ならその方位(十二支の番号、中央は -1)、そうでなければ null */
const HJ_YUGYO = [[50, 6], [2, 9], [14, -1], [26, 0], [38, 3]]; // 甲寅・丙寅・戊寅・庚寅・壬寅 から5日
function konjinYugyo(kanshi) {
  for (const [s, dir] of HJ_YUGYO) if (((kanshi - s) % 60 + 60) % 60 < 5) return { start: s, dir };
  return null;
}

/* 季節による遊行。season は 0=春 1=夏 2=秋 3=冬 */
const HJ_YUGYO_SEASON = [[51, 3], [42, 6], [57, 9], [48, 0]]; // 乙卯・丙午・辛酉・壬子 から5日
function konjinYugyoSeason(kanshi, season) {
  const [s, dir] = HJ_YUGYO_SEASON[season];
  return ((kanshi - s) % 60 + 60) % 60 < 5 ? { start: s, dir } : null;
}

/* 金神の間日(春=丑・夏=申・秋=未・冬=酉の日) */
const HJ_MABI = [1, 8, 7, 9];
function isKonjinMabi(branch, season) { return HJ_MABI[season] === branch; }
