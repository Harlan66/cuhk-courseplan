# CUSIS 全量快照抓取 Runbook

更新日期：2026-08-14

## 核心原则

1. CUSIS 是课程目录、开班、容量、控制条件和个人选课状态的唯一事实源。
2. 每次抓取创建新的时间戳快照，禁止覆盖、修改或删除旧快照。
3. 所有 CUSIS 原始字段完整保留。清洗层只能增加字段、标准化格式或建立关联，不能丢弃源字段。
4. `Quota(s)`、`Vacancy` 是时点数据，必须和 `capturedAt` 一起保存，不能用新值覆盖旧值。
5. 页面默认读取已验证的最新快照；历史快照用于追踪 vacancy、排课和控制条件变化。
6. 登录凭证、Cookie、OnePass 和 2FA 不写入任何数据文件。

## 三层目录

```text
data/cuhk-timetable/
├── snapshots/
│   └── <Asia-Shanghai timestamp>/
│       ├── raw/
│       │   ├── 2420/<SUBJECT>.json
│       │   └── 2430/<SUBJECT>.json
│       ├── normalized/
│       │   ├── 2026-27-term-1/
│       │   │   ├── full.json
│       │   │   ├── classes.csv
│       │   │   └── meetings.csv
│       │   └── 2026-27-term-2/
│       └── snapshot.json
├── latest.json
└── current/                   # 可选的应用读取缓存，可重建
```

- `raw/`：逐 subject 的原始响应记录，封存后只读。
- `normalized/`：对 raw 做无损清洗；保留全部源字段并增加派生字段。
- 应用数据库/缓存：可随时从 snapshot 重建，不视为原始数据。

首个 `2026-08-13T23-41-20+08-00` 快照由旧目录导入，因此原始逐 subject 文件保留旧版 `raw/<term-name>/subjects/` 布局；它是不可覆盖的 legacy baseline。此后的新抓取统一使用上面的 `raw/<termValue>/` 布局。

## 快照命名

采用上海时区且文件名安全的格式：

```text
YYYY-MM-DDTHH-mm-ss+08-00
```

例如：`2026-08-14T23-30-00+08-00`。

同一分钟或同一天可以抓取多次；不得复用已有目录。每个快照还要在 `snapshot.json` 中保存 ISO 8601 时间。

## 抓取前

1. 确认当前时间和抓取目的，例如“选课结束后 vacancy 更新”。
2. 创建新的 snapshot 目录，不指向旧目录。
3. 用户在浏览器中完成 MyCUHK/CUSIS 登录。
4. 进入 `Manage Classes > Teaching Timetable by Subject/Department`。
5. 保持同一个 CUSIS 标签页，不同时使用另一个标签操作 CUSIS。
6. 从官方 timetable 页面重新读取 subject 列表；若回退到内置列表，必须在元数据标记。

## Timetable 主表抓取

使用 `tools/cusis-export-runner.mjs`，Term 只抓：

- `2420`：2026-27 Term 1
- `2430`：2026-27 Term 2

运行参数必须指向本次新快照：

```js
const snapshotRoot = "data/cuhk-timetable/snapshots/<timestamp>";

const exporter = await createExporter(tab, {
  subjects: await fetchSubjects(),
  rawRoot: `${snapshotRoot}/raw`,
  outputRoot: `${snapshotRoot}/normalized`
});
```

依次对 `2420`、`2430` 执行小批次查询。当前建议每批 4 个 subject；每批后检查 CUSIS session 是否仍有效。不要把登录页、空白页或超时当成真实空结果。

每个 subject 的原始文件至少保存：

- `termValue`
- `subject`
- `ok`
- `records`
- 失败时的 `error`
- 后续版本增加 `startedAt`、`completedAt`、`attempt`、`emptyEvidence`

## 详情层抓取

主表完成后，按唯一 `Class Nbr` 去重并抓取详情：

1. Class Nbr 详情：enrolment rules、waitlist quota 和详情页全部可见字段。
2. Quota(s) 详情：仅对存在链接的班别抓 reserved quota partitions。
3. Browse Course Catalog：课程介绍、prerequisite、corequisite、exclusion、course-level enrolment requirements 及页面全部可见字段。

详情页抓取也必须保存原始字段/文本以及 `Class Nbr`、course code、term、URL/页面标识和抓取时间，不能只保存解析后的规则。

## 空结果复核

空结果必须有明确证据，不能仅因结果区没有出现就判空：

1. 首次空结果记录为 `needs_retry`。
2. 在新的页面状态下重复查询至少一次。
3. 只有 CUSIS 显示明确的 no classes/no results 提示，或两次独立查询均稳定为空，才标记 `confirmed_empty`。
4. 登录页、session timeout、JS dialog 异常、DOM 超时统一标记 `failed`。
5. 任何 failed/missing/needs_retry 都禁止发布为最新完整快照。

## 无损清洗规则

清洗层保留全部 19 个 timetable 源字段，并允许增加：

- `snapshotId`
- `capturedAt`
- `rawSubjectPath`
- `rawRowIndex`
- `courseCode`
- `catalogNumber`
- `classStatus`
- 标准化后的 weekday/startTime/endTime
- 标准化建筑、课室和地理坐标
- `quotaNumber`、`vacancyNumber`
- `vacancyRatio`
- 时间冲突和通勤派生指标

原始字符串仍须保留。例如解析 `Period` 后仍保留原始 `Period`；解析 `Room` 后仍保留原始 `Room`。

## Vacancy 历史

每次快照为每个班别追加一条容量观察，不更新旧记录。建议唯一键：

```text
snapshotId + termValue + classNbr + courseComponent + sectionCode
```

至少保存：

- `capturedAt`
- `Quota(s)` 原始值
- `Vacancy` 原始值
- 数值化 quota/vacancy
- reserved quota partitions（抓到后）

Vacancy 趋势可以帮助评估竞争程度，但不能直接等同于选课成功概率；reserved quota、waitlist、开放时间和个人 eligibility 同样会影响结果。

## 发布前校验

1. 两个 term 的官方 subject 数量和 subject code 列表已保存。
2. `failedSubjects`、`missingSubjects`、`needs_retry` 均为 0。
3. 所有空结果已二次确认。
4. 关键字段仍存在，新增 CUSIS 列不会被解析器静默丢弃。
5. Class Nbr、component、meeting 的计数与上一快照比较；异常下降必须人工检查。
6. 生成所有文件的 SHA-256。
7. 写入 `snapshot.json` 并设为 sealed。
8. 只有 sealed 且验证通过的快照才能更新 `latest.json`。

## 本轮刷新建议

选课期的 vacancy 会快速变化。建议至少形成三个时点：

1. 已有基线：2026-08-13 23:41 Asia/Shanghai。
2. 今晚选课阶段结束或系统完成一轮处理后。
3. 明早学校系统完成更新后。

如果今晚和明早只能选一次，优先明早；如果希望分析容量变化，两个时点都保留。
