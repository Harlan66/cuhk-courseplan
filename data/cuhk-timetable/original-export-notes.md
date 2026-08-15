# CUHK 2026–27 Teaching Timetable MVP

导出范围：Undergraduate（UG）的 2026–27 Term 1 与 Term 2。

数据源：CUHK CUSIS「Teaching Timetable by Subject/Department」。导出时间：2026-08-13 23:41（Asia/Shanghai）。

## 完整性结果

| 学期 | 官方科目代码 | 查询成功 | 有排课科目 | 无排课科目 | 唯一 Class Nbr | 班别/组件 | Meeting 明细行 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026–27 Term 1 | 126 | 126 | 88 | 38 | 1,691 | 2,482 | 3,700 |
| 2026–27 Term 2 | 126 | 126 | 74 | 52 | 1,111 | 1,563 | 4,289 |

失败科目：0。缺失科目：0。没有开课记录的科目被保留在 JSON 元数据的 `subjectsWithoutClasses` 中，不会与抓取失败混淆。

## 文件说明

- `*-classes.csv`：适合筛课和导入 Excel/Numbers。每个 Class Nbr + Course Component + Section Code 一行；多个上课时间合并在 `Meetings`。
- `*-meetings.csv`：适合检查时间冲突。每一次 meeting/日期范围单独一行，保留官方源数据中的重复行。
- `*.json`：完整数据包，包含元数据、汇总班别和 meeting 明细，适合后续脚本、插件或数据库导入。

CSV 使用 UTF-8 BOM，直接用 Excel 打开不会出现中文乱码。

## 边界

这里的“全量”指在本次导出时点，官方 UG Teaching Timetable 对 126 个科目代码返回的全部 Term 1/2 记录。它不等于某位学生最终可选的全部课程：个人可选性仍可能受到专业、年级、先修课、预留名额、选课时段和 consent 等规则影响。Term 2 距离开课较远，学校后续仍可能新增或修改排课，因此这是一个可复现的 MVP 快照。
