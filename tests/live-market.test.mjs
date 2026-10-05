import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRss,category,score,buildInsight,chooseInsight,parseTreasury} from '../src/live-market.mjs';

const feed='<rss><channel><item><title>ارتفاع إجمالي إنفاق المستهلكين إلى 142 مليار ريال (+6%) في أغسطس 2026</title><description><![CDATA[ارتفعت مبيعات التجارة الإلكترونية عبر مدى إلى 36.95 مليار ريال وبنسبة 26% مقارنة بالفترة المماثلة. حسب بيانات البنك المركزي السعودي ساما.]]></description><pubDate>Mon, 05 Oct 2026 14:20:00 GMT</pubDate></item><item><title>روسيا تهدد في تطورات الحرب</title><description>خبر سياسي</description><pubDate>Mon, 05 Oct 2026 14:21:00 GMT</pubDate></item></channel></rss>';

test('RSS investment item becomes a numeric investor-focused tweet with two hashtags',()=>{
 const items=parseRss(feed,'أرقام - آخر الأخبار');
 assert.equal(items.length,2);
 assert.equal(category(items[0]),'consumer');
 const text=buildInsight(items[0]);
 assert.match(text,/142 مليار/);
 assert.match(text,/36.95 مليار/);
 assert.match(text,/26%/);
 assert.ok((text.match(/#[^\s#]+/gu)||[]).length>=2);
 assert.ok([...text].length<=280);
});

test('political items are rejected even when fresh',()=>{
 const items=parseRss(feed,'أرقام - آخر الأخبار');
 const now=new Date('2026-10-05T11:30:00Z');
 assert.ok(score(items[0],3,now)>0);
 assert.equal(score(items[1],3,now),-999);
});

test('chooser prefers high value fresh item and prevents exact duplicate',()=>{
 const items=parseRss(feed,'أرقام - آخر الأخبار'),now=new Date('2026-10-05T11:30:00Z');
 const first=chooseInsight(items,[],3,now);
 assert.ok(first);
 const second=chooseInsight(items,[{text:first.text}],3,now);
 assert.equal(second,null);
});

test('Treasury XML extracts the latest yield curve points',()=>{
 const xml='<feed><entry><content><m:properties><d:NEW_DATE>2026-10-02T00:00:00</d:NEW_DATE><d:BC_3MONTH>3.50</d:BC_3MONTH><d:BC_2YEAR>3.60</d:BC_2YEAR><d:BC_10YEAR>4.20</d:BC_10YEAR><d:BC_30YEAR>4.80</d:BC_30YEAR></m:properties></content></entry></feed>';
 assert.deepEqual(parseTreasury(xml),{date:'2026-10-02T00:00:00',mo3:3.5,yr2:3.6,yr10:4.2,yr30:4.8});
});

test('material contract headlines are treated as growth stories',()=>{
 const item={title:'إم آي إس تستلم أمر العمل رقم 2 من هيوماين بقيمة تتجاوز 135% من إيرادات 2025',description:'',pubDate:'Mon, 05 Oct 2026 14:00:00 GMT',feed:'أرقام - الشركات'};
 assert.equal(category(item),'growth');
 const text=buildInsight(item);
 assert.match(text,/أسهم_النمو/);
 assert.match(text,/135%/);
});
