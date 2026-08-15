"use client";

import { useState } from "react";

const requirements = [
  ["ELTU3012", "语言与大学核心", "高阶英语沟通", false],
  ["University GE Area A", "语言与大学核心", "文化与思想领域", false],
  ["GECC1132", "书院通识", "书院基础通识", true],
  ["ACCT2111", "商学院核心", "财务会计基础", true],
  ["DOTE2030", "专业核心", "商业统计与决策", false],
  ["MGNT2611", "商学院核心", "组织与管理", false],
  ["DOTE4020", "专业方向", "Decision Modeling and Analytics", false],
  ["DOTE4070 / 4260", "专业方向", "方向选修二选一", false],
] as const;

const courses = [
  ["DOTE2030", "Business Statistics", "直接满足专业核心", "3", "42"],
  ["DOTE4020", "Decision Modeling and Analytics", "直接满足专业方向", "3", "18"],
  ["DOTE4260", "Business Process Analytics", "满足方向选修", "3", "31"],
  ["MGNT2611", "Organization and Management", "直接满足商学院核心", "2", "56"],
  ["ELTU3012", "English for Business Communication", "满足大学语言要求", "3", "24"],
  ["UGEA2100", "Chinese Culture and Society", "满足 University GE Area A", "3", "12"],
] as const;

const blocks = [
  { day:0, code:"DOTE2030", time:"10:30–13:15", room:"FYB LT4", top:104, height:118 },
  { day:0, code:"ELTU3012", time:"14:30–17:15", room:"YIA 201", top:312, height:118 },
  { day:1, code:"DOTE4260", time:"10:30–13:15", room:"WMY 301", top:104, height:118 },
  { day:1, code:"MGNT2611", time:"14:30–16:15", room:"YIA 203", top:312, height:78 },
  { day:3, code:"UGEA2100", time:"09:30–12:15", room:"LSK LT3", top:52, height:118 },
  { day:3, code:"DOTE4020", time:"14:30–17:15", room:"ELB LT2", top:312, height:118 },
];

export function CoursePlanner() {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [plan, setPlan] = useState(0);
  const planNames = [["方案 A · 三天集中", "17 units · 3 天"], ["方案 B · 均衡节奏", "15 units · 4 天"], ["方案 C · 最高学分", "18 units · 4 天"]];

  return <main>
    <header className="topbar"><button className="brand brand-button" onClick={() => setStage(0)}>CoursePlan<span>.</span></button><div className="top-actions"><div className="term-picker"><select aria-label="学期"><option>2026–27 Term 1</option></select></div><div className="avatar">DEMO</div></div></header>
    <section className="hero profile-hero"><div><p className="eyebrow">DEMO PROFILE · SAMPLE DATA</p><h1>Business Administration</h1><p className="hero-copy">Data &amp; Decision concentration · Example College</p></div><div className="summary"><div><strong>22</strong><span>要求已完成</span></div><div><strong>11</strong><span>要求未完成</span></div><div><strong>18</strong><span>学分上限</span></div></div></section>
    <nav className="steps four-steps" aria-label="选课流程">
      {[[0,"培养计划","核对毕业要求"],[1,"完整课程池","资格与优先级"],[2,"课表方案","比较日历方案"]].map(([id,title,sub], index) => <span key={id} style={{display:"contents"}}><button className={`step ${stage === id ? "active" : stage > Number(id) ? "complete" : ""}`} onClick={() => setStage(id as 0|1|2)}><span>{stage > Number(id) ? "✓" : id}</span><div><strong>{title}</strong><small>{sub}</small></div></button>{index < 2 && <i />}</span>)}
    </nav>
    {stage === 0 && <section className="workspace"><div className="section-heading"><div><p className="eyebrow">STEP 00</p><h2>培养计划 <span>22 / 33</span></h2></div><p>Mock Profile · 仅用于产品演示</p></div><div className="toolbar"><div className="button-group segmented"><button className="pressed">全部</button><button>已完成</button><button>未完成</button></div><div className="module-picker"><select><option>全部模块</option></select></div></div><div className="table-shell"><table className="status-table"><thead><tr><th>课程／必要要求</th><th>模块</th><th>说明</th><th>状态</th></tr></thead><tbody>{requirements.map(([code,group,note,done]) => <tr key={code}><td className="requirement-name">{code}</td><td><span className="requirement">{group}</span></td><td className="description">{note}</td><td><span className={`completion ${done ? "done" : "todo"}`}><b>{done ? "✓" : "×"}</b>{done ? "已完成" : "未完成"}</span></td></tr>)}</tbody></table></div><footer className="workspace-footer"><p className="source-note">所有状态均为匿名 mock 数据</p><button className="primary" onClick={() => setStage(1)}>构建完整课程池 <span>→</span></button></footer></section>}
    {stage === 1 && <section className="workspace"><div className="section-heading"><div><p className="eyebrow">STEP 01</p><h2>本学期课程池 <span>128 门开课</span></h2></div><p>按毕业贡献、资格与余位排序</p></div><div className="toolbar"><div className="button-group segmented"><button className="pressed">全部可考虑</button><button>直接满足要求</button><button>专业课程</button><button>通识课程</button></div><label className="course-search"><input placeholder="搜索课程代码或名称" /></label></div><div className="pool-explanation"><span><b className="recommended-dot" />优先展示满足未完成毕业要求的课程</span><span><b className="uncertain-dot" />需要批准或资格不完整的课程收纳在底部</span><span><b className="blocked-dot" />先修不满足或无余位课程仍保留原因</span><span><strong>课程池</strong>只用于理解范围，无需逐门勾选</span></div><div className="table-shell"><table className="course-pool-table read-only-pool"><thead><tr><th>课程</th><th>满足要求／进入原因</th><th>学分</th><th>余位</th><th>资格状态</th></tr></thead><tbody>{courses.map(([code,title,reason,units,vacancy]) => <tr key={code}><td><span className="course-code">{code}</span><div className="course-title">{title}</div></td><td><span className="requirement">{reason}</span></td><td>{units} units</td><td>{vacancy}</td><td><span className="status recommended"><b />优先考虑</span></td></tr>)}</tbody></table></div><div className="deferred-courses"><details><summary><span><b className="uncertain-dot" />需要确认</span><strong>14 门</strong><small>Consent、学院批准、预留名额或资格资料不完整</small></summary></details><details><summary><span><b className="blocked-dot" />暂不可选</span><strong>27 门</strong><small>无余位、不满足先修条件或已经修读</small></summary></details></div><footer className="workspace-footer"><button className="excluded-button" onClick={() => setStage(0)}>← 返回培养计划</button><span className="selection-note">与自己的 Agent 交流偏好并生成方案</span><button className="primary" onClick={() => setStage(2)}>查看课表方案 <span>→</span></button></footer></section>}
    {stage === 2 && <section className="workspace compact-workspace"><div className="section-heading"><div><p className="eyebrow">STEP 02</p><h2>课表方案</h2></div><p>Mock Class Data · 最终以选课系统为准</p></div><div className="plan-tabs">{planNames.map(([name,meta],i) => <button className={plan === i ? "active" : ""} onClick={() => setPlan(i)} key={name}><strong>{name}</strong><span>{meta}</span></button>)}</div><div className="plan-overview"><div><strong>{plan === 2 ? 18 : plan === 1 ? 15 : 17}</strong><span>units</span></div><div><strong>{plan === 0 ? 3 : 4}</strong><span>上课日</span></div><p>{plan === 0 ? "把课程集中在周一、周二和周四，保留两个完整工作日。" : "在毕业进度、课程强度与完整空闲日之间取得平衡。"}</p></div><div className="calendar-shell"><div className="calendar-head"><span>时间</span>{["周一","周二","周三","周四","周五"].map((d,i)=><strong key={d}>{d}<small>{[2,4].includes(i) ? "整天空闲" : "有课"}</small></strong>)}</div><div className="calendar-body"><div className="time-axis">{[9,10,11,12,13,14,15,16,17,18].map(h=><span key={h} style={{top:`${(h-9)*52}px`}}>{String(h).padStart(2,"0")}:00</span>)}</div>{[0,1,2,3,4].map(day=><div className="calendar-day" key={day}>{blocks.filter(b=>b.day===day).map(b=><article key={b.code} style={{top:b.top,height:b.height}}><strong>{b.code}</strong><span>{b.time}</span><small>{b.room}</small></article>)}</div>)}</div></div><div className="plan-warnings"><p>示例课程、余位和班别均为 mock 数据，仅用于界面宣传。</p><p>真实方案会标明 TBA、Consent、预留名额与学院批准。</p></div></section>}
  </main>;
}
