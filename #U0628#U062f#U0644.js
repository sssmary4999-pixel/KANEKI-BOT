import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadPlugins } from "../../Corleone/pluginLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// مجلد الإضافات مشتق من موقع هذا الملف: Famiglia/plugins/مالك/بدل.js
const PLUGINS_DIR = path.resolve(__dirname, "..");

export default {
  name: ["بدل"],
  description: "استبدال نص في جميع ملفات الإضافات",
  category: "المطور",
  ownerOnly: true,

  async run({ text, usedPrefix, reply }) {
    const usage =
      `❌ الاستخدام الصحيح:\n${usedPrefix}بدل النص-القديم|النص-الجديد\n\n` +
      `📌 مثال:\n${usedPrefix}بدل مرحبا|أهلاً`;

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
      const files = [];
      const errors = [];
      let replaced = 0;

      function walk(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            walk(fullPath);
          } else if (item.isFile() && item.name.endsWith(".js")) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              if (content.includes(oldText)) {
                const count = content.split(oldText).length - 1;
                fs.writeFileSync(fullPath, content.split(oldText).join(newText), "utf-8");
                replaced += count;
                files.push(path.relative(PLUGINS_DIR, fullPath));
              }
            } catch (e) {
              errors.push({ file: fullPath, error: e.message });
            }
          }
        }
      }

      walk(PLUGINS_DIR);
      await loadPlugins();

      let out = `✅ **اكتمل الاستبدال!**\n\n`;
      out += `🔍 القديم: \`${oldText}\`\n`;
      out += `🔄 الجديد: \`${newText}\`\n`;
      out += `📝 الملفات المعدلة: ${files.length}\n`;
      out += `📊 إجمالي الاستبدالات: ${replaced}\n`;

      if (files.length > 0) {
        out += `\n📋 الملفات:\n`;
        files.slice(0, 15).forEach((f, i) => (out += `${i + 1}. \`${f}\`\n`));
        if (files.length > 15) out += `... و ${files.length - 15} ملفات أخرى\n`;
      }

      if (errors.length > 0) {
        out += `\n⚠️ أخطاء: ${errors.length}\n`;
      }

      await reply({ text: out });
    } catch (error) {
      console.error("[ بدل ]", error);
      await reply({ text: `❌ حدث خطأ:\n${error.message}` });
    }
  },
};
