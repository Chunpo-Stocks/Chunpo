import test from 'node:test';
import assert from 'node:assert/strict';
import {summary,newStore,addBar} from '../scripts/build.mjs';
function stockWith(n){const s=newStore();for(let i=0;i<n;i++){
 const d=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
 const c=75+(i%15)*0.3+i*0.045;
 addBar(s,{code:'2330',name:'測試樣本',market:'上市',d,o:c-0.2,h:c+0.9,l:c-0.7,c,v:100000+i*21,source:'https://example.org/test'});
 }return summary(s.stocks['2330']);}
test('少於60日拒絕評分',()=>{let r=stockWith(59);assert.equal(r.scoreMode,'insufficient');assert.equal(r.bull,null);assert.equal(r.ma240,null)});
test('60日啟用初步觀察且不造年線',()=>{let r=stockWith(60);assert.equal(r.scoreMode,'preliminary');assert.equal(r.ready,false);assert.equal(r.ma240,null);assert.ok(Number.isFinite(r.bull));assert.ok(Number.isFinite(r.bear));assert.ok(r.bull<=100&&r.bear<=100)});
test('97日啟用初步觀察，不混充250日年線',()=>{let r=stockWith(97);assert.equal(r.scoreMode,'preliminary');assert.equal(r.days,97);assert.equal(r.ma240,null)});
test('250日具有完整版條件',()=>{let r=stockWith(250);assert.equal(r.scoreMode,'full');assert.equal(r.ready,true);assert.ok(Number.isFinite(r.ma240))});
