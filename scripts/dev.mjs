import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === "win32";

const tasks = {
  backend: {
    color: "\x1b[36m",
    command: isWin ? ".venv\\Scripts\\python.exe" : ".venv/bin/python",
    args: ["-m", "uvicorn", "app.main:app", "--reload"],
    cwd: path.join(root, "backend"),
  },
  frontend: {
    color: "\x1b[35m",
    command: "npm",
    args: ["run", "dev"],
    cwd: path.join(root, "frontend"),
  },
};

const requested = process.argv.slice(2).filter((name) => tasks[name]);
const names = requested.length > 0 ? requested : Object.keys(tasks);
const children = [];

function stopAll() {
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (isWin) {
      spawn(`taskkill /pid ${child.pid} /T /F`, { shell: true, stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
}

function run(name) {
  const task = tasks[name];
  const prefix = `${task.color}[${name}]\x1b[0m `;
  const child = spawn(task.command, task.args, {
    cwd: task.cwd,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);

  const pipe = (stream, out) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) out.write(`${prefix}${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    process.stdout.write(`${prefix}exited (${signal ?? `code ${code}`})\n`);
    stopAll();
    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    process.stderr.write(`${prefix}${error.message}\n`);
    stopAll();
    process.exit(1);
  });
}

for (const name of names) run(name);

process.stdout.write(`running: ${names.join(", ")} (Ctrl+C to stop)\n`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopAll();
    process.exit(0);
  });
}
