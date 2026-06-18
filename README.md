# 上海 5天4夜 · 自由行網頁

手機優先的單頁靜態行程網頁，依當下時間（UTC+8）自動指出「現在該在哪個景點」，每個景點可一鍵導航高德地圖，點與點之間有可點擊的交通串接。部署於 GitHub Pages。

## 功能

- **Day 1–5 分頁 + 資訊分頁**：依今天日期自動開到當天，當前時段景點以暖橘脈動高亮。
- **時間軸 spine**：填充至「現在」，清楚呈現「已過 / 現在 / 即將」三態。
- **景點卡片**：景點圖（目前為漸層佔位）＋ 簡介 ＋「導航」鈕。
- **交通串接**：點擊跳轉高德地圖並帶入「即將前往」目的地。
- **回到現在**：手動瀏覽其他天後，一鍵回到當前景點。

## 改行程：只動一個檔

編輯 [`data/itinerary.json`](data/itinerary.json)，程式碼完全不用碰。

每天的 `items` 由兩種節點交錯組成：

```jsonc
// 景點卡片
{
  "type": "spot",
  "time": "14:30",                 // HH:mm，當前景點判斷依此
  "name": "豫園",
  "image": null,                   // null=漸層佔位；補圖改成 "images/yuyuan.jpg"
  "intro": "明代園林…",            // 簡介
  "map": { "keyword": "豫園", "city": "上海" }  // 選填，有才顯示「導航」鈕
}

// 交通串接（夾在兩景點之間）
{
  "type": "transit",
  "mode": "taxi",                  // walk / taxi / metro / maglev
  "desc": "打滴約 60 分鐘",
  "to": { "keyword": "豫園", "city": "上海" }   // 點擊→高德，帶入此目的地
}
```

### 補景點真圖

1. 把圖片放進 `images/`（例如 `images/yuyuan.jpg`）。
2. 在該 spot 的 `image` 欄填路徑 `"images/yuyuan.jpg"`。

### 校正景點座標

景點與交通的精準度由 `data/itinerary.json` 最上方的 `coords` 表決定（高德 GCJ-02 座標 `"經度,緯度"`）：

- 有座標 → 景點「導航」為精準標點、交通串接為真實 A→B 路線規劃。
- 移除某筆 → 該地點退回關鍵字搜尋（由高德自行解析地點）。

```jsonc
"coords": {
  "豫園": "121.4920,31.2270"
}
```

> ⚠️ 目前座標為地標**近似位置**（非實地校準），路線會導到地標附近。建議在手機上對較精確的場所（如「宮宴 北京西路1485號」「亞朵酒店」）各確認一次，必要時在此表微調。

## 本地預覽

```bash
cd china_trip
python3 -m http.server 8000
# 瀏覽器開 http://localhost:8000
```

測試「當前景點」：在網址加 `?now=` 覆寫時間（不影響真實時間）：

```
http://localhost:8000/?now=2026-07-14T10:30
```

## 部署到 GitHub Pages

1. 建立 GitHub repo 並推上去：
   ```bash
   git init && git add -A && git commit -m "init"
   git branch -M main
   git remote add origin <你的 repo URL>
   git push -u origin main
   ```
2. GitHub repo → **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
3. 之後每次 push 到 `main`，`.github/workflows/deploy.yml` 會自動部署。
4. 部署完成後網址約為 `https://<帳號>.github.io/<repo>/`。

> `.nojekyll` 已加入，避免 GitHub Pages 的 Jekyll 處理底線開頭資源。

## 注意

- 高德 deeplink 以 `callnative=1` 喚起高德 App，未安裝則開網頁版；建議在 iOS / Android 真機各測一次。
- 設計文件：`.claude/report/2026_06_18/上海自由行網頁_設計文件.md`。
