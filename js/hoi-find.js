/*
 * 方位盤(hoi/)の「方角から日を探す」。方角を選ぶと、選んだ方位神がその方角にいない日を、吉日・凶日と重ねて一覧にする。
 * 方位神の有無は hoi-app.js の HOI.gods(盤・地図と同じ判定)、吉日・凶日は koyomi.js の dayKoyomi、祝日は holiday.js。
 * 入力はどこにも保存しない。依存: hoi-geo.js / hoi-app.js / holiday.js
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const WD = "日月火水木金土";
  const LIMIT = 60;
  const MIN = "1950-01-01", MAX = "2099-12-31";
  const z = (n) => String(n).padStart(2, "0");
  const iso = (dt) => `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(dt.getDate())}`;
  const GOD_NAMES = ["大将軍", "金神", "天一神", "太白神"];
  const GOOD = [["tensha", "天赦日"], ["ichiryu", "一粒万倍日"], ["taian", "大安"], ["tora", "寅の日"], ["mi", "巳の日"], ["kinoeNe", "甲子の日"], ["boso", "母倉日"], ["tenOn", "天恩日"]];
  const isGood = (k, key) => (key === "taian" ? k.rokuyo === "大安" : !!k.flags[key]);
  const checked = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);

  function badOf(k) {
    const o = [];
    if (k.flags.fujoju) o.push("不成就日");
    if (k.flags.sanrinbo) o.push("三隣亡");
    if (k.gedanBad.includes("受死日")) o.push("受死日");
    if (k.gedanBad.includes("十死日")) o.push("十死日");
    if (k.rokuyo === "仏滅") o.push("仏滅");
    return o;
  }

  /* 選んだ方角。十二支の方位はその真ん中の向き、地図で測った方角はその度のまま */
  function direction() {
    const v = $("hf-dir").value;
    if (v === "") return null;
    if (v === "map") {
      const b = window.HOI.bearing;
      if (b === null) return null;
      return { deg: b, s12: hgSector12(b), s8: hgSector8(b), label: `地図で測った方角(${b.toFixed(1)}度・${HJ_DIR[hgSector12(b)]})` };
    }
    const i = +v;
    return { deg: i * 30, s12: i, s8: hgSector8(i * 30), label: `${HJ_DIR[i]}(${HJ_BRANCH[i]})` };
  }

  function scan(dir, from, months, avoid, want, noBad, offOnly) {
    const [fy, fm, fd] = from.split("-").map(Number);
    const start = new Date(fy, fm - 1, fd);
    let end = new Date(fy, fm - 1 + months, fd - 1);
    const maxD = new Date(2099, 11, 31);
    if (end > maxD) end = maxD;
    const res = { start, end, total: 0, free: 0, blocked: Object.fromEntries(GOD_NAMES.map((n) => [n, 0])), hits: [] };
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const y = dt.getFullYear(), m = dt.getMonth() + 1, d = dt.getDate();
      const x = window.HOI.info(y, m, d);
      const g = window.HOI.gods(x, dir);
      res.total++;
      const hit = avoid.filter((n) => g[n] === "いる" || g[n] === "遊行で来ている");
      hit.forEach((n) => { res.blocked[n]++; });
      if (hit.length) continue;
      res.free++;
      const k = x.k, hol = holidayOf(y, m, d), bad = badOf(k);
      if (noBad && bad.length) continue;
      if (offOnly && !(k.weekday === 0 || k.weekday === 6 || hol)) continue;
      if (want.length && !want.some((key) => isGood(k, key))) continue;
      res.hits.push({ y, m, d, k, hol, bad, eho: !!g.恵方, away: g.金神.startsWith("留守") });
    }
    return res;
  }

  function resultHtml(r, dir, avoid) {
    const fmt = (dt) => `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
    const blocked = avoid.filter((n) => r.blocked[n]).map((n) => `${n} ${r.blocked[n]}日`).join("・");
    const whole = avoid.filter((n) => (n === "大将軍" || n === "金神") && r.blocked[n] === r.total);
    let html = `<p class="search__count">${fmt(r.start)}〜${fmt(r.end)}の${r.total}日のうち、${dir.label}に選んだ方位神がいない日は<b>${r.free}日</b>、そのうち条件に合う日は<b>${r.hits.length}日</b>です。</p>`;
    if (blocked) html += `<p class="hf-block">この方角を塞いでいる日数: ${blocked}</p>`;
    if (whole.length) html += `<p class="hf-warn">この期間はずっと、この方角に<strong>${whole.join("・")}</strong>がいます。年で決まる方位神なので、この期間は動きません(大将軍は3年同じ方位にいます)。気にしないなら「避ける方位神」のチェックを外してください。</p>`;
    if (!r.hits.length) return html + `<p class="muted">条件に合う日はありませんでした。期間を延ばすか、条件を減らしてみてください。</p>`;
    const rows = r.hits.slice(0, LIMIT).map((h) => {
      const tags = [...(h.hol ? [h.hol] : []), h.k.rokuyo, ...GOOD.filter(([key]) => key !== "taian" && isGood(h.k, key)).map(([, n]) => n), ...(h.eho ? ["恵方"] : []), ...(h.away ? ["金神は留守"] : []), ...h.bad.filter((b) => b !== "仏滅").map((b) => `(${b})`)];
      return `<li class="search__item"><button type="button" class="search__day" data-iso="${h.y}-${z(h.m)}-${z(h.d)}">${h.m}月${h.d}日<small>(${WD[h.k.weekday]}) ${h.y}年</small></button><span class="search__tags">${tags.join("・")}</span></li>`;
    }).join("");
    const more = r.hits.length > LIMIT ? `<p class="hf-block">先の${LIMIT}日だけ出しています。条件を足すと絞れます。</p>` : "";
    return html + `<ul class="search__list">${rows}</ul>${more}`;
  }

  function submit(e) {
    e.preventDefault();
    const err = $("hf-err"), out = $("hf-result");
    const dir = direction(), from = $("hf-from").value, avoid = checked("hf-god");
    let msg = "";
    if (!dir) msg = "方角を選んでください。";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from < MIN || from > MAX) msg = "1950年1月1日〜2099年12月31日の日付を選んでください。";
    else if (!avoid.length) msg = "避ける方位神を1つ以上選んでください。";
    err.textContent = msg;
    if (msg) { out.innerHTML = ""; return; }
    out.innerHTML = resultHtml(scan(dir, from, +$("hf-months").value, avoid, checked("hf-good"), $("hf-nobad").checked, $("hf-off").checked), dir, avoid);
  }

  /* 地図で方角を測ると、選択肢に「地図で測った方角」が出る */
  function onBearing(ev) {
    const sel = $("hf-dir");
    let o = sel.querySelector('option[value="map"]');
    if (ev.detail === null || ev.detail === undefined) {
      if (o) { if (sel.value === "map") sel.value = ""; o.remove(); }
      return;
    }
    if (!o) { o = new Option("", "map"); sel.insertBefore(o, sel.options[1]); }
    o.textContent = `地図で測った方角(${ev.detail.toFixed(1)}度・${HJ_DIR[hgSector12(ev.detail)]})`;
    sel.value = "map";
  }

  function init() {
    const sel = $("hf-dir");
    HJ_DIR.forEach((n, i) => sel.appendChild(new Option(`${n}(${HJ_BRANCH[i]})`, String(i))));
    const f = $("hf-from");
    f.min = MIN; f.max = MAX; f.value = iso(new Date());
    $("hf-form").addEventListener("submit", submit);
    document.addEventListener("hoi:bearing", onBearing);
    $("hf-result").addEventListener("click", (e) => {
      const b = e.target.closest(".search__day");
      if (!b) return;
      window.HOI.go(b.dataset.iso);
      $("hoi-dial").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
