// 股_V0.6.8.3：已收盤交易日的官方日期指定行情驗證，避免 OpenAPI 快照落後。
import {inspectHistory,isVerifiedClosure} from './history-policy.mjs';
const dayPrev=d=>new Date(Date.parse(d+'T00:00:00Z')-86400000).toISOString().slice(0,10);
const working=d=>{const v=new Date(d+'T00:00:00Z').getUTCDay();return v!==0&&v!==6&&!isVerifiedClosure(d);};
export function latestCompletedTaipeiSession(now=new Date()){
 const time=typeof now==='string'?new Date(now):now;
 if(!(time instanceof Date)||!Number.isFinite(time.getTime()))throw Error('非有效的時間戳記');
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(time);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 let date=p.year+'-'+p.month+'-'+p.day;
 const minutes=Number(p.hour)*60+Number(p.minute);
 if(minutes<14*60+10)date=dayPrev(date); // 盤後留40分鐘緩衝，仍需核實官方資料日
 while(!working(date))date=dayPrev(date);
 return date;
}
export function parseVerifiedDailyMarket(payload,market,date,{minimum}={}){
 if(!['上市','上櫃'].includes(market))throw Error('交易市場不支援');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('日期格式錯誤');
 const valid=inspectHistory(payload,market,date);
 const need=minimum??(market==='上市'?500:300);
 if(!valid.valid||valid.rows.length<need)throw Error(market+' '+date+' 官方每日行情未達核驗門檻：'+valid.rows.length+'／'+need);
 const unique=new Set();
 for(const b of valid.rows){
  if(b.d!==date||b.market!==market||!Number.isFinite(b.c)||b.c<=0||!Number.isFinite(b.v)||b.v<0)throw Error('回應日期或價格異常');
  if(unique.has(b.code))throw Error('同日股票代號重複：'+b.code);
  unique.add(b.code);
 }
 return valid.rows;
}
