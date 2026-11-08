/*
 * 方位盤(hoi/)の「地図で方角を測る」の計算。地球は半径6371kmの球として扱う(日本の中の方角なら楕円体との差は0.2度ほど)。
 *
 * 方角の測り方は3通りある。どれで測るかで、方位の区切りの近くでは答えが変わる。
 *   大圏(真北) … 出発地から行き先へ地球の表面をまっすぐ進むときの、出発する瞬間の向き。出発地を中心にした正距方位図法の地図で引いた線の向き
 *   地図の直線 … ふつうのウェブ地図(メルカトル図法)で2点を定規で結んだ線の向き(等角航路)。遠いほど大圏とずれる
 *   方位磁石 … 方位磁石の北(磁北)は真北より西にずれている(偏角)。磁石の北を北として測ると、方角は偏角の分だけ大きく読める
 * 偏角は国土地理院の「磁気図2020.0年値」の近似式(緯度・経度の2次式)で出す。
 *
 * 方位の区切り: 十二支は子(北)を真ん中に30度ずつ(子＝345〜15度)、8方位は北を真ん中に45度ずつ(北＝337.5〜22.5度)。
 */

const HG_R = 6371.0088;
const hgRad = (d) => d * Math.PI / 180, hgDeg = (r) => r * 180 / Math.PI;
const hgNorm = (d) => ((d % 360) + 360) % 360;

/* 大圏の出発方位(真北から時計回りの度) */
function hgGreatBearing(lat1, lon1, lat2, lon2) {
  const p1 = hgRad(lat1), p2 = hgRad(lat2), dl = hgRad(lon2 - lon1);
  return hgNorm(hgDeg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))));
}

/* メルカトル図法の地図で2点を結んだ直線の方位(等角航路) */
function hgRhumbBearing(lat1, lon1, lat2, lon2) {
  const y = (lat) => Math.log(Math.tan(Math.PI / 4 + hgRad(lat) / 2));
  let dl = hgRad(lon2 - lon1);
  if (Math.abs(dl) > Math.PI) dl = dl > 0 ? dl - 2 * Math.PI : dl + 2 * Math.PI;
  return hgNorm(hgDeg(Math.atan2(dl, y(lat2) - y(lat1))));
}

/* 2点間の距離(km、大圏) */
function hgDistance(lat1, lon1, lat2, lon2) {
  const p1 = hgRad(lat1), p2 = hgRad(lat2), dp = p2 - p1, dl = hgRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * HG_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* 出発地から方位 brg に dist km 進んだ地点(大圏)。地図に方位の扇を描くのに使う */
function hgDest(lat, lon, brg, dist) {
  const p1 = hgRad(lat), l1 = hgRad(lon), t = hgRad(brg), d = dist / HG_R;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [hgDeg(p2), ((hgDeg(l2) + 540) % 360) - 180];
}

/*
 * 偏角(度。西偏を正)。国土地理院 磁気図2020.0年値の近似式:
 *   D = 8°15.822′ + 18.462′Δφ − 7.726′Δλ + 0.007′Δφ² − 0.007′ΔφΔλ − 0.655′Δλ²   (Δφ=緯度−37°、Δλ=経度−138°)
 * 地域の磁気異常は入らず、離島では精度が落ちる(国土地理院の注意書き)。
 */
function hgDeclination(lat, lon) {
  const a = lat - 37, b = lon - 138;
  return (8 * 60 + 15.822 + 18.462 * a - 7.726 * b + 0.007 * a * a - 0.007 * a * b - 0.655 * b * b) / 60;
}

/* 十二支の番号(子=0)と8方位の番号(北=0) */
function hgSector12(deg) { return Math.floor(hgNorm(deg + 15) / 30); }
function hgSector8(deg) { return Math.floor(hgNorm(deg + 22.5) / 45); }

/* 2点の方角を3通りで測る。true=大圏(真北)、rhumb=地図の直線、mag=大圏を方位磁石で読んだ値 */
function hgMeasure(a, b) {
  const tru = hgGreatBearing(a.lat, a.lon, b.lat, b.lon);
  const rhumb = hgRhumbBearing(a.lat, a.lon, b.lat, b.lon);
  const decl = hgDeclination(a.lat, a.lon);
  const mag = hgNorm(tru + decl);
  const pack = (d) => ({ deg: d, s12: hgSector12(d), s8: hgSector8(d) });
  return { dist: hgDistance(a.lat, a.lon, b.lat, b.lon), decl, true: pack(tru), rhumb: pack(rhumb), mag: pack(mag) };
}
