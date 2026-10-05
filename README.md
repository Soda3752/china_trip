# 沖繩悠遊 5 日 · 4 夜

手機優先的單頁靜態行程網站，旅程為 **2026/10/05–10/09**。保留每日時間軸、資訊分頁、翻牌時鐘、「回到現在」與版本更新提示；無框架、無 npm 依賴、無建置需求。

## 資料來源與限制

行程依 **京王國際旅行社《沖繩悠遊5日》旅遊手冊**整理。公開網站僅包含行程及實用資訊，不收錄旅客姓名、私人電話、分房名單或來源 PDF。手冊時刻是參考安排，實際以導遊、當地確認、天候、交通及航空公司通知為準。

- 四晚皆住 Daiwa Roynet Hotel Naha Omoromachi（那霸歌町大和ROYNET飯店）。
- 全團人數未知，不設定 `meta.people`；Day 3 浮潛 7 名僅是活動參加人數。
- Day 4 全日自由活動、無團體旅遊車；國際通、新都心／DFS、ASHIBINAA 只是自選建議，不是確認行程。
- 餐食依手冊保留；Day 2 蝦蝦飯專門店是停留點，包含午餐為 INO 自助餐。
- 行李、氣候、免稅與其他旅遊提醒為手冊參考，不代表已核實最新規則或即時預報。

## 改行程

編輯 `data/itinerary.json`，內容與呈現分離。現有資訊分頁維持陣列結構：`transportTable`、`budget`、`checklist`、`didiGuide`、`notes`、`apps`。`didiGuide` 僅為相容舊資料的欄位名稱，內容已改為日本自由活動與返店交通提醒。

```json
{
  "type": "spot",
  "time": null,
  "timeLabel": "午後（時間待確認）",
  "name": "美麗海水族館",
  "image": null,
  "intro": "門票已安排，時間以導遊確認為準。",
  "map": { "keyword": "沖縄美ら海水族館", "city": "沖繩" }
}
```

### 時間規則

- `meta.timezone` 為 **`+09:00`（日本）**，時間判斷不得依賴裝置時區。
- 手冊有精確時間才寫 `time: "HH:mm"`。上午、午後、之後等未指定時刻，使用 `time: null` 與 `timeLabel`；不得猜測精確時刻。
- Day 4 所有項目都不排精確時間，不應顯示「現在／即將」的定時高亮。
- 台灣集合與航班時間必須換算日本時間供判斷，但以 `timeLabel` 明確保留台灣時間：集合台灣 07:00 → 日本 `08:00`；CI310 起飛台灣 10:00 → 日本 `11:00`；CI311 抵達台灣 14:10 → 日本 `15:10`。
- Day 3 浮潛結束 `16:30` 是手冊預計時刻，顯示標籤與說明必須保留「預計」及天候／教練限制。

### 地圖與圖片

導航採 Google Maps **HTTPS `api=1` 關鍵字搜尋**，不是精確路線保證。`coords` 保持空物件，不加入猜測座標；未指定的餐廳分店或地址不得自行補入。所有圖片目前使用 `image: null` 漸層佔位，後續僅加入已確認地點與授權的圖片。

## 本地預覽與驗證

在專案根目錄執行：

```bash
python3 -m http.server 8000
```

瀏覽 `http://localhost:8000/`。`?now=` 覆寫是**日本當地時間**，例如：

- 旅程前：`http://localhost:8000/?now=2026-10-04T20:00`
- 行程中：`http://localhost:8000/?now=2026-10-06T13:00`
- 全日自由活動：`http://localhost:8000/?now=2026-10-08T14:00`
- 旅程後：`http://localhost:8000/?now=2026-10-10T09:00`

```bash
python3 -m json.tool data/itinerary.json > /dev/null
for file in js/*.js; do node --check "$file"; done
node --test tests/*.test.js
```

另以 390px 手機寬度檢查五天與資訊分頁：無水平溢出、無 JS 例外、未定時標籤可讀、航班時區標示正確、地圖連結搜尋正確目的地。

## 部署

推送 `main` 由 `.github/workflows/deploy.yml` 部署至 GitHub Pages：`https://soda3752.github.io/china_trip/`。部署產生 `build-info.json` 供最後更新與版本刷新使用，不手動提交此產物。來源手冊／PDF 與敏感名單不得加入 Git。提交與推送前必須完成驗證並獲授權。
