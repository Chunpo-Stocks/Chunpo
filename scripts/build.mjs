// 股_V0.6.2 — 60日短期初步分析與250日完整年線分層。
import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {gzipSync, gunzipSync} from 'node:zlib';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {derive,institutionalWindows} from '../engine.mjs';
import {fibonacci} from './market-engine.mjs';

export const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
export const STORE=join(ROOT,'store','history.json.gz');
export const newStore=()=>({version:1,stocks:{},backfillCursor:null,backfillComplete:false,markets:{},errors:[],lastUpdated:null});
export async function loadStore(){try{return {...newStore(),...JSON.parse(gunzipSync(await readFile(STORE)).toString('utf8'))}}catch(e){if(e.code==='ENOENT')return newStore();throw new Error('歷史庫檔案損毀，停止更新：'+e.message)}}
export async function saveStore(store){await mkdir(dirname(STORE),{recursive:true});await writeFile(STORE,gzipSync(JSON.stringify(store),{level:8}));}
export function addBar(store,bar){const code=bar.code;let s=store.stocks[code];if(!s){s={code,name:bar.name,market:bar.market,bars:[],institutions:[]};store.stocks[code]=s;}
  if(s.market!==bar.market)return false;
  s.name=bar.name||s.name;
  const i=s.bars.findIndex(x=>x.d===bar.d);
  const clean={d:bar.d,o:bar.o,h:bar.h,l:bar.l,c:bar.c,v:bar.v,source:bar.source};
  if(i<0)s.bars.push(clean);else s.bars[i]=clean;
  s.bars.sort((a,b)=>a.d.localeCompare(b.d));
  if(s.bars.length>1150)s.bars.splice(0,s.bars.length-1150);
  return true;
}
export function addInstitution(store,item){const s=store.stocks[item.code];if(!s||!s.bars.some(b=>b.d===item.d))return false;
  const i=s.institutions.findIndex(x=>x.d===item.d);const clean={d:item.d,foreign:item.foreign,trust:item.trust,dealer:item.dealer,source:item.source};
  if(i<0)s.institutions.push(clean);else s.institutions[i]=clean;
  s.institutions.sort((a,b)=>a.d.localeCompare(b.d));if(s.institutions.length>250)s.institutions.splice(0,s.institutions.length-250);
  return true;
}
const fix=n=>Number.isFinite(n)?Math.round(n*1e5)/1e5:null;
export function summary(s){const d=derive(s);if(!d)return null;
  const institutions=s.institutions.filter(x=>x.d<=d.date).sort((a,b)=>b.d.localeCompare(a.d));
  const latest=institutions[0]||null;
  const chips=institutionalWindows(s);
  // 年線訊號合計 28 分；當年線不足時只按其餘 72 分條件獨立正規化。
  // 短期分數不與完整年線分數直接比較；每筆都有 scoreMode 與 days 標籤。
  const complete=d.days>=250, preliminary=d.days>=60 && !complete;
  const scoreMode=complete?'full':preliminary?'preliminary':'insufficient';
  const score=side=> complete?d[side].score:preliminary?Math.min(100,Math.round(d[side].score/72*100)):null;
  return {code:s.code,name:s.name,market:s.market,date:d.date,close:d.close,pct:fix(d.pct),volume:d.volume,days:d.days,
    bull:score('bull'),bear:score('bear'),scoreMode,
    bullReasons:d.days>=60?d.bull.hits.map(x=>x.text):[],bearReasons:d.days>=60?d.bear.hits.map(x=>x.text):[],
    ma20:fix(d.ma[20]),ma60:fix(d.ma[60]),ma240:fix(d.ma[240]),yearSlope:fix(d.ma240slope),rsi:fix(d.rsi),volRatio:fix(d.volRatio),
    macdHist:fix(d.macd.hist),pattern:d.patterns.map(p=>({id:p.id,label:p.label,side:p.side,reason:p.reason})),
    foreignNet:latest?.foreign??null,trustNet:latest?.trust??null,institutionDate:latest?.d??null,
    foreignRef20:fix(chips.windows.find(x=>x.period===20)?.categories.foreign.netBuyCloseReference),trustRef20:fix(chips.windows.find(x=>x.period===20)?.categories.trust.netBuyCloseReference),
    foreignNet5:chips.windows.find(x=>x.period===5)?.categories.foreign.netShares??null,trustNet5:chips.windows.find(x=>x.period===5)?.categories.trust.netShares??null,
    marginLatest:s.marginHistory?.at(-1)||null,
    source:s.bars.at(-1)?.source||null,ready:d.days>=250};
}
function prepareMarketData(data){
 const d=data||{},idx=d.indices||{},margin=d.margin||{};
 const slices=(rows)=>Array.isArray(rows)?rows.slice(-250):[];
 const one=code=>{const bars=slices(idx[code]);return {code,bars,latest:bars.at(-1)||null,fib20:bars.length>=20?fibonacci(bars,20):null,fib60:bars.length>=60?fibonacci(bars,60):null,fib120:bars.length>=120?fibonacci(bars,120):null};};
 return {indices:{taiex:one('taiex'),otc:one('otc')},
  futures:d.futures?{...d.futures,snapshots:slices(d.futures.snapshots)}:null,
  margin:{上市:slices(margin['上市']),上櫃:slices(margin['上櫃'])},sourceStatus:d.sourceStatus||{}};
}
export async function buildOutput(store){
  const root=join(ROOT,'public','data');const detailDir=join(root,'stocks');
  await rm(detailDir,{recursive:true,force:true});await mkdir(detailDir,{recursive:true});
  const rows=[];let ready=0,preliminaryCount=0,failed=0,maxDays=0,with20=0,with60=0;
  for(const s of Object.values(store.stocks)){
    if(!s.bars?.length)continue;
    try{
      const r=summary(s);if(!r)continue;rows.push(r);if(r.ready)ready++;if(r.scoreMode==='preliminary')preliminaryCount++;maxDays=Math.max(maxDays,r.days);if(r.days>=20)with20++;if(r.days>=60)with60++;
      const detail={...r,bars:s.bars.slice(-410),institutions:s.institutions.slice(-90),chips:institutionalWindows(s),marginHistory:(s.marginHistory||[]).slice(-120),fibonacci:{short:fibonacci(s.bars,60),medium:fibonacci(s.bars,120)},warning:'淨買超日加權收盤價不等於外資、投信或主力的真實持股成本。'};
      await writeFile(join(detailDir,encodeURIComponent(s.code)+'.json'),JSON.stringify(detail));
    }catch(e){failed++;console.error('分析失敗',s.code,e.message);}
  }
  rows.sort((a,b)=>a.code.localeCompare(b.code));
  const output={version:'股_V0.6.6',mode:rows.length?'official':'empty',generatedAt:new Date().toISOString(),markets:store.markets,
    rows,marketData:prepareMarketData(store.marketData),stats:{tracked:rows.length,yearlineReady:ready,preliminaryReady:preliminaryCount,analysisErrors:failed,maxHistoryDays:maxDays,with20,with60},
    sources:[{name:'證交所股票盤後行情',url:'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'},
      {name:'櫃買中心上櫃盤後行情',url:'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes'},
      {name:'證交所三大法人',url:'https://www.twse.com.tw/rwd/zh/fund/T86'},
      {name:'櫃買中心三大法人',url:'https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading'},
      {name:'上市歷史法人買賣超（T86）',url:'https://www.twse.com.tw/rwd/zh/fund/T86'},
      {name:'上櫃歷史法人買賣超（dailyTrade）',url:'https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade'},
      {name:'證交所加權指數',url:'https://openapi.twse.com.tw/v1/indicesReport/MI_5MINS_HIST'},
      {name:'櫃買指數',url:'https://www.tpex.org.tw/openapi/v1/tpex_index'},
      {name:'台指期每日交易行情',url:'https://openapi.taifex.com.tw/v1/DailyMarketReportFut'},
      {name:'上市融資融券',url:'https://openapi.twse.com.tw/v1/exchangeReport/MI_MARGN'},
      {name:'上櫃融資融券',url:'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_margin_balance'}],
    backfill:{cursor:store.backfillCursor,complete:store.backfillComplete,lastBatch:store.backfillLastBatch||null},
    chipsBackfill:{cursor:store.chipsBackfillCursor||null,lastBatch:store.chipsBackfillLastBatch||null},
    errors:store.errors.slice(-12),
    message:ready===0?'尚未建立 MA240 完整年線；如已有至少 60 個交易日資料，可使用明確標示的短期初步觀察。':null};
  await writeFile(join(root,'index.json'),JSON.stringify(output));
  console.log('已輸出：',rows.length,'檔，MA240 完整：',ready,'檔；短期初步觀察：',preliminaryCount,'檔；分析失敗：',failed);
  return output;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){buildOutput(await loadStore()).catch(e=>{console.error(e);process.exitCode=1;});}
