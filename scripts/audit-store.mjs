import {loadStore} from './build.mjs';
import {txExpired} from './market-engine.mjs';
const store=await loadStore(),stocks=Object.values(store.stocks||{});
const stat={stocks:stocks.length,markets:store.markets,updatedAt:store.lastUpdated,marketIndices:{},
 stockPrice:{},institution:{},margin:{},tx:{},redFlags:[]};
for(const m of ['上市','上櫃']){
 const list=stocks.filter(s=>s.market===m);
 let dates={},badOhlc=0,duplicateDates=0,futurePrice=0,missingVolume=0,unstable=0;
 let instDates={},dealerZero=0,dealerMissing=0,dealerNonzero=0;
 let marginDates={},marginUnconfirmed=0,repeated=0;
 for(const s of list){
  let seen=new Set();const bars=s.bars||[];
  if(bars.length){const d=bars.at(-1).d;dates[d]=(dates[d]||0)+1;}
  for(const b of bars){
   if(seen.has(b.d))duplicateDates++;seen.add(b.d);
   if(![b.o,b.h,b.l,b.c].every(Number.isFinite)||b.h<b.l||b.c>b.h+.06||b.c<b.l-.06)badOhlc++;
   if(!Number.isFinite(b.v)||b.v<0)missingVolume++;
   if(b.d>'2026-11-18')futurePrice++;
  }
  const inst=s.institutions||[];
  for(const i of inst){
   instDates[i.d]=(instDates[i.d]||0)+1;
   if(i.dealer===0)dealerZero++;
   else if(typeof i.dealer!=='number'||!Number.isFinite(i.dealer))dealerMissing++;
   else dealerNonzero++;
  }
  const margin=s.marginHistory||[];
  for(let n=0;n<margin.length;n++){
   const x=margin[n];
   marginDates[x.d]=(marginDates[x.d]||0)+1;
   if(!x.dateConfirmed)marginUnconfirmed++;
   if(n&&margin[n-1].d!==x.d&&margin[n-1].margin===x.margin&&margin[n-1].short===x.short)repeated++;
  }
 }
 stat.stockPrice[m]={count:list.length,latestDateDistribution:Object.entries(dates).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8),badOhlc,duplicateDates,futurePrice,missingVolume};
 stat.institution[m]={dailyDistribution:Object.entries(instDates).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8),dealerZero,dealerMissing,dealerNonzero};
 stat.margin[m]={recentDates:Object.entries(marginDates).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8),unconfirmedSnapshots:marginUnconfirmed,exactRepeated:repeated};
 const series=store.marketData?.margin?.[m]||[];stat.margin[m].marketSummary=series.slice(-5);
}
for(const m of ['taiex','otc']){const a=store.marketData?.indices?.[m]||[];stat.marketIndices[m]={count:a.length,lastDates:a.slice(-3).map(x=>x.d),invalidOHLC:a.filter(x=>x.priceBasis==='highlow'&&![x.o,x.h,x.l,x.c].every(Number.isFinite)).length};}
const tx=store.marketData?.futures;stat.tx={month:tx?.contractMonth,date:tx?.date,status:tx?.status,expired:tx?.contractMonth?txExpired(tx.contractMonth):null,quoteCount:tx?.snapshots?.length};
stat.redFlags=[
 ...Object.entries(stat.stockPrice).filter(([k,v])=>v.badOhlc||v.duplicateDates||v.futurePrice).map(([k,v])=>'個股K線異常 '+k),
 ...Object.entries(stat.institution).filter(([k,v])=>v.dealerZero>v.dealerNonzero*5).map(([k,v])=>'自營商零值占比過高 '+k),
 ...Object.entries(stat.margin).filter(([k,v])=>v.unconfirmedSnapshots).map(([k,v])=>'未核實融資券日期 '+k),
 ...(stat.tx.expired?['TX 目前儲存的近月合約已到期']:[])
];
console.log('STORE_AUDIT '+JSON.stringify(stat));
