# 前 10 门课程完整链路采集

本快照是重新从零建立的 2026–27 Term 1 小批次，用于验证完整采集链路，不继承上一批次的主表结果。

## 选取口径

- 开始时重新读取 CUHK 官方 Teaching Timetable subject 下拉框。
- 按官方 subject 顺序查询当前排课。
- 将 `Class Code` 归一化为“subject + 四位课程号”，section 后缀不作为新课程。
- 选取实时结果中的前 10 个不重复 Catalog Course Code。

## 数据层

- ACCT 主表原始查询记录及抓取尝试。
- 10 门课程下全部 26 个 Class Nbr 的详情，每项保存 HTML、文本和带采集时间的 JSON。
- 主表中实际出现链接的 6 个 Reserved Quota 页面，每项保存 HTML、文本和 JSON。
- 10 门课程的 Browse Course Catalog 页面，每项保存 HTML、文本和 JSON。

## 完整性标准

只有当 26 个 Class Nbr、6 个 Reserved Quota 和 10 个 Catalog 页面全部存在、非空且内容包含对应目标标识时，才允许封存本快照。该快照只证明这 10 门课程的采集链路完成，不代表 Term 1 全量课程已经完成。

## 验收结果

- Class Nbr：26/26 通过。
- Reserved Quota：6/6 通过；其余班别在主表中没有 Reserved Quota 链接。
- Course Catalog：10/10 通过。
- 每个目标均保存 HTML、可读文本和 JSON，内容标识与目标课程或班号一致。
- 结果：声明范围内完整，可以封存。
