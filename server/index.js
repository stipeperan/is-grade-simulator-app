import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResult, buildStatistics, summarizeRules } from "./gradeEngine.js";

const app = express();
const port = Number(process.env.PORT) || 4174;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

app.use(express.json());

app.get("/api/rules", (_request, response) => {
  response.json(summarizeRules());
});

app.post("/api/statistics", (request, response) => {
  response.json(buildStatistics(request.body));
});

app.post("/api/actual-grade", (request, response) => {
  response.json(buildResult(request.body));
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(distDir));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`IS Grade Simulator API running on http://127.0.0.1:${port}`);
});
