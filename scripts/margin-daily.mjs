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
  // 官方個股融資融券表採重複欄名，不可用第一次「今日餘額」取代融券。
  // 先核對整體欄位結構，再依固定分區索引取值。
  const isDetails=fs.length>=14&&['代號','證券代號'].includes(fs[0])&&
    fs[5]==='前日餘額'&&fs[6]==='今日餘額'&&
    fs[11]==='前日餘額'&&fs[12]==='今日餘額';
  if(!isDetails)continue;
  for(const row of table.rows){
    if(!Array.isArray(row)||row.length<13)continue;
    const code=String(row[0]??'').trim();
    if(!ordinary(code))continue;
    const margin=clean(row[6]),short=clean(row[12]),prevMargin=clean(row[5]),prevShort=clean(row[11]);
    if([margin,short,prevMargin,prevShort].some(x=>x===null))continue;
    out.push({code,d:date,market:'上市',margin,short,prevMargin,prevShort,
       dateConfirmed:true,unit:'官方原表單位',source:'https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date='+date.replaceAll('-','')+'&selectType=ALL&response=json'});
  }
 }
 if(out.length<500)throw Error('TWSE 指定日期融資券表未完整解析：'+out.length+' 筆（最低500筆）');
 return out;
}