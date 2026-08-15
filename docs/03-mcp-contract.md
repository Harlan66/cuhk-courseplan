# Agent / MCP 能力边界

网页、Codex 和 Claude Code 必须操作同一份领域状态。MCP 不操纵页面 DOM，而是调用稳定的领域接口；页面订阅状态变化并重新渲染。

## 读取工具

- `get_student_profile`
- `get_curriculum_plan`
- `get_course_history`
- `get_eligibility_snapshot`
- `list_candidate_courses`
- `explain_course_eligibility`
- `list_enrollment_options`
- `detect_schedule_conflicts`
- `compare_schedule_options`

## 修改工具

- `import_curriculum`
- `import_course_history`
- `compute_eligible_courses`
- `include_courses`
- `exclude_courses`
- `restore_courses`
- `generate_schedule_options`
- `save_schedule`
- `export_schedule`

## 修改操作返回值

所有修改工具统一返回：

```json
{
  "changed": [],
  "reason": "",
  "candidateCount": 0,
  "undoable": true,
  "stateVersion": 1
}
```

调用方必须携带期望的 `stateVersion`。版本不一致时拒绝覆盖并返回最新状态，避免网页和 Agent 同时修改造成数据丢失。

## 解释性原则

- 规则结论必须可以追溯到培养计划条款和课程数据。
- “无法确定”是有效结果，不能伪装成可选或不可选。
- Agent 生成排课方案时应返回评分明细和取舍理由，而非单一黑盒答案。
