/*
 * 地球から見た惑星の位置(その日の春分点を基準にした黄経)と、逆行(留)の時期。
 * 依存: astro.js(PLANETS / heliocentric / centuries / ttFrom / sunLongitude / moonLongitude / norm360)
 *
 * astro.js の planetLongitude は軌道要素の基準(2000年の春分点)のままで、その日の春分点とは約0.4度ずれる(歳差)。
 * ここでは光の届く時間・歳差・章動・光行差を足して、NASA JPL Horizons の「黄道座標(of date)」に合わせる。
 * 天王星・海王星は JPL「Approximate Positions of the Planets」表1(1800〜2050年)、冥王星は同じ表の旧版の値。
 */
PLANETS.uranus = { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], i: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], peri: [170.95427630, 0.40805281], node: [74.01692503, 0.04240589] };
PLANETS.neptune = { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], i: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], peri: [44.96476227, -0.32241464], node: [131.78422574, -0.00508664] };
PLANETS.pluto = { a: [39.48211675, -0.00031596], e: [0.24882730, 0.00005170], i: [17.14001206, 0.00004818], L: [238.92903833, 145.20780515], peri: [224.06891629, -0.04062942], node: [110.30393684, -0.01183482] };

const PLANET_JA = { sun: "太陽", moon: "月", mercury: "水星", venus: "金星", mars: "火星", jupiter: "木星", saturn: "土星", uranus: "天王星", neptune: "海王星", pluto: "冥王星" };

/* 章動(黄経)。度。Meeus 22章の簡易式(誤差0.5秒角) */
function nutationLon(T) {
  const om = 125.04452 - 1934.136261 * T;
  const L = 280.4665 + 36000.7698 * T;
  const Lm = 218.3165 + 481267.8813 * T;
  return (-17.20 * sinD(om) - 1.32 * sinD(2 * L) - 0.23 * sinD(2 * Lm) + 0.21 * sinD(2 * om)) / 3600;
}

/* 歳差(2000年の春分点からその日の春分点へ、黄経方向)。度 */
function precessionLon(T) {
  return (5028.796195 * T + 1.1054348 * T * T) / 3600;
}

/* 地球から見た惑星の黄経(その日の春分点、見かけの位置)。jdUt は世界時のユリウス日 */
function planetGeoLon(name, jdUt) {
  const tt = ttFrom(jdUt);
  if (name === "sun") return sunLongitude(tt);
  if (name === "moon") return moonGeoLon(jdUt);
  const T = centuries(tt);
  const e = heliocentric("earth", T);
  let tau = 0, dx = 0, dy = 0;
  for (let k = 0; k < 3; k++) {
    const p = heliocentric(name, centuries(tt - tau));
    dx = p.x - e.x; dy = p.y - e.y;
    const dz = p.z - e.z;
    tau = 0.0057755183 * Math.sqrt(dx * dx + dy * dy + dz * dz); // 光が届くまでの日数
  }
  let lon = Math.atan2(dy, dx) * R2D;
  lon += precessionLon(T) + nutationLon(T);
  lon += -20.49552 / 3600 * cosD(sunLongitude(tt) - lon); // 年周光行差
  return norm360(lon);
}

/* 月の黄経(その日の春分点、見かけの位置)。astro.js の moonLongitude に章動を足す */
function moonGeoLon(jdUt) {
  const tt = ttFrom(jdUt);
  return norm360(moonLongitude(tt) + nutationLon(centuries(tt)));
}

/* -180〜180 に寄せた差 */
function lonDiff(a, b) {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/* 黄経の1日あたりの変化(中心差分) */
function planetSpeed(name, jd) {
  const h = 0.02;
  return lonDiff(planetGeoLon(name, jd + h), planetGeoLon(name, jd - h)) / (2 * h);
}

/*
 * 逆行の時期。from〜to(世界時のユリウス日)に始まる逆行を返す。
 * sr = 留(逆行の始まり)、sd = 留(順行に戻る)。shadowIn は sd の位置を初めて通る時(逆行前のシャドー)、
 * shadowOut は sr の位置に戻る時(逆行後のシャドー)。
 */
const _retroCache = new Map();
function retrogradesOf(name, from, to) {
  const key = name + "|" + from + "|" + to;
  if (_retroCache.has(key)) return _retroCache.get(key);
  const step = name === "mercury" ? 0.5 : name === "venus" || name === "mars" ? 1 : 2;
  const stations = [];
  let prev = planetSpeed(name, from - 400);
  for (let t = from - 400 + step; t <= to + 400; t += step) {
    const v = planetSpeed(name, t);
    if ((prev > 0) !== (v > 0)) {
      let a = t - step, b = t;
      const sa = prev > 0;
      for (let k = 0; k < 40; k++) {
        const m = (a + b) / 2;
        if ((planetSpeed(name, m) > 0) === sa) a = m; else b = m;
      }
      const jd = (a + b) / 2;
      stations.push({ jd, lon: planetGeoLon(name, jd), turn: sa ? "retro" : "direct" });
    }
    prev = v;
  }
  const out = [];
  for (let i = 0; i + 1 < stations.length; i++) {
    const sr = stations[i], sd = stations[i + 1];
    if (sr.turn !== "retro" || sd.turn !== "direct") continue;
    if (sr.jd < from || sr.jd >= to) continue;
    out.push({ name, sr, sd, shadowIn: crossTime(name, sd.lon, sr.jd, -1), shadowOut: crossTime(name, sr.lon, sd.jd, +1) });
  }
  _retroCache.set(key, out);
  return out;
}

/* 時刻 t0 から dir(-1=過去へ / +1=未来へ)にさかのぼって、黄経 lon を順行で通る時刻 */
function crossTime(name, lon, t0, dir) {
  const step = 0.5;
  let t = t0, d0 = lonDiff(planetGeoLon(name, t), lon);
  for (let k = 0; k < 2000; k++) {
    const t1 = t + dir * step;
    const d1 = lonDiff(planetGeoLon(name, t1), lon);
    if ((d0 > 0) !== (d1 > 0) && Math.abs(d0 - d1) < 10) {
      let a = Math.min(t, t1), b = Math.max(t, t1);
      const sa = lonDiff(planetGeoLon(name, a), lon) > 0;
      for (let j = 0; j < 40; j++) {
        const m = (a + b) / 2;
        if ((lonDiff(planetGeoLon(name, m), lon) > 0) === sa) a = m; else b = m;
      }
      return (a + b) / 2;
    }
    t = t1; d0 = d1;
  }
  return null;
}
