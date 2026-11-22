import { generateWAMessageFromContent, prepareWAMessageMedia } from "@whiskeysockets/baileys";
import axios from "axios";

/**
 * الأزرار التفاعلية في baileys-nextgen v7.
 *
 * لا يوجد `sendButtonMessage` جاهز، ولفّ الحمولة داخل `viewOnceMessage` لا يكفي
 * — واتساب يُسقط الأزرار. لا تظهر إلا حين تُرسل الرسالة كـ`interactiveMessage`
 * عادي مع عقدة إضافية `biz > interactive > native_flow` يضيفها `initButtons()`.
 */

/** يبني العقد الإضافية التي تجعل واتساب يعرض التدفّق الأصلي. */
function flowNodes(jid) {
  const nodes = [
    {
      tag: "biz",
      attrs: {},
      content: [
        {
          tag: "interactive",
          attrs: { type: "native_flow", v: "1" },
          content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
        },
      ],
    },
  ];

  // المحادثة الخاصة تحتاج علامة البوت أيضاً.
  if (!String(jid).endsWith("@g.us")) {
    nodes.push({ tag: "bot", attrs: { biz_bot: "1" } });
  }

  return nodes;
}

/** يحوّل الزر إلى الشكل الذي يتوقّعه التدفّق الأصلي في واتساب. */
function formatButton(btn, index) {
  if (btn.url) {
    return {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({
        display_text: btn.text || "",
        url: btn.url,
        merchant_url: btn.url,
      }),
    };
  }

  if (btn.phoneNumber) {
    return {
      name: "cta_call",
      buttonParamsJson: JSON.stringify({
        display_text: btn.text || "",
        phone_number: btn.phoneNumber,
      }),
    };
  }

  if (btn.copy) {
    return {
      name: "cta_copy",
      buttonParamsJson: JSON.stringify({ display_text: btn.text || "", copy_code: btn.copy }),
    };
  }

  return {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({ display_text: btn.text || "", id: btn.id || `btn_${index}` }),
  };
}

async function buildHeader(conn, { image, title }) {
  if (image) {
    try {
      let buffer;
      if (typeof image === "string") {
        const res = await axios.get(image, { responseType: "arraybuffer" });
        buffer = Buffer.from(res.data);
      } else {
        buffer = image;
      }
      const media = await prepareWAMessageMedia({ image: buffer }, { upload: conn.waUploadToServer });
      return { hasMediaAttachment: true, imageMessage: media.imageMessage };
    } catch (e) {
      console.error("[buttons] تعذّر تجهيز الصورة:", e.message);
    }
  }

  if (title) return { title: String(title).trim(), hasMediaAttachment: false };
  return null;
}

/**
 * يضيف `sendButtonMessage` إلى الاتصال.
 *
 *   initButtons(sock);
 *   await sock.sendButtonMessage(jid, "text", [{ text: "مرحباً", id: ".مرحبا" }], { footer });
 *
 * قد يحمل الزر `id` (رد) أو `url` أو `phoneNumber` أو `copy`. مرّر `sections`
 * لقائمة منسدلة؛ تُضاف كزر `single_select`.
 */
export function initButtons(conn) {
  conn.sendButtonMessage = async (jid, text = "", buttons = [], opts = {}) => {
    const {
      footer = "",
      title = "",
      quoted = null,
      mentions = [],
      sections = [],
      image = null,
      contextInfo = null,
    } = opts;

    const formatted = buttons.map(formatButton);

    if (sections.length > 0) {
      formatted.push({
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "Seleccionar",
          sections: sections.map((s) => ({
            title: s.title,
            rows: s.rows.map((r) => ({ title: r.title, description: r.description || "", id: r.id })),
          })),
        }),
      });
    }

    const header = await buildHeader(conn, { image, title });

    const finalContextInfo = {
      mentionedJid:
        mentions.length > 0
          ? mentions
          : typeof conn.parseMention === "function"
            ? conn.parseMention(text)
            : [],
      groupMentions: [],
      ...(contextInfo || {}),
    };

    const interactiveMessage = {
      body: { text: String(text).trim() },
      footer: footer ? { text: String(footer).trim() } : undefined,
      header: header || undefined,
      nativeFlowMessage: { buttons: formatted, contentFormatVersion: 1 },
      contextInfo: finalContextInfo,
    };

    const waMsg = generateWAMessageFromContent(
      jid,
      { interactiveMessage },
      { quoted, userJid: conn.user?.jid || conn.user?.id }
    );

    return await conn.relayMessage(jid, waMsg.message, {
      messageId: waMsg.key.id,
      additionalNodes: flowNodes(jid),
    });
  };

  return conn;
}

/**
 * يستخرج معرّف الأمر من الزر المضغوط.
 * يُعيد "" عندما لا تكون الرسالة ردّ زر أو قائمة.
 */
export function extractButtonId(message) {
  if (!message) return "";

  const paramsJson = message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (paramsJson) {
    try {
      const parsed = JSON.parse(paramsJson);
      return parsed?.id || parsed?.selectedId || "";
    } catch {
      return "";
    }
  }

  return (
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId ||
    ""
  );
}

export default { initButtons, extractButtonId };
