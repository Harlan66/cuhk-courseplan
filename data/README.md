# 数据目录

该目录是 CoursePlan 的本地数据事实来源。网页、后续规则引擎和 MCP Server 均应从这里读取数据，不再把个人资料或课程要求硬编码进 UI。

## 目录

```text
data/
├── sources/
│   └── official-source-registry.json
├── schemas/
│   └── cusis-extracted-fields.json
├── enrichment/
│   └── course-outline-index/      # outline 来源核查与逐 URL 探测结果
├── student/
│   └── profile.json
├── curriculum/
│   ├── CUHK-Business-School-Guidelines-2026-27.pdf
│   ├── obsidian-status-source.md
│   ├── requirements.json
│   ├── eligibility-rules.json
│   ├── course-prerequisites.json
│   └── catalog-verification-queue.json
└── cuhk-timetable/
    ├── original-export-notes.md
    ├── curated/2026-08-15-term-1/ # 当前前端/分析优先读取的清洗数据
    ├── snapshots/                 # 当前 CUSIS 原始证据与补抓快照
    ├── 2026-27-term-1/
    │   ├── classes.csv
    │   ├── meetings.csv
    │   ├── full.json
    │   └── subjects/*.json
    └── 2026-27-term-2/
        ├── classes.csv
        ├── meetings.csv
        ├── full.json
        └── subjects/*.json
```

## 数据状态

| 数据 | 状态 | 可否作为正式判断依据 |
|---|---|---|
| 2024 Integrated BBA CUSIS 网页字符 | 已抓取并结构化 | 当前培养方案主来源；扫描 PDF 已归档 |
| Obsidian Status | 已复制并结构化 | 可作为当前个人完成状态依据 |
| `requirements.json` | 根据 Obsidian Status 建立 | 可以作为 MVP 个人状态输入 |
| `eligibility-rules.json` | 已同步培养方案互斥、替代、重复计分和版本规则 | 可以作为规则引擎输入 |
| `course-prerequisites.json` | BA 相关高级课程已按 2026-27 官方指南录入 | 已核验项可用；未知项必须人工确认 |
| `sources/official-source-registry.json` | 已核查校方公开、登录后及院系数据源 | 可作为采集策略与来源优先级依据 |
| `schemas/cusis-extracted-fields.json` | 已盘点当前 timetable 字段和 CUSIS 待抓取层 | 作为后续导出器字段契约 |
| `enrichment/course-outline-index/` | CUSIS/官方 outline/院系来源核查 | 作为评分、出勤和 syllabus 补充层 |
| 2026-08-15 Term 1 清洗结果 | 126 Subject、1560 Course、2999 Class、6797 Meeting | 当前主表事实层；Subject 采集缺口为 0 |
| 5 个需批准 Subject | `school_approval_required` | 按项目规则标记，不计作采集缺口 |
| 旧 Term 1/2 汇总 | 已移动到 `../archive/legacy-snapshots/` | 仅用于审计、历史回填和回滚 |

## 重要限制

CUSIS 是课程目录、实际开班和个人选课状态的唯一事实源。其他官方材料只做培养方案补充、交叉核验和历史版本证据；发生冲突时不得自动覆盖 CUSIS。

此前批量导出程序曾把一部分超时或空白结果误当成“无排课”。当前清洗结果已经通过历史回填和 CHLT/ENGG/GECC 公开课表补抓消除 Subject 主表缺口；5 个特殊 Subject 按已确认规则标记为需要学校批准。课程详情层（Class Nbr 详情、Catalog prerequisite、reserved quota）仍是部分覆盖，不能当作全量详情。

旧版逐班对账随快照保存在 `../archive/legacy-snapshots/2026-08-15T00-47-47+08-00/normalized/2026-27-term-1/term-1-diff.md`。当前对账确认第二次旧批次的 2504 个 Class Nbr 和 5850 条唯一 Meeting 均被最终数据完整保留。

每次重新抓取必须创建新的 `cuhk-timetable/snapshots/<timestamp>/`，原始字段和旧 vacancy 快照不得覆盖。具体执行和校验流程见 `../docs/10-cusis-snapshot-runbook.md`。

## 工具与归档

- `../tools/cusis-export-runner.mjs`：带断点的批量导出脚本。
- `../tools/seal-cusis-snapshot.mjs`：生成快照文件清单和 SHA-256，并封存快照。
- `../tools/cusis-exporter/`：浏览器导出器原型。
- `../archive/`：原始 ZIP 数据包和导出器 ZIP，作为历史快照保留。
