/*
 * 今日の運勢のうち「計算で決まる」部分をまとめる。
 *
 *   九星気学 … その日の日盤で、本命星がどの宮(方位)に入るか(回座)。
 *               ラッキーカラー・アイテム・フード・ドリンク・キーワードはこの宮から決まる。
 *               吉方位は houi.js の dayDirections。星の数もこの宮を軸にする(年運・月運と同じ考え方)
 *   数秘術   … パーソナルイヤー・マンス・デー(ラッキーナンバー)
 *   西洋占星術 … 今日の月の星座と、生まれたときの太陽の星座との角度
 *   マヤ暦   … 今日の紋章の色と、13日でひと巡りする流れ(ウェイブスペル)
 *
 * 宮ごとの品物・食べ物は、九星のもとになった易の八卦の象(『易経』説卦伝)から取っている。
 *   一白=坎・二黒=坤・三碧=震・四緑=巽・六白=乾・七赤=兌・八白=艮・九紫=離。五黄は中央で卦がない
 * 色は「同じ宮に本来いる星の名前の色」と「その星の五行の色(木=青・火=赤・土=黄・金=白・水=黒)」。
 * 飲み物のうち説卦伝に手がかりがないものは、五行の味(木=酸・火=苦・土=甘・金=辛)から選んでいる。
 *
 * 依存: astro.js / fortune.js / chart.js / data.js / koyomi.js / houi.js / sukuyo.js / maya.js
 */

/* 宮(1〜9、後天定位の番号)ごとの象。why は画面に出す「なぜ」 */
const PALACE_LUCK = {
  1: {
    dir: "北", star: "一白水星", gua: "坎", virtue: "陥", keyword: "無理せず、力をためる",
    color: "白・黒", colorWhy: "一白の「白」と、水の五行の色「黒」",
    item: "水筒・イヤホン", itemWhy: "説卦伝で坎は「水」と「耳」",
    food: "豚肉", foodWhy: "説卦伝で坎は「豕(ぶた)」",
    drink: "水・白湯", drinkWhy: "説卦伝で坎は「水」",
  },
  2: {
    dir: "南西", star: "二黒土星", gua: "坤", virtue: "順", keyword: "支える・整える",
    color: "黒・黄", colorWhy: "二黒の「黒」と、土の五行の色「黄」",
    item: "ハンカチ・布のバッグ", itemWhy: "説卦伝で坤は「布」",
    food: "牛肉", foodWhy: "説卦伝で坤は「牛」",
    drink: "牛乳", drinkWhy: "説卦伝で坤は「子母牛(子連れの母牛)」",
  },
  3: {
    dir: "東", star: "三碧木星", gua: "震", virtue: "動", keyword: "動き出す",
    color: "青", colorWhy: "三碧の「碧」と、木の五行の色「青」",
    item: "スニーカー", itemWhy: "説卦伝で震は「足」",
    food: "たけのこ・スプラウト", foodWhy: "説卦伝で震は「蒼筤竹(青い竹)」",
    drink: "柑橘のジュース", drinkWhy: "木の五行の味は「酸」",
  },
  4: {
    dir: "東南", star: "四緑木星", gua: "巽", virtue: "入", keyword: "行き渡る・届ける",
    color: "緑", colorWhy: "四緑の「緑」(木の五行の色は青)",
    item: "香りのもの", itemWhy: "説卦伝で巽は「臭(におい)」",
    food: "鶏肉・麺類", foodWhy: "説卦伝で巽は「雞(にわとり)」と「長(長いもの)」",
    drink: "香りのよいお茶", drinkWhy: "説卦伝で巽は「臭(におい)」",
  },
  5: {
    dir: "中央", star: "五黄土星", gua: null, virtue: null, keyword: "中心で踏みとどまる",
    color: "黄", colorWhy: "五黄の「黄」と、土の五行の色「黄」",
    item: "陶器のマグカップ", itemWhy: "五黄は土の星",
    food: "かぼちゃ・さつまいも", foodWhy: "土の五行は色が「黄」、味が「甘」",
    drink: "甘酒", drinkWhy: "土の五行の味は「甘」",
  },
  6: {
    dir: "北西", star: "六白金星", gua: "乾", virtue: "健", keyword: "力強く進む",
    color: "白・金", colorWhy: "六白の「白」と、説卦伝で乾は「金」",
    item: "帽子・腕時計", itemWhy: "説卦伝で乾は「首」と「圜(まるいもの)」",
    food: "果物", foodWhy: "説卦伝で乾は「木果(木の実)」",
    drink: "冷たい飲み物", drinkWhy: "説卦伝で乾は「寒」「冰(こおり)」",
  },
  7: {
    dir: "西", star: "七赤金星", gua: "兌", virtue: "説", keyword: "楽しむ・話す",
    color: "赤・白", colorWhy: "七赤の「赤」と、金の五行の色「白」",
    item: "リップクリーム", itemWhy: "説卦伝で兌は「口」",
    food: "ラム肉・塩味のもの", foodWhy: "説卦伝で兌は「羊」と「剛鹵(塩けの土)」",
    drink: "ジンジャーエール・しょうが湯", drinkWhy: "金の五行の味は「辛」",
  },
  8: {
    dir: "北東", star: "八白土星", gua: "艮", virtue: "止", keyword: "区切りをつける",
    color: "白・黄", colorWhy: "八白の「白」と、土の五行の色「黄」",
    item: "鍵・指輪", itemWhy: "説卦伝で艮は「門闕(門)」と「指」",
    food: "ナッツ・栗", foodWhy: "説卦伝で艮は「果蓏(木の実・草の実)」",
    drink: "スムージー・果汁", drinkWhy: "説卦伝で艮は「果蓏(木の実・草の実)」",
  },
  9: {
    dir: "南", star: "九紫火星", gua: "離", virtue: "麗", keyword: "明らかにする・見せる",
    color: "紫・赤", colorWhy: "九紫の「紫」と、火の五行の色「赤」",
    item: "メガネ・サングラス", itemWhy: "説卦伝で離は「目」",
    food: "かに・貝", foodWhy: "説卦伝で離は「蟹」「蚌(貝)」",
    drink: "コーヒー・抹茶", drinkWhy: "火の五行の味は「苦」",
  },
};

/* 説卦伝の八卦の性質(「乾は健なり、坤は順なり…」)の読み */
const GUA_VIRTUE_TEXT = {
  陥: "坎は「陥(おちいる)」の卦。水が低いところに流れ込むように、無理をせず力をためる日",
  順: "坤は「順(したがう)」の卦。大地のように受けとめ、人を支えると流れが整う日",
  動: "震は「動(うごく)」の卦。雷のように、止めていたことを動かし始める日",
  入: "巽は「入(はいる)」の卦。風のように、細かいところまで行き渡らせる日",
  健: "乾は「健(すこやか)」の卦。天のように、休まず力強く進む日",
  説: "兌は「説(よろこぶ)」の卦。人と話し、楽しむことで運が開く日",
  止: "艮は「止(とどまる)」の卦。山のように、いったん止まって区切りをつける日",
  麗: "離は「麗(つく・あきらか)」の卦。火のように、物事を明るみに出す日",
};

/* 九星の日盤で、本命星が今日入る宮 */
function dayPalaceOf(honmei, y, m, d) {
  const center = dayKoyomi(y, m, d).kyusei.star;
  return { center, palace: kyuseiPalace(honmei, center) };
}

/* ---------- 数秘術 パーソナルイヤー・マンス・デー ---------- */

/*
 * パーソナルイヤー = 誕生月 + 誕生日 + 今年 を1桁に。
 * マンス = イヤー + 今月、デー = マンス + 今日の日 をそれぞれ1桁に。
 * 年の切り替えは1月1日とする流儀(誕生日で切り替える流儀もある)。
 */
function personalNumbers(bm, bd, ty, tm, td) {
  const year = reduceToDigit(reduceToDigit(bm) + reduceToDigit(bd) + reduceToDigit(ty));
  const month = reduceToDigit(year + reduceToDigit(tm));
  const day = reduceToDigit(month + reduceToDigit(td));
  return { year, month, day };
}

const PERSONAL_NUMBER_TEXT = {
  1: { key: "始まり", text: "新しいことを始め、自分で決める" },
  2: { key: "協力", text: "人と歩調を合わせ、待つことも大事にする" },
  3: { key: "表現", text: "楽しみ、話し、作ることで広がる" },
  4: { key: "土台", text: "コツコツ積み上げ、足元を整える" },
  5: { key: "変化", text: "動いて、新しい場所や人に出会う" },
  6: { key: "責任と愛情", text: "家族や身近な人を大切にする" },
  7: { key: "内省", text: "学び、ひとりで考える時間をとる" },
  8: { key: "実り", text: "成果やお金、決断に向き合う" },
  9: { key: "完了", text: "区切りをつけ、手放し、感謝する" },
};

/* ---------- 西洋占星術 今日の月 ---------- */

/* 日本時間 y-m-d h:mi の月の黄経(度) */
function moonLonAt(y, m, d, h, mi) {
  return norm360(moonLongitude(ttFrom(jdFromJst(y, m, d, h, mi))));
}

/*
 * 今日の月の星座。正午の位置で代表させ、今日のうちに星座が変わるなら、その時刻も返す。
 * 月は1日に約13度進むので、30度の星座は2日半ほどで移る。
 */
function moonToday(y, m, d) {
  const sign = (lon) => Math.floor(lon / 30);
  const noon = sign(moonLonAt(y, m, d, 12, 0));
  const start = sign(moonLonAt(y, m, d, 0, 0));
  const end = sign(moonLonAt(y, m, d, 24, 0));
  let change = null;
  if (start !== end) {
    // 0時〜24時のあいだで、星座が変わる分を二分法で探す
    let lo = 0, hi = 24 * 60;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (sign(moonLonAt(y, m, d, 0, mid)) === start) lo = mid; else hi = mid;
    }
    const minutes = Math.round(hi);
    change = { from: start, to: end, hour: Math.floor(minutes / 60), minute: minutes % 60 };
  }
  return { sign: noon, change };
}

const MOON_SIGN_DAY = [
  "勢いで動ける日。思い立ったら一歩目を",
  "味わう日。食事や手ざわりのいいものを丁寧に",
  "情報が集まる日。連絡や調べものが進む",
  "身内と家の日。身近な人との時間を",
  "楽しむ日。少し目立つことをしても",
  "整える日。片づけや確認がはかどる",
  "人づきあいの日。バランスを取る役回りに",
  "集中の日。ひとつのことを深く",
  "遠くを見る日。学びや旅の計画に",
  "計画の日。先の予定を固める",
  "仲間の日。いつもと違う発想を",
  "ゆるめる日。休む・想像する",
];

/* 太陽の星座から見た、今日の月の星座の角度(星座どうしで数える) */
function moonSunAspect(sunSign, moonSign) {
  const k = ((moonSign - sunSign) % 12 + 12) % 12;
  if (k === 0) return { name: "同じ星座", deg: 0, text: "月があなたの太陽星座に入る日。自分らしさが出しやすい" };
  if (k === 6) return { name: "反対の星座(180度)", deg: 180, text: "人との関わりで気づきがある日。相手の意見に耳を傾けて" };
  if (k === 4 || k === 8) return { name: "120度", deg: 120, text: "気持ちと行動がかみ合いやすい日" };
  if (k === 3 || k === 9) return { name: "90度", deg: 90, text: "気持ちと予定がぶつかりやすい日。ひと呼吸おいて" };
  if (k === 2 || k === 10) return { name: "60度", deg: 60, text: "小さなきっかけをつかみやすい日" };
  return { name: k === 1 || k === 11 ? "30度" : "150度", deg: k === 1 || k === 11 ? 30 : 150, text: "目立った角度のない、ふだんどおりの日" };
}

/* ---------- マヤ暦 その日の色 ---------- */

/* 紋章の4色を「その日の過ごし方」として読むとき用(maya.js の MAYA_COLOR_TEXT は人の性質の読み) */
const MAYA_COLOR_DAY = {
  赤: "始める日。新しいことに手をつけると流れが起きる",
  白: "整える日。余分なものを削り、筋を通す",
  青: "変える日。いつものやり方を組み替えてみる",
  黄: "実らせる日。形にして仕上げる",
};

/* ---------- まとめ ---------- */

/*
 * 今日のラッキー一式。
 *   p … buildProfile の結果(honmeisei・zodiac を使う)
 */
function dailyLuckyOf(p, today) {
  const ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate();
  const { center, palace } = dayPalaceOf(p.honmeisei, ty, tm, td);
  const luck = PALACE_LUCK[palace];
  const dirs = dayDirections(ty, tm, td, p.honmeisei);
  const nums = personalNumbers(p.m, p.d, ty, tm, td);
  const moon = moonToday(ty, tm, td);
  const aspect = moonSunAspect(p.zodiac, moon.sign);
  return { center, palace, luck, dirs, nums, moon, aspect, hakkou: palace === 5 };
}

/*
 * これからの days 日間。星の数(九星の回座が軸)・宿曜の三九・四柱推命の通変星・九星の宮・マヤの色。
 *   sk … sukuyoOf、fp … fourPillars の結果
 */
const SANKU_GOOD = ["栄", "親", "友"];
const SANKU_BAD = ["衰", "危", "壊"];

function dailyFlow(p, sk, fp, today, days, pools) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const y = t.getFullYear(), m = t.getMonth() + 1, d = t.getDate();
    const { palace } = dayPalaceOf(p.honmeisei, y, m, d);
    const f = dailyFortune(p.y, p.m, p.d, t, pools, palace);
    const shuku = honmeiShukuByLunar(y, m, d);
    const rel = (sk && sk.main && shuku) ? sankuRelation(sk.main.index, shuku.index).name : null;
    const dk = dayKoyomi(y, m, d);
    const god = (fp && fp.dayMaster !== null && fp.dayMaster !== undefined) ? tenGod(fp.dayMaster, dk.stem) : null;
    const maya = dreamspellOf(y, m, d);
    out.push({
      y, m, d, wd: t.getDay(), holiday: holidayOf(y, m, d), palace, stars: f.overall, rel, god,
      mayaColor: maya.color, rokuyo: dk.rokuyo,
    });
  }
  /*
   * いちばんいい日: 宿曜で衰・危・壊にあたる日を除いて、星の数がいちばん多い日。
   * 同じなら栄・親・友の日、それでも同じなら早い日。全部が衰・危・壊なら除かずに選ぶ
   */
  const pool = out.filter((o) => !SANKU_BAD.includes(o.rel));
  const cand = pool.length ? pool : out;
  const score = (o) => o.stars * 10 + (SANKU_GOOD.includes(o.rel) ? 1 : 0);
  let best = cand[0];
  for (const o of cand) if (score(o) > score(best)) best = o;
  best.best = true;
  return out;
}
