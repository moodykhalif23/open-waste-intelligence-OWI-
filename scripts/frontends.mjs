// Run site, dash, and app together against the API in Docker.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FRONTENDS = {
  site: { url: "http://localhost:5175", colour: "\x1b[38;5;179m" },
  dash: { url: "http://localhost:5174", colour: "\x1b[38;5;74m" },
  app: { url: "https://localhost:5173", colour: "\x1b[38;5;108m" },
};
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !(name in FRONTENDS));
if (unknown.length) {
  console.error(`unknown frontend: ${unknown.join(", ")} (pick from ${Object.keys(FRONTENDS)})`);
  process.exit(2);
}
const names = requested.length ? requested : Object.keys(FRONTENDS);
const width = Math.max(...names.map((n) => n.length));

const children = new Map();
let shuttingDown = false;

function label(name) {
  return `${FRONTENDS[name].colour}${name.padEnd(width)}${RESET} ${DIM}|${RESET} `;
}

function pipe(name, stream) {
  let buffered = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";
    // Vite redraws its banner with escape codes; blank lines just add noise.
    for (const line of lines) if (line.trim()) process.stdout.write(label(name) + line + "\n");
  });
}

// Only on a fresh clone: installing on every run costs seconds for nothing.
function installIfNeeded(name) {
  if (existsSync(join(ROOT, name, "node_modules"))) return true;
  console.log(`${label(name)}${DIM}installing dependencies...${RESET}`);
  const done = spawnSync("pnpm install", {
    cwd: join(ROOT, name),
    shell: true,
    stdio: "inherit",
  });
  if (done.status === 0) return true;
  console.error(`${label(name)}pnpm install failed`);
  return false;
}

function start(name) {
  // One command string, not argv: pnpm is a .cmd shim on Windows so it needs a
  // shell, and shell + argv trips node's DEP0190 escaping warning.
  const child = spawn("pnpm dev", {
    cwd: join(ROOT, name),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.set(name, child);
  pipe(name, child.stdout);
  pipe(name, child.stderr);

  child.on("exit", (code, signal) => {
    children.delete(name);
    if (shuttingDown) return;
    process.stdout.write(label(name) + `exited (${signal ?? `code ${code}`})\n`);
    // One dead server means a broken setup; do not leave a half-running stack.
    shutdown(code ?? 1);
  });
  child.on("error", (err) => {
    process.stderr.write(label(name) + `failed to start: ${err.message}\n`);
    shutdown(1);
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const [name, child] of children) {
    // taskkill /T: pnpm spawns vite as a grandchild that outlives a plain kill.
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
    children.delete(name);
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (!names.every(installIfNeeded)) process.exit(1);

console.log(`${DIM}starting ${names.join(", ")} — API expected at http://localhost:8000${RESET}`);
for (const name of names) console.log(`${label(name)}${DIM}${FRONTENDS[name].url}${RESET}`);
console.log("");
for (const name of names) start(name);
