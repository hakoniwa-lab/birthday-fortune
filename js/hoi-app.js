/*
 * 方位盤(hoi/)の画面。日付を選ぶと、その日の方位神の位置を盤に色で出す。
 *   内側(12方位)… 年で決まる大将軍・金神・恵方(と、日で変わる金神の遊行・間日)
 *   外側の輪(8方位)… 日で動く天一神(内側の輪)と太白神(外側の輪)
 * 決まりは js/houijin.js、日の干支・旧暦・節入りは koyomi.js / astro.js。
 * 選んだ日付はどこにも保存しない(URL の ?d=2027-02-04 で開ける)。
 * 依存: astro.js / fortune.js / chart.js / data.js / koyomi.js / houijin.js
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const SEASON = "春夏秋冬";
  const WD = "日月火水木金土";
  const MIN = "1950-01-01", MAX = "2099-12-31";
  const z = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${z(m)}-${z(d)}`;
  const dirName = (b) => `${HJ_DIR[b]}(${HJ_BRANCH[b]})`;
  const off = (k, s) => ((k - s) % 60 + 60) % 60;
  const GOD_NAMES = [["taisai", "太歳神"], ["daishogun", "大将軍"], ["daion", "大陰神"], ["saikyo", "歳刑神"], ["saiha", "歳破神"], ["saisetsu", "歳殺神"], ["ohban", "黄幡神"], ["hyobi", "豹尾神"]];

  /* その日の方位神をまとめて出す */
  function info(y, m, d) {
    const k = dayKoyomi(y, m, d);
    const idx = k.dayIdx;
    const risshun = termDay(y, 2, 315);
    const Y = idx < risshun ? y - 1 : y;
    const bounds = [risshun, termDay(y, 5, 45), termDay(y, 8, 135), termDay(y, 11, 225)];
    let season = 3;
    bounds.forEach((b, i) => { if (idx >= b) season = i; });
    const kan = hjKanshiIndex(k.stem, k.branch);
    const yu = konjinYugyo(kan), yus = konjinYugyoSeason(kan, season);
    const nextRisshun = jdToJstParts(solarTermJd(Y + 1, 2, 315));
    return {
      k, Y, season, kan, nextRisshun,
      h: hasshojin(Y), kon: konjinDirs(Y), eho: ehoHoi(Y),
      yu: yu && { dir: yu.dir, n: off(kan, yu.start) + 1 },
      yus: yus && { dir: yus.dir, n: off(kan, yus.start) + 1 },
      mabi: isKonjinMabi(k.branch, season),
      ten: tenichiJin(kan),
      tai: k.lunar ? taihakuJin(k.lunar.day) : null,
    };
  }

  /* ---------- 盤(SVG) ---------- */
  const C = 180, R0 = 30, R = 110, T0 = 116, T1 = 132, H0 = 136, H1 = 152;
  const pt = (deg, r) => [C + r * Math.sin(deg * Math.PI / 180), C - r * Math.cos(deg * Math.PI / 180)];
  const f = (v) => v.toFixed(1);
  function arc(a, b, r0, r1) {
    const [x1, y1] = pt(a, r1), [x2, y2] = pt(b, r1), [x3, y3] = pt(b, r0), [x4, y4] = pt(a, r0);
    return `M${f(x1)} ${f(y1)}A${r1} ${r1} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r0} ${r0} 0 0 0 ${f(x4)} ${f(y4)}Z`;
  }
  const sec12 = (i, r0, r1) => arc(i * 30 - 15, i * 30 + 15, r0, r1);
  const sec8 = (i, r0, r1) => arc(i * 45 - 22.5, i * 45 + 22.5, r0, r1);

  function dial(x) {
    const o = [];
    const konAway = !!(x.yu || x.yus || x.mabi);
    const yuDirs = [x.yu, x.yus].filter(Boolean).map((v) => v.dir);
    // 外側の2つの輪
    for (let i = 0; i < 8; i++) {
      o.push(`<path d="${sec8(i, T0, T1)}" class="hoi-ring"/>`, `<path d="${sec8(i, H0, H1)}" class="hoi-ring"/>`);
    }
    if (x.ten.dir === null) o.push(`<circle cx="${C}" cy="${C}" r="${(T0 + T1) / 2}" class="hoi-up hoi-up--ten"/>`);
    else o.push(`<path d="${sec8(x.ten.dir, T0, T1)}" class="hoi-ten"/>`);
    if (!x.tai || x.tai.dir === null) o.push(`<circle cx="${C}" cy="${C}" r="${(H0 + H1) / 2}" class="hoi-up hoi-up--tai"/>`);
    else o.push(`<path d="${sec8(x.tai.dir, H0, H1)}" class="hoi-tai"/>`);
    // 内側の12方位
    for (let i = 0; i < 12; i++) {
      const isD = x.h.daishogun === i, isK = x.kon.includes(i);
      o.push(`<path d="${sec12(i, R0, R)}" class="hoi-ring"/>`);
      if (isD) o.push(`<path d="${sec12(i, R0, R)}" class="hoi-dai"/>`);
      if (isK && !konAway) o.push(`<path d="${sec12(i, R0, R)}" class="${isD ? "hoi-both" : "hoi-kon"}"/>`);
      if (isK && konAway) o.push(`<path d="${sec12(i, R0 + 4, R - 4)}" class="hoi-away"/>`);
      // 遊行先が大将軍と同じ方位なら、両方見えるよう縞にする
      if (yuDirs.includes(i)) o.push(`<path d="${sec12(i, R0, R)}" class="${isD ? "hoi-both--yu" : "hoi-kon hoi-kon--yu"}"/>`);
    }
    o.push(`<circle cx="${C}" cy="${C}" r="${R0}" class="${yuDirs.includes(-1) ? "hoi-kon hoi-kon--yu" : "hoi-center"}"/>`);
    o.push(`<text x="${C}" y="${C + 4}" class="hoi-t hoi-t--s" text-anchor="middle">中央</text>`);
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = pt(i * 30, 86), [x2, y2] = pt(i * 30, 56);
      o.push(`<text x="${f(x1)}" y="${f(y1 + 4.5)}" class="hoi-t${i % 3 === 0 ? " hoi-t--b" : ""}" text-anchor="middle">${HJ_DIR[i]}</text>`);
      o.push(`<text x="${f(x2)}" y="${f(y2 + 4)}" class="hoi-t hoi-t--s" text-anchor="middle">${HJ_BRANCH[i]}</text>`);
    }
    // 恵方の矢印
    // 方位の名前(半径86)に重ならないよう、矢印は半径72で止める
    const [sx, sy] = pt(x.eho.deg, R0 + 2), [ex, ey] = pt(x.eho.deg, 72);
    const [l1x, l1y] = pt(x.eho.deg - 7, 60), [l2x, l2y] = pt(x.eho.deg + 7, 60);
    o.push(`<line x1="${f(sx)}" y1="${f(sy)}" x2="${f(ex)}" y2="${f(ey)}" class="hoi-eho"/>`);
    o.push(`<polygon points="${f(ex)},${f(ey)} ${f(l1x)},${f(l1y)} ${f(l2x)},${f(l2y)}" class="hoi-eho-head"/>`);
    const label = `方位盤。大将軍は${HJ_DIR[x.h.daishogun]}、金神は${x.kon.map((i) => HJ_DIR[i]).join("・")}、恵方は${x.eho.name}、` +
      `天一神は${x.ten.dir === null ? "天上" : HJ_DIR8[x.ten.dir]}、太白神は${x.tai && x.tai.dir !== null ? HJ_DIR8[x.tai.dir] : "方位にいない日"}`;
    return `<svg viewBox="0 0 360 360" role="img" aria-label="${label}">
      <defs><pattern id="hoi-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" class="hoi-dai-fill"/><rect width="4" height="8" class="hoi-kon-fill"/></pattern><pattern id="hoi-hatch-yu" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" class="hoi-dai-fill"/><rect width="4" height="8" class="hoi-kon--yu"/></pattern></defs>
      ${o.join("")}
      <text x="${C}" y="13" class="hoi-t hoi-t--b" text-anchor="middle">北</text>
    </svg>`;
  }

  /* ---------- 文章 ---------- */
  function rows(x) {
    const { k } = x;
    const lunar = k.lunar ? `旧暦${k.lunar.leap ? "閏" : ""}${k.lunar.num}月${k.lunar.day}日` : "";
    let ten;
    if (x.ten.dir === null) ten = [`天一天上(16日のうち${x.ten.n}日目)`, "天に帰っている間で、どの方角も塞がりません。"];
    else ten = [`${HJ_DIR8[x.ten.dir]}(${x.ten.len}日のうち${x.ten.n}日目)`, "この方角へまっすぐ向かうのを避け、いったん別の方角に泊まってから行く(方違え)のが平安時代の習わしでした。"];
    let tai;
    if (!x.tai) tai = ["—", "この日の旧暦の日付を出せませんでした。"];
    else if (x.tai.place === "dir") tai = [HJ_DIR8[x.tai.dir], `${lunar}。毎日1つずつ時計回りに移ります。`];
    else if (x.tai.place === "center") tai = ["中央か天上", `${lunar}。9の付く日は、西野神社の表では中央、日本国語大辞典では天上で、どちらも塞がる方角はありません。`];
    else tai = ["天上", `${lunar}。10の付く日は天に上っていて、どの方角も塞がりません。`];
    let kon = "その年の方位にいます。";
    if (x.yu && x.yus && x.yu.dir !== x.yus.dir) kon = `今日は遊行の日です。日の干支では${x.yu.dir < 0 ? "中央" : HJ_DIR[x.yu.dir]}(5日のうち${x.yu.n}日目)、季節の遊行では${HJ_DIR[x.yus.dir]}(${x.yus.n}日目)で、2つの決まりの行き先が食い違う日です。`;
    else if (x.yu) kon = `今日は遊行の日で、${x.yu.dir < 0 ? "中央" : HJ_DIR[x.yu.dir]}に出かけています(5日のうち${x.yu.n}日目)。年の方位は差し支えないとされます。`;
    else if (x.yus) kon = `今日は${SEASON[x.season]}の遊行の日で、${HJ_DIR[x.yus.dir]}に出かけています(5日のうち${x.yus.n}日目)。`;
    else if (x.mabi) kon = "今日は金神の間日で、金神の方位でも差し支えないとされます。";
    const block = Math.floor((x.Y - 2025) / 3) * 3 + 2025;
    const nr = x.nextRisshun;
    const hassho = GOD_NAMES.map(([key, n]) => `${n} ${dirName(x.h[key])}`).join("、");
    return [
      ["hoi-sw--ten", "天一神(日の干支で動く)", ten[0], ten[1]],
      ["hoi-sw--tai", "太白神(旧暦の日で動く)", tai[0], tai[1]],
      ["hoi-sw--dai", "大将軍(年)", dirName(x.h.daishogun), `${block}〜${block + 2}年は同じ方位にいます(三年塞がり)。`],
      ["hoi-sw--kon", "金神(年)", x.kon.map((i) => HJ_DIR[i]).join("・"), kon],
      ["hoi-sw--eho", "恵方(年・吉の方位)", `${x.eho.name}やや${{ 甲: "東", 庚: "西", 丙: "南", 壬: "北" }[x.eho.stem]}(${x.eho.stem})`, "歳徳神のいる方角です。"],
      ["", "八将神(年)", "", hassho],
      ["", "この日", `${k.y}年${k.m}月${k.d}日(${WD[k.weekday]}) ${HJ_STEM[k.stem]}${HJ_BRANCH[k.branch]}の日`,
        `${lunar}・季節は${SEASON[x.season]}。方位の年は${x.Y}年(${HJ_STEM[hjYearStem(x.Y)]}${HJ_BRANCH[hjYearBranch(x.Y)]})で、${nr.y}年${nr.m}月${nr.d}日の立春に切り替わります。`],
    ];
  }

  function render() {
    const v = $("hoi-date").value, err = $("hoi-err");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < MIN || v > MAX) {
      err.textContent = "1950年1月1日〜2099年12月31日の日付を選んでください。";
      return;
    }
    err.textContent = "";
    const [y, m, d] = v.split("-").map(Number);
    const x = info(y, m, d);
    $("hoi-dial").innerHTML = dial(x);
    $("hoi-list").innerHTML = rows(x).map(([sw, name, val, note]) =>
      `<div class="hoi-row"><dt>${sw ? `<span class="hoi-sw ${sw}" aria-hidden="true"></span>` : ""}${name}</dt><dd>${val ? `<strong>${val}</strong>` : ""}<span>${note}</span></dd></div>`).join("");
    try { history.replaceState(null, "", `?d=${v}`); } catch (e) { /* 書き換えられなくても表示はできる */ }
  }

  function setDate(dt) { $("hoi-date").value = iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); render(); }
  function shift(n) {
    const v = $("hoi-date").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    const [y, m, d] = v.split("-").map(Number);
    setDate(new Date(y, m - 1, d + n));
  }

  $("hoi-date").min = MIN;
  $("hoi-date").max = MAX;
  $("hoi-date").addEventListener("change", render);
  $("hoi-prev").addEventListener("click", () => shift(-1));
  $("hoi-next").addEventListener("click", () => shift(1));
  $("hoi-today").addEventListener("click", () => setDate(new Date()));
  const q = new URLSearchParams(location.search).get("d");
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q) && q >= MIN && q <= MAX) { $("hoi-date").value = q; render(); }
  else setDate(new Date());
})();
