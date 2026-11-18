股_V0.6.7：外資／投信／量價主力觀察 Top 10，可切換 10／20／30／60 交易日。

必須完整按路徑上傳這六處：
.github/workflows/publish.yml
scripts/build.mjs
scripts/flow-rank.mjs（新檔，不能漏）
public/index.html、public/app.js、public/styles.css、public/sw.js
test/flow-rank.test.mjs（新檔）

不要刪除、覆蓋 store/history.json.gz，也不要刪除其他程式檔案。

上傳後先確認 scripts/flow-rank.mjs 可在 GitHub 正常開啟，再進入 Actions，對 main 分支手動執行一次，backfill_days=0、chip_days=0。
完成後在 APP 的「法人／主力觀察排行」切換 10／20／30／60 日。

規則：各市場每檔最新股價日須與官方市場錨點一致；法人累計需至少80%交易日覆蓋，且最新有效法人數據位於最近2個交易日；否則不排名。
主力觀察只是量價代理分數，不是實際主力買賣、分點資料或持倉成本。

GitHub Actions 更新排程新增晚間23:30及次日上午07:30（台灣時間），但排程不是準時保證；官方公布日不同步時以實際資料日期為準。
