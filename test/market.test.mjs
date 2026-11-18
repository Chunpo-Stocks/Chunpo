import test from 'node:test';
import assert from 'node:assert/strict';
import {fibonacci,parseTwseIndex,parseTpexIndex,parseTxFutures,parseMargin,mergeDaily,summarizeMargin,parseTwseIndexMonth,parseTpexIndexMonth,mergeIndexMonth} from '../scripts/market-engine.mjs';
const days=Array.from({length:120},(_,i)=>({d:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),o:90+i/2,h:95+i/2,l:85+i/2,c:90+i/2,v:10000}));
test('斐波以可追溯高低點計算回撤延伸，不宣稱預測轉折',()=>{
 const f=fibonacci(days,60);assert.ok(f);assert.equal(f.window,60);assert.equal(f.high,154.5);assert.equal(f.low,115);assert.equal(f.direction,'up');
 assert.equal(f.retracements.find(x=>x.ratio===.5).price,134.75);
 assert.equal(f.extensions.find(x=>x.ratio===1.618).price,Number((115+39.5*1.618).toFixed(3)));
 assert.ok(f.timeWindows[0].tradeDays>0);assert.ok(f.highDate>f.lowDate);
});
test('歷史不足不計斐波',()=>assert.equal(fibonacci(days.slice(0,10),60),null));
test('加權與櫃買官方 index 欄位可被解析，格式不符禁止自造',()=>{
 const tw=parseTwseIndex([{Date:'1151118',OpeningIndex:'26,101',HighestIndex:'26,300',LowestIndex:'26,000',ClosingIndex:'26,215.5'}]);
 const tp=parseTpexIndex([{Date:'20261118',Open:'265.2',High:'268.2',Low:'261',Close:'266.5'}]);
 assert.equal(tw[0].d,'2026-11-18');assert.equal(tw[0].c,26215.5);assert.equal(tp[0].c,266.5);
 assert.throws(()=>parseTpexIndex([{Date:'20261118',foo:1}]),/欄位/);
});
test('台指期須依 TX/契約月份/盤別分開儲存',()=>{
 const f=parseTxFutures([
 {Date:'20261118',Contract:'TX', 'ContractMonth(Week)':'202612',Open:'26300',High:'26360',Low:'26200',Last:'26320',SettlementPrice:'26319',TradingSession:'一般',OpenInterest:'123456'},
 {Date:'20261118',Contract:'TX', 'ContractMonth(Week)':'202612',Last:'26400',TradingSession:'盤後'},
 {Date:'20261118',Contract:'MTX', 'ContractMonth(Week)':'202611',Last:'999'},
 {Date:'20261118',Contract:'TX', 'ContractMonth(Week)':'202701',Last:'28000',TradingSession:'一般'}]);
 assert.equal(f.contractMonth,'202612');assert.equal(f.day.close,26320);assert.equal(f.night.close,26400);assert.equal(f.day.settlement,26319);
});
test('融資融券只接受對應欄位；官方資料晚一天會保留官方日期',()=>{
 const a=Array.from({length:32},(_,i)=>({Code:String(1101+i), Date:'1151118', '融資今日餘額':'20,000','融券今日餘額':'1,000'}));
 const m=parseMargin(a,'上市','2026-11-18');assert.equal(m.length,32);assert.ok(m[0].dateConfirmed);
 const sum=summarizeMargin(m,null);assert.equal(sum.margin,640000);assert.equal(sum.short,32000);assert.equal(sum.changeMargin,null);
 assert.equal(parseMargin(a.map(x=>({...x,Date:'1151117'})),'上市','2026-11-18')[0].d,'2026-11-17');
 assert.throws(()=>parseMargin(a.map(x=>({...x,Date:'1151119'})),'上市','2026-11-18'),/不足/);
});
test('融資券空缺不能補零；無日期時標為錨定待核',()=>{
 const a=Array.from({length:31},(_,i)=>({SecuritiesCompanyCode:String(1501+i),MarginPurchaseTodayBalance:'800',ShortSaleTodayBalance:'20'}));
 const m=parseMargin(a,'上櫃','2026-11-18');const s=summarizeMargin(m,null);
 assert.equal(s.dateConfirmed,false);assert.match(s.coverageNote,/待驗證/);
 const merge=mergeDaily([{d:'2026-11-17',v:1}],[{d:'2026-11-17',v:2}]);assert.equal(merge.length,1);assert.equal(merge[0].v,2);
});


test('股_V0.6.6 TWSE 月加權指數：僅收盤，勿虛構開高低',()=>{
 const rows=parseTwseIndexMonth({stat:'OK',fields:['日期','發行量加權股價指數'],data:[['115/11/17','40,092.11'],['115/11/18','40,194.91']]},'2026-11');
 assert.equal(rows.length,2);assert.equal(rows[0].c,40092.11);assert.equal(rows[0].h,null);
 const fib=fibonacci(Array.from({length:70},(_,i)=>({d:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),c:100+i})),60);
 assert.equal(fib.basis,'close');assert.match(fib.method,/收盤價/);
});
test('股_V0.6.6 OTC 每月歷史需驗證六欄及月份',()=>{
 const a=parseTpexIndexMonth({stat:'ok',tables:[{fields:['日期','開市','最高','最低','收市','漲/跌'],data:[['2026/11/18','301','310','299','307.55','+3']]}]},'2026-11');
 assert.equal(a[0].c,307.55);assert.equal(a[0].h,310);
});
test('股_V0.6.6 OTC 官方融資融券欄位與前一日餘額可直接算出日變化',()=>{
 const rows=Array.from({length:31},(_,i)=>({SecuritiesCompanyCode:String(6001+i),Date:'20261118',MarginPurchaseBalance:'110',ShortSaleBalance:'24',MarginPurchaseBalancePreviousDay:'100',ShortSaleBalancePreviousDay:'20'}));
 const out=parseMargin(rows,'上櫃','2026-11-18');assert.equal(out.length,31);
 const sum=summarizeMargin(out,null);assert.equal(sum.changeMargin,310);assert.equal(sum.changeShort,124);
});


test('股_V0.6.6.1 月檔可新增日期，不會被舊快照無條件覆寫',()=>{
 const old=[{d:'2026-11-18',o:100,h:100,l:100,c:100}];
 const fresh=[{d:'2026-11-17',c:99,o:null,h:null,l:null,priceBasis:'close'},{d:'2026-11-18',c:101,o:null,h:null,l:null,priceBasis:'close'}];
 const merged=mergeIndexMonth(old,fresh);
 assert.equal(merged.length,2);assert.equal(merged[1].c,101);assert.equal(merged[1].h,null);
});
test('股_V0.6.6.1 真實 OHLC 快照比收盤月資料資訊完整，應保留高低',()=>{
 const merged=mergeIndexMonth([{d:'2026-11-18',o:100,h:105,l:98,c:102,priceBasis:'highlow'}],[{d:'2026-11-18',c:102,o:null,h:null,l:null,priceBasis:'close'}]);
 assert.equal(merged[0].h,105);assert.equal(merged[0].l,98);
});
test('股_V0.6.6.1 OTC 月份資料容許欄位換順序，但仍檢查有效高低收',()=>{
 const r=parseTpexIndexMonth({stat:'ok',tables:[{fields:['收市','最低','日期','最高','開市','漲/跌'],data:[['307.55','299','2026/11/18','310','301','+3']]}]},'2026-11');
 assert.equal(r.length,1);assert.equal(r[0].c,307.55);
});
