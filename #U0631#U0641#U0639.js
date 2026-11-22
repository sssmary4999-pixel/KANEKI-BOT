import axios from "axios";
import FormData from "form-data";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

const API_KEY = "dix_c78kb4g";
const UPLOAD_TMP_URL = "https://dix.lat/v1/upload/tmp";
const UPLOAD_PERM_URL = "https://dix.lat/v1/upload";

// المفتاح = رقم المرسل
const pendingUploads = new Map();

const IMAGE_EXTS = ["jpg", "png", "webp"];
const VIDEO_EXTS = ["mp4", "mkv", "webm"];
const AUDIO_EXTS = ["mp3", "ogg", "m4a"];
const DOC_EXTS = ["bin", "zip", "pdf"];
const STICKER_EXTS = ["webp", "png"];

const ALL_EXTS = [...new Set([...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS, ...DOC_EXTS, ...STICKER_EXTS])];

// كل معرّف زر يُسجَّل باسم كامل. تسجيل البادئة "رفع_اختر_" وحدها لا يكفي:
// الزر يرسل المعرّف الكامل "رفع_اختر_jpg"، والمطابقة في messageHandler حرفية.
const BUTTON_NAMES = [
  ...ALL_EXTS.map((e) => `رفع_اختر_${e}`),
  "رفع_تخزين_1d",
  "رفع_تخزين_2d",
  "رفع_تخزين_perm",
];

const T = {
  noFile: "❌ ارفق ملفاً أو ردّ على ملف/صورة/فيديو",
  dlFail: "❌ فشل تحميل الملف",
  expired: "❌ انتهت صلاحية الطلب، أعد إرسال الملف",
  uploadFail: "❌ فشل الرفع",
  error: (e) => `❌ خطأ: ${e}`,
  step1Title: "📎 الخطوة 1/2",
  step1Text: "📎 *الخطوة 1/2:* اختر الامتداد",
  step2Title: "📎 الخطوة 2/2",
  step2Text: (ext) => `📎 الامتداد: *.${ext}*\n\n🗂️ *الخطوة 2/2:* اختر نوع التخزين`,
  btn1d: "⏱️ 24 ساعة",
  btn2d: "⏱️ 48 ساعة",
  btnPerm: "♾️ دائم",
  footer: "𝙱𝙾𝚃 𝚅𝙸𝚃𝙾 𝚅𝟹",
};

export default {
  name: ["رفع", "upload", ...BUTTON_NAMES],
  description: "رفع ملف إلى Dix CDN",
  category: "أدوات",
  ownerOnly: false,

  async run({ sock, from, msg, senderNum, reply, react, cmdName }) {
    try {
      // ===== الخطوة 2: اختيار التخزين =====
      if (cmdName.startsWith("رفع_تخزين_")) {
        const storage = cmdName.slice("رفع_تخزين_".length); // 1d | 2d | perm

        const pending = pendingUploads.get(senderNum);
        if (!pending) {
          await reply({ text: T.expired });
          return;
        }

        await react("📤");

        let uploadUrl;
        let ttl = null;
        if (storage === "1d") {
          uploadUrl = UPLOAD_TMP_URL;
          ttl = 86400;
        } else if (storage === "2d") {
          uploadUrl = UPLOAD_TMP_URL;
          ttl = 172800;
        } else {
          uploadUrl = UPLOAD_PERM_URL;
        }

        const form = new FormData();
        form.append("file", pending.buffer, { filename: `file.${pending.ext}` });

        const finalUrl = ttl ? `${uploadUrl}?ttl=${ttl}` : uploadUrl;

        const res = await axios.post(finalUrl, form, {
          headers: { ...form.getHeaders(), "x-api-key": API_KEY },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 120000,
        });

        const data = res.data;
        if (!data?.status || !data?.data?.url) {
          await react("❌");
          await reply({ text: T.uploadFail });
          return;
        }

        pendingUploads.delete(senderNum);
        await reply({ text: data.data.url });
        await react("✅");
        return;
      }

      // ===== الخطوة 1: اختيار الامتداد =====
      if (cmdName.startsWith("رفع_اختر_")) {
        const ext = cmdName.slice("رفع_اختر_".length);

        const pending = pendingUploads.get(senderNum);
        if (!pending) {
          await reply({ text: T.expired });
          return;
        }

        pending.ext = ext;

        await react("🗂️");

        await sock.sendButtonMessage(
          from,
          T.step2Text(ext),
          [
            { text: T.btn1d, id: ".رفع_تخزين_1d" },
            { text: T.btn2d, id: ".رفع_تخزين_2d" },
            { text: T.btnPerm, id: ".رفع_تخزين_perm" },
          ],
          { title: T.step2Title, footer: T.footer, quoted: msg }
        );

        return;
      }

      // ===== الأمر الرئيسي: رفع =====
      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo ||
        msg.message?.documentMessage?.contextInfo ||
        msg.message?.audioMessage?.contextInfo ||
        null;

      const quoted = contextInfo?.quotedMessage || null;

      const targetMessage = quoted
        ? quoted.viewOnceMessageV2?.message ||
          quoted.viewOnceMessage?.message ||
          quoted.viewOnceMessageV2Extension?.message ||
          quoted
        : msg.message || {};

      const type = Object.keys(targetMessage)[0];

      const VALID_TYPES = [
        "imageMessage",
        "videoMessage",
        "audioMessage",
        "documentMessage",
        "stickerMessage",
      ];

      if (!VALID_TYPES.includes(type)) {
        await reply({ text: T.noFile });
        return;
      }

      await react("📥");

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

      if (!buffer || !buffer.length) {
        await react("❌");
        await reply({ text: T.dlFail });
        return;
      }

      const EXT_OPTIONS = {
        imageMessage: IMAGE_EXTS,
        videoMessage: VIDEO_EXTS,
        audioMessage: AUDIO_EXTS,
        documentMessage: DOC_EXTS,
        stickerMessage: STICKER_EXTS,
      };

      const availableExts = EXT_OPTIONS[type] || ["bin"];

      pendingUploads.set(senderNum, {
        buffer,
        type,
        senderNum,
        from,
        createdAt: Date.now(),
      });

      setTimeout(() => pendingUploads.delete(senderNum), 5 * 60 * 1000);

      await react("📎");

      await sock.sendButtonMessage(
        from,
        T.step1Text,
        availableExts.map((e) => ({
          text: `.${e}`,
          id: `.رفع_اختر_${e}`,
        })),
        { title: T.step1Title, footer: T.footer, quoted: msg }
      );
    } catch (e) {
      await react("❌");
      await reply({ text: T.error(e.message) });
    }
  },
};
