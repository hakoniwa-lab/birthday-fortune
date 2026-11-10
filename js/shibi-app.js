/*
 * 紫微斗数の命盤ページ(shibi/)の画面。計算は shibi.js。
 * 入力した生年月日・時刻はどこにも保存せず、URL にも入れない。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const B = SB_BRANCH, S = SB_STEM;
  const LUCKY = ["文昌", "文曲", "左輔", "右弼", "天魁", "天鉞", "禄存", "天馬"];
  const SIKA_SHORT = { 化禄: "禄", 化権: "権", 化科: "科", 化忌: "忌" };
  // 盤の並び(上の段の左から 巳午未申、右の列 酉戌、下の段の右から 亥子丑寅、左の列 卯辰)
  const GRID = { 5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4], 9: [2, 4], 10: [3, 4], 11: [4, 4], 0: [4, 3], 1: [4, 2], 2: [4, 1], 3: [3, 1], 4: [2, 1] };
  const HOUR_RANGE = SB_HOUR_RANGE;
  const STAR_NOTE = {
    紫微: ["帝座", "人の上に立つ星。誇りが高く、まとめ役や責任のある立場に縁があるとされます。"],
    天機: ["善の星", "知恵と変化の星。頭の回転が速く、企画や段取りに向くとされます。"],
    太陽: ["貴の星", "光を配る星。表に立ち、人のために動くことで力を出すとされます。"],
    武曲: ["財の星", "お金と決断の星。実務に強く、思い切りがよいとされます。"],
    天同: ["福の星", "穏やかさの星。争いを好まず、暮らしを楽しむ力があるとされます。"],
    廉貞: ["囚の星", "こだわりの星。規律と情熱の両面を持ち、一つの道を突き詰めるとされます。"],
    天府: ["令の星", "蔵の星。蓄える・守る・まとめる力があり、安定を好むとされます。"],
    太陰: ["富の星", "月の星。細やかで内面が豊か、家や財産に縁があるとされます。"],
    貪狼: ["桃花の星", "欲と才の星。好奇心が強く多芸で、人付き合いが広いとされます。"],
    巨門: ["暗の星", "言葉の星。弁が立ち、物事を疑って深く調べる力があるとされます。"],
    天相: ["印の星", "補佐の星。礼儀正しく公正で、人を支える立場で生きるとされます。"],
    天梁: ["蔭の星", "守りの星。面倒見がよく、年長者や助け手の役回りになるとされます。"],
    七殺: ["将の星", "切り込み役の星。独立心と行動力があり、一人で道を開くとされます。"],
    破軍: ["耗の星", "壊して作り直す星。古いものを変える力と、変化の多さがあるとされます。"],
  };
  const OPT_LABEL = SB_OPT_LABEL, OPT_NAME = SB_OPT_NAME;

  function readOpt() {
    const v = (n) => { const el = document.querySelector(`input[name="sb-${n}"]:checked`); return el ? el.value : SB_DEFAULT_OPT[n]; };
    return { cal: v("cal"), yearDiv: v("yearDiv"), leap: v("leap"), lateZi: v("lateZi"), lonFix: v("lonFix") === "true", geng: v("geng"), ren: v("ren") };
  }
  function setOpt(name, value) {
    const el = document.querySelector(`input[name="sb-${name}"][value="${value}"]`);
    if (el) el.checked = true;
  }

  function readInput() {
    const dv = $("sb-date").value;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dv);
    if (!m) return { err: "生年月日を入れてください。" };
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1901 || y > 2099) return { err: "1901年〜2099年の日付を入れてください。" };
    let hour = null, minute = null;
    if (!$("sb-notime").checked) {
      const t = /^(\d{2}):(\d{2})/.exec($("sb-time").value);
      if (!t) return { err: "生まれた時刻を入れるか、「時刻が分からない」にチェックを入れてください。" };
      hour = +t[1]; minute = +t[2];
    }
    const sex = (document.querySelector('input[name="sb-sex"]:checked') || {}).value || "";
    const pi = $("sb-pref").value;
    const lon = pi === "" ? null : PREFS[+pi][2];
    return { y, m: mo, d, hour, minute, sex: sex || null, lon, prefName: pi === "" ? null : PREFS[+pi][0] };
  }

  const lunarText = (l) => `${l.year}年${l.leap ? "閏" : ""}${l.num}月${l.day}日`;

  function starHtml(s, cls) {
    const k = s.sika ? `<b class="sb-k sb-k--${SIKA_SHORT[s.sika]}" title="${s.sika}">${SIKA_SHORT[s.sika]}</b>` : "";
    return `<span class="${cls}">${esc(s.name)}${k}</span>`;
  }

  function boardHtml(c) {
    let cells = "";
    for (const p of c.palaces) {
      const [r, col] = GRID[p.branch];
      const major = p.major.map((s) => starHtml(s, "sb-major")).join("");
      const minor = p.minor.map((s) => starHtml(s, LUCKY.includes(s.name) ? "sb-minor" : "sb-minor sb-minor--bad")).join("");
      const tg = p.taigen ? `<span class="sb-tg">${p.taigen[0]}〜${p.taigen[1]}歳</span>` : "";
      cells += `<div class="sb-cell${p.branch === c.mei ? " sb-cell--mei" : ""}" style="grid-row:${r};grid-column:${col}">`
        + `<div class="sb-head"><span class="sb-pname">${p.name}</span>${p.body ? '<span class="sb-body">身</span>' : ""}</div>`
        + `<div class="sb-stars">${major || '<span class="sb-empty">主星なし</span>'}</div>`
        + `<div class="sb-minors">${minor}</div>`
        + `<div class="sb-foot"><span class="sb-gz">${S[p.stem]}${B[p.branch]}</span>${tg}</div></div>`;
    }
    const b = c.birth;
    const center = `<div class="sb-center" style="grid-row:2/4;grid-column:2/4">`
      + `<p><span>旧暦</span>${lunarText(b.lunar)}</p>`
      + `<p><span>生まれ年</span>${S[b.yStem]}${B[b.yBranch]}年</p>`
      + `<p><span>時辰</span>${B[b.hourBranch]}の刻</p>`
      + `<p><span>五行局</span>${c.kyokuName}(${c.nayin})</p>`
      + `<p><span>命主</span>${c.meishu}　<span>身主</span>${c.shinshu}</p>`
      + `</div>`;
    return `<div class="sb-board" role="img" aria-label="紫微斗数の命盤">${cells}${center}</div>`;
  }

  function meiHtml(c) {
    const ms = sbMeiStars(c);
    const p = c.palaces[c.mei];
    const lead = ms.borrowed
      ? `命宮(${S[p.stem]}${B[p.branch]})には主星がありません。この場合は向かいの遷移宮の主星(${ms.stars.join("・")})を借りて読むのが通例です。`
      : `命宮(${S[p.stem]}${B[p.branch]})の主星は <strong>${ms.stars.join("・")}</strong> です。`;
    const items = ms.stars.map((n) => `<li><strong>${n}</strong>(全書では「${STAR_NOTE[n][0]}」)— ${STAR_NOTE[n][1]}</li>`).join("");
    const shin = c.shin === c.mei ? "身宮は命宮と同じ宮です。" : `身宮は${c.palaces[c.shin].name}(${B[c.shin]})にあります。`;
    const sika = c.sika.map((s, i) => `${s}${SB_SIKA_NAME[i]}`).join("・");
    return `<h2 class="sb-h">命宮の星</h2><p>${lead}</p><ul class="sb-notes">${items}</ul>`
      + `<p class="sb-small">${shin}生まれ年の四化は ${sika} です。</p>`;
  }

  function diffText(base, v) {
    const out = [];
    const bl = base.birth.lunar, vl = v.birth.lunar;
    if (lunarText(bl) !== lunarText(vl)) out.push(`旧暦の日付 ${lunarText(bl)} → ${lunarText(vl)}`);
    if (base.birth.year !== v.birth.year) out.push(`生まれ年 ${S[base.birth.yStem]}${B[base.birth.yBranch]} → ${S[v.birth.yStem]}${B[v.birth.yBranch]}`);
    if (base.birth.month !== v.birth.month) out.push(`命宮を出す月 ${base.birth.month}月 → ${v.birth.month}月`);
    if (base.birth.hourBranch !== v.birth.hourBranch) out.push(`時辰 ${B[base.birth.hourBranch]} → ${B[v.birth.hourBranch]}`);
    if (base.mei !== v.mei) out.push(`命宮の位置 ${B[base.mei]} → ${B[v.mei]}`);
    if (base.kyoku !== v.kyoku) out.push(`五行局 ${base.kyokuName} → ${v.kyokuName}`);
    const a = sbMeiStars(base), b = sbMeiStars(v);
    if (a.stars.join() !== b.stars.join()) out.push(`命宮の主星 ${a.stars.join("・")}${a.borrowed ? "(借り)" : ""} → <strong>${b.stars.join("・")}${b.borrowed ? "(借り)" : ""}</strong>`);
    if (base.sika.join() !== v.sika.join()) out.push(`四化 ${base.sika.join("・")} → ${v.sika.join("・")}`);
    return out;
  }

  function variantsHtml(inp, opt, base) {
    const rows = [];
    const b = base.birth;
    const tries = [];
    tries.push(["cal", opt.cal === "jp" ? "cn" : "jp"]);
    tries.push(["yearDiv", opt.yearDiv === "lunar" ? "risshun" : "lunar"]);
    if (b.lunar.leap) for (const v of ["split", "next", "same"]) if (v !== opt.leap) tries.push(["leap", v]);
    if (b.lateZi) tries.push(["lateZi", opt.lateZi === "next" ? "same" : "next"]);
    if (inp.lon) tries.push(["lonFix", String(!opt.lonFix)]);
    if (b.yStem === 6) tries.push(["geng", opt.geng === "yin" ? "tong" : "yin"]);
    if (b.yStem === 8) tries.push(["ren", opt.ren === "zuo" ? "fu" : "zuo"]);
    let changed = 0;
    for (const [k, val] of tries) {
      const o = Object.assign({}, opt, { [k]: k === "lonFix" ? val === "true" : val });
      const v = shibiChart(inp, o);
      const d = diffText(base, v);
      if (d.length) changed++;
      rows.push(`<tr><th>${OPT_NAME[k]}を「${OPT_LABEL[k][val]}」にすると</th><td>${d.length ? d.join("<br>") : "変わりません"}`
        + (d.length ? `<br><button type="button" class="sb-apply" data-k="${k}" data-v="${val}">この数え方で見る</button>` : "") + `</td></tr>`);
    }
    const head = changed
      ? `<p>あなたの生まれ日時では、数え方を1つ変えるだけで <strong>${changed}か所</strong> の選び方で命盤が変わります。サイトや本によって命盤が違って見えるのは、このためです。</p>`
      : `<p>あなたの生まれ日時は、下のどの数え方に切り替えても命盤が変わりません。</p>`;
    return `<h2 class="sb-h">数え方を変えると</h2>${head}<div class="table-scroll"><table class="spec spec--wrap sb-var"><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function hoursHtml(inp, opt) {
    const rows = [];
    for (let h = 0; h < 12; h++) {
      const hour = h === 0 ? 0 : h * 2 - 1;
      const c = shibiChart(Object.assign({}, inp, { hour, minute: 30, lon: null }), Object.assign({}, opt, { lonFix: false }));
      const ms = sbMeiStars(c);
      rows.push(`<tr><th>${B[h]}の刻<br><span class="sb-small">${HOUR_RANGE[h]}</span></th><td>${B[c.mei]}</td><td>${ms.stars.join("・")}${ms.borrowed ? "(借り)" : ""}</td><td>${c.kyokuName}</td>`
        + `<td><button type="button" class="sb-pick" data-hour="${String(hour).padStart(2, "0")}:30">見る</button></td></tr>`);
    }
    return `<h2 class="sb-h">時刻が分からないとき</h2><p>命宮は生まれた時刻(時辰)で決まるので、時刻が分からないと12通りに分かれます。子の刻は0時台で出しています(23時台は日付が変わる数え方があるため)。</p>`
      + `<div class="table-scroll"><table class="spec sb-hours"><thead><tr><th>時辰</th><th>命宮</th><th>命宮の主星</th><th>五行局</th><th></th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function render() {
    const inp = readInput();
    const err = $("sb-error");
    if (inp.err) { err.textContent = inp.err; err.hidden = false; $("sb-result").hidden = true; return; }
    err.hidden = true;
    const opt = readOpt();
    let out = "";
    if (inp.hour === null) {
      const b = sbBirth(inp, opt);
      out = `<p class="sb-small">旧暦 ${lunarText(b.lunar)}・生まれ年 ${S[b.yStem]}${B[b.yBranch]}年</p>` + hoursHtml(inp, opt);
    } else {
      const c = shibiChart(inp, opt);
      const b = c.birth;
      const notes = [];
      if (b.shiftMin) notes.push(`${inp.prefName}の経度で時刻を${b.shiftMin > 0 ? "+" : ""}${b.shiftMin}分直しています。`);
      if (b.lateZi) notes.push(`23時台の生まれは子の刻です。日付は「${OPT_LABEL.lateZi[opt.lateZi]}」で出しています。`);
      if (b.lunar.leap) notes.push(`閏${b.lunar.num}月の生まれです。命宮は${b.month}月として数えています(${OPT_LABEL.leap[opt.leap]})。`);
      if (!inp.sex) notes.push("性別を選ぶと、各宮に大限(10年ごとの運)の年齢を出します。");
      out = boardHtml(c)
        + `<p class="sb-legend"><span class="sb-major">主星</span> <span class="sb-minor">吉星</span> <span class="sb-minor sb-minor--bad">煞星</span> <b class="sb-k sb-k--禄">禄</b><b class="sb-k sb-k--権">権</b><b class="sb-k sb-k--科">科</b><b class="sb-k sb-k--忌">忌</b> 四化 ・<span class="sb-body">身</span> 身宮・太枠が命宮</p>`
        + (notes.length ? `<p class="sb-small">${notes.join("<br>")}</p>` : "")
        + meiHtml(c) + variantsHtml(inp, opt, c);
    }
    $("sb-result-body").innerHTML = out;
    $("sb-result").hidden = false;
  }

  function init() {
    const sel = $("sb-pref");
    sel.appendChild(new Option("選ばない", ""));
    PREFS.forEach(([name], i) => sel.appendChild(new Option(name, i)));
    $("sb-notime").addEventListener("change", () => { $("sb-time").disabled = $("sb-notime").checked; });
    $("sb-form").addEventListener("submit", (e) => { e.preventDefault(); render(); $("sb-result").scrollIntoView({ behavior: "smooth", block: "start" }); });
    document.querySelectorAll('#sb-opts input').forEach((el) => el.addEventListener("change", () => { if (!$("sb-result").hidden) render(); }));
    $("sb-result").addEventListener("click", (e) => {
      const a = e.target.closest(".sb-apply");
      if (a) { setOpt(a.dataset.k, a.dataset.v); $("sb-opts").open = true; render(); return; }
      const p = e.target.closest(".sb-pick");
      if (p) { $("sb-notime").checked = false; $("sb-time").disabled = false; $("sb-time").value = p.dataset.hour; render(); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
