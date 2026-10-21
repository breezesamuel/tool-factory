#!/usr/bin/env python3
"""
生成游戏页（arcade）：5304 款
  · 复用现有页面的 head/CSS/UI 字典/运行时（程序化抽取，不手抄）
  · 主题驱动内容（引擎构建时已做内容轮转 + 主题化随机数）
  · 每页独有：og 图、FAQPage、内容块、同族相关游戏、广告位、统计打点
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"F:\2026\新建文件夹")
SITE = Path(r"C:\bingdashan\site")
ARC = SITE / "arcade"
SRC_JSON = ROOT / "artifacts" / "arcade_v2.json"
BASE = "https://tools.highkingflower.com"

# ---- 从现有游戏页抽取 CSS / UI 字典 / 运行时 ----
sample = (ARC / "a_anagram_000" / "index.html").read_text(encoding="utf-8", errors="replace")
css = re.search(r"<style>(.*?)</style>", sample, re.S).group(1)


def extract_json_obj(text: str, marker: str) -> str:
    """从 marker 之后用括号配对取出完整 JSON 对象。
    ⚠️ 必须从 marker **之后**开始找 '{'：marker 里往往自带 '{}'（如 Object.assign(...,{})），
       否则会取到那个空对象。"""
    i = text.find(marker)
    if i < 0:
        return "{}"
    j = text.find("{", i + len(marker))
    if j < 0:
        return "{}"
    depth, in_str, esc_ = 0, None, False
    k = j
    while k < len(text):
        c = text[k]
        if in_str:
            if esc_:
                esc_ = False
            elif c == "\\":
                esc_ = True
            elif c == in_str:
                in_str = None
        elif c in "\"'":
            in_str = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[j:k + 1]
        k += 1
    return "{}"


# 基础 UI 字典：从共享运行时 bds-core.js 里取（游戏页被重写后，页面里已没有完整字典）
_core = Path(r"C:\bingdashan\site\bds-core.js").read_text(encoding="utf-8", errors="replace")
UI = extract_json_obj(_core, "window.__I = Object.assign(window.__I || {},")
# 运行时直接读源文件（gen3.js 也是这么做的：arcade-runtime.js）
ARRUNTIME = Path(r"C:\bingdashan\arcade-runtime.js").read_text(encoding="utf-8", errors="replace")
print(f"UI 字典 {len(UI)} 字节 / 运行时 {len(ARRUNTIME)} 字节")


def esc(s) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def jdump(o) -> str:
    return json.dumps(o, ensure_ascii=False, separators=(",", ":"))


def lang_btns() -> str:
    return " ".join(
        f'<button class="lang-btn" id="h-{l}" data-i="lang" onclick="bdsSetLang(\'{l}\')">{l}</button>'
        for l in ("zh", "en", "ar"))


GAMES = json.loads(SRC_JSON.read_text(encoding="utf-8"))

# ---- 同族相关游戏（同 cat + 同 theme）----
by_key = defaultdict(list)
for g in GAMES:
    by_key[(g["cat"], g["theme"]["zh"])].append(g)

I18N_EXTRA = {
    "gHowtoTitle": {"zh": "怎么玩", "en": "How to play", "ar": "كيف تلعب"},
    "gHowto1": {"zh": "在网页里直接玩，不用下载、不用注册。", "en": "Play right in the browser — no download, no signup.", "ar": "العب في المتصفح مباشرة — بلا تحميل ولا تسجيل."},
    "gHowto2": {"zh": "每个新用户有 10 分钟免费时长，足够体验。", "en": "Every new user gets 10 free minutes to try it out.", "ar": "كل مستخدم جديد يحصل على 10 دقائق مجانية."},
    "gHowto3": {"zh": "邀请 1 位朋友，双方各送 10 分钟（最多 50 位）。", "en": "Invite a friend — you both get 10 extra minutes (up to 50).", "ar": "ادعُ صديقًا — تحصلان على 10 دقائق إضافية (حتى 50)."},
    "gFaqTitle": {"zh": "常见问题", "en": "FAQ", "ar": "الأسئلة الشائعة"},
    "gFaq1q": {"zh": "要下载 App 吗？", "en": "Do I need an app?", "ar": "هل أحتاج تطبيقًا؟"},
    "gFaq1a": {"zh": "不需要，浏览器直接打开就能玩。", "en": "No — just open it in a browser.", "ar": "لا — افتحه في المتصفح فقط."},
    "gFaq2q": {"zh": "免费时长用完怎么办？", "en": "What if the free minutes run out?", "ar": "ماذا لو انتهت الدقائق المجانية؟"},
    "gFaq2a": {"zh": "可以邀请朋友换时长，或按需续费。", "en": "Invite friends for more, or top up.", "ar": "ادعُ أصدقاءك أو اشحن المزيد."},
    "gFaq3q": {"zh": "手机上能玩吗？", "en": "Can I play on my phone?", "ar": "هل يمكنني اللعب على الهاتف؟"},
    "gFaq3a": {"zh": "可以，页面自适应手机屏幕。", "en": "Yes — the page adapts to your phone screen.", "ar": "نعم — تتكيف الصفحة مع شاشة هاتفك."},
    "gRelated": {"zh": "同类游戏", "en": "More games", "ar": "ألعاب مشابهة"},
    "gAll": {"zh": "全部游戏 →", "en": "All games →", "ar": "كل الألعاب ←"},
    "gTheme": {"zh": "风格", "en": "Style", "ar": "النمط"},
    "gMode": {"zh": "模式", "en": "Mode", "ar": "النمط"},
    "gLevel": {"zh": "难度", "en": "Difficulty", "ar": "المستوى"},
}

TRACK_JS = (
    "<script>(function(){window.BDS_TRACK=function(e,d){try{var b=JSON.stringify("
    "{e:e,d:d||{},p:location.pathname,r:document.referrer||'',t:Date.now()});"
    "if(navigator.sendBeacon){navigator.sendBeacon('/api/track',b);}else{"
    "fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:b,keepalive:true})"
    ".catch(function(){});}}catch(e){}};try{BDS_TRACK('pv')}catch(e){}"
    "document.addEventListener('click',function(ev){var t=ev.target&&ev.target.closest?"
    "?ev.target.closest('button,a'):null;"
    "if(t&&/invite|share|friend/i.test(t.textContent||''))BDS_TRACK('invite');},true);})();</script>"
)


def game_page(g, related) -> str:
    t = g["t"]
    desc = g["desc"]["zh"]
    title = f'{t["zh"]} · bingdashan 娱乐中心'
    canon = f'{BASE}/arcade/{g["n"]}/'
    ld = {
        "@context": "https://schema.org", "@type": "VideoGame", "name": t["zh"],
        "description": desc, "genre": g["cat"], "applicationCategory": "Game",
        "operatingSystem": "Web", "inLanguage": ["zh", "en", "ar"], "url": canon,
        "offers": {"@type": "Offer", "price": "0.2", "priceCurrency": "CNY",
                   "description": "前 10 分钟免费,之后每分钟 0.2 元"},
    }
    faq = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": "要下载 App 吗？",
             "acceptedAnswer": {"@type": "Answer", "text": "不需要，浏览器直接打开就能玩。"}},
            {"@type": "Question", "name": "免费时长用完怎么办？",
             "acceptedAnswer": {"@type": "Answer", "text": "可以邀请朋友换时长，或按需续费。"}},
            {"@type": "Question", "name": f'{t["zh"]}的玩法是什么？',
             "acceptedAnswer": {"@type": "Answer",
                                "text": f'{g["intro"]["zh"]} 模式：{g["unit"]["zh"]}，难度：{g["lv"]["zh"]}，风格：{g["theme"]["zh"]}。'}},
        ],
    }
    rel = "".join(
        f'<a href="../{r["n"]}/" data-rt="{r["n"]}" style="display:inline-block;margin:4px 8px 4px 0;'
        f'padding:6px 12px;border:1px solid #e5e7eb;border-radius:999px;text-decoration:none;color:#111;background:#fff">'
        f'{esc(r["t"]["zh"])}</a>' for r in related)
    note = (f'本局为「{g["cat"]}」类的「{g["unit"]["zh"]}」玩法，难度「{g["lv"]["zh"]}」，'
            f'风格「{g["theme"]["zh"]}」——{g.get("tip", {}).get("zh", "")}。'
            f'题目与序列由引擎按本主题独立生成，不同主题的玩法内容并不相同。')
    content = (
        '<section class="bds-seo" style="max-width:760px;margin:22px auto;padding:0 4px">'
        f'<p style="font-size:.95rem;color:#333;background:#f9fafb;border-left:3px solid #d97706;'
        f'padding:10px 12px;border-radius:0 8px 8px 0;margin:0 0 16px">{esc(note)}</p>'
        '<h2 data-i="gHowtoTitle" style="font-size:1.15rem;margin:16px 0 6px">怎么玩</h2>'
        '<ol style="padding-left:20px;margin:6px 0">'
        '<li data-i="gHowto1">在网页里直接玩，不用下载、不用注册。</li>'
        '<li data-i="gHowto2">每个新用户有 10 分钟免费时长，足够体验。</li>'
        '<li data-i="gHowto3">邀请 1 位朋友，双方各送 10 分钟（最多 50 位）。</li></ol>'
        '<h2 data-i="gFaqTitle" style="font-size:1.15rem;margin:18px 0 6px">常见问题</h2>'
        '<div class="box" style="margin:8px 0"><b data-i="gFaq1q">要下载 App 吗？</b>'
        '<p data-i="gFaq1a" style="margin:6px 0 0">不需要，浏览器直接打开就能玩。</p></div>'
        '<div class="box" style="margin:8px 0"><b data-i="gFaq2q">免费时长用完怎么办？</b>'
        '<p data-i="gFaq2a" style="margin:6px 0 0">可以邀请朋友换时长，或按需续费。</p></div>'
        '<div class="box" style="margin:8px 0"><b data-i="gFaq3q">手机上能玩吗？</b>'
        '<p data-i="gFaq3a" style="margin:6px 0 0">可以，页面自适应手机屏幕。</p></div>'
        '<div class="related-tools" style="margin:18px 0">'
        '<h2 data-i="gRelated" style="font-size:1.05rem;margin:0 0 6px">同类游戏</h2>'
        f'{rel}'
        '<div style="margin:10px 0"><a href="../index.html" data-i="gAll">全部游戏 →</a>'
        'style="color:#2563eb;text-decoration:none"></a></div>'
        '</div>'
        '<div class="ad-slot" data-ad-slot="game-bottom" aria-label="ad" '
        'style="margin:22px auto;max-width:760px;min-height:90px;'
        'border:1px dashed #d1d5db;border-radius:12px;background:#fff"></div>'
        '</section>'
    )
    safe_js = g["js"].replace("</script>", "<\\/script>")
    ui = json.loads(UI)
    ui.update(I18N_EXTRA)
    # 注意: 这行不能放进 f-string —— "window.__I||{}" 里的 {} 会被当成表达式
    # 基础 UI 字典必须真正写进页面（否则 data-i 全部渲染为空）
    setup_js = (
        "window.__I=Object.assign(" + UI + "," + jdump(I18N_EXTRA) + ");"
        "window.BDS_SLUG=" + jdump(g["n"]) + ";"
        "window.__T={t:" + jdump(t) + ",p:" + jdump(g["p"]) + ",pain:" + jdump(g["pain"]) + "};"
    )
    return (
        '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{esc(title)}</title>'
        f'<meta name="description" content="{esc(desc)}">'
        f'<link rel="canonical" href="{canon}">'
        f'<meta property="og:title" content="{esc(t["zh"])}">'
        f'<meta property="og:description" content="{esc(desc)}">'
        '<meta property="og:type" content="website">'
        f'<meta property="og:url" content="{canon}">'
        f'<meta property="og:image" content="{BASE}/icons/favicon-192.png">'
        '<meta property="og:image:width" content="192"><meta property="og:image:height" content="192">'
        '<meta property="og:site_name" content="bingdashan 娱乐中心">'
        '<meta name="twitter:card" content="summary_large_image">'
        f'<style>{css}</style></head><body>'
        '<div class="nav"><a href="../../index.html" data-i="home">回总目录</a>'
        '<a href="../../pricing.html">收费规则</a>'
        f'<span class="row">{lang_btns()}</span>'
        '<span data-i="pay" style="margin-left:auto"></span></div>'
        f'<h1 id="ttl">{esc(t["zh"])}</h1>'
        f'<script type="application/ld+json">{jdump(ld)}</script>'
        '<div class="hud"><span><b>' + esc(g["cat"]) + '</b></span>'
        '<span>剩余时间:<b id="clock">10:00</b></span>'
        '<span style="color:#6b7280;font-size:.85rem">前 10 分钟免费 · 每分钟 ¥0.2 · 邀请 1 人双方 +10 分钟</span></div>'
        '<div class="box"><div style="font-size:.85rem;color:#555">' + esc(g["intro"]["zh"]) + '</div><br>'
        '<button id="btn" onclick="bdsGo()">开始游戏</button><div class="out" id="o"></div></div>'
        '<div id="gate" style="display:none"><div class="box"><b>免费时长已用完</b><br>'
        '<button onclick="AR.open()">充值时长 / 邀请好友</button></div></div>'
        '<div class="modal-mask" id="modal" style="display:none"><div id="modal-body"></div></div>'
        '<p class="k">bingdashan · ' + esc(g["cat"]) + ' · <a href="../../arcade/index.html">全部游戏</a></p>'
        f'<script>{setup_js}</script>'
        f'<script>{ARRUNTIME}</script>'
        f'<script>function bdsGo(){{if(window.AR){{if(AR.remaining()<=0){{AR.open();return;}}AR.start();}}try{{{safe_js};'
        'if(typeof go2==="function"){go2();}else if(typeof go==="function"){go();}}'
        'catch(e){document.getElementById("o").textContent="JS:"+e.message;}}</script>'
        f'<script type="application/ld+json">{jdump(faq)}</script>'
        f'{content}'
        f'{TRACK_JS}'
        '</body></html>'
    )


def main() -> None:
    ARC.mkdir(parents=True, exist_ok=True)
    n = 0
    for g in GAMES:
        pool = by_key.get((g["cat"], g["theme"]["zh"]), [])
        related = []
        for r in pool:
            if r["n"] != g["n"]:
                related.append(r)
            if len(related) >= 5:
                break
        if not related:
            related = [x for x in GAMES if x["n"] != g["n"]][:5]
        d = ARC / g["n"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(game_page(g, related), encoding="utf-8")
        n += 1
    print(f"✅ 生成游戏页 {n} 款")


if __name__ == "__main__":
    main()
