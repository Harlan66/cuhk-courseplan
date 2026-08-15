# 数据模型

## 核心实体

### StudentProfile

学生身份、学院、专业、入学年份、年级、Major/Minor/Concentration，以及可选的个人偏好。

### CurriculumPlan

适用的培养方案版本及其 Requirement。Requirement 可以包含指定课程、课程集合、学分数量、层级限制、替代关系和重复计算规则。

### CourseHistory

课程代码、学期、状态、学分、成绩及来源。状态至少区分 completed、in_progress、failed、withdrawn、transferred 和 exempted。

### Course

课程代码、名称、简介、学分、开课单位和课程层级。Course 本身不直接代表一个可选时间方案。

### EnrollmentOption

一组可以同时注册的班别组合，例如 LEC A + TUT T02 + LAB L03。资格判断和排课以此为最小选择单位。

### Meeting

星期、开始时间、结束时间、地点及生效日期范围。冲突检测必须同时考虑每周时间与日期范围。

### EligibilityDecision

针对学生与课程/组合的判断结果，包含 status、reasons、uncertainties、satisfiedRequirements 和计算版本。

### CandidateSet

- eligibleCourses：规则计算出的全集。
- includedCourses：当前进入下一阶段的集合。
- excludedCourses：被用户或 Agent 暂时排除的集合。

每次变更记录 actor、reason、timestamp、previousVersion 和 currentVersion，以支持撤销和 MCP 并发控制。

### SchedulePlan

一组 Enrollment Option、学分统计、冲突结果、优化指标和生成理由。不同方案之间可比较，不覆盖彼此。
