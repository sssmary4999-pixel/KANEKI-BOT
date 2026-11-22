import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { loadPlugins } from "../../Corleone/pluginLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// مجلد الإضافات مشتق من موقع هذا الملف: Famiglia/plugins/مالك/ضيف.js
const PLUGINS_DIR = path.resolve(__dirname, "..");

/** يقرأ رسالة الردّ مهما كان نوعها (نص، صورة، ملف...). */
function readContext(msg) {
  const m = msg?.message || {};
  return (
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo ||
    m.documentMessage?.contextInfo ||
    m.audioMessage?.contextInfo ||
    m.stickerMessage?.contextInfo ||
    null
  );
}

export default {
  name: ["ضيف", "addcmd", "newcmd"],
  description: "إضافة أو تحديث أمر في مجلد الإضافات بالردّ على كوده",
  category: "المطور",
  ownerOnly: true,

  async run({ sock, from, msg, reply, args, text }) {
    const raw = (text && text.trim()) || (args || []).join(" ").trim();

    const usage =
      "📌 *الاستخدام:*\n" +
      "ردّ على رسالة تحتوي الكود، ثم اكتب:\n" +
      "`.ضيف الاسم/المجلد`\n\n" +
      "*أمثلة:*\n" +
      "• `.ضيف ع/تجربه.js`  ← يضع `ع.js` داخل مجلد `تجربه`\n" +
      "• `.ضيف مرحبا/المتنوع`\n" +
      "• `.addcmd ping/tools`\n\n" +
      "(المجلد يُنشأ تلقائياً إن لم يكن موجوداً، وإن وُجد يُحدَّث الملف)";

    const info = readContext(msg);
    const quoted = info?.quotedMessage;

    if (!raw) {
      return await reply({ text: "❌ اكتب الاسم/القسم بعد الأمر.\n\n" + usage });
    }

    if (!raw.includes("/")) {
      return await reply({ text: "❌ الصيغة يجب أن تكون: *الاسم/القسم*\n\n" + usage });
    }

    if (!quoted) {
      return await reply({ text: "❌ ردّ على رسالة تحتوي على كود الإضافة.\n\n" + usage });
    }

    // استخراج الكود: ملف .js مرفق، أو نص عادي.
    let code = null;
    const docNode = quoted.documentMessage || quoted.documentWithCaptionMessage?.message?.documentMessage;

    if (docNode) {
      try {
        const buffer = await downloadMediaMessage(
          { key: { remoteJid: from, id: info.stanzaId, participant: info.participant }, message: quoted },
          "buffer",
          {},
          { reuploadRequest: sock.updateMediaMessage }
        );
        code = buffer.toString("utf8");
      } catch (e) {
        return await reply({ text: `❌ تعذّر تحميل الملف: ${e.message}` });
      }
    } else {
      code = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || quoted.videoMessage?.caption || null;
    }

    if (!code || !code.trim()) {
      return await reply({ text: "❌ الرسالة المُردود عليها لا تحتوي على كود صالح.\n\n" + usage });
    }

    const slash = raw.lastIndexOf("/");
    const commandName = raw.slice(0, slash).trim().replace(/\s+/g, "_");
    const folder = raw.slice(slash + 1).trim().replace(/\s+/g, "_");

    if (!commandName || !folder) {
      return await reply({ text: "❌ الصيغة غير صحيحة.\n\n" + usage });
    }

    // منع اجتياز المسار: لا رموز تنقّل ولا فواصل داخل الاسم أو المجلد.
    const safe = (s) => s.replace(/\.\./g, "").replace(/[/\\]/g, "").trim();
    // امتداد .js مكتوب من العادة — يُزال حتى لا يصبح اسم المجلد "تجربه.js".
    const dropJs = (s) => s.replace(/\.js$/i, "").trim();
    const safeName = dropJs(safe(commandName));
    const safeFolder = dropJs(safe(folder));

    if (!safeName || !safeFolder) {
      return await reply({ text: "❌ اسم غير صالح.\n\n" + usage });
    }

    try {
      const baseDir = path.join(PLUGINS_DIR, safeFolder);
      if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

      const filePath = path.join(baseDir, `${safeName}.js`);
      const existed = fs.existsSync(filePath);

      fs.writeFileSync(filePath, code.trim() + "\n", "utf8");
      await loadPlugins();

      await reply({
        text:
          `${existed ? "♻️ تم التحديث" : "✅ تمت الإضافة"}\n\n` +
          `📁 *المجلد:* ${safeFolder}\n` +
          `📄 *الملف:* ${safeName}.js\n` +
          `🗂️ *المسار:* \`Famiglia/plugins/${safeFolder}/${safeName}.js\``,
      });
    } catch (error) {
      await reply({ text: `❌ حدث خطأ: ${error.message}` });
    }
  },
};
