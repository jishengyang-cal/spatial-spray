import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.PORT ?? process.env.SPATIAL_SPRAY_MAC_BUILDER_MOCK_PORT ?? 4391);
const token = process.env.SPATIAL_SPRAY_MAC_BUILDER_TOKEN;
const jobs = new Map();

const server = createServer(async (request, response) => {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (!authorized(request)) {
      sendJson(response, 401, { error: "Unauthorized." });
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        available: true,
        mode: "mock",
        capabilities: ["ios-build", "visionos-build", "ios-test", "visionos-test", "archive"]
      });
      return;
    }

    if (request.method === "POST" && request.url === "/jobs") {
      const body = await readJson(request);
      const job = createJob(body);
      jobs.set(job.id, { job, request: body });
      setTimeout(() => markRunning(job.id), 150);
      setTimeout(() => markFinished(job.id), 650);
      sendJson(response, 201, { job });
      return;
    }

    const match = /^\/jobs\/([^/]+)$/.exec(request.url ?? "");
    if (request.method === "GET" && match) {
      const record = jobs.get(match[1]);
      if (!record) {
        sendJson(response, 404, { error: "Job not found." });
        return;
      }
      sendJson(response, 200, { job: record.job });
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
});

server.listen(port, () => {
  console.log(`spatial-spray mock Mac Builder listening on http://127.0.0.1:${port}`);
});

function createJob(request) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    kind: request.kind,
    status: "queued",
    logs: [
      {
        sequence: 1,
        level: "info",
        message: `Accepted ${request.kind} for ${request.target?.scheme ?? "unknown scheme"}.`,
        createdAt: now
      }
    ],
    artifacts: [],
    createdAt: now,
    updatedAt: now
  };
}

function markRunning(id) {
  const record = jobs.get(id);
  if (!record || record.job.status !== "queued") return;
  record.job.status = "running";
  record.job.updatedAt = new Date().toISOString();
  record.job.logs.push({
    sequence: record.job.logs.length + 1,
    level: "info",
    message: "Mock builder generated XcodeGen project and started xcodebuild boundary check.",
    createdAt: record.job.updatedAt
  });
}

function markFinished(id) {
  const record = jobs.get(id);
  if (!record || record.job.status !== "running") return;
  const now = new Date().toISOString();
  const shouldFail = process.env.SPATIAL_SPRAY_MAC_BUILDER_MOCK_FAIL === "true";
  record.job.status = shouldFail ? "failed" : "succeeded";
  record.job.updatedAt = now;
  record.job.logs.push({
    sequence: record.job.logs.length + 1,
    level: shouldFail ? "error" : "info",
    message: shouldFail ? "Mock failure requested by SPATIAL_SPRAY_MAC_BUILDER_MOCK_FAIL." : "Mock native build completed.",
    createdAt: now
  });
  if (shouldFail) {
    record.job.failureReason = "mock-failure";
    return;
  }
  record.job.artifacts.push({
    id: randomUUID(),
    type: "log",
    name: `${record.job.kind}.log`,
    uri: `mock://mac-builder/jobs/${id}/logs/${record.job.kind}.log`,
    createdAt: now
  });
}

function authorized(request) {
  if (!token) return true;
  return request.headers.authorization === `Bearer ${token}`;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload, null, 2));
}

function setCors(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "authorization,content-type");
}
