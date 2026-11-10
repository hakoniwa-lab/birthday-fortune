/*
 * 方位盤(hoi/)の「地図で方角を測る」。出発地と行き先を地図で選ぶと、方角を3通り(大圏・地図の直線・方位磁石)で測り、
 * その日の方位神がその方角にいるかを並べる。出発地のまわりには、その日の方位神を色で扇形に描く。
 * 計算は hoi-geo.js(方角)と houijin.js(方位神)。その日の方位神は hoi-app.js の window.HOI.x から受け取る。
 * 位置はどこにも保存せず、URL にも入れない。地図の画像は国土地理院のタイル、住所検索は国土地理院の住所検索を使う
 * (検索したときだけ、入力した文字が国土地理院に送られる)。Leaflet は地図を開いたときに読み込む。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const TILE = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
  const GSI_SEARCH = "https://msearch.gsi.go.jp/address-search/AddressSearch";
  const METHODS = [["true", "大圏(真北)"], ["rhumb", "地図の直線"], ["mag", "方位磁石"]];
  let map = null, layer = null, home = null, dest = null, mode = "home", fitted = false;

  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) { resolve(); return; }
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = "../vendor/leaflet.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "../vendor/leaflet.js"; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function open() {
    $("hm-open").hidden = true;
    $("hm-body").hidden = false;
    try { await loadLeaflet(); } catch (e) { $("hm-msg").textContent = "地図を読み込めませんでした。通信の状態を確かめて、ページを読み込み直してください。"; return; }
    map = L.map("hm-map", { zoomControl: true }).setView([36.6, 137.8], 5);
    L.tileLayer(TILE, { minZoom: 5, maxZoom: 18, maxNativeZoom: 16, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on("click", (e) => place(e.latlng.lat, e.latlng.lng));
    // 画面の向きや幅が変わったら地図の大きさを測り直す(しないとタイルが灰色のまま残る)
    if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe($("hm-map"));
    setMode("home");
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('input[name="hm-mode"]').forEach((el) => { el.checked = el.value === m; });
    $("hm-msg").textContent = m === "home" ? "地図をタップして、出発地(今の家)を置いてください。" : "地図をタップして、行き先を置いてください。";
  }

  function place(lat, lon) {
    if (mode === "home") { home = { lat, lon }; fitted = false; if (!dest) setMode("dest"); }
    else { dest = { lat, lon }; fitted = false; }
    draw();
  }

  const gods = (x, m) => window.HOI.gods(x, m);

  const dirText = (m) => `${m.deg.toFixed(1)}度・${HJ_DIR[m.s12]}(${HJ_BRANCH[m.s12]})・${HJ_DIR8[m.s8]}`;

  function resultHtml(x, me) {
    const g = {};
    for (const [k] of METHODS) g[k] = gods(x, me[k]);
    const names = ["大将軍", "金神", "天一神", "太白神", "恵方"];
    const split = names.filter((n) => new Set(METHODS.map(([k]) => g[k][n])).size > 1);
    const head = METHODS.map(([k, n]) => `<th>${n}<br><span>${dirText(me[k])}</span></th>`).join("");
    const body = names.map((n) => `<tr><th>${n}</th>${METHODS.map(([k]) => { const v = g[k][n]; return `<td class="${v === "いる" || v === "遊行で来ている" ? "hm-hit" : v === "恵方" ? "hm-good" : ""}">${v || "—"}</td>`; }).join("")}</tr>`).join("");
    const main = g.true;
    const hits = names.filter((n) => n !== "恵方" && (main[n] === "いる" || main[n] === "遊行で来ている"));
    let verdict = hits.length ? `大圏(真北)で測ると、この日の行き先の方角には <strong>${hits.join("・")}</strong> がいます。` : "大圏(真北)で測ると、この日の行き先の方角に方位神はいません。";
    if (main.恵方) verdict += "恵方にも当たります。";
    const warn = split.length
      ? `<p class="hm-warn">測り方で答えが変わる方角です(${split.join("・")})。方位の区切りの近くにあるため、どの測り方を使うかで結果が分かれます。</p>` : "";
    return `<p class="hm-dist">出発地から約${me.dist < 10 ? me.dist.toFixed(1) : Math.round(me.dist)}km。この場所の偏角(方位磁石の北のずれ)は西に${me.decl.toFixed(1)}度です。</p>`
      + `<p>${verdict}</p>${warn}`
      + `<div class="table-scroll"><table class="spec spec--wrap hm-table"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  /* 大圏で進んだ道すじ(地図の上では少し曲がる)。扇の境目と行き先の線をこれで描くと、地図の見た目と大圏の計算が食い違わない */
  function ray(c, a, r0, r1) {
    const pts = [];
    for (let k = 0; k <= 16; k++) pts.push(hgDest(c.lat, c.lon, a, r0 + (r1 - r0) * k / 16));
    return pts;
  }
  function wedge(c, a0, a1, r) {
    const pts = ray(c, a0, 0, r);
    for (let a = a0 + 2.5; a < a1 - 1e-9; a += 2.5) pts.push(hgDest(c.lat, c.lon, a, r));
    return pts.concat(ray(c, a1, r, 0));
  }
  function arcLine(c, a0, a1, r) {
    const pts = [];
    for (let a = a0; a <= a1 + 1e-9; a += 2.5) pts.push(hgDest(c.lat, c.lon, a, r));
    return pts;
  }

  function draw() {
    if (!map || !layer) return;
    layer.clearLayers();
    const x = window.HOI && window.HOI.x;
    if (!home || !x) { $("hm-result").innerHTML = ""; if (window.HOI) window.HOI.setBearing(null); return; }
    const me = dest ? hgMeasure(home, dest) : null;
    const r = me ? Math.max(me.dist * 1.3, 1.5) : 40;
    const konAway = !!(x.yu || x.yus || x.mabi);
    const yuDirs = [x.yu, x.yus].filter(Boolean).map((v) => v.dir);
    for (let i = 0; i < 12; i++) {
      const isD = x.h.daishogun === i, isK = (x.kon.includes(i) && !konAway) || yuDirs.includes(i);
      const cls = isD && isK ? "hm-sec hm-both" : isD ? "hm-sec hm-dai" : isK ? "hm-sec hm-kon" : "hm-sec";
      L.polygon(wedge(home, i * 30 - 15, i * 30 + 15, r), { className: cls, interactive: false }).addTo(layer);
      const [la, lo] = hgDest(home.lat, home.lon, i * 30, r * 0.82);
      L.marker([la, lo], { interactive: false, icon: L.divIcon({ className: "hm-lbl", html: HJ_BRANCH[i], iconSize: [18, 18] }) }).addTo(layer);
    }
    if (x.ten.dir !== null) L.polyline(arcLine(home, x.ten.dir * 45 - 22.5, x.ten.dir * 45 + 22.5, r * 1.06), { className: "hm-ten", interactive: false }).addTo(layer);
    if (x.tai && x.tai.dir !== null) L.polyline(arcLine(home, x.tai.dir * 45 - 22.5, x.tai.dir * 45 + 22.5, r * 1.13), { className: "hm-tai", interactive: false }).addTo(layer);
    L.circleMarker([home.lat, home.lon], { radius: 7, className: "hm-home" }).addTo(layer);
    if (dest) {
      L.polyline(ray(home, me.true.deg, 0, me.dist), { className: "hm-line", interactive: false }).addTo(layer);
      L.circleMarker([dest.lat, dest.lon], { radius: 7, className: "hm-dest" }).addTo(layer);
    }
    if (!fitted) {
      // 行き先があれば家と行き先が両方入るように、無ければ家のまわりの扇が入るように合わせる
      const b = dest ? L.latLngBounds([[home.lat, home.lon], [dest.lat, dest.lon]]).pad(0.3) : L.latLngBounds(wedge(home, 0, 357.5, r * 1.15));
      map.fitBounds(b, { padding: [10, 10], animate: false });
      fitted = true;
    }
    if (me) {
      $("hm-result").innerHTML = resultHtml(x, me);
      window.HOI.setBearing(me.true.deg);
    } else {
      $("hm-result").innerHTML = "";
      window.HOI.setBearing(null);
    }
  }

  async function search() {
    const q = $("hm-q").value.trim();
    const out = $("hm-found");
    if (!q) return;
    out.innerHTML = "<li>探しています…</li>";
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(GSI_SEARCH + "?q=" + encodeURIComponent(q), { signal: ctrl.signal });
      clearTimeout(t);
      const j = r.ok ? await r.json() : [];
      const items = (Array.isArray(j) ? j : []).slice(0, 6).map((f) => {
        const c = f.geometry && f.geometry.coordinates, title = (f.properties && f.properties.title || "").trim();
        return c && title ? { title, lat: parseFloat(c[1]), lon: parseFloat(c[0]) } : null;
      }).filter((v) => v && isFinite(v.lat) && isFinite(v.lon));
      out.innerHTML = items.length ? items.map((v, i) => `<li><button type="button" class="hm-pick" data-i="${i}">${esc(v.title)}</button></li>`).join("") : "<li>見つかりませんでした。市区町村名や番地まで入れてみてください。</li>";
      out.onclick = (e) => {
        const b = e.target.closest(".hm-pick");
        if (!b) return;
        const v = items[+b.dataset.i];
        const wasHome = mode === "home";
        place(v.lat, v.lon);
        // 出発地なら、その近くを大きく見せる(行き先はまだ無いので)。行き先なら draw が扇全体が入るように合わせる
        if (wasHome && !dest) { map.setView([v.lat, v.lon], 12, { animate: false }); fitted = true; }
        out.innerHTML = "";
        $("hm-q").value = "";
      };
    } catch (e) {
      out.innerHTML = "<li>住所検索につながりませんでした。地図をタップして置いてください。</li>";
    }
  }

  function locate() {
    if (!navigator.geolocation) { $("hm-msg").textContent = "この端末では現在地を使えません。"; return; }
    $("hm-msg").textContent = "現在地を探しています…";
    navigator.geolocation.getCurrentPosition((p) => {
      setMode("home");
      place(p.coords.latitude, p.coords.longitude);
      map.setView([p.coords.latitude, p.coords.longitude], 13, { animate: false });
    }, () => { $("hm-msg").textContent = "現在地を取れませんでした。地図をタップして置いてください。"; }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  $("hm-open").addEventListener("click", open);
  document.querySelectorAll('input[name="hm-mode"]').forEach((el) => el.addEventListener("change", () => setMode(el.value)));
  $("hm-search").addEventListener("submit", (e) => { e.preventDefault(); search(); });
  $("hm-here").addEventListener("click", locate);
  $("hm-clear").addEventListener("click", () => { home = null; dest = null; fitted = false; setMode("home"); draw(); });
  document.addEventListener("hoi:render", draw);
})();
