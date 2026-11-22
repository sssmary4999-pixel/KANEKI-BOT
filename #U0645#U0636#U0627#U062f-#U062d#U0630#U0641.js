import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { log } from "../logger.js";

// الوسائط تُعاد بنفس نوعها؛ الملصق لا يقبل تعليقاً فيُسبق بإشعار نصي.
const MEDIA = {
  imageMessage: { field: "image", mime: "image/jpeg", notice: "🖼️ صورة محذوفة" },
  videoMessage: { field: "video", mime: "video/mp4", notice: "🎥 فيديو محذوف" },
  audioMessage: { field: "audio", mime: "audio/mp4", notice: "🎵 تسجيل صوتي محذوف" },
  stickerMessage: { field: "sticker", mime: "image/webp", notice: "🎴 ملصق محذوف" },
  documentMessage: { field: "document", mime: "application/octet-stream", notice: "📄 ملف محذوف" },
};

// رسائل النظام (تغيير الاسم، الإضافة، الطرد...) لا تُعاد.
const SYSTEM_TYPES = new Set([
  "protocolMessage",
  "senderKeyDistributionMessage",
  "messageContextInfo",
  "deviceSentMessage",
  "reactionMessage",
  "pollUpdateMessage",
  "pollCreationMessage",
  "pollCreationMessageV3",
]);

function textOf(m = {}) {
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  );
}

function numOf(jid = "") {
  return String(jid).split("@")[0].split(":")[0];
}

export default {
  name: "مضاد-حذف",
  flag: "antidelete",

  async onDelete({ sock, deleted, botLabel }) {
    const key = deleted?.key || {};
    const from = key.remoteJid || "";
    if (!from.endsWith("@g.us")) return false;

    const content = deleted?.message;
    if (!content) return false;
    if (Object.keys(content).every((t) => SYSTEM_TYPES.has(t))) return false;

    const sender = key.participant || deleted.participant || from;
    const header = `🗑️ *رسالة محذوفة*\n👤 من: @${numOf(sender)}`;

    try {
      const text = textOf(content);
      if (text) {
        await sock.sendMessage(from, { text: `${header}\n\n${text}`, mentions: [sender] });
        log.info(`[${botLabel}] مضاد الحذف: أعاد نصاً لـ${numOf(sender)} في ${from}`);
        return true;
      }

      const type = Object.keys(MEDIA).find((t) => content[t]);
      if (type) {
        const meta = MEDIA[type];

        // فشل التنزيل (وسائط منتهية أو غير قابلة للجلب) لا يُسقط الإشعار.
        let buffer = null;
        try {
          buffer = await downloadMediaMessage(deleted, "buffer", {}, {
            logger: console,
            reuploadRequest: sock.updateMediaMessage,
          });
        } catch (e) {
          log.warn(`مضاد الحذف: تعذّر تنزيل الوسائط (${e.message})`);
        }

        await sock.sendMessage(from, { text: `${header}\n${meta.notice}`, mentions: [sender] });

        if (buffer?.length) {
          const payload = {
            [meta.field]: buffer,
            mimetype: content[type]?.mimetype || meta.mime,
            mentions: [sender],
          };
          if (type === "documentMessage") payload.fileName = content[type]?.fileName || "file";
          await sock.sendMessage(from, payload);
        }

        log.info(`[${botLabel}] مضاد الحذف: أعاد ${meta.notice} في ${from}`);
        return true;
      }

      await sock.sendMessage(from, { text: `${header}\n> حُذفت رسالة من نوع آخر.`, mentions: [sender] });
      return true;
    } catch (e) {
      log.error(`مضاد الحذف: ${e.message}`);
      return false;
    }
  },
};
