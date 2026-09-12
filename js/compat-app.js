/*
 * 相性診断の画面。計算は aisho.js、文章は data.js と aisho.js。
 * 二人分の入力を端末内にだけ保存する。
 */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

const STORAGE_KEY = "birthday-fortune:pair";
const form = document.getElementById("gen-form");
const introSection = document.getElementById("screen-intro");
const resultSection = document.getElementById("screen-result");
const formError = document.getElementById("form-error");
const btnCopy = document.getElementById("btn-copy");
const btnRestart = document.getElementById("btn-restart");

let shareText = "";

const Z = ZODIAC.map((z) => z.name);

/* ---------- 入力 ---------- */

function el(id) { return document.getElementById(id); }

function fillPerson(prefix, defaultYear) {
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= 1920; y--) el(`${prefix}-year`).appendChild(new Option(`${y}年`, y));
  for (let m = 1; m <= 12; m++) el(`${prefix}-month`).appendChild(new Option(`${m}月`, m));
  for (let d = 1; d <= 31; d++) el(`${prefix}-day`).appendChild(new Option(`${d}日`, d));
  el(`${prefix}-hour`).appendChild(new Option("時刻なし", ""));
  for (let h = 0; h <= 23; h++) el(`${prefix}-hour`).appendChild(new Option(`${h}時`, h));
  for (let mi = 0; mi <= 55; mi += 5) el(`${prefix}-minute`).appendChild(new Option(`${mi}分`, mi));
  el(`${prefix}-year`).value = String(defaultYear);
  el(`${prefix}-minute`).value = "0";
}

function readPerson(prefix) {
  const hour = el(`${prefix}-hour`).value;
  return {
    y: Number(el(`${prefix}-year`).value),
    m: Number(el(`${prefix}-month`).value),
    d: Number(el(`${prefix}-day`).value),
    hour: hour === "" ? null : Number(hour),
    minute: Number(el(`${prefix}-minute`).value || 0),
  };
}

function writePerson(prefix, p) {
  if (!p) return;
  el(`${prefix}-year`).value = String(p.y);
  el(`${prefix}-month`).value = String(p.m);
  el(`${prefix}-day`).value = String(p.d);
  el(`${prefix}-hour`).value = p.hour === null || p.hour === undefined ? "" : String(p.hour);
  el(`${prefix}-minute`).value = String(p.minute || 0);
}

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!v || !v.a || !v.b) return null;
    if (!isValidDate(v.a.y, v.a.m, v.a.d) || !isValidDate(v.b.y, v.b.m, v.b.d)) return null;
    return v;
  } catch (e) { return null; }
}
function save(v) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch (e) { /* noop */ } }
function clearSaved() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ } }

/* ---------- 描画 ---------- */

function personCard(label, side) {
  const p = side.profile, ch = side.chart, fp = side.pillars;
  return `<div class="pcard">
    <p class="pcard__label">${escapeHtml(label)}</p>
    <p class="pcard__date">${p.y}年${p.m}月${p.d}日</p>
    <p class="pcard__row"><span>数秘</span><b>${p.lifePath}「${escapeHtml(NUMEROLOGY[p.lifePath].key)}」</b></p>
    <p class="pcard__row"><span>太陽</span><b>${escapeHtml(Z[ch.positions[0].sign])}</b></p>
    <p class="pcard__row"><span>月</span><b>${escapeHtml(Z[ch.positions[1].sign])}${ch.moonUncertain ? " <small>?</small>" : ""}</b></p>
    <p class="pcard__row"><span>九星</span><b>${escapeHtml(KYUSEI[p.honmeisei].name)}</b></p>
    <p class="pcard__row"><span>日柱</span><b>${escapeHtml(KAN[fp.day.stem] + SHI[fp.day.branch])}</b></p>
  </div>`;
}

function relBox(kind, key, text) {
  return `<div class="rel">
    <p class="rel__kind">${escapeHtml(kind)}</p>
    <p class="rel__key">${escapeHtml(key)}</p>
    <p class="rel__text">${escapeHtml(text)}</p>
  </div>`;
}

function render(a, b) {
  const c = compatibility(a, b);

  el("pair-head").innerHTML = `
    <div class="pair-grid">${personCard("あなた", c.a)}${personCard("相手", c.b)}</div>
    ${(c.a.chart.moonUncertain || c.b.chart.moonUncertain)
      ? '<p class="item__note">「?」の付いた月星座は、時刻が未入力のため正午で計算しています。その日のうちに星座が変わるので、時刻を入れると確定します。</p>'
      : ""}
  `;

  // 数秘
  const n = c.numerology;
  el("sec-num").innerHTML = `
    <p class="chart__lead">${escapeHtml(n.groups[0])} × ${escapeHtml(n.groups[1])}${n.same ? "(同じ数字)" : ""}</p>
    ${relBox("役割の組み合わせ", `${n.groups[0]}と${n.groups[1]}`, n.text)}
    ${n.same ? '<p class="item__note">同じライフパスナンバーどうしです。長所も短所もそっくりなので、相手を見ると自分の癖が分かります。</p>' : ""}
  `;

  // 占星術
  const sunA = Z[c.a.chart.positions[0].sign], sunB = Z[c.b.chart.positions[0].sign];
  const moonA = Z[c.a.chart.positions[1].sign], moonB = Z[c.b.chart.positions[1].sign];
  const sunAsp = c.sun.aspect, moonAsp = c.moon.aspect;
  const noAsp = { name: "決まった名前のない角度", key: "干渉が少ない", text: "占星術で意味を持つとされる角度には当たりません。お互いの調子に振り回されにくい、独立した組み合わせです。" };
  el("sec-astro").innerHTML = `
    <p class="chart__lead">太陽 ${escapeHtml(sunA)} × ${escapeHtml(sunB)} — 角度 ${c.sun.deg.toFixed(1)}度</p>
    ${relBox("太陽どうし(表に出る自分)", (sunAsp || noAsp).key, `${(sunAsp || noAsp).name}。${(sunAsp || noAsp).text}`)}
    <p class="chart__lead">月 ${escapeHtml(moonA)} × ${escapeHtml(moonB)} — 角度 ${c.moon.deg.toFixed(1)}度${c.moon.uncertain ? "(時刻なし・目安)" : ""}</p>
    ${relBox("月どうし(素の自分)", (moonAsp || noAsp).key, `${(moonAsp || noAsp).name}。${(moonAsp || noAsp).text}`)}
    ${c.moon.uncertain ? '<p class="item__note item__note--warn">月は1日で約13度動きます。時刻が未入力の側があるため、月どうしの角度は目安です。</p>' : ""}
  `;

  // 九星
  const kr = GOGYO_REL_TEXT[c.kyusei.relation];
  el("sec-kyusei").innerHTML = `
    <p class="chart__lead">${escapeHtml(KYUSEI[c.a.profile.honmeisei].name)}(${GOGYO[c.kyusei.elemA]}) × ${escapeHtml(KYUSEI[c.b.profile.honmeisei].name)}(${GOGYO[c.kyusei.elemB]})</p>
    ${relBox(`あなたから見て「${c.kyusei.relation}」`, kr.key, kr.text)}
  `;

  // 四柱推命
  const s = c.shichu;
  el("sec-shichu").innerHTML = `
    <p class="chart__lead">日干 ${escapeHtml(KAN[c.a.pillars.dayMaster])} × ${escapeHtml(KAN[c.b.pillars.dayMaster])} / 日支 ${escapeHtml(SHI[c.a.pillars.day.branch])} × ${escapeHtml(SHI[c.b.pillars.day.branch])}</p>
    <div class="rel2">
      ${relBox("あなたから見た相手", s.godAB, TENGOD_INFO[s.godAB])}
      ${relBox("相手から見たあなた", s.godBA, TENGOD_INFO[s.godBA])}
    </div>
    ${relBox("日支どうし", s.branch.key, `${s.branch.name}。${s.branch.text}`)}
  `;

  // 宿曜(三九の秘法)
  const skA = sukuyoOf(a.y, a.m, a.d, a.hour, a.minute);
  const skB = sukuyoOf(b.y, b.m, b.d, b.hour, b.minute);
  let sukuyoShare = "";
  if (skA.main && skB.main) {
    const pr = sukuyoPair(skA.main.index, skB.main.index);
    sukuyoShare = `宿曜: ${skA.main.name}宿と${skB.main.name}宿(${pr.aToB.name}と${pr.bToA.name})`;
    el("sec-sukuyo").innerHTML = `
      <p class="chart__lead">${escapeHtml(skA.main.name)}宿 × ${escapeHtml(skB.main.name)}宿 — あなたから数えて${pr.aToB.steps + 1}番目、相手から数えて${pr.bToA.steps + 1}番目の宿です</p>
      <div class="rel2">
        ${relBox(`あなたから見た相手(${pr.aToB.distance})`, `${pr.aToB.name}・${pr.aToB.pair}`,
          `${pr.aToB.text} ${SANKU_DISTANCE_TEXT[pr.aToB.distance]}`)}
        ${relBox(`相手から見たあなた(${pr.bToA.distance})`, `${pr.bToA.name}・${pr.bToA.pair}`,
          `${pr.bToA.text} ${SANKU_DISTANCE_TEXT[pr.bToA.distance]}`)}
      </div>
      <p class="item__note">宿曜の相性は<b>向きによって名前が変わります</b>。片方が与え、片方が受け取る形になっていることが多いためで、二人の関係を一つの言葉で決めつけないのがこの占いの特徴です。良い悪いではなく、役割が違うと読んでください。</p>
    `;
  } else {
    el("sec-sukuyo").innerHTML = '<p class="item__text">この年は旧暦の表を持っていないため、宿曜は出せません。</p>';
  }

  shareText = [
    `【相性診断】${a.y}/${a.m}/${a.d} × ${b.y}/${b.m}/${b.d}`,
    `数秘: ${n.groups[0]}と${n.groups[1]}`,
    `太陽: ${sunA}×${sunB} ${(sunAsp || noAsp).key}`,
    `九星: ${c.kyusei.relation}`,
    `四柱: ${s.godAB}／${s.godBA}、日支は${s.branch.name}`,
    sukuyoShare,
    ``,
    `https://hakoniwalab.com/birthday-fortune/compatibility/`,
  ].join("\n");

  introSection.hidden = true;
  resultSection.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- イベント ---------- */

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const a = readPerson("a"), b = readPerson("b");
  for (const [label, p] of [["あなた", a], ["相手", b]]) {
    if (!isValidDate(p.y, p.m, p.d)) {
      formError.hidden = false;
      formError.textContent = `${label}の ${p.y}年${p.m}月${p.d}日 は存在しない日付です。`;
      return;
    }
    if (new Date(p.y, p.m - 1, p.d) > new Date()) {
      formError.hidden = false;
      formError.textContent = `${label}の日付が未来になっています。`;
      return;
    }
  }
  formError.hidden = true;
  save({ a, b });
  render(a, b);
});

btnCopy.addEventListener("click", async () => {
  if (navigator.share) {
    try { await navigator.share({ text: shareText }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(shareText);
    btnCopy.textContent = "コピーしました";
    setTimeout(() => { btnCopy.textContent = "結果をシェア・コピー"; }, 2000);
  } catch (e) { btnCopy.textContent = "コピーに失敗しました"; }
});

btnRestart.addEventListener("click", () => {
  clearSaved();
  resultSection.hidden = true;
  introSection.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------- 起動 ---------- */

fillPerson("a", new Date().getFullYear() - 30);
fillPerson("b", new Date().getFullYear() - 30);
const saved = load();
if (saved) {
  writePerson("a", saved.a);
  writePerson("b", saved.b);
  render(saved.a, saved.b);
}
