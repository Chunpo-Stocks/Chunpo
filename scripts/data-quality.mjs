// 股_V0.6.8.2 資料品質清理：不刪除可信的歷史行情，將無來源日期的舊融資券隔離。
export function quarantineUndatedTwseMargin(store){
 const m=store.marketData??={};m.indices??={};m.margin??={};m.marginDetails??={};m.sourceStatus??={};
 m.quarantine??={};
 let removed=0;
 const list=m.margin['上市']||[];
 const bad=list.filter(x=>x?.dateConfirmed!==true);
 if(bad.length){m.quarantine.twseMarginSummary??=[];m.quarantine.twseMarginSummary.push(...bad);removed+=bad.length;}
 m.margin['上市']=list.filter(x=>x?.dateConfirmed===true);
 const details=m.marginDetails['上市']||{};
 const quarantined=m.quarantine.twseMarginDetails??={};
 for(const [d,items] of Object.entries(details)){
  const badRows=(items||[]).filter(x=>x?.dateConfirmed!==true);
  if(badRows.length){quarantined[d]=badRows;removed+=badRows.length;}
  const good=(items||[]).filter(x=>x?.dateConfirmed===true);
  if(good.length)details[d]=good;else delete details[d];
 }
 for(const s of Object.values(store.stocks||{})){
  if(s.market!=='上市')continue;
  const old=s.marginHistory||[];
  const badRows=old.filter(x=>x?.dateConfirmed!==true);
  if(badRows.length)removed+=badRows.length;
  s.marginHistory=old.filter(x=>x?.dateConfirmed===true);
 }
 return removed;
}
export function invalidateLegacyTwseDealer(store){
 store.dealerRepair??={verifiedDates:[],errors:[],updatedAt:null};
 store.dealerRepair.verifiedDates??=[];
 const verified=new Set(store.dealerRepair.verifiedDates);
 let invalidated=0;
 for(const s of Object.values(store.stocks||{})){
  if(s.market!=='上市')continue;
  for(const item of s.institutions||[]){
   if(verified.has(item.d))continue;
   if(item.dealer===0){item.dealer=null;invalidated++;}
  }
 }
 return invalidated;
}
export function listedDealerPendingDates(store){
 const valid=new Set(store.dealerRepair?.verifiedDates||[]);
 const dates=new Set();
 for(const s of Object.values(store.stocks||{})){
  if(s.market!=='上市')continue;
  for(const item of s.institutions||[])if(item.dealer===null&&!valid.has(item.d))dates.add(item.d);
 }
 return [...dates].sort().reverse();
}
