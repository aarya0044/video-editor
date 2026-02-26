import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const TASKS_FILE = path.join(__dirname, "temp", "tasks.json");

// Load existing tasks from disk on startup
function loadTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      return JSON.parse(fs.readFileSync(TASKS_FILE, "utf8"));
    }
  } catch (_) {}
  return {};
}

function saveTasks(t) {
  try {
    fs.mkdirSync(path.dirname(TASKS_FILE), { recursive: true });
    fs.writeFileSync(TASKS_FILE, JSON.stringify(t), "utf8");
  } catch (_) {}
}

// Proxy object — every read/write automatically syncs to disk
export const tasks = new Proxy(loadTasks(), {
  set(target, key, value) {
    target[key] = value;
    saveTasks(target);
    return true;
  }
});