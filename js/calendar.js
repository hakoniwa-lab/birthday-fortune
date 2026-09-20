/*
 * 吉日カレンダーの画面。
 *   暦の計算 … koyomi.js(旧暦・暦注)、holiday.js(祝日)、season72.js(七十二候)
 *   占いの計算 … sukuyo.js(宿曜)、maya.js(マヤ暦)
 * 表示している月だけを計算する。astro.js 側にキャッシュがあるので月送りは速い。
 *
 * 生まれ日診断で入力した生年月日が端末に保存されていれば、それを読んで
 * 「あなたの吉日」(宿曜の栄・親・命の日、自分のKIN・紋章の日)に印をつける。
 */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];

/* 月相はセルが狭いので記号だけ出す */
const MOON_MARK = { 新月: "●", 上弦: "◐", 満月: "○", 下弦: "◑" };

const grid = document.getElementById("calgrid");
const calTitle = document.getElementById("cal-title");
const detail = document.getElementById("detail");
const detailBody = document.getElementById("detail-body");
const goodList = document.getElementById("goodlist");
const listTitle = document.getElementById("list-title");
const meNote = document.getElementById("me-note");
const searchForm = document.getElementById("search-form");
const searchResult = document.getElementById("search-result");

const today = new Date();
let viewY = today.getFullYear();
let viewM = today.getMonth() + 1;
let days = [];
let selected = null;

/* ---------- 表示の設定(端末内に保存) ---------- */

const SETTINGS_KEY = "birthday-fortune:calendar-settings";
const setByDay = document.getElementById("set-byday");
const setShuku = document.getElementById("set-shuku");
const setMaya = document.getElementById("set-maya");
const setMe = document.getElementById("set-me");
const setKoDays = document.getElementById("set-kodays");

function loadSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (v && typeof v === "object") {
      if (typeof v.sekkiByDay === "boolean") setByDay.checked = v.sekkiByDay;
      if (typeof v.showShuku === "boolean") setShuku.checked = v.showShuku;
      if (typeof v.showMaya === "boolean") setMaya.checked = v.showMaya;
      if (typeof v.showMe === "boolean") setMe.checked = v.showMe;
      if (typeof v.ko72ByDays === "boolean") setKoDays.checked = v.ko72ByDays;
    }
  } catch (e) { /* 読めなければ既定のまま */ }
  applySettings();
}

function applySettings() {
  setKoyomiSettings({ sekkiByDay: setByDay.checked, showShuku: setShuku.checked });
  setKo72Mode(setKoDays.checked);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      sekkiByDay: setByDay.checked,
      showShuku: setShuku.checked,
      showMaya: setMaya.checked,
      showMe: setMe.checked,
      ko72ByDays: setKoDays.checked,
    }));
  } catch (e) { /* noop */ }
}

/* ---------- あなたの生年月日(生まれ日診断で保存したもの) ---------- */

const BIRTH_KEY = "birthday-fortune:birth";

function loadMe() {
  try {
    const v = JSON.parse(localStorage.getItem(BIRTH_KEY) || "null");
    if (!v || !v.y || !v.m || !v.d) return null;
    const shuku = honmeiShukuByLunar(Number(v.y), Number(v.m), Number(v.d));
    if (!shuku) return null;
    const ds = dreamspellOf(Number(v.y), Number(v.m), Number(v.d));
    return {
      y: Number(v.y), m: Number(v.m), d: Number(v.d),
      shuku, kin: ds.kin, glyph: ds.glyph, glyphNo: (ds.kin - 1) % 20 + 1, signature: ds.signature,
    };
  } catch (e) {
    return null;
  }
}

const me = loadMe();

function renderMeNote() {
  if (me) {
    meNote.innerHTML = `生まれ日診断で入力した <b>${me.y}年${me.m}月${me.d}日</b>(${escapeHtml(me.shuku.name)}宿・KIN${me.kin})をもとに、宿曜で「栄」「親」「命」になる日と、あなたのKIN・紋章の日に印をつけます。`;
    setMe.disabled = false;
  } else {
    meNote.innerHTML = 'この端末にはまだ生年月日が保存されていません。<a href="../">生まれ日診断</a>で生年月日を入れると使えるようになります。';
    setMe.checked = false;
    setMe.disabled = true;
  }
}

/* ---------- 日ごとの追加の計算 ---------- */

/* monthKoyomi の結果に、祝日・マヤ暦・七十二候・あなたとの関係を足す */
function enrich(k) {
  k.holiday = holidayOf(k.y, k.m, k.d);
  k.maya = dreamspellOf(k.y, k.m, k.d);
  k.ko72Start = ko72StartOn(k.y, k.dayIdx);
  /* 宿曜の宿(二十七宿)。旧暦の表で決まる。二十八宿(k.shuku)とは別物 */
  k.sukuyoIdx = k.lunar ? (SHUKU_MONTH_BASE[k.lunar.num - 1] + k.lunar.day - 1) % 27 : null;
  k.mine = null;
  if (me && k.sukuyoIdx !== null) {
    const rel = sankuRelation(me.shuku.index, k.sukuyoIdx);
    const dayGlyphNo = (k.maya.kin - 1) % 20 + 1;
    const kinDay = k.maya.kin === me.kin;
    k.mine = {
      rel,
      sukuyoGood: rel.name === "栄" || rel.name === "親",
      own: rel.name === "命",
      kinDay,
      glyphDay: !kinDay && dayGlyphNo === me.glyphNo,
      glyphRel: kinDay ? null : mayaGlyphRelation(me.glyphNo, dayGlyphNo),
    };
    k.mine.any = k.mine.sukuyoGood || k.mine.own || k.mine.kinDay || k.mine.glyphDay;
  }
  return k;
}

function monthDays(y, m) {
  return monthKoyomi(y, m).map(enrich);
}

/* ---------- 日ごとの見た目 ---------- */

/*
 * 天赦日と一粒万倍日が重なる日は、暦の上でもっとも良いとされる。
 * 年に1〜2回しかないので、見つけたら目立たせる。
 */
function rank(k) {
  if (k.flags.tensha && k.flags.ichiryu) return "best";
  if (k.good.length && !k.bad.length) return "good";
  if (k.good.length && k.bad.length) return "mixed";
  if (k.bad.length) return "bad";
  return "";
}

/* セルに出す短い印。狭いので2つまで */
function badges(k) {
  const b = [];
  if (k.flags.tensha) b.push({ c: "b-tensha", t: "天赦" });
  if (k.flags.ichiryu) b.push({ c: "b-ichiryu", t: "一粒" });
  if (b.length < 2 && k.flags.tsuchinotoMi) b.push({ c: "b-mi", t: "己巳" });
  if (b.length < 2 && k.flags.kinoeNe) b.push({ c: "b-mi", t: "甲子" });
  if (b.length < 2 && k.flags.tora) b.push({ c: "b-tora", t: "寅" });
  if (b.length < 2 && k.flags.mi) b.push({ c: "b-mi", t: "巳" });
  // 仏滅は六曜の行にすでに出ているので、バッジには入れない(同じ日に2回出てしまう)
  const otherBad = k.bad.filter((x) => x !== "仏滅");
  if (b.length < 2 && otherBad.length) b.push({ c: "b-bad", t: otherBad[0].slice(0, 3) });
  return b.slice(0, 2);
}

/* セルは幅が狭い(スマホで1マス約45px)ので、祝日名は「の日」を落とす */
function shortHoliday(name) {
  if (name === "国民の休日") return "休日";
  return name.replace("の行われる日", "").replace(/の日$/, "");
}

/* あなたの吉日の印。いちばん強いものを1つだけ。2桁の日付に重ならないよう1文字にする */
function meMark(mine) {
  if (mine.kinDay) return { t: "K", title: "あなたのKINの日(260日に一度)" };
  if (mine.sukuyoGood) return { t: mine.rel.name, title: `宿曜で「${mine.rel.name}」の日` };
  if (mine.own) return { t: "命", title: "宿曜で自分の宿の日(命)" };
  if (mine.glyphDay) return { t: "紋", title: "あなたの紋章の日(20日に一度)" };
  return null;
}

/* ---------- カレンダーを描く ---------- */

function render() {
  days = monthDays(viewY, viewM);
  calTitle.textContent = `${viewY}年${viewM}月`;

  const firstWd = new Date(viewY, viewM - 1, 1).getDay();
  const cells = [];

  for (const w of WD) {
    const cls = w === "日" ? " calhead--sun" : (w === "土" ? " calhead--sat" : "");
    cells.push(`<div class="calhead${cls}">${w}</div>`);
  }
  for (let i = 0; i < firstWd; i++) cells.push('<div class="calcell calcell--empty"></div>');

  for (const k of days) {
    const isToday = k.y === today.getFullYear() && k.m === today.getMonth() + 1 && k.d === today.getDate();
    const r = rank(k);
    const cls = [
      "calcell",
      r ? "is-" + r : "",
      isToday ? "is-today" : "",
      k.weekday === 0 ? "is-sun" : "",
      k.weekday === 6 ? "is-sat" : "",
      k.holiday ? "is-holiday" : "",
    ].filter(Boolean).join(" ");
    const bd = badges(k).map((x) => `<span class="bdg ${x.c}">${escapeHtml(x.t)}</span>`).join("");
    const shuku = setShuku.checked ? `<span class="calcell__s${k.shuku === "鬼" ? " is-oni" : ""}">${escapeHtml(k.shuku)}</span>` : "";
    const kin = setMaya.checked ? `<span class="calcell__k">K${k.maya.kin}</span>` : "";
    // 祝日があればいちばん優先。次に二十四節気、行事、雑節
    const zLabel = (() => {
      if (k.holiday) return "";
      if (k.sekki24) return k.sekki24.name;
      if (k.events.length) return k.events[0].name.replace("の節句", "");
      if (k.doyoUshi) return "丑の日";
      const one = k.zassetsu.find((z) => !z.span) || k.zassetsu.find((z) => z.span && z.start === k.dayIdx);
      if (!one) return "";
      return one.name.replace(/^(春|夏|秋|冬)の/, "").replace("土用", "土用入").replace("彼岸", "彼岸入");
    })();
    const zCls = k.sekki24 ? "calcell__z is-sekki" : "calcell__z";
    const zHtml = zLabel ? `<span class="${zCls}">${escapeHtml(zLabel)}</span>` : "";
    const hHtml = k.holiday ? `<span class="calcell__h" title="${escapeHtml(k.holiday)}">${escapeHtml(shortHoliday(k.holiday))}</span>` : "";
    const moonHtml = k.moonPhaseName ? `<span class="calcell__moon">${MOON_MARK[k.moonPhaseName]}</span>` : "";
    const mark = setMe.checked && k.mine && k.mine.any ? meMark(k.mine) : null;
    const meHtml = mark ? `<span class="calcell__me" title="${escapeHtml(mark.title)}">${escapeHtml(mark.t)}</span>` : "";
    cells.push(`<button type="button" class="${cls}${mark ? " has-me" : ""}" data-d="${k.d}">
      ${meHtml}
      <span class="calcell__d">${k.d}</span>
      <span class="calcell__r">${escapeHtml(k.rokuyo || "")}</span>
      ${hHtml}${shuku}${kin}
      <span class="calcell__b">${bd}</span>
      ${zHtml}${moonHtml}
    </button>`);
  }

  grid.innerHTML = cells.join("");
  renderGoodList();

  // 今月を開いたときは今日を、それ以外は1日を選んでおく
  const pick = days.find((k) => k.d === (
    viewY === today.getFullYear() && viewM === today.getMonth() + 1 ? today.getDate() : 1
  ));
  if (pick) select(pick.d);
}

/* ---------- 日の詳細 ---------- */

function select(d) {
  const k = days.find((x) => x.d === d);
  if (!k) return;
  selected = d;
  grid.querySelectorAll(".calcell").forEach((el) => {
    el.classList.toggle("is-selected", Number(el.dataset.d) === d);
  });

  const lunarLabel = k.lunar
    ? `旧暦 ${k.lunar.leap ? "閏" : ""}${k.lunar.num}月${k.lunar.day}日`
    : "";
  const sekkiLabel = `${k.sekki.name}(${k.sekki.m}月${k.sekki.d}日)から始まる${SHI[k.sekki.branch]}月`;
  const ko = ko72On(k.y, k.m, k.d);

  const holidayHtml = k.holiday
    ? `<div class="tags"><span class="tag tag--holiday">${escapeHtml(k.holiday)}</span></div>`
    : "";
  const goodHtml = k.good.length
    ? `<div class="tags">${k.good.map((g) => `<span class="tag tag--good">${escapeHtml(g)}</span>`).join("")}</div>`
    : '<p class="muted">とくに吉日とされる日ではありません。</p>';
  const badHtml = k.bad.length
    ? `<div class="tags">${k.bad.map((g) => `<span class="tag tag--bad">${escapeHtml(g)}</span>`).join("")}</div>`
    : "";
  const seasonNames = [
    ...(k.sekki24 ? [k.sekki24.name] : []),
    ...(k.ko72Start ? [k.ko72Start.name] : []),
    ...k.events.map((e) => e.name),
    ...k.zassetsu.map((z) => z.name),
    ...(k.doyoUshi ? ["土用の丑の日"] : []),
    ...(k.moonPhaseName ? [k.moonPhaseName] : []),
  ];
  const zTags = seasonNames.length
    ? `<div class="tags">${seasonNames.map((n) => `<span class="tag tag--season">${escapeHtml(n)}</span>`).join("")}</div>`
    : "";
  const senTags = k.senjitsu.length
    ? `<div class="tags">${k.senjitsu.map((n) => `<span class="tag tag--sen">${escapeHtml(n)}</span>`).join("")}</div>`
    : "";

  const notes = [];
  if (k.holiday) notes.push(`<strong>${escapeHtml(k.holiday)}。</strong>${escapeHtml(HOLIDAY_TEXT[k.holiday] || "")}`);
  if (k.flags.tensha && k.flags.ichiryu) {
    notes.push("<strong>天赦日と一粒万倍日が重なる日です。</strong>暦の上でもっとも良いとされ、年に1〜2回しかありません。");
  } else if (k.flags.tensha) {
    notes.push("<strong>天赦日。</strong>年に5〜6回しかない、暦の上でいちばん良いとされる日です。");
  }
  if (k.flags.ichiryu && !k.flags.tensha) {
    notes.push("<strong>一粒万倍日。</strong>始めたことが大きく育つとされます。ただし借金だけは避けるとされる日です。");
  }
  if (k.flags.tsuchinotoMi) notes.push("<strong>己巳の日。</strong>60日に一度の、巳の日の中でも特別な金運の日とされます。");
  else if (k.flags.tora) notes.push("<strong>寅の日。</strong>出ていったお金が戻るとされ、財布の新調や旅行に良いとされます。");
  if (k.flags.kinoeNe) notes.push("<strong>甲子の日。</strong>大黒天に縁のある60日に一度の日。干支の最初の組み合わせで、始まりに良いとされます。");
  if (setShuku.checked && k.shuku === "鬼") notes.push("<strong>鬼宿日。</strong>二十八宿でもっとも良いとされる日です(婚礼だけは避けるとされます)。");
  if (k.sekki24) {
    notes.push(`<strong>${escapeHtml(k.sekki24.name)}(${k.sekki24.hh}時${String(k.sekki24.mi).padStart(2, "0")}分)。</strong>${escapeHtml(SEKKI24_TEXT[k.sekki24.name] || "")}`);
  }
  if (k.ko72Start) {
    notes.push(`<strong>今日から七十二候の「${escapeHtml(k.ko72Start.name)}」。</strong>${escapeHtml(k.ko72Start.meaning)}ころ。`);
  }
  for (const e of k.events) notes.push(`<strong>${escapeHtml(e.name)}。</strong>${escapeHtml(e.text)}`);
  if (k.moonPhaseName) notes.push(`<strong>${escapeHtml(k.moonPhaseName)}。</strong>${escapeHtml(MOON_PHASE_TEXT[k.moonPhaseName] || "")}`);
  for (const n of k.senjitsu) notes.push(`<strong>${escapeHtml(n)}。</strong>${escapeHtml(SENJITSU_TEXT[n] || "")}`);
  if (k.flags.tenOn) notes.push("<strong>天恩日。</strong>天の恩恵をすべての人が受ける日。祝い事に良く、凶事には向かないとされます。");
  if (k.flags.boso) notes.push("<strong>母倉日。</strong>天が人を慈しむ日。結婚・建築に良いとされます。");
  for (const g of k.gedan) notes.push(`<strong>${escapeHtml(g)}。</strong>${escapeHtml(GEDAN_TEXT[g] || "")}。`);
  notes.push(`<strong>十二天神は${escapeHtml(k.tenshin)}。</strong>${escapeHtml(TENSHIN_TEXT[k.tenshin] || "")}。中国の択日(通書)で使う十二神です。`);
  if (k.saijitsu) notes.push(`<strong>${escapeHtml(k.saijitsu)}。</strong>${k.saijitsu === "六斎日" ? "仏教で身をつつしむとされる月6日のうちの1日(旧暦8・14・15・23・29・30日)" : "六斎日に4日を足した十斎日のうちの1日(旧暦1・18・24・28日)"}です。`);
  notes.push(`<strong>彭祖百忌では${escapeHtml(k.pengzu[0][0])}・${escapeHtml(k.pengzu[1][0])}。</strong>この日は${escapeHtml(k.pengzu[0][1])}、${escapeHtml(k.pengzu[1][1])}、と昔の暦にあります。`);
  if (k.doyoUshi) notes.push("<strong>土用の丑の日。</strong>夏の土用の期間の丑の日。うなぎを食べる習慣で知られます。");
  for (const z of k.zassetsu) {
    const span = z.span ? `(${(() => { const a = jdToJstParts(z.start - 0.375), b = jdToJstParts(z.end - 0.375); return `${a.m}/${a.d}〜${b.m}/${b.d}`; })()})` : "";
    notes.push(`<strong>${escapeHtml(z.name)}${span}。</strong>${escapeHtml(z.text)}`);
  }
  if (k.flags.fujoju) notes.push("<strong>不成就日。</strong>何を始めても成就しないとされる日です。");
  if (k.flags.sanrinbo) notes.push("<strong>三隣亡。</strong>建築・棟上げで避けられる日です。");

  /* あなたにとってのこの日 */
  let meHtml = "";
  if (setMe.checked && k.mine) {
    const m = k.mine;
    const lines = [
      `<p class="detail__me-line"><span>宿曜</span><b>この日は${escapeHtml(SHUKU27[k.sukuyoIdx][0])}宿。あなたの${escapeHtml(me.shuku.name)}宿から見て「${escapeHtml(m.rel.name)}」の日</b></p>`,
      `<p class="detail__memo">${escapeHtml(SANKU_DAY_TEXT[m.rel.name])}</p>`,
    ];
    if (m.kinDay) {
      lines.push('<p class="detail__me-line"><span>マヤ暦</span><b>あなたのKINそのものの日(260日に一度)</b></p>');
    } else if (m.glyphRel) {
      lines.push(`<p class="detail__me-line"><span>マヤ暦</span><b>あなたの${escapeHtml(me.glyph)}から見て${escapeHtml(m.glyphRel)}の紋章の日</b></p>`);
      lines.push(`<p class="detail__memo">${escapeHtml(MAYA_GLYPH_REL_TEXT[m.glyphRel])}</p>`);
    }
    meHtml = `<div class="detail__me">
      <p class="detail__me-title">あなたにとってのこの日</p>
      ${lines.join("")}
    </div>`;
  }

  detailBody.innerHTML = `
    <p class="detail__date">${k.m}月${k.d}日<span>(${WD[k.weekday]})</span></p>
    ${holidayHtml}
    ${goodHtml}
    ${badHtml}
    ${zTags}
    ${senTags}
    ${meHtml}
    <div class="detail__rows">
      <p class="detail__row"><span>六曜</span><b>${escapeHtml(k.rokuyo || "-")}</b></p>
      <p class="detail__row"><span>十二直</span><b>${escapeHtml(k.junichoku)}</b></p>
      <p class="detail__row"><span>十二天神</span><b>${escapeHtml(k.tenshin)}</b>${k.tenshinGood ? "(黄道)" : "(黒道)"}</p>
      <p class="detail__row"><span>日家九星</span><b>${escapeHtml(KYUSEI_NAME[k.kyusei.star - 1])}</b>${k.kyusei.yoton ? "(陽遁)" : "(陰遁)"}</p>
      ${setShuku.checked ? `<p class="detail__row"><span>二十八宿</span><b>${escapeHtml(k.shuku)}宿</b></p>` : ""}
      <p class="detail__row"><span>日の干支</span><b>${escapeHtml(k.eto)}</b></p>
      <p class="detail__row"><span>旧暦</span><b>${escapeHtml(lunarLabel)}</b></p>
      <p class="detail__row"><span>節月</span><b>${escapeHtml(sekkiLabel)}</b></p>
      ${ko ? `<p class="detail__row"><span>七十二候</span><b>${escapeHtml(ko.name)}(${escapeHtml(ko.yomi)})</b></p>` : ""}
      <p class="detail__row"><span>マヤ暦</span><b>KIN${k.maya.kin} ${escapeHtml(k.maya.signature)}</b></p>
    </div>
    <p class="detail__memo">${escapeHtml(ROKUYO_TEXT[k.rokuyo] || "")}</p>
    <p class="detail__memo">${escapeHtml(k.junichoku)}${k.flags.geppa ? "(月破大耗)" : ""}: ${escapeHtml(JUNICHOKU_TEXT[k.junichoku] || "")}</p>
    ${setShuku.checked ? `<p class="detail__memo">${escapeHtml(k.shuku)}宿: ${escapeHtml(SHUKU_TEXT[k.shuku] || "")}</p>` : ""}
    ${ko ? `<p class="detail__memo">${escapeHtml(ko.name)}: ${escapeHtml(ko.sekki)}の${escapeHtml(ko.part)}。${escapeHtml(ko.meaning)}ころ(${ko.m}月${ko.d}日から)</p>` : ""}
    <p class="detail__memo">KIN${k.maya.kin}: ${escapeHtml(MAYA_GLYPH_DAY[k.maya.glyph] || "")}</p>
    ${notes.length ? `<ul class="detail__notes">${notes.map((n) => `<li>${n}</li>`).join("")}</ul>` : ""}
  `;
  detail.hidden = false;
}

/* ---------- 月内の吉日まとめ ---------- */

function dayChips(list, extraCls) {
  return list.map((k) => (
    `<button type="button" class="daychip${extraCls ? " " + extraCls : ""}" data-d="${k.d}">${k.d}日<small>${WD[k.weekday]}</small></button>`
  )).join("");
}

function renderGoodList() {
  listTitle.textContent = `${viewY}年${viewM}月の吉日`;
  const kinds = [
    { key: "tensha", name: "天赦日", memo: "年に5〜6回。暦の上でいちばん良いとされる日" },
    { key: "ichiryu", name: "一粒万倍日", memo: "始めたことが大きく育つとされる日" },
    { key: "tsuchinotoMi", name: "己巳の日", memo: "60日に一度。弁財天の日、金運に良いとされる" },
    { key: "kinoeNe", name: "甲子の日", memo: "60日に一度。大黒天の日、始まりに良いとされる" },
    { key: "tenOn", name: "天恩日", memo: "天の恩恵を受ける日。祝い事に良いとされる" },
    { key: "boso", name: "母倉日", memo: "天が人を慈しむ日。結婚・建築に良いとされる" },
    { key: "tsukitoku", name: "月徳日", memo: "その月の福を司る日。家の修理や土を動かすことに良いとされる" },
    { key: "tora", name: "寅の日", memo: "出ていったお金が戻るとされる日" },
    { key: "mi", name: "巳の日", memo: "弁財天に縁のある、金運の日" },
  ];

  let html = "";

  /* あなたの吉日 */
  if (setMe.checked && me) {
    const good = days.filter((k) => k.mine && k.mine.sukuyoGood);
    const own = days.filter((k) => k.mine && k.mine.own);
    const kin = days.filter((k) => k.mine && k.mine.kinDay);
    const glyph = days.filter((k) => k.mine && k.mine.glyphDay);
    const rows = [];
    if (good.length) rows.push(`<p class="glist__sub">宿曜で「栄」「親」の日</p><p class="glist__days">${dayChips(good, "daychip--me")}</p>`);
    if (own.length) rows.push(`<p class="glist__sub">宿曜で自分の宿の日(命)</p><p class="glist__days">${dayChips(own, "daychip--me")}</p>`);
    if (kin.length) rows.push(`<p class="glist__sub">あなたのKIN${me.kin}の日</p><p class="glist__days">${dayChips(kin, "daychip--me")}</p>`);
    if (glyph.length) rows.push(`<p class="glist__sub">あなたの紋章(${escapeHtml(me.glyph)})の日</p><p class="glist__days">${dayChips(glyph, "daychip--me")}</p>`);
    if (rows.length) {
      html += `<div class="glist glist--me">
        <p class="glist__name">あなたの吉日<small>${me.y}年${me.m}月${me.d}日生まれ(${escapeHtml(me.shuku.name)}宿・KIN${me.kin})から計算</small></p>
        ${rows.join("")}
      </div>`;
    }
  }

  const best = days.filter((k) => k.flags.tensha && k.flags.ichiryu);
  if (best.length) {
    html += `<p class="best-line"><span class="chip chip--best">最強</span>
      ${best.map((k) => `${k.m}月${k.d}日(${WD[k.weekday]})`).join("、")}
      — 天赦日と一粒万倍日が重なります</p>`;
  }

  html += kinds.map((kd) => {
    const hit = days.filter((k) => k.flags[kd.key]);
    // 己巳の日は巳の日にも含まれるので、巳の行からは外す
    const list = kd.key === "mi" ? hit.filter((k) => !k.flags.tsuchinotoMi) : hit;
    if (!list.length) return "";
    return `<div class="glist">
      <p class="glist__name">${escapeHtml(kd.name)}<small>${escapeHtml(kd.memo)}</small></p>
      <p class="glist__days">${dayChips(list)}</p>
    </div>`;
  }).join("");

  // 祝日
  const holidayRows = days.filter((k) => k.holiday).map((k) => `${k.holiday}: ${k.m}/${k.d}(${WD[k.weekday]})`);
  if (holidayRows.length) {
    html += `<div class="glist">
      <p class="glist__name">祝日・休日<small>祝日法の規則から計算。振替休日と国民の休日も含みます</small></p>
      <p class="glist__zs">${holidayRows.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</p>
    </div>`;
  }

  // 二十四節気・七十二候・行事・月相
  const sekkiRows = days.filter((k) => k.sekki24)
    .map((k) => `${k.sekki24.name}: ${k.m}/${k.d} ${k.sekki24.hh}:${String(k.sekki24.mi).padStart(2, "0")}`);
  if (sekkiRows.length) {
    html += `<div class="glist">
      <p class="glist__name">二十四節気<small>太陽の黄経が15度進むごとの区切り</small></p>
      <p class="glist__zs">${sekkiRows.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</p>
    </div>`;
  }
  const koRows = days.filter((k) => k.ko72Start).map((k) => `${k.ko72Start.name}(${k.ko72Start.yomi}): ${k.m}/${k.d}`);
  if (koRows.length) {
    html += `<div class="glist">
      <p class="glist__name">七十二候<small>二十四節気をさらに3つに分けた、約5日ごとの季節</small></p>
      <p class="glist__zs">${koRows.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</p>
    </div>`;
  }
  const eventRows = days.filter((k) => k.events.length)
    .map((k) => `${k.events.map((e) => e.name).join("・")}: ${k.m}/${k.d}`);
  if (eventRows.length) {
    html += `<div class="glist">
      <p class="glist__name">節句・行事<small>暦の日付や月の満ち欠けで決まるもの</small></p>
      <p class="glist__zs">${eventRows.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</p>
    </div>`;
  }
  const moonRows = days.filter((k) => k.moonPhaseName)
    .map((k) => `${MOON_MARK[k.moonPhaseName]}${k.moonPhaseName}: ${k.m}/${k.d}`);
  if (moonRows.length) {
    html += `<div class="glist">
      <p class="glist__name">月の満ち欠け<small>新月の日が旧暦の1日になる</small></p>
      <p class="glist__zs">${moonRows.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</p>
    </div>`;
  }

  // 選日(期間ものはまとめて1行にする)
  const senMap = new Map();
  for (const k of days) {
    for (const n of k.senjitsu) {
      if (!senMap.has(n)) senMap.set(n, []);
      senMap.get(n).push(k.d);
    }
  }
  if (senMap.size) {
    const rows = [...senMap.entries()].map(([n, ds]) => {
      // 連続した日はまとめて「1〜5日」の形にする
      const parts = [];
      let start = ds[0], prev = ds[0];
      for (let i = 1; i <= ds.length; i++) {
        if (i < ds.length && ds[i] === prev + 1) { prev = ds[i]; continue; }
        parts.push(start === prev ? `${start}日` : `${start}〜${prev}日`);
        start = ds[i]; prev = ds[i];
      }
      return `${n}: ${parts.join("、")}`;
    });
    html += `<div class="glist">
      <p class="glist__name">選日(せんじつ)<small>干支の並びだけで決まる暦注</small></p>
      <p class="glist__zs">${rows.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</p>
    </div>`;
  }

  // 雑節(期間ものは初日〜最終日で1行)
  const seen = new Set();
  const zRows = [];
  for (const k of days) {
    for (const z of k.zassetsu) {
      if (seen.has(z.name)) continue;
      seen.add(z.name);
      const a = jdToJstParts(z.start - 0.375), b = jdToJstParts(z.end - 0.375);
      zRows.push(`${z.name}: ${a.m}/${a.d}${z.span ? `〜${b.m}/${b.d}` : ""}`);
    }
    if (k.doyoUshi) zRows.push(`土用の丑の日: ${k.m}/${k.d}`);
  }
  if (zRows.length) {
    html += `<div class="glist">
      <p class="glist__name">雑節・季節の節目<small>太陽の位置と立春からの日数で決まる</small></p>
      <p class="glist__zs">${zRows.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</p>
    </div>`;
  }

  const badDays = days.filter((k) => k.bad.length);
  if (badDays.length) {
    html += `<div class="glist glist--bad">
      <p class="glist__name">凶とされる日<small>仏滅・不成就日・三隣亡</small></p>
      <p class="glist__days">${dayChips(badDays, "daychip--bad")}</p>
    </div>`;
  }

  goodList.innerHTML = html || '<p class="muted">この月に該当する吉日はありません。</p>';
}

/* ---------- 条件で日を探す ---------- */

const SEARCH_GOOD = {
  tensha: { name: "天赦日", test: (k) => k.flags.tensha },
  ichiryu: { name: "一粒万倍日", test: (k) => k.flags.ichiryu },
  taian: { name: "大安", test: (k) => k.rokuyo === "大安" },
  tora: { name: "寅の日", test: (k) => k.flags.tora },
  mi: { name: "巳の日", test: (k) => k.flags.mi },
  tsuchinotoMi: { name: "己巳の日", test: (k) => k.flags.tsuchinotoMi },
  kinoeNe: { name: "甲子の日", test: (k) => k.flags.kinoeNe },
  tenOn: { name: "天恩日", test: (k) => k.flags.tenOn },
  boso: { name: "母倉日", test: (k) => k.flags.boso },
  daimyo: { name: "大明日", test: (k) => k.flags.daimyo },
  kamiyoshi: { name: "神吉日", test: (k) => k.flags.kamiyoshi },
  tsukitoku: { name: "月徳日", test: (k) => k.flags.tsukitoku },
  koudou: { name: "黄道日(十二天神)", test: (k) => k.tenshinGood },
  rokusai: { name: "六斎日", test: (k) => k.saijitsu === "六斎日" },
};

const SEARCH_LIMIT = 60;

function searchDays(opts) {
  const startIdx = jdn(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const endIdx = startIdx + 365;
  const hits = [];
  let y = today.getFullYear(), m = today.getMonth() + 1;
  for (let i = 0; i < 13; i++) {
    for (const k of monthDays(y, m)) {
      if (k.dayIdx < startIdx || k.dayIdx > endIdx) continue;
      if (!opts.good.every((key) => SEARCH_GOOD[key].test(k))) continue;
      if (opts.offDay && !(k.weekday === 0 || k.weekday === 6 || k.holiday)) continue;
      if (opts.mine && !(k.mine && k.mine.any)) continue;
      if (opts.noButsumetsu && k.rokuyo === "仏滅") continue;
      if (opts.noFujoju && k.flags.fujoju) continue;
      if (opts.noSanrinbo && k.flags.sanrinbo) continue;
      hits.push(k);
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return hits;
}

function renderSearch() {
  const fd = new FormData(searchForm);
  const opts = {
    good: fd.getAll("good"),
    offDay: fd.get("offday") === "1",
    mine: fd.get("mine") === "1",
    noButsumetsu: fd.get("nobutsu") === "1",
    noFujoju: fd.get("nofujoju") === "1",
    noSanrinbo: fd.get("nosanrin") === "1",
  };
  if (!opts.good.length && !opts.offDay && !opts.mine) {
    searchResult.innerHTML = '<p class="muted">吉日か日にちの条件を、少なくとも1つ選んでください。</p>';
    return;
  }
  const hits = searchDays(opts);
  const label = [
    ...opts.good.map((key) => SEARCH_GOOD[key].name),
    ...(opts.offDay ? ["土日祝"] : []),
    ...(opts.mine ? ["あなたの吉日"] : []),
  ].join("＋");
  if (!hits.length) {
    searchResult.innerHTML = `<p class="search__count">今日から1年のあいだに「${escapeHtml(label)}」がそろう日はありませんでした。条件を減らしてみてください。</p>`;
    return;
  }
  const rows = hits.slice(0, SEARCH_LIMIT).map((k) => {
    const tags = [
      ...(k.holiday ? [k.holiday] : []),
      ...k.good,
      ...(k.mine && k.mine.any ? [meMark(k.mine).title] : []),
      ...k.bad.map((b) => `(${b})`),
    ];
    return `<li class="search__item">
      <button type="button" class="search__day" data-y="${k.y}" data-m="${k.m}" data-d="${k.d}">${k.m}月${k.d}日<small>(${WD[k.weekday]}) ${k.y}年</small></button>
      <span class="search__tags">${escapeHtml(tags.join("・"))}</span>
    </li>`;
  }).join("");
  searchResult.innerHTML = `
    <p class="search__count">「${escapeHtml(label)}」がそろう日は、今日から1年で<b>${hits.length}日</b>ありました。${hits.length > SEARCH_LIMIT ? `先の${SEARCH_LIMIT}日だけ表示しています。` : ""}日付を押すとカレンダーで開きます。</p>
    <ul class="search__list">${rows}</ul>`;
}

/* ---------- 操作 ---------- */

function move(delta) {
  const dt = new Date(viewY, viewM - 1 + delta, 1);
  viewY = dt.getFullYear();
  viewM = dt.getMonth() + 1;
  render();
}

for (const el of [setByDay, setShuku, setMaya, setMe, setKoDays]) {
  el.addEventListener("change", () => { applySettings(); render(); });
}

document.getElementById("btn-prev").addEventListener("click", () => move(-1));
document.getElementById("btn-next").addEventListener("click", () => move(1));
document.getElementById("btn-today").addEventListener("click", () => {
  viewY = today.getFullYear();
  viewM = today.getMonth() + 1;
  render();
  detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  renderSearch();
});

// セルと日付チップのクリックは、まとめて拾う
document.addEventListener("click", (e) => {
  const jump = e.target.closest(".search__day[data-d]");
  if (jump) {
    viewY = Number(jump.dataset.y);
    viewM = Number(jump.dataset.m);
    render();
    select(Number(jump.dataset.d));
    document.getElementById("calgrid").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const el = e.target.closest(".calcell[data-d], .daychip[data-d]");
  if (!el) return;
  select(Number(el.dataset.d));
  if (el.classList.contains("daychip")) {
    detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

// 左右キーで月送り
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.key === "ArrowLeft") move(-1);
  if (e.key === "ArrowRight") move(1);
});

loadSettings();
renderMeNote();   // 生年月日がなければ、保存された設定より優先して印をオフにする
if (!me) {
  const mineBox = document.getElementById("search-mine");
  if (mineBox) { mineBox.disabled = true; mineBox.closest("label").classList.add("is-disabled"); }
}
render();
