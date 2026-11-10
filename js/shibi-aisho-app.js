/*
 * 紫微斗数の相性ページ(shibi/aisho/)の画面。計算は shibi.js と shibi-aisho.js。
 * 入力した生年月日・時刻はどこにも保存せず、URL にも入れない。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const B = SB_BRANCH, S = SB_STEM;
  const OPT_KEYS = ["cal", "lateZi", "yearDiv", "leap", "geng", "ren"];
  const REL_TEXT = {
    same: "二人の命宮は<strong>同じ位置</strong>にあります。",
    sango: "二人の命宮は<strong>三合</strong>(4つ離れた宮)の位置にあります。お互いの足りない部分を補い合える、と説明されることがあります。",
    taikyu: "二人の命宮は<strong>向かい合う位置</strong>(対宮)にあります。",
    other: "二人の命宮は、同じ位置・三合・対宮のどれでもありません。",
  };
  const KEI_TEXT = {
    紫府廉系: "二人とも紫府廉系です。価値観や行動の方向性が合いやすい、と説明されることがあります。",
    機月系: "二人とも機月系です。心の交流や会話で関係が深まりやすい、と説明されることがあります。",
    diff: "系統が違います。違いを理解できれば刺激し合える関係になる、と説明されることがあります。",
  };
  const OPT_DIFF_LABEL = { meiA: "あなたの命宮の主星", meiB: "相手の命宮の主星", bInA: "相手の命宮(あなたの命盤で)", aInB: "あなたの命宮(相手の命盤で)" };

  function readOpt() {
    const v = (n) => { const el = document.querySelector(`input[name="sb-${n}"]:checked`); return el ? el.value : SB_DEFAULT_OPT[n]; };
    const o = { lonFix: false };
    OPT_KEYS.forEach((k) => { o[k] = v(k); });
    return o;
  }
  function setOpt(name, value) {
    const el = document.querySelector(`input[name="sb-${name}"][value="${value}"]`);
    if (el) el.checked = true;
  }

  function readPerson(p, who) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec($(`${p}-date`).value);
    if (!m) return { err: `${who}の生年月日を入れてください。` };
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1901 || y > 2099) return { err: `${who}の生年月日は1901年〜2099年の日付を入れてください。` };
    let hour = null, minute = null;
    if (!$(`${p}-notime`).checked) {
      const t = /^(\d{2}):(\d{2})/.exec($(`${p}-time`).value);
      if (!t) return { err: `${who}の生まれた時刻を入れるか、「時刻が分からない」にチェックを入れてください。` };
      hour = +t[1]; minute = +t[2];
    }
    return { y, m: mo, d, hour, minute, sex: null, lon: null };
  }

  const table = (head, rows, cls) => `<div class="table-scroll"><table class="spec spec--wrap ${cls || ""}">`
    + (head ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` : "")
    + `<tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join("")}</tr>`).join("")}</tbody></table></div>`;
  const starsTxt = (m) => m.stars.join("・") + (m.borrowed ? `<span class="sb-small">(向かいの宮から借りる)</span>` : "");
  const palace = (n) => `<strong>${n}</strong><span class="sb-small">(${SB_PALACE_MEANS[n]})</span>`;

  function sikaTable(list) {
    return table(["四化", "星", "入る宮"], list.map((s) => [
      `${s.kind}<span class="sb-small">(${SB_SIKA_MEANS[s.kind]})</span>`,
      s.star,
      `<span class="${s.palace === "命宮" || s.palace === "夫妻宮" ? "sb-hit" : ""}">${palace(s.palace)}</span>`,
    ]));
  }

  function overlapText(p) {
    const o = [];
    if (p.overlapAB.length) o.push(`あなたの夫妻宮の星(<strong>${p.overlapAB.join("・")}</strong>)は、相手の命宮にもあります。`);
    if (p.overlapBA.length) o.push(`相手の夫妻宮の星(<strong>${p.overlapBA.join("・")}</strong>)は、あなたの命宮にもあります。`);
    return o.length ? o.join("") : "夫妻宮の星と相手の命宮の星に、重なりはありません。";
  }

  function pairHtml(p) {
    const { a, b } = p;
    const keiLine = (p.keiA.length === 1 && p.keiB.length === 1 && p.keiA[0] === p.keiB[0]) ? KEI_TEXT[p.keiA[0]] : KEI_TEXT.diff;
    const yearOf = (c) => `${S[c.birth.yStem]}${B[c.birth.yBranch]}年`;
    return `<h2 class="sb-h">二人の命宮と夫妻宮</h2>`
      + table(["", "あなた", "相手"], [
        ["命宮の位置", `${S[a.palaces[a.mei].stem]}${B[a.mei]}`, `${S[b.palaces[b.mei].stem]}${B[b.mei]}`],
        ["命宮の主星", starsTxt(p.meiA), starsTxt(p.meiB)],
        ["系統", p.keiA.join("・"), p.keiB.join("・")],
        ["夫妻宮の主星", starsTxt(p.fusaiA), starsTxt(p.fusaiB)],
        ["生まれ年", yearOf(a), yearOf(b)],
      ])
      + `<p>${keiLine}</p><p>${REL_TEXT[p.rel]}</p><p>${overlapText(p)}</p>`
      + `<h2 class="sb-h">おたがいの命盤のどこにいるか</h2>`
      + `<ul class="sb-notes"><li>相手の命宮は、あなたの命盤の${palace(p.bInA)}の位置にあります。</li>`
      + `<li>あなたの命宮は、相手の命盤の${palace(p.aInB)}の位置にあります。</li></ul>`
      + `<h2 class="sb-h">相手の四化が、あなたの命盤に入る宮</h2>`
      + `<p class="sb-small">相手の生まれ年(${yearOf(b)})で決まる4つの星が、あなたの命盤のどの宮にあるかを出しています。その人が、あなたの暮らしのどの面に影響するかを見る見方です。</p>`
      + sikaTable(p.sikaBtoA)
      + `<h2 class="sb-h">あなたの四化が、相手の命盤に入る宮</h2>`
      + `<p class="sb-small">同じ見方を逆向きにしたものです(あなたの生まれ年は${yearOf(a)})。</p>`
      + sikaTable(p.sikaAtoB);
  }

  function diffText(d) {
    if (d[0] === "sikaAtoB") return "あなたの四化が入る宮";
    if (d[0] === "sikaBtoA") return "相手の四化が入る宮";
    return `${OPT_DIFF_LABEL[d[0]]} ${d[1]} → <strong>${d[2]}</strong>`;
  }

  function variantsHtml(ia, ib, opt, base) {
    const ba = base.a.birth, bb = base.b.birth;
    const tries = [["cal", opt.cal === "jp" ? "cn" : "jp"], ["yearDiv", opt.yearDiv === "lunar" ? "risshun" : "lunar"]];
    if (ba.lunar.leap || bb.lunar.leap) for (const v of ["split", "next", "same"]) if (v !== opt.leap) tries.push(["leap", v]);
    if (ba.lateZi || bb.lateZi) tries.push(["lateZi", opt.lateZi === "next" ? "same" : "next"]);
    if (ba.yStem === 6 || bb.yStem === 6) tries.push(["geng", opt.geng === "yin" ? "tong" : "yin"]);
    if (ba.yStem === 8 || bb.yStem === 8) tries.push(["ren", opt.ren === "zuo" ? "fu" : "zuo"]);
    let changed = 0;
    const rows = tries.map(([k, val]) => {
      const o = Object.assign({}, opt, { [k]: val });
      const d = sbPairDiffs(base, sbPair(shibiChart(ia, o), shibiChart(ib, o)));
      if (d.length) changed++;
      return `<tr><th>${SB_OPT_NAME[k]}を「${SB_OPT_LABEL[k][val]}」にすると</th><td>${d.length ? d.map(diffText).join("<br>") : "変わりません"}`
        + (d.length ? `<br><button type="button" class="sb-apply" data-k="${k}" data-v="${val}">この数え方で見る</button>` : "") + `</td></tr>`;
    }).join("");
    const head = changed
      ? `<p>この二人の生まれ日時では、数え方を1つ変えるだけで <strong>${changed}か所</strong> の選び方で結果が変わります。</p>`
      : `<p>この二人の生まれ日時は、下のどの数え方に切り替えても結果が変わりません。</p>`;
    return `<h2 class="sb-h">数え方を変えると</h2>${head}<div class="table-scroll"><table class="spec spec--wrap sb-var"><tbody>${rows}</tbody></table></div>`;
  }

  /* どちらか一方の時刻が分からないとき。分からない人の時辰を12通りに振る */
  function hoursHtml(ia, ib, opt, unknownIsA) {
    const who = unknownIsA ? "あなた" : "相手";
    const rows = [];
    for (let h = 0; h < 12; h++) {
      const hour = h === 0 ? 0 : h * 2 - 1;
      const ca = shibiChart(unknownIsA ? Object.assign({}, ia, { hour, minute: 30 }) : ia, opt);
      const cb = shibiChart(unknownIsA ? ib : Object.assign({}, ib, { hour, minute: 30 }), opt);
      const p = sbPair(ca, cb);
      const m = unknownIsA ? p.meiA : p.meiB, kei = unknownIsA ? p.keiA : p.keiB;
      rows.push(`<tr><th>${B[h]}の刻<br><span class="sb-small">${SB_HOUR_RANGE[h]}</span><br><button type="button" class="sb-pick" data-who="${unknownIsA ? "a" : "b"}" data-hour="${String(hour).padStart(2, "0")}:30">この時刻で見る</button></th>`
        + `<td>${m.stars.join("・")}${m.borrowed ? "(借り)" : ""}<br><span class="sb-small">${kei.join("・")}</span></td>`
        + `<td>相手の命宮はあなたの<strong>${p.bInA}</strong><br>あなたの命宮は相手の<strong>${p.aInB}</strong></td></tr>`);
    }
    return `<h2 class="sb-h">${who}の時刻が分からないとき</h2><p>命宮は生まれた時刻で決まるので、${who}の時刻が分からないと12通りに分かれます。子の刻は0時台で出しています。</p>`
      + `<div class="table-scroll"><table class="spec spec--wrap"><thead><tr><th>${who}の時辰</th><th>${who}の命宮の主星</th><th>命宮の位置</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function render() {
    const err = $("sa-error");
    const ia = readPerson("sa-a", "あなた"), ib = readPerson("sa-b", "相手");
    const e = ia.err || ib.err || (ia.hour === null && ib.hour === null ? "どちらか一人の生まれた時刻は必要です。" : "");
    if (e) { err.textContent = e; err.hidden = false; $("sa-result").hidden = true; return false; }
    err.hidden = true;
    const opt = readOpt();
    if (ia.hour === null || ib.hour === null) {
      $("sa-result-body").innerHTML = hoursHtml(ia, ib, opt, ia.hour === null);
    } else {
      const p = sbPair(shibiChart(ia, opt), shibiChart(ib, opt));
      $("sa-result-body").innerHTML = pairHtml(p) + variantsHtml(ia, ib, opt, p);
    }
    $("sa-result").hidden = false;
    return true;
  }

  function init() {
    for (const p of ["sa-a", "sa-b"]) $(`${p}-notime`).addEventListener("change", () => { $(`${p}-time`).disabled = $(`${p}-notime`).checked; });
    $("sa-form").addEventListener("submit", (e) => { e.preventDefault(); if (render()) $("sa-result").scrollIntoView({ behavior: "smooth", block: "start" }); });
    document.querySelectorAll("#sb-opts input").forEach((el) => el.addEventListener("change", () => { if (!$("sa-result").hidden) render(); }));
    $("sa-result").addEventListener("click", (e) => {
      const a = e.target.closest(".sb-apply");
      if (a) { setOpt(a.dataset.k, a.dataset.v); $("sb-opts").open = true; render(); return; }
      const p = e.target.closest(".sb-pick");
      if (p) {
        const key = `sa-${p.dataset.who}`;
        $(`${key}-notime`).checked = false; $(`${key}-time`).disabled = false; $(`${key}-time`).value = p.dataset.hour;
        render();
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
