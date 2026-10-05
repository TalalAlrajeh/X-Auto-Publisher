import test from 'node:test';
import assert from 'node:assert/strict';
import {STOCKS,SAUDI_PROFILES,annualRows,summarizeAnnual,parseDaily,googleTrendMatch,analysisThread,qualitativeThread} from '../src/stock-analysis.mjs';
import {verifyText} from '../src/publisher.mjs';

function sampleFacts(){
 const annual=(val,end,start,filing)=>({val,end,start,form:'10-K',filed:filing});
 const current=tag=>annual(tag,'2025-12-31','2025-01-01','2026-02-10');
 const prior=tag=>annual(tag,'2024-12-31','2024-01-01','2025-02-15');
 return {cik:789019,facts:{'us-gaap':{
  RevenueFromContractWithCustomerExcludingAssessedTax:{units:{USD:[current(2e9),prior(1.8e9)]}},
  NetIncomeLoss:{units:{USD:[current(2e8),prior(1.5e8)]}},
  NetCashProvidedByUsedInOperatingActivities:{units:{USD:[current(3e8)]}},
  Assets:{units:{USD:[{val:4e9,end:'2025-12-31',form:'10-K',filed:'2026-02-10'}]}},
  Liabilities:{units:{USD:[{val:2e9,end:'2025-12-31',form:'10-K',filed:'2026-02-10'}]}}
 }}};
}
test('SEC annual comparison accepts only complete matching annual periods',()=>{
 const f=summarizeAnnual(sampleFacts(),new Date('2026-10-04T09:00:00Z'));
 assert.equal(f.revenue,2e9);assert.equal(f.profit,2e8);assert.ok(f.yoy>10&&f.yoy<12);
 assert.equal(f.margin,10);assert.equal(f.liabilitiesPct,50);
 assert.equal(annualRows(sampleFacts(),['bad']).length,0);
});
test('SEC incomplete filings fail closed',()=>assert.throws(()=>summarizeAnnual({facts:{'us-gaap':{}}})));
test('55 daily closes calculate trend and previous-range levels',()=>{
 const rows=['Date,Open,High,Low,Close,Volume'];
 for(let i=0;i<65;i++){
  const date=new Date(Date.UTC(2026,7,0+i)).toISOString().slice(0,10),v=100+i;
  rows.push([date,v,v+2,v-2,v,100000].join(','));
 }
 const p=parseDaily(rows.join('\n'),new Date('2026-10-04T09:00:00Z'));
 assert.equal(p.state,'صاعد');assert.ok(p.close>p.ma20&&p.ma20>p.ma50);
 assert.ok(p.high20<p.close+2);assert.equal(p.date,'2026-10-03');
});
test('price data without valid source or with stale latest close is rejected',()=>{
 assert.throws(()=>parseDaily('N/D'));
 assert.throws(()=>parseDaily('Date,Open,High,Low,Close,Volume\n2020-01-01,1,1,1,1,0'));
});
test('related Google search may inform hashtag but unrelated trends are ignored',()=>{
 const feed='<rss><item><title><![CDATA[Microsoft earnings]]></title></item><item><title>football match</title></item></rss>';
 assert.equal(googleTrendMatch(feed,STOCKS[0]),'Microsoft earnings');
 assert.equal(googleTrendMatch(feed,STOCKS[1]),null);
});
test('numerical analysis spans five safe X thread posts',()=>{
 const s=analysisThread(STOCKS[0],summarizeAnnual(sampleFacts(),new Date('2026-10-04T09:00:00Z')),
 {date:'2026-10-02',close:300,ma20:295,ma50:285,low20:280,high20:310,state:'صاعد'});
 assert.equal(s.thread.length,5);
 for(const part of s.thread)assert.equal(verifyText(part),part);
});
test('qualitative fallback names a particular Saudi stock and states live-data limits',()=>{
 const plan={day:{year:2026,month:10,day:4},index:6},s=qualitativeThread(plan,[]);
 assert.equal(s.length,4);assert.equal(SAUDI_PROFILES.length,5);
 assert.match(s[0],/خلنا نفكك سهم/);assert.match(s[3],/دعم ومقاومة/);
 for(const part of s)assert.equal(verifyText(part),part);
 assert.notDeepEqual(qualitativeThread({...plan,day:{year:2026,month:10,day:5}},[]),s);
});

test('officially disclosed Saudi figures are used only within their 120-day validity window',()=>{
 const plan={day:{year:2026,month:10,day:4},index:6};
 const thread=qualitativeThread(plan,[]);
 assert.equal(thread.length,4);
 for(const t of thread)assert.equal(verifyText(t),t);
 const aramco={...plan,day:{year:2026,month:10,day:5}};
 const item=qualitativeThread(aramco,[]);
 assert.equal(item.length,4);
 for(const part of item)assert.ok(part.length<=280);
 const verifiedCount=SAUDI_PROFILES.filter(p=>p.snapshot).length;
 assert.equal(verifiedCount,3);
 for(const p of SAUDI_PROFILES.filter(p=>p.snapshot)){
  assert.match(p.snapshot.published,/^2026-\d\d-\d\d$/);
  assert.ok(p.snapshot.text.includes('المصدر:'));
 }
});
