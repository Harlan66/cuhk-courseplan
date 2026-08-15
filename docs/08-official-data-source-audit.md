# 港中文官方课程数据源核查

核查日期：2026-08-14

## 结论

没有发现一个同时满足“官方、公开、当前、全量、可批量导出”的港中文课程数据库，也没有发现学校公开文档化的 REST/JSON API。本项目统一以 CUSIS 为课程目录、实际开班和个人选课状态的唯一事实源，其他来源只做补充和交叉核验。

官方数据实际分散在五层：

1. CUSIS Course Catalog / Programme Information：课程定义与选课规则的主数据。
2. CUSIS / Registry Teaching Timetable：某学期实际开出的班别、时间、地点、名额。
3. AQS Undergraduate Student Handbook：培养方案、学则及入学年份版本。
4. Business School SharePoint：商学院选课通知、credit transfer、course equivalency 等内部资料。
5. 年度指南、院系网页和课程大纲 PDF：说明性或补充数据。

因此本项目不应假定存在“一张官方总表”，而应建立带来源和版本的本地组合数据库。

## 值得使用的额外官方入口

| 来源 | 可公开访问 | 可批量 | 主要用途 | 当前判断 |
|---|---:|---:|---|---|
| Registry Planned Course Offering | 是 | 是 | 按 subject 获取课程代码、名称、学分及计划在 Term 1/2 开设情况 | 2024-25 有数据；抽样的 2025-26、2026-27 均为空，不能承担当前学期来源 |
| Registry Public Teaching Timetable | 是，但每次搜索需验证码 | 否 | 当前开班、section、时间、教师、课室、名额等 | 权威，但不适合无人值守全量抓取 |
| AQS Undergraduate Student Handbook | 部分 | 部分 | 培养方案、毕业规则、入学年份版本 | 应作为培养要求主来源；课程详情仍指向 CUSIS |
| Business School Current Students SharePoint | 需登录 | 登录后再判断 | 商学院 course registration、credit transfer、course equivalency | 对“商务替代/等价课程”非常关键 |
| CLEAR Course Outline PDF | 文件存在时公开 | 否 | 课程介绍、学习目标、考核、阅读、教学计划 | 覆盖零散；抽查 DOTE 2026T1/T2 目标文件均不存在 |
| 各院系课程网页/PDF | 多数公开 | 不统一 | 补充课程目录、先修条件和开课信息 | 可交叉验证，不能合成一个可靠全校数据库 |

## 对当前项目的实际意义

### 能直接加入的

- 用公开 Planned Course Offering 建立历史课程池和 subject code 字典。
- 用现有 Term 1/2 timetable 数据建立实际开班层。
- 用 AQS/BBA 文件建立个人培养计划和毕业规则层。
- 用课程大纲/院系文件补齐课程介绍、考核方式和工作量。

### 仍需一次登录后采集的

- CUSIS Course Catalog 的 prerequisites、corequisites、exclusions、enrolment requirements。
- Business School SharePoint 的 course equivalency / credit transfer 资料。
- CUSIS 中与个人身份有关的 reserved quota、consent、年级/专业限制和最终 enrolment validation。

## 数据架构建议

每条课程或规则都保存以下审计字段：

- `sourceId`
- `sourceUrl` 或 `localFile`
- `academicYear`
- `admissionCohort`
- `retrievedAt`
- `authority`
- `verificationStatus`
- `supersedes`

规则冲突时按以下优先级处理；任何外部来源都不得静默覆盖 CUSIS：

1. 当前 CUSIS 中明确的个人 enrolment validation
2. CUSIS Course Catalog / Business School course equivalency
3. 对应入学年份的 AQS Study Scheme
4. 当前年度 Business School 指南
5. 院系课程页/课程大纲
6. 历史 Planned Course Offering

## MVP 决策

公开入口可以减少 CUSIS 的查询量，但无法取代一次登录后的批量采集。下一步最有价值的是：用户完成登录后，分别采集 CUSIS Course Catalog 和商学院 SharePoint course equivalency；公开 Registry 数据只负责交叉核验，不作为“你一定能选”的结论依据。
