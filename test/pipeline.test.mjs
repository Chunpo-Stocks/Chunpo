import test from 'node:test';
import assert from 'node:assert/strict';
import {addBar,addInstitution,summary,newStore} from '../scripts/build.mjs';
const mk=(i,d)=>({code:'2330',name:'示範',market:'上市',d,o:100+i,h:102+i,l:99+i,c:101+i,v:100000+i,source:'https://openapi.twse.com.tw/test'});
test('同交易日回補不會重複添加 K 棒',()=>{const s=newStore();addBar(s,mk(1,'2026-11-17'));addBar(s,mk(2,'2026-11-17'));assert.equal(s.stocks['2330'].bars.length,1);assert.equal(s.stocks['2330'].bars[0].c,103)});
test('法人沒有同日行情則拒絕加入',()=>{const s=newStore();addBar(s,mk(1,'2026-11-17'));assert.equal(addInstitution(s,{code:'2330',d:'2026-11-16',foreign:100,trust:0}),false);assert.equal(s.stocks['2330'].institutions.length,0)});
test('少於250個交易日不會產生正式多空分數',()=>{const s=newStore();let start=Date.parse('2026-01-01T00:00:00Z');for(let i=0;i<150;i++)addBar(s,mk(i,new Date(start+i*86400000).toISOString().slice(0,10)));let row=summary(s.stocks['2330']);assert.equal(row.ready,false);assert.equal(row.bull,null);assert.equal(row.bear,null)});
test('250筆日線形成年線才會啟用評分',()=>{const s=newStore();let start=Date.parse('2025-01-01T00:00:00Z');for(let i=0;i<251;i++)addBar(s,mk(i*.01,new Date(start+i*86400000).toISOString().slice(0,10)));let row=summary(s.stocks['2330']);assert.equal(row.ready,true);assert.ok(Number.isFinite(row.ma240));assert.ok(Number.isFinite(row.bull))});
