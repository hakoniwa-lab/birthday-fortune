/*
 * 姓名判断の計算機(seimei/)の画面。計算は js/seimei.js、漢字表は js/seimei-data.js。
 * 名前は個人情報なので、保存しない・URLに入れない・外部に送らない(localStorage も使わない)。
 * 依存: seimei-data.js / seimei.js
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
  const form = $("sm-form"), inSei = $("sm-sei"), inMei = $("sm-mei"), err = $("sm-error");
  const card = $("sm-result"), body = $("sm-result-body");
  const CLS = ["kichi", "han", "kyo"];
  const LABEL = ["吉", "半吉", "凶"];
  let override = {};   // 字ごとに手で入れた画数
  let reisu = 0;
  let last = null;

  function cell(n, c, changed) {
    if (!(n > 0)) return '<td class="sm-cell"><span class="sm-num">−</span></td>';
    return `<td class="sm-cell${changed ? " is-changed" : ""}"><span class="sm-num">${n}</span><span class="sm-mark sm-mark--${CLS[c]}">${LABEL[c]}</span></td>`;
  }

  /** 7つの表で割れている数字の注記 */
  function splitNotes(row) {
    const seen = new Set();
    const out = [];
    for (const x of row) {
      for (const n of x.five) {
        if (!(n > 0)) continue;
        const k = seimeiReduce(n);
        if (seen.has(k)) continue;
        seen.add(k);
        const v = SEIMEI_VOTES[k - 1];
        if ([v[0], v[1], v[2]].filter((a) => a > 0).length > 1) out.push({ n: k, v });
      }
    }
    return out.sort((a, b) => a.n - b.n);
  }

  function charRows(list) {
    return list.map((c) => {
      let note = "";
      if (c.kind === "repeat") note = "々は3画か、前の字と同じ";
      else if (c.kind === "kana") note = c.edited ? "入れた画数" : "かなの画数は目安です";
      else if (c.edited) note = "入れた画数";
      else {
        const parts = [];
        if (c.old) parts.push(`旧字体は「${c.old}」`);
        if (c.rad === -1) parts.push("漢数字は数の値で");
        else if (c.rad > 0 && SEIMEI_RAD[c.rad]) parts.push(SEIMEI_RAD[c.rad]);
        if (c.rad !== -1 && c.s[3] !== c.s[1] && c.s[3] !== c.s[2]) parts.push("旧字体＋部首は康熙字典の画数");
        note = parts.join("、");
      }
      const s = c.s;
      const row = `<tr><th>${esc(c.ch)}</th>${s.map((x, i) => `<td${x !== s[0] && i > 0 ? ' class="is-changed"' : ""}>${x}</td>`).join("")}</tr>`;
      return row + (note ? `<tr class="sm-note-row"><td colspan="5">${esc(note)}</td></tr>` : "");
    }).join("");
  }

  function askRows(res) {
    const items = [...new Set(res.unknown)];
    if (!items.length) return "";
    return `<div class="sm-ask"><p><strong>画数が分からない字があります。</strong>表にあるのは常用漢字・人名用漢字と主な旧字体です。画数を入れると計算します。</p>
      ${items.map((ch) => `<label class="sm-ask__row"><span class="sm-ask__ch">${esc(ch)}</span><input type="number" min="1" max="64" inputmode="numeric" data-char="${esc(ch)}" class="sm-ask__input" aria-label="${esc(ch)}の画数"> 画</label>`).join("")}
    </div>`;
  }

  function kanaRows(res) {
    if (!res.kana.length) return "";
    return `<details class="sm-kana"><summary>かなの画数を直す</summary><p class="sm-small">かなの数え方は流派で違います。ここでは手で書くときの画数を入れてあります(濁点は2画、半濁点は1画)。</p>
      ${res.kana.map((ch) => {
        const c = [...res.sei, ...res.mei].find((x) => x.ch === ch);
        return `<label class="sm-ask__row"><span class="sm-ask__ch">${esc(ch)}</span><input type="number" min="1" max="20" inputmode="numeric" data-char="${esc(ch)}" class="sm-ask__input" value="${c.s[0]}" aria-label="${esc(ch)}の画数"> 画</label>`;
      }).join("")}</details>`;
  }

  function lead(res) {
    const a = res.grid[0][reisu], d = res.grid[3][reisu];
    const countNum = new Set(res.grid.map((g) => g[reisu].five.join(","))).size;
    const countCls = new Set(res.grid.map((g) => g[reisu].cls.join(""))).size;
    if (countNum === 1) {
      return `<p class="sm-lead">この名前は、<strong>4通りのどの数え方でも同じ画数</strong>です。部首や旧字体で変わる字がありません。</p>`;
    }
    const tail = countCls === 1
      ? "画数は変わりますが、この名前では吉凶の並びは変わりません。"
      : `吉凶の並びは<strong>${countCls}通り</strong>に分かれます。`;
    return `<p class="sm-lead">この名前の五格は、数え方によって<strong>${countNum}通り</strong>になります。${tail}</p>`;
  }

  function summary(res) {
    const a = res.grid.map((g) => g[reisu].kyo);
    const parts = SEIMEI_RULES.map((r, i) => `${r} ${a[i]}個`);
    return `<p class="sm-small">五格のうち凶の数: ${parts.join(" / ")}。名字と名前のランキングで数えると、五格に凶が1つもない人は6人に1人ほどです。凶があるのは珍しいことではありません。</p>`;
  }

  function render() {
    const res = seimeiCompute(inSei.value, inMei.value, override);
    last = res;
    card.hidden = false;
    if (!res.sei.length || !res.mei.length) {
      err.textContent = "姓と名の両方を入れてください。";
      err.hidden = false;
      card.hidden = true;
      return;
    }
    err.hidden = true;
    if (!res.ok) {
      body.innerHTML = askRows(res);
      bindAsk();
      return;
    }
    const row = res.grid.map((g) => g[reisu]);
    const heads = SEIMEI_RULES.map((r) => `<th>${esc(r).replace("＋", "<br>＋")}</th>`).join("");
    const head = `<tr><th></th>${heads}</tr>`;
    const rows = SEIMEI_GRID.map((name, i) => `<tr><th>${name}</th>${row.map((x, r) => cell(x.five[i], x.cls[i], r > 0 && x.five[i] !== row[0].five[i])).join("")}</tr>`).join("");
    const radios = res.one ? `<fieldset class="sm-reisu"><legend>霊数(1文字の姓・名に足す1)</legend>
        ${SEIMEI_REISU.map((t, i) => `<label><input type="radio" name="sm-reisu" value="${i}"${i === reisu ? " checked" : ""}> ${t}</label>`).join("")}
        <p class="sm-small">姓か名が1文字なので、霊数の扱いでも結果が変わります。12通りのうち、凶が1つも無いのは${res.noKyo}通りです。</p>
      </fieldset>` : "";
    const notes = splitNotes(row);
    const noteHtml = notes.length ? `<p class="sm-small">表で判定が割れる数字: ${notes.map((x) => `${x.n}画(吉${x.v[0]}・半吉${x.v[1]}・凶${x.v[2]})`).join("、")}。7つの公開表の票数で、判定は多数決です。</p>` : "";
    body.innerHTML = `
      ${lead(res)}
      ${radios}
      <div class="table-scroll"><table class="spec spec--wrap sm-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
      <p class="sm-small">色つきのマスは、いちばん左(今の字)と画数が違うところです。</p>
      ${summary(res)}
      ${noteHtml}
      <h3 class="sm-h">字ごとの画数</h3>
      <div class="table-scroll"><table class="spec spec--wrap sm-table sm-table--chars"><thead><tr><th></th>${heads}</tr></thead>
        <tbody>${charRows([...res.sei, ...res.mei])}</tbody></table></div>
      ${kanaRows(res)}`;
    bindAsk();
    body.querySelectorAll('input[name="sm-reisu"]').forEach((el) => {
      el.addEventListener("change", () => { reisu = Number(el.value); render(); });
    });
  }

  function bindAsk() {
    body.querySelectorAll(".sm-ask__input").forEach((el) => {
      el.addEventListener("change", () => {
        const v = Math.floor(Number(el.value));
        if (v >= 1) override[el.dataset.char] = v; else delete override[el.dataset.char];
        render();
        card.scrollIntoView({ block: "nearest" });
      });
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    override = {};
    reisu = 0;
    render();
    if (!card.hidden) card.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
