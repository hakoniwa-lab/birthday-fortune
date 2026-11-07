/*
 * ボイドタイム(void/)の画面。データは js/sky-data.js(NASA JPL Horizons の天体暦から tools/koyomi-articles/gen_sky.js が作る)。
 * 2026〜2030年の月ごとの一覧と、いまボイドタイムかどうか、水星逆行中かどうか。
 * 数える天体は「太陽〜冥王星(10天体)」と「太陽〜土星(7天体)」を切り替えられる(選んだ方は localStorage に保存)。
 * 依存: sky-data.js
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE = "birthday-fortune:void-bodies";
  const BASE = Date.UTC(2025, 11, 31, 15, 0); // 2026-01-01 00:00 JST
  const JA = { sun: "太陽", mercury: "水星", venus: "金星", mars: "火星", jupiter: "木星", saturn: "土星", uranus: "天王星", neptune: "海王星", pluto: "冥王星" };
  const SIGN = ["牡羊座", "牡牛座", "双子座", "蟹座", "獅子座", "乙女座", "天秤座", "蠍座", "射手座", "山羊座", "水瓶座", "魚座"];
  const WD = "日月火水木金土";
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
  const parts = (min) => { const t = new Date(BASE + min * 60000 + 9 * 3600000); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: WD[t.getUTCDay()], hh: t.getUTCHours(), mi: t.getUTCMinutes() }; };
  const hm = (p) => `${p.hh}:${String(p.mi).padStart(2, "0")}`;
  const dayLabel = (p) => `${p.m}/${p.d}(${p.wd})`;
  const nowMin = () => (Date.now() - BASE) / 60000;

  const selM = $("vd-month"), selB = $("vd-bodies");
  const first = parts(0);
  for (let y = 2026; y <= 2030; y++) for (let m = 1; m <= 12; m++) selM.add(new Option(`${y}年${m}月`, `${y}-${m}`));
  const n = parts(Math.max(0, Math.min(nowMin(), 5 * 525600)));
  selM.value = `${Math.max(2026, Math.min(2030, n.y))}-${n.y < 2026 ? 1 : n.y > 2030 ? 12 : n.m}`;
  try { const b = localStorage.getItem(STORE); if (b === "seven" || b === "all") selB.value = b; } catch (err) { /* 既定のまま */ }
  void first;

  const list = () => (selB.value === "seven" ? SKY_VOID_SEVEN : SKY_VOID_ALL);

  function status() {
    const t = nowMin();
    const L = list();
    const cur = L.find((v) => v[0] <= t && t < v[1]);
    const next = L.find((v) => v[0] > t);
    let html = "";
    if (cur) {
      const e = parts(cur[1]);
      html += `<p class="vd-now vd-now--on">いまはボイドタイムです。<strong>${dayLabel(e)} ${hm(e)}</strong>に月が${SIGN[(cur[2] + 1) % 12]}に入ると終わります。</p>`;
    } else if (next) {
      const s = parts(next[0]), e = parts(next[1]);
      html += `<p class="vd-now">いまはボイドタイムではありません。次は<strong>${dayLabel(s)} ${hm(s)}〜${s.d === e.d ? "" : dayLabel(e) + " "}${hm(e)}</strong>です。</p>`;
    } else {
      html += `<p class="vd-now">この一覧は2026〜2030年の分です。</p>`;
    }
    const mr = SKY_RETRO.mercury.find((r) => r[0] != null && r[1] != null && r[0] <= t && t < r[1]);
    const mn = SKY_RETRO.mercury.find((r) => r[0] != null && r[0] > t);
    if (mr) { const e = parts(mr[1]); html += `<p class="vd-now vd-now--retro">いまは水星逆行中です(${e.m}月${e.d}日 ${hm(e)}まで)。<a href="../guide/suisei-gyakko/">水星逆行の期間</a></p>`; }
    else if (mn) { const s = parts(mn[0]), e = parts(mn[1]); html += `<p class="vd-now vd-now--retro">次の水星逆行は${s.y}年${s.m}月${s.d}日〜${e.m}月${e.d}日です。<a href="../guide/suisei-gyakko/">一覧</a></p>`; }
    $("vd-status").innerHTML = html;
  }

  function render() {
    try { localStorage.setItem(STORE, selB.value); } catch (err) { /* 保存できなくても表示はする */ }
    const [y, m] = selM.value.split("-").map(Number);
    const t = nowMin();
    const rows = list().filter((v) => { const s = parts(v[0]), e = parts(v[1]); return (s.y === y && s.m === m) || (e.y === y && e.m === m); });
    const body = rows.map((v) => {
      const s = parts(v[0]), e = parts(v[1]);
      const len = (v[1] - v[0]) / 60;
      const asp = v[3] >= 0 ? `${JA[SKY_BODIES[v[3]]]} ${v[4]}°` : "なし";
      const on = v[0] <= t && t < v[1];
      return `<tr${on ? ' class="is-now"' : ""}><th>${dayLabel(s)} ${hm(s)}</th><td>${s.d === e.d && s.m === e.m ? "" : dayLabel(e) + " "}${hm(e)}<small>${len < 1 ? Math.round(len * 60) + "分" : len.toFixed(1) + "時間"}</small></td><td>${esc(asp)}<small>→${SIGN[(v[2] + 1) % 12]}</small></td></tr>`;
    }).join("");
    const total = rows.reduce((a, v) => a + (v[1] - v[0]) / 60, 0);
    $("vd-list").innerHTML = rows.length
      ? `<div class="table-scroll"><table class="spec spec--wrap vd-table"><thead><tr><th>始まり</th><th>終わり<small>長さ</small></th><th>最後の角度<small>次の星座</small></th></tr></thead><tbody>${body}</tbody></table></div>
         <p class="vd-small">${y}年${m}月にかかるボイドタイムは${rows.length}回、合わせて約${Math.round(total)}時間です。時刻はすべて日本時間で、分未満は四捨五入しています。</p>`
      : `<p>この月のデータはありません。</p>`;
    status();
  }

  selM.addEventListener("change", render);
  selB.addEventListener("change", render);
  render();
  setInterval(status, 60000);
})();
