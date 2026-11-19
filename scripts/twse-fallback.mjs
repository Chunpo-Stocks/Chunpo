// 股_V0.6.8.1 — OpenAPI 最新快照落後時，使用證交所指定日期完整盤後表保守補抓。
// 不自行推算價格，不將缺資料、休市或欄位失敗視為成功。
import {inspectHistory} from './history-policy.mjs';
export function chooseTwseFallbackDate(markets, today, {afterClose=false}={}){
  const twse=markets?.['上市']?.date;
  const tpex=markets?.['上櫃']?.date;
  const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&d<=today;
  // 上櫃抓取失敗時仍可嘗試當日上市官方日期報表，絕不單靠推定日期寫入行情。
  const weekday=validDate(today)&&![0,6].includes(new Date(today+'T00:00:00Z').getUTCDay());
  const candidate=[validDate(tpex)?tpex:null,afterClose&&weekday?today:null].filter(Boolean).sort().at(-1);
  return candidate&&(!validDate(twse)||candidate>twse)?candidate:null;
}
export function validateTwseDaily(payload,date,{minimum=500}={}){
  const inspected=inspectHistory(payload,'上市',date);
  if(!inspected.valid||inspected.rows.length<minimum){
    throw Error('指定日期上市盤後資料未達驗證門檻：'+inspected.rows.length+'／'+minimum);
  }
  if(inspected.rows.some(x=>x.d!==date||x.market!=='上市'||!Number.isFinite(x.c)||x.c<=0)){
    throw Error('指定日期上市盤後資料日期或價格異常');
  }
  return inspected.rows;
}

export function validateTpexDaily(payload,date,{minimum=200}={}){
  const inspected=inspectHistory(payload,'上櫃',date);
  if(!inspected.valid||inspected.rows.length<minimum){
    throw Error('指定日期上櫃盤後資料未達驗證門檻：'+inspected.rows.length+'／'+minimum);
  }
  if(inspected.rows.some(x=>x.d!==date||x.market!=='上櫃'||!Number.isFinite(x.c)||x.c<=0)){
    throw Error('指定日期上櫃盤後資料日期或價格異常');
  }
  return inspected.rows;
}
