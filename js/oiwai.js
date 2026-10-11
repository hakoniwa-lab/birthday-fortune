/*
 * 赤ちゃんのお祝い日程カレンダー(oiwai/)の計算。
 * 生年月日から、お七夜・お宮参り・お食い初め・ハーフバースデー・初節句・初誕生・七五三の日付と、
 * 前後の土日祝(大安に★)を出す。
 *
 * 数え方は地域や神社で違うので選べるようにした。既定は神社本庁の案内に合わせている。
 *   日数      … 生まれた日を1日目(既定。神社本庁「7日目のお七夜」) / 生まれた日を0日目
 *   お宮参り  … 男の子31日目・女の子33日目(神社本庁「出産と育児」) /
 *               男の子31日目・女の子32日目(島根県神社庁「男の子は生後30日、女の子は生後31日が過ぎてから」) /
 *               男女とも好きな日数
 *   お食い初め … 100日目(既定。神社本庁「百日(ももか)の祝い」) / 110日目 / 120日目(地域によって遅くする)
 *   七五三    … 満年齢(既定) / 数え年。女の子3歳・7歳、男の子5歳(3歳も祝うかは選ぶ)。日付は11月15日
 *
 * 依存: astro.js(jdn) / koyomi.js(rokuyo) / holiday.js(holidayOf)
 */

const OW_WD = ["日", "月", "火", "水", "木", "金", "土"];

/* 日の通し番号 → 年月日(Richards のアルゴリズム) */
function owYmd(idx) {
  const f = idx + 1401 + Math.floor((Math.floor((4 * idx + 274277) / 146097) * 3) / 4) - 38;
  const e = 4 * f + 3;
  const g = Math.floor((e % 1461) / 4);
  const h = 5 * g + 2;
  const d = Math.floor((h % 153) / 5) + 1;
  const m = ((Math.floor(h / 153) + 2) % 12) + 1;
  const y = Math.floor(e / 1461) - 4716 + Math.floor((12 + 2 - m) / 12);
  return { y, m, d };
}

function owDaysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

/* その日の曜日・六曜・祝日 */
function owInfo(idx) {
  const { y, m, d } = owYmd(idx);
  const wd = (idx + 1) % 7;
  const r = rokuyo(y, m, d);
  const holiday = holidayOf(y, m, d);
  return {
    idx, y, m, d, wd, wdName: OW_WD[wd],
    rokuyo: r ? r.name : null,
    holiday: holiday || null,
    isRest: wd === 0 || wd === 6 || !!holiday,
  };
}

/* nか月後の同じ日(ない日は月末) */
function owAddMonths(y, m, d, n) {
  const t = (y * 12 + (m - 1)) + n;
  const yy = Math.floor(t / 12), mm = t % 12 + 1;
  return jdn(yy, mm, Math.min(d, owDaysInMonth(yy, mm)));
}

/* 前後 before〜after 日の土日祝(その日を含む)。大安に印 */
function owCandidates(idx, before, after) {
  const out = [];
  for (let i = idx - before; i <= idx + after; i++) {
    const x = owInfo(i);
    if (x.isRest) out.push({ ...x, taian: x.rokuyo === "大安", offset: i - idx });
  }
  return out;
}

/* その年の10月・11月の土日祝のうち大安の日 */
function owShichigosanTaian(y) {
  const out = [];
  for (let i = jdn(y, 10, 1); i <= jdn(y, 11, 30); i++) {
    const x = owInfo(i);
    if (x.isRest && x.rokuyo === "大安") out.push(x);
  }
  return out;
}

const OW_MIYA = {
  jinja: { boy: 31, girl: 33, label: "男の子31日目・女の子33日目(神社本庁の案内)" },
  shimane: { boy: 31, girl: 32, label: "男の子31日目・女の子32日目" },
};

/*
 * input: { y, m, d, sex: "boy"|"girl", zero: bool, miya: "jinja"|"shimane"|"custom", miyaDays, kuizome: 100|110|120,
 *          shichi: "man"|"kazoe", boy3: bool }
 * 戻り値: { birth, items[] } items は日付順。各要素に info・candidates・note
 */
function oiwaiSchedule(inp) {
  const birthIdx = jdn(inp.y, inp.m, inp.d);
  const birth = owInfo(birthIdx);
  const sex = inp.sex === "girl" ? "girl" : "boy";
  const nth = (n) => birthIdx + n - (inp.zero ? 0 : 1);   // 生後n日目
  const label = (n) => inp.zero ? `生後${n}日` : `生後${n}日目`;
  const items = [];
  const add = (key, name, idx, sub, opts = {}) => {
    const info = owInfo(idx);
    items.push({
      key, name, idx, info, sub,
      candidates: opts.noCand ? [] : owCandidates(idx, opts.before ?? 7, opts.after ?? 7),
      note: opts.note || "", extra: opts.extra || null, group: opts.group || "baby",
    });
  };

  add("oshichiya", "お七夜(命名)", nth(7), label(7), {
    noCand: true, note: "家でお祝いすることが多く、日にちどおりに行う家庭が多い行事です",
  });

  let miyaDays;
  if (inp.miya === "custom") miyaDays = Math.max(1, Math.min(200, Number(inp.miyaDays) || 31));
  else miyaDays = (OW_MIYA[inp.miya] || OW_MIYA.jinja)[sex];
  add("omiya", "お宮参り(初宮参り)", nth(miyaDays), label(miyaDays), {
    note: "母子の体調や天候を見て、前後の都合のよい日にずらすことが多い行事です",
  });

  const kz = [100, 110, 120].includes(Number(inp.kuizome)) ? Number(inp.kuizome) : 100;
  add("okuizome", kz === 100 ? "お食い初め(百日祝い)" : "お食い初め", nth(kz), label(kz), {
    note: kz === 100 ? "" : "地域によっては100日より遅くして、成長が延びることにかける習わしもあります",
  });

  add("half", "ハーフバースデー", owAddMonths(inp.y, inp.m, inp.d, 6), "生後6か月");

  /* 初節句: 女の子は3月3日、男の子は5月5日。生まれた日より後で最初の節句 */
  const [sm, sd] = sex === "girl" ? [3, 3] : [5, 5];
  let sy = inp.y;
  if (jdn(sy, sm, sd) <= birthIdx) sy++;
  const sekkuIdx = jdn(sy, sm, sd);
  const sekkuAge = sekkuIdx - birthIdx;
  const early = sekkuAge < 60;
  add("sekku", `初節句(${sex === "girl" ? "桃の節句" : "端午の節句"})`, sekkuIdx, `生まれてから${sekkuAge}日`, {
    note: early ? `生まれてまもない時期なので、翌年(${sy + 1}年${sm}月${sd}日)に祝う家庭もあります。はっきりした決まりはありません` : "",
  });

  const bm = inp.m === 2 && inp.d === 29 ? 2 : inp.m, bd = inp.m === 2 && inp.d === 29 ? 28 : inp.d;
  add("tanjo", "初誕生(1歳の誕生日)", jdn(inp.y + 1, bm, bd), "1歳", {
    note: inp.m === 2 && inp.d === 29 ? "2月29日生まれなので、うるう年でない年は2月28日にしています(3月1日に祝う家庭もあります)" : "一升餅を背負わせて祝う地域もあります",
  });

  /* 七五三 */
  const ages = sex === "girl" ? [3, 7] : (inp.boy3 === false ? [5] : [3, 5]);
  for (const age of ages) {
    const yy = inp.shichi === "kazoe" ? inp.y + age - 1 : inp.y + age;
    add(`753-${age}`, `七五三(${age}歳)`, jdn(yy, 11, 15), inp.shichi === "kazoe" ? `数え${age}歳` : `満${age}歳の年`, {
      before: 7, after: 7, group: "753",
      extra: { taian: owShichigosanTaian(yy), year: yy },
      note: "11月15日にこだわらず、10月〜11月の土日祝で選ぶ家庭が多くあります",
    });
  }

  items.sort((a, b) => a.idx - b.idx);
  return { birth, sex, items, miyaDays, kuizome: kz };
}

/* ---------- カレンダー登録(.ics)の小物 ---------- */

function owIcsEscape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/* 1行75オクテットで折り返す(RFC 5545)。文字の途中では切らない */
function owIcsFold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 75) { out.push(cur); cur = " " + ch; bytes = 1 + b; }
    else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join("\r\n");
}

function owIcsDate(idx) {
  const { y, m, d } = owYmd(idx);
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}
