import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadPlugins } from "../../Corleone/pluginLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// مجلد الإضافات مشتق من موقع هذا الملف: Famiglia/plugins/مالك/امسح.js
const PLUGINS_DIR = path.resolve(__dirname, "..");

export default {
  name: ["امسح"],
  description: "حذف أمر من مجلد الإضافات",
  category: "المطور",
  ownerOnly: true,

  async run({ args, text, usedPrefix, reply }) {
    const input = (args?.[0] || text || "").trim().replace(/\.js$/i, "");

    if (!input) {
      return await reply({
        text: `❌ الاستخدام الصحيح:\n${usedPrefix}امسح اسم-الأمر\n\n📌 مثال:\n${usedPrefix}امسح مرحبا`,
      });
    }

    // البحث عن الملف في جذر الإضافات أو أي مجلد فرعي
    function findFile(dir) {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          const found = findFile(fullPath);
          if (found) return found;
        } else if (item.isFile() && item.name === `${input}.js`) {
          return fullPath;
        }
      }
      return null;
    }

    const filePath = findFile(PLUGINS_DIR);

    if (!filePath) {
      return await reply({ text: `❌ لا يوجد ملف بهذا الاسم: \`${input}.js\`` });
    }

    try {
      fs.unlinkSync(filePath);
      await loadPlugins();
      const relPath = path.relative(PLUGINS_DIR, filePath);
      await reply({ text: `✅ تم حذف الأمر: *${input}*\n📂 \`Famiglia/plugins/${relPath}\`` });
    } catch (error) {
      console.error("[ امسح ]", error);
      await reply({ text: `❌ تعذّر الحذف:\n${error.message}` });
    }
  },
};
