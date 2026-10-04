import {pathToFileURL} from 'node:url';
import {prepareStockAnalysis,qualitativeThread} from './stock-analysis.mjs';
import {addRelevantSearchTag} from './trend-tags.mjs';
export const SLOTS=['07:30','09:00','10:30','12:00','16:00','18:00','20:00','22:00'];
const TZ='Asia/Riyadh', API='https://api.buffer.com';
const BLOCK=/(انتخاب|سياس(?:ة|ي|يين)|حرب|جيوسياس|إرهاب|ارهاب|صراع|هجوم|اشتر|اشتري|شراء الآن|بع الآن|ادخل الآن|سهم ناري|انهيار|هدف مضمون|ربح مضمون|توصية|فرصة لا تعوض|buy now|sell now|guaranteed|election|geopolitic|warfare)/iu;
export const DUENOX=[
'هل ما زلت تتابع ديون العملاء في دفتر ورقي؟ يجمع DueNox حسابات العملاء والديون والدفعات في سجل رقمي. duenox.com #DueNox #إدارة_الديون',
'مع DueNox يمكنك تسجيل دفعات العملاء وتحديث حساباتهم. duenox.com #DueNox #المشاريع_الصغيرة',
'يتيح DueNox سجلًا للموردين لمتابعة حساباتهم من مكان واحد. duenox.com #DueNox #إدارة_الأعمال',
'إذا كان لمشروعك عدة فروع، يتيح DueNox إدارة الفروع والمستخدمين المرتبطين بكل فرع. duenox.com #DueNox #التجارة',
'من ميزات DueNox تحديد حد ائتماني للعملاء لتنظيم التعاملات الآجلة. duenox.com #DueNox #إدارة_الائتمان',
'يوفر DueNox القائمة السوداء للعملاء ضمن أدوات متابعة الحسابات. duenox.com #DueNox #إدارة_العملاء',
'يتيح DueNox تقارير وخيارات تصدير لمتابعة بيانات متجرك. duenox.com #DueNox #التقارير',
'يدعم DueNox العربية والإنجليزية، وتسجيل الدخول برمز OTP عبر البريد. duenox.com #DueNox #الأعمال',
'يوفر DueNox تنبيهات تساعدك على متابعة حسابات العملاء وإدارة الديون. duenox.com #DueNox #إدارة_المتاجر',
'تابع حسابات العملاء والموردين وسجّل الدفعات عبر DueNox. duenox.com #DueNox #التجارة',
'يوفر DueNox مستخدمين لكل فرع ضمن إدارة أعمالك. duenox.com #DueNox #الفروع',
'تتيح أدوات DueNox متابعة سجل العميل وحده الائتماني داخل النظام. duenox.com #DueNox #المتاجر',
'من دفتر العملاء إلى تقارير الأرصدة والتصدير: أدوات DueNox لمتابعة حسابات النشاط. duenox.com #DueNox #إدارة_الأعمال',
'احفظ سجل الدفعات والمبالغ المستحقة للعملاء في DueNox. duenox.com #DueNox #إدارة_الديون',
'واجهة DueNox بالعربية والإنجليزية تساعد على متابعة العملاء والفروع. duenox.com #DueNox #المشاريع_الصغيرة',
'ينظم DueNox حسابات الموردين والعملاء والدفعات في نظام واحد. duenox.com #DueNox #الموردين'
];
export function local(d=new Date()){return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
export function at(p,slot){const [h,m]=slot.split(':').map(Number);return new Date(Date.UTC(p.year,p.month-1,p.day,h-3,m));}
export function upcoming(now=new Date()){const p=local(now),base=new Date(Date.UTC(p.year,p.month-1,p.day,12));for(let day=0;day<=1;day++){const q=local(new Date(base.getTime()+day*86400000));for(let i=0;i<SLOTS.length;i++){const due=at(q,SLOTS[i]);const minutes=(due-now)/60000;if(minutes>=10&&minutes<=45)return{due,slot:SLOTS[i],index:i,day:q};}}return null;}
export function verifyText(value){const t=String(value||'').trim();if(!t||[...t].length>280||BLOCK.test(t)||/https?:\/\//iu.test(t)||!/#\w|#[\p{L}\p{N}_]+/u.test(t))throw Error('Invalid or unsafe tweet');return t;}
export function sameSlot(post,due){return Boolean(post.dueAt&&Math.abs(new Date(post.dueAt).getTime()-due.getTime())<=120000);}
export function sameText(text,posts){const compact=t=>String(t||'').toLowerCase().replace(/#[\p{L}\p{N}_]+/gu,'').replace(/\s+/gu,'').trim();return posts.some(p=>compact(text)===compact(p.text));}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function http(url,options={},timeout=20000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
async function gql(query,token,retry=false){for(let i=0;i<(retry?3:1);i++){try{const r=await http(API,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error('Buffer HTTP '+r.status);const data=await r.json();if(data.errors?.length)throw Error('Buffer GraphQL: '+data.errors.map(e=>e.message).join('; '));return data.data;}catch(e){if(!retry||i===2)throw e;await pause(1000*(i+1));}}}
async function posts(token,org,channel){let all=[],cursor=null;for(let i=0;i<4;i++){const query='query {posts(first:100'+(cursor?',after:'+JSON.stringify(cursor):'')+',input:{organizationId:'+JSON.stringify(org)+',filter:{channelIds:['+JSON.stringify(channel)+']},sort:[{field:createdAt,direction:desc}]}){edges{node{id text status dueAt createdAt channelId}}pageInfo{hasNextPage endCursor}}}';const x=(await gql(query,token,true)).posts;all.push(...x.edges.map(e=>e.node));if(!x.pageInfo.hasNextPage)return all;cursor=x.pageInfo.endCursor;if(!cursor)throw Error('Buffer pagination failed');}throw Error('Buffer post list exceeded safety limit');}
// Free, pre-reviewed educational fallback. These are NOT live market news.
export const FINANCE=["كيف يُحتسب تغير المؤشر؟ يعكس تاسي حركة أسعار الأسهم المدرجة وفق منهجية المؤشر وأوزان مكوناته. المصدر: تداول السعودية. للعلم. #تاسي","قيمة التداول هي إجمالي قيمة الصفقات المنفذة، بينما حجم التداول هو عدد الأسهم المتداولة؛ وهما مقياسان مختلفان. للعلم. #تداول","القيمة السوقية للشركة تساوي سعر السهم مضروبًا في عدد الأسهم القائمة؛ وهي ليست قيمة النقد المتاح للشركة. للعلم. #الأسهم_السعودية","ارتفاع مؤشر السوق لا يعني بالضرورة ارتفاع جميع أسهمه؛ فقد تختلف حركة الشركات والقطاعات خلال الجلسة نفسها. للعلم. #تاسي","في إفصاحات الشركات، يختلف تاريخ الاستحقاق عن تاريخ صرف التوزيعات النقدية؛ ويُذكر كل منهما في الإعلان. للعلم. #تداول","التوزيعات النقدية وأرباح الشركة المحاسبية مفهومان مختلفان؛ فقرار توزيع الأرباح يخضع لما تعلنه الشركة وفق الإجراءات المعمول بها. للعلم. #الأسهم_السعودية","صافي الربح ليس مساويًا للتدفقات النقدية التشغيلية؛ لذلك تعرض القوائم المالية المؤشرين بصورة منفصلة. للعلم. #القوائم_المالية","تُظهر قائمة المركز المالي الأصول والالتزامات وحقوق الملكية في تاريخ محدد، بخلاف قائمة الدخل التي تغطي فترة مالية. للعلم. #القوائم_المالية","تُعلن الشركات المدرجة نتائجها المالية وتقاريرها ضمن قنوات الإفصاح الرسمية في السوق. المصدر: تداول السعودية. للعلم. #تداول","نسبة السعر إلى الربح تقارن السعر السوقي بربحية السهم، ولا تُعد وحدها مقياسًا كافيًا لتقييم شركة. للعلم. #الأسهم","ربحية السهم تُحتسب بالاعتماد على الربح العائد للمساهمين وعدد الأسهم وفق المعايير المحاسبية المطبقة. للعلم. #القوائم_المالية","تختلف المؤشرات الأمريكية في مكوناتها ومنهجية احتسابها؛ لذا قد تتحرك S&P 500 وناسداك وداو جونز بنسب مختلفة. للعلم. #الأسهم_الأمريكية","مؤشر S&P 500 يعتمد على القيمة السوقية المعدلة بالأسهم الحرة، بينما يعتمد داو جونز الصناعي على أسعار أسهم مكوناته. للعلم. #الأسواق_الأمريكية","تُنشر الإفصاحات النظامية للشركات الأمريكية عبر نظام EDGAR التابع لهيئة SEC، بما فيها تقارير 10-K و10-Q. للعلم. #الأسهم_الأمريكية","يعرض تقرير 10-K السنوي للشركة الأمريكية بياناتها المالية والمخاطر وأعمالها، بينما يغطي 10-Q فترات ربع سنوية. المصدر: SEC. للعلم. #الأسهم_الأمريكية","تُميّز القوائم المالية بين الإيرادات وصافي الربح؛ فالإيرادات تسبق خصم بنود التكلفة والمصروفات والضرائب. للعلم. #التحليل_الأساسي","التدفق النقدي الحر مفهوم يختلف عن صافي الربح، وتختلف طريقة احتسابه بحسب التعريف المستخدم في التقرير. للعلم. #الأسواق_المالية","تُقاس حركة الذهب عالميًا غالبًا بالدولار لكل أونصة ترويسية؛ وقد يختلف سعر التجزئة محليًا بسبب المصنعية والرسوم. للعلم. #الذهب","العقد الآجل للذهب يحدد مواصفات التسليم وتاريخ الاستحقاق وفق قواعد البورصة؛ وهو يختلف عن شراء الذهب المادي. المصدر: CME. للعلم. #الذهب","السعر الفوري للذهب والسعر الآجل ليسا بالضرورة متساويين؛ إذ تعكس العقود الآجلة تاريخ تسوية مختلفًا. للعلم. #الذهب","قد تُظهر صناديق الذهب المدرجة سعرًا سوقيًا يختلف عن صافي قيمة الأصول الإرشادي أثناء التداول. للعلم. #الصناديق_المتداولة","خام برنت وغرب تكساس الوسيط معياران مختلفان لتسعير النفط، ولكل منهما خصائصه وسوقه. للعلم. #النفط","يختلف السعر الفوري للنفط عن سعر العقد الآجل؛ فالأخير يرتبط بشهر تسليم محدد في السوق. للعلم. #النفط","تُنشر مواصفات عقود خام غرب تكساس الوسيط لدى CME، بينما تُدرج عقود برنت القياسية لدى ICE. للعلم. #النفط","حجم التداول في العقود الآجلة يُعبّر عن العقود المتداولة، أما المراكز المفتوحة فتعكس العقود التي لا تزال قائمة. للعلم. #السلع","يحدد الاحتياطي الفيدرالي نطاقًا مستهدفًا لسعر الفائدة على الأموال الفيدرالية ضمن قراراته النقدية. المصدر: Federal Reserve. للعلم. #أسعار_الفائدة","النطاق المستهدف للفائدة الفيدرالية يختلف عن العائد الفعلي على سندات الخزانة؛ فلكل منهما آلية تحديد مختلفة. للعلم. #الفائدة","عندما ترتفع عوائد السندات، تنخفض عادةً أسعار السندات القائمة ذات العائد الثابت، والعكس صحيح. للعلم. #السندات","المدة المعدلة للسندات مقياس تقريبي لحساسية سعرها تجاه تغير العائد، ولا تمثل تاريخ استحقاق السند نفسه. للعلم. #السندات","التضخم وتغير سعر الفائدة متغيران منفصلان؛ الأول يقيس تغير المستوى العام للأسعار، والثاني يمثل تكلفة الاقتراض أو العائد. للعلم. #الاقتصاد","تتيح صناديق المؤشرات المتداولة تداول وحداتها خلال جلسة السوق، وقد يختلف سعر الوحدة عن صافي قيمة أصولها. للعلم. #صناديق_المؤشرات","تختلف رسوم إدارة الصناديق عن رسوم التداول أو الوساطة؛ ويمكن مراجعة كل منها في مستندات الصندوق والجهة الوسيطة. للعلم. #الصناديق","يختلف الصندوق المتوافق مع الشريعة عن غيره بحسب الضوابط الشرعية المعلنة وآلية الرقابة المنصوص عليها في مستنداته. للعلم. #الاستثمار_المتوافق","وجود كلمة إسلامي في اسم صندوق لا يغني عن مراجعة شروطه واستراتيجية الاستثمار وهيئته الشرعية المعلنة. للعلم. #الصناديق_الاستثمارية","قد يختلف أداء صندوق يتتبع مؤشرًا عن المؤشر نفسه بسبب الرسوم والمصروفات وطريقة التنفيذ. للعلم. #الصناديق_المتداولة","السوق الرئيسية ونمو السوق الموازية في تداول السعودية سوقان مختلفان في متطلبات الإدراج وخصائص الشركات. للعلم. #تداول","تجزئة السهم تغيّر عدد الأسهم والسعر النظري بما يتناسب مع نسبة التجزئة، دون أن تغيّر وحدها القيمة الإجمالية للحيازة. للعلم. #الأسهم","يُظهر دفتر الأوامر أسعار وكميات عروض البيع وطلبات الشراء، بينما يعكس السعر الأخير آخر صفقة منفذة. للعلم. #تداول","أوامر السوق والأوامر المحددة بالسعر تختلف في طريقة التنفيذ؛ ويعتمد التنفيذ على السيولة والأوامر المقابلة. للعلم. #الأسواق_المالية","قد تختلف نسبة تغير السهم خلال الجلسة عن أدائه منذ بداية العام؛ إذ تعتمد كل نسبة على نقطة مقارنة زمنية مختلفة. للعلم. #الأسهم"];
export const CMA_DECISIONS=[
{date:'2026-09-29',text:'29 سبتمبر: اعتمد مجلس هيئة السوق المالية تعديل قواعد تسجيل مراجعي حسابات المنشآت الخاضعة لإشراف الهيئة، ويُعمل بالتعديلات من تاريخ نشرها. المصدر: هيئة السوق المالية. #هيئة_السوق_المالية #تداول'},
{date:'2026-09-29',text:'29 سبتمبر: طرحت هيئة السوق المالية مشروع الأحكام التنظيمية للقاءات مناقشة الأرباح لاستطلاع الآراء حتى 29 أكتوبر 2026. المشروع لم يُعتمد نهائيًا بعد. المصدر: الهيئة. #هيئة_السوق_المالية'},
{date:'2026-09-24',text:'24 سبتمبر: أعلنت هيئة السوق المالية موافقتها على طرح وحدات صندوق الأهلي وجامعة الأميرة نورة الوقفي طرحًا عامًا. الموافقة على الطرح لا تعني المصادقة على جدوى الاستثمار. المصدر: الهيئة. #الصناديق_الاستثمارية'},
{date:'2026-09-22',text:'22 سبتمبر: طرحت هيئة السوق المالية مشروع تحسين ممارسات الطروحات الأولية لاستطلاع مرئيات العموم. الإعلان يتعلق بمشروع تنظيم، وليس قواعد نافذة. المصدر: الهيئة. #هيئة_السوق_المالية'}
];
export const CMA_EDU=[
'موافقة هيئة السوق المالية على طرح وحدات صندوق تعني استيفاء المتطلبات النظامية للطرح، ولا تُعد مصادقة على جدوى الاستثمار فيه. المصدر: هيئة السوق المالية. للعلم. #الصناديق_الاستثمارية',
'عند متابعة إعلانات هيئة السوق المالية، ميّز بين قرار معتمد ومشروع مطروح لاستطلاع الآراء؛ فالمشروع ليس قاعدة نافذة قبل اعتماده. للعلم. #هيئة_السوق_المالية',
'إعلانات هيئة السوق المالية بشأن زيادة رؤوس الأموال تختلف عن إعلانات الشركات عن التنفيذ وتاريخ الاستحقاق؛ لكل إعلان غرضه وتاريخه. للعلم. #الأسهم_السعودية',
'يمكن متابعة القرارات المعتمدة ومشروعات اللوائح وطلبات الطرح من قسم الإعلانات على الموقع الرسمي لهيئة السوق المالية. للعلم. #هيئة_السوق_المالية',
'ترخيص مؤسسة سوق مالية لممارسة نشاط محدد لا يعني بالضرورة ترخيصها لجميع أنشطة أعمال الأوراق المالية. المصدر: هيئة السوق المالية. للعلم. #السوق_المالية',
'توضح الإعلانات الرسمية لهيئة السوق المالية طبيعة الموافقة والجهة المعنية وتاريخ صدور القرار؛ ولا يصح استنتاج تفاصيل إضافية لم ترد في الإعلان. للعلم. #هيئة_السوق_المالية',
'الأحكام التنظيمية المطروحة لاستطلاع آراء العموم قد تُعدّل قبل اعتمادها؛ لذلك تُراجع الصيغة النهائية عند إعلانها رسميًا. للعلم. #الأسواق_المالية',
'يختلف تاريخ موافقة هيئة السوق المالية على الطرح عن تاريخ بدء الاكتتاب أو التداول، ويجب الرجوع إلى إعلانات الجهات المعنية لكل مرحلة. للعلم. #تداول'
];
export function cmaPost(plan,history,recent=history,now=new Date()){for(const item of CMA_DECISIONS){const age=now.getTime()-Date.parse(item.date+'T00:00:00+03:00');if(age>=0&&age<14*86400000&&!sameText(item.text,history))return verifyText(item.text);}const ordinal=Math.floor(Date.UTC(plan.day.year,plan.day.month-1,plan.day.day)/86400000);for(let offset=0;offset<CMA_EDU.length;offset++){const text=CMA_EDU[(ordinal+offset)%CMA_EDU.length];if(!sameText(text,recent))return verifyText(text);}throw Error('No unused CMA content');}
export function enrichEducational(text){
 const bank=[
  [/تاسي|السوق السعودي|تداول|الأسهم_السعودية/u,'لفهم الصورة الأوسع تُراجع السيولة واتساع حركة الشركات والقطاعات إلى جانب المؤشر العام.'],
  [/الأمريكية|الأسهم_الأمريكية|ناسداك|S&P|SEC/u,'تختلف القراءة بحسب الفترة المالية وطريقة احتساب المؤشر؛ لذا يجب الرجوع إلى بيانات المصدر الأصلية.'],
  [/الذهب/u,'قد تختلف الأسعار المعروضة باختلاف السوق والتوقيت والرسوم؛ لذلك ينبغي تحديد معيار المقارنة.'],
  [/النفط|السلع|العقود/u,'تختلف الأسعار وفق معيار السلعة وتاريخ التسليم، ولا تعبر حركة عقد واحد عن جميع آجال السوق.'],
  [/الفائدة|السندات|الاقتصاد/u,'تُقرأ هذه المتغيرات مع آجال الاستحقاق والبيانات المعلنة، لا بمعزل عن سياقها.'],
  [/الصناديق|الاستثمار_المتوافق/u,'عند المقارنة تُراجع نشرة الصندوق واستراتيجية الاستثمار والرسوم وطريقة احتساب الأداء.']
 ];
 const suffix=(bank.find(([pattern])=>pattern.test(text))||[])[1]||'تساعد المقارنة بين الفترات والرجوع إلى بيانات المصدر على فهم هذه المعلومة.';
 const index=text.indexOf(' #');
 if(index<0)return text;
 const expanded=text.slice(0,index)+' '+suffix+text.slice(index);
 return [...expanded].length<=275?verifyText(expanded):text;
}
async function prepareFinance(plan,history){const ordinal=Math.floor(Date.UTC(plan.day.year,plan.day.month-1,plan.day.day)/86400000);for(let offset=0;offset<FINANCE.length;offset++){const t=FINANCE[(ordinal*8+plan.index+offset)%FINANCE.length];if(!sameText(t,history))return verifyText(t);}throw Error('No unused verified educational post');}
function weekend(plan,history){const ordinal=Math.floor(Date.UTC(plan.day.year,plan.day.month-1,plan.day.day)/86400000);for(let offset=0;offset<DUENOX.length;offset++){const t=DUENOX[(ordinal*8+plan.index+offset)%DUENOX.length];if(!sameText(t,history))return verifyText(t);}throw Error('No unused DueNox post');}
export async function run(){if(process.env.PUBLISH_ENABLED!=='true'&&process.env.CHECK_CONNECTION==='true'){const token=process.env.BUFFER_API_KEY,org=process.env.BUFFER_ORGANIZATION_ID,channel=process.env.BUFFER_CHANNEL_ID;if(!token||!org||!channel)throw Error('Missing Buffer API key, channel ID or organization ID');const items=await posts(token,org,channel);console.log('READ-ONLY connection validated; fetched',items.length,'posts; NO posts created');return;}const plan=upcoming();if(!plan){console.log('No slot in 10–45 minute preparation window');return;}console.log('Upcoming Riyadh slot',plan.slot,plan.due.toISOString());if(process.env.PUBLISH_ENABLED!=='true'){console.log('DRY RUN: publication disabled');return;}
const token=process.env.BUFFER_API_KEY,org=process.env.BUFFER_ORGANIZATION_ID,channel=process.env.BUFFER_CHANNEL_ID;if(!token||!org||!channel)throw Error('Buffer credentials/IDs missing');const history=await posts(token,org,channel);const recent=history.filter(p=>Date.now()-new Date(p.createdAt).getTime()<72*3600000);
if(history.some(p=>sameSlot(p,plan.due))){console.log('Already scheduled/sent for this slot');return;}
const overdue=history.filter(p=>p.dueAt&&p.status!=='sent'&&Date.now()-new Date(p.dueAt).getTime()>15*60000&&Date.now()-new Date(p.dueAt).getTime()<4*3600000&&SLOTS.some(s=>sameSlot(p,at(plan.day,s))));if(overdue.length)throw Error('Previous scheduled post not confirmed as sent');
if(history.some(p=>['scheduled','sending'].includes(p.status)&&new Date(p.dueAt)>new Date())){console.log('A future Buffer post already exists');return;}
const weekday=new Date(Date.UTC(plan.day.year,plan.day.month-1,plan.day.day)).getUTCDay();
let thread=null,text;
if(weekday===5||weekday===6)text=weekend(plan,recent);
else if(plan.index===4)text=cmaPost(plan,history,recent);
else if(plan.index===6){
 try{thread=await prepareStockAnalysis(plan,recent);}
 catch(error){console.log('Verified numerical stock analysis unavailable:',error.message,'; using explicitly qualitative company analysis');thread=qualitativeThread(plan,recent);}
 for(const part of thread)verifyText(part);
 text=thread[0];
}else text=enrichEducational(await prepareFinance(plan,recent));
if(weekday!==5&&weekday!==6){
 if(thread){
  const tagged=await addRelevantSearchTag(thread[0]);
  thread=[tagged,...thread.slice(1)];
  text=tagged;
 }else text=await addRelevantSearchTag(text);
 verifyText(text);
}
const fresh=await posts(token,org,channel);if(fresh.some(p=>sameSlot(p,plan.due)||(sameText(text,[p])&&(CMA_DECISIONS.some(item=>item.text===text)||Date.now()-new Date(p.createdAt).getTime()<72*3600000))||(['scheduled','sending'].includes(p.status)&&new Date(p.dueAt)>new Date()))){console.log('Slot or content now covered; no duplicate');return;}
if(plan.due.getTime()-Date.now()<120000)throw Error('Too close to scheduled time');const meta=thread?',metadata:{twitter:{thread:['+thread.map(t=>'{text:'+JSON.stringify(t)+'}').join(',')+']}}':'';
const query='mutation {createPost(input:{text:'+JSON.stringify(text)+',channelId:'+JSON.stringify(channel)+',schedulingType:automatic,mode:customScheduled,dueAt:'+JSON.stringify(plan.due.toISOString())+meta+'}){... on PostActionSuccess{post{id dueAt status}}... on MutationError{message}}}';let created;try{created=(await gql(query,token)).createPost;}catch(error){const check=await posts(token,org,channel);if(check.some(p=>sameSlot(p,plan.due))){console.log('Creation recovered from Buffer history');return;}throw error;}if(created?.message||!created?.post?.id||!sameSlot(created.post,plan.due))throw Error('Buffer did not confirm correct scheduled post: '+(created?.message||''));console.log('Scheduled post',created.post.id,'at',created.post.dueAt);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(e=>{console.error('PUBLISHER_FAILED:',e.message);process.exitCode=1;});
