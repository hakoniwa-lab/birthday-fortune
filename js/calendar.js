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
    cells.push(`<button type="button" class="${cls}" data-d="${k.d}">
      <span class="calcell__d">${k.d}</span>
      <span class="calcell__r">${escapeHtml(k.rokuyo || "")}</span>
      <span class="calcell__b">${bd}</span>
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
  if (k.flags.fujoju) notes.push("<strong>不成就日。</strong>何を始めても成就しないとされる日です。");
  if (k.flags.sanrinbo) notes.push("<strong>三隣亡。</strong>建築・棟上げで避けられる日です。");

  detailBody.innerHTML = `
    <p class="detail__date">${k.m}月${k.d}日<span>(${WD[k.weekday]})</span></p>
    ${goodHtml}
    ${badHtml}
    <div class="detail__rows">
      <p class="detail__row"><span>六曜</span><b>${escapeHtml(k.rokuyo || "-")}</b></p>
      <p class="detail__row"><span>十二直</span><b>${escapeHtml(k.junichoku)}</b></p>
      <p class="detail__row"><span>日の干支</span><b>${escapeHtml(k.eto)}</b></p>
      <p class="detail__row"><span>旧暦</span><b>${escapeHtml(lunarLabel)}</b></p>
      <p class="detail__row"><span>節月</span><b>${escapeHtml(sekkiLabel)}</b></p>
    </div>
    <p class="detail__memo">${escapeHtml(ROKUYO_TEXT[k.rokuyo] || "")}</p>
    <p class="detail__memo">${escapeHtml(k.junichoku)}: ${escapeHtml(JUNICHOKU_TEXT[k.junichoku] || "")}</p>
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
    { key: "tsuchinotoMi", name: "己巳の日", memo: "60日に一度。金運に良いとされる日" },
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

render();
