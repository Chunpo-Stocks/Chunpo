// 整合稽核：針對中央更新後的實際公開數據，檢查日期、單位、欄位、歷史及交易計畫。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadStore,ROOT} from './build.mjs';
import {join} from 'node:path';
import {txExpired} from './market-engine.mjs';
const store=await loadStore();
const index=JSON.parse(await readFile(join(ROOT,'public/data/index.json'),'utf8'));
const plan=JSON.parse(await readFile(join(ROOT,'public/data/morning-plan.json'),'utf8'));
assert.equal(index.mode,'official');
assert.ok(index.rows.length>1500,'正式普通股資料少於1500');
for(const m of ['上市','上櫃'])assert.match(store.markets?.[m]?.date||'',/^20\d\d-\d\d-\d\d$/,'缺交易日 '+m);
assert.ok(store.marketData?.indices?.taiex?.length>=60,'加權歷史不足60日');
assert.ok(store.marketData?.indices?.otc?.length>=60,'OTC歷史不足60日');
for(const m of ['上市','上櫃'])for(const d of store.marketData?.margin?.[m]||[]){
 assert.equal(d.dateConfirmed,true,'正式融資券資料存在來源日期未核實：'+m+'/'+d.d);
}
for(const s of Object.values(store.stocks||{})){
 const bars=s.bars||[],dates=new Set();
 for(const b of bars){
   assert.ok(!dates.has(b.d),'重複日線：'+s.code+'/'+b.d);dates.add(b.d);
   assert.ok([b.o,b.h,b.l,b.c,b.v].every(Number.isFinite),'日線數值缺漏 '+s.code+'/'+b.d);
   assert.ok(b.h>=b.l&&b.c>=b.l-.06&&b.c<=b.h+.06&&b.v>=0,'日線異常 '+s.code+'/'+b.d);
 }
 for(const m of s.marginHistory||[])assert.equal(m.dateConfirmed,true,'正式個股融資券日期未核實 '+s.code+'/'+m.d);
}
const taiexDate=store.marketData.indices.taiex.at(-1).d;
const tx=store.marketData.futures;
if(tx?.contractMonth)assert.equal(txExpired(tx.contractMonth),false,'TX近月已到期不可當作有效近月');
assert.equal(plan.version,'股_V0.6.8');
assert.equal(plan.defaultMode,'any');
assert.deepEqual(plan.enabledStrategies,['stable','breakout','reversal']);
assert.equal(index.version,'股_V0.6.8.2');
assert.ok(index.dataQuality?.dealerRepair,'缺少自營商修復進度');
console.log('INTEGRITY_PASS '+JSON.stringify({version:index.version,stocks:index.rows.length,markets:store.markets,indicesDate:taiexDate,
 tx:{month:tx?.contractMonth,date:tx?.date,status:tx?.status},margin:Object.fromEntries(['上市','上櫃'].map(m=>[m,(store.marketData.margin[m]||[]).at(-1)?.d||null])),
 dealerRepair:index.dataQuality.dealerRepair,morningCandidates:plan.summary?.candidates}));
