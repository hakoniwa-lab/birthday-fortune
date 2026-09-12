/*
 * 吉日カレンダーの画面。暦の計算は koyomi.js(旧暦・暦注)と chart.js(干支)。
 * 表示している月だけを計算する。astro.js 側にキャッシュがあるので月送りは速い。
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

const today = new Date();
let viewY = today.getFullYear();
let viewM = today.getMonth() + 1;
let days = [];
let selected = null;

/* ---------- 表示の設定(端末内に保存) ---------- */

const SETTINGS_KEY = "birthday-fortune:calendar-settings";
const setByDay = document.getElementById("set-byday");
const setShuku = document.getElementById("set-shuku");

function loadSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (v && typeof v === "object") {
      if (typeof v.sekkiByDay === "boolean") setByDay.checked = v.sekkiByDay;
      if (typeof v.showShuku === "boolean") setShuku.checked = v.showShuku;
    }
  } catch (e) { /* 読めなければ既定のまま */ }
  applySettings();
}

function applySettings() {
  setKoyomiSettings({ sekkiByDay: setByDay.checked, showShuku: setShuku.checked });
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sekkiByDay: setByDay.checked, showShuku: setShuku.checked }));
  } catch (e) { /* noop */ }
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

/* ---------- カレンダーを描く ---------- */

function render() {
  days = monthKoyomi(viewY, viewM);
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
    ].filter(Boolean).join(" ");
    const bd = badges(k).map((x) => `<span class="bdg ${x.c}">${escapeHtml(x.t)}</span>`).join("");
    const shuku = setShuku.checked ? `<span class="calcell__s${k.shuku === "鬼" ? " is-oni" : ""}">${escapeHtml(k.shuku)}</span>` : "";
    // 期間ものは初日だけ、単日の雑節と土用の丑は当日に印を出す(狭いので短縮)
    const zLabel = (() => {
      if (k.sekki24) return k.sekki24.name;                 // 二十四節気がいちばん優先
      if (k.events.length) return k.events[0].name.replace("の節句", "");
      if (k.doyoUshi) return "丑の日";
      const one = k.zassetsu.find((z) => !z.span) || k.zassetsu.find((z) => z.span && z.start === k.dayIdx);
      if (!one) return "";
      return one.name.replace(/^(春|夏|秋|冬)の/, "").replace("土用", "土用入").replace("彼岸", "彼岸入");
    })();
    const zCls = k.sekki24 ? "calcell__z is-sekki" : "calcell__z";
    const zHtml = zLabel ? `<span class="${zCls}">${escapeHtml(zLabel)}</span>` : "";
    const moonHtml = k.moonPhaseName ? `<span class="calcell__moon">${MOON_MARK[k.moonPhaseName]}</span>` : "";
    cells.push(`<button type="button" class="${cls}" data-d="${k.d}">
      <span class="calcell__d">${k.d}</span>
      <span class="calcell__r">${escapeHtml(k.rokuyo || "")}</span>
      ${shuku}
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

  const goodHtml = k.good.length
    ? `<div class="tags">${k.good.map((g) => `<span class="tag tag--good">${escapeHtml(g)}</span>`).join("")}</div>`
    : '<p class="muted">とくに吉日とされる日ではありません。</p>';
  const badHtml = k.bad.length
    ? `<div class="tags">${k.bad.map((g) => `<span class="tag tag--bad">${escapeHtml(g)}</span>`).join("")}</div>`
    : "";
  const seasonNames = [
    ...(k.sekki24 ? [k.sekki24.name] : []),
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
  for (const e of k.events) notes.push(`<strong>${escapeHtml(e.name)}。</strong>${escapeHtml(e.text)}`);
  if (k.moonPhaseName) notes.push(`<strong>${escapeHtml(k.moonPhaseName)}。</strong>${escapeHtml(MOON_PHASE_TEXT[k.moonPhaseName] || "")}`);
  for (const n of k.senjitsu) notes.push(`<strong>${escapeHtml(n)}。</strong>${escapeHtml(SENJITSU_TEXT[n] || "")}`);
  if (k.flags.tenOn) notes.push("<strong>天恩日。</strong>天の恩恵をすべての人が受ける日。祝い事に良く、凶事には向かないとされます。");
  if (k.flags.boso) notes.push("<strong>母倉日。</strong>天が人を慈しむ日。結婚・建築に良いとされます。");
  if (k.doyoUshi) notes.push("<strong>土用の丑の日。</strong>夏の土用の期間の丑の日。うなぎを食べる習慣で知られます。");
  for (const z of k.zassetsu) {
    const span = z.span ? `(${(() => { const a = jdToJstParts(z.start - 0.375), b = jdToJstParts(z.end - 0.375); return `${a.m}/${a.d}〜${b.m}/${b.d}`; })()})` : "";
    notes.push(`<strong>${escapeHtml(z.name)}${span}。</strong>${escapeHtml(z.text)}`);
  }
  if (k.flags.fujoju) notes.push("<strong>不成就日。</strong>何を始めても成就しないとされる日です。");
  if (k.flags.sanrinbo) notes.push("<strong>三隣亡。</strong>建築・棟上げで避けられる日です。");

  detailBody.innerHTML = `
    <p class="detail__date">${k.m}月${k.d}日<span>(${WD[k.weekday]})</span></p>
    ${goodHtml}
    ${badHtml}
    ${zTags}
    ${senTags}
    <div class="detail__rows">
      <p class="detail__row"><span>六曜</span><b>${escapeHtml(k.rokuyo || "-")}</b></p>
      <p class="detail__row"><span>十二直</span><b>${escapeHtml(k.junichoku)}</b></p>
      ${setShuku.checked ? `<p class="detail__row"><span>二十八宿</span><b>${escapeHtml(k.shuku)}宿</b></p>` : ""}
      <p class="detail__row"><span>日の干支</span><b>${escapeHtml(k.eto)}</b></p>
      <p class="detail__row"><span>旧暦</span><b>${escapeHtml(lunarLabel)}</b></p>
      <p class="detail__row"><span>節月</span><b>${escapeHtml(sekkiLabel)}</b></p>
    </div>
    <p class="detail__memo">${escapeHtml(ROKUYO_TEXT[k.rokuyo] || "")}</p>
    <p class="detail__memo">${escapeHtml(k.junichoku)}: ${escapeHtml(JUNICHOKU_TEXT[k.junichoku] || "")}</p>
    ${setShuku.checked ? `<p class="detail__memo">${escapeHtml(k.shuku)}宿: ${escapeHtml(SHUKU_TEXT[k.shuku] || "")}</p>` : ""}
    ${notes.length ? `<ul class="detail__notes">${notes.map((n) => `<li>${n}</li>`).join("")}</ul>` : ""}
  `;
  detail.hidden = false;
}

/* ---------- 月内の吉日まとめ ---------- */

function renderGoodList() {
  listTitle.textContent = `${viewY}年${viewM}月の吉日`;
  const kinds = [
    { key: "tensha", name: "天赦日", memo: "年に5〜6回。暦の上でいちばん良いとされる日" },
    { key: "ichiryu", name: "一粒万倍日", memo: "始めたことが大きく育つとされる日" },
    { key: "tsuchinotoMi", name: "己巳の日", memo: "60日に一度。弁財天の日、金運に良いとされる" },
    { key: "kinoeNe", name: "甲子の日", memo: "60日に一度。大黒天の日、始まりに良いとされる" },
    { key: "tenOn", name: "天恩日", memo: "天の恩恵を受ける日。祝い事に良いとされる" },
    { key: "boso", name: "母倉日", memo: "天が人を慈しむ日。結婚・建築に良いとされる" },
    { key: "tora", name: "寅の日", memo: "出ていったお金が戻るとされる日" },
    { key: "mi", name: "巳の日", memo: "弁財天に縁のある、金運の日" },
  ];

  const best = days.filter((k) => k.flags.tensha && k.flags.ichiryu);
  let html = "";
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
      <p class="glist__days">${list.map((k) => (
        `<button type="button" class="daychip" data-d="${k.d}">${k.d}日<small>${WD[k.weekday]}</small></button>`
      )).join("")}</p>
    </div>`;
  }).join("");

  // 二十四節気・行事・月相
  const sekkiRows = days.filter((k) => k.sekki24)
    .map((k) => `${k.sekki24.name}: ${k.m}/${k.d} ${k.sekki24.hh}:${String(k.sekki24.mi).padStart(2, "0")}`);
  if (sekkiRows.length) {
    html += `<div class="glist">
      <p class="glist__name">二十四節気<small>太陽の黄経が15度進むごとの区切り</small></p>
      <p class="glist__zs">${sekkiRows.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</p>
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
      <p class="glist__days">${badDays.map((k) => (
        `<button type="button" class="daychip daychip--bad" data-d="${k.d}">${k.d}日<small>${WD[k.weekday]}</small></button>`
      )).join("")}</p>
    </div>`;
  }

  goodList.innerHTML = html || '<p class="muted">この月に該当する吉日はありません。</p>';
}

/* ---------- 操作 ---------- */

function move(delta) {
  const dt = new Date(viewY, viewM - 1 + delta, 1);
  viewY = dt.getFullYear();
  viewM = dt.getMonth() + 1;
  render();
}

setByDay.addEventListener("change", () => { applySettings(); render(); });
setShuku.addEventListener("change", () => { applySettings(); render(); });

document.getElementById("btn-prev").addEventListener("click", () => move(-1));
document.getElementById("btn-next").addEventListener("click", () => move(1));
document.getElementById("btn-today").addEventListener("click", () => {
  viewY = today.getFullYear();
  viewM = today.getMonth() + 1;
  render();
  detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

// セルと日付チップのクリックは、まとめて拾う
document.addEventListener("click", (e) => {
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
render();
