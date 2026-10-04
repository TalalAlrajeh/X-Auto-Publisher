// Free, fail-closed company research: SEC annual financial statements and delayed daily prices.
export const STOCKS=[
 {symbol:'MSFT',name:'مايكروسوفت',cik:'0000789019',aliases:['microsoft','مايكروسوفت','msft']},
 {symbol:'AAPL',name:'آبل',cik:'0000320193',aliases:['apple','آبل','aapl']},
 {symbol:'NVDA',name:'إنفيديا',cik:'0001045810',aliases:['nvidia','إنفيديا','انفيديا','nvda']},
 {symbol:'AMZN',name:'أمازون',cik:'0001018724',aliases:['amazon','أمازون','امازون','amzn']},
 {symbol:'GOOGL',name:'ألفابت',cik:'0001652044',aliases:['alphabet','google','جوجل','googl']},
 {symbol:'META',name:'ميتا',cik:'0001326801',aliases:['meta platforms','ميتا']}
];
const REVENUES=['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet','RevenueFromContractWithCustomerIncludingAssessedTax'];
const CENSORED=/(حرب|انتخاب|سياس|هجوم|جيوسياس|geopolitic|warfare|election|اشتر|اشتري|بع الآن|توصية)/iu;
export function annualRows(facts,tags,instant=false){
 const gaap=facts?.facts?.['us-gaap'];
 if(!gaap)throw Error('SEC XBRL US-GAAP unavailable');
 for(const tag of tags){
  const array=gaap[tag]?.units?.USD||[], rows=array.filter(x=>{
   if(x.form!=='10-K'||!Number.isFinite(x.val)||!x.filed||!x.end)return false;
   if(instant)return true;
   if(!x.start)return false;
   const days=(Date.parse(x.end)-Date.parse(x.start))/86400000;
   return days>=310&&days<=395;
  }),byDate=new Map();
  for(const row of rows){const old=byDate.get(row.end);if(!old||old.filed<row.filed)byDate.set(row.end,row);}
  const result=[...byDate.values()].sort((a,b)=>b.end.localeCompare(a.end));
  if(result.length)return result;
 }
 return [];
}
export function summarizeAnnual(facts,now=new Date()){
 const rev=annualRows(facts,REVENUES),net=annualRows(facts,['NetIncomeLoss','ProfitLoss']),
  cash=annualRows(facts,['NetCashProvidedByUsedInOperatingActivities']),
  assets=annualRows(facts,['Assets'],true),liabs=annualRows(facts,['Liabilities'],true);
 for(const r of rev){
  const p=net.find(x=>x.end===r.end),c=cash.find(x=>x.end===r.end),
   a=assets.find(x=>x.end===r.end),l=liabs.find(x=>x.end===r.end),
   prior=rev.find(x=>{const days=(Date.parse(r.end)-Date.parse(x.end))/86400000;return days>=330&&days<=400;});
  const age=(now-Date.parse(r.filed))/86400000;
  if(!p||!c||!a||!l||!prior||!r.val||!prior.val||a.val<=0||age<0||age>490)continue;
  return {end:r.end,filed:r.filed,revenue:r.val,yoy:(r.val/prior.val-1)*100,
   profit:p.val,margin:p.val/r.val*100,operatingCash:c.val,assets:a.val,
   liabilities:l.val,liabilitiesPct:l.val/a.val*100};
 }
 throw Error('No comparable annual financial statements verified within 490 days');
}
export function parseDaily(csv,now=new Date()){
 const lines=String(csv).trim().split(/\r?\n/);
 if(lines[0]?.trim()!=='Date,Open,High,Low,Close,Volume')throw Error('Price CSV missing expected header');
 const dates=lines.slice(1).map(s=>{const [date,o,h,l,c,v]=s.split(',');return {date,high:Number(h),low:Number(l),close:Number(c),volume:Number(v)};})
  .filter(x=>/^\d{4}-\d\d-\d\d$/.test(x.date)&&x.close>0&&x.high>=x.low&&x.low>0&&x.volume>=0);
 const rows=[...new Map(dates.map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(rows.length<55)throw Error('Fewer than 55 valid daily price records');
 const current=rows.at(-1),age=(now-Date.parse(current.date+'T23:59:59Z'))/86400000;
 if(age>8||age< -1)throw Error('No recent verified daily close');
 const avg=values=>values.reduce((sum,v)=>sum+v,0)/values.length;
 const ma20=avg(rows.slice(-20).map(x=>x.close)),ma50=avg(rows.slice(-50).map(x=>x.close));
 const prior=rows.slice(-21,-1);
 return {date:current.date,close:current.close,ma20,ma50,
  low20:Math.min(...prior.map(x=>x.low)),high20:Math.max(...prior.map(x=>x.high)),
  state:current.close>ma20&&ma20>ma50?'صاعد':current.close<ma20&&ma20<ma50?'هابط':'متذبذب'};
}
export function googleTrendMatch(xml,stock){
 const items=[...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/giu)].slice(0,50);
 for(const item of items){
  const title=(item[1].match(/<title>([\s\S]*?)<\/title>/iu)?.[1]||'').replace(/<!\[CDATA\[|\]\]>/gu,'').replace(/&amp;/gu,'&').replace(/<[^>]+>/gu,'').trim();
  if(CENSORED.test(title))continue;
  const txt=title.toLocaleLowerCase('en');
  if(stock.aliases.some(alias=>alias.length>=4&&txt.includes(alias)))return title;
 }
 return null;
}
export function analysisThread(stock,finance,price,match=null){
 if(!stock||!finance||!price)throw Error('Unverified analysis');
 const billions=n=>(n/1e9).toFixed(1)+' مليار دولار',usd=n=>n.toFixed(2)+' دولار';
 const percent=n=>(n>=0?'+':'')+n.toFixed(1)+'%';
 const thread=[
  '📊 تحليل سهم '+stock.name+' ('+stock.symbol+'): نتائج الشركة للسنة المنتهية '+finance.end+'، والقراءة الفنية عند إغلاق '+price.date+'. #'+stock.symbol+' #الأسهم_الأمريكية',
  'ماليًا: الإيرادات '+billions(finance.revenue)+' (تغير سنوي '+percent(finance.yoy)+')، وصافي الربح '+billions(finance.profit)+
    '، والهامش الصافي '+percent(finance.margin)+'. التدفقات التشغيلية '+billions(finance.operatingCash)+'. المصدر: التقرير السنوي 10-K عبر SEC. #تحليل_مالي',
  'المركز المالي: أصول '+billions(finance.assets)+' والتزامات '+billions(finance.liabilities)+' ('+percent(finance.liabilitiesPct)+
    ' من الأصول). الالتزامات ليست كلها ديونًا، ويجب قراءة هذه النسبة مع طبيعة أعمال الشركة وتدفقاتها. #القوائم_المالية',
  'فنيًا: الإغلاق '+usd(price.close)+'، ومتوسط 20 جلسة '+usd(price.ma20)+'، و50 جلسة '+usd(price.ma50)+
    '. الاتجاه الوصفي '+price.state+'. نطاق آخر 20 جلسة سابقة: '+usd(price.low20)+'–'+usd(price.high20)+'. بيانات إغلاق Stooq غير لحظية. #'+stock.symbol,
  'المسار المحتمل: الثبات فوق '+usd(price.high20)+' بإغلاقات مؤكدة قد يدعم تحسن الاتجاه؛ والعودة دون '+usd(price.low20)+
    ' تضعف القراءة الفنية. المستويات تاريخية وليست أهدافًا أو ضمانات. معلومات وصفية لا تمثل تعليمات تداول. #'+stock.symbol
 ];
 for(const part of thread)if([...part].length>280||CENSORED.test(part))throw Error('Unsafe or overlong thread part');
 return {thread,googleTrend:match};
}
async function get(url,timeout=13000,headers={}){
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw Error('HTTP '+response.status+' from '+new URL(url).hostname);
 return response;
}
export async function prepareStockAnalysis(plan,history,now=new Date()){
 const day=Math.floor(Date.UTC(plan.day.year,plan.day.month-1,plan.day.day)/86400000);
 for(let i=0;i<Math.min(STOCKS.length,2);i++){
  const stock=STOCKS[(day+i)%STOCKS.length];
  if(history.some(p=>p.text?.includes('تحليل سهم '+stock.name+' ('+stock.symbol+')')))continue;
  try{
   const ua='X-Auto-Publisher/1.0 ('+(process.env.SEC_CONTACT_EMAIL||'contact via GitHub TalalAlrajeh/X-Auto-Publisher issues')+')';
   const data=await (await get('https://data.sec.gov/api/xbrl/companyfacts/CIK'+stock.cik+'.json',13000,{'User-Agent':ua,'Accept':'application/json'})).json();
   if(data.cik!==Number(stock.cik))throw Error('SEC company identity mismatch');
   const finance=summarizeAnnual(data,now);
   const begin=new Date(now.getTime()-180*86400000).toISOString().slice(0,10).replace(/-/g,'');
   const end=now.toISOString().slice(0,10).replace(/-/g,'');
   const csv=await (await get('https://stooq.com/q/d/l/?s='+stock.symbol.toLowerCase()+'.us&i=d&d1='+begin+'&d2='+end)).text();
   const price=parseDaily(csv,now);
   let matched=null;
   try{const feed=await (await get('https://trends.google.com/trending/rss?geo=SA',6500)).text();matched=googleTrendMatch(feed,stock);}
   catch(e){console.log('Google Trends feed unavailable; relevant non-trending tags only:',e.message);}
   const analysis=analysisThread(stock,finance,price,matched);
   console.log('Verified',stock.symbol,'SEC filed:',finance.filed,'daily close:',price.date,
    matched?'Related Google search trend: '+matched:'No verified matching trend; using relevant tags');
   return analysis.thread;
  }catch(e){console.log('Stock data rejected for',stock.symbol,e.message);}
 }
 throw Error('No company with fully verifiable financial and price records');
}

export const SAUDI_PROFILES=[
 {symbol:'2222',name:'أرامكو السعودية',activity:'إنتاج النفط والغاز والتكرير والبتروكيماويات',
  finances:'متوسط أسعار البيع وحجم الإنتاج والإنفاق الرأسمالي والتدفقات الحرة وتغطية التوزيعات',
  snapshot:{published:'2026-08-04',period:'الربع الثاني 2026',text:'صافي الدخل المعدل 125.2 مليار ريال، والتدفقات التشغيلية 95.4 مليار ريال، والتدفقات الحرة 46 مليار ريال، ونسبة المديونية 6.2%. المصدر: النتائج الرسمية لأرامكو المنشورة 4 أغسطس.'}, 
  strong:'تحسن أسعار البيع أو التدفق النقدي مع انضباط الإنفاق',weak:'ضغط الهوامش أو تراجع التدفقات مقابل الالتزامات',tag:'#أرامكو'},
 {symbol:'7010',name:'الاتصالات السعودية STC',activity:'الاتصالات والبنية الرقمية والخدمات التقنية',
  finances:'نمو إيرادات الخدمات والهوامش والتدفق التشغيلي والإنفاق على الشبكات وصافي المديونية',
  snapshot:{published:'2026-07-29',period:'النصف الأول 2026',text:'الإيرادات 40.110 مليار ريال (+3.75% سنويًا)، والربح العائد للمساهمين 7.319 مليار ريال (-2.05%). حقوق مساهمي الشركة 84.986 مليار ريال. المصدر: إعلان STC في تداول السعودية.'},
  strong:'نمو الأعمال الرقمية وتحسن الهوامش والتدفقات',weak:'تباطؤ نمو الخدمات أو ارتفاع تكلفة التوسع',tag:'#STC'},
 {symbol:'1120',name:'مصرف الراجحي',activity:'التمويل والخدمات المصرفية المتوافقة مع أحكام الشريعة',
  finances:'صافي دخل التمويل ونمو المحفظة وتكلفة الائتمان ونسبة القروض المتعثرة وكفاية رأس المال',
  snapshot:{published:'2026-07-21',period:'النصف الأول 2026',text:'الربح الصافي 13.764 مليار ريال (+14% سنويًا)، وإجمالي دخل العمليات 21.413 مليار ريال، والموجودات 1.055 تريليون ريال، وودائع العملاء 688 مليار ريال. المصدر: إعلان المصرف 21 يوليو.'},
  strong:'نمو التمويل بضوابط ائتمانية وتكلفة مخاطر مستقرة',weak:'ارتفاع المخصصات أو ضغط الهوامش التمويلية',tag:'#الراجحي'},
 {symbol:'2010',name:'سابك',activity:'الصناعات البتروكيماوية والكيماويات',
  finances:'هوامش المنتجات وتكلفة اللقيم والطلب العالمي والتدفق التشغيلي ومديونية الشركة',
  strong:'تحسن فروق أسعار المنتجات والطلب التشغيلي',weak:'تراجع الهوامش أو ارتفاع تكاليف الإنتاج',tag:'#سابك'},
 {symbol:'2082',name:'أكوا باور',activity:'تطوير وتشغيل مشاريع الطاقة والمياه',
  finances:'المشاريع قيد التنفيذ وتكاليف التمويل والتدفق التشغيلي والديون المرتبطة بالمشاريع',
  strong:'بدء التشغيل وتحسن تحصيل التدفقات من المشاريع',weak:'تأخر التشغيل أو زيادة تكلفة التمويل',tag:'#أكوا_باور'}
];
export function qualitativeThread(plan,history){
 const ordinal=Math.floor(Date.UTC(plan.day.year,plan.day.month-1,plan.day.day)/86400000);
 for(let i=0;i<SAUDI_PROFILES.length;i++){
  const company=SAUDI_PROFILES[(ordinal+i)%SAUDI_PROFILES.length];
  const snapshot=company.snapshot,age=snapshot?(Date.UTC(plan.day.year,plan.day.month-1,plan.day.day)-Date.parse(snapshot.published+'T00:00:00Z'))/86400000:9999;
  const verified=Boolean(snapshot&&age>=0&&age<=120);
  const thread=[
   '📊 تحليل سهم '+company.name+' ('+company.symbol+'): تعمل الشركة في '+company.activity+'. القراءة التالية تميّز بين الأرقام المعلنة وعوامل الأداء، ولا تدّعي سعرًا لحظيًا. '+company.tag+' #الأسهم_السعودية',
   verified?'النتائج المعلنة عن '+snapshot.period+': '+snapshot.text+' '+company.tag:
    'قراءة النشاط: تتأثر '+company.name+' بعوامل تشغيلية وتمويلية مختلفة؛ البيانات المالية الحديثة غير متاحة للتحقق هنا، لذلك لا نعرض أرقامًا أو حكمًا قاطعًا عن مركزها المالي. '+company.tag,
   'ماليًا: أبرز ما يُراجع عند تقييم '+company.name+' هو '+company.finances+'. لا يكفي رقم الربح منفردًا؛ الأهم مقارنته بالفترة المماثلة والتدفقات والمركز المالي. #تحليل_مالي',
   'المسار المحتمل: تحسّن الصورة إذا تحقق '+company.strong+'؛ أما '+company.weak+' فيمثّل ضغطًا محتملًا. فنيًا لا نضع دعمًا أو مقاومة رقمية من دون أسعار إغلاق حديثة موثوقة. '+company.tag
  ];
  const dated=thread.map(t=>t+' | '+plan.day.day+'/'+plan.day.month+'/'+plan.day.year);
  if(dated.some(t=>t.length>280||CENSORED.test(t)))continue;
  if(history.some(p=>p.text===dated[0]))continue;
  return dated;
 }
 throw Error('No unused company profile available');
}
