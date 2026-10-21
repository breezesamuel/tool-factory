/*!
 * bds-core.js —— bingdashan 工具页/游戏页共享运行时
 *   基础多语字典 + 付费墙(10 次免费/返现折扣/套餐) + 语言切换 + 第一方统计 + 广告位 + 相关工具
 * 由 ops/extract_core.py 从真实页面程序化抽取（勿手改：手改会与线上行为漂移）。
 * 页面只需提供: window.BDS_SLUG / window.__I(增量) / window.__T / bdsGo()
 */
window.__I = Object.assign(window.__I || {}, {"frees": {"zh": "免费剩余", "en": "Free left", "ar": "المتبقي مجانًا"}, "btn": {"zh": "开始", "en": "Run", "ar": "ابدأ"}, "home": {"zh": "回总目录", "en": "Home", "ar": "الرئيسية"}, "pay": {"zh": "解锁工具", "en": "Unlock", "ar": "فتح"}, "used": {"zh": "使用", "en": "uses", "ar": "استخدامات"}, "plan": {"zh": "付费方案", "en": "Plans", "ar": "الخطط"}, "ref": {"zh": "返现", "en": "Refer", "ar": "إحالة"}, "lang": {"zh": "语言", "en": "Language", "ar": "اللغة"}, "search": {"zh": "搜索工具…", "en": "Search tools…", "ar": "ابحث…"}, "cat": {"zh": "分类", "en": "Category", "ar": "الفئة"}, "pain": {"zh": "痛点", "en": "Pain point", "ar": "مشكلة"}, "gotos": {"zh": "已解锁", "en": "Unlocked", "ar": "مفتوح"}, "demo": {"zh": "演示", "en": "Demo", "ar": "تجريبي"}, "how": {"zh": "每个工具免费使用10次,满意后按月或买断付费", "en": "Free 10 uses per tool, then pay monthly or buyout", "ar": "10 استخدامات مجانية لكل أداة ثم اشترك أو اشترِ"}, "unusable": {"zh": "点击开始前请先解锁", "en": "Unlock to keep using", "ar": "افتح للمتابعة"}, "txtA": {"zh": "文本 A", "en": "Text A", "ar": "نص أ"}, "txtB": {"zh": "文本 B", "en": "Text B", "ar": "نص ب"}, "num1": {"zh": "数字 1", "en": "Number 1", "ar": "رقم 1"}, "num2": {"zh": "数字 2", "en": "Number 2", "ar": "رقم 2"}, "num3": {"zh": "数字 3", "en": "Number 3", "ar": "رقم 3"}, "text1": {"zh": "字段 1", "en": "Field 1", "ar": "حقل 1"}, "text2": {"zh": "字段 2", "en": "Field 2", "ar": "حقل 2"}, "date1": {"zh": "日期", "en": "Date", "ar": "تاريخ"}, "unlock": {"zh": "解锁继续使用", "en": "Unlock to continue", "ar": "افتح للمتابعة"}, "howitworks": {"zh": "免费 10 次已用完。按月或买断解锁,拉朋友还能省钱:", "en": "Free 10 uses are up. Unlock monthly or buyout, or save with referrals:", "ar": "انتهت الاستخدامات المجانية. اشترك أو إحالة للأصدقاء لتوفير المال:"}, "refly": {"zh": "你的返现折扣", "en": "Your referral discount", "ar": "خصم الإحالة"}, "off": {"zh": "优惠", "en": "off", "ar": "خصم"}, "month": {"zh": "按月订阅(元)", "en": "Monthly (USD)", "ar": "شهريًا"}, "buyout": {"zh": "买断(元)", "en": "Buyout (USD)", "ar": "شراء دائم"}, "m10": {"zh": "月度基础", "en": "Basic", "ar": "أساسي"}, "m30": {"zh": "月度专业", "en": "Pro", "ar": "احترافي"}, "m100": {"zh": "月度旗舰", "en": "Flagship", "ar": "رائد"}, "y99": {"zh": "买断 1 年", "en": "1-yr", "ar": "سنة"}, "y299": {"zh": "买断 3 年", "en": "3-yr", "ar": "3 سنوات"}, "y999": {"zh": "永久买断", "en": "Lifetime", "ar": "مدى الحياة"}, "refpitch": {"zh": "每拉 1 个朋友付费返 10%,2 个 30%,3 个 50%,5 个 70%,10 个此工具终身免费。分享你的专属链接:", "en": "Each paying friend gives 10% back; 2=30%, 3=50%, 5=70%, 10=free forever. Share your link:", "ar": "كل صديق يدفع يمنحك 10%، 2=30%، 3=50%، 5=70%، 10=مجاني للأبد. شارك رابطك:"}, "reflinks": {"zh": "你的专属返现链接", "en": "Your referral link", "ar": "رابط الإحالة"}, "close": {"zh": "关闭", "en": "Close", "ar": "إغلاق"}, "paidok": {"zh": "已解锁,开始使用!(演示模式,支付通道接入后自动生效)", "en": "Unlocked! (demo mode — live payment connects automatically)", "ar": "تم الفتح! (وضع تجريبي)"}, "freehint": {"zh": "免费次数已用完,选择一个方案解锁", "en": "Free uses used up — pick a plan", "ar": "انتهت الاستخدامات المجانية"}, "howtoTitle": {"zh": "使用方法", "en": "How to use", "ar": "كيفية الاستخدام"}, "howto1": {"zh": "第 1 步：填入左边的数字/文字。", "en": "Step 1: enter the numbers or text on the left.", "ar": "الخطوة 1: أدخل الأرقام أو النص على اليسار."}, "howto2": {"zh": "第 2 步：点「开始」，结果立刻出现在下方。", "en": "Step 2: press Run and the result appears instantly.", "ar": "الخطوة 2: اضغط تشغيل وستظهر النتيجة فورًا."}, "howto3": {"zh": "第 3 步：满意就用满免费次数；不够可按月订阅或买断。", "en": "Step 3: use the free runs; subscribe or buy out when you need more.", "ar": "الخطوة 3: استخدم المجانيات؛ اشترك أو اشترِ عند الحاجة."}, "faqTitle": {"zh": "常见问题", "en": "FAQ", "ar": "الأسئلة الشائعة"}, "faq1q": {"zh": "这个工具要注册吗？", "en": "Do I need an account?", "ar": "هل أحتاج حسابًا؟"}, "faq1a": {"zh": "不用，打开即用；每个工具免费 10 次。", "en": "No. Open and use it; 10 free runs per tool.", "ar": "لا. افتح واستخدم؛ 10 استخدامات مجانية لكل أداة."}, "faq2q": {"zh": "免费次数用完会怎样？", "en": "What happens after the free runs?", "ar": "ماذا يحدث بعد المجانيات؟"}, "faq2a": {"zh": "按月订阅或买断，随时可开通，收据自动发到邮箱。", "en": "Subscribe monthly or buy out; a receipt is emailed automatically.", "ar": "اشترك شهريًا أو اشترِ؛ يصلك الإيصال تلقائيًا."}, "faq3q": {"zh": "支持哪些语言？", "en": "Which languages are supported?", "ar": "أي اللغات مدعومة؟"}, "faq3a": {"zh": "中文 / English / العربية，界面与结果都会跟随你的语言。", "en": "Chinese / English / Arabic — the UI follows your language.", "ar": "الصينية / الإنجليزية / العربية — الواجهة تتبع لغتك."}, "relatedTitle": {"zh": "相关工具", "en": "Related tools", "ar": "أدوات ذات صلة"}, "moreTools": {"zh": "浏览全部工具 →", "en": "Browse all tools →", "ar": "تصفح كل الأدوات ←"}, "adNote": {"zh": "广告", "en": "Ad", "ar": "إعلان"}});
(function(){
var LS=function(k,v){try{if(v===undefined)return localStorage.getItem('bds_'+k);localStorage.setItem('bds_'+k,v);}catch(e){return null;}};
var d=document;
var I=(window.__I||{}), T=(window.__T||{});
var langs=['zh','en','ar'];
function cur(){var l=LS('lang');if(!l||langs.indexOf(l)<0){var n=(navigator.language||'zh').toLowerCase();l=(n.indexOf('zh')===0)?'zh':(n.indexOf('ar')===0?'ar':'en');}return l;}
function tr(obj){if(!obj)return '';if(typeof obj==='string')return obj;var l=cur();return obj[l]||obj.zh||obj.en||obj.ar||'';}
String.prototype.bdsT=function(){var k=String(this).replace(/^\s+|\s+$/g,'');return (I&&I[k])?tr(I[k]):k;};
function applyUI(){var l=cur(),d=document;
 var el=d.querySelectorAll('[data-i]');
 for(var i=0;i<el.length;i++){el[i].textContent=el[i].getAttribute('data-i').bdsT();}
 d.documentElement.setAttribute('lang',l);
 d.documentElement.setAttribute('dir',(l==='ar')?'rtl':'ltr');
 var h=d.getElementById('h-'+l);if(h)h.className='lang-btn on';
 var ttl=d.getElementById('ttl');if(ttl&&T.t)ttl.textContent=tr(T.t);
 var per=d.getElementById('per');if(per&&T.p)per.textContent=tr(T.p);
 var btn=d.getElementById('btn');if(btn&&btn.getBoundingClientRect)btn.style.width='';
}
function setLang(l){LS('lang',l);applyUI();refreshGate();}
function getSlug(){return (window.BDS_SLUG||'tool');}
function paywall(){var MB=getSlug();var paid=LS('paid_'+MB);if(paid==='1')return false;var n=parseInt(LS('use_'+MB)||'0',10);return n>=10;}
function gate(){var x=d.getElementById('gate');if(x)x.style.display=paywall()?'block':'none';}
function tryUse(){if(paywall()){showModal();return false;}bump();return true;}
function bump(){var MB=getSlug();var n=parseInt(LS('use_'+MB)||'0',10)+1;LS('use_'+MB,n);
 var x=document.getElementById('freeleft');if(x){var left=10-n;x.textContent=(left>0?left:0);}
 return true;}
function showModal(){var m=d.getElementById('modal');if(!m)return;m.style.display='block';
 var hint=d.getElementById('mhint');if(hint)hint.textContent='freehint'.bdsT();
 var body=d.getElementById('modal-body');if(!body){body=d.createElement('div');body.id='modal-body';m.appendChild(body);}
 if(body)body.innerHTML=PWModalHTML();}
function hideModal(){var m=d.getElementById('modal');if(m)m.style.display='none';}
function initRef(){var me=LS('ref');if(!me){me='U'+Math.random().toString(36).slice(2,10).toUpperCase();LS('ref',me);}
 var u=new URLSearchParams((window.location.search||'').slice(1));
 var inv=u.get('ref');if(inv&&inv!==me){LS('invited_by',inv);var s='friendkey_'+me+'_'+getSlug();if(!LS(s)){LS(s,'1');
   var c=parseInt(LS('friends_'+inv)||'0',10)+1;LS('friends_'+inv,c);LS('lastfriend_'+inv,me);}
 }
}
function discountPct(){var c=parseInt(LS('friends_'+ (LS('ref')||''))||'0',10);var r=[[1,10],[2,20],[3,30]];var pct=0;for(var i=0;i<r.length;i++){if(c>=r[i][0])pct=r[i][1];}return Math.max(0,Math.min(100,pct));}
function fmtMoney(x){var l=cur();var v=parseFloat(x);
 if(l==='en')return '$'+Number(v).toFixed(0);
 if(l==='ar')return Number(v).toFixed(0)+' ر.س';
 return '¥'+Number(v).toFixed(0);}
function PWModalHTML(){var pct=discountPct();var L=function(k){return k.bdsT();};
 var mono=[["10",10,"month","m10"],["30",30,"month","m30"],["100",100,"month","m100"]];
 var own=[["99",99,"year","y99"],["299",299,"year","y299"],["999",999,"year","y999"]];
 var h='<div class="mw"><div class="mh">'+L('unlock')+'</div><div class="mnote">'+L('howitworks')+'</div>';
 h+='<div class="frow">'+L('refly')+': <b>'+pct+'%</b> '+L('off')+'</div>';
 h+='<div class="mt">'+L('month')+'</div><div class="plans">';
 for(var i=0;i<mono.length;i++){var q=mono[i];var ix=pct/100;var p=q[1]*(1-ix);h+='<div class="pc" onclick="bdsPay(\''+q[3]+'\')"><div>'+L(q[3])+'</div><div class="price">'+fmtMoney(p)+'</div></div>';}
 h+='</div><div class="mt">'+L('buyout')+'</div><div class="plans">';
 for(var j=0;j<own.length;j++){var o=own[j];var jx=pct/100;var qp=o[1]*(1-jx);h+='<div class="pc" onclick="bdsPay(\''+o[3]+'\')"><div>'+L(o[3])+'</div><div class="price">'+fmtMoney(qp)+'</div></div>';}
 h+='</div><div class="rrow">'+L('refpitch')+'<br><b>'+L('reflinks')+'</b><br><input id="reflink" readonly value="'+window.location.href.split('?')[0]+'?ref='+LS('ref')+'"></div>';
 h+='<div class="mnote" id="mhint2"></div><button class="mlink" onclick="hideModal()">'+L('close')+'</button></div>';
 return h;}
function bdsPay(plan){var MB=getSlug();var paid=LS('paid_'+MB);if(paid==='1'){fte();return;}
 var cfg=(window.BDS_PAY||{});
 if(cfg.mode==='live'&&typeof cfg.go==='function'){cfg.go(MB,plan);return;}
 LS('paid_'+MB,'1');LS('use_'+MB,'0');
 var d=document;
 var m2=d.getElementById('mhint2');if(m2)m2.textContent='paidok'.bdsT();
 fte();
 var inv=LS('invited_by');var me=LS('ref');
 if(inv){var c=parseInt(LS('friends_'+inv)||'0',10)+1;LS('friends_'+inv,c);LS('lastfriend_'+inv,me);}
}
function fte(){var m=document.getElementById('modal');if(m)m.style.display='none';gate();
 var x=document.getElementById('freeleft');if(x)x.textContent='10';
 try{window.scrollTo(0,0);}catch(e){}}
function refreshGate(){gate();var MB=getSlug();var x=document.getElementById('freeleft');
 if(x&&!paywall()){var n=10-parseInt(LS('use_'+MB)||'0',10);x.textContent=(n>0?n:0);}}
function remind(){var MB=getSlug();var n=10-parseInt(LS('use_'+MB)||'0',10);var x=document.getElementById('freeleft');if(x)x.textContent=(n>0?n:0);return n;}
function unlockPaid(MB){LS('paid_'+MB,'1');LS('use_'+MB,'0');try{LS('pending_'+MB,'');}catch(e){}refreshGate();fte();
 var m2=document.getElementById('mhint2');if(m2)m2.textContent='paidok'.bdsT();}
function bdsPayGo(MB,plan){var plans={m10:10,m30:30,m100:100,y99:99,y299:299,y999:999};var base=plans[plan]||10;
 var pct=discountPct();var amount=(base*(1-pct/100)).toFixed(2);
 var me=LS('ref')||'';var inv=LS('invited_by')||'';var out='BDS_'+me+'_'+plan+'_'+Date.now();
 LS('pending_'+MB,JSON.stringify({out:out,plan:plan,amount:amount,pct:pct,ts:Date.now()}));
 var q='?plan='+encodeURIComponent(plan)+'&out_trade_no='+encodeURIComponent(out)+'&slug='+encodeURIComponent(MB)+'&ref='+encodeURIComponent(me)+'&inv='+encodeURIComponent(inv)+'&pct='+pct;
 window.location.href='/api/pay'+q;}
function bdsPayCheck(){var MB=getSlug();var q=new URLSearchParams((window.location.search||'').slice(1));
 var outUrl=q.get('out_trade_no');var pen=null;try{pen=JSON.parse(LS('pending_'+MB)||'null');}catch(e){}
 var out=outUrl||(pen&&pen.out);if(!out)return;
 fetch('/api/order?out_trade_no='+encodeURIComponent(out)).then(function(r){return r.json();}).then(function(j){
  if(j&&j.paid){unlockPaid(MB);}}).catch(function(){});}
function bdsEntitle(){var me=LS('ref');if(!me)return;var MB=getSlug();if(LS('paid_'+MB)==='1')return;
 fetch('/api/entitle?ref='+encodeURIComponent(me)).then(function(r){return r.json();}).then(function(j){
  if(j&&j.slugs&&j.slugs.indexOf(MB)>=0){unlockPaid(MB);}
  if(j&&typeof j.pct==='number'&&j.pct>discountPct()){try{LS('server_pct',j.pct);}catch(e){}}}).catch(function(){});}
window.BDS_PAY={mode:'live',go:bdsPayGo,check:bdsPayCheck,entitle:bdsEntitle};
window.bdsSetLang=setLang;window.bdsPay=bdsPay;window.hideModal=hideModal;window.bdsUnlockPaid=unlockPaid;
window.tryUse=tryUse;window.showModal=showModal;
function ready(){initRef();applyUI();remind();try{bdsPayCheck();bdsEntitle();}catch(e){}}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',ready);}else{ready();}
})();

(function(){window.BDS_TRACK=function(e,d){try{var b=JSON.stringify({e:e,d:d||{},p:location.pathname,r:document.referrer||'',t:Date.now()});if(navigator.sendBeacon){navigator.sendBeacon('/api/track',b);}else{fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:b,keepalive:true}).catch(function(){});}}catch(err){}};try{BDS_TRACK('pv')}catch(e){}document.addEventListener('click',function(ev){var t=ev.target&&ev.target.closest?ev.target.closest('button,a'):null;if(t&&(t.id==='btn'||/unlock|subscribe|pay/i.test(t.textContent||'')))BDS_TRACK('use');},true);})();

(function(){try{if(!window.BDS_ADS||!window.BDS_ADS.client)return;var s=document.createElement('script');s.async=true;s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(window.BDS_ADS.client);s.crossOrigin='anonymous';document.head.appendChild(s);}catch(e){}})();

(function(){try{var b=document.querySelector('.related-tools');if(!b)return;var a=b.querySelectorAll('a[data-rt]');for(var i=0;i<a.length;i++){a[i].addEventListener('click',function(){try{BDS_TRACK('rel',{t:this.getAttribute('data-rt')})}catch(e){}})}}catch(e){}})();
