// 股_V0.6.2 — 保留回補游標，跳過經驗證休市日，遇資料錯誤不跳過交易日。
import {loadStore,saveStore,addBar,addInstitution,buildOutput} from './build.mjs';
import {SOURCES,parseTwseLatest,parseTpexLatest,parseTwseInst,parseTpexInst} from '../engine.mjs';
import {inspectHistory,classifyHistoryPair,isVerifiedClosure} from './history-policy.mjs';
const nap=ms=>new Promise(r=>setTimeout(r,ms));
const todayTaipei=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dayShift=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const weekday=s=>{let x=new Date(s+'T00:00:00Z').getUTCDay();return x!==0&&x!==6};
const args=process.argv.slice(2);const chosen=Number(args.find(s=>s.startsWith('--backfill-days='))?.split('=')[1]??'30');
if(!Number.isInteger(chosen)||chosen<0||chosen>120)throw Error('--backfill-days 需為 0～120 個日曆天');
const store=await loadStore();const errors=[];let changed=false;
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
      console.log(market,'法人',inst.length);
    }catch(e){errors.push(market+'法人：'+e.message);console.error(errors.at(-1));}
  }catch(e){errors.push(market+'最新行情：'+e.message);store.markets[market]={...(store.markets[market]||{}),status:'error',error:e.message,checkedAt:new Date().toISOString()};console.error(errors.at(-1));}
  await nap(900);
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
store.backfillCursor=cursor;
// 避免因游標跨過某個日期就直接宣稱完整；由每檔實際交易日數決定是否能評分。
store.backfillComplete=false;
store.backfillLastBatch={at:new Date().toISOString(),requestedCalendarDays:chosen,completedTradingDays:completed,skippedDays:skipped,failedDate,nextCursor:cursor};
store.errors=errors.slice(-20);store.lastUpdated=new Date().toISOString();
await saveStore(store);
const report=await buildOutput(store);
console.log('行情回補完成日數',completed,'略過休市/週末',skipped,'下次從',cursor,'開始；年線已建立',report.stats.yearlineReady,'／',report.stats.tracked);
if(failedDate)console.log('::warning::下次執行會從失敗日期 '+failedDate+' 重試；請查明失敗原因，不要當作成功回補。');
