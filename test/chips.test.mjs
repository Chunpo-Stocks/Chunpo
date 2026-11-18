import test from 'node:test';
import assert from 'node:assert/strict';
import {institutionalWindows} from '../engine.mjs';
import {newStore,addBar,addInstitution,summary} from '../scripts/build.mjs';
const days=Array.from({length:65},(_,i)=>{let d=new Date(Date.UTC(2026,5,1+i));return d.toISOString().slice(0,10)});
const bars=days.map((d,i)=>({d,c:40+i/10,o:40,h:50,l:35,v:100000,code:'2330',name:'股票',market:'上市'}));
const stock=(n,kind='foreign')=>({code:'2330',name:'股票',market:'上市',bars,institutions:days.slice(-n).map((d,i)=>({d,[kind]:i%3?12000:-3000,trust:i%2?-5000:2000,dealer:500}))});
test('法人5/20/60日必須有實際日期覆蓋，不能把3天當20天',()=>{
 const z=institutionalWindows(stock(3)).windows;
 assert.equal(z[0].categories.foreign.covered,false);
 assert.equal(z[1].categories.foreign.netShares,null);
 assert.equal(z[2].categories.foreign.netBuyCloseReference,null);
});
test('法人5/20/60日淨買賣超單位維持股，參考價非持股成本',()=>{
 const z=institutionalWindows(stock(65));
 assert.equal(z.windows[1].categories.foreign.covered,true);
 assert.equal(z.windows[2].categories.foreign.covered,true);
 assert.ok(z.windows[1].categories.foreign.netBuyCloseReference>40);
 assert.match(z.disclaimer,/不是實際成交價或持股成本/);
 assert.equal(z.daily.length,30);
});
test('法人資料有缺日期時不應補0或虛構累積',()=>{
 const s=stock(65); s.institutions=s.institutions.filter((_,i)=>i%2===0);
 const q=institutionalWindows(s).windows[1].categories.foreign;
 assert.equal(q.covered,false);assert.equal(q.netShares,null);
});
test('既有 store 股票資料不清空，原資料可併入法人新日數',()=>{
 let store=newStore();bars.forEach(b=>addBar(store,b));
 addInstitution(store,{code:'2330',d:bars.at(-1).d,foreign:1234,trust:100,dealer:-50});
 assert.equal(store.stocks['2330'].bars.length,65);
 assert.equal(store.stocks['2330'].institutions.length,1);
 assert.equal(institutionalWindows(store.stocks['2330']).windows[1].categories.foreign.netShares,null);
 const d=summary(store.stocks['2330']);assert.equal(d.foreignNet5,null);
});
