import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the CoursePlan workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>CoursePlan · 选课规划工作台<\/title>/i);
  assert.match(html, /DEMO PROFILE · SAMPLE DATA/);
  assert.match(html, /完整课程池/);
  assert.match(html, /课表方案/);
  assert.doesNotMatch(html, /Ask Agent/);
  assert.doesNotMatch(html, /Integrated BBA|Business Analytics concentration|Chung Chi/);
});

test("public frontend contains no embedded agent or personal runtime data", async () => {
  const source = await readFile(new URL("../app/course-planner.tsx", import.meta.url), "utf8");

  assert.match(source, /Mock Profile/);
  assert.match(source, /完整课程池/);
  assert.doesNotMatch(source, /generated-course-pool|schedule-plans|data\/student/);
  assert.doesNotMatch(source, /type="checkbox"/);
  assert.doesNotMatch(source, /Integrated BBA|Business Analytics concentration|Chung Chi|HL</);
});
