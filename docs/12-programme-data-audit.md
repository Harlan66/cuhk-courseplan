# 培养方案数据审计与语义层

## 范围

数据集含 101 个“学院筛选入口 × 培养方案”记录，而不是 101 个互不相同的专业名称。相同跨学院方案保留各入口记录，方便追溯；应用层应按 `academic_program` 或来源哈希辨别重复展示。

## 数据层次

1. `data/cuhk/2024/programmes/*.txt`：官方 CUSIS 页面可见文字，是审计原文。
2. `data/cuhk/2024/json/programmes-2024.json`：第一版分段和课程号提取。
3. `data/cuhk/2024/clean/programmes-audited.json`：证据关联的规则提示、来源哈希和来源状态。
4. `data/cuhk/2024/clean/course-mentions-audited.csv`：每次课程号提及及其验证状态。
5. `data/cuhk/2024/clean/review-queue.json`：真正阻断整理的数据异常；当前已清空。
6. `data/cuhk/2024/clean/audit-report.json`：可供前端或流水线读取的质量指标。
7. `data/cuhk/2024/clean/complex-rules.json`：脚注、课程级别、排除、审批和计分限制的证据关联语义层。

## 可信度原则

- 网页文字为 DOM 直接提取，不是 OCR。
- `prefix_inferred=false` 表示页面直接印出完整课程号。
- `prefix_inferred=true` 表示页面只印出数字部分，前缀由同一行最近的完整课程号继承。
- `matched_current_course_index` 只说明课程号出现在当前 2026–27 课程主表；未匹配不等于 2024 培养方案错误。
- `operator_hint` 是保守语义提示。`choose`、`any_of`、`all_of` 均保留原文证据；涉及脚注、级别课程池、不得重复计算等情况写入 `complex-rules.json`，运行规则判断时必须读取证据。
- 方括号旧课号（如 `ANTH3820[2820]`）写入 `course_code_aliases`，不再误作额外培养方案课程。
- 课程级别表达（如 “courses at 3000 or above level”）写入复杂规则约束，不再伪造为 `MATH3000` 等课程号。

## 来源复用

跨学院重复入口若详情页不能正常渲染，可以复用同名方案另一入口的字节一致内容，但必须在 `reused-duplicate-programme-details.json` 中登记 `reusedFrom`，不得伪装成独立抓取。

## 重新生成

```bash
python3 scripts/structure_cuhk_programmes.py
python3 scripts/audit_cuhk_programmes.py
python3 -m unittest tests/test_audit_cuhk_programmes.py
```
