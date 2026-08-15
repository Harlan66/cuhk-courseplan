# Subject 查询异常注释（2026-08-15）

以下项目不得标记为“无课”或 `confirmed_empty`。重新在 CUSIS Teaching Timetable 查询时，页面返回：`You must select Subject or Course Offering Department to proceed.` 这表示提交的 subject 未被 CUSIS 表单接受，查询没有执行，不能推断该 term 没有课程。

| Subject | 结论 | 后续处理 |
| --- | --- | --- |
| ARTS | 查询未执行，不代表无课 | 通过 CUSIS Subject lookup 或 Course Offering Department 解析内部有效值后重查 |
| ELTU | 查询未执行，不代表无课 | 同上 |
| GPSU | 查询未执行，不代表无课 | 同上 |
| NURS | 查询未执行，不代表无课 | 同上 |
| SSMU | 查询未执行，不代表无课 | 同上 |

原始首次抓取文件保持不变：`raw/2420/<SUBJECT>.json`。页面复核记录位于 `metadata/blank-subject-recheck.json`。
