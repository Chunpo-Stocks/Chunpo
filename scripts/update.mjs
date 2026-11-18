// 股_V0.6.6.1 — 指數月資料回補、完整來源日期與更新統計；不覆蓋舊歷史。
import {loadStore,saveStore,addBar,addInstitution,buildOutput} from './build.mjs';
import {SOURCES,parseTwseLatest,parseTpexLatest,parseTwseInst,parseTpexInst,parseTpexInstHistory,isoDate} from '../engine.mjs';
import {inspectHistory,classifyHistoryPair,isVerifiedClosure} from './history-policy.mjs';
import {chooseTwseFallbackDate,validateTwseDaily} from './twse-fallback.mjs';
import {planChipBackfill,recordChipResult} from './chip-planner.mjs';
import {parseTwseMarginDaily} from './margin-daily.mjs';
import {quarantineUndatedTwseMargin,invalidateLegacyTwseDealer,listedDealerPendingDates} from './data-quality.mjs';
import {parseTwseIndex,parseTpexIndex,parseMargin,parseTxFutures,mergeDaily,summarizeMargin,parseTwseIndexMonth,parseTpexIndexMonth,mergeIndexMonth} from './market-engine.mjs';
const nap=ms=>new Promise(r=>setTimeout(r,ms));
const todayTaipei=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dayShift=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const weekday=s=>{let x=new Date(s+'T00:00:00Z').getUTCDay();return x!==0&&x!==6};
const args=process.argv.slice(2);const chosen=Number(args.find(s=>s.startsWith('--backfill-days='))?.split('=')[1]??'30');
if(!Number.isInteger(chosen)||chosen<0||chosen>120)throw Error('--backfill-days 需為 0～120 個日曆天');
const chipDays=Number(args.find(s=>s.startsWith('--chip-days='))?.split('=')[1]??'20');
if(!Number.isInteger(chipDays)||chipDays<0||chipDays>60)throw Error('--chip-days 需為 0～60 個有股價資料的交易日');
const store=await loadStore();const errors=[];let changed=false;
const oldMarginInvalid=quarantineUndatedTwseMargin(store);
const oldDealerInvalid=invalidateLegacyTwseDealer(store);
if(oldMarginInvalid||oldDealerInvalid)console.warn('::warning::品質稽核：隔離無官方日期之舊上市融資券',oldMarginInvalid,'筆；將錯誤自營商零值改為待重查',oldDealerInvalid,'筆');

const headers={'User-Agent':'Stock-V0.6-Friendly-Research/0.6 (+Public-data; no-trading)','Accept':'application/json,text/plain,*/*'};
async function json(url,{tries=2}={}){
  for(let k=0;k<tries;k++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    try{const r=await fetch(url,{signal:controller.signal,headers});if(!r.ok)throw Error('HTTP '+r.status+' '+r.statusText);
      const ct=r.headers.get('content-type')||'';let t=await r.text();if(!t.trim().startsWith('{')&&!t.trim().startsWith('['))throw Error('非 JSON 回應：'+ct);
      return JSON.parse(t);
    }catch(e){if(k===tries-1)throw Error(new URL(url).hostname+'：'+e.message);await nap(1600*(k+1))}finally{clearTimeout(timer)}
  }
}
// Opening this APP never pulls daily data. Only the central scheduled job does.
for(const market of ['上市','上櫃']){
  const url=market==='上市'?SOURCES.twsePrice:SOURCES.tpexPrice;
  try{
    const response=await json(url);const parsed=market==='上市'?parseTwseLatest(response):parseTpexLatest(response);
    if(parsed.length<50)throw Error('符合普通股格式的有效資料過少：'+parsed.length);
    const date=parsed.map(x=>x.d).sort().at(-1),bars=parsed.filter(x=>x.d===date);
    if(bars.length<50)throw Error('最新交易日有效資料不足');
    bars.forEach(b=>addBar(store,b));changed=true;
    store.markets[market]={date,count:bars.length,status:'ok',source:url,checkedAt:new Date().toISOString()};
    console.log(market,'最新盤後',date,bars.length);
    const instUrl=market==='上市'?SOURCES.twseInst.replace('{date}',date.replaceAll('-','')):SOURCES.tpexInst;
    try{const data=await json(instUrl),inst=market==='上市'?parseTwseInst(data,date):parseTpexInst(data).filter(x=>x.d===date);
      if(inst.length<50)throw Error('法人有效筆數不足：'+inst.length);
      inst.forEach(x=>addInstitution(store,x));changed=true;
      store.markets[market].institutionDate=date;
      if(market==='上市'&&!store.dealerRepair.verifiedDates.includes(date))store.dealerRepair.verifiedDates.push(date);
      console.log(market,'法人',inst.length);
    }catch(e){errors.push(market+'法人：'+e.message);console.error(errors.at(-1));}
  }catch(e){errors.push(market+'最新行情：'+e.message);store.markets[market]={...(store.markets[market]||{}),status:'error',error:e.message,checkedAt:new Date().toISOString()};console.error(errors.at(-1));}
  await nap(900);
}
// 若上市 OpenAPI 快照落後於櫃買已確認交易日，使用證交所指定日期資料保守補抓。
const fallbackDate=chooseTwseFallbackDate(store.markets,todayTaipei());
if(fallbackDate){
 try{
  const staleTwseDate=store.markets['上市']?.date||null;
  const fallbackUrl=SOURCES.twseHistory.replace('{date}',fallbackDate.replaceAll('-',''));
  const payload=await json(fallbackUrl,{tries:3});
  const rows=validateTwseDaily(payload,fallbackDate);
  for(const b of rows)addBar(store,b);
  changed=true;
  store.markets['上市']={date:fallbackDate,count:rows.length,status:'ok',source:fallbackUrl,checkedAt:new Date().toISOString(),retrieval:'日期指定官方盤後回補'};
  console.log('上市 日期指定補抓成功',fallbackDate,rows.length,'檔；原快照日期',staleTwseDate);
  const instUrl=SOURCES.twseInst.replace('{date}',fallbackDate.replaceAll('-',''));
  try{
   const instPayload=await json(instUrl,{tries:3}),inst=parseTwseInst(instPayload,fallbackDate);
   if(inst.length<50)throw Error('有效法人筆數不足：'+inst.length);
   for(const x of inst)addInstitution(store,x);
   store.markets['上市'].institutionDate=fallbackDate;
   if(!store.dealerRepair.verifiedDates.includes(fallbackDate))store.dealerRepair.verifiedDates.push(fallbackDate);
   console.log('上市 日期指定法人',fallbackDate,inst.length);
  }catch(e){
   const message='上市 '+fallbackDate+' 法人日期指定補抓失敗：'+e.message;
   errors.push(message);console.warn('::warning::'+message);
   delete store.markets['上市'].institutionDate; // 不能把昨天的法人日期留在今天
  }
 }catch(e){
  const message='上市 '+fallbackDate+' 日期指定行情補抓未通過：'+e.message;
  errors.push(message);console.warn('::warning::'+message);
 }
}
// 市場大盤/OTC/台指期/融資券：官方免費盤後快照，僅每日累積，不假裝盤中即時。
// 若任何一項失敗，保留先前的最後有效資料與來源日期；個股歷史庫不受影響。
store.marketData??={indices:{},margin:{},futures:null,sourceStatus:{}};
const marketUrls={
 taiex:'https://openapi.twse.com.tw/v1/indicesReport/MI_5MINS_HIST',
 otc:'https://www.tpex.org.tw/openapi/v1/tpex_index',
 tx:'https://openapi.taifex.com.tw/v1/DailyMarketReportFut',
 twseMargin:'https://openapi.twse.com.tw/v1/exchangeReport/MI_MARGN',
 tpexMargin:'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_margin_balance'
};
async function pullMarket(name,fn){
 try{const payload=await json(marketUrls[name],{tries:3});const result=fn(payload);
  store.marketData.sourceStatus[name]={status:'ok',checkedAt:new Date().toISOString(),url:marketUrls[name]};changed=true;
  console.log('市場資料',name,'成功',result);}
 catch(err){const msg=name+'市場資料：'+err.message;
  store.marketData.sourceStatus[name]={status:'error',checkedAt:new Date().toISOString(),url:marketUrls[name],message:err.message};
  errors.push(msg);console.warn('::warning::'+msg);}
 await nap(500);
}
await pullMarket('taiex',payload=>{const rows=parseTwseIndex(payload);store.marketData.indices.taiex=mergeDaily(store.marketData.indices.taiex,rows);return `${rows.length}日`});
await pullMarket('otc',payload=>{const rows=parseTpexIndex(payload);store.marketData.indices.otc=mergeDaily(store.marketData.indices.otc,rows);return `${rows.length}日`});
await pullMarket('tx',payload=>{const row=parseTxFutures(payload,{asOf:new Date()});const previous=store.marketData.futures||{};
 const key=x=>`${x.d}/${x.contractMonth}/${x.session}`;
 // 逐契約、逐交易日、逐時段存下快照；更換近月時不拼接不同到期月份。
 const all=[...(previous.snapshots||[]),...(row.newSnapshots||[])];
 const uniq=new Map(all.filter(Boolean).map(x=>[key(x),x]));
 const {newSnapshots,...current}=row;
 store.marketData.futures={...current,snapshots:[...uniq.values()].sort((a,b)=>a.d.localeCompare(b.d)||a.contractMonth.localeCompare(b.contractMonth)).slice(-450),
  checkedAt:new Date().toISOString()};
 if(!row.contractMonth||!row.day&&!row.night)throw Error('本次 TX 有行情，但全部合約已到期或有效近月缺少成交價，已停止顯示舊合約');
 console.log('臺指期換月檢核',row.contractMonth,'契約最後交易日',row.expiresOn,'來源交易日',row.sourceDate,'選用日盤',row.day?.d||'無','夜盤',row.night?.d||'無');
 return `${row.contractMonth} 日盤:${row.day?.d||'無'} 夜盤:${row.night?.d||'無'}`});
// 正式月資料回補（加權收盤／OTC OHLC），首批最近 8 個月，合併保留舊資料。
// 有效日數不足時仍不冒充日內高低；期貨不同契約不拼接。
function recentMonths(count=6){const now=todayTaipei().slice(0,7),[yr,mo]=now.split('-').map(Number);
 return Array.from({length:count},(_,i)=>{const dt=new Date(Date.UTC(yr,mo-1-i,1));return dt.toISOString().slice(0,7)});}
store.marketData.monthHistory??={taiex:{},otc:{}};
const monthBefore={taiex:(store.marketData.indices.taiex||[]).length,otc:(store.marketData.indices.otc||[]).length};
const monthReport={taiex:{ok:0,failed:0},otc:{ok:0,failed:0}};
const currentMonth=todayTaipei().slice(0,7);
for(const month of recentMonths(8)){
 for(const [name,url,parse] of [
  ['taiex','https://www.twse.com.tw/exchangeReport/FMTQIK?response=json&date='+month.replace('-','')+'01',parseTwseIndexMonth],
  ['otc','https://www.tpex.org.tw/www/zh-tw/indexInfo/inx?date='+month.replace('-','/')+'/01&response=json',parseTpexIndexMonth]
 ]){
  if(month!==currentMonth&&store.marketData.monthHistory[name]?.[month]?.status==='ok')continue;
  try{const result=parse(await json(url,{tries:3}),month);
   // 月檔可能在更新後到達，保留先前已有更完整 OHLC 的快照；當日仍以快照為準。
   const old=store.marketData.indices[name]||[];
   store.marketData.indices[name]=mergeIndexMonth(old,result);
   store.marketData.monthHistory[name][month]={status:'ok',rows:result.length,source:url};monthReport[name].ok++;
   store.marketData.sourceStatus[name+'Monthly']={status:'ok',url,month,rows:result.length,checkedAt:new Date().toISOString()};changed=true;
   console.log('月歷史指數',name,month,'取得',result.length,'日；總數',store.marketData.indices[name].length);
  }catch(e){const message=name+' '+month+'歷史指數：'+e.message;errors.push(message);monthReport[name].failed++;console.warn('::warning::'+message);
   store.marketData.sourceStatus[name+'Monthly']={status:'error',url,month,message:e.message,checkedAt:new Date().toISOString()};}
  await nap(900);
 }
}
store.marketData.indexBackfillLastBatch={at:new Date().toISOString(),markets:Object.fromEntries(['taiex','otc'].map(name=>[name,{...monthReport[name],before:monthBefore[name],after:(store.marketData.indices[name]||[]).length}]))};
console.log('指數月回補摘要',JSON.stringify(store.marketData.indexBackfillLastBatch.markets));
// 每個市場以來源本身的日期核實，上市改用指定交易日 MI_MARGN，避免 OpenAPI 舊快照複製到新日期。
for(const [name,market] of [['twseMargin','上市'],['tpexMargin','上櫃']]){
 const anchor=store.markets[market]?.date||null;
 if(!anchor){const message=market+'融資券：缺可核實股票日期';errors.push(message);console.warn('::warning::'+message);continue;}
 const url=market==='上市'?'https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date='+anchor.replaceAll('-','')+'&selectType=ALL&response=json':marketUrls.tpexMargin;
 try{
  const payload=await json(url,{tries:3});
  const parsed=market==='上市'?parseTwseMarginDaily(payload,anchor):parseMargin(payload,market,anchor);
  const recordDate=parsed.map(x=>x.d).sort().at(-1),items=parsed.filter(x=>x.d===recordDate);
  if(items.length<30||recordDate>anchor)throw Error('來源交易日錯誤或有效股票不足');
  store.marketData.marginDetails??={};
  store.marketData.marginDetails[market]??={};
  const previous=(store.marketData.margin[market]||[]).filter(x=>x.d<recordDate).at(-1)||null;
  // 未取得官方日期的一律隔離不發布；即使今日股價更新也不能替融資券補日期。
  if(items.some(x=>!x.dateConfirmed))throw Error('沒有可核實來源日期，拒絕以股價日期推定融資券日期');
  const sum=summarizeMargin(items,previous);
  store.marketData.marginDetails[market][recordDate]=items;
  store.marketData.margin[market]=mergeDaily(store.marketData.margin[market],[sum]);
  for(const item of items){
   const st=store.stocks[item.code];if(!st||st.market!==market)continue;
   st.marginHistory??=[];st.marginHistory=mergeDaily(st.marginHistory,[item],260);
  }
  const keys=Object.keys(store.marketData.marginDetails[market]).sort().reverse();
  for(const older of keys.slice(20))delete store.marketData.marginDetails[market][older];
  const stale=recordDate<anchor;
  store.marketData.sourceStatus[name]={status:stale?'stale':'ok',checkedAt:new Date().toISOString(),url,date:recordDate,
    message:stale?'官方融資券目前停留在 '+recordDate+'；不冒充 '+anchor:''};
  changed=true;
  console.log('融資券官方日期核實',market,recordDate,items.length,'筆；股票日期',anchor,stale?'（資料晚到）':'');
 }catch(e){
  const msg=market+'融資券：'+e.message;
  store.marketData.sourceStatus[name]={status:'error',checkedAt:new Date().toISOString(),url,message:e.message};
  errors.push(msg);console.warn('::warning::'+msg);
 }
 await nap(500);
}
// 照上次游標往更早日期回補；休市不占交易日，也不重抓完整庫。
// 保留嚴格驗證：未知的空回應不得略過、不得寫入錯誤日期資料。
let cursor=store.backfillCursor||dayShift(todayTaipei(),-2);
let completed=0,skipped=0,failedDate=null;
for(let i=0;i<chosen;i++){
  if(!weekday(cursor)||isVerifiedClosure(cursor)){
    console.log('休市略過',cursor, isVerifiedClosure(cursor)?'官方確認之休市日':'週末');
    cursor=dayShift(cursor,-1); skipped++; changed=true; continue;
  }
  const urls=[SOURCES.twseHistory.replace('{date}',cursor.replaceAll('-','')),
    SOURCES.tpexHistory.replace('{yyyy}',cursor.slice(0,4)).replace('{mm}',cursor.slice(5,7)).replace('{dd}',cursor.slice(8,10))];
  const pair=[]; let fail=null;
  for(let j=0;j<2;j++){
    const market=j===0?'上市':'上櫃';
    try{
      const payload=await json(urls[j]);
      pair.push(inspectHistory(payload,market,cursor));
    }catch(e){fail=`${cursor} ${market==='上市'?'證交所':'櫃買中心'}歷史：${e.message}`; break}
    await nap(1150);
  }
  if(!fail){
    try{
      const classified=classifyHistoryPair(pair[0],pair[1],cursor);
      if(classified.kind==='closed'){
        console.log('休市略過',cursor,'官方雙市場皆無有效交易資料');
        cursor=dayShift(cursor,-1);skipped++;changed=true;continue;
      }
      for(const rows of [classified.twse,classified.tpex])for(const b of rows)addBar(store,b);
      completed++;changed=true;cursor=dayShift(cursor,-1);
      if(completed%10===0)console.log('歷史已補',completed,'個交易日，下一個日期',cursor);
      await nap(650);
    }catch(e){fail=e.message}
  }
  if(fail){failedDate=cursor;errors.push(fail);console.error('::warning::歷史回補中斷：'+fail);break}
}
// 法人歷史獨立回補：避免只有最新1日法人數據卻聲稱20/60日成本。
// 只掃已有盤後股價的真實交易日期；單邊失敗仍允許另一邊補入，失敗日加入待重試佇列。
let chipProcessed=0,chipPairs=0,chipErrors=[];
const availableDays=new Map();
for(const st of Object.values(store.stocks))for(const b of st.bars||[])availableDays.set(b.d,(availableDays.get(b.d)||0)+1);
const knownDays=[...availableDays.entries()].filter(([d,count])=>count>=40&&d<=todayTaipei()).map(([d])=>d).sort().reverse();
let chipsCursor=store.chipsBackfillCursor||knownDays[0]||null;
const pending=Array.isArray(store.chipsBackfillPending)?store.chipsBackfillPending:[];
// 無論先前有多少失敗待重試，仍分配完整的『新交易日』額度；另加最多6個失敗市場重試。
const plan=planChipBackfill(knownDays,chipsCursor,pending,chipDays,6);
let freshDaysAttempted=0,retryMarketDays=0;
function isoOrNone(x){return isoDate(x)||null}
async function grabChipDay(market,d){
  const url=market==='上市'?SOURCES.twseInst.replace('{date}',d.replaceAll('-','')):
    SOURCES.tpexInstHistory.replace('{date}',`${Number(d.slice(0,4))-1911}%2F${d.slice(5,7)}%2F${d.slice(8,10)}`);
  const payload=await json(url,{tries:4});
  if(isoOrNone(payload?.date)&&isoOrNone(payload.date)!==d)throw Error('法人資料日期不符：'+payload.date);
  const rows=market==='上市'?parseTwseInst(payload,d):parseTpexInstHistory(payload,d);
  const present=rows.filter(x=>store.stocks[x.code]?.bars?.some(b=>b.d===d));
  if(present.length<30)throw Error('該日期可對上股價的法人筆數過少：'+present.length);
  for(const row of present)addInstitution(store,row);
  return present.length;
}
async function processChipMarket(market,d){
  try{
    const rows=await grabChipDay(market,d);chipPairs++;
    recordChipResult(pending,d,market,true);
    if(chipProcessed<=3||chipProcessed%10===0)console.log('法人歷史已補',d,market,rows,'筆');
  }catch(err){
    const message=`${d} ${market}法人歷史：${err.message}`;
    chipErrors.push(message);
    recordChipResult(pending,d,market,false,message);
    console.warn('::warning::法人資料缺漏，已保留待重試',message);
  }
  await nap(800);
}
if(chipDays){
  // 舊欠缺資料重試（獨立額度，不再壓縮新日期掃描量）
  for(const job of plan.retries){retryMarketDays++;await processChipMarket(job.market,job.date)}
  // 不論成功或失敗，都前進游標；失敗市場已記入待重試清單。
  for(const d of plan.newDates){
    freshDaysAttempted++;chipProcessed++;
    await processChipMarket('上市',d);
    await processChipMarket('上櫃',d);
    chipsCursor=dayShift(d,-1);changed=true;
  }
}

// 系統性更正早期上市 T86 自營商誤抓外資自營商的舊零值：每次最多補20個歷史日期。
const repairDates=listedDealerPendingDates(store).slice(0,20);
let dealerRepairedDates=0,dealerRepairErrors=[];
for(const d of repairDates){
 try{
  const url=SOURCES.twseInst.replace('{date}',d.replaceAll('-',''));
  const payload=await json(url,{tries:2});
  if(isoDate(payload?.date)&&isoDate(payload.date)!==d)throw Error('來源日期不符');
  const rows=parseTwseInst(payload,d);
  const present=rows.filter(x=>store.stocks[x.code]?.market==='上市'&&store.stocks[x.code]?.bars?.some(b=>b.d===d));
  if(present.length<500)throw Error('有效自營商歷史股票不足：'+present.length);
  for(const row of present)addInstitution(store,row);
  store.dealerRepair.verifiedDates.push(d);
  dealerRepairedDates++;changed=true;
 }catch(e){
  const msg=d+' 上市自營商歷史修復：'+e.message;
  dealerRepairErrors.push(msg);console.warn('::warning::'+msg);
 }
 await nap(450);
}
store.dealerRepair.verifiedDates=[...new Set(store.dealerRepair.verifiedDates)].sort();
store.dealerRepair.errors=dealerRepairErrors.slice(0,5);
store.dealerRepair.updatedAt=new Date().toISOString();
console.log('上市自營商歷史修復：',dealerRepairedDates,'日成功／',repairDates.length,'日嘗試；尚待驗證',listedDealerPendingDates(store).length,'日');

store.chipsBackfillCursor=chipsCursor;
store.chipsBackfillPending=pending; // 缺漏不能靜默裁掉，直到驗證成功才能刪除
store.chipsBackfillLastBatch={at:new Date().toISOString(),requested:chipDays,newTradingDays:freshDaysAttempted,retriedMarketDays:retryMarketDays,scannedDays:chipProcessed,successfulMarketDays:chipPairs,
  failedMarketDays:chipErrors.length,pendingRetries:pending.length,examples:chipErrors.slice(0,5),cursor:chipsCursor};
errors.push(...chipErrors.slice(0,10));
console.log('法人歷史回補：新日期',freshDaysAttempted,'日、重試市場',retryMarketDays,'次、成功市場',chipPairs,'次、失敗市場',chipErrors.length,'次、待重試',pending.length,'項；下一次從',chipsCursor,'繼續');

store.backfillCursor=cursor;
// 避免因游標跨過某個日期就直接宣稱完整；由每檔實際交易日數決定是否能評分。
store.backfillComplete=false;
store.backfillLastBatch={at:new Date().toISOString(),requestedCalendarDays:chosen,completedTradingDays:completed,skippedDays:skipped,failedDate,nextCursor:cursor};
store.errors=errors.slice(-20);store.lastUpdated=new Date().toISOString();
await saveStore(store);
const report=await buildOutput(store);
console.log('行情回補完成日數',completed,'略過休市/週末',skipped,'下次從',cursor,'開始；年線已建立',report.stats.yearlineReady,'／',report.stats.tracked);
if(failedDate)console.log('::warning::下次執行會從失敗日期 '+failedDate+' 重試；請查明失敗原因，不要當作成功回補。');
