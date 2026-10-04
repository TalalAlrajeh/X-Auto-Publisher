import test from 'node:test';
import assert from 'node:assert/strict';
import {titlesFromRss,matchingTag,addRelevantSearchTag} from '../src/trend-tags.mjs';
test('financial search trend must match the actual tweet topic',()=>{
 const rss='<rss><item><title><![CDATA[أرامكو السعودية]]></title></item><item><title>مباراة السعودية</title></item><item><title>هجوم على أرامكو</title></item></rss>';
 const titles=titlesFromRss(rss);
 assert.deepEqual(titles,['أرامكو السعودية','مباراة السعودية']);
 assert.equal(matchingTag('ملخص قراءة سهم أرامكو #أرامكو',titles),'#أرامكو_السعودية');
 assert.equal(matchingTag('تحليل سهم الراجحي #الراجحي',titles),null);
});
test('a trending hashtag never duplicates itself and no trend is invented',()=>{
 const rss='<rss><item><title>أسعار الذهب اليوم</title></item></rss>';
 assert.equal(matchingTag('تغير الذهب #الذهب',titlesFromRss(rss)),null);
 assert.equal(matchingTag('ملخص النفط #النفط',titlesFromRss(rss)),null);
});
test('an eligible matching search adds just one topical tag within the X character limit',async()=>{
 const rss='<rss><item><title>أرامكو السعودية</title></item></rss>';
 const t=await addRelevantSearchTag('تحليل سهم أرامكو #أرامكو',{xml:rss});
 assert.equal(t,'تحليل سهم أرامكو #أرامكو #أرامكو_السعودية');
 const long='أرامكو '+'م'.repeat(265)+' #أرامكو';
 assert.equal(await addRelevantSearchTag(long,{xml:rss}),long);
});
