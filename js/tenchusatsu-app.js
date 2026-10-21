/*
 * 天中殺の計算機(tenchusatsu/)の画面。計算は js/tenchusatsu.js。
 * 生年月日 → 種類(6種)、年の天中殺(前回・2026〜2035年・次回)、月の天中殺(2026〜2035年)、これから30日の日の天中殺。
 * 入力は端末の localStorage(birthday-fortune:tenchusatsu)にだけ保存する。
 * 初めて開いたときは、生まれ日診断で入れた生年月日(birthday-fortune:birth)があればそれを入れておく。
 * 依存: astro.js / chart.js / tenchusatsu.js
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE = "birthday-fortune:tenchusatsu";
  const BIRTH = "birthday-fortune:birth";
  const FROM_Y = 2026, TO_Y = 2035;
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };

  const selY = $("tc-year"), selM = $("tc-month"), selD = $("tc-day");
  const now = new Date();
  const ty = now.getFullYear();
  const todayIdx = jdn(ty, now.getMonth() + 1, now.getDate());
  for (let y = ty; y >= 1920; y--) selY.add(new Option(`${y}年`, y));
  for (let m = 1; m <= 12; m++) selM.add(new Option(`${m}月`, m));
  const fillDays = () => {
    const keep = Number(selD.value) || 1;
    selD.innerHTML = "";
    const n = new Date(Number(selY.value), Number(selM.value), 0).getDate();
    for (let d = 1; d <= n; d++) selD.add(new Option(`${d}日`, d));
    selD.value = String(Math.min(keep, n));
  };
  selY.value = "1990"; fillDays();
  selY.addEventListener("change", fillDays);
  selM.addEventListener("change", fillDays);

  const range = (p) => `${tcsFmt(p.start)} 〜 ${tcsFmt(p.end)}`;
  const timeNote = (p) => `${p.start.name}の時刻で切る流派では ${p.start.y}年${p.start.m}月${p.start.d}日 ${tcsTime(p.start)}から、${p.next.y}年${p.next.m}月${p.next.d}日 ${tcsTime(p.next)}まで`;

  function stateOf(p) {
    if (p.end.idx < todayIdx) return "past";
    if (p.start.idx > todayIdx) return "future";
    return "now";
  }

  function yearRows(t) {
    const list = tcsYearPeriods(t.branches, FROM_Y - 14, TO_Y + 12);
    // 2026〜2035年にかかるもの、その直前の1回、2035年より後の最初の1回
    const inRange = list.filter((p) => p.years[1] >= FROM_Y && p.years[0] <= TO_Y);
    const before = list.filter((p) => p.years[1] < FROM_Y).slice(-1);
    const after = list.filter((p) => p.years[0] > TO_Y).slice(0, 1);
    const show = inRange.length ? [...before, ...inRange, ...after] : [...before, ...after];
    let nFuture = 0;
    return show.map((p) => {
      const st = stateOf(p);
      const label = st === "now" ? "いま年の天中殺です" : st === "past" ? "前回" : (nFuture++ === 0 ? "次回" : "その次");
      const yk = p.years.map((Y) => `${Y}年(${tcsKanshi(((Y - 4) % 60 + 60) % 60)})`).join("・");
      return `<div class="tc-item is-${st}">
        <p class="tc-item__name">${esc(label)}<small>${esc(yk)}</small></p>
        <p class="tc-item__date">${esc(range(p))}</p>
        <p class="tc-item__sub">${esc(timeNote(p))}</p>
      </div>`;
    }).join("");
  }

  function monthRows(t) {
    return tcsMonthPeriods(t.branches, FROM_Y, TO_Y).map((p) => {
      const st = stateOf(p);
      const inYear = tcsStatusOn(t.branches, p.start.idx).year;
      return `<tr class="is-${st}"><th>${p.year}年</th><td><span class="nw">${esc(tcsFmt(p.start, false))}</span> 〜 <span class="nw">${esc(tcsFmt(p.end, p.end.y !== p.start.y))}</span>${st === "now" ? '<small class="tc-now">いまここ</small>' : ""}${inYear ? '<small class="tc-both">年と重なる</small>' : ""}</td></tr>`;
    }).join("");
  }

  function dayRows(t) {
    const days = tcsDays(t.branches, todayIdx, 30);
    return days.map((x) => `<span class="nw${x.idx === todayIdx ? " tc-today" : ""}">${esc(`${x.m}月${x.d}日(${TCS_WD[x.wd]})`)}<small>${esc(x.branch)}</small></span>`).join("、");
  }

  function render(y, m, d) {
    const t = tcsTypeOf(y, m, d);
    const st = tcsStatusOn(t.branches, todayIdx);
    // 23時で日を変える流派では翌日の干支になる。旬の変わり目(癸の日)だけ種類が変わる
    const nx = tcsDay(jdn(y, m, d) + 1);
    const t2 = tcsTypeOf(nx.y, nx.m, nx.d);
    const now = [];
    if (st.year) now.push("年の天中殺");
    if (st.month) now.push("月の天中殺");
    if (st.day) now.push("日の天中殺");
    const nowText = now.length
      ? `今日(${tcsFmt(tcsDay(todayIdx))})は<b>${esc(now.join("・"))}</b>にあたります。`
      : `今日(${tcsFmt(tcsDay(todayIdx))})は、年・月・日のどれも天中殺にあたりません。`;

    $("tc-result-body").innerHTML = `
      <p class="tc-type">${esc(t.name)}天中殺<small>${esc(t.yomi)}てんちゅうさつ</small></p>
      <p class="tc-lead">生まれた日の干支(日柱)は<b>${esc(t.dayKanshi)}</b>です。${esc(t.jun)}から始まる10日ひと組(${esc(t.members[0])}〜${esc(t.members[9])})には「${esc(t.name[0])}」と「${esc(t.name[1])}」の十二支が入らないので、${esc(t.name)}天中殺になります。四柱推命では「空亡 ${esc(t.name)}」と書きます。</p>
      <p class="tc-now-text">${nowText}</p>
      ${t2.name !== t.name ? `<p class="item__note item__note--warn">※ 23時から0時の間に生まれた方へ: 23時で日付を変える流派では、日柱が翌日の${esc(t2.dayKanshi)}になり、<b>${esc(t2.name)}天中殺</b>になります。この計算機は0時で日付を変えています。</p>` : ""}

      <h3 class="tc-h">年の天中殺(12年に一度・2年間)</h3>
      <p class="tc-note">年は立春で切り替わります。日付は節入りの日を丸一日新しい年として数えた期間です。</p>
      ${yearRows(t)}

      <h3 class="tc-h">月の天中殺(毎年2か月) 2026〜2035年</h3>
      <p class="tc-note">${esc(t.name[0])}月と${esc(t.name[1])}月。月はカレンダーの1日ではなく節入り(${esc(tcsSetsu(FROM_Y, t.branches[0]).name)}・${esc(tcsSetsuAfter(FROM_Y, t.branches[0], 1).name)})で切り替わるので、始まりと終わりの日は年によって1日ずれます。</p>
      <div class="table-scroll"><table class="spec spec--wrap tc-months"><tbody>${monthRows(t)}</tbody></table></div>

      <h3 class="tc-h">日の天中殺(12日に2日) これから30日</h3>
      <p class="tc-days">${dayRows(t)}</p>`;
    $("tc-result").hidden = false;
  }

  $("tc-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = { y: Number(selY.value), m: Number(selM.value), d: Number(selD.value) };
    try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (err) { /* 保存できなくても表示はする */ }
    render(v.y, v.m, v.d);
    $("tc-result").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* 前回の入力(なければ生まれ日診断の生年月日)があれば、開いた時点で出す */
  try {
    let saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!(saved && saved.y)) saved = JSON.parse(localStorage.getItem(BIRTH) || "null");
    if (saved && saved.y && saved.m && saved.d) {
      if (![...selY.options].some((o) => Number(o.value) === saved.y)) selY.add(new Option(`${saved.y}年`, saved.y));
      selY.value = saved.y; selM.value = saved.m; fillDays(); selD.value = saved.d;
      render(saved.y, saved.m, saved.d);
    }
  } catch (err) { /* 読めなければ空のまま */ }
})();
