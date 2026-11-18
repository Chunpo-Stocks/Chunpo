// 股_V0.6.2 — pure parsing, indicators and pattern heuristics. No real-trade-price claims.
export const SOURCES = Object.freeze({
  twsePrice:'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
  tpexPrice:'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes',
  twseInst:'https://www.twse.com.tw/rwd/zh/fund/T86?response=json&date={date}&selectType=ALLBUT0999',
  tpexInst:'https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading',
  tpexInstHistory:'https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade?type=Daily&sect=EW&date={date}&id=&response=json',
  twseHistory:'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?response=json&date={date}&type=ALLBUT0999',
  tpexHistory:'https://www.tpex.org.tw/www/zh-tw/afterTrading/otc?date={yyyy}%2F{mm}%2F{dd}&type=EW&response=json'
});
export function num(x) {
  if (typeof x === 'number') return Number.isFinite(x) ? x : NaN;
  const s=String(x??'').replace(/<[^>]+>/g,'').replace(/[\s,＋+]/g,'').trim();
  if(!s || /^(--?|N\/A|除權|除息|不適用)$/i.test(s)) return NaN;
  if(/^\(?-?\d+(\.\d+)?\)?$/.test(s)) return Number(s.replace(/[()]/g,'')) * (s[0]==='('? -1:1);
  return NaN;
}
export function isoDate(x) {
  let s=String(x??'').trim();let m=s.match(/^(\d{3})(\d{2})(\d{2})$/);
  if(m) return `${Number(m[1])+1911}-${m[2]}-${m[3]}`;
  m=s.match(/^(20\d{2})(\d{2})(\d{2})$/);if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{2,4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
  if(!m)return '';let y=+m[1];if(y<1911)y+=1911;
  return `${y}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
}
export const ordinary=(s,name='')=>/^[1-9]\d{3}$/.test(String(s).trim())&&!/^91\d\d$/.test(String(s))&&!/ETF|ETN|TDR|特別股|存託憑證|權證|受益證券|可轉換|牛證|熊證/.test(String(name));
const norm=s=>String(s??'').replace(/<[^>]*>/g,'').replace(/[\s()（）\-_:：]/g,'').trim();
export function pick(o,options) {if(!o||typeof o!=='object')return undefined;let dict=Object.keys(o);let opts=options.map(norm);let k=dict.find(k=>opts.includes(norm(k)));return k===undefined?undefined:o[k]}
function bar(code,name,market,date,o,h,l,c,v,source){
  code=String(code??'').trim();name=String(name??'').trim();date=isoDate(date);
  o=num(o);h=num(h);l=num(l);c=num(c);v=num(v);
  if(!ordinary(code,name)||!date||![o,h,l,c,v].every(Number.isFinite)||c<=0||h<l||v<0||o<l-.06||o>h+.06||c<l-.06||c>h+.06)return null;
  return {code,name,market,d:date,o,h,l,c,v,source};
}
export function parseTwseLatest(rows){
  if(!Array.isArray(rows))throw Error('TWSE STOCK_DAY_ALL 並非 JSON 陣列');
  return rows.map(r=>bar(r.Code,r.Name,'上市',r.Date,r.OpeningPrice,r.HighestPrice,r.LowestPrice,r.ClosingPrice,r.TradeVolume,SOURCES.twsePrice)).filter(Boolean);
}
export function parseTpexLatest(rows){
  if(!Array.isArray(rows))throw Error('TPEx 行情並非 JSON 陣列');
  return rows.map(r=>bar(pick(r,['SecuritiesCompanyCode','SecurityCode','Code']),pick(r,['CompanyName','SecuritiesCompanyName','Name','SecurityName']),'上櫃',pick(r,['Date','TradingDate']),pick(r,['Open','OpeningPrice']),pick(r,['High','HighestPrice']),pick(r,['Low','LowestPrice']),pick(r,['Close','ClosingPrice']),pick(r,['TradingShares','TradeVolume','Volume']),SOURCES.tpexPrice)).filter(Boolean);
}
export function namedTables(d){
  const a=[];if(!d||typeof d!=='object')return a;
  for(const k of Object.keys(d)){
    if(!/^fields\d*$/.test(k)||!Array.isArray(d[k]))continue;
    const suffix=k.slice(6);const rows=d['data'+suffix];if(Array.isArray(rows))a.push({fields:d[k],rows});
  }
  if(Array.isArray(d.fields)&&Array.isArray(d.data)&&!a.some(t=>t.fields===d.fields&&t.rows===d.data))a.push({fields:d.fields,rows:d.data});
  if(Array.isArray(d.tables))for(const t of d.tables)if(Array.isArray(t.fields)&&Array.isArray(t.data))a.push({fields:t.fields,rows:t.data});
  return a;
}
function idx(fields,choices){return fields.findIndex(k=>choices.some(a=>k===a||k.includes(a)))}
export function parseHistory(d,market,date){
  if(d?.date && isoDate(d.date) && isoDate(d.date)!==date)throw Error('歷史來源日期不符');
  if(d?.stat && /失敗|頻繁|忙碌|error|fail/i.test(d.stat))throw Error('官方回應：'+d.stat);
  const url=market==='上市'?SOURCES.twseHistory.replace('{date}',date.replaceAll('-','')):SOURCES.tpexHistory.replace('{yyyy}',date.slice(0,4)).replace('{mm}',date.slice(5,7)).replace('{dd}',date.slice(8,10));
  const results=[];
  for(const t of namedTables(d)){
    const f=t.fields.map(norm);
    const ii={code:idx(f,['證券代號','股票代號','代號']),name:idx(f,['證券名稱','股票名稱','名稱']),o:idx(f,['開盤價','開盤']),h:idx(f,['最高價','最高']),l:idx(f,['最低價','最低']),c:idx(f,['收盤價','收盤']),v:idx(f,['成交股數','成交股數仟股','成交股數千股'])};
    if(Object.values(ii).some(v=>v<0))continue;
    let out=[];
    for(const row of t.rows){if(!Array.isArray(row))continue;
      let vol=row[ii.v];if(/仟股|千股/.test(f[ii.v]))vol=num(vol)*1000;
      let r=bar(row[ii.code],row[ii.name],market,date,row[ii.o],row[ii.h],row[ii.l],row[ii.c],vol,url);
      if(r)out.push(r);
    }
    results.push(out);
  }
  return results.sort((a,b)=>b.length-a.length)[0]||[];
}
export function parseTwseInst(payload,date){
  const out=[];
  for(const t of namedTables(payload)){
    let f=t.fields.map(norm);const code=idx(f,['證券代號','股票代號']);
    const foreign=idx(f,['外陸資買賣超股數(不含外資自營商)','外陸資買賣超股數']);
    const trust=idx(f,['投信買賣超股數']);
    const dealer=idx(f,['自營商買賣超股數','自營商買賣超股數(自行買賣)']);
    if(code<0||foreign<0||trust<0)continue;
    for(const r of t.rows){if(!Array.isArray(r))continue;let s=String(r[code]??'').trim();if(!ordinary(s))continue;
      out.push({code:s,d:date,foreign:num(r[foreign]),trust:num(r[trust]),dealer:dealer>=0?num(r[dealer]):null,source:SOURCES.twseInst.replace('{date}',date.replaceAll('-',''))});
    }
  }
  return out;
}
export function parseTpexInst(rows){
  if(!Array.isArray(rows))throw Error('TPEx 三大法人格式錯誤');
  return rows.map(r=>({
    code:String(pick(r,['SecuritiesCompanyCode','SecurityCode','Code'])??'').trim(),
    d:isoDate(pick(r,['Date','TradingDate'])),
    foreign:num(pick(r,['ForeignInvestorsIncludeMainlandAreaInvestors-Difference','ForeignInvestorsIncludeMainlandAreaInvestorsDifference','ForeignInvestorsIncludeMainlandAreaInvestors-Difference'])),
    trust:num(pick(r,['SecuritiesInvestmentTrustCompanies-Difference'])),
    dealer:num(pick(r,['Dealers-Difference'])), source:SOURCES.tpexInst
  })).filter(x=>ordinary(x.code)&&x.d&&[x.foreign,x.trust].every(Number.isFinite));
}
const SMA=(a,n,i=a.length-1)=>i>=n-1?a.slice(i-n+1,i+1).reduce((s,v)=>s+v,0)/n:null;
const average=a=>a.reduce((s,x)=>s+x,0)/a.length;
function emaSeries(a,n){let out=[],v=null;const k=2/(n+1);for(let i=0;i<a.length;i++){if(i===n-1)v=average(a.slice(0,n));else if(i>=n)v=v+k*(a[i]-v);out.push(v)}return out}
function macd(cl){if(cl.length<36)return {dif:null,signal:null,hist:null,prev:null};let a=emaSeries(cl,12),b=emaSeries(cl,26),di=a.map((v,i)=>v===null||b[i]===null?null:v-b[i]);let ds=di.filter(v=>v!==null);let es=emaSeries(ds,9);let last=di.at(-1),sig=es.at(-1),prev=di.at(-2)-es.at(-2);return {dif:last,signal:sig,hist:last-sig,prev}}
function rsi(cl,n=14){if(cl.length<=n)return null;let g=0,l=0;for(let i=1;i<=n;i++){let diff=cl[i]-cl[i-1];g+=Math.max(diff,0);l+=Math.max(-diff,0)}g/=n;l/=n;for(let i=n+1;i<cl.length;i++){let diff=cl[i]-cl[i-1];g=(g*(n-1)+Math.max(diff,0))/n;l=(l*(n-1)+Math.max(-diff,0))/n}return l===0?(g===0?50:100):100-100/(1+g/l)}
function kd(bs){if(bs.length<9)return {k:null,d:null};let k=50,d=50;for(let i=8;i<bs.length;i++){const r=bs.slice(i-8,i+1),hi=Math.max(...r.map(x=>x.h)),lo=Math.min(...r.map(x=>x.l));let rsv=hi===lo?50:(bs[i].c-lo)/(hi-lo)*100;k=(k*2+rsv)/3;d=(d*2+k)/3}return {k,d}}
function atr(bs,n=14){if(bs.length<n+1)return null;let tr=[];for(let i=1;i<bs.length;i++)tr.push(Math.max(bs[i].h-bs[i].l,Math.abs(bs[i].h-bs[i-1].c),Math.abs(bs[i].l-bs[i-1].c)));return SMA(tr,n)}
function pivot(arr,i,kind,r=2){if(i<r||i>=arr.length-r)return false;for(let j=i-r;j<=i+r;j++)if(j!==i&&(kind==='low'?arr[j]<arr[i]:arr[j]>arr[i]))return false;return true}
export function findPatterns(bars){
  const c=bars.map(x=>x.c), v=bars.map(x=>x.v),N=c.length;
  if(N<45)return [];
  const pats=[];const add=(id,label,side,confidence,reason)=>pats.push({id,label,side,confidence,reason});
  const s=c.slice(-92), start=N-s.length, lows=[],highs=[];
  for(let i=2;i<s.length-2;i++){if(pivot(s,i,'low'))lows.push(i);if(pivot(s,i,'high'))highs.push(i)}
  for(let t=lows.length-1;t>=1;t--){let a=lows[t-1],b=lows[t];if(b-a<8||b-a>55||s.length-1-b>18)continue;
    let x=s[a],y=s[b],neck=Math.max(...s.slice(a,b+1));
    if(Math.abs(x-y)/Math.min(x,y)>.075 || neck/Math.max(x,y)<1.065)continue;
    if(c.at(-1)>=neck*.99){add('W','W 底（雙底）','bull',Math.min(99,50+Math.round((neck/Math.max(x,y)-1)*100)),`雙低點相距 ${b-a} 日，頸線約 ${neck.toFixed(2)}；接近／突破頸線`);break}
  }
  for(let t=highs.length-1;t>=1;t--){let a=highs[t-1],b=highs[t];if(b-a<8||b-a>55||s.length-1-b>18)continue;
    let x=s[a],y=s[b],neck=Math.min(...s.slice(a,b+1));
    if(Math.abs(x-y)/Math.min(x,y)>.075||Math.min(x,y)/neck<1.065)continue;
    if(c.at(-1)<=neck*1.01){add('M','M 頭（雙頂）','bear',65,`雙高點相距 ${b-a} 日，頸線約 ${neck.toFixed(2)}；接近／跌破頸線`);break}
  }
  const q=c.slice(-35);let li=q.indexOf(Math.min(...q)),hi=q.indexOf(Math.max(...q));
  if(li>=6&&li<=27){let pre=Math.max(...q.slice(0,li)),rebound=q.at(-1)/q[li]-1,decline=1-q[li]/pre;if(decline>.1&&rebound>.1&&q.at(-1)>q.at(-8))add('V','V 型反轉','bull',60,`前段回落 ${(decline*100).toFixed(1)}%、低點回升 ${(rebound*100).toFixed(1)}%`)}
  if(hi>=6&&hi<=27){let pre=Math.min(...q.slice(0,hi)),pullback=1-q.at(-1)/q[hi],rally=q[hi]/pre-1;if(rally>.1&&pullback>.1&&q.at(-1)<q.at(-8))add('IV','倒 V 反轉','bear',60,`前段上升 ${(rally*100).toFixed(1)}%、高點回落 ${(pullback*100).toFixed(1)}%`)}
  let q60=c.slice(-60);if(q60.length===60){
    let a=average(q60.slice(0,15)),mid=average(q60.slice(23,38)),z=average(q60.slice(-15));
    const low=Math.min(...q60),range=low/Math.max(a,z);
    if(a>mid*1.06&&z>mid*1.06&&z>average(q60.slice(-30,-15))*1.025&&range>.66)add('ROUND','圓弧底候選','bull',58,`前段均價 ${a.toFixed(2)}／中段 ${mid.toFixed(2)}／後段 ${z.toFixed(2)}`);
    if(a<mid*.94&&z<mid*.94&&z<average(q60.slice(-30,-15))*.975)add('ROUNDTOP','圓弧頂候選','bear',58,`前段均價 ${a.toFixed(2)}／中段 ${mid.toFixed(2)}／後段 ${z.toFixed(2)}`);
  }
  let recent=c.slice(-21,-1);if(recent.length===20){let high=Math.max(...recent),lo=Math.min(...recent),volAvg=average(v.slice(-21,-1));
    if(c.at(-1)>high*1.005&&v.at(-1)>volAvg*1.3)add('BREAK','放量突破20日高','bull',75,`突破 ${high.toFixed(2)}；量比 ${(v.at(-1)/volAvg).toFixed(2)}`);
    if(c.at(-1)<lo*.995&&v.at(-1)>volAvg*1.3)add('BREAKDOWN','放量跌破20日低','bear',75,`跌破 ${lo.toFixed(2)}；量比 ${(v.at(-1)/volAvg).toFixed(2)}`);
  }
  return pats;
}
export function derive(stock){
  const bs=(stock.bars||[]).slice().sort((a,b)=>a.d.localeCompare(b.d));
  if(!bs.length)return null;
  const c=bs.map(b=>b.c),v=bs.map(b=>b.v),last=bs.at(-1),prev=c.at(-2);
  const ma={};for(const n of [5,10,20,60,120,240])ma[n]=SMA(c,n);
  const m=macd(c),r=rsi(c),k=kd(bs),a=atr(bs),av20=SMA(v,20),vr=av20>0?last.v/av20:null;
  let sd=null,upper=null,lower=null;if(ma[20]!==null){sd=Math.sqrt(average(c.slice(-20).map(x=>(x-ma[20])**2)));upper=ma[20]+2*sd;lower=ma[20]-2*sd}
  let ma240prev=SMA(c,240,c.length-11),ma240slope=ma[240]&&ma240prev?(ma[240]/ma240prev-1)*100:null;
  const patterns=findPatterns(bs);
  const bull=[],bear=[];const bullish=(condition,points,text)=>{if(condition)bull.push({points,text})};const bearish=(condition,points,text)=>{if(condition)bear.push({points,text})};
  bullish(ma[240]!==null&&last.c>ma[240],18,'股價高於 MA240 年線');bearish(ma[240]!==null&&last.c<ma[240],18,'股價低於 MA240 年線');
  bullish(ma240slope!==null&&ma240slope>0,10,'年線 10 日斜率向上');bearish(ma240slope!==null&&ma240slope<0,10,'年線 10 日斜率向下');
  bullish(ma[20]!==null&&ma[60]!==null&&ma[20]>ma[60]&&last.c>ma[20],16,'站穩 MA20，且 MA20 > MA60');
  bearish(ma[20]!==null&&ma[60]!==null&&ma[20]<ma[60]&&last.c<ma[20],16,'跌破 MA20，且 MA20 < MA60');
  bullish(m.hist!==null&&m.hist>0,12,'MACD 柱狀值為正');bearish(m.hist!==null&&m.hist<0,12,'MACD 柱狀值為負');
  if (Number.isFinite(r)) {
    bullish(r>52&&r<82,10,`RSI14 ${r.toFixed(1)} 偏強`);
    bearish(r<48&&r>18,10,`RSI14 ${r.toFixed(1)} 偏弱`);
  }
  bullish(k.k!==null&&k.k>k.d,8,'KD K 值高於 D 值');bearish(k.k!==null&&k.k<k.d,8,'KD K 值低於 D 值');
  bullish(vr!==null&&vr>1.3&&prev!==undefined&&last.c>prev,10,'上漲且量比 > 1.3');bearish(vr!==null&&vr>1.3&&prev!==undefined&&last.c<prev,10,'下跌且量比 > 1.3');
  bullish(patterns.some(p=>p.side==='bull'),16,'符合多頭型態候選');bearish(patterns.some(p=>p.side==='bear'),16,'符合空頭型態候選');
  const total=a=>Math.min(100,a.reduce((s,x)=>s+x.points,0));
  return {code:stock.code,name:stock.name,market:stock.market,date:last.d,close:last.c,prevClose:prev??null,pct:prev?(last.c/prev-1)*100:null,volume:last.v,days:bs.length,ma,ma240slope,rsi:r,macd:m,kd:k,boll:{mid:ma[20],upper,lower},atr:a,volRatio:vr,patterns,bull:{score:total(bull),hits:bull},bear:{score:total(bear),hits:bear},quality:bs.length>=250?'完整年線':bs.length>=60?'年線資料不足':'技術資料不足',source:last.source??null};
}
// Observed average closing price on NET-BUY days is NOT acquisition / holding cost.
export function netBuyReference(stock,kind='foreign',window=20){
  const barsByDate=new Map((stock?.bars||[]).map(b=>[b.d,b]));
  const days=(stock?.institutions||[]).slice().sort((a,b)=>b.d.localeCompare(a.d)).slice(0,window);
  let shares=0,weighted=0,net=0,valid=0,buyDays=0;
  for(const x of days){if(!Number.isFinite(x[kind]))continue;net+=x[kind];valid++;
    let b=barsByDate.get(x.d);
    if(x[kind]>0&&b&&b.c>0){shares+=x[kind];weighted+=x[kind]*b.c;buyDays++}
  }
  return {estimate:shares>0&&valid>=5?weighted/shares:null,netShares:valid?net:null,observedDays:valid,buyDays,window,method:'買超日收盤價按買超股數加權（不是法人真實成本）'};
}

// TPEx legacy institutional dailyTrade page has duplicated column labels. Only
// read 24-column rows after validating dealer and three-institution identities.
export function parseTpexInstHistory(payload,date){
  const out=[];
  for(const t of namedTables(payload))for(const row of t.rows){
    if(!Array.isArray(row)||row.length<24)continue;
    let code=String(row[0]??'').trim();if(!ordinary(code))continue;
    const f=num(row[4]),tr=num(row[13]),dealerSelf=num(row[16]),dealerHedge=num(row[19]),dealer=num(row[22]),sum=num(row[23]);
    if(![f,tr,dealerSelf,dealerHedge,dealer,sum].every(Number.isFinite))continue;
    if(Math.abs(dealerSelf+dealerHedge-dealer)>1 ||Math.abs(f+tr+dealer-sum)>1)throw Error('TPEx 法人欄位檢核不通過，停止匯入');
    out.push({code,d:date,foreign:f,trust:tr,dealer,source:SOURCES.tpexInstHistory.replace('{date}',String(Number(date.slice(0,4))-1911)+'%2F'+date.slice(5,7)+'%2F'+date.slice(8,10))});
  }
  return out;
}
