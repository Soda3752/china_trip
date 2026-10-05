// Google Maps 官方 HTTPS URLs：只使用來源提供的地點關鍵字，不猜座標或喚起 App scheme。
function googleSearchUrl(place) {
  if (!place || !place.keyword) return null;
  const params = new URLSearchParams({ api: '1', query: place.keyword });
  return `https://www.google.com/maps/search/?${params}`;
}

function googleDirectionsUrl(place, mode) {
  if (!place || !place.keyword) return null;
  const travelmode = mode === 'walk' ? 'walking'
    : mode === 'taxi' || mode === 'car' ? 'driving' : 'transit';
  const params = new URLSearchParams({ api: '1', destination: place.keyword, travelmode });
  return `https://www.google.com/maps/dir/?${params}`;
}
