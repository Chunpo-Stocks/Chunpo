import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ROOT,summary} from './build.mjs';
import {institutionalWindows} from '../engine.mjs';
const dates=[];let end=Date.parse('2026-11-17T00:00:00Z');
for(let i=0;dates.length<330;i++){let d=new Date(end-i*86400000);if(![0,6].includes(d.getUTCDay()))dates.push(d.toISOString().slice(0,10))}dates.reverse();
const configs=[
 ['DEMO1','示範多頭 A','上市',i=>45+.18*i+3*Math.sin(i/8)],
 ['DEMO2','示範空頭 B','上櫃',i=>135-.23*i+2*Math.cos(i/6)],
 ['DEMO3','示範盤整 C','上市',i=>68+.012*i+4*Math.sin(i/12)],
 ['DEMO4','示範轉強 D','上市',i=>i<280?45-.028*i:37+.4*(i-280)+2*Math.sin(i/5)],
 ['DEMO5','示範轉弱 E','上櫃',i=>i<280?32+.13*i:68-.45*(i-280)+1.5*Math.sin(i/5)],
 ['DEMO6','示範 W 底 F','上櫃',i=>i<265?35+.13*i:(i<282?65-(i-265)*.9:i<298?49+(i-282)*1.02:i<309?65-(i-298)*1.2:52+(i-309)*.88)]
];
const stocks=[],details={};
for(const [code,name,market,fn] of configs){const bars=dates.map((d,i)=>{const c=Math.max(3,fn(i));let o=c*(1+.008*Math.sin(i*1.3)),h=Math.max(c,o)*1.012,l=Math.min(c,o)*.988,v=Math.round(330000+120000*(1+Math.sin(i/4))+i*1400);return{d,o,h,l,c,v,source:'DEMO_ONLY'}});
 const institutions=dates.slice(-80).map((d,i)=>({d,foreign:Math.round((Math.sin(i*1.5)+.2)*35000),trust:Math.round((Math.cos(i*.7)+.1)*15000),dealer:0,source:'DEMO_ONLY'}));
 const s={code,name,market,bars,institutions};let r=summary(s);stocks.push(r);details[code]={...r,bars,institutions,chips:institutionalWindows(s)};
}
const payload={version:'股_V0.6.3',mode:'demo',generatedAt:'2026-11-18T06:00:00Z',markets:{上市:{date:'2026-11-17',status:'demo',count:3},上櫃:{date:'2026-11-17',status:'demo',count:3}},rows:stocks,
  stats:{tracked:stocks.length,yearlineReady:stocks.filter(x=>x.ready).length},sources:[],details};
await writeFile(join(ROOT,'public','data','demo.js'),'window.__DEMO__ = '+JSON.stringify(payload)+';\n');
console.log('產生人造示範數據',stocks.length,'筆，非真實行情');
