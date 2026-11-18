(()=>{'use strict';
const $=id=>document.getElementById(id),Q=(sel)=>Array.from(document.querySelectorAll(sel));
const state={data:null,official:null,usingDemo:false,side:'bull',tab:'ranking',selected:null,visible:[]};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=2)=>Number.isFinite(Number(n))&&n!==null?Number(n).toLocaleString('zh-TW',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const num=n=>Number.isFinite(Number(n))&&n!==null?Number(n).toLocaleString('zh-TW',{maximumFractionDigits:0}):'—';
const netLots=x=>Number.isFinite(x)?(x>0?'+':'')+fmt(x/1000,0)+' 張':'—';
const tint=n=>Number(n)>0?'pos':Number(n)<0?'neg':'';
const dateTime=x=>{if(!x)return'尚未更新';let d=new Date(x);return Number.isNaN(d.valueOf())?'未知':d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})};
function toast(msg,isBad=false){$('notice').className='notice'+(isBad?' bad':'');$('notice').textContent=msg;}
function switchTab(tab){state.tab=tab;Q('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));Q('.page').forEach(x=>x.classList.toggle('hidden',x.id!=='page-'+tab));if(tab==='source')renderSource();if(tab==='macro')renderMacro();if(tab==='flow')renderFlow();}
function setData(data,usingDemo=false){state.data=data;state.usingDemo=usingDemo;
  let mode=$('mode');mode.className='pill '+(usingDemo?'demo':data?.mode==='official'?'ok':'neutral');mode.textContent=usingDemo?'人造示範資料':data?.mode==='official'?'官方盤後資料':'尚無正式資料';
  if(usingDemo)toast('目前顯示人造示範股價，僅供測試篩選介面；不是台股真實行情，更不是盤中即時資料。');
  else if(data?.mode==='official')toast('官方盤後行情：按各市場資料日期顯示；最後重新產生：'+dateTime(data.generatedAt)+'。不是即時價格。');
  else toast('尚未完成中央行情同步。需要站長先啟用排程並建立歷史；可在「資料與說明」切換示範。',true);
  renderStats();renderTable();if(state.tab==='source')renderSource();if(state.tab==='macro')renderMacro();if(state.tab==='flow')renderFlow();
}
function renderStats(){let d=state.data||{},r=d.rows||[],ready=r.filter(x=>x.ready),eligible=r.filter(x=>['full','preliminary'].includes(x.scoreMode)&&x.date===(d.markets?.[x.market]?.date||x.date)),bull=eligible.filter(x=>(x.bull||0)>=45),bear=eligible.filter(x=>(x.bear||0)>=45);const dates=[...new Set(r.map(x=>x.date).filter(Boolean))].sort().reverse();
const boxes=[['最新資料日',dates[0]||'—',state.usingDemo?'示範日期':'各市場可能有不同交易日'],['追蹤普通股',num(r.length),state.usingDemo?'非實際上市櫃股數':'來源：公開盤後行情'],['年線已建立',num(ready.length),`歷史最多 ${d.stats?.maxHistoryDays||0} 日；完整度 ${r.length?Math.round(ready.length/r.length*100):0}%`],['多／空候選',bull.length+' / '+bear.length,'基準45分，含短期初步；非勝率']];
$('stats').innerHTML=boxes.map(b=>`<div class="stat"><div class="key">${esc(b[0])}</div><strong>${esc(b[1])}</strong><div class="sub">${esc(b[2])}</div></div>`).join('');}
function visibleRows(){const d=state.data||{}, all=d.rows||[],search=$('search').value.trim().toLowerCase(),m=$('market').value,p=$('pattern').value,y=$('yearline').value,s=Math.min(100,Math.max(0,Number($('minscore').value)||0));let mode=$('dataLevel').value;let out=all.filter(r=>['full','preliminary'].includes(r.scoreMode)&&r.date===(d.markets?.[r.market]?.date||r.date)&&Number.isFinite(r[state.side])&&(r[state.side]>=s)&&(mode==='all'||(mode==='full'&&r.scoreMode==='full')||(mode==='preliminary'&&r.scoreMode==='preliminary')));if(search)out=out.filter(x=>(x.code+' '+x.name).toLowerCase().includes(search));if(m!=='all')out=out.filter(x=>x.market===m);if(p!=='all')out=out.filter(x=>(x.pattern||[]).some(z=>z.id===p));if(y!=='all')out=out.filter(x=>x.ma240!==null && (y==='up'?x.close>x.ma240:x.close<x.ma240));return out.sort((a,b)=>(a.scoreMode===b.scoreMode?0:a.scoreMode==='full'?-1:1)||(b[state.side]-a[state.side])||(b.volume-a.volume));}
function renderTable(){let d=state.data||{},out=state.visible=visibleRows();$('result-count').textContent=`符合條件 ${num(out.length)} 檔 · ${state.side==='bull'?'多頭':'空頭'}分數`;let tb=$('results');
  if(!out.length){tb.innerHTML='<tr><td colspan="10"><div class="empty">'+(d.stats?.with60===0?'尚未有任何股票累積 60 個交易日，無法產生短期初步觀察。':'目前篩選條件無符合股票，請放寬分數或將資料層級改為「全部」。')+'</div></td></tr>';}
  else tb.innerHTML=out.slice(0,250).map(r=>{let pats=(r.pattern||[]).filter(x=>x.side===(state.side==='bull'?'bull':'bear')).slice(0,2),labels=pats.map(x=>`<span class="pat">${esc(x.label)}</span>`).join('')||'<span class="muted">—</span>';return `<tr><td><button class="stock-btn" data-stock="${esc(r.code)}"><span class="name">${esc(r.name)}</span><span class="code">${esc(r.code)} · ${r.scoreMode==='full'?'完整年線':'短期初步'}（${r.days}日）</span></button></td><td>${esc(r.market)}</td><td>${fmt(r.close)}</td><td class="${tint(r.pct)}">${r.pct>0?'+':''}${fmt(r.pct)}%</td><td>${fmt(r.ma240)}</td><td>${fmt(r.rsi,1)}</td><td class="${tint(r.foreignNet5)}">${netLots(r.foreignNet5)}</td><td class="${tint(r.trustNet5)}">${netLots(r.trustNet5)}</td><td>${labels}</td><td class="score ${state.side==='bull'?'pos':'neg'}">${num(r[state.side])}</td></tr>`}).join('');
  $('result-footnote').textContent=out.length>250?'排行榜僅顯示前 250 檔，匯出包含所有符合條件的股票。':'短期初步分數按非年線訊號獨立正規化，不可與完整年線分數直接比較；皆非勝率或投資建議。';
  Q('button[data-stock]').forEach(b=>b.addEventListener('click',()=>openStock(b.dataset.stock)));}
function exportCsv(){const arr=state.visible;if(!arr.length)return toast('沒有符合條件的資料可匯出。',true);const fields=['code','name','market','date','close','pct','ma20','ma60','ma240','rsi','volRatio','bull','bear','foreignNet','trustNet','institutionDate','foreignRef20','trustRef20','foreignNet5','trustNet5','source','days','scoreMode'];const rows=[fields.join(','),...arr.map(x=>fields.map(k=>'"'+String(x[k]??'').replaceAll('"','""')+'"').join(','))];const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='股_V0.6.8.2_'+(state.side==='bull'?'多頭':'空頭')+'_'+(state.data.generatedAt||'demo').slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
async function openStock(code){switchTab('detail');$('detail-query').value=code;await detail(code)}
async function detail(code){const r=(state.data?.rows||[]).find(x=>x.code===code||x.name===code);if(!r){$('detail-content').innerHTML='<div class="empty">找不到此股票，請輸入完整代號或從多空排行選擇。<br>資料庫需要先由中央服務同步官方數據。</div>';return}
  $('detail-content').innerHTML='<div class="empty">正在載入個股歷史與型態資料……</div>';let d;
  if(state.usingDemo)d=window.__DEMO__?.details?.[r.code];else{try{const res=await fetch('./data/stocks/'+encodeURIComponent(r.code)+'.json',{cache:'no-store'});if(res.ok)d=await res.json();}catch(e){}}
  if(!d){$('detail-content').innerHTML='<div class="empty">個股明細尚未建立或讀取失敗。請由站長確認每日部署紀錄。</div>';return}
  const safeUrl=x=>/^https:\/\/(?:www\.twse\.com\.tw|openapi\.twse\.com\.tw|www\.tpex\.org\.tw)\//.test(x||'')?x:null;
  const link=safeUrl(d.source)?`<a target="_blank" rel="noopener noreferrer" href="${esc(d.source)}">官方來源</a>`:'資料來源請見「資料與說明」';
  let pats=(d.pattern||[]).map(x=>`<li><strong>${esc(x.label)}</strong>：${esc(x.reason)}</li>`).join('')||'<li>目前沒有符合的型態候選</li>';
  const hit=(title,arr)=>`<div class="info-tile"><h3>${title}</h3>${(arr?.length)?'<ul class="rules">'+arr.slice(0,9).map(z=>'<li>'+esc(z)+'</li>').join('')+'</ul>':'<p>目前條件不足</p>'}</div>`;
  
  $('detail-content').innerHTML=`<div class="detail-top"><div><h2>${esc(d.code)} ${esc(d.name)}</h2><div class="pill-lite">${esc(d.market)} · 資料日 ${esc(d.date)} · ${d.days} 個交易日樣本 · ${link}</div></div><div><span class="pill ${d.ready?'ok':'warning'}">${d.ready?'完整年線':d.scoreMode==='preliminary'?'短期初步觀察 · 年線不足':'不足60日 · 尚未評分'}</span></div></div>
  <p class="warn">${d.scoreMode==='preliminary'?'此為 60～249 日短期初步觀察；分數不含年線，且不可與完整年線股票分數直接比較。':d.scoreMode==='insufficient'?'歷史不足 60 日，尚未評分。':'已具備完整年線條件。'}</p><div class="metric-grid"><div class="metric"><div class="key">日線收盤</div><b>${fmt(d.close)}</b></div><div class="metric"><div class="key">MA240 年線</div><b>${fmt(d.ma240)}</b></div><div class="metric"><div class="key">多頭分數</div><b class="pos">${d.bull??'未評分'}</b></div><div class="metric"><div class="key">空頭分數</div><b class="neg">${d.bear??'未評分'}</b></div></div>
  <svg id="price-chart" class="chart" role="img" aria-label="最近收盤價與 MA20、MA240 趨勢圖" viewBox="0 0 880 290"></svg>
  <div class="pill-lite">最近日線收盤趨勢（紅：收盤；青：MA20；金：MA240；非即時 K 線）</div>
  <div class="metric-grid"><div class="metric"><div class="key">RSI14</div><b>${fmt(d.rsi,1)}</b></div><div class="metric"><div class="key">MA20</div><b>${fmt(d.ma20)}</b></div><div class="metric"><div class="key">MACD 柱狀</div><b>${fmt(d.macdHist,3)}</b></div><div class="metric"><div class="key">相對量比</div><b>${fmt(d.volRatio,2)}</b></div></div>
  <div class="pattern-box"><h3>技術型態候選</h3><ul>${pats}</ul></div><div class="two-col">${hit('多頭符合條件',d.bullReasons)}${hit('空頭符合條件',d.bearReasons)}</div>
  ${renderFibonacci(d)}${renderMarginDetail(d)}${renderChips(d)}`;
  renderChart(d.bars||[]);
}
function renderFibonacci(d){
 const data=d.fibonacci||{},sets=[['60 日波段',data.short],['120 日波段',data.medium]];
 return `<section class="institution"><div class="section-heading"><h3>個股斐波：回撤・延伸・時間窗</h3><span class="pill neutral">歷史日線 · 非預測</span></div>
 <div class="two-col">${sets.map(([name,f])=>f?`<div class="info-tile"><h3>${esc(name)}（${f.direction==='up'?'上漲波段':'下跌波段'}）</h3>
 <p>高 ${fmt(f.high)}（${esc(f.highDate)}）／低 ${fmt(f.low)}（${esc(f.lowDate)}）</p>
 <p class="small muted">回撤：${f.retracements.map(x=>`${fmt(x.ratio*100,1)}%：${fmt(x.price)}`).join('　')}</p>
 <p class="small muted">延伸：${f.extensions.map(x=>`${fmt(x.ratio,3)}：${fmt(x.price)}`).join('　')}</p>
 <p class="small muted">時間窗（自波段端點起的假設交易日數）：${f.timeWindows.map(x=>`×${fmt(x.ratio,3)} → ${x.tradeDays} 日`).join('、')}</p>
 </div>`:`<div class="info-tile"><h3>${esc(name)}</h3><p>有效日線不足或波段振幅不足，無法建立可靠參考價位。</p></div>`).join('')}</div>
 <p class="warn">斐波以指定觀察窗口內極高、極低點自動錨定；並非人工判定主浪。斐波時間窗不等於特定日期或預言；除權息未還原可能影響波段位置。</p></section>`;
}
function renderMarginDetail(d){
 const rows=(d.marginHistory||[]).slice(-20).reverse(),last=rows[0];
 const unit='原始來源單位，未核實前不跨市場合計';
 const tbody=rows.map((r,i)=>{const older=rows[i+1],dm=Number.isFinite(r.prevMargin)?r.margin-r.prevMargin:(older?r.margin-older.margin:null),ds=Number.isFinite(r.prevShort)?r.short-r.prevShort:(older?r.short-older.short:null);
   return `<tr><td>${esc(r.d)}</td><td>${fmt(r.margin,0)}</td><td class="${tint(dm)}">${Number.isFinite(dm)?(dm>0?'+':'')+fmt(dm,0):'—'}</td><td>${fmt(r.short,0)}</td><td class="${tint(ds)}">${Number.isFinite(ds)?(ds>0?'+':'')+fmt(ds,0):'—'}</td><td>${r.dateConfirmed?'已核實':'日期錨定待核'}</td></tr>`;}).join('');
 return `<section class="institution"><div class="section-heading"><h3>個股融資／融券</h3><span class="pill neutral">官方盤後快照</span></div>
 <p class="small muted">${esc(unit)}；未回補的舊日期不以零代替。${last?'最近歸檔 '+esc(last.d):'尚未取得個股融資券'}</p>
 <div class="metric-grid"><div class="metric"><div class="key">最新融資餘額</div><b>${fmt(last?.margin,0)}</b></div><div class="metric"><div class="key">最新融券餘額</div><b>${fmt(last?.short,0)}</b></div><div class="metric"><div class="key">券資比</div><b>${Number.isFinite(last?.margin)&&last.margin>0&&Number.isFinite(last?.short)?fmt(last.short/last.margin*100,2)+'%':'—'}</b></div><div class="metric"><div class="key">累積日期</div><b>${rows.length} 日</b></div></div>
 <div class="tablewrap"><table><thead><tr><th>交易日</th><th>融資餘額（來源單位）</th><th>融資變化</th><th>融券餘額（來源單位）</th><th>融券變化</th><th>日期狀態</th></tr></thead><tbody>${tbody||'<tr><td colspan="6">尚無正式融資券資料</td></tr>'}</tbody></table></div></section>`;
}
function renderMacro(){
 const d=state.data||{},m=d.marketData||{},idx=m.indices||{},ms=m.margin||{},n=Number($('macro-window')?.value)||60;
 const fibFor=(q)=>q?.['fib'+n]||null;
 const marketCard=(name,key)=>{const x=idx[key],latest=x?.latest,f=fibFor(x),date=latest?.d||'資料不足';
   const rows=f?.retracements?.map(z=>`<tr><td>${fmt(z.ratio*100,1)}%</td><td>${fmt(z.price)}</td></tr>`).join('')||'<tr><td colspan="2">累積歷史不足；先顯示最後有效指數，不偽造波段</td></tr>';
   return `<article class="macro-card"><div class="macro-card-head"><h3>${esc(name)}</h3><span class="pill neutral">${esc(date)}</span></div><strong class="macro-value">${fmt(latest?.c,2)}</strong><p class="small muted">官方已累積 ${x?.bars?.length||0} 日／目前斐波區間 ${n} 日；非盤中即時行情</p>
    ${f?`<p class="small">極高 ${fmt(f.high)}（${esc(f.highDate)}）・極低 ${fmt(f.low)}（${esc(f.lowDate)}）・${f.direction==='up'?'上漲段回檔參考':'下跌段反彈參考'}；${f.basis==='close'?'僅收盤價錨點':'實際高低價錨點'}</p>`:'<p class="small muted">斐波回撤資料不足</p>'}
    <div class="tablewrap"><table class="mini-table"><thead><tr><th>回撤比例</th><th>價位</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${f?`<p class="small muted">延伸：${f.extensions.map(z=>fmt(z.ratio,3)+'→'+fmt(z.price)).join('　')}</p>`:''}</article>`;
 };
 const ft=m.futures;
 const indexDate=idx.taiex?.latest?.d||idx.otc?.latest?.d||null;
 const futuresStale=ft?.date&&indexDate&&ft.date<indexDate;
 const futuresCard=`<article class="macro-card"><div class="macro-card-head"><h3>臺指期 TX</h3><span class="pill neutral">${esc(ft?.date||'尚無資料')}</span></div><strong class="macro-value">${fmt(ft?.day?.close)}</strong>
 <p class="small muted">有效近月合約 ${esc(ft?.contractMonth||'尚未取得')}；到期 ${esc(ft?.expiresOn||'待核對')}；日盤 ${esc(ft?.day?.session||'—')}；夜盤 ${esc(ft?.night?.session||'尚無')}</p>
 ${futuresStale?'<p class="warn">期交所來源仍停在 '+esc(ft.date)+'，落後於現貨 '+esc(indexDate)+'；此為歷史報價，不是最新期貨行情。</p>':''}
 <div class="metric-grid two-metrics"><div class="metric"><div class="key">日盤結算價</div><b>${fmt(ft?.day?.settlement)}</b></div><div class="metric"><div class="key">夜盤最後成交</div><b>${fmt(ft?.night?.close)}</b></div><div class="metric"><div class="key">日盤未平倉</div><b>${num(ft?.day?.openInterest)}</b></div><div class="metric"><div class="key">歸檔資料筆數</div><b>${num(ft?.snapshots?.length||0)}</b></div></div>
 <p class="small muted">不同契約月份不可直接拼接計算斐波；盤後資料不等於即時台指期報價。</p></article>`;
 const marginCard=market=>{const items=ms[market]||[],last=items.at(-1),prev=items.length>1?items.at(-2):null;
 const change=Number.isFinite(last?.changeMargin)?last.changeMargin:(last&&prev&&last.d!==prev.d)?last.margin-prev.margin:null;const shortChange=Number.isFinite(last?.changeShort)?last.changeShort:(last&&prev&&last.d!==prev.d)?last.short-prev.short:null;
 return `<article class="macro-card"><div class="macro-card-head"><h3>${esc(market)}融資融券</h3><span class="pill neutral">${esc(last?.d||'未取得')}</span></div>
 <div class="metric-grid two-metrics"><div class="metric"><div class="key">融資餘額</div><b>${fmt(last?.margin,0)}</b></div><div class="metric"><div class="key">融券餘額</div><b>${fmt(last?.short,0)}</b></div><div class="metric"><div class="key">當日融資變化</div><b class="${tint(change)}">${Number.isFinite(change)?(change>0?'+':'')+fmt(change,0):'—'}</b></div><div class="metric"><div class="key">當日融券變化</div><b class="${tint(shortChange)}">${Number.isFinite(shortChange)?(shortChange>0?'+':'')+fmt(shortChange,0):'—'}</b></div></div>
 <p class="small muted">${esc(last?.coverageNote||'尚未取得資料')}。${esc(last?.unit||'官方原始單位待核對')}；請勿直接跨上市、上櫃加總。</p>
 <div class="tablewrap"><table class="mini-table"><thead><tr><th>交易日</th><th>融資</th><th>融券</th></tr></thead><tbody>${items.slice(-10).reverse().map(x=>`<tr><td>${esc(x.d)}</td><td>${fmt(x.margin,0)}</td><td>${fmt(x.short,0)}</td></tr>`).join('')||'<tr><td colspan="3">尚無資料</td></tr>'}</tbody></table></div></article>`};
 const errorStatus=Object.entries(m.sourceStatus||{}).filter(([_,x])=>x.status==='error'||x.status==='stale').map(([key,v])=>`${esc(key)}：${esc(v.message||'取數失敗')}`).join('；');
 $('macro-content').innerHTML=`<div class="macro-grid">${marketCard('加權指數 TAIEX','taiex')}${marketCard('櫃買指數 OTC','otc')}${futuresCard}</div>
 <h3 class="table-title">每日融資／融券籌碼</h3><div class="macro-grid">${marginCard('上市')}${marginCard('上櫃')}</div>
 <p class="warn">${errorStatus?'本次來源異常：'+errorStatus:'每項數據仍需檢查來源與實際日期，首次部署可能尚無歷史。'}</p>`;
}
function renderFlow(){
 const out=$('flow-content'),meta=$('flow-status'),days=Number($('flow-window').value),direction=$('flow-direction').value;
 const whole=state.data?.flowRankings||null,d=whole?.byPeriod?.[days];
 if(!d){meta.textContent=`${days} 日排行榜尚未建立。需先讓 GitHub Actions 重新計算並發布股_V0.6.8.2；本機示範資料不等於正式行情。`;out.innerHTML='<div class="empty">尚無經驗證的法人／量價排行，請查看資料與說明。</div>';return;}
 meta.textContent=`區間：${days} 交易日；上市 ${d.marketDates?.['上市']||'未確認'} ／上櫃 ${d.marketDates?.['上櫃']||'未確認'}；具足夠股價歷史 ${num(d.stocksWithPeriod)} 檔。`;
 const categories=[['foreign','外資淨買賣超 Top 10'],['trust','投信淨買賣超 Top 10'],['activity','量價主力動向觀察 Top 10（代理指標）']];
 out.innerHTML=categories.map(([key,title])=>{
   const entry=d[key]||{},rows=entry[direction]||[],isProxy=key==='activity';
   const label=isProxy?(direction==='buy'?'偏多代理分數':'偏空代理分數'):(direction==='buy'?'淨買超（張）':'淨賣超（張）');
   const body=rows.slice(0,10).map((r,i)=>{
     const v=isProxy?r.activity?.[direction==='buy'?'buyScore':'sellScore']:r[key]?.netShares;
     const display=isProxy?`${num(v)}/100`:netLots(v);
     const more=isProxy?`量比 ${fmt(r.activity?.relVolume,2)} · 區間 ${fmt(r.activity?.periodReturnPct,1)}%`:
       `已涵蓋 ${num(r[key]?.observedDays)}/${days} 日 · ${r[key]?.latestInstitutionDate||'未知日'}`;
     return `<tr><td>${i+1}</td><td><button class="stock-btn" data-stock="${esc(r.code)}"><span class="name">${esc(r.name)}</span><span class="code">${esc(r.code)} · ${esc(r.market)}</span></button></td><td class="${isProxy?'':tint(v)}">${display}</td><td class="muted">${esc(more)}</td></tr>`;
   }).join('');
   return `<article class="flow-card"><h3>${title}</h3><div class="small muted">符合統計完整度 ${num(entry.eligible||0)} 檔，資料不足或過期 ${num(entry.insufficient||0)} 檔。依本次所選 ${days} 日重新排序。</div><div class="tablewrap"><table class="flow-table"><thead><tr><th>名次</th><th>股票</th><th>${label}</th><th>資料／參考</th></tr></thead><tbody>${body||'<tr><td colspan="4"><div class="empty">此區間無有效候選（可能是法人資料不足、非最新日或沒有買／賣超）。</div></td></tr>'}</tbody></table></div></article>`;
 }).join('');
 Q('#page-flow button[data-stock]').forEach(b=>b.addEventListener('click',()=>openStock(b.dataset.stock)));
}

function renderChips(d){
  const chip=d.chips||{},wins=chip.windows||[],win=n=>wins.find(x=>x.period===n);
  const netCard=(period,kind,title)=>{const z=win(period)?.categories?.[kind];const has=Boolean(z?.covered);
    return `<div class="metric"><div class="key">${title} ${period} 日累計</div><b class="${has?tint(z.netShares):''}">${has?netLots(z.netShares):'資料不足'}</b><div class="small muted">涵蓋 ${z?.validDays||0}/${period} 交易日</div></div>`;};
  const costCard=(kind,title)=>{const z=win(20)?.categories?.[kind],v=z?.netBuyCloseReference;
    const change=Number.isFinite(v)&&v>0?((d.close/v)-1)*100:null;
    return `<div class="reference-card"><div class="key">${title}近20日買超日參考價</div><strong>${fmt(v)}</strong><div class="small muted">${Number.isFinite(change)?'現價距參考價 '+(change>0?'+':'')+fmt(change,1)+'%':'法人歷史或買超日不足'}</div><div class="small muted">${z?.buyDays||0} 個淨買超日；非真實買進成本</div></div>`;};
  const recent=(chip.daily||[]).slice(0,20);
  const daily=recent.map(x=>`<tr><td>${esc(x.date)}</td><td>${fmt(x.close)}</td><td class="${tint(x.foreign)}">${netLots(x.foreign)}</td><td class="${tint(x.trust)}">${netLots(x.trust)}</td><td class="${tint(x.dealer)}">${netLots(x.dealer)}</td><td class="muted">未接入</td></tr>`).join('');
  return `<section class="institution" id="chip-panel"><div class="section-heading"><h3>法人籌碼與參考價</h3><span class="pill neutral">盤後資料 · 非即時</span></div>
    <p class="small muted">最近有效法人日期：${esc(chip.latestDate||d.institutionDate||'尚無')}。累計張數須有至少 80% 的交易日數據，否則顯示資料不足。單位：張（1 張 = 1,000 股）。</p>
    <div class="metric-grid chip-metrics">${netCard(5,'foreign','外資')}${netCard(5,'trust','投信')}${netCard(20,'foreign','外資')}${netCard(20,'trust','投信')}${netCard(60,'foreign','外資')}${netCard(60,'trust','投信')}${netCard(20,'dealer','自營商')}</div>
    <div class="reference-grid">${costCard('foreign','外資')}${costCard('trust','投信')}</div>
    <h3 class="table-title">最近 20 交易日法人進出</h3><div class="tablewrap"><table class="chip-table"><thead><tr><th>交易日期</th><th>收盤</th><th>外資淨買賣超</th><th>投信淨買賣超</th><th>自營商淨買賣超</th><th>官股券商買賣超</th></tr></thead><tbody>${daily||'<tr><td colspan="6">尚無法人歷史資料</td></tr>'}</tbody></table></div>
    <div class="info-tile" style="margin-top:14px"><h3>主力與券商分點</h3><p>主力不是官方統一身分類別；目前尚未接入合法可使用的分點進出資料，因此不顯示「主力持有成本」。待接入後可提供分點買賣超與買超日價格參考，但不能認定為實際持倉成本。</p></div>
    <p class="warn">計算方式：只取淨買超日，以當日收盤價依淨買超股數加權。這不是法人實際成交價或持股成本；買賣超也不代表未賣出庫存。<a href="https://www.twse.com.tw/rwd/zh/fund/T86" rel="noopener noreferrer" target="_blank">證交所法人來源</a> · <a href="https://www.tpex.org.tw/openapi/" rel="noopener noreferrer" target="_blank">櫃買中心來源</a></p>
  </section>`;
}

function renderChart(bars){let svg=$('price-chart');if(!svg)return;if(bars.length<2){svg.innerHTML='<text x="440" y="145" fill="#9aaec2" text-anchor="middle">歷史價格不足</text>';return}
 const bs=bars.slice(-180),cls=bs.map(x=>x.c),ma20=cls.map((_,i)=>i>=19?cls.slice(i-19,i+1).reduce((a,b)=>a+b,0)/20:null),full=bars.map(x=>x.c),ma240=bs.map((_,i)=>{let oi=bars.length-bs.length+i;return oi>=239?full.slice(oi-239,oi+1).reduce((a,b)=>a+b,0)/240:null});
 const all=[...cls,...ma20,...ma240].filter(Number.isFinite),low=Math.min(...all)*.97,high=Math.max(...all)*1.03,pt=(v,i)=>`${44+i/(bs.length-1)*809},${238-(v-low)/(high-low||1)*205}`;
 const line=(vals,color)=>{let sections=[],seg=[];vals.forEach((v,i)=>{if(!Number.isFinite(v)){if(seg.length){sections.push(seg.join(' '));seg=[]}}else seg.push(pt(v,i))});if(seg.length)sections.push(seg.join(' '));return sections.map(s=>`<polyline points="${s}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`).join('')};
 const grid=[0,1,2,3,4].map(i=>`<line x1="44" x2="853" y1="${33+i*51}" y2="${33+i*51}" stroke="#2d4358" stroke-width="1"/><text x="5" y="${37+i*51}" fill="#829cb5" font-size="11">${(high-(high-low)*i/4).toFixed(0)}</text>`).join('');
 svg.innerHTML=`${grid}${line(cls,'#ff7384')}${line(ma20,'#41d0d1')}${line(ma240,'#e2bf70')}<text x="44" y="269" fill="#90a7be" font-size="12">${esc(bs[0].d)}</text><text x="853" y="269" text-anchor="end" fill="#90a7be" font-size="12">${esc(bs.at(-1).d)}</text>`;
}
function renderSource(){let d=state.data||{},ms=d.markets||{},html=`<div class="source-card"><strong>資料模式</strong><p>${state.usingDemo?'人造測試資料，非台股行情':d.mode==='official'?'官方盤後匯總資料':'尚未有正式行情資料'}</p><p>資料更新工作時間：${esc(dateTime(d.generatedAt))}</p><p>歷史回補游標：${esc(d.backfill?.cursor||'尚未開始')}（每次逐批回補，並非每日重做）</p><p>目前個股最多累積 ${num(d.stats?.maxHistoryDays??0)} 個交易日；MA20 可計算 ${num(d.stats?.with20??0)} 檔、MA60 可計算 ${num(d.stats?.with60??0)} 檔；短期初步觀察 ${num(d.stats?.preliminaryReady??0)} 檔。</p><p>最近一批回補：成功 ${num(d.backfill?.lastBatch?.completedTradingDays??0)} 日、略過休市/週末 ${num(d.backfill?.lastBatch?.skippedDays??0)} 日，${d.backfill?.lastBatch?.failedDate?'卡在 '+esc(d.backfill.lastBatch.failedDate):'未回報失敗日期'}。</p><p>法人歷史補建：本次掃描 ${num(d.chipsBackfill?.lastBatch?.scannedDays??0)} 日、成功 ${num(d.chipsBackfill?.lastBatch?.successfulMarketDays??0)} 個市場交易日、失敗 ${num(d.chipsBackfill?.lastBatch?.failedMarketDays??0)} 次；待重試 ${num(d.chipsBackfill?.lastBatch?.pendingRetries??0)} 次。</p></div>`;
 const dq=d.dataQuality||{};
 if(dq.dealerRepair)html+=`<div class="source-card"><strong>法人欄位修復／可信度</strong><p>上市自營商：已驗證 ${num(dq.dealerRepair.verifiedTradingDays||0)} 個交易日；尚待逐日重新核對 ${num(dq.dealerRepair.pendingTradingDays||0)} 日。歷史錯誤 0 值已改為「資料不足」，不當成真正 0 張。</p><p>已隔離來源日期未核實的上市融資券市場摘要 ${num(dq.quarantinedUndatedTwseMargin||0)} 筆，不會再參與資金變化計算。</p><p>官股：${esc(dq.governmentDealerData||'尚未接入可驗證逐股資料')}。</p></div>`;
 const rb=d.marketData?.indexBackfillLastBatch?.markets;
 if(rb){const text=['taiex','otc'].map(k=>`${k==='taiex'?'加權':'OTC'}：${num(rb[k]?.before||0)} → ${num(rb[k]?.after||0)} 日（本次成功月數 ${num(rb[k]?.ok||0)}、失敗月數 ${num(rb[k]?.failed||0)}）`).join('；');
 html+=`<div class="source-card"><strong>股_V0.6.8.2 指數月資料回補</strong><p>${esc(text)}</p><p>若官方資料抓取失敗，會在下方列出原因，不以虛構指數補齊。</p></div>`}
 for(const m of ['上市','上櫃']){let o=ms[m]||{};html+=`<div class="source-card"><strong>${m}市場</strong><p>交易日：${esc(o.date||'尚無')}｜普通股：${num(o.count??null)}｜狀態：${esc(o.status||'未連接')}｜法人日：${esc(o.institutionDate||'尚無')}</p></div>`}
 for(const s of d.sources||[]){if(/^https:\/\//.test(s.url))html+=`<div class="source-card"><strong>${esc(s.name)}</strong><p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a></p></div>`}
 if(d.errors?.length)html+='<div class="source-card"><strong>最近取數錯誤</strong><ul class="rules">'+d.errors.map(e=>`<li>${esc(e)}</li>`).join('')+'</ul></div>';
 $('source-content').innerHTML=html; $('demo-toggle').textContent=state.usingDemo?'返回正式資料':'使用人造示範資料體驗';}
async function load(){if(location.protocol==='file:'){setData(window.__DEMO__,true);return}
 try{const r=await fetch('./data/index.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!Array.isArray(data.rows))throw Error('資料格式錯誤');state.official=data;setData(data,false)}catch(e){setData({mode:'empty',rows:[],markets:{},stats:{yearlineReady:0},errors:[e.message]},false);toast('中央行情資料讀取失敗：'+e.message+'。可以切換示範資料，但不能冒充真實盤後行情。',true)}}
Q('.nav button').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));Q('[data-side]').forEach(b=>b.addEventListener('click',()=>{state.side=b.dataset.side;Q('[data-side]').forEach(x=>x.classList.toggle('selected',x===b));renderTable()}));
for(const id of ['search','market','pattern','yearline','minscore','dataLevel'])$(id).addEventListener('input',renderTable);
$('reload').addEventListener('click',load);$('csv').addEventListener('click',exportCsv);
$('detail-go').addEventListener('click',()=>detail($('detail-query').value.trim()));$('detail-query').addEventListener('keydown',e=>{if(e.key==='Enter')detail(e.target.value.trim())});
$('intraday-ranking').addEventListener('click',()=>switchTab('ranking'));
$('macro-window').addEventListener('change',renderMacro);
for(const id of ['flow-window','flow-direction'])$(id).addEventListener('change',renderFlow);
$('demo-toggle').addEventListener('click',()=>{if(state.usingDemo){if(state.official)setData(state.official,false);else load()}else setData(window.__DEMO__,true);renderSource()});
if('serviceWorker'in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
load();
})();
