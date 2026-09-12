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
const westernBody = document.getElementById("western-body");
const sanmeiBody = document.getElementById("sanmei-body");
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

function buildShareText(p, f, today, w, fp) {
  const num = NUMEROLOGY[p.lifePath];
  const label = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
  const pill = [fp.year, fp.month, fp.day, fp.hour]
    .filter(Boolean).map((x) => KAN[x.stem] + SHI[x.branch]).join(" ");
  const signOfKey = (k) => ZODIAC[w.positions.find((x) => x.key === k).sign].name;
  return [
    `【生まれ日診断】${fmtDate(p.y, p.m, p.d)}生まれ`,
    `ライフパスナンバー ${p.lifePath}「${num.key}」`,
    `${KYUSEI[p.honmeisei].name} / ${p.eto.label} / ${WEEKDAY[p.weekday].name}生まれ / ${MOON[p.moonPhase].name}`,
    `西洋占星術 太陽:${signOfKey("sun")} 月:${signOfKey("moon")}${w.asc ? ` ASC:${ZODIAC[w.asc.sign].name}` : ""}`,
    `四柱推命 ${pill}(日主 ${KAN[fp.dayMaster]})`,
    ``,
    `${label}の運勢 ${stars(f.overall)}`,
    f.message,
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

  resultBody.innerHTML = buildProfileHtml(p);
  westernBody.innerHTML = buildWesternHtml(w);
  sanmeiBody.innerHTML = buildSanmeiHtml(fp, hasTime, pref ? pref[0] : "");
  dailyBody.innerHTML = buildDailyHtml(f, today);
  shareText = buildShareText(p, f, today, w, fp);
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
