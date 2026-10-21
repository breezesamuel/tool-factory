#!/usr/bin/env python3
"""
从工具目录生成工具页面 + 分类枢纽页 + 搜索索引 + sitemap。

设计要点:
  · 共享运行时走 /bds-core.js（付费墙/多语/统计/广告位）+ /bds-engines.js（公式引擎）
    → 每页只带自身逻辑（~7KB），5267 页 ≈ 37MB（不是 120MB）
  · 每页内容块由**该工具自己的参数**生成（换算系数/利率/期限…）→ 页面之间 Jaccard 低
  · 大分类（单位换算 4744 个）按"单位类别"再分枢纽页，避免一个页面塞几千条
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"F:\2026\新建文件夹")
SITE = Path(r"C:\bingdashan\site")
CATALOG = ROOT / "artifacts" / "tool_catalog.json"
BASE = "https://tools.highkingflower.com"

# 现有页面的样式表（抽一次，全站共用）
_lc = (SITE / "l_cash" / "index.html").read_text(encoding="utf-8", errors="replace")
_m = re.search(r"<style>(.*?)</style>", _lc, re.S)
CSS = _m.group(1) if _m else "body{font-family:system-ui,sans-serif}"

NAV = ('<div class="nav"><a href="../index.html" data-i="home">回总目录</a>'
       '<a href="../arcade/index.html">娱乐中心</a>'
       '<a href="../pricing.html">收费规则</a>'
       '<span class="row"><button class="lang-btn" id="h-zh" data-i="lang" onclick="bdsSetLang(\'zh\')">zh</button> '
       '<button class="lang-btn" id="h-en" data-i="lang" onclick="bdsSetLang(\'en\')">en</button> '
       '<button class="lang-btn" id="h-ar" data-i="lang" onclick="bdsSetLang(\'ar\')">ar</button></span>'
       '<span data-i="pay" style="margin-left:auto"></span></div>')


def esc(s) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def jdump(o) -> str:
    return json.dumps(o, ensure_ascii=False, separators=(",", ":"))


def unique_note(spec) -> str:
    """每页独有的说明段（来自该工具自己的单位/系数/参数）。
    目的: 让同类别页面文本真正不同（避免 Jaccard≈1 的规模化内容）。"""
    eng = spec["engine"]
    p = spec.get("params") or {}
    t = spec["title"]
    if eng == "unit":
        u = p["rows"]
        frm, to = u[p["from"]], u[p["to"]]
        ratio = frm["f"] / to["f"]
        return (f"本工具按国际标准换算：<b>1 {frm['zh']} = {ratio:.10g} {to['zh']}</b>，"
                f"同时给出反向值与常用倍数（0.5 / 2 / 5 / 10 / 100）。"
                f"适用于{to['zh']}与{frm['zh']}之间的单位对照，结果保留 {to['d']} 位小数。")
    if eng in ("loan_payment", "loan_total_interest", "loan_prepay", "loan_compare"):
        return (f"按等额本息公式计算：年利率 <b>{p.get('rate', p.get('a1', ''))}%</b>、"
                f"期限 <b>{p.get('years', p.get('t1', ''))} 年</b>，"
                f"同时给出总利息与年化还款额，便于横向比较不同方案。")
    if eng == "compound":
        return f"按年复利 {p.get('periods', 12)} 次/月计息，展示本息合计与利息部分，便于判断复利累积效果。"
    if eng == "area":
        shape = {"rect": "长方形", "tri": "三角形", "circle": "圆形", "trap": "梯形", "para": "平行四边形"}.get(p.get("shape"), "长方形")
        return f"按{shape}公式计算面积，并给出对应的边长参数与周长参考，可直接用于算料与报价。"
    if eng == "volume":
        shape = {"box": "长方体", "cyl": "圆柱体", "sphere": "球体", "cone": "圆锥体"}.get(p.get("shape"), "长方体")
        return f"按{shape}体积公式计算，并给出装满所需件数参考（按单件容积换算）。"
    if eng == "discount_chain":
        ds = " → ".join(f"{d}%" for d in p.get("ds", []))
        return f"按叠加折扣 {ds} 依次计算最终到手价（折扣是**乘法叠加**而不是减法相加），并给出每一步的价格。"
    if eng == "tax_vat":
        return "支持价税合计与不含税金额双向换算，并给出税额与反算（gross-up）结果，税率可自行填写。"
    if eng == "salary_net":
        return "按「应发工资 − 社保公积金 − 个税」计算到手工资，并给出实际税负率与折合时薪。"
    if eng == "pet_food":
        kind = "猫" if p.get("kind") == "cat" else "狗"
        return f"按{kind}体重与活动系数估算每日喂食量，并给出月度和年度用量，便于与宠粮包装规格对齐。"
    if eng == "calorie_target":
        goal = {"cut": "减脂", "gain": "增肌", "keep": "维持"}.get(p.get("goal"), "减脂")
        return f"按 BMR × 活动系数得到每日消耗，再按{goal}目标调整缺口或盈余，同时给出蛋白与饮水建议。"
    if eng == "text_ops":
        return f"对输入文本执行「{t['zh'].replace('工具', '')}」处理，输出可直接复制，并给出处理前后的长度对比。"
    if eng == "base64" or eng == "url_encode":
        mode = "编码" if p.get("mode") == "encode" else "解码"
        return f"对输入内容做 Base64/URL {mode}处理，输出可直接复制，并给出长度膨胀比与解码失败提示。"
    if eng == "color_convert":
        return "在 HEX 与 RGB 之间双向换算，同时给出亮度（相对）与灰度值，用于对比度检查。"
    if eng == "stat":
        return "输入一组数字（空格或逗号分隔），一次性给出平均数、中位数、标准差、方差与四分位距。"
    if eng == "percentile":
        return "输入一组数字与目标分位，给出对应分位值，以及最小值、中位数与最大值的对照。"
    if eng == "bmi":
        return "按 BMI = 体重(kg) ÷ 身高(m)² 计算，给出区间判定与对应健康体重范围（仅用于筛查，不替代诊断）。"
    if eng == "bmr":
        return "按 Mifflin-St Jeor 公式计算基础代谢率（BMR），并给出 30 天热量估算。"
    if eng == "tdee":
        return "用活动系数把基础代谢放大为每日总消耗（TDEE），并给出减脂/维持/增重三种目标下的摄入建议。"
    if eng == "age":
        return "按出生日期与截止日期精确计算岁、月、日与总天数，避免「虚岁/周岁」混淆。"
    if eng == "date_diff":
        return "计算两个日期之间的自然日天数，并折算为周/月/年，同时给出含首尾的计数方式。"
    if eng == "workdays":
        return "按周一至周五计算工作日天数，可填入法定节假日 JSON 排除，输出自然日与周末天数对照。"
    if eng == "sleep_cycles":
        return "按 90 分钟睡眠周期 + 15 分钟入睡时间反推最合适的入睡时刻，并给出 6 周期版本。"
    if eng == "chinese_age":
        return "同时给出周岁与虚岁，并标注生日是否已过，避免与身份证件信息对不上。"
    if eng == "zodiac":
        return "按公历生日判定星座，并给出日期区间参考。"
    return f"输入数值后直接得到结果，保留足够小数位，并附上关键中间量便于核对。"


def content_block(spec, related, params_rows) -> str:
    """每页唯一的内容块：用法 + 参数说明（来自该工具自己的参数）+ 相关工具 + 广告位。"""
    steps = "".join(
        f'<li data-i="howto{i+1}"></li>' for i in range(3))
    faq_extra = ""
    if params_rows:
        # 逐页唯一的 FAQ（不能用 data-i：i18n 里没有这个 key → 所有页会显示同一段）
        faq_extra = ('<div class="box" style="margin:8px 0"><b>'
                     f'{esc(spec["title"]["zh"])}是怎么算的？</b>'
                     f'<p style="margin:6px 0 0">'
                     + "；".join(f"{esc(k)}：{esc(v)}" for k, v in params_rows[:3])
                     + '。所有参数都可以在输入框里改，结果会实时跟着变。</p></div>')
    note = unique_note(spec)
    rel = "".join(
        f'<a href="../{s}/" data-rt="{s}" style="display:inline-block;margin:4px 8px 4px 0;padding:6px 12px;'
        f'border:1px solid #e5e7eb;border-radius:999px;text-decoration:none;color:#111;background:#fff">'
        f'{esc(t["title"]["zh"])}</a>' for s, t in related)
    prows = "".join(
        f'<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;'
        f'border-bottom:1px dashed #e5e7eb"><span style="color:#555">{esc(k)}</span>'
        f'<b style="white-space:nowrap">{esc(v)}</b></div>' for k, v in params_rows)
    pblock = (f'<div style="margin:12px 0 4px;font-size:.9rem;color:#555;'
              f'border-left:3px solid #e5e7eb;padding-left:10px">{prows}</div>') if params_rows else ""
    return (
        '<section class="bds-seo" style="max-width:760px;margin:26px auto;padding:0 4px">'
        f'<p style="font-size:.95rem;color:#333;background:#f9fafb;border-left:3px solid #2563eb;'
        f'padding:10px 12px;border-radius:0 8px 8px 0;margin:0 0 16px">{note}</p>'
        '<h2 data-i="howtoTitle" style="font-size:1.15rem;margin:18px 0 6px">使用方法</h2>'
        f'<ol style="padding-left:20px;margin:6px 0">{steps}</ol>'
        + pblock +
        '<h2 data-i="faqTitle" style="font-size:1.15rem;margin:20px 0 6px">常见问题</h2>'
        '<div class="box" style="margin:8px 0"><b data-i="faq1q"></b><p data-i="faq1a" style="margin:6px 0 0"></p></div>'
        '<div class="box" style="margin:8px 0"><b data-i="faq2q"></b><p data-i="faq2a" style="margin:6px 0 0"></p></div>'
        '<div class="box" style="margin:8px 0"><b data-i="faq3q"></b><p data-i="faq3a" style="margin:6px 0 0"></p></div>'
        + faq_extra +
        '<div class="related-tools" style="margin:20px 0">'
        '<h2 data-i="relatedTitle" style="font-size:1.05rem;margin:0 0 6px">相关工具</h2>'
        f'{rel}'
        '<div style="margin:10px 0"><a href="../index.html" data-i="moreTools" '
        'style="color:#2563eb;text-decoration:none">浏览全部工具 →</a></div>'
        '</div>'
        '<div class="ad-slot" data-ad-slot="tool-bottom" aria-label="ad" '
        'style="margin:26px auto;max-width:760px;min-height:90px;'
        'border:1px dashed #d1d5db;border-radius:12px;background:#fff"></div>'
        '</section>')


def params_of(spec) -> list[tuple[str, str]]:
    """把该工具自己的参数写成"说明行"（保证每页内容不同）。"""
    rows: list[tuple[str, str]] = []
    eng = spec["engine"]
    p = spec.get("params") or {}
    if eng == "unit":
        u = p["rows"]
        frm, to = u[p["from"]], u[p["to"]]
        rows.append(("换算基准", f"1 {frm['zh']} = {frm['f']:g} {to['zh']}"))
        rows.append(("可用单位数", f"{len(u)} 种"))
        rows.append(("结果精度", f"{to['d']} 位小数"))
    elif eng in ("loan_payment", "loan_total_interest", "loan_prepay", "loan_compare"):
        rows.append(("默认年利率", f"{p.get('rate', p.get('a1', ''))}%"))
        rows.append(("默认年限", f"{p.get('years', p.get('t1', ''))} 年"))
    elif eng == "compound":
        rows.append(("计息频次", f"每年 {p.get('periods', 12)} 次"))
    elif eng == "tax_vat":
        rows.append(("模式", "价税合计" if p.get("mode") == "add" else "不含税"))
    elif eng == "area":
        rows.append(("图形", {"rect": "长方形", "tri": "三角形", "circle": "圆形",
                             "trap": "梯形", "para": "平行四边形"}.get(p.get("shape"), "长方形")))
    elif eng == "volume":
        rows.append(("立体", {"box": "长方体", "cyl": "圆柱体", "sphere": "球体",
                               "cone": "圆锥体"}.get(p.get("shape"), "长方体")))
    elif eng == "discount_chain":
        rows.append(("叠加折扣", " → ".join(f"{d}%" for d in p.get("ds", []))))
    elif eng == "salary_net":
        rows.append(("社保比例", "21%"))
    elif eng == "pet_food":
        rows.append(("种类", "猫" if p.get("kind") == "cat" else "狗"))
    elif eng == "calorie_target":
        rows.append(("目标", {"cut": "减脂", "gain": "增肌", "keep": "维持"}.get(p.get("goal"), "减脂")))
    elif eng == "text_ops":
        rows.append(("处理方式", spec["title"]["zh"]))
    elif eng == "base64" or eng == "url_encode":
        rows.append(("模式", "编码" if p.get("mode") == "encode" else "解码"))
    elif eng == "color_convert":
        rows.append(("模式", "HEX → RGB" if p.get("mode") == "hex2rgb" else "RGB → HEX"))
    for i, inp in enumerate(spec.get("inputs", [])[:3], 1):
        rows.append((f"输入 {i}：{inp['label']['zh']}", f"默认 {inp.get('def', '')}"))
    return rows


def page_html(spec, related) -> str:
    t = spec["title"]
    cat = spec["cat"]
    pain = spec["pain"]
    desc_zh = f"{t['zh']} - {pain['zh']}。免费使用 10 次，支持中文/英文/阿拉伯语，打开即用无需下载。"
    desc_en = f"{t['en']} - {pain['en']}. Free 10 uses, Chinese/English/Arabic, works in browser, no download."
    desc_ar = f"{t['ar']} - {pain['ar']}. 10 استخدامات مجانية، يعمل في المتصفح."
    inputs_html = ""
    for inp in spec.get("inputs", []):
        typ = inp.get("type", "number")
        if typ == "textarea":
            inputs_html += f'<label data-i="{inp["id"]}">{esc(inp["label"]["zh"])}</label>' \
                           f'<textarea id="{inp["id"]}" rows="3" placeholder=""></textarea>'
        else:
            ph = "0" if typ == "number" else "YYYY-MM-DD"
            inputs_html += f'<label data-i="{inp["id"]}">{esc(inp["label"]["zh"])}</label>' \
                           f'<input id="{inp["id"]}" type="{typ}" value="{esc(inp.get("def", ""))}" placeholder="{ph}">'
    i18n_extra = {}
    for inp in spec.get("inputs", []):
        i18n_extra[inp["id"]] = inp["label"]
    ld = {
        "@context": "https://schema.org", "@type": "WebApplication",
        "name": t["zh"], "description": pain["zh"],
        "applicationCategory": cat["zh"], "operatingSystem": "Web",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "CNY",
                   "description": "每工具免费 10 次"},
        "inLanguage": ["zh", "en", "ar"], "url": f"{BASE}/{spec['slug']}/",
    }
    faq = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": "这个工具要注册吗？",
             "acceptedAnswer": {"@type": "Answer", "text": "不用，打开即用；每个工具免费 10 次。"}},
            {"@type": "Question", "name": "免费次数用完会怎样？",
             "acceptedAnswer": {"@type": "Answer", "text": "按月订阅或买断，收据自动发到邮箱。"}},
            {"@type": "Question", "name": "支持哪些语言？",
             "acceptedAnswer": {"@type": "Answer", "text": "中文 / English / العربية，界面与结果跟随语言切换。"}},
        ],
    }
    if params_of(spec):
        faq["mainEntity"].append({
            "@type": "Question", "name": f"{t['zh']}的换算/计算依据是什么？",
            "acceptedAnswer": {"@type": "Answer",
                               "text": "；".join(f"{k}：{v}" for k, v in params_of(spec)[:3])}})
    engine = spec["engine"]
    params = jdump(spec.get("params") or {})
    ids = [inp["id"] for inp in spec.get("inputs", [])]
    # 注意: 用空串拼接（每条语句自带分号）—— 用逗号会拼成
    # "var N1=...,var N2=..." → SyntaxError → 整个脚本不执行 → bdsGo 未定义
    vals = "".join(f'var {i}=document.getElementById("{i}").value;' for i in ids)
    bdsgo = (f"function bdsGo(){{if(!window.tryUse()){{return;}}try{{{vals}"
             f'var out=BDS_E[{jdump(engine)}]([{",".join(ids)}],{params});'
             f'document.getElementById("o").innerHTML=out;}}catch(e){{'
             f'document.getElementById("o").textContent="JS:"+e.message;}}}}')
    tjson = jdump({"t": t, "p": {"zh": cat["zh"] + " 工具", "en": cat["en"] + " tool",
                                 "ar": cat["ar"]}, "pain": pain})
    inline_js = (
        "window.BDS_SLUG=" + jdump(spec["slug"]) + ";"
        "window.__I=Object.assign(window.__I||{}," + jdump(i18n_extra) + ");"
        "window.__T=" + tjson + ";\n" + bdsgo
    )
    head = (
        '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        f"<title>{esc(t['zh'])}</title>\n"
        f'<meta name="description" content="{esc(desc_zh)}">\n'
        f'<link rel="canonical" href="{BASE}/{spec["slug"]}/">\n'
        f'<meta property="og:title" content="{esc(t["zh"])}">\n'
        f'<meta property="og:description" content="{esc(desc_zh)}">\n'
        '<meta property="og:type" content="website">\n'
        f'<meta property="og:url" content="{BASE}/{spec["slug"]}/">\n'
        f'<meta property="og:image" content="{BASE}/icons/favicon-192.png">\n'
        '<meta property="og:image:width" content="192">'
        '<meta property="og:image:height" content="192">\n'
        '<meta property="og:site_name" content="bingdashan 工具箱">\n'
        '<meta name="twitter:card" content="summary_large_image">\n'
        f"<style>{CSS}</style>\n"
        "</head><body>"
    )
    body_html = (
        NAV + "\n"
        f'<h1 id="ttl">{esc(t["zh"])}</h1>\n'
        f'<script type="application/ld+json">{jdump(ld)}</script>\n'
        '<div class="freebar"><b data-i="frees">免费剩余</b>: <span id="freeleft">10</span></div>\n'
        f'<div class="box"><div class="row" style="font-size:.85rem;color:#555"><span><b data-i="cat">分类</b>: '
        f'{esc(cat["zh"])}</span> · <span><b data-i="pain">痛点</b>: '
        f'<span id="per2">{esc(pain["zh"])}</span></span></div></div>\n'
        f'<div class="box">{inputs_html}<button id="btn" onclick="bdsGo()">'
        '<span data-i="btn">开始</span></button><div class="out" id="o"></div></div>\n'
        '<div id="gate" style="display:none"><div class="box"><b data-i="unusable">请先解锁</b><br>'
        '<button onclick="showModal()"><span data-i="pay">解锁工具</span></button></div></div>\n'
        '<div class="modal-mask" id="modal" style="display:none"><div id="modal-body"></div></div>\n'
        f'<p class="k" id="kT">bingdashan · {esc(cat["zh"])}</p>\n'
        '<script src="/bds-core.js"></script>\n'
        '<script src="/bds-engines.js"></script>\n'
        f"<script>{inline_js}</script>\n"
        f'<script type="application/ld+json">{jdump(faq)}</script>\n'
        + content_block(spec, related, params_of(spec)) + "\n"
        "</body></html>"
    )
    return head + body_html


def hub_html(title_zh, title_en, cards, sub_title_zh="", desc="") -> str:
    cs = "".join(
        f'<a class="card" href="../{c["slug"]}/" data-s="{esc(c["kw"])}" '
        f'data-zh="{esc(c["title"]["zh"])}" data-ct="{esc(c["cat"]["zh"])}">'
        f'<b>{esc(c["title"]["zh"])}</b><br><small>{esc(c["desc"])}</small></a>'
        for c in cards)
    return f"""<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title_zh)}</title>
<meta name="description" content="{esc(desc or (title_zh + ' —— 分类工具合集，' + str(len(cards)) + ' 个工具，打开即用。'))}">
<link rel="canonical" href="{BASE}/{title_en}/">
<meta property="og:title" content="{esc(title_zh)}"><meta property="og:type" content="website">
<meta property="og:url" content="{BASE}/{title_en}/"><meta property="og:image" content="{BASE}/icons/favicon-192.png">
<meta name="twitter:card" content="summary_large_image"><style>{CSS}</style></head><body>
{NAV}
<h1>{esc(title_zh)}</h1>
<p style="color:#555;margin:4px 0 14px">{esc(sub_title_zh or f'共 {len(cards)} 个工具')}</p>
<div class="row" style="flex-wrap:wrap;gap:10px;margin-bottom:14px">
<input id="search" placeholder="搜索本分类工具" style="max-width:320px">
<span id="qlog" style="color:#777;font-size:.9rem"></span></div>
<div class="row" style="display:flex;flex-wrap:wrap;gap:10px">{cs}</div>
<script src="/bds-core.js"></script>
<script>document.getElementById("search").oninput=function(){{var v=this.value.toLowerCase(),n=0;document.querySelectorAll(".card").forEach(function(c){{var k=(c.getAttribute("data-s")||'')+' '+(c.getAttribute("data-zh")||'');var on=(!v||k.toLowerCase().indexOf(v)>=0);c.style.display=on?"":"none";if(on)n++;}});document.getElementById("qlog").textContent=n+" / "+document.querySelectorAll(".card").length;}};</script>
</body></html>"""


def main() -> None:
    tools = json.loads(CATALOG.read_text(encoding="utf-8"))
    print(f"目录: {len(tools)} 个工具")

    # 分类 → 工具
    by_cat: dict[str, list] = defaultdict(list)
    for t in tools:
        by_cat[t["cat"]["zh"]].append(t)

    # 单位换算再按"单位类别"细分（u_<类别>_<a>_<b>）
    unit_groups: dict[str, list] = defaultdict(list)
    for t in tools:
        if t["cat"]["zh"] == "单位换算":
            unit_groups[t["slug"].split("_")[1]].append(t)

    # 相关工具：同分类（同单位类别）内取邻近几个
    rel_pool: dict[str, list] = {}
    for key, items in by_cat.items():
        if key == "单位换算":
            for g, gitems in unit_groups.items():
                rel_pool[g] = gitems
        else:
            rel_pool[key] = items

    written = 0
    index: list[dict] = []
    for t in tools:
        slug = t["slug"]
        d = SITE / slug
        d.mkdir(parents=True, exist_ok=True)
        pool = rel_pool.get(t["cat"]["zh"] if t["cat"]["zh"] != "单位换算"
                            else slug.split("_")[1], [])
        if not pool:
            pool = by_cat[t["cat"]["zh"]]
        related = []
        if pool:
            try:
                i = pool.index(t)
            except ValueError:
                i = 0
            for k in range(1, 6):
                j = (i + k) % len(pool)
                if pool[j]["slug"] != slug:
                    related.append((pool[j]["slug"], pool[j]))
        (d / "index.html").write_text(page_html(t, related), encoding="utf-8")
        written += 1
        kw = f"{t['title']['zh']} {t['cat']['zh']} {t['pain']['zh']} {t['title']['en']}"
        index.append({"s": slug, "t": t["title"]["zh"], "c": t["cat"]["zh"], "k": kw[:120]})

    print(f"✅ 生成工具页 {written} 个")

    # ---- 分类枢纽页 ----
    hubs = 0
    for g, items in unit_groups.items():
        slug = "cat_u_" + g
        cards = [{"slug": t["slug"], "title": t["title"], "cat": t["cat"],
                  "desc": t["pain"]["zh"], "kw": t["title"]["zh"] + " " + g} for t in items]
        d = SITE / slug
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(hub_html(
            f"{g}单位换算工具", slug, cards,
            f"{g}类共 {len(items)} 个换算工具：X转Y 双向可用，结果按国际单位换算。",
            f"{g}单位换算合集：{len(items)} 个常用换算工具，中文/English/العربية，打开即用。"),
            encoding="utf-8")
        hubs += 1
    for cat, items in by_cat.items():
        if cat == "单位换算":
            continue
        slug = "cat_" + cat
        cards = [{"slug": t["slug"], "title": t["title"], "cat": t["cat"],
                  "desc": t["pain"]["zh"], "kw": t["title"]["zh"] + " " + cat} for t in items]
        d = SITE / slug
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(hub_html(
            f"{cat}类工具合集", slug, cards,
            f"共 {len(items)} 个{cat}工具", f"{cat}工具合集：{len(items)} 个可在线直接用的工具。"),
            encoding="utf-8")
        hubs += 1
    print(f"✅ 生成分类枢纽页 {hubs} 个")

    # ---- 搜索索引 ----
    # 补上已有 509 个工具（从首页卡片解析）
    home = (SITE / "index.html").read_text(encoding="utf-8", errors="replace")
    for m in re.finditer(r'<a class="card" href="([a-z0-9_]+)/"[^>]*data-s="([^"]*)"[^>]*>(.*?)</a>', home, re.S):
        slug, kw, inner = m.group(1), m.group(2), m.group(3)
        b = re.search(r"<b>(.*?)</b>", inner, re.S)
        t = re.sub(r"<[^>]+>", "", b.group(1) if b else "").strip()
        index.append({"s": slug, "t": t, "c": "", "k": (kw + " " + t)[:120]})
    (SITE / "tools-index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    print(f"✅ 搜索索引 {len(index)} 条（{(SITE / 'tools-index.json').stat().st_size/1024:.0f} KB）")

    # ---- sitemap ----
    urls = [f"{BASE}/{t['s']}/" for t in index]
    games = sorted(p.name for p in (SITE / "arcade").iterdir()
                   if p.is_dir() and (p / "index.html").exists())
    urls += [f"{BASE}/arcade/{g}/" for g in games]
    urls += [f"{BASE}/cat_{k}/" for k in list(unit_groups.keys())]
    urls += [f"{BASE}/cat_{c}/" for c in by_cat if c != "单位换算"]
    urls += [f"{BASE}/", f"{BASE}/arcade/", f"{BASE}/pricing.html"]
    seen, uniq = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f"  <url><loc>{u}</loc></url>" for u in uniq]
    sm.append("</urlset>")
    (SITE / "sitemap.xml").write_text("\n".join(sm), encoding="utf-8")
    print(f"✅ sitemap {len(uniq)} 条 URL（{(SITE / 'sitemap.xml').stat().st_size/1024:.0f} KB）")


if __name__ == "__main__":
    main()
