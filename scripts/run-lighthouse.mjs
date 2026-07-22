import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const root = path.resolve("dist");
const budget = JSON.parse(
  await readFile(path.resolve("lighthouse-budget.json"), "utf8"),
);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const requested = path.resolve(root, `.${url.pathname}`);
    if (!requested.startsWith(root)) throw new Error("Unsafe path");
    const file = (await stat(requested).catch(() => undefined))?.isDirectory()
      ? path.join(requested, "index.html")
      : requested;
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type":
        contentTypes.get(path.extname(file)) ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Could not start the Lighthouse server.");

const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless", "--no-sandbox"],
});

const minimums = budget.minimums;
const categories = Object.keys(minimums);
const runs = [];

try {
  for (let index = 0; index < budget.runs; index += 1) {
    const result = await lighthouse(`http://127.0.0.1:${address.port}/`, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: categories,
      formFactor: "desktop",
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        disabled: false,
      },
    });
    if (!result) throw new Error("Lighthouse did not return a report.");
    runs.push(
      Object.fromEntries(
        categories.map((key) => [key, result.lhr.categories[key]?.score ?? 0]),
      ),
    );
  }
} finally {
  chrome.kill();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

console.table(runs);
const failures = Object.entries(minimums).flatMap(([category, minimum]) => {
  const score = Math.min(...runs.map((run) => run[category]));
  return score < minimum ? [`${category}: ${score} is below ${minimum}`] : [];
});
if (failures.length)
  throw new Error(`Lighthouse budgets failed: ${failures.join("; ")}`);
