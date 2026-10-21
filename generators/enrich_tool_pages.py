#!/usr/bin/env python3
"""
工具页批量增强器 —— 把 508 个"孤岛 + 薄内容 + 无变现口"的页面，改造成
  可被爬(内链+结构化数据) / 可被分享(og 图) / 可变现(广告位+CPS 位) / 可观测(统计) 的页面。

每次增强做 6 件事:
  1) 收入保护: 推荐折扣阶梯封顶 30%（原来最高 100% → 邀请 10 人=免单，平台与推荐人双双拿不到钱）
  2) og:image / og:site_name（原来没有 og:image → 微信/Twitter 分享无卡片）
  3) FAQPage JSON-LD（搜索结果富摘要）
  4) 内容深度: "使用方法" + 3 条 FAQ + 相关工具（同分类 3-5 个）+ 更多工具入口（zh/en/ar 三语，走页面自带 data-i 机制）
  5) 广告位容器 data-ad-slot（每页 1 个，对齐 TinyWow/Poki 的变现模型）
  6) 第一方统计打点（PV / 来源 / 工具使用 → /api/track）

用法:
  python ops/enrich_tool_pages.py            # 执行（默认 dry-run=False）
  python ops/enrich_tool_pages.py --dry-run  # 只报告不写
  python ops/enrich_tool_pages.py --limit 20 # 只处理前 20 个（试跑）
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

SITE = Path(r"C:\bingdashan\site")
MARK = "<!-- bds-enriched:v1 -->"
BASE_URL = "https://tools.highkingflower.com"

# 推荐折扣阶梯（原 [[1,10],[2,30],[3,50],[5,70],[10,100]] → 封顶 30%）
OLD_LADDER = "[[1,10],[2,30],[3,50],[5,70],[10,100]]"
NEW_LADDER = "[[1,10],[2,20],[3,30]]"

# 新增的三语文案（注入到 window.__I）
I18N_NEW: Dict[str, Dict[str, str]] = {
    "howtoTitle": {"zh": "使用方法", "en": "How to use", "ar": "كيفية الاستخدام"},
    "howto1": {"zh": "第 1 步：填入左边的数字/文字。", "en": "Step 1: enter the numbers or text on the left.",
                "ar": "الخطوة 1: أدخل الأرقام أو النص على اليسار."},
    "howto2": {"zh": "第 2 步：点「开始」，结果立刻出现在下方。",
                "en": "Step 2: press Run and the result appears instantly.",
                "ar": "الخطوة 2: اضغط تشغيل وستظهر النتيجة فورًا."},
    "howto3": {"zh": "第 3 步：满意就用满免费次数；不够可按月订阅或买断。",
                "en": "Step 3: use the free runs; subscribe or buy out when you need more.",
                "ar": "الخطوة 3: استخدم المجانيات؛ اشترك أو اشترِ عند الحاجة."},
    "faqTitle": {"zh": "常见问题", "en": "FAQ", "ar": "الأسئلة الشائعة"},
    "faq1q": {"zh": "这个工具要注册吗？", "en": "Do I need an account?", "ar": "هل أحتاج حسابًا؟"},
    "faq1a": {"zh": "不用，打开即用；每个工具免费 10 次。", "en": "No. Open and use it; 10 free runs per tool.",
               "ar": "لا. افتح واستخدم؛ 10 استخدامات مجانية لكل أداة."},
    "faq2q": {"zh": "免费次数用完会怎样？", "en": "What happens after the free runs?",
               "ar": "ماذا يحدث بعد المجانيات؟"},
    "faq2a": {"zh": "按月订阅或买断，随时可开通，收据自动发到邮箱。",
               "en": "Subscribe monthly or buy out; a receipt is emailed automatically.",
               "ar": "اشترك شهريًا أو اشترِ؛ يصلك الإيصال تلقائيًا."},
    "faq3q": {"zh": "支持哪些语言？", "en": "Which languages are supported?",
               "ar": "أي اللغات مدعومة؟"},
    "faq3a": {"zh": "中文 / English / العربية，界面与结果都会跟随你的语言。",
               "en": "Chinese / English / Arabic — the UI follows your language.",
               "ar": "الصينية / الإنجليزية / العربية — الواجهة تتبع لغتك."},
    "relatedTitle": {"zh": "相关工具", "en": "Related tools", "ar": "أدوات ذات صلة"},
    "moreTools": {"zh": "浏览全部工具 →", "en": "Browse all tools →", "ar": "تصفح كل الأدوات ←"},
    "adNote": {"zh": "广告", "en": "Ad", "ar": "إعلان"},
}

AD_LOADER_JS = (
    "<script>(function(){try{"
    "if(!window.BDS_ADS||!window.BDS_ADS.client)return;"          # 未配置广告账号 → 安全空转
    "var s=document.createElement('script');s.async=true;"
    "s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+"
    "encodeURIComponent(window.BDS_ADS.client);"
    "s.crossOrigin='anonymous';document.head.appendChild(s);}catch(e){}})();</script>"
)

TRACK_JS = (
    "<script>(function(){"
    "window.BDS_TRACK=function(e,d){try{"
    "var b=JSON.stringify({e:e,d:d||{},p:location.pathname,r:document.referrer||'',t:Date.now()});"
    "if(navigator.sendBeacon){navigator.sendBeacon('/api/track',b);}"
    "else{fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},"
    "body:b,keepalive:true}).catch(function(){});}"
    "}catch(err){}};"
    "try{BDS_TRACK('pv')}catch(e){}"
    "document.addEventListener('click',function(ev){"
    "var t=ev.target&&ev.target.closest?ev.target.closest('button,a'):null;"
    "if(t&&(t.id==='btn'||/unlock|subscribe|pay/i.test(t.textContent||'')))BDS_TRACK('use');"
    "},true);})();</script>"
)

AD_BLOCK = (
    '<div class="ad-slot" data-ad-slot="tool-bottom" aria-label="ad" '
    'style="margin:26px auto;max-width:760px;min-height:90px;'
    'border:1px dashed #d1d5db;border-radius:12px;background:#fff"></div>'
)

RELATED_JS = (
    "<script>(function(){try{var b=document.querySelector('.related-tools');"
    "if(!b)return;var a=b.querySelectorAll('a[data-rt]');"
    "for(var i=0;i<a.length;i++){a[i].addEventListener('click',function(){"
    "try{BDS_TRACK('rel',{t:this.getAttribute('data-rt')})}catch(e){}})}}catch(e){}})();</script>"
)


def build_catalog() -> Dict[str, Dict[str, str]]:
    """从首页卡片解析工具目录: slug -> {zh, sub, cat}"""
    idx = SITE / "index.html"
    if not idx.exists():
        return {}
    html = idx.read_text(encoding="utf-8", errors="ignore")
    cat: Dict[str, Dict[str, str]] = {}
    for m in re.finditer(
        r'<a class="card" href="([a-z0-9_]+)/"([^>]*)>(.*?)</a>', html, re.S
    ):
        slug, attrs, inner = m.group(1), m.group(2), m.group(3)
        zh = re.search(r'data-zh="([^"]*)"', attrs)
        s = re.search(r'data-s="([^"]*)"', attrs)
        ct = re.search(r'data-ct="([^"]*)"', attrs)
        b = re.search(r"<b>(.*?)</b>", inner, re.S)
        cat[slug] = {
            "zh": (zh.group(1) if zh else (b.group(1) if b else slug)),
            "sub": (s.group(1) if s else ""),
            "cat": (ct.group(1) if ct else ""),
        }
    return cat


def tool_dirs() -> List[Path]:
    """站点根下的工具目录（排除 arcade/game/子目录）"""
    out = []
    for p in SITE.iterdir():
        if not p.is_dir():
            continue
        n = p.name
        if n in ("arcade", "node_modules", "api", "scripts", ".git", ".vercel", ".agents"):
            continue
        if (p / "index.html").exists() and re.match(r"^[a-z][a-z0-9_]*$", n):
            out.append(p)
    return out


def pick_related(slug: str, cat: Dict[str, Dict[str, str]], k: int = 5) -> List[Tuple[str, str]]:
    me = cat.get(slug, {})
    c = me.get("cat", "")
    same = [s for s, v in cat.items() if s != slug and v.get("cat") == c and c]
    if len(same) < k:
        pref = slug.split("_")[0]
        same += [s for s, v in cat.items()
                 if s != slug and s not in same and s.split("_")[0] == pref]
    if len(same) < k:
        same += [s for s in cat if s != slug and s not in same]
    return [(s, cat[s]["zh"]) for s in same[:k]]


def build_block(slug: str, cat: Dict[str, Dict[str, str]], related: List[Tuple[str, str]],
                title: str) -> str:
    rel_html = "".join(
        f'<a href="../{s}/" data-rt="{s}" style="display:inline-block;margin:4px 8px 4px 0;'
        f'padding:6px 12px;border:1px solid #e5e7eb;border-radius:999px;'
        f'text-decoration:none;color:#111;background:#fff">{zh}</a>'
        for s, zh in related
    )
    return (
        f'<section class="bds-seo" style="max-width:760px;margin:26px auto;padding:0 4px">'
        f'<h2 data-i="howtoTitle" style="font-size:1.15rem;margin:18px 0 6px">使用方法</h2>'
        f'<ol style="padding-left:20px;margin:6px 0">'
        f'<li data-i="howto1"></li><li data-i="howto2"></li><li data-i="howto3"></li>'
        f'</ol>'
        f'<h2 data-i="faqTitle" style="font-size:1.15rem;margin:20px 0 6px">常见问题</h2>'
        f'<div class="box" style="margin:8px 0"><b data-i="faq1q"></b><p data-i="faq1a" style="margin:6px 0 0"></p></div>'
        f'<div class="box" style="margin:8px 0"><b data-i="faq2q"></b><p data-i="faq2a" style="margin:6px 0 0"></p></div>'
        f'<div class="box" style="margin:8px 0"><b data-i="faq3q"></b><p data-i="faq3a" style="margin:6px 0 0"></p></div>'
        f'<div class="related-tools" style="margin:20px 0">'
        f'<h2 data-i="relatedTitle" style="font-size:1.05rem;margin:0 0 6px">相关工具</h2>'
        f'{rel_html}'
        f'<div style="margin:10px 0"><a href="../index.html" data-i="moreTools" '
        f'style="color:#2563eb;text-decoration:none">浏览全部工具 →</a></div>'
        f'</div>'
        f'{AD_BLOCK}'
        f'</section>'
    )


def faq_ld(title: str, slug: str) -> str:
    data = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": "这个工具要注册吗？",
             "acceptedAnswer": {"@type": "Answer",
                                "text": "不用，打开即用；每个工具免费 10 次。"}},
            {"@type": "Question", "name": "免费次数用完会怎样？",
             "acceptedAnswer": {"@type": "Answer",
                                "text": "按月订阅或买断，收据自动发到邮箱。"}},
            {"@type": "Question", "name": "支持哪些语言？",
             "acceptedAnswer": {"@type": "Answer",
                                "text": "中文 / English / العربية，界面与结果跟随语言切换。"}},
        ],
    }
    return ('<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>")


def enrich_one(path: Path, slug: str, cat: Dict[str, Dict[str, str]], dry: bool) -> Dict[str, Any]:
    html = path.read_text(encoding="utf-8", errors="ignore")
    if MARK in html:
        return {"slug": slug, "status": "skipped-marked"}
    orig_len = len(html)
    changes = []

    # 1) 折扣封顶
    if OLD_LADDER in html:
        html = html.replace(OLD_LADDER, NEW_LADDER)
        changes.append("discount-cap")

    # 2) og:image / og:site_name
    if 'property="og:image"' not in html:
        og = (f'<meta property="og:image" content="{BASE_URL}/icons/favicon-192.png">'
              f'<meta property="og:image:width" content="192">'
              f'<meta property="og:image:height" content="192">'
              f'<meta property="og:site_name" content="bingdashan 工具箱">')
        if 'twitter:card' in html:
            html = html.replace('<meta name="twitter:card"', og + '<meta name="twitter:card"', 1)
            changes.append("og-image")
        else:
            html = html.replace("</head>", og + "</head>", 1)
            changes.append("og-image")

    # 3) FAQPage JSON-LD
    if "FAQPage" not in html:
        title = cat.get(slug, {}).get("zh", slug)
        html = html.replace("</body>", faq_ld(title, slug) + "</body>", 1)
        changes.append("faq-ld")

    # 4) i18n 文案注入
    if "howtoTitle" not in html:
        m = re.search(r"window\.__I=(\{.*?\});", html, re.S)
        if m:
            try:
                d = json.loads(m.group(1))
                d.update(I18N_NEW)
                html = html[: m.start(1)] + json.dumps(d, ensure_ascii=False) + html[m.end(1):]
                changes.append("i18n")
            except Exception as e:
                changes.append(f"i18n-fail:{e}")

    # 5) 内容块 + 广告位 + 相关工具
    if "bds-seo" not in html:
        title = cat.get(slug, {}).get("zh", slug)
        related = pick_related(slug, cat)
        html = html.replace("</body>", build_block(slug, cat, related, title) + "</body>", 1)
        changes.append("content-block")

    # 6) 统计打点 + 广告加载器
    if "BDS_TRACK" not in html:
        html = html.replace("</body>", TRACK_JS + AD_LOADER_JS + RELATED_JS + "</body>", 1)
        changes.append("track")

    html = html.replace("<body", MARK + "<body", 1) if MARK not in html else html
    out = {"slug": slug, "status": "ok", "changes": changes,
           "size_before": orig_len, "size_after": len(html)}
    if not dry:
        path.write_text(html, encoding="utf-8")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    cat = build_catalog()
    print(f"首页解析到工具目录: {len(cat)} 个")
    dirs = tool_dirs()
    print(f"本地工具页目录: {len(dirs)} 个")
    if args.limit:
        dirs = dirs[: args.limit]

    results = []
    for d in dirs:
        try:
            results.append(enrich_one(d / "index.html", d.name, cat, args.dry_run))
        except Exception as e:  # noqa: BLE001
            results.append({"slug": d.name, "status": "error", "error": str(e)[:120]})

    ok = [r for r in results if r.get("status") == "ok"]
    from collections import Counter
    cc = Counter(c for r in ok for c in r.get("changes", []))
    print(f"\n处理完成: 成功 {len(ok)} / 跳过 {sum(1 for r in results if r.get('status')=='skipped-marked')} / 失败 {sum(1 for r in results if r.get('status')=='error')}")
    print("改动统计:", dict(cc))
    if ok:
        avg = sum(r["size_after"] - r["size_before"] for r in ok) / len(ok)
        print(f"平均每页增大 {avg:.0f} 字节 (原 ~16.4KB → 约 {(16356+avg)/1024:.1f}KB)")
    for r in results[:5]:
        print("  例:", r)
    if not args.dry_run:
        rep = Path(r"F:\2026\新建文件夹\artifacts\enrich_report.json")
        rep.parent.mkdir(parents=True, exist_ok=True)
        rep.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print("报告:", rep)


if __name__ == "__main__":
    main()
