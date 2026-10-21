#!/usr/bin/env python3
"""
更新游戏中心索引页 + sitemap + 首页游戏数（适配 5304 款游戏）。
索引页：按分类分组 + 搜索（一次只渲染分类内的游戏，避免 5304 张卡一次性进 DOM）。
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"F:\2026\新建文件夹")
SITE = Path(r"C:\bingdashan\site")
ARC = SITE / "arcade"
BASE = "https://tools.highkingflower.com"
GAMES = json.loads((ROOT / "artifacts" / "arcade_v2.json").read_text(encoding="utf-8"))

sample = (ARC / GAMES[0]["n"] / "index.html").read_text(encoding="utf-8", errors="replace")
css = re.search(r"<style>(.*?)</style>", sample, re.S).group(1)


def esc(s) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def jdump(o) -> str:
    return json.dumps(o, ensure_ascii=False, separators=(",", ":"))


by_cat = defaultdict(list)
for g in GAMES:
    by_cat[g["cat"]].append(g)

# 索引数据（每条只带必要字段，控制体积）
index_data = [{
    "c": g["cat"], "n": g["n"], "t": g["t"]["zh"],
    "k": (g["t"]["zh"] + " " + g["theme"]["zh"] + " " + g["unit"]["zh"] + " " + g["lv"]["zh"]),
} for g in GAMES]

# ---- 索引页 ----
cat_links = "".join(
    f'<a href="#cat-{i}" style="display:inline-block;margin:4px 8px 4px 0;padding:6px 12px;'
    f'border:1px solid #e5e7eb;border-radius:999px;text-decoration:none;color:#111;background:#fff">'
    f'{esc(c)} <span style="color:#999;font-size:.8rem">{len(v)}</span></a>'
    for i, (c, v) in enumerate(sorted(by_cat.items(), key=lambda kv: -len(kv[1]))))

sections = ""
for i, (c, items) in enumerate(sorted(by_cat.items(), key=lambda kv: -len(kv[1]))):
    cards = "".join(
        f'<a class="card" href="{g["n"]}/" data-k="{esc(g["t"]["zh"] + " " + g["theme"]["zh"] + " " + g["unit"]["zh"] + " " + g["lv"]["zh"])}">'
        f'<b>{esc(g["t"]["zh"])}</b>'
        f'<span>{esc(g["unit"]["zh"])} · {esc(g["lv"]["zh"])} · {esc(g["theme"]["zh"])}</span>'
        f'<span class="arc">{esc(g["cat"])}</span></a>' for g in items)
    sections += (f'<h2 id="cat-{i}">{esc(c)} <span style="font-weight:400;color:#999;font-size:.8rem">'
                 f'×{len(items)}</span></h2><div class="grid">{cards}</div>')

search_js = """
<script>
(function(){
  var idx=window.__GAMES||[];
  var inp=document.getElementById('search');
  var log=document.getElementById('qlog');
  function apply(q){
    q=(q||'').trim().toLowerCase();
    var n=0;
    document.querySelectorAll('.grid').forEach(function(g){
      var vis=0;
      g.querySelectorAll('.card').forEach(function(c){
        var k=(c.getAttribute('data-k')||'').toLowerCase();
        var on=(!q||k.indexOf(q)>=0);
        c.style.display=on?'':'none';
        if(on)vis++;
      });
      var h2=g.previousElementSibling;
      if(h2&&h2.tagName==='H2')h2.style.display=(!q||vis>0)?'':'none';
      n+=vis;
    });
    if(log)log.textContent=n+' / '+document.querySelectorAll('.card').length;
  }
  if(inp)inp.oninput=function(){apply(this.value);};
  apply('');
})();
</script>
"""

html = (
    '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    f'<title>AI 娱乐中心 · {len(GAMES)} 个小游戏 · bingdashan</title>'
    f'<meta name="description" content="AI 娱乐中心：{len(GAMES)} 个在线小游戏，涵盖算术、语言、记忆、反应、益智、逻辑等。'
    '每个游戏免费 10 分钟，之后每分钟 0.2 元，邀请好友双方各送 10 分钟。">'
    f'<link rel="canonical" href="{BASE}/arcade/">'
    f'<meta property="og:title" content="AI 娱乐中心 · {len(GAMES)} 个小游戏">'
    f'<meta property="og:description" content="{len(GAMES)} 个免费在线小游戏，中英阿三语，打开即玩。">'
    f'<meta property="og:url" content="{BASE}/arcade/">'
    f'<meta property="og:image" content="{BASE}/icons/favicon-192.png">'
    '<meta name="twitter:card" content="summary_large_image">'
    f'<style>{css}</style></head><body>'
    '<div class="nav"><a href="../index.html" data-i="home">回总目录</a>'
    '<a href="../pricing.html">收费规则</a>'
    '<span class="row"><button class="lang-btn" id="h-zh" data-i="lang" onclick="bdsSetLang(\'zh\')">zh</button> '
    '<button class="lang-btn" id="h-en" data-i="lang" onclick="bdsSetLang(\'en\')">en</button> '
    '<button class="lang-btn" id="h-ar" data-i="lang" onclick="bdsSetLang(\'ar\')">ar</button></span>'
    '<span data-i="pay" style="margin-left:auto"></span></div>'
    f'<h1>AI 娱乐中心 <span style="font-size:.9rem;color:#777">{len(GAMES)} games</span></h1>'
    '<div class="freebar">每个游戏免费 10 分钟 · 之后每分钟 0.2 元 · 邀请 1 人双方各 +10 分钟</div>'
    '<input id="search" placeholder="搜索游戏/search/ابحث…"><div id="qlog"></div>'
    f'<h2>按分类浏览 <span style="font-weight:400;color:#999;font-size:.8rem">×{len(by_cat)} 类</span></h2>'
    f'<div class="grid" style="display:block">{cat_links}</div>'
    f'{sections}'
    f'<script>window.__GAMES={jdump(index_data)};</script>'
    f'{search_js}'
    '</body></html>'
)
(ARC / "index.html").write_text(html, encoding="utf-8")
print(f"✅ 游戏中心索引页已更新: {len(GAMES)} 款 / {len(by_cat)} 分类 / {len(html)/1024:.0f} KB")

# ---- sitemap：工具 + 游戏 + 分类枢纽 ----
home = (SITE / "index.html").read_text(encoding="utf-8", errors="replace")
tool_slugs = set(re.findall(r'href="([a-z0-9_]+)/"', home))
try:
    for it in json.loads((SITE / "tools-index.json").read_text(encoding="utf-8")):
        tool_slugs.add(it["s"])
except Exception as e:
    print("  ⚠️ tools-index.json 解析失败:", e)
hubs = sorted(p.name for p in SITE.iterdir() if p.is_dir() and p.name.startswith("cat_"))
urls = [f"{BASE}/", f"{BASE}/arcade/", f"{BASE}/pricing.html"]
urls += [f"{BASE}/{s}/" for s in sorted(tool_slugs) if (SITE / s / "index.html").exists()]
urls += [f"{BASE}/arcade/{g['n']}/" for g in GAMES]
urls += [f"{BASE}/{h}/" for h in hubs]
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
print(f"✅ sitemap: {len(uniq)} 条 URL ({(SITE / 'sitemap.xml').stat().st_size/1024/1024:.1f} MB)")

# ---- 首页游戏数 ----
h = (SITE / "index.html").read_text(encoding="utf-8")
h = h.replace("1007 个小游戏", f"{len(GAMES)} 个小游戏")
h = h.replace("1007 games", f"{len(GAMES)} games")
(SITE / "index.html").write_text(h, encoding="utf-8")
print("✅ 首页游戏数已更新")
