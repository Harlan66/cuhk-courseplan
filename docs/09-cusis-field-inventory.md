# CUSIS 已提取字段盘点

核查日期：2026-08-14

## 数据口径

CUSIS 是课程目录、实际开班和选课状态的唯一事实源。AQS、商学院指南、SharePoint 和院系文件只允许用于：

- 补充 CUSIS 当前页面没有展示的培养方案说明；
- 提醒需要在 CUSIS 中继续验证的规则；
- 交叉核验和发现异常；
- 保留历史版本和来源证据。

若补充材料与 CUSIS 冲突，不得自动覆盖 CUSIS；应标记冲突并等待人工确认。

## 目前真正抓到的范围

当前导出覆盖的是 `Teaching Timetable by Subject/Department` 的结果表格，而不是整个 CUSIS Course Catalog。

结果表已捕获 19 个源字段：

| 层级 | 字段 |
|---|---|
| 学期 | Academic Term、Term Value |
| 查询 | Queried Subject |
| 课程/班别 | Class Code、Class Nbr、Course Title、Units、Course Offering Dept |
| 教学安排 | Teaching Staff、Course Component、Section Code、Language |
| 容量 | Quota(s)、Vacancy |
| 时间地点 | Period、Room、Meeting Date |
| 控制 | Add Consent、Drop Consent |

`classes` 数据另外包含一个派生字段 `Meetings`，由所有 `Period + Room + Meeting Date` 合并而成。`Course Code` 目前隐含在 `Class Code` 中，下一轮应单独结构化。

## 已导出数量

| 学期 | 查询 subject | 返回课程的 subject | 空结果 subject | 唯一 Class Nbr | component 行 | meeting 行 |
|---|---:|---:|---:|---:|---:|---:|
| 2026-27 Term 1 | 126 | 88 | 38 | 1,691 | 2,482 | 3,700 |
| 2026-27 Term 2 | 126 | 74 | 52 | 1,111 | 1,563 | 4,289 |

两个学期仍是 `unverified`。原因是此前流程可能把超时误记成空结果，因此“126 个 subject 都生成了文件”不等于“全校课程零遗漏”。

## CUSIS 中存在、但当前没有抓到的关键层

### Class Nbr 详情

官方使用说明明确表示，点击 `Class Nbr` 可查看 comprehensive class information，例如：

- enrolment rules；
- waitlist quota；
- 详情页上的其他班别信息。

### Quota(s) 详情

当前只保存表格显示的总体 quota/vacancy。存在 reserved quota 时，`Quota(s)` 会成为链接；点击后才能看到：

- reserved capacity partitions；
- 每个名额分区面向的专业、年级或学生组；
- 分区剩余名额（若页面提供）。

这直接影响“总体 vacancy > 0，但某个学生仍不能选”的情况。

### Browse Course Catalog

尚未从 CUSIS Course Catalog 批量提取：

- course description；
- prerequisites；
- corequisites；
- exclusions；
- course-level enrolment requirements；
- 页面提供的 course attributes/components。

### 个人级验证

即使以上数据全部获得，最终 eligibility 仍应保存 CUSIS shopping cart 的 validation 结果，因为部分规则只会结合学生身份、已修记录、专业、年级、reserved quota 和审批状态计算。

## 下一轮采集目标

1. 重跑 Term 1/2 的空结果 subject，并做重复查询确认。
2. 对每个唯一 `Class Nbr` 抓取详情页。
3. 对带 reserved quota 链接的班别抓取 quota partitions。
4. 批量遍历 Browse Course Catalog，建立课程主表和规则表。
5. 将个人 validation 作为最终可选状态，避免本地规则引擎冒充 CUSIS 结论。
