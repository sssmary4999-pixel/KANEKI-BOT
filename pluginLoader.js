import { readdirSync, watch, existsSync, statSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { log } from "./logger.js";

const plugins = new Map();
const PLUGINS_DIR = path.resolve("./Famiglia/plugins");
const watchTimers = new Map();

// مجلد كل إضافة داخل Famiglia/plugins — يُشتق من المسار لا من قائمة ثابتة.
const sections = new Map();

export async function loadPlugins() {
  plugins.clear();
  sections.clear();
  await loadDir(PLUGINS_DIR);

  // نحصي الإضافات الفريدة لا الأسماء: الأمر ذو الاسمين
  // كان سيُحتسب مرتين.
  const unique = new Set(plugins.values());
  log.ok(`تم تحميل الإضافات: ${unique.size} أمر (${plugins.size} اسم)`);
}

async function loadDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const tasks = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) tasks.push(loadDir(full));
    else if (entry.name.endsWith(".js")) tasks.push(loadPlugin(full));
  }
  await Promise.all(tasks);
}

async function loadPlugin(filePath) {
  try {
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) return;

    // معامل يكسر التخزين المؤقت حتى يُعاد استيراد الملف المحدَّث فوراً.
    const url = pathToFileURL(filePath).href + `?t=${Date.now()}`;
    const mod = await import(url);

    if (!mod.default?.name || !mod.default?.run) {
      log.warn(`إضافة بلا بنية صحيحة: ${filePath}`);
      return;
    }

    for (const [key, val] of plugins.entries()) {
      if (val === mod.default) plugins.delete(key);
    }

    sections.set(mod.default, sectionOf(filePath));

    const names = Array.isArray(mod.default.name) ? mod.default.name : [mod.default.name];
    for (const n of names) plugins.set(String(n).toLowerCase(), mod.default);
  } catch (e) {
    log.error(`خطأ في تحميل ${filePath}: ${e.message}`);
  }
}

export function watchPlugins() {
  try {
    watch(PLUGINS_DIR, { recursive: true }, (event, filename) => {
      if (!filename || !filename.endsWith(".js")) return;

      const fullPath = path.resolve(PLUGINS_DIR, filename);
      if (watchTimers.has(fullPath)) clearTimeout(watchTimers.get(fullPath));

      const timer = setTimeout(async () => {
        watchTimers.delete(fullPath);
        if (!existsSync(fullPath)) {
          log.info(`حُذفت إضافة: ${filename}`);
          await loadPlugins();
          return;
        }
        log.info(`تحديث إضافة: ${filename}`);
        await loadPlugin(fullPath);
      }, 150);

      watchTimers.set(fullPath, timer);
    });
    log.info("التحديث المباشر للإضافات مُفعّل");
  } catch (e) {
    // المراقبة التكرارية غير متاحة على كل الأنظمة — وليست قاتلة.
    log.warn(`تعذّر تفعيل التحديث المباشر: ${e.message}`);
  }
}

export function getPlugins() {
  return plugins;
}

/** مجلد الإضافة داخل Famiglia/plugins، أو null إن كانت في الجذر. */
export function getPluginSection(plugin) {
  return sections.get(plugin) || null;
}

/** المسار النسبي لمجلد الملف داخل Famiglia/plugins. */
function sectionOf(filePath) {
  const rel = path.relative(PLUGINS_DIR, filePath);
  const parts = rel.split(path.sep);
  return parts.length > 1 ? parts.slice(0, -1).join("/") : null;
}
