/*
 * 二人の相性。計算は astro.js / fortune.js / chart.js を使う。
 *
 * ★ 書き方の方針 ★
 * どの組み合わせも「良い・悪い」では終わらせない。相性占いは根拠のない読み物なので、
 * 「合わない」と書いて人の関係に水を差すのは、当たらない占いの使い方として最悪。
 * どの組み合わせにも、その組み合わせなりの噛み合い方と気をつけどころを書く。
 */

/* ---------- 西洋占星術: 二つの天体の角度(アスペクト) ---------- */

/*
 * 二つの黄経の差を 0〜180度に直す。
 * 占星術では特定の角度に意味があるとされ、多少ずれても同じ扱いにする(オーブ)。
 */
function angleBetween(a, b) {
  let d = Math.abs(norm360(a) - norm360(b)) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

const ASPECTS = [
  { deg: 0, orb: 8, name: "合(ごう)", key: "重なる",
    text: "同じ場所に重なる配置。似たもの同士で、言わなくても伝わる代わりに、同じ弱点も共有します。" },
  { deg: 60, orb: 5, name: "六分(セクスタイル)", key: "協力しやすい",
    text: "無理なく助け合える配置。放っておくと関係が進まないので、どちらかが誘う必要があります。" },
  { deg: 90, orb: 6, name: "矩(スクエア)", key: "刺激し合う",
    text: "引っかかりのある配置。摩擦は起きますが、そのぶんお互いを動かします。言い方を選べば強い組み合わせ。" },
  { deg: 120, orb: 7, name: "三分(トライン)", key: "楽でいられる",
    text: "いちばん楽な配置。一緒にいて疲れませんが、居心地が良すぎて先に進まないこともあります。" },
  { deg: 180, orb: 8, name: "衝(オポジション)", key: "補い合う",
    text: "向かい合う配置。正反対だからこそ、相手が自分に無いものを持っています。はっきりした違いは、役割分担にすると強い。" },
];

/* 角度に当てはまるアスペクトを返す。当てはまらなければ null */
function aspectOf(deg) {
  for (const a of ASPECTS) {
    if (Math.abs(deg - a.deg) <= a.orb) return a;
  }
  return null;
}

/* ---------- 五行の関係 ---------- */

/*
 * 木→火→土→金→水→木 が相生(生む)、木剋土・火剋金・土剋水・金剋木・水剋火 が相剋。
 * a から見た b の関係を返す。
 */
function gogyoRelation(a, b) {
  if (a === b) return "比和";
  if ((a + 1) % 5 === b) return "生じる";  // a が b を生む
  if ((b + 1) % 5 === a) return "生じられる"; // b が a を生む
  if ((a + 2) % 5 === b) return "剋す";
  return "剋される";
}

const GOGYO_REL_TEXT = {
  比和: { key: "似た者どうし", text: "同じ性質なので話が早く、価値観もそろいます。ただし同じ方向にしか目が向かず、盲点まで一緒になりがち。" },
  生じる: { key: "支える側", text: "こちらが相手を後押しする関係。尽くしすぎて疲れないように、返ってくるものも数えてください。" },
  生じられる: { key: "支えられる側", text: "相手から力をもらえる関係。受け取るのが自然な立ち位置なので、お礼を言葉にすると長続きします。" },
  剋す: { key: "引き締める側", text: "こちらが相手を律する関係。正しさで押すと窮屈にさせるので、伝え方だけ気をつければ良い緊張感になります。" },
  剋される: { key: "鍛えられる側", text: "相手から刺激を受ける関係。耳の痛いことを言われますが、そこが伸びしろになります。距離の取り方は自分で決めて。" },
};

/* ---------- 十二支の関係 ---------- */

/* 六合(仲の良い組み) */
const RIKUGO = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
/* 三合(三つ組。同じ組の二つは引き合うとされる) */
const SANGO = [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]];

function branchRelation(a, b) {
  if (a === b) return { name: "同じ十二支", key: "重なる", text: "同じ十二支どうし。気が合う一方で、似すぎて役割がかぶることもあります。" };
  if (RIKUGO.some((p) => p.includes(a) && p.includes(b))) {
    return { name: "六合(りくごう)", key: "自然と結びつく", text: "組み合わせとして結びつきが良いとされる関係。理屈より先に馬が合うタイプです。" };
  }
  if (SANGO.some((g) => g.includes(a) && g.includes(b))) {
    return { name: "三合(さんごう)", key: "引き合う", text: "同じ三つ組に入る関係。目指す方向が似ていて、一緒に何かをするのに向くとされます。" };
  }
  if ((a + 6) % 12 === b) {
    return { name: "冲(ちゅう)", key: "正反対", text: "真向かいに位置する関係。ぶつかりやすい代わりに、相手は自分に無いものを持っています。離れがたいのもこの組み合わせ。" };
  }
  return { name: "とくに縁の名前は付かない関係", key: "ふつう", text: "決まった呼び名のある関係ではありません。良くも悪くもない、素のつき合いができる組み合わせです。" };
}

/* ---------- 数秘の組み合わせ ---------- */

/* 数字を役割で分けて、組み合わせの型を出す */
function numberGroup(n) {
  if (n === 11 || n === 22 || n === 33) return "master";
  if (n === 1 || n === 8) return "lead";
  if (n === 2 || n === 6 || n === 9) return "care";
  if (n === 3 || n === 5) return "move";
  return "build"; // 4, 7
}

const NUM_GROUP_NAME = {
  lead: "引っぱる人", care: "支える人", move: "動かす人", build: "固める人", master: "感じ取る人",
};

const NUM_PAIR_TEXT = {
  "lead|lead": "どちらも前に出るタイプ。方向が同じなら誰よりも速く進みますが、決定権を分けておかないと毎回ぶつかります。",
  "care|lead": "引っぱる側と支える側で、役割がきれいに分かれます。支える側の我慢が溜まりやすいので、言葉にする習慣を。",
  "lead|move": "勢いのある組み合わせ。始めるのは得意ですが、どちらも片づけが苦手なので、終わらせる係を決めておくと安定します。",
  "build|lead": "決める人と形にする人。仕事では相性が良い組み合わせです。速さと確実さでぶつかったら、締め切りを先に合意しておくと楽。",
  "lead|master": "行動する人と、感じ取る人。理屈で押す側と直感で動く側なので、説明を省くとすれ違います。",
  "care|care": "お互いに気を遣う穏やかな関係。ただし遠慮し合って、どちらも本音を言わないまま時間が過ぎることがあります。",
  "care|move": "受け止める人と、振りまく人。明るさをもらい、落ち着きを返す関係。予定の立て方が違うので、そこだけ擦り合わせを。",
  "build|care": "どちらも堅実で、長く続く関係になりやすい組み合わせ。変化が苦手な者どうしなので、たまに外の風を入れると良い。",
  "care|master": "感情を受け取る力が強い二人。深く分かり合える代わりに、相手の不調まで背負い込みがちです。",
  "move|move": "一緒にいて楽しい組み合わせ。テンポが合う一方で、二人とも続けるのが苦手なので、決めごとは紙に書いておくと安心。",
  "build|move": "広げる人と、まとめる人。噛み合えば強いですが、速度が違うので「待っている」という合図を決めておくと衝突が減ります。",
  "master|move": "外に出る人と、内で感じる人。刺激をもらえる関係ですが、片方が疲れやすいのでひとりの時間を尊重して。",
  "build|build": "ぶれない者どうし。安心して任せ合える一方で、どちらもやり方を変えないので、方針が違うと長引きます。",
  "build|master": "積み上げる人と、ひらめく人。説明できない提案を否定しないことと、根拠を求めるのを責めないことが鍵。",
  "master|master": "感じ取る力が強い二人。言わなくても分かる場面が多い代わりに、誤解したときも気づかないまま進みます。",
};

function numberPair(a, b) {
  const ga = numberGroup(a), gb = numberGroup(b);
  const key = [ga, gb].sort().join("|");
  return {
    groups: [NUM_GROUP_NAME[ga], NUM_GROUP_NAME[gb]],
    same: a === b,
    text: NUM_PAIR_TEXT[key] || "",
  };
}

/* ---------- まとめ ---------- */

/*
 * 二人分の生年月日から相性を組み立てる。
 * p1 / p2 は { y, m, d, hour, minute } 。hour は null でよい。
 */
function compatibility(p1, p2) {
  const now = new Date();
  const profA = buildProfile(p1.y, p1.m, p1.d, now, p1.hour, p1.minute);
  const profB = buildProfile(p2.y, p2.m, p2.d, now, p2.hour, p2.minute);
  const chartA = westernChart(p1.y, p1.m, p1.d, p1.hour, p1.minute, null);
  const chartB = westernChart(p2.y, p2.m, p2.d, p2.hour, p2.minute, null);
  const fpA = fourPillars(p1.y, p1.m, p1.d, p1.hour, p1.minute, null);
  const fpB = fourPillars(p2.y, p2.m, p2.d, p2.hour, p2.minute, null);

  // 太陽どうし・月どうしの角度
  const sunA = chartA.positions[0].lon, sunB = chartB.positions[0].lon;
  const moonA = chartA.positions[1].lon, moonB = chartB.positions[1].lon;
  const sunDeg = angleBetween(sunA, sunB);
  const moonDeg = angleBetween(moonA, moonB);

  // 九星の五行
  const elemA = KYUSEI_ELEMENT[profA.honmeisei];
  const elemB = KYUSEI_ELEMENT[profB.honmeisei];

  // 四柱推命: 日干どうしの通変星と、日支の関係
  const godAB = tenGod(fpA.dayMaster, fpB.dayMaster); // Aから見たB
  const godBA = tenGod(fpB.dayMaster, fpA.dayMaster);

  return {
    a: { profile: profA, chart: chartA, pillars: fpA },
    b: { profile: profB, chart: chartB, pillars: fpB },
    numerology: numberPair(profA.lifePath, profB.lifePath),
    sun: { deg: sunDeg, aspect: aspectOf(sunDeg) },
    moon: { deg: moonDeg, aspect: aspectOf(moonDeg), uncertain: chartA.moonUncertain || chartB.moonUncertain },
    kyusei: { relation: gogyoRelation(elemA, elemB), elemA, elemB },
    shichu: { godAB, godBA, branch: branchRelation(fpA.day.branch, fpB.day.branch) },
  };
}

/* 九星の五行(一白=水, 二黒=土, 三碧=木, 四緑=木, 五黄=土, 六白=金, 七赤=金, 八白=土, 九紫=火) */
const KYUSEI_ELEMENT = [null, 4, 2, 0, 0, 2, 3, 3, 2, 1];
