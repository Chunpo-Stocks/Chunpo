// 股_V0.6.4 — 重試和新日期分離，避免失敗日期吃掉新回補名額。
// Pure functions, safe to test without Internet access.
export function planChipBackfill(knownDays,cursor,pending,newDayLimit=30,retryLimit=6){
  if(!Number.isInteger(newDayLimit)||newDayLimit<0||newDayLimit>60) throw Error('法人新日期回補範圍為 0～60');
  const unique=[...new Set(knownDays)].sort().reverse();
  const upper=cursor||unique[0]||null;
  const newDates=upper?unique.filter(d=>d<=upper).slice(0,newDayLimit):[];
  const retries=[...new Map((pending||[]).filter(x=>x?.date&&['上市','上櫃'].includes(x.market))
    .map(x=>[x.date+'|'+x.market,x])).values()]
    .sort((a,b)=>String(a.lastAttemptAt||'').localeCompare(String(b.lastAttemptAt||''))||a.date.localeCompare(b.date))
    .slice(0,retryLimit);
  return {newDates,retries,nextCursor:newDates.length?shiftDate(newDates.at(-1),-1):upper};
}
export function shiftDate(s,delta){return new Date(Date.parse(s+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10)}
export function recordChipResult(pending,date,market,ok,error=''){
  const key=x=>x.date===date&&x.market===market;
  const i=pending.findIndex(key);
  if(ok){if(i>=0)pending.splice(i,1);return}
  const old=i>=0?pending[i]:{date,market,attempts:0};
  const next={...old,date,market,attempts:(old.attempts||0)+1,lastAttemptAt:new Date().toISOString(),lastError:String(error).slice(0,200)};
  if(i>=0)pending[i]=next;else pending.push(next);
}
