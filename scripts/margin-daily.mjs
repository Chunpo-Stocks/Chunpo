// V0.6.8.2: TWSE 指定日期逐股信用交易餘額（僅接受日期及欄位可驗證的官方表）
import {isoDate,num,ordinary,namedTables} from '../engine.mjs';
const N=s=>String(s??'').replace(/[\s（）()：:]/g,'');
const getIndex=(fs,names)=>fs.findIndex(x=>names.some(y=>N(x)===N(y)));
const clean=x=>{const v=num(x);return Number.isFinite(v)&&v>=0?v:null};
export function parseTwseMarginDaily(payload,requestedDate){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('TWSE 指定日融資券不是有效 JSON 物件');
 if(!/^20\d\d-\d\d-\d\d$/.test(requestedDate))throw Error('融資券查詢日期不合法');
 const date=isoDate(payload.date??payload.Date??'');
 if(!date||date!==requestedDate)throw Error('融資券官方回應日期未確認或不符：'+(payload.date??'無日期'));
 if(!/^ok$/i.test(String(payload.stat??'')))throw Error('融資券官方狀態非 OK：'+String(payload.stat??'無狀態'));
 const out=[];
 for(const table of namedTables(payload)){
  const fs=table.fields.map(N);
  const id=getIndex(fs,['證券代號','股票代號']);
  const prevMargin=getIndex(fs,['融資前日餘額','前日餘額']);
  const todayMargin=getIndex(fs,['融資今日餘額','今日餘額']);
  const prevShort=fs.findIndex((f,i)=>i>todayMargin&&['融券前日餘額','前日餘額'].includes(f));
  const todayShort=fs.findIndex((f,i)=>i>todayMargin&&['融券今日餘額','今日餘額'].includes(f));
  if([id,prevMargin,todayMargin,prevShort,todayShort].some(i=>i<0))continue;
  for(const row of table.rows){
   if(!Array.isArray(row))continue;
   const code=String(row[id]??'').trim();
   if(!ordinary(code))continue;
   const m=clean(row[todayMargin]),s=clean(row[todayShort]),pm=clean(row[prevMargin]),ps=clean(row[prevShort]);
   if([m,s,pm,ps].some(x=>x===null))continue;
   out.push({code,d:date,market:'上市',margin:m,short:s,prevMargin:pm,prevShort:ps,
      dateConfirmed:true,unit:'官方原表單位',source:'https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date='+date.replaceAll('-','')+'&selectType=STOCK&response=json'});
  }
 }
 if(out.length<500)throw Error('TWSE 指定日期融資券表未完整解析：'+out.length+' 筆（最低500筆）');
 return out;
}