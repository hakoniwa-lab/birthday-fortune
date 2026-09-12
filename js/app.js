/*
 * 画面の制御。計算は fortune.js、文章は data.js。
 * 生年月日は端末の localStorage にだけ保存し、次回開いたときに今日の運勢をすぐ出す。
 */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

const STORAGE_KEY = "birthday-fortune:birth";

const form = document.getElementById("gen-form");
const selYear = document.getElementById("year");
const selMonth = document.getElementById("month");
const selDay = document.getElementById("day");
const selHour = document.getElementById("hour");
const selMinute = document.getElementById("minute");
const selPref = document.getElementById("pref");
const introSection = document.getElementById("screen-intro");
const resultSection = document.getElementById("screen-result");
const resultBody = document.getElementById("result-body");
const dailyBody = document.getElementById("daily-body");
const flowBody = document.getElementById("flow-body");
const westernBody = document.getElementById("western-body");
const sanmeiBody = document.getElementById("sanmei-body");
const sukuyoBody = document.getElementById("sukuyo-body");
const mayaBody = document.getElementById("maya-body");
const worldBody = document.getElementById("world-body");
const btnRestart = document.getElementById("btn-restart");
const btnCopy = document.getElementById("btn-copy");
const formError = document.getElementById("form-error");

let shareText = "";

/* ---------- セレクトの初期化 ---------- */

function fillSelects() {
  const now = new Date();
  const thisYear = now.getFullYear();
  const frag = document.createDocumentFragment();
  for (let y = thisYear; y >= 1920; y--) {
    const o = document.createElement("option");
    o.value = y;
    o.textContent = `${y}年`;
    frag.appendChild(o);
  }
  selYear.appendChild(frag);
  selYear.value = String(thisYear - 30);

  for (let m = 1; m <= 12; m++) {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = `${m}月`;
    selMonth.appendChild(o);
  }
  for (let d = 1; d <= 31; d++) {
    const o = document.createElement("option");
    o.value = d;
    o.textContent = `${d}日`;
    selDay.appendChild(o);
  }

  // 時刻と場所は任意。空を既定にする
  selHour.appendChild(new Option("時刻を選ばない", ""));
  for (let h = 0; h <= 23; h++) selHour.appendChild(new Option(`${h}時`, h));
  for (let mi = 0; mi <= 55; mi += 5) selMinute.appendChild(new Option(`${mi}分`, mi));
  selMinute.value = "0";

  selPref.appendChild(new Option("場所を選ばない", ""));
  PREFS.forEach(([name], i) => selPref.appendChild(new Option(name, i)));
}

/* ---------- 保存 ---------- */

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || !isValidDate(v.y, v.m, v.d)) return null;
    return v;  // hour / minute / pref は無いこともある(旧バージョンの保存)
  } catch (e) {
    return null;
  }
}

function save(v) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch (e) { /* 保存できなくても動作には影響しない */ }
}

function clearSaved() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
}

/* ---------- 描画 ---------- */

function stars(n) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function fmtDate(y, m, d) {
  return `${y}年${m}月${d}日`;
}

function buildProfileHtml(p) {
  const num = NUMEROLOGY[p.lifePath];
  const ks = KYUSEI[p.honmeisei];
  const zd = ZODIAC[p.zodiac];
  const wd = WEEKDAY[p.weekday];
  const mn = MOON[p.moonPhase];
  const bs = BIRTHSTONE[p.m];
  const rt = p.risshunTime;
  const risshunLabel = `${p.y}年は2月${rt.d}日 ${String(rt.hh).padStart(2, "0")}:${String(rt.mi).padStart(2, "0")}`;
  let etoNote = p.etoRisshun.label !== p.eto.label
    ? `<p class="item__note">※ 立春(${risshunLabel})より前の生まれなので、九星や四柱推命では前年の「${escapeHtml(p.etoRisshun.label)}(${escapeHtml(p.etoRisshun.yomi)})」として扱われます。</p>`
    : "";
  if (p.risshunAmbiguous) {
    etoNote += `<p class="item__note item__note--warn">※ 立春当日(${risshunLabel})生まれです。この日は<b>時刻によって九星と四柱推命の年が変わります</b>。正午とみなして計算しているので、生まれた時刻を入れ直すと正確になります。</p>`;
  }

  return `
    <div class="result-headline">
      <p class="result-headline__label">${escapeHtml(fmtDate(p.y, p.m, p.d))}生まれ(${p.age}歳)の</p>
      <p class="result-headline__value">ライフパスナンバー ${p.lifePath}</p>
      <p class="result-headline__sub">「${escapeHtml(num.key)}」</p>
    </div>

    <div class="item">
      <p class="item__text">${escapeHtml(num.text)}</p>
      <p class="item__line"><span>向いていること</span>${escapeHtml(num.good)}</p>
      <p class="item__line"><span>気をつけたいこと</span>${escapeHtml(num.care)}</p>
      ${p.lifePath >= 11 ? '<p class="item__note">※ 11・22・33は「マスターナンバー」と呼ばれ、1桁に還元せずそのまま読みます。</p>' : ""}
    </div>

    <div class="fgrid">
      <div class="item">
        <p class="item__head"><span class="badge">九星気学</span>${escapeHtml(ks.name)}<small>(${escapeHtml(ks.yomi)})</small></p>
        <p class="item__key">${escapeHtml(ks.key)}</p>
        <p class="item__text">${escapeHtml(ks.text)}</p>
      </div>
      <div class="item">
        <p class="item__head"><span class="badge">干支</span>${escapeHtml(p.eto.label)}<small>(${escapeHtml(p.eto.yomi)})</small></p>
        <p class="item__text">${escapeHtml(ETO_TEXT[p.eto.shiIndex].text)}</p>
        ${etoNote}
      </div>
      <div class="item">
        <p class="item__head"><span class="badge">星座</span>${escapeHtml(zd.name)}<small>(${escapeHtml(zd.elem)}のエレメント)</small></p>
        <p class="item__text">${escapeHtml(zd.text)}</p>
      </div>
      <div class="item">
        <p class="item__head"><span class="badge">生まれた曜日</span>${escapeHtml(wd.name)}</p>
        <p class="item__text">${escapeHtml(wd.text)}</p>
      </div>
      <div class="item">
        <p class="item__head"><span class="badge">生まれた日の月</span>${escapeHtml(mn.name)}<small>(月齢 ${p.moonAge.toFixed(1)})</small></p>
        <p class="item__text">${escapeHtml(mn.text)}</p>
      </div>
      <div class="item">
        <p class="item__head"><span class="badge">誕生石</span>${escapeHtml(bs.name)}</p>
        <p class="item__text">石言葉は「${escapeHtml(bs.word)}」。</p>
      </div>
    </div>
  `;
}

/* 年運・月運。九星の回座で決まる段階を主役にして、星と一言を添える */
function buildPeriodHtml(f, sub) {
  const pi = PALACE_INFO[f.palace];
  return `<div class="period">
    <p class="period__head"><span class="period__label">${escapeHtml(f.label)}</span>
      <span class="period__stars">${stars(f.overall)}</span></p>
    <p class="period__stage">${escapeHtml(pi.name)}<small>${escapeHtml(pi.palace)}・${escapeHtml(pi.key)}</small></p>
    <p class="period__text">${escapeHtml(pi.text)}</p>
    <p class="period__theme">${escapeHtml(f.theme)}</p>
    <div class="daily__rows">
      <p class="daily__row"><span>恋愛・人間関係</span><b>${stars(f.love)}</b></p>
      <p class="daily__row"><span>仕事・勉強</span><b>${stars(f.work)}</b></p>
      <p class="daily__row"><span>金運</span><b>${stars(f.money)}</b></p>
    </div>
    <p class="item__note">${escapeHtml(sub)}</p>
  </div>`;
}

function buildFlowHtml(yf, mf, honmeiName) {
  return `
    <p class="chart__lead">九星気学では、自分の星が毎年ひとつずつ盤の上を移っていき、<strong>9年でひと回り</strong>します。いま自分がその周期のどこにいるかは、計算で決まります。</p>
    ${buildPeriodHtml(yf, `${honmeiName}が${PALACE_INFO[yf.palace].palace}に回座。年の区切りは1月1日ではなく立春です。`)}
    ${buildPeriodHtml(mf, `月の区切りは節入り(立春・啓蟄など)です。`)}
  `;
}

function buildDailyHtml(f, today, extra) {
  const label = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  return `
    <p class="daily__date">${escapeHtml(label)}の運勢</p>
    <p class="daily__overall"><span class="daily__stars">${stars(f.overall)}</span></p>
    <p class="daily__msg">${escapeHtml(f.message)}</p>
    <div class="daily__rows">
      <p class="daily__row"><span>恋愛・人間関係</span><b>${stars(f.love)}</b></p>
      <p class="daily__row"><span>仕事・勉強</span><b>${stars(f.work)}</b></p>
      <p class="daily__row"><span>金運</span><b>${stars(f.money)}</b></p>
    </div>
    <div class="daily__lucky">
      <p><span>ラッキーナンバー</span><b>${f.luckyNumber}</b></p>
      <p><span>ラッキーカラー</span><b>${escapeHtml(f.luckyColor)}</b></p>
      <p><span>ラッキーアイテム</span><b>${escapeHtml(f.luckyItem)}</b></p>
    </div>
    <p class="daily__advice">${escapeHtml(f.advice)}</p>
    <p class="item__note">ここまでは生年月日と今日の日付から作った数で決めています。日付が変わると内容も変わり、同じ日のうちは何度見ても同じです。</p>
    ${extra}
  `;
}

/*
 * 今日の運勢のうち「計算で決まる」部分。
 * 上の星の数と違って、こちらは誰が出しても同じ答えになる。
 *   宿曜   … 本命宿から見た今日の宿(27日で一周)
 *   マヤ暦 … 今日のKINと、自分の紋章との関係(20日/260日で一周)
 *   四柱推命 … 今日の日干を自分の日主から見た通変星(10日で一周)
 *   暦注   … 六曜と吉日凶日
 */
function buildDailyCalcHtml(sk, mv, fp, p, today) {
  const ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate();
  const todayJdn = jdn(ty, tm, td);
  const blocks = [];

  /* 宿曜の日運 */
  const todayShuku = honmeiShukuByLunar(ty, tm, td);
  if (sk && sk.main && todayShuku) {
    const rel = sankuRelation(sk.main.index, todayShuku.index);
    blocks.push(`
      <div class="dk">
        <p class="dk__head">宿曜 <small>27日で一周</small></p>
        <p class="dk__val">今日は<b>${escapeHtml(todayShuku.name)}宿</b>。あなたの${escapeHtml(sk.main.name)}宿から見て<b>「${escapeHtml(rel.name)}」</b>の日</p>
        <p class="dk__text">${escapeHtml(SANKU_DAY_TEXT[rel.name])}</p>
      </div>`);
  }

  /* マヤ暦 */
  const dayMaya = dreamspellOf(ty, tm, td);
  const myKin = mv.dreamspell.kin;
  const myGlyphNo = (myKin - 1) % 20 + 1;
  const dayGlyphNo = (dayMaya.kin - 1) % 20 + 1;
  const grel = mayaGlyphRelation(myGlyphNo, dayGlyphNo);
  const nextKin = nextKinDate(myKin, ty, tm, td);
  const sameKin = dayMaya.kin === myKin;
  blocks.push(`
    <div class="dk">
      <p class="dk__head">マヤ暦 <small>260日で一周</small></p>
      <p class="dk__val">今日は<b>KIN${dayMaya.kin}「${escapeHtml(dayMaya.signature)}」</b></p>
      <p class="dk__text">${escapeHtml(MAYA_GLYPH_DAY[dayMaya.glyph])}</p>
      <p class="dk__text">音${dayMaya.toneNo}・${escapeHtml(dayMaya.tone)}は${escapeHtml(MAYA_TONE_TEXT[dayMaya.tone])}</p>
      ${sameKin
        ? `<p class="dk__text"><b>今日はあなたのKINそのものの日です。</b>260日に一度だけ回ってくる日で、マヤ暦での誕生日にあたります。</p>`
        : (grel ? `<p class="dk__text">あなたの${escapeHtml(mv.dreamspell.glyph)}から見て<b>${escapeHtml(grel)}</b>の紋章の日。${escapeHtml(MAYA_GLYPH_REL_TEXT[grel])}</p>` : "")}
      ${nextKin ? `<p class="dk__sub">あなたのKIN${myKin}が次にめぐるのは ${nextKin.y}年${nextKin.m}月${nextKin.d}日</p>` : ""}
    </div>`);

  /* 四柱推命の日運 */
  const dk = dayKoyomi(ty, tm, td);
  if (fp && fp.dayMaster !== null && fp.dayMaster !== undefined) {
    const god = tenGod(fp.dayMaster, dk.stem);
    blocks.push(`
      <div class="dk">
        <p class="dk__head">四柱推命 <small>10日で一周</small></p>
        <p class="dk__val">今日の日柱は<b>${escapeHtml(dk.eto)}</b>。あなたの日主 ${escapeHtml(KAN[fp.dayMaster])} から見て<b>「${escapeHtml(god)}」</b>の日</p>
        <p class="dk__text">${escapeHtml(TENGOD_INFO[god] || "")}</p>
      </div>`);
  }

  /* 暦注 */
  const goodTags = dk.good.map((t) => `<span class="dk__tag dk__tag--good">${escapeHtml(t)}</span>`).join("");
  const badTags = dk.bad.filter((t) => t !== "仏滅").map((t) => `<span class="dk__tag dk__tag--bad">${escapeHtml(t)}</span>`).join("");
  blocks.push(`
    <div class="dk">
      <p class="dk__head">今日の暦注</p>
      <p class="dk__val">六曜は<b>${escapeHtml(dk.rokuyo || "—")}</b>、十二直は<b>${escapeHtml(dk.junichoku)}</b>、旧暦${dk.lunar ? `${dk.lunar.leap ? "閏" : ""}${dk.lunar.num}月${dk.lunar.day}日` : "—"}</p>
      ${(goodTags || badTags) ? `<p class="dk__tags">${goodTags}${badTags}</p>` : '<p class="dk__text">名前のついた吉日・凶日はありません。</p>'}
      <p class="dk__sub"><a href="calendar/">吉日カレンダーで今月ぜんたいを見る</a></p>
    </div>`);

  /* 生まれてからの日数 */
  const born = jdn(p.y, p.m, p.d);
  const lived = todayJdn - born;
  let nextBd = jdn(ty, p.m, p.d);
  if (nextBd < todayJdn) nextBd = jdn(ty + 1, p.m, p.d);
  const toBd = nextBd - todayJdn;
  const nextRound = (Math.floor(lived / 1000) + 1) * 1000;
  blocks.push(`
    <div class="dk">
      <p class="dk__head">生まれてからの日数</p>
      <p class="dk__val">今日で<b>${lived.toLocaleString("ja-JP")}日目</b>${toBd === 0 ? " ・ <b>今日は誕生日です</b>" : ` ・ 次の誕生日まであと${toBd}日`}</p>
      <p class="dk__sub">${nextRound.toLocaleString("ja-JP")}日目は ${(() => { const t = jdnToDate(born + nextRound); return `${t.y}年${t.m}月${t.d}日`; })()}（あと${nextRound - lived}日）</p>
    </div>`);

  return `
    <div class="daily__calc">
      <p class="daily__calc-title">ここから下は計算で決まります</p>
      <p class="daily__calc-lead">同じ日なら誰が出しても同じ答えになる部分です。星の数のような当てものではなく、暦の上で今日がどういう日かを並べています。</p>
      ${blocks.join("")}
    </div>`;
}

function buildShareText(p, f, today, w, fp, sk, mv) {
  const num = NUMEROLOGY[p.lifePath];
  const label = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
  const pill = [fp.year, fp.month, fp.day, fp.hour]
    .filter(Boolean).map((x) => KAN[x.stem] + SHI[x.branch]).join(" ");
  const signOfKey = (k) => ZODIAC[w.positions.find((x) => x.key === k).sign].name;
  /* 今日ぶんの、計算で決まる部分 */
  const ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate();
  const tShuku = honmeiShukuByLunar(ty, tm, td);
  const tMaya = dreamspellOf(ty, tm, td);
  const tRel = (sk && sk.main && tShuku) ? sankuRelation(sk.main.index, tShuku.index).name : null;
  const todayCalc = `今日の宿曜 ${tShuku ? tShuku.name + "宿" : "—"}`
    + (tRel ? `(あなたから見て「${tRel}」の日)` : "")
    + ` / 今日のKIN${tMaya.kin}「${tMaya.signature}」`;
  return [
    `【生まれ日診断】${fmtDate(p.y, p.m, p.d)}生まれ`,
    `ライフパスナンバー ${p.lifePath}「${num.key}」`,
    `${KYUSEI[p.honmeisei].name} / ${p.eto.label} / ${WEEKDAY[p.weekday].name}生まれ / ${MOON[p.moonPhase].name}`,
    `西洋占星術 太陽:${signOfKey("sun")} 月:${signOfKey("moon")}${w.asc ? ` ASC:${ZODIAC[w.asc.sign].name}` : ""}`,
    `四柱推命 ${pill}(日主 ${KAN[fp.dayMaster]})`,
    `宿曜 ${sk && sk.main ? sk.main.name + "宿" : "—"} / マヤ暦 KIN${mv.dreamspell.kin}「${mv.dreamspell.signature}」`,
    ``,
    `${label}の運勢 ${stars(f.overall)}`,
    f.message,
    todayCalc,
    `ラッキーナンバー ${f.luckyNumber}・ラッキーカラー ${f.luckyColor}`,
    ``,
    `https://hakoniwalab.com/birthday-fortune/`,
  ].join("\n");
}

/* ---------- 西洋占星術(出生図) ---------- */

function buildWesternHtml(w) {
  const rows = w.positions.map((p) => {
    const info = PLANET_INFO[p.key];
    const zd = ZODIAC[p.sign];
    const mark = (p.key === "moon" && w.moonUncertain)
      ? ' <span class="chart__flag">この日は星座が変わります</span>' : "";
    return `
      <tr>
        <th><span class="chart__planet">${escapeHtml(info.name)}</span><small>${escapeHtml(info.label)}</small></th>
        <td><b>${escapeHtml(zd.name)}</b> <span class="chart__deg">${p.deg.toFixed(1)}度</span>${mark}
          <span class="chart__read">${escapeHtml(PLANET_SIGN[p.key][p.sign])}</span>
          <span class="chart__memo">${escapeHtml(info.text)}</span></td>
      </tr>`;
  }).join("");

  const ascRow = w.asc ? `
      <tr class="chart__row--asc">
        <th><span class="chart__planet">ASC</span><small>第一印象</small></th>
        <td><b>${escapeHtml(ZODIAC[w.asc.sign].name)}</b> <span class="chart__deg">${w.asc.deg.toFixed(1)}度</span>
          <span class="chart__memo">${escapeHtml(ASC_TEXT)}</span></td>
      </tr>
      <tr class="chart__row--asc">
        <th><span class="chart__planet">MC</span><small>社会での顔</small></th>
        <td><b>${escapeHtml(ZODIAC[w.mc.sign].name)}</b> <span class="chart__deg">${w.mc.deg.toFixed(1)}度</span>
          <span class="chart__memo">天頂の星座。仕事や、人から見られたい姿を表すとされます。</span></td>
      </tr>` : "";

  const total = w.positions.length;
  const bars = (arr, defs, max) => defs.map((def, i) => `
      <div class="bar">
        <span class="bar__name">${escapeHtml(def.name)}</span>
        <span class="bar__track"><span class="bar__fill" style="width:${Math.round(arr[i] / max * 100)}%"></span></span>
        <span class="bar__n">${arr[i]}</span>
        <span class="bar__memo">${escapeHtml(def.key || def.text)}</span>
      </div>`).join("");

  const strongest = ELEMENT4[w.elements.indexOf(Math.max(...w.elements))];
  const quality = QUALITY3[w.qualities.indexOf(Math.max(...w.qualities))];

  const notice = w.hasTime
    ? (w.asc ? "" : '<p class="item__note">生まれた場所も選ぶと、アセンダント(第一印象の星座)とMCが出せます。</p>')
    : '<p class="item__note item__note--warn">※ 生まれた時刻が未入力のため、<b>正午で計算</b>しています。月は1日で約13度動くので、月星座は隣になることがあります。アセンダントは出せません。</p>';

  return `
    <p class="chart__lead">生まれた瞬間に、空のどこに星があったか。よく言う「星座」は太陽の位置だけで、出生図はその一部にすぎません。</p>
    <div class="chart__scroll">
      <table class="chart__table">
        <tbody>${rows}${ascRow}</tbody>
      </table>
    </div>
    ${notice}
    <p class="chart__sub">エレメントの偏り</p>
    <div class="bars">${bars(w.elements, ELEMENT4, total)}</div>
    <p class="item__text">いちばん多いのは<b>${escapeHtml(strongest.name)}</b>(${escapeHtml(strongest.text)})、動き方は<b>${escapeHtml(quality.name)}</b>寄り(${escapeHtml(quality.text)})。</p>
    <p class="chart__sub">3区分(動き方)</p>
    <div class="bars">${bars(w.qualities, QUALITY3, total)}</div>
  `;
}

/* ---------- 四柱推命(命式) ---------- */

function pillarCell(p, label, god) {
  if (!p) {
    return `<td class="pil pil--empty"><span class="pil__label">${escapeHtml(label)}</span><span class="pil__none">—</span>
      <span class="pil__memo">時刻の入力が必要</span></td>`;
  }
  return `<td class="pil">
      <span class="pil__label">${escapeHtml(label)}</span>
      <span class="pil__kan">${escapeHtml(KAN[p.stem])}</span>
      <span class="pil__shi">${escapeHtml(SHI[p.branch])}</span>
      <span class="pil__memo">${escapeHtml(god || "")}</span>
    </td>`;
}

function buildSanmeiHtml(fp, hasTime, prefName) {
  const dm = KAN_INFO[fp.dayMaster];
  const total = fp.elements.reduce((a, b) => a + b, 0);
  const bars = fp.elements.map((n, i) => `
      <div class="bar">
        <span class="bar__name">${escapeHtml(GOGYO_INFO[i].name)}</span>
        <span class="bar__track"><span class="bar__fill" style="width:${Math.round(n / total * 100)}%"></span></span>
        <span class="bar__n">${n}</span>
        <span class="bar__memo">${escapeHtml(GOGYO_INFO[i].text)}</span>
      </div>`).join("");

  const missing = fp.elements.map((n, i) => (n === 0 ? GOGYO_INFO[i].name : null)).filter(Boolean);
  const missingText = missing.length
    ? `命式に<b>${escapeHtml(missing.join("・"))}</b>がありません。足りない働きは、意識して外から補うと良いとされます。`
    : "五行が5つともそろっています。かたよりの少ない命式です。";

  const localNote = fp.localShiftMin
    ? `<p class="item__note">※ ${escapeHtml(prefName)}は明石(東経135度)と${Math.abs(fp.localShiftMin)}分${fp.localShiftMin > 0 ? "進んで" : "遅れて"}いるため、その分を補正した地方時で時柱を出しています。</p>`
    : "";

  return `
    <p class="chart__lead">生まれた年・月・日・時を、それぞれ十干十二支の2文字で表したものが命式です。中心は<b>日柱の上の字(日干)</b>で、これがあなた自身を表します。</p>
    <div class="chart__scroll">
      <table class="pillars">
        <tbody><tr>
          ${pillarCell(fp.year, "年柱", fp.tenGods.year)}
          ${pillarCell(fp.month, "月柱", fp.tenGods.month)}
          ${pillarCell(fp.day, "日柱", "自分")}
          ${pillarCell(fp.hour, "時柱", fp.tenGods.hour)}
        </tr></tbody>
      </table>
    </div>
    ${hasTime ? "" : '<p class="item__note item__note--warn">※ 生まれた時刻が未入力のため<b>時柱は出せません</b>。年柱・月柱・日柱は時刻がなくても確定します。</p>'}
    ${localNote}

    <div class="item item--daymaster">
      <p class="item__head"><span class="badge badge--accent">日主</span>${escapeHtml(dm.name)}<small>(${escapeHtml(dm.yomi)}・${escapeHtml(dm.elem)})</small></p>
      <p class="item__key">イメージは「${escapeHtml(dm.image)}」</p>
      <p class="item__text">${escapeHtml(dm.text)}</p>
    </div>

    <div class="fgrid">
      <div class="item">
        <p class="item__head"><span class="badge">月柱の通変星</span>${escapeHtml(fp.tenGods.month)}</p>
        <p class="item__text">${escapeHtml(TENGOD_INFO[fp.tenGods.month])}。月柱は仕事や社会での立ち位置を表すとされ、命式の中でもっとも重く見ます。</p>
      </div>
      <div class="item">
        <p class="item__head"><span class="badge">十二運</span>${escapeHtml(fp.twelveFortune)}</p>
        <p class="item__text">${escapeHtml(TWELVE_INFO[fp.twelveFortune])}。日干から見た日支の勢いで、生まれつきの力の出方を表します。</p>
      </div>
      <div class="item">
        <p class="item__head"><span class="badge">空亡</span>${escapeHtml(SHI[fp.kubo[0]] + SHI[fp.kubo[1]])}</p>
        <p class="item__text">${escapeHtml(KUBO_TEXT)}</p>
      </div>
      <div class="item">
        <p class="item__head"><span class="badge">生まれた節</span>${escapeHtml(fp.sekki.name)}</p>
        <p class="item__text">${escapeHtml(`${fp.sekki.y}年${fp.sekki.m}月${fp.sekki.d}日 ${String(fp.sekki.hh).padStart(2, "0")}:${String(fp.sekki.mi).padStart(2, "0")}`)}に始まった「${escapeHtml(SHI[fp.month.branch])}月」の生まれです。四柱推命の月は暦の月ではなく、この節入りで切り替わります。</p>
      </div>
    </div>

    <p class="chart__sub">五行のバランス</p>
    <div class="bars">${bars}</div>
    <p class="item__text">${missingText}</p>
  `;
}

/* ---------- 宿曜占星術(二十七宿) ---------- */

function buildSukuyoHtml(s) {
  if (!s || !s.main) return '<p class="item__text">この年は旧暦の表を持っていないため、宿曜は出せません。</p>';
  const main = s.main;
  const l = main.lunar;
  const baseName = SHUKU27[SHUKU_MONTH_BASE[l.num - 1]][0];
  const gap = ((main.index - s.moon.index) % 27 + 27) % 27;
  const moonCell = s.agree
    ? `${escapeHtml(s.moon.name)}宿。この日は表と同じでした`
    : `<b>${escapeHtml(s.moon.name)}宿</b>。表より${gap}つ手前にいました`;
  return `
    <p class="chart__lead">生まれた日に、月が二十七の星宿のどこにいたか。インドで生まれ、密教とともに日本へ伝わった占いです。「宿曜経」という経典の名前が、そのまま呼び名になりました。</p>
    <div class="item">
      <p class="item__head">${escapeHtml(main.name)}宿 <small>${escapeHtml(main.yomi)}しゅく ・ 二十七宿の${main.index + 1}番目</small></p>
      <p class="item__text">${escapeHtml(SHUKU27_TEXT[main.name])}</p>
    </div>
    <div class="chart__scroll">
      <table class="chart__table">
        <tbody>
          <tr><th>旧暦の誕生日</th><td>${l.leap ? "閏" : ""}${l.num}月${l.day}日<span class="chart__memo">宿曜は新暦ではなく旧暦で数えます</span></td></tr>
          <tr><th>決まり方</th><td>旧暦${l.num}月の1日は${escapeHtml(baseName)}宿。そこから${l.day - 1}日進めて${escapeHtml(main.name)}宿<span class="chart__memo">満月の日が、その月の名前の由来になった宿に来るよう組まれた表です</span></td></tr>
          <tr><th>実際の月の位置</th><td>${moonCell}<span class="chart__memo">歳差を補正した恒星基準。インドのナクシャトラと同じ測り方です</span></td></tr>
        </tbody>
      </table>
    </div>
    <p class="item__note">本命宿は<b>表の方式</b>で出しています。市販の宿曜暦や、公開されている宿曜カレンダーと同じ方式です。表は千年以上前に組まれた形をそのまま使っているので実際の空とはずれていて、1950年から2030年までの29,220日で調べたところ<b>2つが一致するのは2.9%だけ</b>でした。実際の月は表より2つ手前が34.0%、3つ手前が32.7%です。</p>
  `;
}

/* ---------- マヤ暦 ---------- */

function buildMayaHtml(mv, y, m, d, todayJdn, drift) {
  const ds = mv.dreamspell;
  const cl = mv.classic;
  const next = calendarRoundNext(y, m, d, todayJdn);
  const leapNote = ds.isLeapDay
    ? `<p class="item__note item__note--warn">※ 2月29日はドリームスペルでは<b>数に入れない日</b>です。ここでは翌日と同じ KIN${ds.kin} にしていますが、前日と同じ KIN${ds.leapAlt} とする流儀もあります。</p>`
    : "";
  return `
    <p class="chart__lead">マヤ暦は天文計算をいっさい使いません。日数を数えて割るだけで出ます。日本で「マヤ暦占い」と呼ばれているものと、遺跡の碑文から復元された本来の暦は別物なので、両方を並べました。</p>
    <div class="kin">
      <span class="kin__no">KIN ${ds.kin}</span>
      <span class="kin__sig">${escapeHtml(ds.signature)}</span>
      <span class="kin__label">ドリームスペル(13の月の暦)</span>
    </div>
    <div class="chart__scroll">
      <table class="chart__table">
        <tbody>
          <tr><th>太陽の紋章</th><td><b>${escapeHtml(ds.glyph)}</b><span class="chart__memo">${escapeHtml(MAYA_GLYPH_TEXT[ds.glyph])}</span></td></tr>
          <tr><th>銀河の音</th><td><b>音${ds.toneNo}・${escapeHtml(ds.tone)}</b><span class="chart__memo">${escapeHtml(MAYA_TONE_TEXT[ds.tone])}</span></td></tr>
          <tr><th>色</th><td><b>${escapeHtml(ds.color)}</b><span class="chart__memo">${escapeHtml(MAYA_COLOR_TEXT[ds.color])}</span></td></tr>
          <tr><th>ウェイブスペル</th><td>${escapeHtml(ds.wave.glyph)}(KIN${ds.wave.startKin}から13日間)<span class="chart__memo">13日ごとのまとまり。その最初の日の紋章が、13日間ぜんたいのテーマになります</span></td></tr>
        </tbody>
      </table>
    </div>
    ${leapNote}
    <p class="chart__sub">伝統マヤだと</p>
    <div class="chart__scroll">
      <table class="chart__table">
        <tbody>
          <tr><th>長期暦</th><td><b>${cl.longCount.text}</b><span class="chart__memo">起点からの通算日数を、バクトゥン・カトゥン・トゥン・ウィナル・キンで表したもの。起点から${cl.longCount.days.toLocaleString("ja-JP")}日目です</span></td></tr>
          <tr><th>ツォルキン</th><td><b>${cl.tzolkin.num}${escapeHtml(cl.tzolkin.name)}</b>(260日の${cl.tzolkin.order}番目)<span class="chart__memo">1〜13の数と、20の日名の組み合わせ</span></td></tr>
          <tr><th>ハアブ</th><td><b>${cl.haab.day}${escapeHtml(cl.haab.month)}</b><span class="chart__memo">20日×18か月＋余りの5日で365日</span></td></tr>
          <tr><th>次に同じ日付が巡る日</th><td>${next.y}年${next.m}月${next.d}日<span class="chart__memo">ツォルキンとハアブの組み合わせは52年(18,980日)で一周します</span></td></tr>
        </tbody>
      </table>
    </div>
    <p class="item__note">ドリームスペルは<b>2月29日を数えません</b>。基準の1987年7月26日から今日までにうるう日が${drift}回あったので、途切れずに数え続ける伝統マヤとは<b>${drift}日ぶん離れて</b>います。どちらが正しいという話ではなく、別の暦だと考えるのが正確です。</p>
  `;
}

/* ---------- 世界の暦 ---------- */

function buildWorldHtml(wc, hasTime) {
  const h = wc.hebrew, i = wc.islamic, ind = wc.indian;
  return `
    <p class="chart__lead">同じ一日でも、暦が変われば日付は変わります。ここに出しているのは、すべて計算だけで求められるものです。</p>
    <div class="chart__scroll">
      <table class="chart__table">
        <tbody>
          <tr><th>ユダヤ暦</th><td><b>${h.year}年 ${escapeHtml(h.name)}月 ${h.day}日</b>${h.leapYear ? "(閏月のある年)" : ""}<span class="chart__memo">太陽太陰暦。新年が特定の曜日に来ないよう1〜2日ずらす規則まで含めて、すべて計算で決まります</span></td></tr>
          <tr><th>ヒジュラ暦</th><td><b>${i.year}年 ${escapeHtml(i.name)}月 ${i.day}日</b><span class="chart__memo">純粋な太陰暦で、季節とずれ続けます。ここでは計算式による暦を使っているので、新月を目で見て決める各国の暦とは1〜2日ずれます</span></td></tr>
          <tr><th>ナクシャトラ</th><td><b>${escapeHtml(ind.nakshatra)}</b>(第${ind.nakshatraNo}宿・宿曜の${escapeHtml(ind.nakshatraShuku)}宿)<span class="chart__memo">月がいた星宿。日本の二十七宿のもとになった区分です</span></td></tr>
          <tr><th>ティティ</th><td><b>${escapeHtml(ind.paksha)}の${ind.tithiInPaksha}日目</b><span class="chart__memo">月と太陽の角度を12度ずつ30に区切ったもの。白分は新月から満月へ、黒分は満月から新月へ向かう半月です</span></td></tr>
          <tr><th>インド占星術の星座</th><td>太陽 <b>${escapeHtml(ind.sunRashiJp)}座</b>(${escapeHtml(ind.sunRashi)}) ／ 月 <b>${escapeHtml(ind.moonRashiJp)}座</b>(${escapeHtml(ind.moonRashi)})<span class="chart__memo">恒星を基準にするので、西洋占星術の星座とは1つずれることがほとんどです</span></td></tr>
          <tr><th>ユリウス通日</th><td><b>${wc.jdn.toLocaleString("ja-JP")}</b><span class="chart__memo">紀元前4713年から数えた通し番号。暦を変換するときの共通のものさしで、このページの計算もすべてここを経由しています</span></td></tr>
        </tbody>
      </table>
    </div>
    ${hasTime ? "" : '<p class="item__note">※ ナクシャトラとティティは時刻で変わります。生まれた時刻が未入力のため<b>正午で計算</b>しています。</p>'}
  `;
}

function render(v) {
  const { y, m, d } = v;
  const hasTime = v.hour !== null && v.hour !== undefined && v.hour !== "";
  const hour = hasTime ? Number(v.hour) : null;
  const minute = hasTime ? Number(v.minute || 0) : 0;
  const hasPref = v.pref !== null && v.pref !== undefined && v.pref !== "";
  const pref = hasPref ? PREFS[Number(v.pref)] : null;
  const place = pref ? { lat: pref[1], lon: pref[2] } : null;

  const today = new Date();
  const p = buildProfile(y, m, d, today, hour, minute);
  const f = dailyFortune(y, m, d, today, DAILY_POOLS);
  const w = westernChart(y, m, d, hour, minute, place);
  const fp = fourPillars(y, m, d, hour, minute, pref ? pref[2] : null);

  // 年運・月運。どちらも立春・節入りで区切るので、今日の節月から年と月を取る
  const ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate();
  const nowSolar = solarMonthOf(ty, tm, td, 12, 0);
  const fYear = nowSolar.yearForPillar;
  const fYearBranch = ((fYear - 4) % 12 + 12) % 12;
  const monthLabel = `${SHI[nowSolar.branch]}月(${nowSolar.sekki.m}/${nowSolar.sekki.d} ${nowSolar.sekki.name}から)`;
  const yf = yearlyFortune(y, m, d, fYear, PERIOD_POOLS);
  const mf = monthlyFortune(y, m, d, fYear, fYearBranch, nowSolar.branch, monthLabel, PERIOD_POOLS);

  const sk = sukuyoOf(y, m, d, hour, minute);
  const mv = mayaOf(y, m, d);
  const wc = worldCalendarsOf(y, m, d, hour, minute);

  resultBody.innerHTML = buildProfileHtml(p);
  westernBody.innerHTML = buildWesternHtml(w);
  sanmeiBody.innerHTML = buildSanmeiHtml(fp, hasTime, pref ? pref[0] : "");
  sukuyoBody.innerHTML = buildSukuyoHtml(sk);
  mayaBody.innerHTML = buildMayaHtml(mv, y, m, d, jdn(ty, tm, td), dreamspellDrift(ty, tm, td));
  worldBody.innerHTML = buildWorldHtml(wc, hasTime);
  dailyBody.innerHTML = buildDailyHtml(f, today, buildDailyCalcHtml(sk, mv, fp, p, today));
  flowBody.innerHTML = buildFlowHtml(yf, mf, KYUSEI[p.honmeisei].name);
  shareText = buildShareText(p, f, today, w, fp, sk, mv);
  introSection.hidden = true;
  resultSection.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- イベント ---------- */

function currentInput() {
  return {
    y: Number(selYear.value),
    m: Number(selMonth.value),
    d: Number(selDay.value),
    hour: selHour.value === "" ? null : Number(selHour.value),
    minute: Number(selMinute.value || 0),
    pref: selPref.value === "" ? null : Number(selPref.value),
  };
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = currentInput();
  const { y, m, d } = v;
  if (!isValidDate(y, m, d)) {
    formError.hidden = false;
    formError.textContent = `${y}年${m}月${d}日は存在しない日付です。`;
    return;
  }
  const now = new Date();
  if (new Date(y, m - 1, d) > now) {
    formError.hidden = false;
    formError.textContent = "未来の日付は入力できません。";
    return;
  }
  formError.hidden = true;
  save(v);
  render(v);
});

btnCopy.addEventListener("click", async () => {
  // 共有APIはクリック直後にしか呼べないので、ここで分岐する
  if (navigator.share) {
    try {
      await navigator.share({ text: shareText });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return; // ユーザーがキャンセル
    }
  }
  try {
    await navigator.clipboard.writeText(shareText);
    btnCopy.textContent = "コピーしました";
    setTimeout(() => { btnCopy.textContent = "結果をシェア・コピー"; }, 2000);
  } catch (err) {
    btnCopy.textContent = "コピーに失敗しました";
  }
});

btnRestart.addEventListener("click", () => {
  clearSaved();
  resultSection.hidden = true;
  introSection.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------- 起動 ---------- */

fillSelects();
const saved = loadSaved();
if (saved) {
  selYear.value = String(saved.y);
  selMonth.value = String(saved.m);
  selDay.value = String(saved.d);
  // 時刻・場所は旧バージョンの保存には無いので、あるときだけ戻す
  if (saved.hour !== null && saved.hour !== undefined) {
    selHour.value = String(saved.hour);
    selMinute.value = String(saved.minute || 0);
  }
  if (saved.pref !== null && saved.pref !== undefined) selPref.value = String(saved.pref);
  render(saved);
}
