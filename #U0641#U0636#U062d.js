import { downloadMediaMessage } from "@whiskeysockets/baileys";

/** يستخرج مفتاح الوسيط وجسمه من الرسالة المقتبسة. */
function extractMedia(quoted) {
  const message =
    quoted.viewOnceMessageV2?.message ||
    quoted.viewOnceMessage?.message ||
    quoted.viewOnceMessageV2Extension?.message ||
    quoted;

  const key = ["imageMessage", "videoMessage", "audioMessage"].find((k) => message?.[k]?.viewOnce);
  return key ? { key, media: message[key] } : null;
}

export default {
  name: ["فضح"],
  description: "كشف الوسائط ذات المشاهدة مرة واحدة",
  category: "المجموعات",
  ownerOnly: false,

  async run({ sock, from, msg, reply, react }) {
    const T = {
      noQuote: "❌ ردّ على رسالة (صورة/فيديو/صوت) لمشاهدة مرة واحدة",
      notViewOnce: "❌ هذه الرسالة ليست من نوع المشاهدة مرة واحدة",
      fail: "❌ فشل استخراج الوسائط",
      error: (e) => `❌ خطأ: ${e}`,
    };

    try {
      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo ||
        msg.message?.documentMessage?.contextInfo ||
        msg.message?.audioMessage?.contextInfo ||
        null;

      const quoted = contextInfo?.quotedMessage || null;
      if (!quoted) return await reply({ text: T.noQuote });

      const found = extractMedia(quoted);
      if (!found) return await reply({ text: T.notViewOnce });

      await react("👁️");

      // downloadMediaMessage يتطلّب رسالة كاملة بمفتاح، فنعيد بناء الغلاف.
      const type = found.key === "imageMessage" ? "image" : found.key === "videoMessage" ? "video" : "audio";
      const stub = { key: contextInfo.stanzaId ? { id: contextInfo.stanzaId, remoteJid: from } : undefined, message: quoted };
      const buffer = await downloadMediaMessage(stub, "buffer", {}, { logger: console, reuploadRequest: sock.updateMediaMessage });
      if (!buffer?.length) {
        await react("❌");
        return await reply({ text: T.fail });
      }

      const media = found.media;
      const outMessage =
        type === "audio"
          ? { audio: buffer, mimetype: media.mimetype || "audio/mp4", ptt: false }
          : { [type]: buffer, caption: media.caption || "👁️ مكشوفة" };

      await sock.sendMessage(from, outMessage, { quoted: msg });
      await react("✅");
    } catch (error) {
      await react("❌");
      await reply({ text: T.error(error.message) });
    }
  },
};
