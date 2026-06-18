// 高德地圖 deeplink 組裝
// 設計：以關鍵字（keyword）為主，手機點擊優先喚起高德 App，未安裝自動 fallback 網頁。
// 保留空間：若景點資料補上 coord（"經度,緯度"，gaode 座標系），會自動升級為精準標點／真實路線規劃。

const AMAP_SRC = 'shanghai-trip';

// 交通方式 → 高德路線規劃 mode
function amapNavMode(mode) {
  if (mode === 'walk') return 'walk';
  if (mode === 'taxi') return 'car';
  return 'bus'; // metro / maglev / 其他
}

// 景點導航：有座標走標點，否則關鍵字搜尋
function amapSearchUrl(place) {
  if (!place) return null;
  if (place.coord) {
    const p = new URLSearchParams({
      position: place.coord,
      name: place.keyword || '',
      src: AMAP_SRC,
      coordinate: 'gaode',
      callnative: '1',
    });
    return `https://uri.amap.com/marker?${p.toString()}`;
  }
  const p = new URLSearchParams({ keyword: place.keyword, src: AMAP_SRC, callnative: '1' });
  if (place.city) p.set('city', place.city);
  return `https://uri.amap.com/search?${p.toString()}`;
}

// 交通串接：有目的地座標 → 真實路線規劃；否則 fallback 開啟目的地地點卡（App 內可一鍵「到這去」）
function amapNavUrl(to, mode) {
  if (!to) return null;
  if (to.coord) {
    const p = new URLSearchParams({
      to: to.coord,
      toname: to.keyword || '',
      mode: amapNavMode(mode),
      src: AMAP_SRC,
      coordinate: 'gaode',
      callnative: '1',
    });
    return `https://uri.amap.com/navigation?${p.toString()}`;
  }
  return amapSearchUrl(to);
}
