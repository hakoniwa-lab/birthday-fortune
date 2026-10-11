/*
 * 赤ちゃんのお祝い日程カレンダーの画面。計算は oiwai.js。
 * 入力は端末の localStorage(birthday-fortune:oiwai)にだけ保存する。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE = "birthday-fortune:oiwai";
  const SITE_URL = "https://hakoniwalab.com/birthday-fortune/oiwai/";
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };

  const selY = $("ow-year"), selM = $("ow-month"), selD = $("ow-day");
  const now = new Date();
  const ty = now.getFullYear();
  for (let y = ty + 1; y >= ty - 8; y--) selY.add(new Option(`${y}年`, y));
  for (let m = 1; m <= 12; m++) selM.add(new Option(`${m}月`, m));
  const fillDays = () => {
    const keep = Number(selD.value) || now.getDate();
    selD.innerHTML = "";
    const n = new Date(Number(selY.value), Number(selM.value), 0).getDate();
    for (let d = 1; d <= n; d++) selD.add(new Option(`${d}日`, d));
    selD.value = String(Math.min(keep, n));
  };
  selY.value = ty; selM.value = now.getMonth() + 1; fillDays(); selD.value = now.getDate();
  selY.addEventListener("change", fillDays);
  selM.addEventListener("change", fillDays);
  $("ow-miya").addEventListener("change", () => { $("ow-miya-custom").hidden = $("ow-miya").value !== "custom"; });

  function read() {
    return {
      y: Number(selY.value), m: Number(selM.value), d: Number(selD.value),
      sex: document.querySelector('input[name="ow-sex"]:checked').value,
      zero: $("ow-zero").checked,
      miya: $("ow-miya").value, miyaDays: Number($("ow-miya-days").value),
      kuizome: Number($("ow-kuizome").value),
      shichi: $("ow-shichi").value,
      boy3: $("ow-boy3").checked,
      name: $("ow-name").value.trim(),
    };
  }
  function write(v) {
    selY.value = v.y; selM.value = v.m; fillDays(); selD.value = v.d;
    const r = document.querySelector(`input[name="ow-sex"][value="${v.sex === "girl" ? "girl" : "boy"}"]`);
    if (r) r.checked = true;
    $("ow-zero").checked = !!v.zero;
    $("ow-miya").value = v.miya || "jinja";
    $("ow-miya-days").value = v.miyaDays || 31;
    $("ow-miya-custom").hidden = $("ow-miya").value !== "custom";
    $("ow-kuizome").value = String(v.kuizome || 100);
    $("ow-shichi").value = v.shichi || "man";
    $("ow-boy3").checked = v.boy3 !== false;
    $("ow-name").value = v.name || "";
  }

  const fmt = (x) => `${x.y}年${x.m}月${x.d}日(${x.wdName})`;
  const fmtS = (x) => `${x.m}/${x.d}(${x.wdName})`;
  let current = null;

  function render(v) {
    const s = oiwaiSchedule(v);
    const todayIdx = jdn(ty, now.getMonth() + 1, now.getDate());
    const who = v.name ? `${v.name}ちゃん` : (s.sex === "girl" ? "女の子" : "男の子");
    const cards = s.items.map((it) => {
      const past = it.idx < todayIdx;
      const tags = [it.info.rokuyo, it.info.holiday].filter(Boolean).map((t) =>
        `<span class="ow-tag${t === "大安" ? " ow-tag--taian" : ""}">${esc(t)}</span>`).join("");
      const cand = it.candidates.length
        ? `<p class="ow-cand"><span>前後の土日祝</span>${it.candidates.map((c) =>
            `<b class="${c.taian ? "is-taian" : ""}${c.offset === 0 ? " is-day" : ""}">${esc(fmtS(c))}${c.taian ? "★" : ""}</b>`).join("")}</p>`
        : "";
      const taian753 = it.extra && it.extra.taian
        ? `<p class="ow-cand"><span>${it.extra.year}年10〜11月の大安の土日祝</span>${it.extra.taian.length
            ? it.extra.taian.map((c) => `<b class="is-taian">${esc(fmtS(c))}★</b>`).join("") : "<b>なし</b>"}</p>`
        : "";
      return `<div class="ow-item${past ? " is-past" : ""}">
        <p class="ow-item__name">${esc(it.name)}${past ? '<small>済</small>' : ""}</p>
        <p class="ow-item__date">${esc(fmt(it.info))}${tags}</p>
        <p class="ow-item__sub">${esc(it.sub)}</p>
        ${cand}${taian753}
        ${it.note ? `<p class="item__note">${esc(it.note)}</p>` : ""}
      </div>`;
    }).join("");
    $("ow-result-body").innerHTML = `
      <p class="ow-head">${esc(fmt(s.birth))}生まれの${esc(who)}</p>
      <p class="ow-lead">お宮参りは${esc(v.zero ? `生後${s.miyaDays}日` : `生後${s.miyaDays}日目`)}、お食い初めは${s.kuizome}日目、七五三は${v.shichi === "kazoe" ? "数え年" : "満年齢"}で数えています。★は大安。</p>
      ${cards}`;
    current = { v, s };
    $("ow-result").hidden = false;
    $("ow-status").textContent = "";
  }

  $("ow-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = read();
    try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (err) { /* 保存できなくても表示はする */ }
    render(v);
    $("ow-result").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------- カレンダー登録 ---------- */
  function buildIcs({ v, s }) {
    const p2 = (n) => String(n).padStart(2, "0");
    const t = new Date();
    const stamp = `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}T${p2(t.getUTCHours())}${p2(t.getUTCMinutes())}${p2(t.getUTCSeconds())}Z`;
    const who = v.name ? `${v.name}ちゃんの` : "";
    const key = owIcsDate(s.birth.idx);
    const todayIdx = jdn(ty, now.getMonth() + 1, now.getDate());
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HAKONIWA LAB//oiwai-calendar//JA", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      `X-WR-CALNAME:${owIcsEscape(who + "お祝いの日程")}`];
    for (const it of s.items.filter((x) => x.idx >= todayIdx)) {
      const cand = it.candidates.filter((c) => c.offset !== 0).map((c) => fmtS(c) + (c.taian ? "★" : "")).join("・");
      const desc = [`${fmt(it.info)} ${it.info.rokuyo || ""}${it.info.holiday ? " " + it.info.holiday : ""}`, it.sub,
        cand ? `前後の土日祝: ${cand}` : "", SITE_URL].filter(Boolean).join("\n");
      lines.push("BEGIN:VEVENT", `UID:oiwai-${key}-${s.sex}-${it.key}@hakoniwalab.com`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${owIcsDate(it.idx)}`, `DTEND;VALUE=DATE:${owIcsDate(it.idx + 1)}`,
        `SUMMARY:${owIcsEscape(who + it.name)}`, `DESCRIPTION:${owIcsEscape(desc)}`, "TRANSP:TRANSPARENT",
        "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${owIcsEscape(who + it.name + "の準備")}`,
        `TRIGGER:${it.group === "753" ? "-P60D" : "-P7D"}`, "END:VALARM", "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return { text: lines.map(owIcsFold).join("\r\n") + "\r\n", n: lines.filter((l) => l === "BEGIN:VEVENT").length };
  }
  $("ow-ics").addEventListener("click", () => {
    if (!current) return;
    const { text, n } = buildIcs(current);
    if (!n) { $("ow-status").textContent = "これから先の行事がありません"; return; }
    const blob = new Blob([text], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "oiwai-calendar.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("ow-status").textContent = `これから先の${n}件をカレンダー用ファイル(.ics)にしました。スマホのカレンダーやGoogleカレンダーに取り込めます`;
  });

  /* ---------- 家族に送る ---------- */
  function shareText({ v, s }) {
    const todayIdx = jdn(ty, now.getMonth() + 1, now.getDate());
    const who = v.name ? `${v.name}ちゃん` : (s.sex === "girl" ? "女の子" : "男の子");
    const lines = [`【お祝いの日程】${fmt(s.birth)}生まれの${who}`];
    for (const it of s.items.filter((x) => x.idx >= todayIdx)) {
      lines.push(`・${it.name} ${fmt(it.info)} ${it.info.rokuyo || ""}${it.info.holiday ? " " + it.info.holiday : ""}`);
    }
    if (lines.length === 1) lines.push("一覧にある行事はすべて済んでいます");
    lines.push(SITE_URL);
    return lines.join("\n");
  }
  $("ow-share").addEventListener("click", async () => {
    if (!current) return;
    const text = shareText(current);
    // 共有APIはクリック直後にしか呼べないので、ここで分岐する
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); $("ow-status").textContent = "日程をコピーしました。LINEやメールに貼り付けて送れます"; }
    catch (err) { $("ow-status").textContent = "コピーできませんでした"; }
  });

  /* 前回の入力があれば、開いた時点で出す */
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && saved.y && saved.m && saved.d) { write(saved); render(read()); }
  } catch (err) { /* 読めなければ空のまま */ }
})();
