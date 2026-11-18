股_V0.6.2 主要修正（給 Chunpo-Stocks / Chunpo）

目前網站已追蹤近2千檔普通股、最長97個交易日，缺的是年線，不是全部行情。
本版讓60～249交易日的股票出現在「短期初步觀察」，並嚴格區分250日以上「完整年線分析」。
短期分數未包含 MA240 位置與斜率權重，只依剩餘72分權重換算0～100分，不能與完整年線分數直接比較，也不代表勝率。
依各市場最新資料日顯示，避免拿過期的股票當成最新候選。並修正先前歷史回補對休市日及 RSI 缺值的處理。

更新順序：
1. 保留 GitHub 上原本的 store/history.json.gz 與 .github/workflows/publish.yml，不要刪除重建。
2. 解壓此 ZIP，直接進到 https://github.com/Chunpo-Stocks/Chunpo 的 Code 頁面。
3. Add file → Upload files，把解壓後的 scripts、public、test、engine.mjs、package.json 和 README 一起拖入「儲存庫根目錄」。
   注意：子資料夾路徑要維持原樣，不要再多包一層「股_V0.6.2_修正包」，也不要把 ZIP 當單一檔案上傳。
4. Commit changes 後，進入 scripts/update.mjs 檢查第一行有「股_V0.6.2」。
   另到 scripts/build.mjs 檢查第一行「股_V0.6.2」，確保不是部分上傳。
5. Actions → 股 V0.6 每日盤後更新與發布 → Run workflow → main → backfill_days=120，執行一次並打開步驟日誌。
6. 成功後按 Ctrl+F5 重整 https://chunpo-stocks.github.io/Chunpo/；顯示版本須為 股_V0.6.2。
7. 若資料仍不足：在 資料與說明 查看「成功回補日數」「最長歷史日數」「停住日期」。若出現特定API日期錯誤，不要盲目重跑。

測試範圍：本地程式規則14項通過，使用70檔人造股票、97個交易日完成端到端輸出及前端篩選測試。
未驗證：此環境無法以你的GitHub身分部署，官方行情API連線與實際網站版本需在GitHub確認。
