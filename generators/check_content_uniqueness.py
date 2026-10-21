#!/usr/bin/env python3
"""
验证新生成页面的**内容差异化**（防"规模化内容"被搜索惩罚）。

做法:
  1) 抽掉 script/style/导航/广告等公共部分，只留**正文可见文本**
  2) 分词成集合，算两两 Jaccard
  3) 分别看: 同类别内部（最坏情况）与跨类别（随机）
"""
from __future__ import annotations

import json
import random
import re
from collections import defaultdict
from pathlib import Path

SITE = Path(r"C:\bingdashan\site")
CATALOG = Path(r"F:\2026\新建文件夹\artifacts\tool_catalog.json")


def visible_text(html: str) -> str:
    h = re.sub(r"<script.*?</script>", " ", html, flags=re.S)
    h = re.sub(r"<style.*?</style>", " ", h, flags=re.S)
    h = re.sub(r"<[^>]+>", " ", h)
    h = re.sub(r"\s+", " ", h)
    return h.strip()


def tokens(text: str) -> set[str]:
    """中文按 2-gram + 英文按词。"""
    cn = re.findall(r"[一-鿿]+", text)
    grams = set()
    for run in cn:
        for i in range(len(run) - 1):
            grams.add(run[i:i + 2])
    words = set(w.lower() for w in re.findall(r"[A-Za-z0-9]{2,}", text))
    return grams | words


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def main() -> None:
    tools = json.loads(CATALOG.read_text(encoding="utf-8"))
    random.seed(42)
    sample = random.sample(tools, 420)

    by_cat = defaultdict(list)
    texts = {}
    for t in sample:
        p = SITE / t["slug"] / "index.html"
        if not p.exists():
            continue
        txt = visible_text(p.read_text(encoding="utf-8", errors="replace"))
        texts[t["slug"]] = txt
        key = t["cat"]["zh"] if t["cat"]["zh"] != "单位换算" else t["slug"].split("_")[1]
        by_cat[key].append(t["slug"])

    print(f"抽样 {len(texts)} 页")

    # 同类别内两两比较（最坏情况：同一单位类别里的兄弟页）
    worst = []
    for cat, slugs in by_cat.items():
        if len(slugs) < 2:
            continue
        for _ in range(min(12, len(slugs) * 2)):
            a, b = random.sample(slugs, 2)
            j = jaccard(tokens(texts[a]), tokens(texts[b]))
            worst.append((j, cat, a, b))
    worst.sort(reverse=True)
    if worst:
        js = [w[0] for w in worst]
        print(f"同类别内 Jaccard: 平均 {sum(js)/len(js):.3f}  最高 {js[0]:.3f}  最低 {js[-1]:.3f}")
        print("  最高的几对:")
        for j, cat, a, b in worst[:5]:
            print(f"    {j:.3f} [{cat}] {a}  vs  {b}")

    # 跨类别
    cross = []
    slugs = list(texts)
    for _ in range(400):
        a, b = random.sample(slugs, 2)
        cross.append(jaccard(tokens(texts[a]), tokens(texts[b])))
    cross.sort(reverse=True)
    print(f"跨类别 Jaccard: 平均 {sum(cross)/len(cross):.3f}  最高 {cross[0]:.3f}  中位 {cross[len(cross)//2]:.3f}")

    # 与旧页面对比（旧的 508 页曾 Jaccard=1.0）
    old = SITE / "l_cash" / "index.html"
    if old.exists():
        ot = tokens(visible_text(old.read_text(encoding="utf-8", errors="replace")))
        vs = [jaccard(ot, tokens(texts[s])) for s in list(texts)[:60]]
        print(f"与旧工具页(l_cash)的 Jaccard: 平均 {sum(vs)/len(vs):.3f}  最高 {max(vs):.3f}")


if __name__ == "__main__":
    main()
