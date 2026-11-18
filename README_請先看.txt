股_V0.6.1 修正版（V0.6 原地覆蓋，請勿刪除 GitHub 儲存庫）

修正：
1. 已確認 2026-10-26 光復節補假台股休市，自動略過。對其他有結構的「雙市場都無交易」回應也可略過；單邊缺資料仍報錯。
2. RSI 等指標不足時不呼叫 null.toFixed()，保留該檔基本行情。
3. 資料與說明新增當次回補日數、歷史最多筆數與中斷日期。
4. 保留既有 store/history.json.gz，由 GitHub Actions 依游標續接。

如何更新：
A. 用 GitHub 網頁到 Chunpo 儲存庫主頁 Add file → Upload files。
B. 從本壓縮檔解壓出來，將 engine.mjs、package.json、public/app.js、scripts/build.mjs、scripts/update.mjs、scripts/history-policy.mjs、test/fixes.test.mjs 連同原有資料夾結構上傳，覆蓋舊檔。
C. 不要上傳 store/history.json.gz，也不要刪除舊資料。
D. 如之前停用了 Actions，回到 Actions 重新啟用，再 Run workflow 設 backfill_days=120，查看日誌的「歷史已補」與「行情回補完成日數」。

限制：目前透過模擬資料測試，未在 GitHub Actions 或官方 API 實際連網成功驗證。現階段仍非盤中即時行情；若官方來源更動或後續其他日期回補失敗，需依日誌繼續修正。
