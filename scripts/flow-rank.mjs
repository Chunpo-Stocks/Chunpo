// 股_V0.6.7 — 嚴格資料覆蓋率的法人 10/20/30/60 交易日排行與量價資金觀察代理訊號。
// 「主力觀察」僅作成交量/價格行為研究，不代表券商分點、主力持倉或主力成本。
export const RANK_WINDOWS=Object.freeze([10,20,30,60]);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const round=(n,d=3)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const netKinds=['foreign','trust'];
const cleanBars=stocks=>stocks?.bars?.filter(x=>x?.d&&Number.isFinite(x.c)&&x.c>0).slice().sort((a,b)=>a.d.localeCompare(b.d))||[];
export function rankOneStock(stock,period,marketDate){
  const bars=cleanBars(stock);
  // 上市/上櫃市場收盤日期必須一致：不讓昨日股票混入今日排行榜。
  if(!marketDate||!bars.length||bars.at(-1).d!==marketDate||bars.length<period)return null;
  const windowBars=bars.slice(-period);
  const days=new Map((stock.institutions||[]).filter(x=>x?.d).map(x=>[x.d,x]));
  const required=Math.ceil(period*.8);
  const institution={};
  for(const kind of netKinds){
    let observed=0,netShares=0,buyDays=0,weightedPrice=0,buyShares=0,latestObservedIndex=-1;
    for(let i=0;i<windowBars.length;i++){
      const b=windowBars[i],v=days.get(b.d)?.[kind];
      if(!Number.isFinite(v))continue;
      observed++;latestObservedIndex=i;netShares+=v;
      if(v>0){buyDays++;weightedPrice+=v*b.c;buyShares+=v;}
    }
    const verified=observed>=required && latestObservedIndex>=period-3;
    institution[kind]={eligible:verified,netShares:verified?netShares:null,observedDays:observed,requiredDays:required,
      buyDays:verified?buyDays:null,refPrice:verified&&buyDays>=2&&buyShares>0?round(weightedPrice/buyShares):null,
      latestInstitutionDate:latestObservedIndex>=0?windowBars[latestObservedIndex].d:null};
  }
  // 量價代理：只記錄收漲日/收跌日成交量，不能當作真正的主力買賣張數。
  // 需每一日皆有有效成交量，且有前一交易日可做收漲/收跌判別。
  const extra=bars.length>=period+1?bars.slice(-period-1):null;
  let activity=null;
  if(extra&&extra.every(b=>Number.isFinite(b.v)&&b.v>0)){
    let upVol=0,downVol=0;
    for(let i=1;i<extra.length;i++){
      if(extra[i].c>extra[i-1].c)upVol+=extra[i].v;
      if(extra[i].c<extra[i-1].c)downVol+=extra[i].v;
    }
    const decided=upVol+downVol;
    const prev=extra.slice(1,-5),recent=extra.slice(-5);
    const avg=x=>x.reduce((sum,b)=>sum+b.v,0)/x.length;
    const relVolume=prev.length?avg(recent)/avg(prev):null;
    const ret=(extra.at(-1).c/extra[0].c-1)*100;
    const score=side=>{
      const pressure=decided>0?(side==='buy'?upVol:downVol)/decided*100:50;
      const momentum=clamp(((side==='buy'?ret:-ret)+5)/20,0,1)*100;
      const anomaly=Number.isFinite(relVolume)?clamp((relVolume-0.5)/2,0,1)*100:0;
      return Math.round(0.45*pressure+0.30*anomaly+0.25*momentum);
    };
    activity={buyScore:score('buy'),sellScore:score('sell'),upVolume:upVol,downVolume:downVol,
      relVolume:round(relVolume,2),periodReturnPct:round(ret,2),method:'收漲日/收跌日量能＋近5日量比＋區間漲跌幅（不是主力實際買賣）'};
  }
  return {code:stock.code,name:stock.name,market:stock.market,date:marketDate,close:bars.at(-1).c,period,
    foreign:institution.foreign,trust:institution.trust,activity};
}
const takeTop=(arr,by,descending=true)=>arr.sort((a,b)=>descending?by(b)-by(a):by(a)-by(b)).slice(0,30);
export function makeFlowRankings(stocks,markets,periods=RANK_WINDOWS){
  const list=Array.isArray(stocks)?stocks:Object.values(stocks||{});
  const result={version:'股_V0.6.7',periods:[...periods],byPeriod:{},method:'外資/投信以官方盤後淨買賣超股數排序；主力觀察僅是未辨識分點的量價代理指標。'};
  for(const period of periods){
    const ranked=list.map(s=>rankOneStock(s,period,markets?.[s.market]?.date)).filter(Boolean);
    const kinds={};
    for(const kind of netKinds){
      const eligible=ranked.filter(x=>x[kind].eligible);
      kinds[kind]={eligible:eligible.length,insufficient:ranked.length-eligible.length,
        buy:takeTop(eligible.filter(x=>x[kind].netShares>0),x=>x[kind].netShares),
        sell:takeTop(eligible.filter(x=>x[kind].netShares<0),x=>-x[kind].netShares)};
    }
    const valid=ranked.filter(x=>x.activity);
    kinds.activity={eligible:valid.length,insufficient:ranked.length-valid.length,
      buy:takeTop([...valid],x=>x.activity.buyScore),sell:takeTop([...valid],x=>x.activity.sellScore)};
    result.byPeriod[period]={period,marketDates:{上市:markets?.['上市']?.date??null,上櫃:markets?.['上櫃']?.date??null},
      stocksWithPeriod:ranked.length,...kinds};
  }
  return result;
}
