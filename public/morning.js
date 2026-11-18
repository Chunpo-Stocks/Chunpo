// 股_V0.6.8 morning plan viewer. Only reads centrally published, dated JSON.
(()=>{
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
 const money=x=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
 const chosen=()=>[...document.querySelectorAll('.morning-check:checked')].map(x=>x.value);
 let snapshot=null;
 async function load(){
  $('morning-meta').textContent='讀取最新中央盤前計畫中……';
  try{
   const response=await fetch('./data/morning-plan.json?t='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(data?.version!=='股_V0.6.8'||!data?.bySide)throw Error('盤前計畫檔案尚未更新到 V0.6.8');
   snapshot=data;render();
  }catch(err){
   snapshot=null;
   $('morning-meta').textContent='目前沒有可用的正式盤前計畫：'+err.message;
   $('morning-content').innerHTML='<div class="empty">需要完成 GitHub Actions 07:00 更新及 GitHub Pages 發布；不會顯示人造候選。</div>';
   $('morning-count').textContent='尚未完成';
  }
 }
 function render(){
  if(!snapshot)return;
  const d=snapshot,side=$('morning-side').value,kind=$('morning-kind').value,select=chosen();
  const stamp=d.generatedAt?new Date(d.generatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'未知';
  $('morning-meta').innerHTML='參考目標日：<strong>'+esc(d.targetDate||'尚未取得')+'</strong>　｜　上市行情：'+esc(d.referenceDates?.['上市']||'—')+'　｜　上櫃行情：'+esc(d.referenceDates?.['上櫃']||'—')+'　｜　計畫產生時間：'+esc(stamp)+
  '<p>策略邏輯：<b>符合任一已選策略即可入榜</b>；每種策略各自保留獨立門檻。'+(d.warnings||[]).map(w=>'<span class="morning-warn">'+esc(w)+'</span>').join('')+'</p>';
  let rows=(d.bySide?.[side]?.[kind]||[]).filter(x=>select.length && (kind==='combined'?(x.matchedStrategies||[]).some(s=>select.includes(s)):select.includes(kind)));
  if(kind==='combined')rows.sort((a,b)=>(b.matchedStrategies||[]).filter(s=>select.includes(s)).length-(a.matchedStrategies||[]).filter(s=>select.includes(s)).length || b.bestScore-a.bestScore);
  rows=rows.slice(0,10);
  $('morning-count').textContent='顯示 '+rows.length+' 檔；各類排行榜最多前 10 檔。沒有符合條件即顯示空榜，不會造數。';
  if(!select.length){$('morning-content').innerHTML='<div class="empty">請至少勾選一種策略。</div>';return;}
  if(!rows.length){$('morning-content').innerHTML='<div class="empty">目前選定策略沒有資料充分且符合條件的候選。可選擇其他策略或檢查前一交易日行情。</div>';return;}
  const names={stable:'穩健型',breakout:'突破型',reversal:'反轉型'};
  $('morning-content').innerHTML='<div class="tablewrap"><table><thead><tr><th>股票／策略</th><th>資料日／收盤</th><th>條件式進場區</th><th>突破／跌破觸發價</th><th>停損參考</th><th>目標一／二</th><th>風險報酬比</th><th>狀態／入選依據</th></tr></thead><tbody>'+rows.map(x=>{
   const isLowRisk=typeof x.rr==='number'&&x.rr>=2;
   const strategyLabels=(x.matchedStrategies?.length?x.matchedStrategies:[x.kind]).filter(k=>select.includes(k)).map(k=>names[k]||k).join('＋');
   return '<tr><td><button class="stock-btn morning-stock" data-code="'+esc(x.code)+'">'+esc(x.name)+'<span class="code">'+esc(x.code)+'</span></button><small>'+esc(strategyLabels)+'</small></td>'+
    '<td>'+esc(x.date)+'<div class="muted">'+money(x.close)+'</div></td>'+
    '<td>'+money(x.entryLow)+'～'+money(x.entryHigh)+'</td>'+
    '<td><b>'+money(x.breakout)+'</b></td>'+
    '<td>'+money(x.stop)+'</td>'+
    '<td>'+money(x.target1)+' ／ '+money(x.target2)+'</td>'+
    '<td class="'+(isLowRisk?'pos':'neg')+'">'+(x.rr===null?'不足資料':money(x.rr)+' : 1')+'</td>'+
    '<td><strong class="'+(isLowRisk?'pos':'neg')+'">'+esc(x.riskLabel||'待確認')+'</strong><div class="muted">'+esc((x.reasons||[]).join('；'))+'</div></td></tr>';
  }).join('')+'</tbody></table></div>';
  document.querySelectorAll('.morning-stock').forEach(btn=>btn.addEventListener('click',()=>{
   document.querySelector('button[data-tab="detail"]')?.click();
   const search=$('detail-query');if(search)search.value=btn.dataset.code;
   $('detail-go')?.click();
  }));
 }
 document.querySelectorAll('.morning-check').forEach(el=>el.addEventListener('change',render));
 for(const id of ['morning-side','morning-kind'])$(id).addEventListener('change',render);
 $('morning-reload').addEventListener('click',load);
 document.querySelector('button[data-tab="morning"]')?.addEventListener('click',()=>{if(!snapshot)load();else render();});
 load();
})();