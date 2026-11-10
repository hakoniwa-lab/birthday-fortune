/*
 * 推しとの相性診断(oshi/)の画面。計算は相性診断と同じ aisho.js / sukuyo.js / maya.js、次の誕生日の暦は koyomi.js / holiday.js。
 * 入力は端末の中だけで計算し、保存もしない(URL にも入れない)。
 * 推しは5人まで。生まれ年が分からない推しは星座と次の誕生日だけを出す。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
  const MAX = 5;
  const WD = "日月火水木金土";
  const Z = ZODIAC.map((z) => z.name);
  const NO_ASP = { name: "決まった名前のない角度", key: "干渉が少ない", text: "占星術で意味を持つとされる角度には当たりません。お互いの調子に振り回されにくい、独立した組み合わせです。" };

  /* 九星の関係ごとの、推し活での読み方(どれも悪く書かない) */
  const FAN_NOTE = {
    比和: "同じ五行どうし。推しの考え方に「分かる」と思う場面が多い組み合わせ、と読めます。",
    生じる: "あなたの五行が推しの五行を生む形。応援する側とされる側という関係に、そのまま重なります。",
    生じられる: "推しの五行があなたの五行を生む形。推しを見ていると元気をもらえる組み合わせ、と読めます。",
    剋す: "あなたの五行が推しの五行を抑える形。好きだからこそ細かい所まで見える、目の肥えたファンの組み合わせと読めます。",
    剋される: "推しの五行があなたの五行を抑える形。推しの言葉や活動に心を動かされやすい組み合わせ、と読めます。",
  };

  let count = 0;
  let shareText = "";

  function fillSelects(prefix, withUnknown, defYear) {
    const ty = new Date().getFullYear();
    const yEl = $(`${prefix}-year`), mEl = $(`${prefix}-month`), dEl = $(`${prefix}-day`);
    if (withUnknown) yEl.appendChild(new Option("生まれ年は分からない", ""));
    for (let y = ty; y >= 1920; y--) yEl.appendChild(new Option(`${y}年`, y));
    for (let m = 1; m <= 12; m++) mEl.appendChild(new Option(`${m}月`, m));
    for (let d = 1; d <= 31; d++) dEl.appendChild(new Option(`${d}日`, d));
    yEl.value = defYear;
  }

  function addOshi() {
    if (count >= MAX) return;
    count++;
    const i = count, wrap = document.createElement("fieldset");
    wrap.className = "person oshi-person";
    wrap.id = `oshi-${i}`;
    wrap.innerHTML = `<legend>推し${i}</legend>
      <input type="text" id="o${i}-name" class="quiz-select" maxlength="20" placeholder="呼び名(なくても大丈夫)" autocomplete="off" aria-label="推し${i}の呼び名">
      <div class="date-row">
        <select id="o${i}-year" class="quiz-select" aria-label="年"></select>
        <select id="o${i}-month" class="quiz-select" aria-label="月"></select>
        <select id="o${i}-day" class="quiz-select" aria-label="日"></select>
      </div>`;
    $("oshi-list").appendChild(wrap);
    fillSelects(`o${i}`, true, "");
    $("oshi-add").hidden = count >= MAX;
  }

  function nextBirthday(m, d, today) {
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const at = (y) => {
      const leapFix = m === 2 && d === 29 && !isValidDate(y, 2, 29);
      const dd = leapFix ? 28 : d;
      return { y, m, d: dd, leapFix, date: new Date(y, m - 1, dd) };
    };
    let x = at(t0.getFullYear());
    if (x.date < t0) x = at(t0.getFullYear() + 1);
    const days = Math.round((x.date - t0) / 86400000);
    return Object.assign(x, { days, k: dayKoyomi(x.y, x.m, x.d), hol: holidayOf(x.y, x.m, x.d) });
  }

  function birthdayHtml(m, d, today) {
    const b = nextBirthday(m, d, today);
    const when = b.days === 0 ? "今日です" : `あと${b.days}日`;
    const tags = [...(b.hol ? [b.hol] : []), ...(b.k.rokuyo ? [b.k.rokuyo] : []), ...b.k.good.filter((n) => n !== "大安")];
    return `<p class="oshi-next"><span>次の誕生日</span><b>${b.y}年${b.m}月${b.d}日(${WD[b.k.weekday]})</b> ${when}${tags.length ? `<br><small>${esc(tags.join("・"))}</small>` : ""}${b.leapFix ? "<br><small>うるう年でない年は2月28日で出しています</small>" : ""}</p>`;
  }

  const gakunen = (p) => (p.m > 4 || (p.m === 4 && p.d >= 2) ? p.y : p.y - 1);
  function ageGapText(me, o) {
    const g = gakunen(me) - gakunen(o);
    if (g === 0) return "推しとは同じ学年です。";
    return g > 0 ? `推しのほうが${g}学年上です。` : `あなたのほうが${-g}学年上です。`;
  }

  function fullCard(me, o, label, today) {
    const c = compatibility(me, o);
    const n = c.numerology, s = c.shichu;
    const pa = c.a.profile, pb = c.b.profile;
    const sunA = Z[c.a.chart.positions[0].sign], sunB = Z[c.b.chart.positions[0].sign];
    const sunAsp = c.sun.aspect || NO_ASP;
    const kr = GOGYO_REL_TEXT[c.kyusei.relation];
    const skA = sukuyoOf(me.y, me.m, me.d, null, null), skB = sukuyoOf(o.y, o.m, o.d, null, null);
    const pr = skA.main && skB.main ? sukuyoPair(skA.main.index, skB.main.index) : null;
    const dsA = dreamspellOf(me.y, me.m, me.d), dsB = dreamspellOf(o.y, o.m, o.d);
    const mp = mayaPair(dsA, dsB), mt = MAYA_PAIR_TEXT[mp.rel];

    const same = [];
    if (me.m === o.m && me.d === o.d) same.push("誕生日(月日)");
    else if (me.m === o.m) same.push("誕生月");
    if (me.y === o.y) same.push("生まれ年");
    if (sunA === sunB) same.push(`星座(${sunA})`);
    if (n.same) same.push(`ライフパスナンバー(${pa.lifePath})`);
    if (pa.honmeisei === pb.honmeisei) same.push(`本命星(${KYUSEI[pa.honmeisei].name})`);
    if (pr && skA.main.index === skB.main.index) same.push(`宿(${skA.main.name}宿)`);
    if (mp.rel === "同じ") same.push(`太陽の紋章(${dsA.glyph})`);
    if (c.a.pillars.day.stem === c.b.pillars.day.stem && c.a.pillars.day.branch === c.b.pillars.day.branch) same.push(`日柱(${KAN[c.a.pillars.day.stem]}${SHI[c.a.pillars.day.branch]})`);
    if (mp.sameTone && mp.kin !== "同じKIN" && mp.kin !== "反対KIN") same.push("銀河の音");

    const row = (kind, head, key, text) => `<details class="oshi-row"><summary><span class="oshi-kind">${esc(kind)}</span><span class="oshi-key">${esc(key)}</span><small>${esc(head)}</small></summary><p>${text}</p></details>`;
    const rows = [
      row("数秘術", `${n.groups[0]} × ${n.groups[1]}`, `${pa.lifePath}と${pb.lifePath}`, esc(n.text)),
      row("星座", `${sunA} × ${sunB}`, sunAsp.key, `${esc(sunAsp.name)}。${esc(sunAsp.text)}`),
      row("九星", `${KYUSEI[pa.honmeisei].name} × ${KYUSEI[pb.honmeisei].name}`, kr.key, `${esc(FAN_NOTE[c.kyusei.relation])}${esc(kr.text)}`),
      row("四柱推命", `日干 ${KAN[c.a.pillars.dayMaster]} × ${KAN[c.b.pillars.dayMaster]}`, s.godAB, `あなたから見た推しは<b>${esc(s.godAB)}</b>。${esc(TENGOD_INFO[s.godAB])}<br>推しから見たあなたは<b>${esc(s.godBA)}</b>。${esc(TENGOD_INFO[s.godBA])}`),
      pr ? row("宿曜", `${skA.main.name}宿 × ${skB.main.name}宿`, `${pr.aToB.name}・${pr.aToB.pair}`, `あなたから見た推しは<b>${esc(pr.aToB.name)}</b>。${esc(pr.aToB.text)}<br>推しから見たあなたは<b>${esc(pr.bToA.name)}</b>。${esc(pr.bToA.text)}`) : "",
      row("マヤ暦", `${dsA.glyph} × ${dsB.glyph}`, mt.key, esc(mt.text)),
    ].join("");
    const sameHtml = same.length
      ? `<p class="oshi-same"><b>共通点 ${same.length}個</b>${same.map((x) => `<span class="oshi-chip">${esc(x)}</span>`).join("")}</p>`
      : `<p class="oshi-same"><b>共通点 0個</b><small>ここで見た範囲に同じものはありませんでした。違うからこそ、見ていて飽きない相手とも読めます。</small></p>`;
    return {
      html: `<div class="card oshi-card"><h3 class="oshi-name">${esc(label)}</h3><p class="oshi-sub">${o.y}年${o.m}月${o.d}日生まれ　${ageGapText(me, o)}</p>${sameHtml}<div class="oshi-rows">${rows}</div>${birthdayHtml(o.m, o.d, today)}</div>`,
      share: `${label}: 共通点${same.length}個・星座${sunAsp.key}・九星${kr.key}${pr ? `・宿曜${pr.aToB.name}` : ""}`,
      same: same.length, key: [`<b>${same.length}個</b>`, esc(sunAsp.key), esc(kr.key), pr ? esc(pr.aToB.name) : "-", esc(mt.key)],
    };
  }

  /* 生まれ年が分からない推し。月日だけで分かる星座と次の誕生日を出す */
  function dayOnlyCard(me, m, d, label, today) {
    // 星座の境目は年で変わるので、うるう年の2000年で近似する(2月29日も引ける)
    const mine = westernChart(me.y, me.m, me.d, null, null, null).positions[0];
    const theirs = westernChart(2000, m, d, 12, 0, null).positions[0];
    const asp = aspectOf(angleBetween(mine.lon, theirs.lon)) || NO_ASP;
    const sunA = Z[mine.sign], sunB = Z[theirs.sign];
    const same = [];
    if (me.m === m && me.d === d) same.push("誕生日(月日)");
    else if (me.m === m) same.push("誕生月");
    if (sunA === sunB) same.push(`星座(${sunA})`);
    const sameHtml = same.length
      ? `<p class="oshi-same"><b>共通点 ${same.length}個</b>${same.map((x) => `<span class="oshi-chip">${esc(x)}</span>`).join("")}</p>` : "";
    return {
      html: `<div class="card oshi-card"><h3 class="oshi-name">${esc(label)}</h3><p class="oshi-sub">${m}月${d}日生まれ(生まれ年なし)</p>${sameHtml}<div class="oshi-rows"><details class="oshi-row" open><summary><span class="oshi-kind">星座</span><span class="oshi-key">${esc(asp.key)}</span><small>${esc(sunA)} × ${esc(sunB)}</small></summary><p>${esc(asp.name)}。${esc(asp.text)}</p></details></div><p class="item__note">数秘術・九星・四柱推命・宿曜・マヤ暦は生まれ年が要るので出していません。星座の境目の日は年によって1日ほど動くので、この星座は目安です。</p>${birthdayHtml(m, d, today)}</div>`,
      share: `${label}: 星座${asp.key}`, same: same.length, key: [`<b>${same.length}個</b>`, esc(asp.key), "-", "-", "-"],
    };
  }

  function render() {
    const err = $("oshi-error");
    const me = { y: +$("me-year").value, m: +$("me-month").value, d: +$("me-day").value, hour: null, minute: 0 };
    const today = new Date();
    let msg = "";
    if (!isValidDate(me.y, me.m, me.d)) msg = `あなたの ${me.y}年${me.m}月${me.d}日 は存在しない日付です。`;
    else if (new Date(me.y, me.m - 1, me.d) > today) msg = "あなたの生年月日が未来になっています。";
    const list = [];
    for (let i = 1; i <= count && !msg; i++) {
      const name = $(`o${i}-name`).value.trim(), ys = $(`o${i}-year`).value, m = +$(`o${i}-month`).value, d = +$(`o${i}-day`).value;
      const touched = name || ys !== "" || $(`o${i}-month`).dataset.t || $(`o${i}-day`).dataset.t;
      if (!touched) continue;
      const label = name || `推し${i}`;
      const y0 = ys === "" ? 2000 : +ys;
      if (!isValidDate(y0, m, d)) { msg = `${label}の ${m}月${d}日 は存在しない日付です。`; break; }
      if (ys !== "" && new Date(y0, m - 1, d) > today) { msg = `${label}の生年月日が未来になっています。`; break; }
      list.push({ label, y: ys === "" ? null : y0, m, d });
    }
    if (!msg && !list.length) msg = "推しの誕生日を1人以上入れてください。";
    err.textContent = msg; err.hidden = !msg;
    if (msg) { $("oshi-result").hidden = true; return false; }

    const cards = list.map((o) => (o.y === null
      ? dayOnlyCard(me, o.m, o.d, o.label, today)
      : fullCard(me, { y: o.y, m: o.m, d: o.d, hour: null, minute: 0 }, o.label, today)));
    const summary = list.length > 1
      ? `<h2 class="card__title">${list.length}人を並べる</h2><div class="table-scroll"><table class="spec spec--wrap oshi-table"><thead><tr><th>推し</th><th>共通点</th><th>星座</th><th>九星</th><th>宿曜</th><th>マヤ暦</th></tr></thead><tbody>${cards.map((c, i) => `<tr><th>${esc(list[i].label)}</th>${c.key.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="item__note">共通点の数は「同じものがいくつあるか」を数えただけで、相性の点数ではありません。</p>`
      : "";
    $("oshi-summary").innerHTML = summary;
    $("oshi-summary").hidden = !summary;
    $("oshi-cards").innerHTML = cards.map((c) => c.html).join("");
    shareText = ["【推しとの相性診断】", ...cards.map((c) => c.share), "", "https://hakoniwalab.com/birthday-fortune/oshi/"].join("\n");
    $("oshi-share").textContent = "結果をシェア・コピー";
    $("oshi-result").hidden = false;
    return true;
  }

  function init() {
    fillSelects("me", false, String(new Date().getFullYear() - 30));
    addOshi();
    $("oshi-add").addEventListener("click", addOshi);
    $("oshi-list").addEventListener("change", (e) => { if (e.target.matches("select")) e.target.dataset.t = "1"; });
    $("oshi-form").addEventListener("submit", (e) => { e.preventDefault(); if (render()) $("oshi-result").scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("oshi-share").addEventListener("click", async () => {
      if (navigator.share) {
        try { await navigator.share({ text: shareText }); return; } catch (e) { if (e && e.name === "AbortError") return; }
      }
      try { await navigator.clipboard.writeText(shareText); $("oshi-share").textContent = "コピーしました"; }
      catch (e) { $("oshi-share").textContent = "コピーできませんでした"; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
