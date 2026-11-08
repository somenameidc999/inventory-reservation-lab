import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { run } from "node:test";

function finish(status, fields, exitCode) {
  console.log(JSON.stringify({ status, ...fields }, null, 2));
  process.exitCode = exitCode;
}

function changesOnlyReservations(output) {
  const records = output.split("\0");
  if (records.pop() !== "" || records.length === 0) return false;

  return records.every((record) => {
    const [added, removed, path, extra] = record.split("\t");
    return path === "src/reservations.ts" && extra === undefined && /^\d+$/.test(added) && /^\d+$/.test(removed);
  });
}

function applyAndRun() {
  const patch = readFileSync(0);
  const inspect = spawnSync("git", ["apply", "--numstat", "--summary", "-z", "-"], {
    input: patch, encoding: "utf8",
  });
  if (inspect.error) throw inspect.error;
  if (inspect.stderr) process.stderr.write(inspect.stderr);
  if (inspect.status !== 0 || !changesOnlyReservations(inspect.stdout)) {
    finish("invalid_patch", { reason: "Submit a text patch that modifies only src/reservations.ts." }, 2);
    return;
  }

  const apply = spawnSync("git", ["apply", "-"], { input: patch, stdio: ["pipe", "ignore", "inherit"] });
  if (apply.error) throw apply.error;
  if (apply.status !== 0) {
    finish("invalid_patch", { reason: "The patch does not apply to the current checkout." }, 2);
    return;
  }

  const result = spawnSync("sh", ["scripts/with-local-postgres.sh", process.execPath,
    "evaluation/grade-patch.mjs", "--run-tests"], { stdio: ["ignore", "inherit", "inherit"] });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 2;
}

async function gradeTests() {
  const criteria = new Map([
    ["RES-01", { id: "RES-01", score: null, evidence: null }],
    ["RES-02", { id: "RES-02", score: null, evidence: null }],
  ]);
  const prefix = "fieldstock-grade ";
  let summary;
  process.env.FIELDSTOCK_GRADE = "1";

  for await (const { type, data } of run({ files: ["test/reservations.test.ts"], timeout: 60_000 })) {
    if (type === "test:diagnostic" && data.message.startsWith(prefix)) {
      const observation = JSON.parse(data.message.slice(prefix.length));
      if (criteria.has(observation.id)) criteria.set(observation.id, observation);
    } else if (type === "test:fail") {
      const failure = data.details.error?.cause ?? data.details.error;
      console.error(data.name, failure?.message ?? failure);
    } else if (type === "test:summary" && !data.file) {
      summary = data;
    }
  }

  const results = [...criteria.values()];
  const graded = results.every(({ score }) => score !== null);
  const suitePassed = summary?.success && summary.counts.passed === summary.counts.tests;
  const fields = {
    score: graded ? results.reduce((total, { score }) => total + score, 0) : null,
    maxScore: 4,
    criteria: results,
    tests: summary?.counts ?? null,
  };
  if (results.some(({ score }) => score === 0)) {
    finish("rejected", fields, 1);
  } else if (results.every(({ score }) => score === 2) && suitePassed) {
    finish("accepted", fields, 0);
  } else {
    const status = graded && results.some(({ score }) => score === 1) ? "needs_evidence" : "unverified";
    const reason = graded && status === "unverified"
      ? "The full integration suite did not pass."
      : "One or more reservation checks lack full evidence.";
    finish(status, { ...fields, reason }, 2);
  }
}

try {
  if (process.argv[2] === "--run-tests") await gradeTests();
  else applyAndRun();
} catch (error) {
  console.error(error);
  finish("unverified", { reason: "The grader could not complete." }, 2);
}
