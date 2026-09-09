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
const introSection = document.getElementById("screen-intro");
const resultSection = document.getElementById("screen-result");
const resultBody = document.getElementById("result-body");
const dailyBody = document.getElementById("daily-body");
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
}

/* ---------- 保存 ---------- */

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || !isValidDate(v.y, v.m, v.d)) return null;
    return v;
  } catch (e) {
    return null;
  }
}

function save(y, m, d) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ y, m, d }));
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
  const etoNote = p.etoRisshun.label !== p.eto.label
    ? `<p class="item__note">※ 立春(${p.y}年は2月${p.risshun}日)より前の生まれなので、九星や四柱推命では前年の「${escapeHtml(p.etoRisshun.label)}(${escapeHtml(p.etoRisshun.yomi)})」として扱われます。</p>`
    : "";

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

function buildDailyHtml(f, today) {
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
    <p class="item__note">日付が変わると内容も変わります。同じ日のうちは何度見ても同じです。</p>
  `;
}

function buildShareText(p, f, today) {
  const num = NUMEROLOGY[p.lifePath];
  const label = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
  return [
    `【生まれ日診断】${fmtDate(p.y, p.m, p.d)}生まれ`,
    `ライフパスナンバー ${p.lifePath}「${num.key}」`,
    `${KYUSEI[p.honmeisei].name} / ${p.eto.label} / ${ZODIAC[p.zodiac].name} / ${WEEKDAY[p.weekday]}生まれ / ${MOON[p.moonPhase].name}`,
    ``,
    `${label}の運勢 ${stars(f.overall)}`,
    f.message,
    `ラッキーナンバー ${f.luckyNumber}・ラッキーカラー ${f.luckyColor}`,
    ``,
    `https://hakoniwalab.com/birthday-fortune/`,
  ].join("\n");
}

function render(y, m, d) {
  const today = new Date();
  const p = buildProfile(y, m, d, today);
  const f = dailyFortune(y, m, d, today, DAILY_POOLS);
  resultBody.innerHTML = buildProfileHtml(p);
  dailyBody.innerHTML = buildDailyHtml(f, today);
  shareText = buildShareText(p, f, today);
  introSection.hidden = true;
  resultSection.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- イベント ---------- */

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const y = Number(selYear.value);
  const m = Number(selMonth.value);
  const d = Number(selDay.value);
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
  save(y, m, d);
  render(y, m, d);
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
  render(saved.y, saved.m, saved.d);
}
