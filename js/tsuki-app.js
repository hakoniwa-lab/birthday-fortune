/*
 * 生まれた日の月の形(tsuki/)の画面。計算は js/tsuki.js。
 * 自分の生年月日は端末の localStorage(birthday-fortune:tsuki)にだけ保存する。相手の生年月日は保存しない。
 * 初めて開いたときは、生まれ日診断で入れた生年月日(birthday-fortune:birth)があればそれを入れておく。
 * 依存: astro.js / fortune.js / chart.js / data.js / koyomi.js / tsuki.js
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE = "birthday-fortune:tsuki";
  const BIRTH = "birthday-fortune:birth";
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
  const now = new Date();
  const ty = now.getFullYear();

  function fillDate(prefix, defY) {
    const sy = $(prefix + "-year"), sm = $(prefix + "-month"), sd = $(prefix + "-day"), sh = $(prefix + "-hour");
    for (let y = ty; y >= 1920; y--) sy.add(new Option(`${y}年`, y));
    for (let m = 1; m <= 12; m++) sm.add(new Option(`${m}月`, m));
    sh.add(new Option("時刻は分からない(正午で計算)", ""));
    for (let h = 0; h < 24; h++) sh.add(new Option(`${h}時ごろ`, h));
    const fillDays = () => {
      const keep = Number(sd.value) || 1;
      sd.innerHTML = "";
      const n = new Date(Number(sy.value), Number(sm.value), 0).getDate();
      for (let d = 1; d <= n; d++) sd.add(new Option(`${d}日`, d));
      sd.value = String(Math.min(keep, n));
    };
    sy.value = String(defY);
    fillDays();
    sy.addEventListener("change", fillDays);
    sm.addEventListener("change", fillDays);
    return {
      get: () => ({ y: Number(sy.value), m: Number(sm.value), d: Number(sd.value), hh: sh.value === "" ? null : Number(sh.value) }),
      set: (v) => { sy.value = String(v.y); sm.value = String(v.m); fillDays(); sd.value = String(v.d); if (v.hh != null) sh.value = String(v.hh); },
    };
  }

  const me = fillDate("tk", 1990);
  const partner = fillDate("tp", 1990);
  const pBox = $("tk-partner"), pToggle = $("tk-partner-on");

  try {
    let saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!(saved && saved.y)) saved = JSON.parse(localStorage.getItem(BIRTH) || "null");
    if (saved && saved.y && saved.m && saved.d) me.set(saved);
  } catch (err) { /* 読めなくても初期値で動く */ }

  pToggle.addEventListener("change", () => { pBox.hidden = !pToggle.checked; });

  const css = getComputedStyle(document.documentElement);
  const litColor = () => (css.getPropertyValue("--tk-lit") || "#f3d98b").trim();
  const darkColor = () => (css.getPropertyValue("--tk-dark") || "#2b2a33").trim();
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const lunarText = (l) => l ? `旧暦${l.leap ? "閏" : ""}${l.num}月${l.day}日` : "";

  function moonBlock(t, who) {
    const name = MOON[t.phase].name;
    const range = t.timeGiven ? null : tsukiDayRange(t.y, t.m, t.d);
    const rangeText = range ? `その日のうちに ${pct(range.min)}〜${pct(range.max)} のあいだで変わります(正午の形を描いています)。` : `${t.hh}時ごろの形です。`;
    return `<div class="tk-moon">
      <div class="tk-moon__art">${tsukiSvg(t.elong, 180, { lit: litColor(), dark: darkColor(), label: `${who}の月 ${name}` })}</div>
      <div class="tk-moon__text">
        <p class="tk-moon__who">${esc(who)}(${t.y}年${t.m}月${t.d}日)</p>
        <p class="tk-moon__name">${esc(name)}</p>
        <ul class="tk-facts">
          <li>月齢 <strong>${t.age.toFixed(1)}</strong>(新月から${t.age.toFixed(1)}日)</li>
          <li>光って見える割合 <strong>${pct(t.illum)}</strong>(${t.waxing ? "満ちていく月。右側が光る" : "欠けていく月。左側が光る"})</li>
          <li>${esc(lunarText(t.lunar))}${t.kosho ? `。昔の呼び名は<strong>「${esc(t.kosho)}」</strong>` : ""}</li>
        </ul>
        <p class="tk-small">${esc(rangeText)}</p>
      </div>
    </div>`;
  }

  function render() {
    const a = me.get();
    try { localStorage.setItem(STORE, JSON.stringify(a)); } catch (err) { /* 保存できなくても表示はする */ }
    const t1 = tsukiOfDate(a.y, a.m, a.d, a.hh, 0);
    let html = moonBlock(t1, "あなた");
    html += `<p class="tk-text">${esc(MOON[t1.phase].text)}</p>`;
    if (pToggle.checked) {
      const b = partner.get();
      const t2 = tsukiOfDate(b.y, b.m, b.d, b.hh, 0);
      const ov = tsukiOverlay(t1.elong, t2.elong);
      const same = t1.waxing === t2.waxing;
      const msg = ov >= 0.9995
        ? "二人の月を重ねると、<strong>満月</strong>になります。"
        : same
          ? `二人とも${t1.waxing ? "満ちていく" : "欠けていく"}月なので、重ねても明るい方の月の形(${pct(ov)})のままです。満月にするには、光る側が反対の月が要ります。`
          : `重ねると、光っている部分は<strong>${pct(ov)}</strong>。満月まであと${pct(1 - ov)}です。`;
      html += `<h3 class="tk-h">二人の月を重ねる</h3>`
        + moonBlock(t2, "相手")
        + `<div class="tk-moon tk-moon--union">
            <div class="tk-moon__art">${tsukiSvgUnion(t1.elong, t2.elong, 180, { lit: litColor(), dark: darkColor() })}</div>
            <div class="tk-moon__text"><p class="tk-moon__name">重ねた月</p><p class="tk-text">${msg}</p>
            <p class="tk-small">満ちていく月(右が光る)と欠けていく月(左が光る)を重ねると、光る部分は二人の割合を足したもの(100%で頭打ち)になります。同じ向きの月どうしだと、明るい方の月にもう一方がすっぽり入ります。</p></div>
          </div>`;
    }
    $("tk-result-body").innerHTML = html;
    $("tk-result").hidden = false;
  }

  $("tk-form").addEventListener("submit", (e) => {
    e.preventDefault();
    render();
    $("tk-result").scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
