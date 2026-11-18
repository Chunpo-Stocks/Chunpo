// 股_V0.6.6.1 市場與斐波核心：修正官方月歷史、欄位核對與合併優先順序。
import {isoDate,num,pick,ordinary} from '../engine.mjs';
const round=x=>Number.isFinite(x)?Math.round(x*1e3)/1e3:null;
const normalize=x=>String(x??'').replace(/[\s()（）\-_:：]/g,'').trim().toLowerCase();
export function field(o,names){if(!o||typeof o!=='object')return undefined;
 const dict=new Map(Object.entries(o).map(([k,v])=>[normalize(k),v]));
 for(const n of names){if(dict.has(normalize(n)))return dict.get(normalize(n));} return undefined;
}
const quantity=x=>{const v=num(x);return Number.isFinite(v)&&v>=0?v:null};
const positive=x=>{const v=num(x);return Number.isFinite(v)&&v>0?v:null};
// 日線／指數 Fibonacci: 使用窗口內極值的時間先後判斷方向；避免偷用未來資料。
export function fibonacci(series,window=60){
 if(!Array.isArray(series)||series.length<20)return null;
 const n=Math.min(Math.max(20,Math.trunc(window)),series.length);
 const rows=series.slice(-n).filter(b=>b&&/^20\d{2}-\d{2}-\d{2}$/.test(b.d)&&positive(b.c)!==null);
 const basis=rows.every(b=>positive(b.h)!==null&&positive(b.l)!==null&&b.h>=b.l)?'highlow':'close';
 if(rows.length<20)return null;
 let hi=0,lo=0;for(let i=1;i<rows.length;i++){if((basis==='highlow'?rows[i].h:rows[i].c)>(basis==='highlow'?rows[hi].h:rows[hi].c))hi=i;if((basis==='highlow'?rows[i].l:rows[i].c)<(basis==='highlow'?rows[lo].l:rows[lo].c))lo=i;}
 if(hi===lo)return null;
 const high=basis==='highlow'?rows[hi].h:rows[hi].c,low=basis==='highlow'?rows[lo].l:rows[lo].c,span=high-low;
 if(span<=0||span/low<0.005)return null;
 const rising=lo<hi,levels=[.236,.382,.5,.618,.786],exp=[1,1.272,1.618,2];
 const recent=rows.at(-1),current=recent.c;
 const retracements=levels.map(r=>({ratio:r,price:round(rising?high-span*r:low+span*r)}));
 const extensions=exp.map(r=>({ratio:r,price:round(rising?low+span*r:high-span*r)}));
 // 斐波時間僅顯示第幾個交易日，不使用日曆推算成保證轉折日期。
 const anchorPeriod=Math.abs(hi-lo);
 const timeWindows=[.618,1,1.618,2.618].map(r=>({ratio:r,tradeDays:Math.ceil(anchorPeriod*r)}));
 return {window:n,validDays:rows.length,basis,direction:rising?'up':'down',low:round(low),high:round(high),lowDate:rows[lo].d,highDate:rows[hi].d,
   current:round(current),currentDate:recent.d,anchorSpanTradingDays:anchorPeriod,retracements,extensions,timeWindows,
   method:basis==='close'?'以官方每日收盤價最高／最低作近似斐波錨點，不是日內最高／最低，也非波段預測':'以窗口內最高高點/最低低點錨定；非主波段判定或轉折預測'};
}
export function parseTwseIndex(payload){
 if(!Array.isArray(payload))throw Error('證交所指數非陣列');
 const rows=payload.map(x=>({d:isoDate(field(x,['Date','日期','交易日期'])),o:positive(field(x,['OpeningIndex','開盤指數','開盤'])),h:positive(field(x,['HighestIndex','最高指數','最高'])),l:positive(field(x,['LowestIndex','最低指數','最低'])),c:positive(field(x,['ClosingIndex','收盤指數','收盤']))}))
 .filter(x=>x.d&&x.c!==null);
 if(!rows.length)throw Error('加權指數欄位與來源格式不符（不得以個股或估算冒充）');
 return rows.sort((a,b)=>a.d.localeCompare(b.d)).map(x=>({...x,priceBasis:[x.o,x.h,x.l].every(Number.isFinite)?'highlow':'close'}));
}
export function parseTpexIndex(payload){
 if(!Array.isArray(payload))throw Error('櫃買指數非陣列');
 const rows=payload.map(x=>({d:isoDate(field(x,['Date','日期','TradingDate'])),o:positive(field(x,['Open','OpeningIndex','開盤指數'])),h:positive(field(x,['High','HighestIndex','最高指數'])),l:positive(field(x,['Low','LowestIndex','最低指數'])),c:positive(field(x,['Close','ClosingIndex','收盤指數']))}))
 .filter(x=>x.d&&x.c!==null);
 if(!rows.length)throw Error('櫃買指數欄位與來源格式不符');
 return rows.sort((a,b)=>a.d.localeCompare(b.d)).map(x=>({...x,priceBasis:[x.o,x.h,x.l].every(Number.isFinite)?'highlow':'close'}));
}
// OpenAPI 以最新快照為主。若無來源日期則標記 inferred，不冒充官方日別已核實。
export function parseMargin(payload,market,anchorDate){
 if(!Array.isArray(payload))throw Error('融資融券 API 非陣列');
 const out=[];
 for(const x of payload){
 const code=String(field(x,['Code','StockNo','SecurityCode','SecuritiesCompanyCode','股票代號','證券代號'])??'').trim();
 if(!ordinary(code))continue;
 const financing=quantity(field(x,['融資今日餘額','融資今餘額','MarginPurchaseBalance','MarginPurchaseTodayBalance','MarginPurchaseCurrentBalance','MarginTodayBalance','MarginBalance']));
 const shorting=quantity(field(x,['融券今日餘額','融券今餘額','ShortSaleBalance','ShortSaleTodayBalance','ShortSaleCurrentBalance','ShortTodayBalance','ShortBalance']));
 if(financing===null||shorting===null)continue;
 const declared=isoDate(field(x,['Date','日期','交易日期','TradingDate','ReportDate']));
 if(declared&&anchorDate&&declared>anchorDate)continue; // 官方融資券晚公布時保留原始日期，不強迫等於最新股價日
 const d=declared||anchorDate;if(!d)continue;
 const prevMargin=quantity(field(x,['融資前日餘額','MarginPurchaseBalancePreviousDay','MarginPurchasePreviousBalance']));
 const prevShort=quantity(field(x,['融券前日餘額','ShortSaleBalancePreviousDay','ShortSalePreviousBalance']));
 out.push({code,d,market,margin:financing,short:shorting,prevMargin,prevShort,dateConfirmed:!!declared,unit:'來源原始單位'});
 }
 if(out.length<30)throw Error(`${market}融資融券欄位未對應成功／可驗證資料不足 (${out.length})`);
 return out;
}
// TX 月合約通常在契約月份的第三個星期三日盤 13:30 終止交易；
// 如遇交易所另行公告調整到期日需更新規則，不自動造出新月份價格。
export function txThirdWednesday(month){
 const m=String(month);
 if(!/^(20\d{2})(0[1-9]|1[0-2])$/.test(m))return null;
 const y=Number(m.slice(0,4)),mo=Number(m.slice(4));
 const first=new Date(Date.UTC(y,mo-1,1)),firstWednesday=1+(3-first.getUTCDay()+7)%7;
 return new Date(Date.UTC(y,mo-1,firstWednesday+14)).toISOString().slice(0,10);
}
export function txExpired(month,asOf=''){
 const exp=txThirdWednesday(month);if(!exp)return true;
 const moment=asOf?new Date(asOf):new Date();
 if(Number.isNaN(moment.getTime()))throw Error('期貨參考時間格式錯誤');
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(moment);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 const d=p.year+'-'+p.month+'-'+p.day,min=Number(p.hour)*60+Number(p.minute);
 return d>exp||(d===exp&&min>=13*60+30);
}
export function parseTxFutures(payload,{asOf}={}){
 if(!Array.isArray(payload))throw Error('期交所每日行情非陣列');
 const all=[];
 for(const x of payload){
  const contract=String(field(x,['Contract','契約','商品代號'])??'').trim().toUpperCase();
  if(contract!=='TX'&&contract!=='TXF')continue;
  const d=isoDate(field(x,['Date','交易日期']));
  const contractMonth=String(field(x,['ContractMonth(Week)','ContractMonth','契約月份'])??'').trim();
  const session=String(field(x,['TradingSession','交易時段'])??'').trim();
  const close=positive(field(x,['Last','Close','收盤價','最後成交價']));
  if(!d||!txThirdWednesday(contractMonth)||close===null)continue;
  const open=positive(field(x,['Open','開盤價'])),hi=positive(field(x,['High','最高價'])),lo=positive(field(x,['Low','最低價']));
  all.push({d,contract:'TX',contractMonth,session,close,o:open,h:hi,l:lo,
   settlement:positive(field(x,['SettlementPrice','結算價'])),
   volume:quantity(field(x,['Volume','成交量'])),openInterest:quantity(field(x,['OpenInterest','未沖銷契約數']))});
 }
 if(!all.length)throw Error('找不到有效的臺指期 TX 合約行情');
 const candidateMonths=[...new Set(all.map(x=>x.contractMonth))]
    .filter(m=>!txExpired(m,asOf)).sort();
 const front=candidateMonths[0]||null;
 const sourceDate=all.map(x=>x.d).sort().at(-1);
 const note='臺指期不同到期月不會拼成連續K線；日盤及夜盤各有交易日。資料為官方最後可取得快照，非即時。';
 if(!front)return {date:null,sourceDate,contract:'TX',contractMonth:null,day:null,night:null,
  newSnapshots:all,status:'expired-or-no-valid-contract',note:'尚無尚未到期的有效 TX 合約報價；'+note,
  source:'https://openapi.taifex.com.tw/v1/DailyMarketReportFut'};
 const rows=all.filter(x=>x.contractMonth===front).sort((a,b)=>a.d.localeCompare(b.d));
 const isNight=s=>/盤後|夜盤|after|night/i.test(s||'');
 const day=[...rows].reverse().find(x=>!isNight(x.session))||null;
 const night=[...rows].reverse().find(x=>isNight(x.session))||null;
 return {date:rows.at(-1).d,sourceDate,contract:'TX',contractMonth:front,
  day,night,newSnapshots:all,status:'ok',expiresOn:txThirdWednesday(front),
  source:'https://openapi.taifex.com.tw/v1/DailyMarketReportFut',note};
}

// 月檔優先補齊歷史日期：若舊日快照有可驗證的完整 OHLC，才保留較豐富內容。
// 避免上一版用舊值無條件覆蓋月資料；尤其不可將舊版以收盤冒充的高低價當真。
export function mergeIndexMonth(existing,incoming,limit=550){
 const usable=x=>[x?.o,x?.h,x?.l,x?.c].every(Number.isFinite)&&x.h>=x.l;
 const realOHLC=x=>usable(x)&&x.priceBasis==='highlow';
 const oldArr=(existing||[]).filter(x=>x?.d),map=new Map(oldArr.map(x=>[x.d,x]));
 for(const item of (incoming||[])){
   if(!item?.d)continue;
   const old=map.get(item.d);
   if(!old){map.set(item.d,item);continue;}
   if(realOHLC(old)&&!realOHLC(item))continue;
   if(realOHLC(old)&&realOHLC(item)){map.set(item.d,item);continue;}
   map.set(item.d,item); // 有效的官方月份資料覆蓋舊版不完整／偽 OHLC 快照
 }
 return [...map.values()].sort((a,b)=>a.d.localeCompare(b.d)).slice(-limit);
}
export function mergeDaily(existing,incoming,limit=550){const map=new Map((existing||[]).filter(x=>x&&x.d).map(x=>[x.d,x]));
 for(const x of incoming||[])if(x?.d)map.set(x.d,x);
 return [...map.values()].sort((a,b)=>a.d.localeCompare(b.d)).slice(-limit);
}
export function summarizeMargin(items,previous){
 if(!items?.length)return null;
 const total=x=>items.reduce((s,r)=>s+r[x],0);
 const margin=total('margin'),short=total('short');
 const prev=previous?.d<items[0].d?previous:null;
 const allHaveDailyPrev=items.every(x=>Number.isFinite(x.prevMargin)&&Number.isFinite(x.prevShort));
 const dailyMargin=allHaveDailyPrev?margin-items.reduce((s,r)=>s+r.prevMargin,0):null;
 const dailyShort=allHaveDailyPrev?short-items.reduce((s,r)=>s+r.prevShort,0):null;
 return {d:items[0].d,count:items.length,margin,short,changeMargin:dailyMargin??(prev?margin-prev.margin:null),changeShort:dailyShort??(prev?short-prev.short:null),
   unit:'原始來源單位；未確認一致前不跨市場加總',dateConfirmed:items.every(x=>x.dateConfirmed),
   coverageNote:items.some(x=>!x.dateConfirmed)?'資料集未附明確交易日，採同市場最新股價日錨定，待驗證':'來源日期已確認',
   coverageCount:items.length};
}

// 股_V0.6.6：官方按月指數回補。TWSE FMTQIK 只有收盤，不假裝有日高低；OTC 提供 OHLC。
export function parseTwseIndexMonth(payload,monthKey){
 if(payload?.stat!=='OK'||!Array.isArray(payload.fields)||!Array.isArray(payload.data))throw Error('TWSE FMTQIK 月資料非有效官方表');
 const di=payload.fields.indexOf('日期'),ci=payload.fields.indexOf('發行量加權股價指數');
 if(di<0||ci<0)throw Error('TWSE FMTQIK 欄位格式異動');
 const rows=payload.data.map(row=>({d:isoDate(row?.[di]),c:positive(row?.[ci])}))
   .filter(x=>x.d?.startsWith(monthKey+'-')&&x.c!==null)
   .map(x=>({...x,o:null,h:null,l:null,priceBasis:'close'}));
 if(!rows.length)throw Error('TWSE FMTQIK 查無該月有效交易日');
 return rows.sort((a,b)=>a.d.localeCompare(b.d));
}
export function parseTpexIndexMonth(payload,monthKey){
 if(String(payload?.stat||'').toLowerCase()!=='ok')throw Error('TPEx 指數月資料非有效官方回應');
 const tables=Array.isArray(payload.tables)?payload.tables:[];
 const required=[['日期'],['開市','開盤'],['最高'],['最低'],['收市','收盤']];
 const matched=tables.map(t=>{
   const f=(t?.fields||[]).map(normalize);
   const idx=required.map(names=>f.findIndex(x=>names.some(y=>x===normalize(y))));
   return {t,idx};
 }).find(x=>Array.isArray(x.t?.data)&&x.idx.every(i=>i>=0));
 if(!matched)throw Error('TPEx 指數歷史缺少日期／開高低收欄位');
 const {t,idx}=matched;
 const rows=t.data.map(row=>({d:isoDate(row?.[idx[0]]),o:positive(row?.[idx[1]]),h:positive(row?.[idx[2]]),l:positive(row?.[idx[3]]),c:positive(row?.[idx[4]]),priceBasis:'highlow'}))
  .filter(x=>x.d?.startsWith(monthKey+'-')&&[x.o,x.h,x.l,x.c].every(Number.isFinite)&&x.h>=x.l&&x.o>=x.l&&x.o<=x.h&&x.c>=x.l&&x.c<=x.h);
 if(!rows.length)throw Error('TPEx 指數該月無有效交易日，或回傳資料與查詢月份不符');
 return rows.sort((a,b)=>a.d.localeCompare(b.d));
}
