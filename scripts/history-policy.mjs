// 股_V0.6.1 - 保守的歷史回補日期判定。不可把任何 API 錯誤直接當休市。
import {namedTables,parseHistory} from '../engine.mjs';

// 2026-10-26 為證交所與櫃買中心正式公告的光復節補假休市。
// 不依賴每日最新的開休市 OpenAPI（它可能只提供下一年度），
// 其餘日期要依雙市場的官方歷史回應做交叉驗證。
export const verifiedClosures = new Set(['2026-10-26','2026-10-09']);
export const isVerifiedClosure = d => verifiedClosures.has(d);

const noData = /沒有|查無|無資料|無符合|休市|假日|holiday|no data/i;
export function inspectHistory(payload,market,date){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error(market+'歷史資料不是預期的 JSON 物件');
  const rows=parseHistory(payload,market,date);
  const tables=namedTables(payload);
  const rawStatus=String(payload.stat ?? payload.status ?? '');
  // 空資料不等於有效回應，至少要看到官方無資料訊息或有效表格結構。
  const structurallyValid=tables.some(t=>Array.isArray(t.fields)&&t.fields.length>=5&&Array.isArray(t.rows));
  const explicitlyEmpty=noData.test(rawStatus);
  if(rows.length===0 && !structurallyValid && !explicitlyEmpty){
    throw Error(market+'歷史資料為空且格式未辨識，不能當成休市：'+(rawStatus||'無狀態'));
  }
  return {rows,empty:rows.length===0,valid:structurallyValid||explicitlyEmpty};
}

export function classifyHistoryPair(twse,tpex,date){
  if(twse.rows.length===0 && tpex.rows.length===0){
    if(!twse.valid||!tpex.valid)throw Error(date+' 雙市場皆空，但有未確認的回應格式');
    return {kind:'closed',twse:[],tpex:[]};
  }
  // 開市日不接受其中一市場忽然變成零：防止把單邊資料缺漏當成功。
  if(twse.rows.length<50||tpex.rows.length<50){
    throw Error(date+` 市場資料不完整：上市 ${twse.rows.length} 筆／上櫃 ${tpex.rows.length} 筆`);
  }
  return {kind:'trading',twse:twse.rows,tpex:tpex.rows};
}
