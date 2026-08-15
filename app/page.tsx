import type { Metadata } from "next";
import { CoursePlanner } from "./course-planner";

export const metadata: Metadata = {
  title: "CoursePlan · 选课规划工作台",
  description: "由本地 Agent 驱动、可选前端渲染的课程规划工具。",
};

export default function Home() {
  return <CoursePlanner />;
}
