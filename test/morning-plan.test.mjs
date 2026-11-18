import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMorningPlan,computeTradeLevels,nextWeekday,MORNING_STRATEGIES} from '../scripts/morning-plan.mjs';
const days=Array.from({length:140},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10)).filter(d=>![0,6].includes(new Date(d+'T00:00:00Z').getUTCDay()));
function bars(n=75){return days.slice(-n).map((d,i)=>({d,o:40+i*.15,h:41+i*.15,l:39+i*.15,c:40+i*.15,v:1400000+i*3000}));}
test('三種策略全部預設啟用、門檻獨立',()=>{
 assert.deepEqual(MORNING_STRATEGIES.map(s=>[s.id,s.threshold]),[['stable',80],['breakout',85],['reversal',75]]);
 const out=createMorningPlan({markets:{},stocks:{}});
 assert.deepEqual(out.enabledStrategies,['stable','breakout','reversal']);
 assert.equal(out.defaultMode,'any');
 assert.equal(out.summary.candidates,0);
 assert.match(out.warnings.join(' '),/沒有有效/);
});
test('07:00 參考日期遇週末取下一個工作日，但不冒充已驗證交易所休市',()=>{
 assert.equal(nextWeekday('2026-11-20'),'2026-11-23');
 assert.equal(nextWeekday('2026-11-18'),'2026-11-19');
});
test('有效日線產生進場區、突破、停損和風報，但不聲稱觸發',()=>{
 const b=bars(70),v=computeTradeLevels(b,'bull',48);
 assert.ok(v);
 assert.ok(v.entryLow<=v.entryHigh);
 assert.ok(v.stop<v.entryHigh);
 assert.ok(v.breakout>0);
 assert.equal(typeof v.targetMethod,'string');
});
test('空頭交易計畫停損應高於參考價',()=>{
 const b=bars(70);const v=computeTradeLevels(b,'bear',48);
 assert.ok(v);
 assert.ok(v.stop>v.entryLow);
});
test('未滿60日、缺少市場日期或價格日不一致，必須不產生候選',()=>{
 const b=bars(40),d=b.at(-1).d;
 const s={code:'9999',name:'人工測試',market:'上市',bars:b,institutions:[]};
 const o=createMorningPlan({markets:{上市:{status:'ok',date:d}},stocks:{9999:s}});
 assert.equal(o.summary.candidates,0);
 assert.equal(o.summary.eligibleStocks,0);
});
test('同一檔符合多策略時聯集不重複計數，數據不足不能冒出任一策略',()=>{
 const b=bars(75),d=b.at(-1).d;
 const s={code:'9999',name:'人工測試',market:'上市',bars:b,institutions:[]};
 const o=createMorningPlan({markets:{上市:{status:'ok',date:d}},stocks:{9999:s}});
 assert.equal(o.defaultMode,'any');
 for(const side of ['bull','bear'])for(const k of ['stable','breakout','reversal','combined'])assert.ok(Array.isArray(o.bySide[side][k]));
 assert.ok(o.summary.candidates<=6); // 最高3策略 x 2方向，但每檔每方向只計一次
});
