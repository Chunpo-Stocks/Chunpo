import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankOneStock,makeFlowRankings,RANK_WINDOWS} from '../scripts/flow-rank.mjs';
const market={上市:{date:'2026-11-18'},上櫃:{date:'2026-11-18'}};
const dates=Array.from({length:70},(_,i)=>new Date(Date.UTC(2026,7,1+i)).toISOString().slice(0,10));
// Synthetic sequences: explicit synthetic test, including weekends, only as internal deterministic unit-test anchors.
const latest=dates.at(-1);
const markets={上市:{date:latest},上櫃:{date:latest}};
function stock(code,market='上市',days=70,base=5){
 const ds=dates.slice(-days);
 const bars=ds.map((d,i)=>({d,c:base+i*0.2,v:1000+i*9}));
 const institutions=ds.map((d,i)=>({d,foreign:10_000+i*10,trust:(i%3===0?-1000:8000),dealer:0}));
 return {code,name:'測試'+code,market,bars,institutions};
}
test('四組期間固定為10/20/30/60交易日',()=>assert.deepEqual(RANK_WINDOWS,[10,20,30,60]));
test('10/20/30/60 全期可依真實觀測股數計算，不會當成名次',()=>{
 const x=stock('1234');const z=makeFlowRankings([x],markets);
 for(const w of RANK_WINDOWS){const d=z.byPeriod[w];assert.equal(d.stocksWithPeriod,1);assert.equal(d.foreign.buy[0].code,'1234');assert.ok(d.foreign.buy[0].foreign.observedDays>=w*.8);}
});
test('缺失法人不當作零：覆蓋率低於80%便不進法人排行',()=>{
 const x=stock('1234');x.institutions=x.institutions.slice(-4);
 const z=makeFlowRankings([x],markets);
 assert.equal(z.byPeriod[20].foreign.eligible,0);assert.equal(z.byPeriod[20].foreign.buy.length,0);
 assert.equal(z.byPeriod[20].activity.buy.length,1);
});
test('法人即使八成涵蓋、若只剩過期資料也不排名',()=>{
 const x=stock('1234');x.institutions=x.institutions.slice(0,-4);
 assert.equal(rankOneStock(x,20,latest).foreign.eligible,false);
});
test('沒有最新市場合格日期的舊股不混入排行',()=>{
 const x=stock('1234');x.bars=x.bars.slice(0,-1);
 const z=makeFlowRankings([x],markets);assert.equal(z.byPeriod[20].stocksWithPeriod,0);
});
test('買超、賣超各自排序；法人不把零值偽裝買超',()=>{
 const a=stock('1111'),b=stock('2222');
 b.institutions=b.institutions.map(x=>({...x,foreign:-50000}));
 const z=makeFlowRankings([a,b],markets).byPeriod[10].foreign;
 assert.deepEqual(z.buy.map(x=>x.code),['1111']);assert.deepEqual(z.sell.map(x=>x.code),['2222']);
});
test('參考價是買超日加權收盤值，不被標示為實際持倉成本',()=>{
 const x=rankOneStock(stock('1234'),20,latest).foreign;
 assert.ok(Number.isFinite(x.refPrice));assert.ok(x.refPrice>0);
});
test('成交量缺失不產生主力觀察代理分數',()=>{
 const x=stock('1234');x.bars.at(-1).v=null;
 const z=makeFlowRankings([x],markets);assert.equal(z.byPeriod[20].activity.buy.length,0);
});
test('歷史未滿60日時不生成60日排行榜',()=>{
 const x=stock('1234','上市',25);const z=makeFlowRankings([x],markets);
 assert.equal(z.byPeriod[60].stocksWithPeriod,0);assert.equal(z.byPeriod[20].stocksWithPeriod,1);
});
