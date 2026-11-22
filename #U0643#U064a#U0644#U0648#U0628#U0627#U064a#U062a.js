import axios from "axios";
import FormData from "form-data";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

const UPLOAD_URL = "https://uploadkb.com/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MEDIA_TYPES = {
  imageMessage: "image",
  videoMessage: "video",
  documentMessage: "document",
  audioMessage: "audio",
  stickerMessage: "sticker",
};

export default {
  name: ["كيلوبايت"],
  description: "رفع الملفات إلى كيلو بايت وإرجاع رابط النسخ المباشر",
  category: "أدوات",
  ownerOnly: false,

  async run({ sock, from, msg, reply, react }) {
    try {
      await react("⏳");

      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo ||
        msg.message?.documentMessage?.contextInfo ||
        null;

      const quoted = contextInfo?.quotedMessage || null;

      const targetMessage = quoted
        ? quoted.viewOnceMessageV2?.message ||
          quoted.viewOnceMessage?.message ||
          quoted.viewOnceMessageV2Extension?.message ||
          quoted
        : msg.message || {};

      const type = Object.keys(targetMessage)[0];

      if (!MEDIA_TYPES[type]) {
        await react("❌");
        return reply({ text: "❌ يرجى إرسال صورة أو ملف أو الرد على ملف بأمر الرفع." });
      }

      const target = quoted
        ? {
            key: {
              remoteJid: from,
              id: contextInfo.stanzaId,
              participant: contextInfo.participant,
            },
            message: quoted,
          }
        : msg;

      const buffer = await downloadMediaMessage(target, "buffer", {}, {
        logger: console,
        reuploadRequest: sock.updateMediaMessage,
      });

      if (!buffer || !buffer.length) throw new Error("فشل في تحميل الملف.");

      const mime = targetMessage[type]?.mimetype || "application/octet-stream";
      const ext = mime.split("/")[1]?.split(";")[0] || "bin";
      const filename = `file_${Date.now()}.${ext}`;

      const form = new FormData();
      form.append("file_1_", buffer, { filename, contentType: mime });
      form.append("submitr", "رفع الملفات");

      const response = await axios.post(UPLOAD_URL, form, {
        headers: {
          ...form.getHeaders(),
          "User-Agent": UA,
          Origin: "https://uploadkb.com",
          Referer: "https://uploadkb.com/",
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000,
      });

      const html = String(response.data || "");

      const pick = (re) => html.match(re)?.[0] || "";
      const imageUrl = pick(/https:\/\/uploadkb\.com\/image\d+\.html/);

      if (!imageUrl) {
        throw new Error("لم يتم العثور على الرابط المباشر في استجابة الخادم.");
      }

      const caption =
        `☁️ *مركز كيلو بايت*\n\n` +
        `✅ *تم الرفع بنجاح!*\n\n` +
        `📦 *الحجم:* ${(buffer.length / 1024).toFixed(2)} KB\n\n` +
        `👇 *اضغط لنسخ الرابط المباشر:*`;

      await sock.sendButtonMessage(
        from,
        caption,
        [{ text: "📋 نسخ الرابط المباشر", copy: imageUrl }],
        {
          title: "كيلو بايت",
          footer: "Vito-Bot-V3",
          quoted: msg,
        }
      );

      await react("✅");
    } catch (error) {
      console.error("[Upload Error]:", error.message);
      await react("❌");
      await reply({ text: `❌ حدث خطأ أثناء الرفع:\n${error.message}` });
    }
  },
};
