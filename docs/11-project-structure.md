# 项目目录与整理约定

## 核心结构

```text
选课/
├── app/                         # 简单前端：页面、布局、样式、选课交互
├── public/                      # 前端静态资源
├── data/                        # 当前可消费的数据事实层
│   ├── cuhk-timetable/
│   │   ├── curated/             # 前端/分析优先读取的清洗数据
│   │   └── snapshots/           # 当前抓取证据与补抓快照
│   ├── curriculum/              # 培养方案与规则
│   ├── student/                 # 个人状态
│   ├── schemas/                 # 字段契约
│   └── manifest.json            # 数据资产索引
├── tools/                       # 抓取、清洗、校验工具
├── db/                          # 数据库访问与 schema
├── worker/                      # 服务端/Cloudflare Worker
├── docs/                        # 产品、数据模型与运行说明
├── archive/
│   └── legacy-snapshots/        # 旧快照，仅审计/回滚，不给前端直接读取
├── outputs/                     # Excel 等人工交付物
└── tmp/                         # 可删除的临时分析和预览
```

## 数据读取优先级

1. 前端读取 `data/cuhk-timetable/curated/2026-08-15-term-1/`。
2. 需要核查来源时，按 `source_snapshot_id` 回到 `data/cuhk-timetable/snapshots/`。
3. `historical_fallback` 的来源位于 `archive/legacy-snapshots/`。
4. 前端不得直接读取 `archive/`、`tmp/`、`outputs/`。

## 后续整理原则

- `data/` 只放当前事实、规则和可追溯索引。
- `archive/` 只放退出当前链路但不能删除的历史证据。
- `tools/` 只放可重复执行的抓取、清洗、验证程序。
- `app/` 保持轻量，只负责搜索、筛选、课程详情和简单课表展示。
- `.next/`、`dist/`、`build/`、`.wrangler/` 是生成物，不作为项目结构说明的一部分。
