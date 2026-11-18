# 股_V0.6｜第一次部署指南（站長閱讀，親友不必操作）

## 0. 這一版已完成／尚未完成什麼？

**已寫入程式：** 手機及桌面網頁、篩選 UI、個股查詢、人造示範資料、MA240／MACD／RSI／KD／布林帶／ATR／量比、W/M/V/倒 V/圓弧／20 日突破候選、多空評分、法人買超參考價計算、公開盤後行情擷取腳本、集中歷史庫、自動部署 Workflow、CSV 匯出、PWA。

**尚未完成：** 任何人的實際 GitHub 網站部署、TWSE／TPEx 實際 API 回應驗證、完整上市櫃 250 日年線回補、排程真實運行驗證、盤中合法即時報價、主力分點資料供應。網頁上的「人造示範資料」不是即時行情。

## 1. 不用安裝任何軟體，先測介面

1. 下載 `股_V0.6.zip` 並完整解壓縮。
2. 進入 `股_V0.6/public/index.html`，用 Chrome 或 Edge 直接開啟。
3. 標示「人造示範資料」。測試多空切換、年線、型態、搜尋、個股查詢、CSV 匯出、手機縮放。
4. 若沒有看到示範資料，確認 `public/data/demo.js` 有一起解壓縮。單獨複製 `index.html` 無法正常使用。

## 2. 建立一個免費 GitHub 帳號（只需網站管理者）

1. 開啟 https://github.com/signup ，由本人註冊並開啟兩步驟驗證。
2. 登入 GitHub → 右上角 `+` → `New repository`。
3. 存放庫名稱建議 `stock-radar`（可自行更名），選擇 **Public**，按 `Create repository`。
4. 將解壓後的 `股_V0.6` 資料夾內所有檔案（**包含隱藏資料夾 `.github/workflows/publish.yml`**）上傳至存放庫根目錄。GitHub 網站的 `Add file` → `Upload files` 可以拖入檔案；若瀏覽器不接受完整資料夾，可逐層在 GitHub 建立檔案或請熟悉 Git 的人協助一次性上傳。**不要只上傳 ZIP**，GitHub 不會自動解壓程式。
5. 進入存放庫 `Settings` → `Pages` → `Build and deployment` → `Source` 選 **GitHub Actions**（不是 Deploy from a branch）。
6. 進入 `Actions` 頁籤，找到「股 V0.6 每日盤後更新與發布」→ `Run workflow`。首次手動執行 `backfill_days` 建議填 `100`（代表一次嘗試回補 100 個日曆天；耗時和成功率取決於官方網站）。
7. 右側執行流程有綠色勾號，`Settings` → `Pages` 才會顯示實際網址，常見格式是 `https://<帳號>.github.io/stock-radar/`。這只是範例，實際網址以 GitHub 顯示為準。親友只需開這個網址。
8. 若 `Actions` 需要手動啟用，請先在該頁同意啟用；若 `Pages` 不能發布，先確認公開存放庫、選擇 Actions 發布來源，以及 Workflow 是否在預設分支。

> 注意：原始碼會公開；嚴禁上傳券商帳密、Shioaji API Key、私人自選股、客戶資料或公司機密。原始碼不包含這些資訊。

## 3. 每日自動更新與首批回補

`publish.yml` 會在每個週一至週五的**台灣時間 17:45、20:30** 嘗試執行兩次。Actions 排程不是準點 SLA，偶爾會延誤或漏跑；每次成功會由官方日線取得最新資料後重新發布網站。**它不是 1～5 分鐘盤中行情服務。**

- 官方最新上市資料：https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
- 官方最新上櫃資料：https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes
- 上市法人：https://www.twse.com.tw/rwd/zh/fund/T86
- 上櫃法人：https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading
- 上市歷史：透過 TWSE 每日 MI_INDEX，逐日回補（須實際驗證）
- 上櫃歷史：透過 TPEx 每日 otc，逐日回補（須實際驗證）

最新快照**不會提供 MA240 所需的歷史 240 個交易日**。系統使用 `store/history.json.gz` 保存中央歷史並採分段回補，約需 360–670 個日曆天的歷史，以涵蓋 250+ 個交易日。後續不會讓每個使用者重新下載回補。

若首次回補遇到 403、限流、資料欄位變更、非交易日格式異常，流程會記錄錯誤、保留已正確收到的資料並等待下次重試。**尚無 MA240 時，排行榜不產生正式得分。**

### 故障處理

- 點 `Actions` → 該次工作 → `向官方取數...` 查看錯誤與股數。
- 403/Timeout：官方網站可能拒絕雲端主機、或短時間頻繁查詢，不要靠無限制重試繞過限制。
- 史料 0 筆：注意資料日期、是否真休市、是否欄位格式改版；腳本在無法確認時不往前推進回補游標。
- `Pages` 沒有網址：確定已啟用 GitHub Actions 的 Pages 發布來源。
- 網站一直顯示「示範」：本機 `file://` 是正常；正式網站在第一次成功部署且取得官方資料之前，會顯示「尚無正式資料」。
- 網站仍是舊版本：使用「更新畫面」會繞過排行 JSON 快取；歷史資料以後端成功同步為準。

## 4. 盤中 1–5 分鐘的後續方案

此版本在 UI 保留盤中觀察頁，但不會抓未經允許的券商即時行情，不會將私人 API 金鑰放入 JavaScript。要合法分享給親友，需取得明確的展示／轉供授權，或採取使用者各自登入其合法券商資料源且不互相轉供的方案。即使免費分享，仍必須符合授權條款。

## 5. 資訊來源／計算限制

- MA240 是**240 個交易日**均線，並非 240 個日曆天。
- 「隔日候選」是規則式篩選，未經策略回測，不是推薦必漲或必跌。
- 所有法人「參考價」只表示買超日收盤價按正買超股數加權，並非真實買入成交成本／剩餘持倉成本。
- 免費官方盤後資料的使用／再發布須遵守各來源最新的公開授權與標示規定。直接向朋友公開之前要完成核查。
- 股價目前未做除權息還原，遇大幅除權息會影響均線及型態。
- 主力（券商分點）資訊免費公開來源不足，此版不提供成本估值，不造假。

## 6. 公開平台成本

GitHub Pages 靜態網站及公開倉庫 Actions 在一般免費額度下**目標費用 NT$0/月**，但受 GitHub 免費額度、政策及可用性限制；不構成長期免費 SLA。GitHub Pages 有每月流量軟限制，若做商業網站或 SaaS 不適用。

官方參考：https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## 7. 程式內容

- `public/`：完整靜態網頁，親友只讀網站，**不用安裝 Node.js**。
- `engine.mjs`：純指標與型態計算；依此前 V0.5 的已測試核心重用。
- `scripts/update.mjs`：中心取數、法人更新、節流、歷史回補游標。
- `scripts/build.mjs`：將歷史轉為共用排行與每檔個股明細 JSON。
- `.github/workflows/publish.yml`：每交易日收盤後排程與網站自動發布。
- `store/history.json.gz`：首次線上更新後產生的中央歷史檔案（源碼包尚未含真實行情）。
- `test/`：離線測試；在 GitHub Actions 上由雲端自動測，不需使用者安裝 Node.js。
