// 股_V0.6.8 — 07:00 盤前條件式交易計畫（純計算，不抓取盤中行情或下單）
// 所有價格都是由已保存且有來源日期的日線推導，無法驗證時回傳 null。
import {summary} from './build.mjs';
export const MORNING_STRATEGIES = Object.freeze([
 {id:'stable',name:'穩健型',threshold:80},
 {id:'breakout',name:'突破型',threshold:85},
 {id:'reversal',name:'反轉型',threshold:75}
]);
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const r2=x=>num(x)===null?null:Math.round(x*100)/100;
const D=s=>new Date(s+'T00:00:00Z');
const shift=s=>new Date(D(s).getTime()+86400000).toISOString().slice(0,10);
function nextWeekday(s){let d=shift(s);while([0,6].includes(D(d).getUTCDay()))d=shift(d);return d;}
function tick(v){return v<10?.01:v<50?.05:v<100?.1:v<500?.5:v<1000?1:5;}
function align(v,mode){if(num(v)===null||v<=0)return null;const unit=tick(v),n=v/unit;return r2((mode==='up'?Math.ceil(n-1e-8):Math.floor(n+1e-8))*unit);}
function extrema(bars,field){const v=bars.map(x=>num(x[field])).filter(x=>x!==null&&x>0);return v.length===bars.length?(field==='l'?Math.min(...v):Math.max(...v)):null;}
const length=x=>Array.isArray(x)?x.length:0;
function levels(bars,side,ma20){
 if(bars.length<60)return null;
 const cur=bars.at(-1);const prev20=bars.slice(-21,-1);const last10=bars.slice(-10),last60=bars.slice(-60);
 const high20=extrema(prev20,'h'),low20=extrema(prev20,'l'),high60=extrema(last60,'h'),low60=extrema(last60,'l');
 const localLow=extrema(last10,'l'),localHigh=extrema(last10,'h');
 if([high20,low20,high60,low60,localLow,localHigh,num(cur.c)].some(x=>x===null))return null;
 const up=side==='bull',c=cur.c;
 // 回踩區和突破觸發價分開；停損必須是有歷史依據的失效線。
 const anchor=ma20&&ma20>0?ma20:c;
 const entryCenter=up?Math.min(c,Math.max(localLow,anchor)):Math.max(c,Math.min(localHigh,anchor));
 const entryLow=align(Math.max(.01,entryCenter*(up?.995:.992)),'down');
 const entryHigh=align(entryCenter*(up?1.008:1.005),'up');
 const trigger=up?align(high20+tick(high20),'up'):align(low20-tick(low20),'down');
 const stop=up?align(Math.min(localLow,anchor)-tick(Math.min(localLow,anchor)),'down')
   :align(Math.max(localHigh,anchor)+tick(Math.max(localHigh,anchor)),'up');
 const span=high60-low60;
 const extension=up?align(low60+1.272*span,'up'):align(high60-1.272*span,'down');
 const firstHistorical=up?(high60>entryHigh?align(high60,'down'):null):(low60<entryLow?align(low60,'up'):null);
 const target1=firstHistorical??(extension&&(up?extension>entryHigh:extension<entryLow)?extension:null);
 const target2=up?align(low60+1.618*span,'up'):align(high60-1.618*span,'down');
 const entry=up?entryHigh:entryLow;
 const risk=up?entry-stop:stop-entry;
 const reward=target1===null?null:(up?target1-entry:entry-target1);
 const rr=risk>0&&reward!==null&&reward>0?r2(reward/risk):null;
 if(![entryLow,entryHigh,trigger,stop].every(x=>x!==null)||entryLow>entryHigh||risk<=0)return null;
 return {entryLow,entryHigh,breakout:trigger,stop,target1,target2:target2&&(up?target2>entry:target2<entry)?target2:null,
  rr,stopPct:r2(risk/entry*100),targetMethod:firstHistorical?'過去60日極值':'60日區間斐波1.272延伸',referenceClose:c};
}
function features(s,marketDate){
 const bars=(s.bars||[]).filter(x=>x&&x.d&&num(x.c)!==null&&x.c>0).sort((a,b)=>a.d.localeCompare(b.d));
 if(bars.length<60||bars.at(-1).d!==marketDate)return null;
 const last=bars.at(-1),prev=bars.at(-2),twenty=bars.slice(-20);
 if(!prev||!twenty.every(x=>num(x.v)!==null&&x.v>=0))return null;
 const avg20=twenty.reduce((a,b)=>a+b.v,0)/20;
 const volumeRatio=avg20>0?last.v/avg20:null;
 const last3=bars.slice(-3).map(x=>x.d);
 const inst=(s.institutions||[]).filter(x=>last3.includes(x.d)).sort((a,b)=>b.d.localeCompare(a.d));
 const instLatest=inst[0]||null;
 const chipNet=instLatest&&(num(instLatest.foreign)!==null||num(instLatest.trust)!==null)?
  (num(instLatest.foreign)??0)+(num(instLatest.trust)??0):null;
 const r=summary(s);
 if(!r||!['full','preliminary'].includes(r.scoreMode))return null;
 return {r,bars,last,prev,avg20,volumeRatio,chipNet,chipDate:instLatest?.d??null};
}
function pickCandidate(stock,side,kind,threshold,marketDate){
 const f=features(stock,marketDate);if(!f)return null;
 const {r,bars,last,prev,avg20,volumeRatio,chipNet,chipDate}=f;
 const score=side==='bull'?r.bull:r.bear;
 if(num(score)===null||score<threshold||avg20<800000)return null; // 至少約 800 張平均成交量（來源為股）
 const up=side==='bull';
 const ma20=num(r.ma20),ma60=num(r.ma60),rsi=num(r.rsi), macd=num(r.macdHist);
 if([ma20,ma60,rsi,macd].some(x=>x===null))return null;
 const levelsData=levels(bars,side,ma20);if(!levelsData)return null;
 let matched=false;
 let reasons=[];
 if(kind==='stable'){
   matched=up?(last.c>=ma20&&ma20>=ma60&&rsi>=45&&chipNet!==null&&chipNet>0):
      (last.c<=ma20&&ma20<=ma60&&rsi<=55&&chipNet!==null&&chipNet<0);
   if(matched)reasons=[up?'收盤高於MA20且MA20≥MA60':'收盤低於MA20且MA20≤MA60',up?'近期外資＋投信淨買超':'近期外資＋投信淨賣超'];
 }else if(kind==='breakout'){
   const resistance=extrema(bars.slice(-21,-1),up?'h':'l');
   matched=resistance!==null&&volumeRatio!==null&&volumeRatio>=1.2&&
     (up?(last.c>=resistance*.96&&last.c<=resistance*1.08):(last.c<=resistance*1.04&&last.c>=resistance*.92));
   if(matched)reasons=[up?'價格接近20日高點或剛突破':'價格接近20日低點或剛跌破','最新成交量／20日均量≥1.2；尚待當日確認'];
 }else if(kind==='reversal'){
   const ids=new Set((r.pattern||[]).filter(p=>p.side===(up?'bull':'bear')).map(x=>x.id));
   const matchedPattern=up?['W','V','ROUND'].some(x=>ids.has(x)):['M','IV','ROUNDTOP'].some(x=>ids.has(x));
   matched=matchedPattern&&(up?rsi>=38&&rsi<=70&&macd>=-5:rsi>=30&&rsi<=65&&macd<=5);
   if(matched)reasons=[up?'W／V／圓弧底候選型態':'M／倒V／圓弧頂候選型態','RSI、MACD條件符合；型態尚待確認'];
 }
 if(!matched)return null;
 return {code:r.code,name:r.name,market:r.market,side,kind,score,date:r.date,close:r.close,scoreMode:r.scoreMode,
  chipDate,volumeRatio:r2(volumeRatio),reasons,...levelsData, riskLabel:levelsData.rr===null?'無可驗證獲利目標':levelsData.rr<2?'風報比不足2:1；暫不追價':'條件待開盤確認',
  note:'僅盤前條件式情境。尚未取得今日成交、跳空與量能確認；不是即時買賣指令。'};
}
export function createMorningPlan(store,{generatedAt=new Date().toISOString()}={}){
 const marketDates=Object.fromEntries(['上市','上櫃'].map(m=>[m,store.markets?.[m]?.status==='ok'?store.markets[m].date:null]));
 const dates=Object.values(marketDates).filter(Boolean).sort();
 const latest=dates.at(-1)||null;
 const targetDate=latest?nextWeekday(latest):null;
 const out={version:'股_V0.6.8',generatedAt,targetDate,referenceDates:marketDates,defaultMode:'any',
  enabledStrategies:['stable','breakout','reversal'],strategies:MORNING_STRATEGIES,
  sourceMode:'official-daily-close',timeNote:'07:00 盤前條件式觀察；尚未開盤，不確認觸發或成交。交易日為週一至週五暫估，國定休市需以交易所日曆核對。',
  summary:{eligibleStocks:0,candidates:0},bySide:{bull:{stable:[],breakout:[],reversal:[],combined:[]},bear:{stable:[],breakout:[],reversal:[],combined:[]}},warnings:[]};
 if(!latest){out.warnings.push('沒有有效的上市／上櫃官方盤後日期，不能產生計畫。');return out;}
 if(marketDates['上市']!==marketDates['上櫃'])out.warnings.push('上市與上櫃資料日不同，分市場計算並顯示來源日期。');
 const lists={bull:new Map(),bear:new Map()};
 const source=Object.values(store.stocks||{});
 for(const s of source){
   const d=marketDates[s.market];if(!d)continue;
   const f=features(s,d);if(!f)continue;
   out.summary.eligibleStocks++;
   for(const side of ['bull','bear'])for(const st of MORNING_STRATEGIES){
     const x=pickCandidate(s,side,st.id,st.threshold,d);if(!x)continue;
     out.bySide[side][st.id].push(x);
     const old=lists[side].get(x.code);
     if(old){old.matchedStrategies.push(st.id);old.bestScore=Math.max(old.bestScore,x.score);}
     else lists[side].set(x.code,{...x,matchedStrategies:[st.id],bestScore:x.score});
   }
 }
 for(const side of ['bull','bear']){
   for(const st of MORNING_STRATEGIES){
     out.bySide[side][st.id].sort((a,b)=>b.score-a.score || (b.rr??-1)-(a.rr??-1)||a.code.localeCompare(b.code));
     out.bySide[side][st.id]=out.bySide[side][st.id].slice(0,10);
   }
   out.bySide[side].combined=[...lists[side].values()]
     .sort((a,b)=>b.matchedStrategies.length-a.matchedStrategies.length||b.bestScore-a.bestScore||a.code.localeCompare(b.code))
     .slice(0,10);
   out.summary.candidates+=lists[side].size;
 }
 return out;
}
