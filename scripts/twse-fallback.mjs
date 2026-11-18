// 股_V0.6.8.1 — OpenAPI 最新快照落後時，使用證交所指定日期完整盤後表保守補抓。
// 不自行推算價格，不將缺資料、休市或欄位失敗視為成功。
import {inspectHistory} from './history-policy.mjs';
export function chooseTwseFallbackDate(markets, today){
  const twse=markets?.['上市']?.date;
  const tpex=markets?.['上櫃']?.date;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tpex||'')||tpex>today)return null;
  return (!twse||tpex>twse)?tpex:null;
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
