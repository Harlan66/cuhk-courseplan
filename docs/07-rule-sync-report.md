# 培养方案与选课资格规则同步报告

同步日期：2026-08-14

## 已完成

- 将 2024-25 入学适用的 Business Analytics 专修要求按版本结构化。
- `ACCT2151 / ACCT3151` 已从普通“二选一”修正为“满足同一要求且互斥不可共修”；保留会计职业方向建议选择 `ACCT3151`。
- 录入 Business Analytics 的三门指定课、三选一和六选一课程池。
- 录入自由选修不能替代 Business Analytics 指定要求。
- 录入双专修默认不得重复计分，以及 `DOTE2021`、`MGNT3010` 的特定例外。
- 录入 General Business 专修课程不能再次计入其他专修。
- 录入 `DSME` → `DOTE` 的同数字课程代码映射。
- 隔离培养方案版本：2026-27 新指南中的 `DOTE3010` 不会自动进入 2024-25 入学学生的 BA 课程池。
- 从 2026-27 官方商学院指南录入当前 BA 相关高级课程 prerequisite。
- 录入 CUSIS 对 prerequisite 的识别规则：只有中大修读课程或正式获批的课程豁免会被系统自动认可。

## 已核验 prerequisite

| 课程 | 要求 |
|---|---|
| DOTE2040 | 无 |
| DOTE4020 | 无 |
| DOTE4070 | 无 |
| DOTE4240 | 无 |
| DOTE4260 | 无 |
| DOTE4280 | 无 |
| DOTE3030 | DOTE2011 且 DOTE2021 |
| DOTE4110 | DOTE1030 |
| DOTE4220 | DOTE2011 + DOTE2021，或 DOTE2011 + DOTE2040，或任课教师批准 |
| MKTG4120 | MKTG2010 且 MKTG3010 |

## 需要 CUSIS 目录复核

`DOTE2021`、`DOTE2030`、`MGNT2512`、`MGNT2611`、`MGNT4010`、`ELTU3012` 和已不在 2026-27 公开选修表中的 `DOTE4030`。

`ACCT2151`、`ACCT3151` 已从保存的官方 Course Catalog 详情核验：两者互斥；`ACCT3151` 另外排除已修读 `LAWS1041` 或 `LAWS1042` 的学生。

这些课程不会被系统错误地当成“无先修”；在完成目录复核前统一返回 `needs_manual_confirmation`。详细队列见 `data/curriculum/catalog-verification-queue.json`。

## 数据源适用顺序

1. CUSIS 实时班别限制及院系批准。
2. CUSIS 2024 Integrated BBA 培养方案网页字符：2024-25 入学学生毕业计分与专修要求。
3. `CUHK-Business-School-Guidelines-2026-27.pdf`：2026-27 当前课程 prerequisite 和暂定选修供应。

不能用较新的培养方案覆盖学生入学年份适用的毕业要求。
