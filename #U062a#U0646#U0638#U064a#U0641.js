import fs from "fs";
import path from "path";

const TMP_DIR = path.resolve("./tmp");

export default {
  name: ["تنظيف"],
  description: "يحذف الملفات المؤقتة من مجلد tmp",
  category: "المالك",
  ownerOnly: true,

  async run({ reply }) {

    if (!fs.existsSync(TMP_DIR)) {
      return await reply({ text: ( `⚠️ مجلد tmp غير موجود: \`${TMP_DIR}\``) });
    }

    try {
      const entries = fs.readdirSync(TMP_DIR, { withFileTypes: true });
      let borrados = 0;

      for (const entry of entries) {
        const fullPath = path.join(TMP_DIR, entry.name);
        try {
          if (entry.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
          borrados++;
        } catch {}
      }

      await reply({ text: ( `🧹 حُذف *${borrados}* عنصر من tmp (ملفات ومجلدات).`) });

      if (global.gc) global.gc();
    } catch (e) {
      await reply({ text: ( `❌ خطأ في تنظيف tmp: ${e.message}`) });
    }
  }
};