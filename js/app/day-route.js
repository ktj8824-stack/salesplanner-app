/* =========================================================================
   세일즈플래너 하루 동선 (홈 카드)
   - 오늘 장소가 있는 일정을 시간 순서대로 한 줄 동선으로 보여 줌
   - 장소 → 좌표: 서버 myplanner-route (카카오 주소 · 장소 검색). 한 번 찾은 좌표는 폰에 저장
   - 구간마다 대략 이동 시간을 재서 '빠듯해요' 표시
   - 시간 순서보다 짧은 순서가 있으면 알려 줌 (일정은 바꾸지 않음 — 바꿀지는 사람이 정함)
   - 네이버 지도 앱으로 경유지까지 한 번에 길안내 (앱이 없으면 다음 장소만 웹 지도로)
   ========================================================================= */
(function () {
  'use strict';
  const KEY = 'sp_geo_v1';
  const CITY_KMH = 22, ROAD = 1.35;   // 도심 평균 속도 · 직선 → 도로 거리 보정 (대략값)
  const DEMO = {   // 체험 모드 예시 좌표 (서버 없이)
    '성수 지점 3층': [37.5446, 127.0559], '왕십리역 카페': [37.5612, 127.0371], '성수동 사무실': [37.5420, 127.0600],
    '뚝섬역 근처': [37.5474, 127.0473], '건대입구 사무실': [37.5404, 127.0692],
  };
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { cache = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* */ } };

  /** 두 좌표 사이 직선 거리 (km) */
  function km(a, b) {
    const R = 6371, r = x => x * Math.PI / 180;
    const dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  /** 대략 이동 분 (차 기준). 걸어갈 거리(1km 안)는 도보로 */
  function minutes(d, mode) {
    if (mode === 'walk' || d < 1) return Math.max(3, Math.round(d * ROAD / 4.5 * 60));
    return Math.max(5, Math.round(d * ROAD / CITY_KMH * 60));   // 운전 시간만 (주차 · 일찍 도착 여유는 일정표 역산이 따로 더함)
  }
  const toMin = hm => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + m; };

  /** 순서 그대로 지나는 총 거리 */
  function pathKm(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += km(pts[i - 1], pts[i]); return s; }
  /** 첫 장소는 그대로 두고 가까운 곳부터 (작은 동선에 충분) */
  function nearestOrder(items) {
    if (items.length < 3) return items.slice();
    const left = items.slice(1), out = [items[0]];
    while (left.length) {
      const last = out[out.length - 1].geo;
      let bi = 0; left.forEach((x, i) => { if (km(last, x.geo) < km(last, left[bi].geo)) bi = i; });
      out.push(left.splice(bi, 1)[0]);
    }
    return out;
  }

  window.DayRoute = {
    km, minutes, nearestOrder, pathKm,
    /** 장소 이름 · 주소의 좌표 (못 찾으면 null). 같은 글자는 다시 묻지 않음 */
    async geocode(q) {
      q = String(q || '').trim(); if (!q) return null;
      if (cache[q] !== undefined) return cache[q];
      if (!(window.Store && Store.mode === 'supabase' && Store.client)) return DEMO[q] || null;
      let hit = null;
      for (const service of ['kakao_address', 'kakao_local']) {
        try {
          const { data } = await Store.client.functions.invoke('myplanner-route', { body: { service, keyword: q } });
          const d = data && data.documents && data.documents[0];
          if (d && d.x && d.y) { hit = [Number(d.y), Number(d.x)]; break; }
        } catch { /* 다음 방법 */ }
      }
      cache[q] = hit; save();
      return hit;
    },

    /** 오늘 동선 계산: [{ s, place, geo, leg: {km, min, gap, tight} }] + 더 짧은 순서 제안 */
    async plan(list, placeOf) {
      const items = [];
      for (const s of list) {
        const place = placeOf(s); if (!place) continue;
        items.push({ s, place, geo: await this.geocode(place) });
      }
      for (let i = 1; i < items.length; i++) {
        const a = items[i - 1], b = items[i];
        if (!a.geo || !b.geo) continue;
        const d = km(a.geo, b.geo), min = minutes(d, b.s.mode), gap = toMin(b.s.start) - toMin(a.s.end || a.s.start);
        b.leg = { km: Math.round(d * ROAD * 10) / 10, min, gap, tight: gap < min };
      }
      const known = items.filter(x => x.geo);
      let better = null;
      if (known.length >= 3) {
        const alt = nearestOrder(known), now = pathKm(known.map(x => x.geo)), alt_ = pathKm(alt.map(x => x.geo));
        if (now - alt_ > 2 && alt_ < now * 0.8) better = { order: alt.map(x => x.s.title), saveKm: Math.round((now - alt_) * ROAD * 10) / 10 };
      }
      return { items, better, missing: items.filter(x => !x.geo).map(x => x.place) };
    },

    /** 네이버 지도 앱: 출발(첫 장소) → 경유(최대 5곳) → 도착(마지막 장소) */
    naverApp(items) {
      const g = items.filter(x => x.geo); if (g.length < 2) return '';
      const p = (k, x) => `${k}lat=${x.geo[0]}&${k}lng=${x.geo[1]}&${k}name=${encodeURIComponent(x.place)}`;
      const vias = g.slice(1, -1).slice(0, 5).map((x, i) => p('v' + (i + 1), x)).join('&');
      return `nmap://route/car?${p('s', g[0])}&${p('d', g[g.length - 1])}${vias ? '&' + vias : ''}&appname=${encodeURIComponent(location.hostname || 'salesplanner')}`;
    },
    /** 웹 지도: 한 곳 길찾기 */
    webTo(x) {
      return x.geo ? `https://map.kakao.com/link/to/${encodeURIComponent(x.place)},${x.geo[0]},${x.geo[1]}`
        : `https://map.kakao.com/link/search/${encodeURIComponent(x.place)}`;
    },
  };
})();
