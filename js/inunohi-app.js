/*
 * 戌の日カレンダー(inunohi/)の計算機。出産予定日から、安産祈願(帯祝い)の候補になる戌の日を出す。
 *   妊娠週数 … 出産予定日を40週0日として逆算(0週0日＝予定日の280日前)
 *   妊娠5か月 … 16週0日〜19週6日(4週で1か月と数える)
 *   候補      … 14週0日〜23週6日の戌の日。5か月の日を強調する
 * 入力は端末の localStorage(birthday-fortune:inunohi)にだけ保存する。
 * 妊娠中の人が見るページなので、受死日・十死日のような「死」の字の入る凶日の印は出さない(六曜と土日祝だけ)。
 * 依存: astro.js(jdn) / koyomi.js(rokuyo・ganzhiOfDayIdx) / holiday.js / oiwai.js(owYmd・owInfo)
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE = "birthday-fortune:inunohi";
  const SITE_URL = "https://hakoniwalab.com/birthday-fortune/inunohi/";
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };

  const selY = $("in-year"), selM = $("in-month"), selD = $("in-day");
  const now = new Date();
  const ty = now.getFullYear();
  const todayIdx = jdn(ty, now.getMonth() + 1, now.getDate());
  for (let y = ty - 1; y <= ty + 2; y++) selY.add(new Option(`${y}年`, y));
  for (let m = 1; m <= 12; m++) selM.add(new Option(`${m}月`, m));
  const fillDays = () => {
    const keep = Number(selD.value) || 1;
    selD.innerHTML = "";
    const n = new Date(Number(selY.value), Number(selM.value), 0).getDate();
    for (let d = 1; d <= n; d++) selD.add(new Option(`${d}日`, d));
    selD.value = String(Math.min(keep, n));
  };
  // 初めて開いたときは、今日から180日後(妊娠4か月ごろの人の予定日のあたり)を入れておく
  const def = owYmd(todayIdx + 180);
  selY.value = def.y; selM.value = def.m; fillDays(); selD.value = def.d;
  selY.addEventListener("change", fillDays);
  selM.addEventListener("change", fillDays);

  const fmt = (x) => `${x.y}年${x.m}月${x.d}日(${x.wdName})`;
  const week = (k) => `妊娠${Math.floor(k / 7)}週${k % 7}日`;
  const monthOf = (k) => Math.floor(k / 28) + 1;
  let current = null;

  function schedule(y, m, d) {
    const due = jdn(y, m, d);
    const start = due - 280;                       // 妊娠0週0日
    const items = [];
    for (let i = start + 14 * 7; i <= start + 24 * 7 - 1; i++) {
      if (ganzhiOfDayIdx(i) % 12 !== 10) continue; // 戌の日
      items.push({ idx: i, info: owInfo(i), k: i - start, month: monthOf(i - start) });
    }
    return { due: owInfo(due), start, m5: [owInfo(start + 112), owInfo(start + 139)], items };
  }

  function render(y, m, d) {
    const s = schedule(y, m, d);
    const rows = s.items.map((it) => {
      const past = it.idx < todayIdx;
      const tags = [it.info.rokuyo, it.info.holiday].filter(Boolean).map((t) =>
        `<span class="ow-tag${t === "大安" ? " ow-tag--taian" : ""}">${esc(t)}</span>`).join("");
      return `<div class="ow-item${past ? " is-past" : ""}${it.month === 5 ? " is-main" : ""}">
        <p class="ow-item__name">${it.month === 5 ? "5か月の戌の日" : `${it.month}か月の戌の日`}${past ? "<small>過ぎた日</small>" : ""}</p>
        <p class="ow-item__date">${esc(fmt(it.info))}${it.info.rokuyo === "大安" && it.info.isRest ? "★" : ""}${tags}</p>
        <p class="ow-item__sub">${esc(week(it.k))}${it.info.isRest ? "・土日祝" : ""}</p>
      </div>`;
    }).join("");
    const n5 = s.items.filter((x) => x.month === 5).length;
    $("in-result-body").innerHTML = `
      <p class="ow-head">出産予定日 ${esc(fmt(s.due))}</p>
      <p class="ow-lead">妊娠5か月(16週0日〜19週6日)は ${esc(fmt(s.m5[0]))}〜${esc(fmt(s.m5[1]))} で、この間の戌の日は${n5}日です。前後の4か月・6か月の戌の日も並べています。★は大安の土日祝。</p>
      ${rows}`;
    current = s;
    $("in-result").hidden = false;
    $("in-status").textContent = "";
  }

  $("in-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = { y: Number(selY.value), m: Number(selM.value), d: Number(selD.value) };
    try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (err) { /* 保存できなくても表示はする */ }
    render(v.y, v.m, v.d);
    $("in-result").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* 家族に送る(共有APIはクリック直後にしか呼べないので、ここで分岐する) */
  $("in-share").addEventListener("click", async () => {
    if (!current) return;
    const lines = [`【安産祈願(戌の日)の候補】出産予定日 ${fmt(current.due)}`];
    for (const it of current.items.filter((x) => x.month === 5 && x.idx >= todayIdx)) {
      lines.push(`・${fmt(it.info)} ${it.info.rokuyo || ""}${it.info.holiday ? " " + it.info.holiday : ""}(${week(it.k)})`);
    }
    if (lines.length === 1) lines.push("妊娠5か月の戌の日はすべて過ぎています");
    lines.push(SITE_URL);
    const text = lines.join("\n");
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); $("in-status").textContent = "候補日をコピーしました。LINEやメールに貼り付けて送れます"; }
    catch (err) { $("in-status").textContent = "コピーできませんでした"; }
  });

  /* 前回の入力があれば、開いた時点で出す */
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && saved.y && saved.m && saved.d) {
      if (![...selY.options].some((o) => Number(o.value) === saved.y)) selY.add(new Option(`${saved.y}年`, saved.y));
      selY.value = saved.y; selM.value = saved.m; fillDays(); selD.value = saved.d;
      render(saved.y, saved.m, saved.d);
    }
  } catch (err) { /* 読めなければ空のまま */ }
})();
