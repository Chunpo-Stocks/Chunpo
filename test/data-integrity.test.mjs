import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTwseInst} from '../engine.mjs';
import {parseTwseMarginDaily} from '../scripts/margin-daily.mjs';
import {parseTxFutures,txThirdWednesday,txExpired} from '../scripts/market-engine.mjs';
import {quarantineUndatedTwseMargin,invalidateLegacyTwseDealer,listedDealerPendingDates} from '../scripts/data-quality.mjs';
const headers=['代號','名稱','買進','賣出','現金償還','前日餘額','今日餘額','次一營業日限額','買進','賣出','現券償還','前日餘額','今日餘額','次一營業日限額','資券互抵','註記'];
const margin=(date='20261118')=>({stat:'OK',date,tables:[{fields:headers,data:Array.from({length:550},(_,i)=>[String(1100+i),'測試','2','1','0','100','101','1000','3','2','0','12','11','1000','0',''])}]});
const fields=['證券代號','證券名稱','外陸資買賣超股數(不含外資自營商)','外資自營商買賣超股數','投信買賣超股數','自營商買賣超股數','自營商買賣超股數(自行買賣)','自營商買賣超股數(避險)'];
test('TWSE 自營商用精確欄名，不能誤用較早出現的「外資自營商」',()=>{
 const row=['2330','測試公司','5000','0','-1000','23000','20000','3000'];
 const parsed=parseTwseInst({fields,data:[row]},'2026-11-18');
 assert.equal(parsed.length,1);assert.equal(parsed[0].dealer,23000);
});
test('TWSE 自營商合計和自行買賣/避險互相核對，不能靜默輸出錯值',()=>{
 const row=['2330','測試公司','5000','0','-1000','20000','20000','3000'];
 assert.throws(()=>parseTwseInst({fields,data:[row]},'2026-11-18'),/合計/);
});
test('MI_MARGN 欄位重複但分區合法；融資與融券餘額分別是第6和第12欄',()=>{
 const rows=parseTwseMarginDaily(margin(),'2026-11-18');
 assert.equal(rows.length,550);assert.equal(rows[0].margin,101);assert.equal(rows[0].short,11);
 assert.equal(rows[0].prevMargin,100);assert.equal(rows[0].prevShort,12);assert.equal(rows[0].dateConfirmed,true);
});
test('缺來源日期、日期不符或欄名失真，融資券必須拒絕',()=>{
 assert.throws(()=>parseTwseMarginDaily(margin('20261117'),'2026-11-18'),/日期/);
 const p=margin();p.tables[0].fields[6]='成交股數';
 assert.throws(()=>parseTwseMarginDaily(p,'2026-11-18'),/未完整解析/);
});
test('隔離假日期上市融資券、不刪除驗證過的歷史',()=>{
 const item=(d,ok)=>({d,margin:101,short:11,dateConfirmed:ok});
 const store={marketData:{margin:{上市:[item('2026-11-17',false),item('2026-11-18',true)]},marginDetails:{上市:{'2026-11-17':[item('2026-11-17',false)]}}},stocks:{'1101':{market:'上市',marginHistory:[item('2026-11-17',false),item('2026-11-18',true)]}}};
 assert.ok(quarantineUndatedTwseMargin(store)>0);
 assert.equal(store.marketData.margin.上市.length,1);
 assert.equal(store.stocks['1101'].marginHistory.length,1);
 assert.equal(store.marketData.quarantine.twseMarginSummary.length,1);
});
test('歷史自營商假0改成null並排入日期回補；已驗證真0必須保留',()=>{
 const store={stocks:{'1101':{market:'上市',institutions:[{d:'2026-11-17',dealer:0},{d:'2026-11-18',dealer:0}]}},dealerRepair:{verifiedDates:['2026-11-18']}};
 assert.equal(invalidateLegacyTwseDealer(store),1);
 assert.deepEqual(listedDealerPendingDates(store),['2026-11-17']);
 assert.equal(store.stocks['1101'].institutions[1].dealer,0);
});
test('TX 202611 在 11/18 13:30 台北時間之後為到期，近月自動切換到202612',()=>{
 assert.equal(txThirdWednesday('202611'),'2026-11-18');
 assert.equal(txExpired('202611','2026-11-18T13:29:00+08:00'),false);
 assert.equal(txExpired('202611','2026-11-18T13:30:00+08:00'),true);
 const t=['202611','202612'].map(month=>({Date:'20261117',Contract:'TX','ContractMonth(Week)':month,TradingSession:'一般',Last:month==='202611'?'40073':'40152',Open:'40000',High:'40200',Low:'39900'}));
 const data=parseTxFutures(t,{asOf:'2026-11-18T21:00:00+08:00'});
 assert.equal(data.contractMonth,'202612');assert.equal(data.day.close,40152);
 assert.equal(data.date,'2026-11-17');assert.equal(data.newSnapshots.length,2);
});
