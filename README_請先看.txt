股_V0.6.6.1｜實際修訂版（不是原版重壓縮）

這版依照使用者提供的 update.mjs、build.mjs、market-engine.mjs 檢查：三份檔案和上一個股_V0.6.6 ZIP 逐位元完全相同，原來的 V0.6.5 註解及網站字樣是舊版殘留，不代表沒有月份回補程式。

本次確認的修訂：
1. 首行、網站抬頭、頁尾、CSV 名稱、資料輸出 version 全部顯示「股_V0.6.6.1」。
2. 新增指數月份回補摘要，APP「資料與說明」顯示加權與 OTC 回補前後筆數、成功／失敗月數。
3. 修正月份合併時舊資料無條件覆蓋官方月資料的問題。
4. 加權僅有收盤時禁止將收盤當開、高、低；斐波會標示收盤極值近似。
5. OTC 月回補仍需線上驗證，但 parser 改為按欄名尋找 OHLC，不強制欄位先後順序。
6. PWA 快取名稱改版，並在 HTML 使用版本 query 以便更新。

請使用 GitHub 的 Code → Add file → Upload files，將壓縮檔解壓縮後的 public、scripts、test 資料夾拖到 Chunpo 根目錄，逐項確認路徑保留，最後 Commit changes。不要上傳 ZIP。切勿刪除 store/history.json.gz。
注意：GitHub 上傳若拒絕覆蓋同名檔，應在 GitHub 編輯相應文件，或使用 Git 介面更新；不要建立兩份同名路徑。
更新完成後，先在 GitHub 查看 public/index.html 是否有股_V0.6.6.1，scripts/update.mjs 首行同版，後執行 Actions：backfill_days=0、chip_days=0。成功後重開 APP，可見版本股_V0.6.6.1，並在「資料與說明」看指數月回補摘要。

本機已驗證 JavaScript 語法、node --test、ZIP 檔案清單。未在此環境驗證你的 GitHub Actions 實際取數或 TPEx 官方網路回應；不保證一按就一定補齊。
