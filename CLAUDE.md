# CLAUDE.md

## 專案本質

手機優先的沖繩 5 日 4 夜靜態行程網站，日期 **2026-10-05 至 2026-10-09**。純 HTML、CSS、原生 JavaScript，無框架、無 npm 依賴。保留既有視覺設計、時間軸、分頁、翻牌時鐘、「回到現在」、版本更新及 GitHub Pages 部署。

## 內容與來源

`data/itinerary.json` 是公開內容的唯一權威資料檔，依京王國際旅行社《沖繩悠遊5日》旅遊手冊整理；實際行程以導遊、當地確認、天候、交通及航空公司通知為準。

- 不加入旅客姓名、私人電話、房間分配、來源 PDF 或敏感手冊段落。
- 全團人數未知，不設定 `meta.people`；浮潛 7 名不是全團人數。
- 四晚保留原手冊飯店：Daiwa Roynet Hotel Naha Omoromachi。公開飯店地址及電話可保留。
- 餐食不得改寫成推測餐廳或自訂包含餐：Day 2 蝦蝦飯是停留點，午餐為 INO 自助餐。
- Day 3 晚餐後遊覽車服務結束，自行回飯店。
- Day 4 無團體旅遊車、全日自由；建議景點不是固定路線。
- 航空行李、免稅、氣候等標示為手冊參考，未核實最新政策或即時天氣。

## 資料契約

- `meta`：標題、日期區間、飯店、`timezone: "+09:00"`。不要依賴人數存在。
- `coords`：保持 `{}`；地圖使用 Google Maps HTTPS `api=1` 關鍵字搜尋，不加未驗證座標、分店或地址。
- `days[]`：`day`、ISO `date`、繁體中文 `weekday`、`title`、`items`、`tips`、`transport`。
- `spot`：`time` 為日本時間 `HH:mm` 或 `null`；`timeLabel` 為顯示文字；`name`、`image`、`intro` 與選填 `map: {keyword, city}`。
- 未指定精確時刻必須 `time: null`，例如 `timeLabel: "午後（時間待確認）"`；保留原始順序，不捏造車程或停留時間。
- Day 4 全部 `time: null`，不應錯誤顯示定時「現在／即將」。
- 台灣集合、起飛、返台抵達的 `time` 存日本等值，`timeLabel` 清楚標台灣原時刻：07:00 → 08:00、10:00 → 11:00、14:10 → 15:10。
- Day 3 `16:30` 為浮潛預計結束，必須保留「預計」與天候／教練限制。
- `image: null` 使用現有佔位；新增圖片必須確認適合目的地與使用權利。
- `transit`（需要才使用）：`mode`、`desc`、`to: {keyword, city}`；不推定車程、車資。
- `info` 延續 `renderInfo()` 結構：`transportTable`（`from/method/cost/note`）、`budget`（`item/perPerson/note`）、`checklist`、`didiGuide`、`notes`、`apps`（`name/use`）。`didiGuide` 是相容舊 schema 的技術名稱，內容為日本自由活動交通提醒。標題欄位 `budgetTitle`、`transportGuideTitle`、`notesTitle` 供渲染使用，不改成其他目的地內容。

## 程式責任

- 時間工具：讀取旅程時區，提供與裝置時區無關的當前日本時間、`?now=` 日本當地覆寫、旅程前／中／後解析；未定時項目不當作精確時間安排。
- 地圖工具：Google Maps HTTPS 搜尋連結；不需要原生 App scheme 或未安裝彈窗。
- `js/app.js`：載入資料、分頁、卡片／交通渲染、`timeLabel`、可缺省人數、資訊頁、翻牌時鐘與版本更新。
- 未定時與預計標籤需可在手機上換行；禁止用虛構時間來修排版或高亮。

## 開發與驗證

```bash
python3 -m http.server 8000
python3 -m json.tool data/itinerary.json > /dev/null
for file in js/*.js; do node --check "$file"; done
node --test tests/*.test.js
```

覆寫範例：`http://localhost:8000/?now=2026-10-06T13:00`。測試使用 Node 內建 `assert`／`vm`，無需 npm。驗證五個日期、UTC+9 跨午夜、台灣／日本航班換算、旅程前中後及 Day 4 無定時高亮。另檢查 390px 五天與資訊分頁、無水平溢出或 console 例外、全部地圖為 Google HTTPS 搜尋、無未知人數顯示及無敏感內容。

## 部署與變更範圍

`main` 推送觸發 `.github/workflows/deploy.yml`，網站為 `https://soda3752.github.io/china_trip/`。`build-info.json` 由 CI 產生，不手動提交。保留既有設計與全域函式載入方式，改內容優先只改 JSON；需改時間或地圖契約時同步更新測試。多人協作遵守檔案所有權，不修改他人負責檔案；提交或推送前需經授權並完成驗證。
