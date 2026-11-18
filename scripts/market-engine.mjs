// 股_V0.6.5 市場與斐波核心：只處理已核實的日期和有效數值，不自行造行情。
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
 const rows=series.slice(-n).filter(b=>b&&/^20\d{2}-\d{2}-\d{2}$/.test(b.d)&&positive(b.h)!==null&&positive(b.l)!==null&&positive(b.c)!==null&&b.h>=b.l);
 if(rows.length<20)return null;
 let hi=0,lo=0;for(let i=1;i<rows.length;i++){if(rows[i].h>rows[hi].h)hi=i;if(rows[i].l<rows[lo].l)lo=i;}
 if(hi===lo)return null;
 const high=rows[hi].h,low=rows[lo].l,span=high-low;
 if(span<=0||span/low<0.005)return null;
 const rising=lo<hi,levels=[.236,.382,.5,.618,.786],exp=[1,1.272,1.618,2];
 const recent=rows.at(-1),current=recent.c;
 const retracements=levels.map(r=>({ratio:r,price:round(rising?high-span*r:low+span*r)}));
 const extensions=exp.map(r=>({ratio:r,price:round(rising?low+span*r:high-span*r)}));
 // 斐波時間僅顯示第幾個交易日，不使用日曆推算成保證轉折日期。
 const anchorPeriod=Math.abs(hi-lo);
 const timeWindows=[.618,1,1.618,2.618].map(r=>({ratio:r,tradeDays:Math.ceil(anchorPeriod*r)}));
 return {window:n,validDays:rows.length,direction:rising?'up':'down',low:round(low),high:round(high),lowDate:rows[lo].d,highDate:rows[hi].d,
   current:round(current),currentDate:recent.d,anchorSpanTradingDays:anchorPeriod,retracements,extensions,timeWindows,
   method:'以窗口內最高高點/最低低點錨定；依極值先後判定漲段/跌段，並非自動辨識主波段；不預測轉折日期'};
}
export function parseTwseIndex(payload){
 if(!Array.isArray(payload))throw Error('證交所指數非陣列');
 const rows=payload.map(x=>({d:isoDate(field(x,['Date','日期','交易日期'])),o:positive(field(x,['OpeningIndex','開盤指數','開盤'])),h:positive(field(x,['HighestIndex','最高指數','最高'])),l:positive(field(x,['LowestIndex','最低指數','最低'])),c:positive(field(x,['ClosingIndex','收盤指數','收盤']))}))
 .filter(x=>x.d&&x.c!==null);
 if(!rows.length)throw Error('加權指數欄位與來源格式不符（不得以個股或估算冒充）');
 return rows.sort((a,b)=>a.d.localeCompare(b.d)).map(x=>({d:x.d,o:x.o??x.c,h:x.h??x.c,l:x.l??x.c,c:x.c}));
}
export function parseTpexIndex(payload){
 if(!Array.isArray(payload))throw Error('櫃買指數非陣列');
 const rows=payload.map(x=>({d:isoDate(field(x,['Date','日期','TradingDate'])),o:positive(field(x,['Open','OpeningIndex','開盤指數'])),h:positive(field(x,['High','HighestIndex','最高指數'])),l:positive(field(x,['Low','LowestIndex','最低指數'])),c:positive(field(x,['Close','ClosingIndex','收盤指數']))}))
 .filter(x=>x.d&&x.c!==null);
 if(!rows.length)throw Error('櫃買指數欄位與來源格式不符');
 return rows.sort((a,b)=>a.d.localeCompare(b.d)).map(x=>({d:x.d,o:x.o??x.c,h:x.h??x.c,l:x.l??x.c,c:x.c}));
}
// OpenAPI 以最新快照為主。若無來源日期則標記 inferred，不冒充官方日別已核實。
export function parseMargin(payload,market,anchorDate){
 if(!Array.isArray(payload))throw Error('融資融券 API 非陣列');
 const out=[];
 for(const x of payload){
 const code=String(field(x,['Code','StockNo','SecurityCode','SecuritiesCompanyCode','股票代號','證券代號'])??'').trim();
 if(!ordinary(code))continue;
 const financing=quantity(field(x,['融資今日餘額','融資今餘額','MarginPurchaseTodayBalance','MarginPurchaseCurrentBalance','MarginTodayBalance','MarginBalance']));
 const shorting=quantity(field(x,['融券今日餘額','融券今餘額','ShortSaleTodayBalance','ShortSaleCurrentBalance','ShortTodayBalance','ShortBalance']));
 if(financing===null||shorting===null)continue;
 const declared=isoDate(field(x,['Date','日期','交易日期','TradingDate','ReportDate']));
 if(declared&&anchorDate&&declared!==anchorDate)continue;
 const d=declared||anchorDate;if(!d)continue;
 out.push({code,d,market,margin:financing,short:shorting,dateConfirmed:!!declared,unit:'來源原始單位（待官方欄位核對）'});
 }
 if(out.length<30)throw Error(`${market}融資融券欄位未對應成功／可驗證資料不足 (${out.length})`);
 return out;
}
export function parseTxFutures(payload){
 if(!Array.isArray(payload))throw Error('期交所每日行情非陣列');
 const all=[];
 for(const x of payload){const contract=String(field(x,['Contract','契約','商品代號'])??'').trim().toUpperCase();
 if(contract!=='TX'&&contract!=='TXF')continue;
 const d=isoDate(field(x,['Date','交易日期']));const contractMonth=String(field(x,['ContractMonth(Week)','ContractMonth','契約月份'])??'').trim();
 const session=String(field(x,['TradingSession','交易時段'])??'').trim();
 const close=positive(field(x,['Last','Close','收盤價','最後成交價']));
 if(!d||!/^\d{6}$/.test(contractMonth)||close===null)continue;
 const open=positive(field(x,['Open','開盤價'])),hi=positive(field(x,['High','最高價'])),lo=positive(field(x,['Low','最低價']));
 all.push({d,contract:'TX',contractMonth,session,close,o:open,h:hi,l:lo,settlement:positive(field(x,['SettlementPrice','結算價'])),volume:quantity(field(x,['Volume','成交量'])),openInterest:quantity(field(x,['OpenInterest','未沖銷契約數']))});
 }
 if(!all.length)throw Error('找不到有效的臺指期 TX 合約行情');
 const date=all.map(x=>x.d).sort().at(-1);const day=all.filter(x=>x.d===date);
 // 自動近月選擇：當日有有效報價的最早 YYYYMM；結算日換月需人工核對。
 const front=day.map(x=>x.contractMonth).sort()[0];
 const near=day.filter(x=>x.contractMonth===front);
 const active=near.find(x=>/一般|日盤|regular|day/i.test(x.session))||near[0];
 const night=near.find(x=>/盤後|夜盤|after|night/i.test(x.session));
 return {date,contract:'TX',contractMonth:front,day:active,night:night||null,source:'https://openapi.taifex.com.tw/v1/DailyMarketReportFut',note:'一般與盤後為不同交易時段；夜盤交易日期歸屬與現貨交易日可能不同；近月換月時不得視為未調整的連續期貨K線。'};
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
 return {d:items[0].d,count:items.length,margin,short,changeMargin:prev?margin-prev.margin:null,changeShort:prev?short-prev.short:null,
   unit:'原始來源單位；未確認一致前不跨市場加總',dateConfirmed:items.every(x=>x.dateConfirmed),
   coverageNote:items.some(x=>!x.dateConfirmed)?'資料集未附明確交易日，採同市場最新股價日錨定，待驗證':'來源日期已確認',
   coverageCount:items.length};
}
