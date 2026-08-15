# 课程评分与出勤信息源核查

核查日期：2026-08-14

## 结论

CUSIS 不只是选课和时间表。港中文官方的 CUSIS Course Outline Template 以及 2025 年学生可见页面样例表明，Browse Course Catalog 可以提供：

- Course Detail、Description、Grade Descriptor；
- Learning Outcomes、Course Syllabus；
- Assessment Type 及 Current Percent；
- Feedback for Evaluation；
- Required/Recommended Readings；
- Offerings、Components、Enrolment Requirements；
- Additional Course Attribute Information。

因此，“考试/论文/展示/出勤分别占多少百分比”首先应该从 CUSIS Course Catalog 获取，而不是依赖外部 outline。

但以下内容通常属于某位教师在某个学期的具体执行规则，CUSIS 不保证完整：

- 缺席一次扣多少分；
- 迟到多少分钟按缺席处理；
- lecture/tutorial 是否分别点名；
- participation 如何计分；
- 作业数量、字数、截止日期和 late penalty；
- midterm/final 的题型与范围；
- 当前教师对 AI 工具的具体政策；
- 开课后的临时调整。

这些应从“当前学期 + 当前 section/教师”的正式 course outline 或 Blackboard 获取。

## 官方 CLEAR 仓库实测

测试范围：本地 CUSIS 2026-27 Term 1/2 课表中出现的所有 ACCT、DOTE、FINA、FTEC、HTMG、IBBA、MGNT、MKTG 课程，并按实际开课学期拼接标准 CLEAR URL。

| 指标 | 结果 |
|---|---:|
| 课程 × 开课学期 URL | 244 |
| PDF 命中 | 0 |
| HTTP 404 | 244 |

原始逐 URL 结果保存在 `data/enrichment/course-outline-index/clear-2026-business-probe.json`。

这证明 CLEAR 仓库虽然存在大量正式 course outline，但当前不能作为商学院课程的统一数据库。

## 其他官方来源

### 学系课程页

覆盖高度不一致：

- 文化及宗教、语言学、英文、社会学、历史等部分学系公开当期 outline，通常包含评分比例与出勤规则；
- 有些页面只提供课程介绍；
- 商学院公开网页主要提供课程清单与培养方案，本轮没有发现统一的当期本科 assessment outline 索引。

需要为各学系编写独立 adapter，不能假设统一 URL 或统一格式。

### OAL / Summer Programme

部分交换和暑期课程会公开完整 syllabus，包括 assessment、attendance、schedule 和 prerequisite。但这些文件通常属于特殊学期或历史 offering，除非 term、section 和 instructor 完全匹配，否则只能作为历史参考。

### Blackboard

这是当前教师最终执行版 outline 最可能出现的位置，特别适合补齐点名、迟到、rubric、作业日期和临时变更。它受登录和选课权限控制，不是全校公开数据库。

### 官方 CTE 课程评价

CUHK 对标准课程进行 Course and Teaching Evaluation，但官方政策说明结果主要提供给教师和院系管理者，并要求防止公众访问能够识别个别教师的 CTE 结果。它不能作为公开的“课程评分网站”批量导入。

## 数据模型

### Course-level（CUSIS）

- courseCode
- effectiveDate
- description
- gradingBasis
- gradeDescriptor
- learningOutcomes
- syllabus
- assessmentItems `{type, currentPercent}`
- readings
- enrolmentRequirements
- sourceSnapshotId

### Offering-level（当期 Outline/Blackboard）

- termValue
- classNbr / sectionCode
- instructor
- outlineStatus: provisional/final
- assessmentItems `{name, weight, format, dueDate}`
- attendance `{required, weight, minimumRate, absencePenalty, latenessRule}`
- participationPolicy
- examPolicy
- lateSubmissionPolicy
- aiPolicy
- weeklySchedule
- sourceUrl/sourceFile/capturedAt

## 实施顺序

1. 批量遍历 CUSIS Browse Course Catalog，先获得全校统一的 assessment percentage 基线。
2. 按 CUSIS `Course Offering Dept` 建立院系 adapter，只抓取当前 term 的正式 outline。
3. 对你进入候选池的课程优先补齐 offering-level 字段，不必一开始解析全校所有 PDF。
4. 历史、暑期或教师不匹配的 outline 单独保存，禁止自动套用到当前课程。
5. 对仍缺 attendance 细则的候选课程显示“CUSIS 未说明”，不能推断为“不点名”。
