/*
 * 姓名判断の計算(五格と、数え方の違い)。画面は js/seimei-app.js、漢字表は js/seimei-data.js。
 * 数え方は4通り: 0 今の字のまま / 1 今の字で部首を元の字に / 2 旧字体に直す / 3 旧字体に直して部首も元の字に
 * 霊数は3通り: 0 足さない / 1 外格だけ / 2 天格・地格・外格(姓か名が1文字のときだけ結果が変わる)
 * 吉凶は 0 吉 / 1 半吉 / 2 凶。7つの公開表の多数決(SEIMEI_CLASS)。
 * 依存: seimei-data.js
 */
const SEIMEI_RULES = ["今の字", "今の字＋部首", "旧字体", "旧字体＋部首"];
const SEIMEI_REISU = ["足さない", "外格だけ", "天格・地格・外格"];
const SEIMEI_GRID = ["天格", "人格", "地格", "外格", "総格"];
const SEIMEI_LABEL = ["吉", "半吉", "凶"];
const SEIMEI_RAD = {
  85: "氵を水(4画)で", 64: "扌を手(4画)で", 61: "忄を心(4画)で", 94: "犭を犬(4画)で", 96: "王を玉(5画)で", 113: "礻を示(5画)で",
  140: "艹を艸(6画)で", 145: "衤を衣(6画)で", 130: "月を肉(6画)で", 163: "阝を邑(7画)で", 162: "辶を辵(7画)で", 170: "阝を阜(8画)で",
};
// かなは流派で数え方が違うので目安。画面で直せる
const SEIMEI_KANA = {
  あ: 3, い: 2, う: 2, え: 2, お: 3, か: 3, き: 4, く: 1, け: 3, こ: 2, さ: 3, し: 1, す: 2, せ: 3, そ: 1, た: 4, ち: 2, つ: 1, て: 1, と: 2,
  な: 4, に: 3, ぬ: 2, ね: 2, の: 1, は: 3, ひ: 1, ふ: 4, へ: 1, ほ: 4, ま: 3, み: 2, む: 3, め: 2, も: 3, や: 3, ゆ: 2, よ: 2,
  ら: 2, り: 2, る: 1, れ: 2, ろ: 1, わ: 2, を: 3, ん: 1,
  ア: 2, イ: 2, ウ: 3, エ: 3, オ: 3, カ: 2, キ: 3, ク: 2, ケ: 3, コ: 2, サ: 3, シ: 3, ス: 2, セ: 2, ソ: 2, タ: 3, チ: 3, ツ: 3, テ: 3, ト: 2,
  ナ: 2, ニ: 2, ヌ: 2, ネ: 4, ノ: 1, ハ: 2, ヒ: 2, フ: 1, ヘ: 1, ホ: 4, マ: 2, ミ: 3, ム: 2, メ: 2, モ: 3, ヤ: 2, ユ: 2, ヨ: 3,
  ラ: 2, リ: 2, ル: 2, レ: 1, ロ: 3, ワ: 2, ヲ: 3, ン: 2, ー: 1,
};
const SEIMEI_SMALL = { ぁ: "あ", ぃ: "い", ぅ: "う", ぇ: "え", ぉ: "お", っ: "つ", ゃ: "や", ゅ: "ゆ", ょ: "よ", ゎ: "わ", ァ: "ア", ィ: "イ", ゥ: "ウ", ェ: "エ", ォ: "オ", ッ: "ツ", ャ: "ヤ", ュ: "ユ", ョ: "ヨ", ヮ: "ワ", ヵ: "カ", ヶ: "ケ" };

function seimeiKanaStrokes(ch) {
  const nfd = ch.normalize("NFD");
  const base = SEIMEI_SMALL[nfd[0]] || nfd[0];
  const v = SEIMEI_KANA[base];
  if (v == null) return null;
  // 濁点は2画、半濁点は1画
  return v + (nfd.includes("゙") ? 2 : 0) + (nfd.includes("゚") ? 1 : 0);
}

/** 1文字の情報。kind は kanji / repeat(々)/ kana / unknown。override は { 字: 画数 } */
function seimeiCharInfo(ch, prev, override) {
  if (ch === "々") {
    const p = prev ? prev.s : [0, 0, 0, 0];
    return { ch, kind: "repeat", s: [3, p[1], p[2], p[3]] };
  }
  const o = override && override[ch];
  const v = SEIMEI_KANJI[ch];
  if (v != null) {
    if (o != null) return { ch, kind: "kanji", edited: true, s: [o, o, o, o] };
    if (typeof v === "number") return { ch, kind: "kanji", s: [v, v, v, v] };
    return { ch, kind: "kanji", s: v.slice(0, 4), old: v[4] || "", rad: v[5] || 0 };
  }
  const k = seimeiKanaStrokes(ch);
  if (k != null) {
    const n = o != null ? o : k;
    return { ch, kind: "kana", s: [n, n, n, n], edited: o != null };
  }
  if (o != null) return { ch, kind: "unknown", edited: true, s: [o, o, o, o] };
  return { ch, kind: "unknown", s: null };
}

function seimeiNormalize(str) {
  // 半角カナだけ全角に直す(NFKC を全体に掛けると旧字体の互換漢字が今の字に変わる)
  return Array.from(String(str || "").replace(/[\s　]/g, "").replace(/[｡-ﾟ]+/g, (m) => m.normalize("NFKC"))).join("");
}

function seimeiParse(str, override) {
  const out = [];
  for (const ch of seimeiNormalize(str)) {
    out.push(seimeiCharInfo(ch, out[out.length - 1], override));
  }
  return out;
}

/** 81を超えたら80を引く(81は1に戻る数なので、82が2にあたる) */
function seimeiReduce(n) {
  let x = n;
  while (x > 81) x -= 80;
  return x;
}

function seimeiClassOf(n) {
  return n > 0 ? SEIMEI_CLASS[seimeiReduce(n) - 1] : null;
}

/** 五格 [天,人,地,外,総]。sq, gq は画数の列、h は霊数の方式 */
function seimeiFive(sq, gq, h) {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const ss = sum(sq), gs = sum(gq);
  const ten = ss + (h === 2 && sq.length === 1 ? 1 : 0);
  const chi = gs + (h === 2 && gq.length === 1 ? 1 : 0);
  const jin = sq[sq.length - 1] + gq[0];
  const sou = ss + gs;
  let gai = sou - jin;
  if (h >= 1) gai += (sq.length === 1 ? 1 : 0) + (gq.length === 1 ? 1 : 0);
  return [ten, jin, chi, gai, sou];
}

/** 数え方 r・霊数 h の五格と吉凶 */
function seimeiResult(sei, mei, r, h) {
  const sq = sei.map((c) => c.s[r]);
  const gq = mei.map((c) => c.s[r]);
  const five = seimeiFive(sq, gq, h);
  const cls = five.map(seimeiClassOf);
  return { five, cls, kyo: cls.filter((c) => c === 2).length };
}

/** 姓と名(文字列)から全部の数え方を出す。読めない字があれば unknown に入る */
function seimeiCompute(seiStr, meiStr, override) {
  const sei = seimeiParse(seiStr, override);
  const mei = seimeiParse(meiStr, override);
  const unknown = [...sei, ...mei].filter((c) => c.kind === "unknown" && !c.s).map((c) => c.ch);
  const kana = [...new Set([...sei, ...mei].filter((c) => c.kind === "kana").map((c) => c.ch))];
  if (!sei.length || !mei.length || unknown.length) return { sei, mei, unknown, kana, ok: false };
  const grid = [];
  for (let r = 0; r < 4; r++) {
    grid.push([0, 1, 2].map((h) => seimeiResult(sei, mei, r, h)));
  }
  const one = sei.length === 1 || mei.length === 1;
  // 吉凶の並びが何通りあるか(霊数は1文字のときだけ変わる)
  const patterns = new Set();
  const numbers = new Set();
  let minKyo = 9, maxKyo = 0;
  let noKyo = 0;
  for (const row of grid) {
    for (const x of row) {
      patterns.add(x.cls.join(""));
      numbers.add(x.five.join(","));
      minKyo = Math.min(minKyo, x.kyo);
      maxKyo = Math.max(maxKyo, x.kyo);
      if (x.kyo === 0) noKyo++;
    }
  }
  return { sei, mei, unknown, kana, ok: true, grid, one, patterns: patterns.size, numbers: numbers.size, minKyo, maxKyo, noKyo };
}
