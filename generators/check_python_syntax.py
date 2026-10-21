#!/usr/bin/env python3
"""ops 目录全量语法检查（改动后必须 0 错）。"""
import ast
import sys
from pathlib import Path

ROOT = Path(r"F:\2026\新建文件夹")
bad = []
n = 0
for p in sorted(list((ROOT / "ops").glob("*.py")) + list(ROOT.rglob("*.py"))):
    if "node_modules" in str(p):
        continue
    n += 1
    try:
        ast.parse(p.read_text(encoding="utf-8"))
    except Exception as e:
        bad.append((str(p.relative_to(ROOT)), f"{type(e).__name__}: {str(e)[:100]}"))
print(f"检查 {n} 个 Python 文件")
if bad:
    for f, e in bad:
        print("  ❌", f, "|", e)
    sys.exit(1)
print("  ✅ 全部语法通过")
