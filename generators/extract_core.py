#!/usr/bin/env python3
"""
抽取工具页的共享运行时 → site/bds-core.js：
  · window.__I 的**基础**字典（frees/btn/home/pay/... 约 4.6KB，全站一致）
  · 付费墙 / 多语 / 统计 / 广告位 / 相关工具 运行时
每页只剩：BDS_SLUG、自己的 i18n key、window.__T、bdsGo 计算逻辑。
（程序化抽取，不手抄 → 不会与线上行为漂移）
"""
from __future__ import annotations

import json
import re
from pathlib import Path

SITE = Path(r"C:\bingdashan\site")
SRC = SITE / "l_cash" / "index.html"
OUT = SITE / "bds-core.js"

h = SRC.read_text(encoding="utf-8", errors="replace")
scripts = re.findall(r"<script[^>]*>(.*?)</script>", h, re.S)
s1 = scripts[1]

# 1) 基础 __I 字典：window.__I={...};
m = re.search(r"window\.__I=(\{.*?\});window\.__T=", s1, re.S)
if not m:
    raise SystemExit("未能解析 window.__I")
base_i = json.loads(m.group(1))
# 2) window.__T（每页不同，键名未加引号 → 不是合法 JSON，只做存在性检查）
per_page_keys = set(re.findall(r"window\.__T=\{(\w+):", s1))

# 3) 运行时 + 统计/广告/相关工具
runtime = scripts[2].strip()
track = scripts[5].strip()
ads = scripts[6].strip()
related = scripts[7].strip()

header = """/*!
 * bds-core.js —— bingdashan 工具页/游戏页共享运行时
 *   基础多语字典 + 付费墙(10 次免费/返现折扣/套餐) + 语言切换 + 第一方统计 + 广告位 + 相关工具
 * 由 ops/extract_core.py 从真实页面程序化抽取（勿手改：手改会与线上行为漂移）。
 * 页面只需提供: window.BDS_SLUG / window.__I(增量) / window.__T / bdsGo()
 */
"""
core = (
    "window.__I = Object.assign(window.__I || {}, "
    + json.dumps(base_i, ensure_ascii=False)
    + ");\n"
    + runtime + "\n\n" + track + "\n\n" + ads + "\n\n" + related + "\n"
)
OUT.write_text(header + core, encoding="utf-8")

print(f"✅ {OUT.name}: {len(core)} 字节")
print(f"   基础 i18n key: {len(base_i)} 个")
print(f"   运行时: {len(runtime)}B  统计: {len(track)}B  广告: {len(ads)}B  相关工具: {len(related)}B")
print(f"   每页 __T 字段: {sorted(per_page_keys)}")
