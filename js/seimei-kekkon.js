/*
 * 記事「結婚で名字が変わると姓名判断はどう変わる？」の中の計算機。計算は seimei.js。
 * 入力した名前は保存せず、外部にも送らない。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
  const cell = (n, c) => `${n}画 <b class="sk-m sk-m--${c}">${SEIMEI_LABEL[c]}</b>`;

  function render(e) {
    e.preventDefault();
    const err = $("sk-error"), out = $("sk-result");
    const oldS = $("sk-old").value, newS = $("sk-new").value, mei = $("sk-mei").value, r = +$("sk-rule").value;
    const a = seimeiCompute(oldS, mei), b = seimeiCompute(newS, mei);
    let msg = "";
    if (!oldS.trim() || !newS.trim() || !mei.trim()) msg = "今の名字・結婚後の名字・名前を入れてください。";
    else if (!a.ok || !b.ok) {
      const u = [...new Set([...(a.unknown || []), ...(b.unknown || [])])];
      msg = u.length ? `「${u.join("・")}」は画数の表にない字です。` : "入力を確かめてください。";
    }
    err.textContent = msg; err.hidden = !msg;
    if (msg) { out.innerHTML = ""; return; }
    const x = seimeiResult(a.sei, a.mei, r, 0), y = seimeiResult(b.sei, b.mei, r, 0);
    const rows = SEIMEI_GRID.map((g, i) => {
      const ch = x.cls[i] !== y.cls[i];
      return `<tr${ch ? ' class="sk-ch"' : ""}><th>${g}</th><td>${cell(x.five[i], x.cls[i])}</td><td>${cell(y.five[i], y.cls[i])}</td></tr>`;
    }).join("");
    const lead = x.kyo === y.kyo ? `凶の数は変わりません(${x.kyo}個)。` : `凶の数は${x.kyo}個から<b>${y.kyo}個</b>に変わります。`;
    out.innerHTML = `<p class="sk-lead">${esc(SEIMEI_RULES[r])}で数えると、${lead}</p>`
      + `<div class="table-scroll"><table class="spec spec--wrap sk-t"><thead><tr><th></th><th>${esc(oldS)}</th><th>${esc(newS)}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      + `<p class="item__note">地格は名前だけで決まるので変わりません。色の付いた行は、吉凶が変わった格です。流派によって数え方や吉凶の表は違います。</p>`;
  }

  function init() {
    SEIMEI_RULES.forEach((n, i) => $("sk-rule").appendChild(new Option(n, i)));
    $("sk-form").addEventListener("submit", render);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
