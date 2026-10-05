# CLAUDE.md

## 專案本質

手機優先的沖繩 5 日 4 夜靜態行程網站，日期 **2026-10-05 至 2026-10-09**。純 HTML、CSS、原生 JavaScript，無框架、無 npm 依賴。使用海島旅程筆記主題，保留時間軸、分頁、翻牌時鐘、「回到現在」、版本更新及 GitHub Pages 部署。

## 主題與可及性

- 主要介面為 Explore 每日行程瀏覽，不做大型宣傳 hero；精簡海水標頭、橫向日期膠囊、圓形節點與抽象波浪。
- CSS tokens：`--sand #fff8ed`、`--surface #fffdf8`、`--ink #163547`、`--muted #526775`、`--ocean #087e8b`、`--ocean-deep #086471`、`--seafoam #e3f2ed`、`--coral #b74432`、`--coral-soft #fff0e8`、`--line #cadfd9`；卡片 `--radius: 22px`。
- 字體僅 DM Sans 與 Noto Sans TC，sans-serif 替代；不恢復 Cinzel、襯線、墨綠鎏金或菱形軌道。
- 時間標籤保留正常文流並換行；控制項至少 44px，鍵盤焦點明顯，過去卡片不降低文字透明度。320px／390px 檢查長標籤、資訊表格及頁面無水平溢出。
- 收合沿用 `.head-collapsed` 與 JavaScript 量測的 `--topbar-h`；不可寫死標頭高度。保留 loader／hide／FAB／tab IDs 與行為 hooks。
- loader 預設不顯示，只有資料成功初始化後加入 `.is-ready`；`.is-hidden`、無 JavaScript、載入失敗與減少動態偏好都不得遮住內容。減少動態時同時停用程式化平滑捲動。
- 裝飾 SVG 與時間軸軌道使用 `aria-hidden="true"`；照片有替代文字，出處在本文下方，不蓋住時間或影像。

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
- 使用者授權估算原本未定時的活動：新增時間必須 `timeEstimated: true` 並在 `timeLabel` 寫明「預估／時間僅供參考」，不得改動手冊原有的集合與航班時刻；非授權的新資料仍可保持 `time: null`。
- Day 4 時段僅是自由活動參考，所有選項仍可取捨，Outlet 不代表一定要與市區路線全部走完。
- 台灣集合、起飛、返台抵達的 `time` 存日本等值，`timeLabel` 清楚標台灣原時刻：07:00 → 08:00、10:00 → 11:00、14:10 → 15:10。
- Day 3 `16:30` 為浮潛預計結束，必須保留「預計」與天候／教練限制。
- `image: null` 或圖片載入失敗使用抽象海岸紋理，不冒充實景；新增圖片必須確認適合目的地與使用權利。選填 `imageAlt`、`imageCaption`、`imageSourceUrl`、`imageCredit`、`imageLicense`；代表性照片在 caption 明確寫「示意」，來源只接受有效且不帶帳密的 HTTPS 網址。
- `transit`（需要才使用）：`mode`、`desc`、`to: {keyword, city}`；不推定車程、車資。
- `info` 延續 `renderInfo()` 結構：`transportTable`（`from/method/cost/note`）、`budget`（`item/perPerson/note`）、`checklist`、`didiGuide`、`notes`、`apps`（`name/use`）。`didiGuide` 是相容舊 schema 的技術名稱，內容為日本自由活動交通提醒。標題欄位 `budgetTitle`、`transportGuideTitle`、`notesTitle` 供渲染使用，不改成其他目的地內容。

## 程式責任

- 時間工具：讀取旅程時區，提供與裝置時區無關的當前日本時間、`?now=` 日本當地覆寫、旅程前／中／後解析；未定時項目不當作精確時間安排。
- 地圖工具：`maps.js` 產生 Google Maps HTTPS 備援網址；`maps-launch.js` 在手機的直接點擊中優先喚起 App，並提供網頁 fallback。保留桌面與修飾鍵點擊行為；無實機時不得宣稱已驗證 OS 喚起。
- 卡片不展開照片作者、來源與長備註，必要授權集中於頁尾 `photo-credits.html`；示意／周邊標示與完整 alt 保留。
- `js/app.js`：載入資料、分頁、卡片／交通渲染、`timeLabel`、可缺省人數、資訊頁、翻牌時鐘與版本更新。
- 未定時與預計標籤需可在手機上換行；禁止用虛構時間來修排版或高亮。

## 開發與驗證

```bash
python3 -m http.server 8000
python3 -m json.tool data/itinerary.json > /dev/null
for file in js/*.js; do node --check "$file"; done
node --test tests/*.test.js
```

覆寫範例：`http://localhost:8000/?now=2026-10-06T13:00`。測試使用 Node 內建 `assert`／`vm`，無需 npm。驗證五個日期、UTC+9 跨午夜、台灣／日本航班換算、旅程前中後，以及預估與自由日自選標籤。另檢查 390px 五天與資訊分頁、無水平溢出或 console 例外、全部地圖為 Google HTTPS 搜尋、無未知人數顯示及無敏感內容。

## 部署與變更範圍

`main` 推送觸發 `.github/workflows/deploy.yml`，網站為 `https://soda3752.github.io/china_trip/`。`build-info.json` 由 CI 產生，不手動提交。保留海島主題與全域函式載入方式，改內容優先只改 JSON；需改時間或地圖契約時同步更新測試。多人協作遵守檔案所有權，不修改他人負責檔案；提交或推送前需經授權並完成驗證。
