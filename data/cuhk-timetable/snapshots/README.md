# CUSIS immutable snapshots

每个子目录代表一次不可覆盖的 CUSIS 抓取。原始逐 subject 数据、无损清洗结果、抓取时间、完整性状态和 SHA-256 必须一起保存。

规则见 `../../../docs/10-cusis-snapshot-runbook.md`。

禁止把新抓取直接写入已有快照目录。页面或数据库所需的“最新数据”应通过独立的 `latest.json` 指针选择，不得删除历史快照。
