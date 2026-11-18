股_V0.6.6｜市場歷史資料與融資券修正（只更新程式，不覆蓋歷史）

本包包含 scripts/update.mjs、scripts/market-engine.mjs、scripts/build.mjs、public/app.js、test/market.test.mjs。
不要把解壓縮後的「股_V0.6.6_修正包」資料夾整個上傳到 root；請把包內 scripts、public、test 拖曳到儲存庫根目錄，核對 Github 網站上的檔案路徑。

修正項目：
1. 指數歷史：TWSE FMTQIK 依月份回補官方「每日收盤指數」；TPEx indexInfo/inx 依月份回補日開高低收，首次補近 8 個月，已成功的完整歷史月份往後不再重抓，當月仍更新。
2. TPEX 融資券：用官方 MarginPurchaseBalance、ShortSaleBalance 欄名，並依當日及前日餘額產生日變動。
3. 斐波標註來源：若只有指數收盤資料，以「收盤價極值」近似並註明，絕非日內最高最低。
4. 台指期仍按最新官方交易日逐日累積；沒有完整歷史 TX 合約不得自動當成連續期貨。
5. 保留 store/history.json.gz。官方每月接口可能因限流失敗，失敗保留錯誤不造資料。

安裝：GitHub Code -> Add file -> Upload files -> 保持檔案路徑 -> Commit changes。
Actions 手動執行 backfill_days=0、chip_days=0 即可執行市場月資料補建，不需要重抓 100 天個股。
注意：Github 網頁上傳同名路徑的覆蓋行為請在提交前逐項確認；若發現沒有覆蓋，可進該檔編輯／刪除舊檔再上傳。
本機執行 node --test 已驗證解析；本環境無法直接從 Github Actions 實際調用官方 TPEx 端點，網路接通後須檢視 log。
