import test from 'node:test';
import assert from 'node:assert/strict';
import {SLOTS,local,at,upcoming,verifyText,sameSlot,sameText,DUENOX,FINANCE,CMA_DECISIONS,CMA_EDU,cmaPost} from '../src/publisher.mjs';
test('exactly eight Riyadh slots',()=>assert.deepEqual(SLOTS,['07:30','09:00','10:30','12:00','16:00','18:00','20:00','22:00']));
test('prepares a slot before its due time',()=>{const q=upcoming(new Date('2026-10-01T06:59:00Z'));assert.equal(q.slot,'10:30');assert.equal(q.due.toISOString(),'2026-10-01T07:30:00.000Z');});
test('handles Riyadh timezone and date rollover',()=>{assert.equal(local(new Date('2026-10-01T20:40:00Z')).day,1);assert.equal(at({year:2026,month:10,day:2},'07:30').toISOString(),'2026-10-02T04:30:00.000Z');});
test('reviewed finance bank has varied safe messages',()=>{assert.equal(FINANCE.length,40);for(const item of FINANCE)assert.doesNotThrow(()=>verifyText(item),item);});
test('blocks politics, investment advice, URLs and missing hashtags',()=>{for(const t of ['انتخابات اليوم #تاسي','اشتر الآن #تاسي','خبر https://example.com #تاسي','منشور بدون هاشتاق'])assert.throws(()=>verifyText(t));assert.equal(verifyText('معلومات مالية محايدة. للعلم. #تاسي'),'معلومات مالية محايدة. للعلم. #تاسي');});
test('matches only the selected publication slot',()=>{const due=new Date('2026-10-01T09:00:00Z');assert.equal(sameSlot({dueAt:'2026-10-01T09:00:50Z'},due),true);assert.equal(sameSlot({dueAt:'2026-10-01T09:05:00Z'},due),false);});
test('prevents exact duplicate regardless of hashtag',()=>{assert.equal(sameText('أخبار السوق #تاسي',[{text:'أخبار السوق #الأسهم'}]),true);assert.equal(sameText('أخبار الذهب #ذهب',[{text:'أخبار السوق #الأسهم'}]),false);});
test('all approved DueNox drafts satisfy basic safety constraints',()=>{assert.equal(DUENOX.length,16);for(const text of DUENOX)assert.equal(verifyText(text),text);});

test('CMA decisions remain dated and consultation is not described as approved',()=>{for(const item of CMA_DECISIONS){assert.match(item.date,/^2026-09-[0-9]{2}$/);assert.equal(verifyText(item.text),item.text);}for(const item of CMA_EDU)assert.equal(verifyText(item),item);assert.match(CMA_DECISIONS[1].text,/مشروع/);assert.match(CMA_DECISIONS[1].text,/لم يُعتمد/);});
test('CMA decision is preferred when recent and not used',()=>{const plan={index:4,day:{year:2026,month:10,day:1}},now=new Date('2026-10-01T12:00:00Z');assert.equal(cmaPost(plan,[],[],now),CMA_DECISIONS[0].text);assert.equal(cmaPost(plan,[{text:CMA_DECISIONS[0].text}],[],now),CMA_DECISIONS[1].text);});
