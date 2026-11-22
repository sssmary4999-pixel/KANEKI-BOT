import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { log } from "../logger.js";

// رسائل «العرض مرة واحدة» تصل بلا نص، فلا يعتمد هذا المضاد على `body`.
const MEDIA = {
  imageMessage: { field: "image", kind: "image", mime: "image/jpeg" },
  videoMessage: { field: "video", kind: "video", mime: "video/mp4" },
  audioMessage: { field: "audio", kind: "audio", mime: "audio/mp4" },
};

/** يفتح الأغلفة الثلاثة التي قد تُلفّ بها رسالة العرض مرة واحدة. */
function unwrap(content = {}) {
  return (
    content.viewOnceMessage?.message ||
    content.viewOnceMessageV2?.message ||
    content.viewOnceMessageV2Extension?.message ||
    content
  );
}

function numOf(jid = "") {
  return String(jid).split("@")[0].split(":")[0];
}

/** يكشف وسائط «العرض مرة واحدة» ويعيد إرسالها ظاهرة. */
export default {
  name: "عرض-مره-واحده",
  flag: "viewonce",

  async check({ sock, msg, from, sender, botLabel }) {
    const content = unwrap(msg?.message);
    const type = Object.keys(MEDIA).find((t) => content?.[t]?.viewOnce);
    if (!type) return false;

    const media = content[type];
    const meta = MEDIA[type];

    try {
      const stream = await downloadContentFromMessage(media, meta.kind);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      if (!buffer?.length) return false;

      const payload = { [meta.field]: buffer, mimetype: media.mimetype || meta.mime };
      // التعليق للنصوص المرئية فقط؛ الصوت لا يقبله.
      if (media.caption) payload.caption = media.caption;

      await sock.sendMessage(from, payload, { quoted: msg });
      log.info(`[${botLabel}] عرض-مره-واحده: كشف ${type} من ${numOf(sender)} في ${from}`);
      return true;
    } catch (e) {
      log.error(`عرض-مره-واحده: ${e.message}`);
      return false;
    }
  },
};
