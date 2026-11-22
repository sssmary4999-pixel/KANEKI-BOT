import os from "os";
import process from "process";
import fs from "fs";
import { db } from "../../database/db.js";
import config from "../../Corleone/settings.js";

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === Infinity) return "0.00";
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return `${h}h ${m}m ${s}s`;
}

function getMemoryInfo() {
  try {
    if (fs.existsSync("/sys/fs/cgroup/memory.max") && fs.existsSync("/sys/fs/cgroup/memory.current")) {
      let total = fs.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
      let used = fs.readFileSync("/sys/fs/cgroup/memory.current", "utf8").trim();

      if (total !== "max" && !isNaN(Number(total)) && Number(total) > 0) {
        return { total: Number(total), used: Number(used) };
      }
    }

    if (fs.existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
      const total = fs.readFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8").trim();
      const used = fs.readFileSync("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8").trim();

      if (!isNaN(Number(total)) && Number(total) < 9223372036854771712 && Number(total) > 0) {
        return { total: Number(total), used: Number(used) };
      }
    }
  } catch (e) {
    // كتم أخطاء قراءة ملفات النظام
  }

  const total = os.totalmem();
  const used = total - os.freemem();
  return { total, used };
}

export default {
  name: ["نظام"],
  description: "يعرض معلومات حقيقية عن النظام",
  category: "المعلومات",
  ownerOnly: false,

  async run({ sock, from, react, msg }) {

    try {
      if (react && typeof react === "function") {
        await react("⏳").catch(() => {});
      } else if (sock?.sendMessage) {
        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});
      }

      const currentBotNum = sock?.user?.id
        ? sock.user.id.split('@')[0].split(':')[0].replace(/\D/g, '')
        : null;
      const botJid = currentBotNum ? `${currentBotNum}@s.whatsapp.net` : null;

      let currentBotName = config.botName || "BOT VITO V3";
      try {
        if (botJid && db && typeof db.getBot === "function") {
          const botData = db.getBot(botJid) || {};
          const esLabelAutomatico =
            botData.label?.startsWith('SUB_') ||
            botData.label === 'Subbot' ||
            botData.label === 'MAIN';

          currentBotName = (esLabelAutomatico || !botData.label)
            ? (config.botName || "BOT VITO V3")
            : botData.label;
        }
      } catch {
        currentBotName = config.botName || "BOT VITO V3";
      }

      currentBotName = currentBotName.toUpperCase();

      const memory = getMemoryInfo();
      const ramTotal = memory.total;
      const ramUsed = memory.used;
      const ramFree = ramTotal - ramUsed;
      const ramBot = process.memoryUsage().rss;

      const ramPercent = ramTotal > 0 ? ((ramUsed / ramTotal) * 100).toFixed(1) : "0.0";

      const cpus = os.cpus();
      const cpuModel = cpus && cpus[0]?.model ? cpus[0].model.trim() : "Desconocido";

      let cpuCores = 1;
      try {
        cpuCores = typeof os.availableParallelism === "function"
          ? os.availableParallelism()
          : (cpus ? cpus.length : 1);
      } catch {
        cpuCores = cpus ? cpus.length : 1;
      }

      const uptimeBot = process.uptime();
      const nodeVersion = process.version;
      const platform = os.platform();
      const arch = os.arch();

      let text = "";
      text += `官 ════ 『 *${currentBotName}* 』 ════ 官\n\n`;

      text += ( `⚔️ ─── ❖ *المعالج* ❖ ─── ⚔️\n`);
      text += ( `  ✦ *الطراز:* ${cpuModel}\n`);
      text += ( `  官 *الأنوية:* ${cpuCores}\n`);
      text += ( `  ✦ *المنصة:* ${platform} (${arch})\n\n`);

      text += ( `🧠 ─── ❖ *الذاكرة العشوائية* ❖ ─── 🧠\n`);
      text += ( `  ✦ *الإجمالي:* ${formatBytes(ramTotal)} GB\n`);
      text += ( `  官 *المستخدم:* ${formatBytes(ramUsed)} GB (${ramPercent}%)\n`);
      text += ( `  ✦ *المتاح:* ${formatBytes(ramFree)} GB\n`);
      text += ( `  官 *البوت يستخدم:* ${formatBytes(ramBot)} GB\n\n`);

      text += ( `⏳ ─── ❖ *وقت التشغيل* ❖ ─── ⏳\n`);
      text += ( `  ✦ *البوت نشط:* ${formatTime(uptimeBot)}\n\n`);

      text += ( `🜲 ─── ❖ *البيئة* ❖ ─── 🜲\n`);
      text += `  ✦ *Node.js:* ${nodeVersion}\n`;
      text += `  官 *PID:* ${process.pid}\n\n`;

      text += ( `> 官 _Powered by Taib | ${currentBotName}_ 官`);

      await sock.sendMessage(from, { text }, { quoted: msg });

      if (react && typeof react === "function") await react("✅").catch(() => {});

    } catch (error) {
      console.error(( "خطأ حرج في system:"), error);

      try {
        if (react && typeof react === "function") await react("❌").catch(() => {});
        await sock.sendMessage(from, {
          text: ( "官 حدث خطأ داخلي أثناء جلب معلومات النظام.")
        }, { quoted: msg });
      } catch (e) {
        console.error(( "تعذّر إرسال رسالة الخطأ:"), e);
      }
    }
  }
};