import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// جذر المشروع مشتق من موقع هذا الملف: Famiglia/plugins/مالك/بدل2.js
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  "temp",
  "cache",
  "logs",
  "dist",
  "build",
  "__pycache__",
  "plugins",
  "sessions",
  "tmp",
  "database",
];

const EXCLUDED_EXTS = [
  ".png", ".jpg", ".jpeg", ".gif", ".mp4", ".mp3", ".wav",
  ".flac", ".pdf", ".zip", ".rar", ".7z", ".webp", ".ico",
  ".woff", ".woff2", ".ttf", ".eot",
];

export default {
  name: ["بدل2"],
  description: "استبدال نص في جميع ملفات المشروع (عدا الإضافات)",
  category: "المطور",
  ownerOnly: true,

  async run({ text, usedPrefix, reply }) {
    const usage =
      `❌ الاستخدام الصحيح:\n${usedPrefix}بدل2 النص-القديم|النص-الجديد\n\n` +
      `📌 مثال:\n${usedPrefix}بدل2 مرحبا|أهلاً`;

    if (!text || !text.trim()) {
      return await reply({ text: usage });
    }

    const parts = text.split("|").map((s) => s.trim());

    if (parts.length < 2) {
      return await reply({ text: `❌ يجب استخدام | للفصل.\n\n${usage}` });
    }

    const oldText = parts[0];
    const newText = parts[1];

    if (!oldText || !newText) {
      return await reply({ text: "❌ النص القديم والنص الجديد مطلوبان." });
    }

    try {
      const changed = [];
      const errors = [];
      let scanned = 0;
      let replaced = 0;

      function walk(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            if (!EXCLUDED_DIRS.includes(item.name) && !item.name.startsWith(".")) {
              walk(fullPath);
            }
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (EXCLUDED_EXTS.includes(ext)) continue;

            try {
              scanned++;
              const content = fs.readFileSync(fullPath, "utf-8");
              const count = content.split(oldText).length - 1;
              if (count > 0) {
                fs.writeFileSync(fullPath, content.split(oldText).join(newText), "utf-8");
                replaced += count;
                changed.push(path.relative(PROJECT_ROOT, fullPath));
              }
            } catch (e) {
              errors.push({ file: fullPath, error: e.message });
            }
          }
        }
      }

      walk(PROJECT_ROOT);

      let out = `✅ **اكتمل الاستبدال!**\n\n`;
      out += `📂 الجذر: \`${PROJECT_ROOT}\`\n`;
      out += `📄 الملفات الممسوحة: ${scanned}\n`;
      out += `🔍 القديم: \`${oldText}\`\n`;
      out += `🔄 الجديد: \`${newText}\`\n`;
      out += `🚫 المستبعد: مجلد الإضافات\n`;
      out += `📝 الملفات المعدلة: ${changed.length}\n`;
      out += `📊 إجمالي الاستبدالات: ${replaced}\n`;

      if (changed.length > 0) {
        out += `\n📋 الملفات:\n`;
        changed.slice(0, 15).forEach((f, i) => (out += `${i + 1}. \`${f}\`\n`));
        if (changed.length > 15) out += `... و ${changed.length - 15} ملفات أخرى\n`;
      }

      if (errors.length > 0) {
        out += `\n⚠️ أخطاء: ${errors.length}\n`;
      }

      if (out.length > 4096) {
        const chunks = out.match(/[\s\S]{1,4000}/g) || [];
        for (const chunk of chunks) await reply({ text: chunk });
      } else {
        await reply({ text: out });
      }
    } catch (error) {
      console.error("[ بدل2 ]", error);
      await reply({ text: `❌ حدث خطأ:\n${error.message}` });
    }
  },
};
