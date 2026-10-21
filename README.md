# tool-factory — 批量产出"真会算"的工具页与游戏页

一套把静态站点从 **509 工具 / 1007 游戏**扩到 **6007 工具 / 5304 游戏**（共 11,544 页）的
生成流水线。核心原则：**扩的是真实内容，不是复制粘贴**。

## 为什么不是"批量刷页"

搜索引擎会惩罚 *scaled content abuse*。所以这套流水线的每一步都在避免制造重复页：

| 做法 | 效果 |
|---|---|
| 抽出共享运行时（付费墙 / 多语 / 统计 / 广告位） | 每页只带自身逻辑（~7KB 而不是 24KB），且行为**完全一致**（运行时是程序化抽取的，不是手抄） |
| 真实公式引擎（119 个） | 每个工具真会算：复利 10000@5%×10y = 16,470.09；房贷 100万@4.9%×30年 = 5,307.27/月 |
| 费率类工具费率**作为用户输入** | 不内置会过期的数字（各省社保/各行利率）→ 没有假数据 |
| 主题**驱动内容**（游戏） | 题目数组按主题轮转 + 每主题一个确定性随机种子 → 不同主题生成的题目/序列真的不同 |
| 内容块由**该页自己的参数**生成 | 页面文本互不相同（跨类别 Jaccard 0.70，改造前旧站是 1.000） |
| 分类枢纽页 | 4744 个换算工具按 190+ 个单位类别分页，不挤在一个页面 |

## 目录

```
generators/    目录生成 + 页面构建 + 索引更新 + 批量增强 + 语法巡检
runtime/       共享运行时(bds-core.js) + 公式引擎(bds-engines.js) + Node 静态服务
arcade/        游戏引擎(arcade-build.js) + 内容池(arcade-topics.js)
verify/        全量验收：逐页跑真实计算 + MCP 客户端
```

## 用法

```bash
# 1) 生成工具目录（6007 条规格）
python generators/tool_catalog.py            # -> artifacts/tool_catalog.json

# 2) 构建工具页 + 分类枢纽 + 搜索索引 + sitemap
python generators/build_tools.py

# 3) 生成游戏页（主题驱动内容）
node  -e "process.env.ARCADE_THEMES=12; ..."   # 见 generators/build_arcade_pages.py
python generators/build_arcade_pages.py
python generators/update_arcade_index.py

# 4) 全量验收（逐页真实计算）
node verify/verify_all_tool_pages.mjs
```

## 踩过的坑（都会静默毁掉整批页面）

1. **f-string 里的 `{}`**：`window.__I||{}` 写进 f-string → Python 当成表达式 → 构建脚本语法错
2. **逗号拼接变量声明**：`var N1=…,var N2=…` → 整个脚本语法错 → 按钮点了没反应
3. **注入的 JS 少一个 `catch`** → 页面照常渲染、统计静默死亡（最难查）
4. **正则提取 JSON 字典** → 被嵌套 `}` 骗到 → 改用括号配对扫描
5. **同一行写多条内容** → 合并成大数组，条目结构全错
6. **slug 用 `hash()`** → Python 哈希跨进程随机化 → 同一工具每次 URL 都不同，内链全失效（改用 `zlib.crc32`）

## 验证口径

- 5267/5267 工具页通过：脚本可执行、`bdsGo` 已定义、输出非空、**无 undefined/NaN**
- 页面文本两两比对：同类别内确实不同（首个差异在第 0–17 字符）
- 页面体积：单页 ~7KB（共享运行时后），全站 11,544 页 ≈ 238MB

## License

MIT
