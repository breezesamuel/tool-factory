#!/usr/bin/env python3
"""
游戏页批量增强器（arcade 1007 页）：
  1) og:image / og:site_name（分享卡片）
  2) FAQPage JSON-LD（游戏类富摘要）
  3) 内容深度: 怎么玩 / 常见问题 / 邀请机制说明（三语）
  4) 同族相关游戏内链（a_anagram_* → a_anagram_*）→ 修复"每页只连 1 个同级"的 crawl 孤岛
  5) 广告位（每页 1 个）
  6) 第一方统计打点（PV / 来源 / 试玩）
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

SITE = Path(r"C:\bingdashan\site")
ARC = SITE / "arcade"
MARK = "<!-- bds-arcade:v1 -->"
BASE_URL = "https://tools.highkingflower.com"

I18N_NEW = {
    "gHowtoTitle": {"zh": "怎么玩", "en": "How to play", "ar": "كيف تلعب"},
    "gHowto1": {"zh": "在网页里直接玩，不用下载、不用注册。",
                "en": "Play right in the browser — no download, no signup.",
                "ar": "العب في المتصفح مباشرة — بلا تحميل ولا تسجيل."},
    "gHowto2": {"zh": "每个新用户有 10 分钟免费时长，足够体验。",
                 "en": "Every new user gets 10 free minutes to try it out.",
                 "ar": "كل مستخدم جديد يحصل على 10 دقائق مجانية."},
    "gHowto3": {"zh": "邀请 1 位朋友，双方各送 10 分钟（最多 50 位）。",
                 "en": "Invite a friend — you both get 10 extra minutes (up to 50).",
                 "ar": "ادعُ صديقًا — تحصلان على 10 دقائق إضافية (حتى 50)."},
    "gFaqTitle": {"zh": "常见问题", "en": "FAQ", "ar": "الأسئلة الشائعة"},
    "gFaq1q": {"zh": "要下载 App 吗？", "en": "Do I need an app?", "ar": "هل أحتاج تطبيقًا؟"},
    "gFaq1a": {"zh": "不需要，浏览器直接打开就能玩。", "en": "No — just open it in a browser.",
                "ar": "لا — افتحه في المتصفح فقط."},
    "gFaq2q": {"zh": "免费时长用完怎么办？", "en": "What if the free minutes run out?",
                "ar": "ماذا لو انتهت الدقائق المجانية؟"},
    "gFaq2a": {"zh": "可以邀请朋友换时长，或按需续费。", "en": "Invite friends for more, or top up.",
                "ar": "ادعُ أصدقاءك أو اشحن المزيد."},
    "gFaq3q": {"zh": "手机上能玩吗？", "en": "Can I play on my phone?", "ar": "هل يمكنني اللعب على الهاتف؟"},
    "gFaq3a": {"zh": "可以，页面自适应手机屏幕。", "en": "Yes — the page adapts to your phone screen.",
                "ar": "نعم — تتكيف الصفحة مع شاشة هاتفك."},
    "gRelated": {"zh": "同类游戏", "en": "More games", "ar": "ألعاب مشابهة"},
    "gAll": {"zh": "全部游戏 →", "en": "All games →", "ar": "كل الألعاب ←"},
}

TRACK_JS = (
    "<script>(function(){"
    "window.BDS_TRACK=function(e,d){try{"
    "var b=JSON.stringify({e:e,d:d||{},p:location.pathname,r:document.referrer||'',t:Date.now()});"
    "if(navigator.sendBeacon){navigator.sendBeacon('/api/track',b);}"
    "else{fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},"
    "body:b,keepalive:true}).catch(function(){});}"
    "}catch(err){}};"
    "try{BDS_TRACK('pv')}catch(e){}"
    "document.addEventListener('click',function(ev){var t=ev.target&&ev.target.closest?"
    "ev.target.closest('button,a'):null;"
    "if(t&&/invite|share|friend/i.test(t.textContent||''))BDS_TRACK('invite');},true);})();</script>"
)

AD_BLOCK = (
    '<div class="ad-slot" data-ad-slot="game-bottom" aria-label="ad" '
    'style="margin:22px auto;max-width:760px;min-height:90px;'
    'border:1px dashed #d1d5db;border-radius:12px;background:#fff"></div>'
)


def family(slug: str) -> str:
    m = re.match(r"^([a-z]+)_", slug)
    return m.group(1) if m else slug.split("_")[0]


def game_catalog() -> dict:
    out = {}
    for d in ARC.iterdir():
        if d.is_dir() and (d / "index.html").exists():
            out[d.name] = d
    return out


def enrich(path: Path, slug: str, cat: dict, dry: bool):
    h = path.read_text(encoding="utf-8", errors="ignore")
    if MARK in h:
        return {"slug": slug, "status": "skipped"}
    changes = []

    if 'property="og:image"' not in h:
        og = (f'<meta property="og:image" content="{BASE_URL}/icons/favicon-192.png">'
              f'<meta property="og:image:width" content="192">'
              f'<meta property="og:image:height" content="192">'
              f'<meta property="og:site_name" content="bingdashan 娱乐中心">')
        h = h.replace('<meta name="twitter:card"', og + '<meta name="twitter:card"', 1)
        changes.append("og-image")

    if "FAQPage" not in h:
        data = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": "要下载 App 吗？",
             "acceptedAnswer": {"@type": "Answer", "text": "不需要，浏览器直接打开就能玩。"}},
            {"@type": "Question", "name": "免费时长用完怎么办？",
             "acceptedAnswer": {"@type": "Answer", "text": "可以邀请朋友换时长，或按需续费。"}},
            {"@type": "Question", "name": "手机上能玩吗？",
             "acceptedAnswer": {"@type": "Answer", "text": "可以，页面自适应手机屏幕。"}},
        ]}
        h = h.replace("</body>", '<script type="application/ld+json">'
                      + json.dumps(data, ensure_ascii=False) + "</script></body>", 1)
        changes.append("faq-ld")

    if "gHowtoTitle" not in h:
        m = re.search(r"window\.__I=(\{.*?\});", h, re.S)
        if m:
            try:
                d = json.loads(m.group(1)); d.update(I18N_NEW)
                h = h[: m.start(1)] + json.dumps(d, ensure_ascii=False) + h[m.end(1):]
                changes.append("i18n")
            except Exception as e:
                changes.append(f"i18n-fail:{e}")

    if "bds-seo" not in h:
        fam = family(slug)
        sibs = [s for s in cat if s != slug and family(s) == fam][:6]
        if len(sibs) < 4:
            sibs += [s for s in cat if s != slug and s not in sibs][: 4 - len(sibs)]
        rel = "".join(
            f'<a href="../{s}/" data-rt="{s}" style="display:inline-block;margin:4px 8px 4px 0;'
            f'padding:6px 12px;border:1px solid #e5e7eb;border-radius:999px;'
            f'text-decoration:none;color:#111;background:#fff">{s.replace("_", " ")}</a>'
            for s in sibs)
        block = (
            '<section class="bds-seo" style="max-width:760px;margin:22px auto;padding:0 4px">'
            '<h2 data-i="gHowtoTitle" style="font-size:1.15rem;margin:16px 0 6px">怎么玩</h2>'
            '<ol style="padding-left:20px;margin:6px 0">'
            '<li data-i="gHowto1"></li><li data-i="gHowto2"></li><li data-i="gHowto3"></li></ol>'
            '<h2 data-i="gFaqTitle" style="font-size:1.15rem;margin:18px 0 6px">常见问题</h2>'
            '<div class="box" style="margin:8px 0"><b data-i="gFaq1q"></b><p data-i="gFaq1a" style="margin:6px 0 0"></p></div>'
            '<div class="box" style="margin:8px 0"><b data-i="gFaq2q"></b><p data-i="gFaq2a" style="margin:6px 0 0"></p></div>'
            '<div class="box" style="margin:8px 0"><b data-i="gFaq3q"></b><p data-i="gFaq3a" style="margin:6px 0 0"></p></div>'
            f'<div class="related-tools" style="margin:18px 0">'
            '<h2 data-i="gRelated" style="font-size:1.05rem;margin:0 0 6px">同类游戏</h2>'
            f'{rel}'
            '<div style="margin:10px 0"><a href="../index.html" data-i="gAll" '
            'style="color:#2563eb;text-decoration:none">全部游戏 →</a></div>'
            '</div>' + AD_BLOCK + '</section>')
        h = h.replace("</body>", block + "</body>", 1)
        changes.append("content-block")

    if "BDS_TRACK" not in h:
        h = h.replace("</body>", TRACK_JS + "</body>", 1)
        changes.append("track")

    h = h.replace("<body", MARK + "<body", 1)
    if not dry:
        path.write_text(h, encoding="utf-8")
    return {"slug": slug, "status": "ok", "changes": changes, "size": len(h)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    cat = game_catalog()
    print(f"arcade 游戏页: {len(cat)} 个")
    items = list(cat.items())
    if args.limit:
        items = items[: args.limit]
    res = []
    for slug, d in items:
        try:
            res.append(enrich(d / "index.html", slug, cat, args.dry_run))
        except Exception as e:  # noqa: BLE001
            res.append({"slug": slug, "status": "error", "error": str(e)[:100]})
    ok = [r for r in res if r.get("status") == "ok"]
    cc = Counter(c for r in ok for c in r.get("changes", []))
    print(f"成功 {len(ok)} / 跳过 {sum(1 for r in res if r.get('status')=='skipped')} / 失败 {sum(1 for r in res if r.get('status')=='error')}")
    print("改动统计:", dict(cc))
    for r in res[:4]:
        print("  例:", r)


if __name__ == "__main__":
    main()
