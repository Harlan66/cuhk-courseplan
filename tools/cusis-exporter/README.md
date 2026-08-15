# CUHK Timetable Exporter

把登录后的 CUHK CUSIS 本科 Teaching Timetable 按全部 Subject 自动查询，并一次导出为 CSV 和 JSON。

## 为什么采用浏览器扩展

CUSIS 的课表组件是有状态的 PeopleSoft 表单：

- 没有公开 CSV/JSON API；
- 空条件搜索会被服务器拒绝；
- 每个 Subject 的全部结果会一次返回，没有分页；
- 请求依赖当前登录会话与 PeopleSoft 的 `ICSID / ICStateNum` 状态。

因此扩展直接使用你已经登录的浏览器页面最稳妥。它不会读取、保存或导出密码、Cookie、OnePass 或 2FA 信息。

## 安装

1. 在 Chrome 地址栏打开 `chrome://extensions`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择整个 `cuhk-timetable-exporter` 文件夹。
5. 登录 MyCUHK，进入 CUSIS 的 `Manage Classes` 页面。

页面右下角会出现 **CUHK Timetable Exporter** 面板。

## 使用

1. 确认 CUSIS 的登录状态仍有效。
2. 点击“一键导出全部课程”。
3. 保持该标签页打开，不要同时在其他标签页操作 CUSIS。
4. 完成后浏览器会下载：
   - `cuhk-timetable-<term>.csv`
   - `cuhk-timetable-<term>.json`

扩展从港中文公开课表首页读取当前 Subject 清单；如果读取失败，会使用内置清单。每个查询之间保留 500ms 间隔，避免对 CUSIS 造成突发请求。

## 数据模型

CSV 每行代表一次 class meeting。同一 Class 如果分成多个日期段或地点，会出现多行，并重复 Class Code、Class Nbr、课程名称等基本信息。

字段包括：

- Academic Term
- Queried Subject
- Class Code
- Class Nbr
- Course Title
- Units
- Teaching Staff
- Quota(s)
- Vacancy
- Course Component
- Section Code
- Language
- Period
- Room
- Meeting Date
- Add Consent
- Drop Consent
- Course Offering Dept

JSON 另外包含导出时间、行数、失败 Subject 列表及是否提前停止。

## 限制

- 这是课表快照，不等于你本人一定有资格选读全部课程。
- 先修要求、专业/年级保留名额和个人限制仍须通过 Shopping Cart 的 `Validate` 检查。
- CUSIS 页面字段或 ID 若被学校更新，扩展可能需要同步调整。
- 运行中如果登录超时，可重新登录后再次导出；JSON 会列出失败的 Subject。

