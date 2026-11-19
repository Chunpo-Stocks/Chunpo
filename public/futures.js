// V0.7.0 preview: read only the officially published EOD futures object.
// Public real-time/15-min-delayed quote re-distribution is intentionally disabled
// until matching exchange/provider display licenses are in place.
(()=>{'use strict';
const $=id=>document.getElementById(id);
const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const price=x=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('zh-TW',{maximumFractionDigits:2,minimumFractionDigits:2}):'—';
const clock=x=>{if(!x)return'未取得';const t=new Date(x);return Number.isNaN(t.valueOf())?'來源時間不明':t.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})};
function tile({name,code,status,value,sub,metadata,primary=false}){
 return `<article class="future-tile ${primary?'primary':''}"><div class="future-top"><div><h3>${escapeHtml(name)}</h3><div class="future-symbol">${escapeHtml(code)}</div></div><span class="pill ${status==='官方盤後'?'ok':'warning'}">${escapeHtml(status)}</span></div><div class="future-value">${value}</div><p class="future-sub">${escapeHtml(sub)}</p><div class="future-metadata">${metadata.map(x=>escapeHtml(x)).join('<br>')}</div></article>`;
}
function render(data){
 const cards=$('futures-cards');if(!cards)return;
 const ft=data?.marketData?.futures||null, txDay=ft?.day||null,txNight=ft?.night||null;
 const good=ft?.status==='ok' && /^\d{6}$/.test(ft.contractMonth||'') && txDay && typeof txDay.close==='number' && Number.isFinite(txDay.close);
 const month=good?ft.contractMonth.slice(0,4)+'/'+ft.contractMonth.slice(4,6):'未確認';
 const sourceDate=good?ft.date||txDay.d||'未取得':'未取得';
 const isSameContract=!!(good&&txNight&&txNight.contractMonth===ft.contractMonth);
 cards.innerHTML=[
 tile({name:'臺指期',code:'TAIFEX · TX',status:good?'官方盤後':'資料不足',
   value:good?price(txDay.close):'—',sub:good?'日盤最後可用報價（非即時）':'等待官方期貨資料',
   metadata:['契約月份：'+month,'日盤日期：'+(txDay?.d||'未取得'),'夜盤：'+(isSameContract?price(txNight.close)+'（'+txNight.d+'）':'未取得同月有效資料'),'來源：期交所公開日報'],primary:true}),
 tile({name:'微型臺指',code:'TAIFEX · MTX / TMF',status:'尚未接入',
   value:'—',sub:'不以 TX 點位當作微型契約實際報價',metadata:['獨立契約資料：未接入','行情時間：—','公開授權：待確認']}),
 tile({name:'富台指',code:'SGX · TWN / STWN&',status:'外部延遲行情',
   value:'—',sub:'玩股網另提供延遲約 15 分鐘的行情頁',metadata:['APP 內報價：未授權接入','行情更新：請至來源網站','交易所：SGX'],primary:true}),
 tile({name:'微型富台指',code:'SGX · MTWN',status:'尚未接入',
   value:'—',sub:'等待 SGX 授權資料與合約核驗',metadata:['行情與契約月份：未取得','行情時間：—','公開授權：待確認']})
 ].join('');
 const stamp=$('futures-last-built'),status=$('futures-status');
 if(stamp)stamp.textContent='中央盤後資料產生：'+clock(data?.generatedAt)+'｜台指期來源日：'+sourceDate;
 if(status){status.className='pill '+(good?'ok':'warning');status.textContent=good?'TX 官方盤後已連接':'TX 官方盤後資料不足';}
}
window.ChunpoFutures={render};
})();
