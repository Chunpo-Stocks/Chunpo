// 官方資料來源結構稽核：只輸出公開欄位名稱、筆數、資料日期及少量必要驗證統計。
// 不更動歷史資料、不寫入價格、不印出任何私密資訊。
const sources=[
 ['twsePrice','https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'],
 ['tpexPrice','https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes'],
 ['twseInst','https://www.twse.com.tw/rwd/zh/fund/T86?date=20261118&response=json&selectType=ALLBUT0999'],
 ['tpexInst','https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading'],
 ['twseMarginDaily','https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date=20261118&response=json&selectType=ALL'],
 ['tpexMargin','https://www.tpex.org.tw/openapi/v1/tpex_mainboard_margin_balance'],
 ['tx','https://openapi.taifex.com.tw/v1/DailyMarketReportFut'],
];
const js=async(url)=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Stock-Data-Audit/1.0','Accept':'application/json,*/*'}});if(!r.ok)throw Error('HTTP '+r.status);const t=await r.text();if(!['{','['].includes(t.trim()[0]))throw Error('非JSON回覆');return JSON.parse(t)}
 finally{clearTimeout(timer)}
};
for(const [name,url] of sources){
 try{
  const d=await js(url),rows=Array.isArray(d)?d:[],tables=Array.isArray(d.tables)?d.tables:[],
   first=rows[0]||null,table=tables.map(t=>({fields:t.fields||[],rows:t.data?.length??0})).filter(x=>x.fields.length);
  const info={source:name,type:Array.isArray(d)?'array':'object',rows:rows.length,objectKeys:!Array.isArray(d)?Object.keys(d).slice(0,25):undefined,
   stat:d?.stat??null,date:d?.date??null,columns:first?Object.keys(first).slice(0,40):null,
   firstRowDate:first?(first.Date??first.TradingDate??null):null,tableHeaders:table.slice(0,5)};
  if(name==='tpexMargin')info.sample=first?Object.fromEntries(Object.entries(first).filter(([k])=>/Date|Margin|Short|Code/i.test(k)).slice(0,15)):null;
  if(name==='tpexInst')info.sample=first?Object.fromEntries(Object.entries(first).filter(([k])=>/Deal|Difference|Date/i.test(k)).slice(0,16)):null;
  if(name==='tx')info.sample=rows.filter(x=>String(x.Contract??'').toUpperCase()==='TX').slice(0,8).map(x=>({Date:x.Date,Contract:x.Contract,Month:x['ContractMonth(Week)']??x.ContractMonth,Session:x.TradingSession,Last:x.Last,Close:x.Close}));
  console.log('OFFICIAL_PROBE '+JSON.stringify(info));
 }catch(e){console.log('OFFICIAL_PROBE '+JSON.stringify({source:name,error:String(e)}))}
}
