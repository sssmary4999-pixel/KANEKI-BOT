import { printBanner, log } from "./Famiglia/Corleone/logger.js";
import { createConnection } from "./Famiglia/Corleone/connection.js";
import { loadPlugins, watchPlugins } from "./Famiglia/Corleone/pluginLoader.js";
import { launchAllSubbots, registerMainBot } from "./Famiglia/Corleone/subbotManager.js";
import fs from "fs";
import path from "path";

/**
 * كتم تحذير node:sqlite التجريبي.
 *
 * يطبع Node رسالة "SQLite is an experimental feature" في كل تشغيل، فتدفن مخرجات
 * البوت في الطرفية. نُسقط هذا التحذير وحده — وما سواه ما زال يصل إلى stderr.
 */
const originalEmit = process.emit;
process.emit = function (name, data, ...rest) {
  if (
    name === "warning" &&
    data?.name === "ExperimentalWarning" &&
    /SQLite/i.test(data?.message || "")
  ) {
    return false;
  }
  return originalEmit.call(process, name, data, ...rest);
};

// وعد مرفوض أو استثناء شارد يجب ألا يُسقط البوت كله.
process.on("uncaughtException", (err) => {
  log.error(`خطأ غير متوقع: ${err?.message}`, "index.js", err?.stack);
});
process.on("unhandledRejection", (reason) => {
  log.error(`وعد مرفوض غير معالج: ${reason?.message || reason}`, "index.js");
});

const tmpDir = path.resolve("./tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
process.env.TMPDIR = tmpDir;

for (const file of fs.readdirSync(tmpDir)) {
  try {
    fs.unlinkSync(path.join(tmpDir, file));
  } catch {}
}

setInterval(() => {
  if (!fs.existsSync(tmpDir)) return;
  for (const file of fs.readdirSync(tmpDir)) {
    try {
      const filePath = path.join(tmpDir, file);
      if (Date.now() - fs.statSync(filePath).mtimeMs > 3600000) fs.unlinkSync(filePath);
    } catch {}
  }
}, 6 * 60 * 60 * 1000);

async function main() {
  await printBanner();

  log.info("تحميل الإضافات...");
  await loadPlugins();
  watchPlugins();

  log.info("تشغيل البوت الرئيسي...");
  const sock = await createConnection({
    sessionDir: process.env.SESSION_DIR || (process.env.RENDER ? "/var/data/sessions/main" : "./sessions/main"),
    phoneNumber: (process.env.PHONE_NUMBER || "249117929877").replace(/\D/g, ""),
    botLabel: "MAIN",
    isSubbot: false,
    // يُستدعى عند كل فتح للاتصال: إعادة الاتصال تنشئ مقبساً جديداً،
    // فيجب تحديث مرجع البوت الرئيسي وإلا عُرض كبوت فرعي.
    onOpen: (s) => {
      registerMainBot(s, "MAIN");
      log.info("[MAIN] تم التسجيل في البوتات النشطة");
    },
  });

  if (sock) {
    registerMainBot(sock, "MAIN");
    log.info("[MAIN] تم التسجيل في البوتات النشطة");
  }

  launchAllSubbots();
}

main().catch((e) => {
  log.error(`خطأ قاتل: ${e.message}`, "index.js", e.stack);
  process.exit(1);
});
