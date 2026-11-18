import test from 'node:test';
import assert from 'node:assert/strict';
import {derive,parseHistory} from '../engine.mjs';
import {inspectHistory,classifyHistoryPair,isVerifiedClosure} from '../scripts/history-policy.mjs';

test('日期 2026-10-26 依官方公告為休市日，不應阻斷回補',()=>{
  assert.equal(isVerifiedClosure('2026-10-26'),true);
  assert.equal(isVerifiedClosure('2026-10-27'),false);
});
test('單日 RSI 缺值時不能呼叫 null.toFixed',()=>{
  const r=derive({code:'1538',name:'測試',market:'上市',bars:[{d:'2026-11-18',o:10,h:11,l:9,c:10,v:1000}]});
  assert.equal(r.rsi,null);assert.equal(r.days,1);assert.equal(r.bull.score,0);
});
test('雙市場合法空回應才可判休市',()=>{
  const tpex=inspectHistory({stat:'ok',tables:[{fields:['代號','名稱','收盤','開盤','最高','最低','成交股數'],data:[]}]},'上櫃','2026-10-26');
  const twse=inspectHistory({stat:'很抱歉，沒有符合條件的資料！'},'上市','2026-10-26');
  assert.equal(classifyHistoryPair(twse,tpex,'2026-10-26').kind,'closed');
});
test('單邊回應為空不可誤判休市',()=>{
  const arr=Array.from({length:70},(_,i)=>({code: String(2000+i),name:'測試'+i}));
  assert.throws(()=>classifyHistoryPair({rows:arr,valid:true},{rows:[],valid:true},'2026-10-27'),/不完整/);
});
test('空物件與錯誤格式不可當休市',()=>{
  assert.throws(()=>inspectHistory({},'上櫃','2026-10-27'),/格式未辨識/);
});
test('上櫃官方回應 17 欄可以按欄名解析',()=>{
  const fields=['代號','名稱','收盤','漲跌','開盤','最高','最低','成交股數','成交金額(元)','成交筆數','最後買價','最後買量(張數)','最後賣價','最後賣量(張數)','發行股數','次日漲停價','次日跌停價'];
  const row=['6488','環球晶','405.00','+5','400','410','399','2,000,000','800000000','100','404','10','405','10','500000','445','365'];
  const p={stat:'ok',tables:[{fields,data:[row]}]};
  const arr=parseHistory(p,'上櫃','2026-10-27');
  assert.equal(arr.length,1);assert.equal(arr[0].c,405);assert.equal(arr[0].v,2000000);
});
