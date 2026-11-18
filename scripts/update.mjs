import {loadStore,saveStore,addBar,addInstitution,buildOutput} from './build.mjs';
import {SOURCES,parseTwseLatest,parseTpexLatest,parseHistory,parseTwseInst,parseTpexInst,parseTpexInstHistory} from '../engine.mjs';
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
// Oldest-first cursor; only advance after BOTH market sources were retrieved and validated.
// On transport/schema failures stop, preserve all previously saved data for retry.
let cursor=store.backfillCursor||dayShift(todayTaipei(),-2);
let completed=0;
for(let i=0;i<chosen;i++){
  if(!weekday(cursor)){cursor=dayShift(cursor,-1);continue}
  const urls=[SOURCES.twseHistory.replace('{date}',cursor.replaceAll('-','')),
    SOURCES.tpexHistory.replace('{yyyy}',cursor.slice(0,4)).replace('{mm}',cursor.slice(5,7)).replace('{dd}',cursor.slice(8,10))];
  const parsed=[];let fail=null;
  for(let j=0;j<2;j++){
    try{let payload=await json(urls[j]);if(!payload||typeof payload!=='object')throw Error('資料格式錯誤');
      let rows=parseHistory(payload,j===0?'上市':'上櫃',cursor);
      // Incomplete response is considered a fetch/schema error, not a market holiday.
      let stat=String(payload.stat||payload.status||'');
      if(rows.length===0 && !/沒有|查無|無資料|無符合|休市|假日|holiday/i.test(stat)){
        // Explicit weekend/holiday detection is handled above; weekday empty may be holiday.
        // Require official no-data/holiday wording to avoid advancing over invalid schema.
        throw Error('空回應且無明確休市狀態，可能是資料格式改版');
      }
      parsed.push(rows);
    }catch(e){fail=`${cursor} ${j===0?'證交所':'櫃買中心'}歷史：${e.message}`;break}
    await nap(1150);
  }
  if(fail){errors.push(fail);console.error(fail);break}
  for(const rows of parsed)for(const bar of rows)addBar(store,bar);
  changed=true;completed++;cursor=dayShift(cursor,-1);
  if(completed%10===0)console.log('歷史已補',completed,'個交易日，下一個日期',cursor);
  await nap(650);
}
store.backfillCursor=cursor;
// Stop once enough calendar time has been covered, not when every stock has 240 days.
if(dayShift(todayTaipei(),-670)>cursor)store.backfillComplete=true;
store.errors=errors.slice(-20);store.lastUpdated=new Date().toISOString();
if(changed || store.errors.length || !store.backfillCursor){await saveStore(store)}
await buildOutput(store);
console.log('行情回補完成日數',completed,'尚未宣稱已連接盤中即時資料');
