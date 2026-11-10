/*
 * 紫微斗数の流年ページ(shibi/ryunen/)の画面。計算は shibi.js と shibi-ryunen.js、盤面は shibi-board.js。
 * 入力した生年月日・時刻はどこにも保存せず、URL にも入れない。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const B = SB_BRANCH, S = SB_STEM;
  const OPT_KEYS = ["cal", "lateZi", "yearDiv", "leap", "geng", "ren"];
  const SHORT = SB_SIKA_SHORT;
  const DIFF_LABEL = { natal: "流年命宮の位置(命盤の宮)", stars: "流年命宮の主星", age: "数え年", shogen: "小限の宮", taigen: "大限の宮", sika: "流年の四化" };
  const palace = (n) => `<strong>${n}</strong><span class="sb-small">(${SB_PALACE_MEANS[n]})</span>`;
  const starsTxt = (m) => m.stars.join("・") + (m.borrowed ? `<span class="sb-small">(向かいの宮から借りる)</span>` : "");
  const gz = (y) => `${S[sbYearStem(y)]}${B[sbYearBranch(y)]}`;
  const table = (head, rows, cls) => `<div class="table-scroll"><table class="spec spec--wrap sb-wrap ${cls || ""}">`
    + (head ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` : "")
    + `<tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join("")}</tr>`).join("")}</tbody></table></div>`;

  function readOpt() {
    const v = (n) => { const el = document.querySelector(`input[name="sb-${n}"]:checked`); return el ? el.value : SB_DEFAULT_OPT[n]; };
    const o = { lonFix: false };
    OPT_KEYS.forEach((k) => { o[k] = v(k); });
    return o;
  }
  const readFrom = () => { const el = document.querySelector('input[name="sb-taigen"]:checked'); return el ? el.value : "mei"; };
  function setOpt(name, value) {
    const el = document.querySelector(`input[name="sb-${name}"][value="${value}"]`);
    if (el) el.checked = true;
  }

  function readInput() {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec($("sr-date").value);
    if (!m) return { err: "生年月日を入れてください。" };
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1901 || y > 2099) return { err: "1901年〜2099年の日付を入れてください。" };
    let hour = null, minute = null;
    if (!$("sr-notime").checked) {
      const t = /^(\d{2}):(\d{2})/.exec($("sr-time").value);
      if (!t) return { err: "生まれた時刻を入れるか、「時刻が分からない」にチェックを入れてください。" };
      hour = +t[1]; minute = +t[2];
    }
    const sex = (document.querySelector('input[name="sr-sex"]:checked') || {}).value || "";
    return { y, m: mo, d, hour, minute, sex: sex || null, lon: null };
  }

  function summaryHtml(c, r, sex) {
    const ny = sbLunarNewYear(r.year, c.opt.cal === "cn" ? 8 : 9);
    const rows = [["流年命宮", `${B[r.branch]}の宮 ＝ あなたの命盤の${palace(r.natal)}<br>主星: ${starsTxt(r.stars)}`]];
    if (sex) {
      rows.push(["小限", r.shogen ? `${B[r.shogen.branch]}の宮 ＝ ${palace(r.shogen.palace)}<br>主星: ${starsTxt(r.shogen.stars)}` : "この年はまだ生まれていません"]);
      rows.push(["大限", r.taigen ? `${r.taigen.from}〜${r.taigen.to}歳 ${B[r.taigen.branch]}の宮 ＝ ${palace(r.taigen.palace)}`
        : (r.beforeFirst ? `最初の大限(${c.kyoku}歳から)の前です` : "大限の表の外です")]);
    }
    const sa = r.age >= 1 ? `数え年は${r.age}歳です。` : "この年はまだ生まれていません。";
    return `<h2 class="sb-h">${r.year}年(${gz(r.year)})の流年</h2>`
      + `<p class="sb-small">${ny ? `旧暦の年で数えるので、${r.year}年の流年は旧正月の${ny.m}月${ny.d}日から翌年の旧正月の前日までです。` : ""}${sa}</p>`
      + table(null, rows)
      + (sex ? "" : `<p class="sb-small">性別を選ぶと、小限と大限も出します。</p>`);
  }

  function sikaHtml(r) {
    const rows = r.sika.map((s) => [
      `${s.kind}<span class="sb-small">(${SB_SIKA_MEANS[s.kind]})</span>`,
      `${s.star}${s.natal ? `<span class="sb-small">(生まれ年の${s.natal}と同じ星)</span>` : ""}`,
      palace(s.palace),
      s.flow,
    ]);
    return `<h2 class="sb-h">流年の四化</h2><p class="sb-small">その年の十干(${S[r.stem]})で決まる4つの星が、あなたの命盤のどの宮にあるかです。「流年の宮」は、流年命宮から並べ直した十二宮での名前です。</p>`
      + table(["四化", "星", "命盤の宮", "流年の宮"], rows);
  }

  function overlapHtml(r) {
    const o = [];
    if (r.sameTaigen) o.push("流年命宮と大限が同じ宮に重なっています。");
    if (r.sameShogen) o.push("流年命宮と小限が同じ宮に重なっています。");
    if (r.taigen && r.shogen && r.taigen.branch === r.shogen.branch) o.push("大限と小限が同じ宮に重なっています。");
    r.sika.filter((s) => s.natal).forEach((s) => o.push(`${s.star}は、生まれ年の${s.natal}とこの年の${s.kind}が同じ星に付いています(${s.palace})。`));
    if (!o.length) return "";
    return `<h2 class="sb-h">この年に重なっていること</h2><ul class="sb-notes">${o.map((x) => `<li>${x}</li>`).join("")}</ul>`
      + `<p class="sb-small">重なった宮の話題が目立ちやすい、と説明されることがあります。良い悪いを決めるものではありません。</p>`;
  }

  function boardWithFlow(c, r) {
    const flowOf = {};
    r.sika.forEach((s) => { flowOf[s.star] = s.kind; });
    const deco = {
      cls: (p) => (p.branch === r.branch ? "sr-cell--flow" : ""),
      head: (p) => {
        const tags = [`<span class="sr-flow">流${r.flowName(p.branch).replace("宮", "")}</span>`];
        if (r.taigen && r.taigen.branch === p.branch) tags.push('<span class="sr-tag">大限</span>');
        if (r.shogen && r.shogen.branch === p.branch) tags.push('<span class="sr-tag">小限</span>');
        return `<div class="sr-line">${tags.join("")}</div>`;
      },
      star: (name) => (flowOf[name] ? `<b class="sr-k sr-k--${SHORT[flowOf[name]]}" title="流年の${flowOf[name]}">${SHORT[flowOf[name]]}</b>` : ""),
      foot: () => "",
    };
    return `<h2 class="sb-h">命盤に重ねる</h2>` + sbBoardHtml(c, deco)
      + `<p class="sb-legend">太枠が命宮、青い枠が流年命宮。<span class="sr-flow">流◯</span> は流年の十二宮の名前。<b class="sb-k sb-k--禄">禄</b> 塗りは生まれ年の四化、<b class="sr-k sr-k--禄">禄</b> 枠は流年の四化。</p>`;
  }

  function yearsHtml(c, r0, sex, from) {
    const rows = [];
    for (let y = r0.year - 1; y <= r0.year + 10; y++) {
      const r = sbRyunen(c, y, sex, from);
      if (r.age < 1) continue;
      const ji = r.sika[3];
      const now = y === r0.year;
      rows.push([
        `${y}年<span class="sb-small">${gz(y)}・${r.age}歳</span>${now ? "" : `<button type="button" class="sb-pick" data-year="${y}">この年を見る</button>`}`,
        `<strong>${r.natal}</strong>`,
        sex ? (r.shogen ? r.shogen.palace : "-") : "-",
        sex ? (r.taigen ? r.taigen.palace : "-") : "-",
        `${ji.star}<span class="sb-small">${ji.palace}</span>`,
      ]);
    }
    return `<h2 class="sb-h">前後の年</h2>` + table(["年", "流年命宮", "小限", "大限", "化忌"], rows);
  }

  function variantsHtml(inp, opt, from, base, y) {
    const b = base.c.birth;
    const tries = [["cal", opt.cal === "jp" ? "cn" : "jp"], ["yearDiv", opt.yearDiv === "lunar" ? "risshun" : "lunar"]];
    if (b.lunar.leap) for (const v of ["split", "next", "same"]) if (v !== opt.leap) tries.push(["leap", v]);
    if (b.lateZi) tries.push(["lateZi", opt.lateZi === "next" ? "same" : "next"]);
    if (b.yStem === 6 || sbYearStem(y) === 6) tries.push(["geng", opt.geng === "yin" ? "tong" : "yin"]);
    if (b.yStem === 8 || sbYearStem(y) === 8) tries.push(["ren", opt.ren === "zuo" ? "fu" : "zuo"]);
    if (inp.sex) tries.push(["taigen", from === "mei" ? "next" : "mei"]);
    let changed = 0;
    const rows = tries.map(([k, val]) => {
      const o = k === "taigen" ? opt : Object.assign({}, opt, { [k]: val });
      const c2 = shibiChart(inp, o);
      const d = sbRyunenDiffs(base.r, sbRyunen(c2, y, inp.sex, k === "taigen" ? val : from));
      if (d.length) changed++;
      const name = k === "taigen" ? "大限の始まり" : SB_OPT_NAME[k];
      const label = k === "taigen" ? SB_TAIGEN_FROM_LABEL[val] : SB_OPT_LABEL[k][val];
      return `<tr><th>${name}を「${label}」にすると</th><td>${d.length ? d.map((x) => `${DIFF_LABEL[x[0]]} ${x[1]} → <strong>${x[2]}</strong>`).join("<br>") : "変わりません"}`
        + (d.length ? `<br><button type="button" class="sb-apply" data-k="${k}" data-v="${val}">この数え方で見る</button>` : "") + `</td></tr>`;
    }).join("");
    const head = changed
      ? `<p>あなたの生まれ日時では、数え方を1つ変えるだけで <strong>${changed}か所</strong> の選び方で結果が変わります。</p>`
      : `<p>あなたの生まれ日時は、下のどの数え方に切り替えても結果が変わりません。</p>`;
    return `<h2 class="sb-h">数え方を変えると</h2>${head}<div class="table-scroll"><table class="spec spec--wrap sb-var"><tbody>${rows}</tbody></table></div>`;
  }

  function hoursHtml(inp, opt, y) {
    const rows = [];
    for (let h = 0; h < 12; h++) {
      const hour = h === 0 ? 0 : h * 2 - 1;
      const c = shibiChart(Object.assign({}, inp, { hour, minute: 30 }), opt);
      const r = sbRyunen(c, y, null, "mei");
      rows.push([`${B[h]}の刻<span class="sb-small">${SB_HOUR_RANGE[h]}</span><button type="button" class="sb-pick" data-hour="${String(hour).padStart(2, "0")}:30">この時刻で見る</button>`,
        `<strong>${r.natal}</strong>`, r.stars.stars.join("・") + (r.stars.borrowed ? "(借り)" : "")]);
    }
    return `<h2 class="sb-h">時刻が分からないとき</h2><p>${y}年(${gz(y)})の流年命宮は${B[sbYearBranch(y)]}の宮で、誰でも同じです。ただ、それが命盤のどの宮にあたるかは命宮で決まるので、時刻が分からないと12通りに分かれます。</p>`
      + table(["時辰", "流年命宮は命盤の", "その宮の主星"], rows);
  }

  function render() {
    const err = $("sr-error");
    const inp = readInput();
    if (inp.err) { err.textContent = inp.err; err.hidden = false; $("sr-result").hidden = true; return false; }
    err.hidden = true;
    const opt = readOpt(), from = readFrom(), y = +$("sr-year").value;
    if (inp.hour === null) {
      $("sr-result-body").innerHTML = hoursHtml(inp, opt, y);
    } else {
      const c = shibiChart(inp, opt);
      const r = sbRyunen(c, y, inp.sex, from);
      $("sr-result-body").innerHTML = summaryHtml(c, r, inp.sex) + sikaHtml(r) + overlapHtml(r) + boardWithFlow(c, r)
        + yearsHtml(c, r, inp.sex, from) + variantsHtml(inp, opt, from, { c, r }, y);
    }
    $("sr-result").hidden = false;
    return true;
  }

  function init() {
    const sel = $("sr-year"), ty = new Date().getFullYear();
    for (let y = ty - 10; y <= ty + 20; y++) sel.appendChild(new Option(`${y}年(${gz(y)})`, y));
    sel.value = String(ty);
    $("sr-notime").addEventListener("change", () => { $("sr-time").disabled = $("sr-notime").checked; });
    $("sr-form").addEventListener("submit", (e) => { e.preventDefault(); if (render()) $("sr-result").scrollIntoView({ behavior: "smooth", block: "start" }); });
    document.querySelectorAll("#sb-opts input").forEach((el) => el.addEventListener("change", () => { if (!$("sr-result").hidden) render(); }));
    sel.addEventListener("change", () => { if (!$("sr-result").hidden) render(); });
    $("sr-result").addEventListener("click", (e) => {
      const a = e.target.closest(".sb-apply");
      if (a) { setOpt(a.dataset.k, a.dataset.v); $("sb-opts").open = true; render(); return; }
      const p = e.target.closest(".sb-pick");
      if (!p) return;
      if (p.dataset.year) {
        if (!sel.querySelector(`option[value="${p.dataset.year}"]`)) sel.appendChild(new Option(`${p.dataset.year}年(${gz(+p.dataset.year)})`, p.dataset.year));
        sel.value = p.dataset.year;
      } else { $("sr-notime").checked = false; $("sr-time").disabled = false; $("sr-time").value = p.dataset.hour; }
      render();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
