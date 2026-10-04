// Google Trends reports popular SEARCHES, not X's trending-hashtag ranking.
// An optional second hashtag is added only when a recent Saudi search matches the tweet's topic.
export const MATCHES=[
 {words:['أرامكو','aramco'],tag:'#أرامكو_السعودية'},
 {words:['الراجحي','al rajhi'],tag:'#مصرف_الراجحي'},
 {words:['سابك','sabic'],tag:'#سابك_السعودية'},
 {words:['أكوا باور','acwa power'],tag:'#أكوا_باور'},
 {words:['stc','الاتصالات السعودية'],tag:'#الاتصالات_السعودية'},
 {words:['مايكروسوفت','microsoft'],tag:'#مايكروسوفت'},
 {words:['آبل','apple'],tag:'#آبل'},
 {words:['إنفيديا','nvidia'],tag:'#إنفيديا'},
 {words:['أمازون','amazon'],tag:'#أمازون'},
 {words:['ألفابت','alphabet','google'],tag:'#ألفابت'},
 {words:['ميتا','meta platforms'],tag:'#ميتا'},
 {words:['تاسي','tasi','السوق السعودي'],tag:'#تاسي'},
 {words:['الذهب','gold'],tag:'#الذهب'},
 {words:['النفط','oil prices','brent'],tag:'#النفط'},
 {words:['الفائدة','interest rate'],tag:'#أسعار_الفائدة'}
];
const UNSAFE=/(حرب|هجوم|حريق|صراع|انفجار|تفجير|اغتيال|انتخاب|سياس|جيوسياس|war|attack|fire|missile|election|geopolitic)/iu;
const clean=s=>String(s||'').toLocaleLowerCase('en').replace(/<!\[CDATA\[|\]\]>/giu,'').replace(/&amp;/gu,'&').replace(/<[^>]+>/gu,'').trim();
export function titlesFromRss(xml){
 return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/giu)].slice(0,50)
  .map(x=>clean(x[1].match(/<title>([\s\S]*?)<\/title>/iu)?.[1]))
  .filter(title=>title&&!UNSAFE.test(title));
}
export function matchingTag(post,titles){
 const text=clean(post);
 for(const topic of MATCHES){
  if(text.includes(topic.tag.toLocaleLowerCase('en')))continue;
  if(!topic.words.some(alias=>text.includes(alias.toLocaleLowerCase('en'))))continue;
  if(titles.some(title=>topic.words.some(alias=>title.includes(alias.toLocaleLowerCase('en')))))
    return topic.tag;
 }
 return null;
}
export async function addRelevantSearchTag(post,{xml=null}={}){
 try{
  if(xml===null){
   const response=await fetch('https://trends.google.com/trending/rss?geo=SA',{signal:AbortSignal.timeout(6500)});
   if(!response.ok)return post;
   xml=await response.text();
  }
  const tag=matchingTag(post,titlesFromRss(xml));
  if(tag&&post.length+tag.length+1<=275)return post+' '+tag;
 }catch(error){console.log('Search trends unavailable; preserving topical hashtags:',error.message);}
 return post;
}
