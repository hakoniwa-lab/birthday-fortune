// 日盤の吉方位(houi.js の dayDirections)を、公開されている日盤(九星気学 八雲院)と突き合わせる。
// node test/check-day-board.js   … 12日分(陽遁・陰遁の切り替え前後を含む)×本命星9つ。ネットにつなぐので数分かかる
const fs = require("fs"), vm = require("vm"), { execFileSync } = require("child_process");
const BF = require("path").join(__dirname, "..", "js") + "/";
const ctx = vm.createContext({ console, Math, Date, Map, Set, Array, Object, JSON, Number, String });
vm.runInContext(["astro.js", "fortune.js", "chart.js", "data.js", "koyomi.js", "holiday.js", "houi.js"].map((f) => fs.readFileSync(BF + f, "utf8")).join("\n")
  + ";globalThis.__api={dayDirections,kyuseiSwitchesOf,jdn};", ctx);
const { dayDirections, kyuseiSwitchesOf, jdn } = ctx.__api;
const STAR = { 一白: 1, 二黒: 2, 三碧: 3, 四緑: 4, 五黄: 5, 六白: 6, 七赤: 7, 八白: 8, 九紫: 9 };
const DIRMAP = { 南東: "東南" };
const BAD = ["五黄殺", "暗剣殺", "本命殺", "本命的殺", "日破", "定位対冲"];

// 陽遁・陰遁の切り替え日の前後も入れる
const dates = ["2026-10-11", "2027-03-21", "2027-08-02", "2028-01-15"];
for (const y of [2026, 2027]) for (const s of kyuseiSwitchesOf(y)) {
  for (const off of [-1, 0]) {
    const j = s.day + off;
    const D = new Date((j - 2440588) * 86400000);
    dates.push(D.toISOString().slice(0, 10));
  }
}
const uniq = [...new Set(dates)].filter((d) => d >= "2026-01-01" && d <= "2028-12-31");
console.log("dates", uniq.join(" "));

let ok = 0, ng = [];
for (const ds of uniq) {
  const [Y, M, D] = ds.split("-").map(Number);
  for (let h = 1; h <= 9; h++) {
    const url = `https://yakumoin.info/kyusei/direction_day/id/${h}/1/${ds.replace(/-/g, "")}`;
    const html = execFileSync("curl", ["-s", "-m", "20", "-A", "Mozilla/5.0", url], { encoding: "utf8", maxBuffer: 1 << 24 });
    let t = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "\n").replace(/&[a-z]+;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
    const cm = t.match(/(一白|二黒|三碧|四緑|五黄|六白|七赤|八白|九紫)(水|土|木|金|火)星が中宮の日です/);
    const ends = [t.indexOf("吉方位の効果"), t.indexOf("の時盤一覧")].filter((x) => x > 0);
    const end = Math.min(...ends);
    const start = t.lastIndexOf("\n北\n", end);
    const lines = t.slice(start + 1, end).split("\n").map((s) => s.trim()).filter(Boolean);
    const theirs = {};
    const DIRS = ["北", "北東", "東", "南東", "東南", "南", "南西", "西", "北西"];
    let cur = null;
    for (const ln of lines) {
      if (DIRS.includes(ln)) { cur = DIRMAP[ln] || ln; theirs[cur] = []; continue; }
      if (cur) theirs[cur].push(...ln.split("、").map((x) => x.trim()).filter(Boolean));
    }
    const r = dayDirections(Y, M, D, h);
    const errs = [];
    if (!cm || STAR[cm[1]] !== r.center) errs.push(`中宮 theirs=${cm && cm[1]} ours=${r.center}`);
    for (const dd of r.dirs) {
      const th = theirs[dd.dir] || [];
      const thBad = th.filter((x) => BAD.includes(x)).sort().join(",");
      const ourBad = [...dd.bad].sort().join(",");
      if (thBad !== ourBad) errs.push(`${dd.dir} 凶 theirs=${thBad} ours=${ourBad}`);
      const thGood = th.some((x) => x === "吉方" || x === "最大吉方");
      const getsuBad = th.some((x) => x === "月命殺" || x === "月命的殺");
      if (thGood && !dd.good) errs.push(`${dd.dir} 吉 theirs only`);
      if (dd.good && !thGood && !getsuBad) errs.push(`${dd.dir} 吉 ours only`);
    }
    if (errs.length) ng.push(`${ds} 本命${h}: ${errs.join(" / ")}`); else ok++;
  }
}
console.log("ok", ok, "ng", ng.length);
console.log(ng.slice(0, 30).join("\n"));
