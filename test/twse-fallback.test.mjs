import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseTwseFallbackDate,validateTwseDaily,validateTpexDaily} from '../scripts/twse-fallback.mjs';
const markets={上市:{date:'2026-11-17'},上櫃:{date:'2026-11-18'}};
const fieldNames=['證券代號','證券名稱','成交股數','開盤價','最高價','最低價','收盤價'];
const table=d=>({date:d.replaceAll('-',''),stat:'OK',tables:[{fields:fieldNames,data:Array.from({length:520},(_,i)=>[String(1100+i),'測試公司'+i,'1,200,000','50.00','51.00','49.00','50.50'])}]});
test('僅在上市落後於同日已確認上櫃時選擇補抓日期',()=>{
 assert.equal(chooseTwseFallbackDate(markets,'2026-11-18'),'2026-11-18');
 assert.equal(chooseTwseFallbackDate({上市:{date:'2026-11-18'},上櫃:{date:'2026-11-18'}},'2026-11-18'),null);
 assert.equal(chooseTwseFallbackDate({上市:{date:'2026-11-17'},上櫃:{date:'2026-11-19'}},'2026-11-18'),null);
});
test('證交所指定日期有效日線，需 500 檔以上並保留官方日期、來源',()=>{
 const rows=validateTwseDaily(table('2026-11-18'),'2026-11-18');
 assert.equal(rows.length,520);
 assert.equal(rows[0].d,'2026-11-18');
 assert.match(rows[0].source,/MI_INDEX/);
});
test('來源日期錯誤、未識別格式、資料過少全部拒絕寫入',()=>{
 assert.throws(()=>validateTwseDaily(table('2026-11-17'),'2026-11-18'));
 assert.throws(()=>validateTwseDaily({stat:'OK'},'2026-11-18'));
 assert.throws(()=>validateTwseDaily({date:'20261118',stat:'OK',fields:fieldNames,data:[['2330','台積電','1000000','100','101','99','100']]},'2026-11-18'),/門檻/);
});

test('盤後當日上市落後，即使上櫃 API 逾時仍可嘗試官方指定日期，但非官方資料不得寫入',()=>{
 assert.equal(chooseTwseFallbackDate({上市:{date:'2026-11-18',status:'ok'},上櫃:{date:'2026-11-18',status:'error'}},'2026-11-19',{afterClose:true}),'2026-11-19');
 assert.equal(chooseTwseFallbackDate({上市:{date:'2026-11-18'},上櫃:{date:'2026-11-18',status:'error'}},'2026-11-19',{afterClose:false}),null);
 assert.equal(chooseTwseFallbackDate({上市:{date:'2026-11-20'},上櫃:{date:'2026-11-20'}},'2026-11-21',{afterClose:true}),null);
 assert.throws(()=>validateTwseDaily({date:'20261118',stat:'OK'},'2026-11-19'));
});
test('上櫃指定日需官方日期與有效股數足夠，不能把舊日行情冒充今日',()=>{
 const rows=validateTpexDaily(table('2026-11-19'),'2026-11-19');
 assert.equal(rows.length,520);
 assert.equal(rows[0].market,'上櫃');
 assert.throws(()=>validateTpexDaily(table('2026-11-18'),'2026-11-19'));
 assert.throws(()=>validateTpexDaily({date:'20261119',stat:'OK'},'2026-11-19'));
});
