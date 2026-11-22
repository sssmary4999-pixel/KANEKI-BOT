import axios from "axios";
import { getPlugins } from "../../Corleone/pluginLoader.js";
import { db } from "../../database/db.js";
import { getMainSock } from "../../Corleone/subbotManager.js";
import config from "../../Corleone/settings.js";


let bannerCache = null;
let bannerCacheTime = 0;
let lastUsedUrl = null;


async function getBuffer(url) {
  const res = await axios({ method: "get", url, responseType: "arraybuffer" });
  return Buffer.from(res.data);
}


async function getBannerBuffer(url) {
  if (bannerCache && lastUsedUrl === url && Date.now() - bannerCacheTime < 3600000)
    return bannerCache;
  bannerCache = await getBuffer(url);
  bannerCacheTime = Date.now();
  lastUsedUrl = url;
  return bannerCache;
}


function img(conn) {
  try {
    if (typeof global.getBotImage === "function") return global.getBotImage();
    if (Array.isArray(global.botImages) && global.botImages.length)
      return global.botImages[Math.floor(Math.random() * global.botImages.length)];
    const botId = conn?.user?.id?.split(":")[0] + "@s.whatsapp.net";
    const botData = db.getBot?.(botId) || db.getBot?.("main");
    if (botData?.banner) return botData.banner;
    return "";
  } catch (e) {
    return "";
  }
}


function name(conn) {
  try {
    if (typeof global.getBotName === "function") return global.getBotName();
    if (Array.isArray(global.botNames) && global.botNames.length)
      return global.botNames[Math.floor(Math.random() * global.botNames.length)];
    const botId = conn?.user?.id?.split(":")[0] + "@s.whatsapp.net";
    const botData = db.getBot?.(botId) || db.getBot?.("main");
    if (botData?.label && !botData.label.startsWith("SUB_")) return botData.label;
    return config.botName || "Bot";
  } catch (e) {
    return config.botName || "Bot";
  }
}


function getRmr() {
  if (typeof global.rmr === "string") return global.rmr;
  if (typeof global.my?.rmr === "string") return global.my.rmr;
  return "";
}


function isArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}


// ═══════════════════════════════════════
// ── دالة وقت التشغيل ──
// ═══════════════════════════════════════
function getUptime() {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);


  const parts = [];
  if (days > 0) parts.push(`${days}ي`);
  if (hours > 0) parts.push(`${hours}س`);
  if (minutes > 0) parts.push(`${minutes}د`);
  parts.push(`${seconds}ث`);


  return parts.join(" ");
}


export default {
  name: ["اوامر"],
  description: "Muestra el menú del sistema.",
  category: "المعلومات",
  ownerOnly: false,


  async run({ sock, from, sender, senderNum, isGroup, groupName, usedPrefix, msg }) {
    try {
      // ✅ اكتشف اللغة من الرسالة الأصلية
      let rawText = "";
      try {
        const m = msg?.message || {};
        rawText =
          m.conversation ||
          m.extendedTextMessage?.text ||
          m.imageMessage?.caption ||
          m.videoMessage?.caption ||
          "";
      } catch (e) { rawText = ""; }


      const afterPrefix = rawText.startsWith(usedPrefix)
        ? rawText.slice(usedPrefix.length).trim()
        : rawText.trim();
      const invokedCommand = afterPrefix.split(/\s+/)[0] || "";


      const lang = isArabic(invokedCommand) ? "ar" : "es";


      const currentBotNum = sock.user?.id
        ? sock.user.id.split("@")[0].split(":")[0].replace(/\D/g, "")
        : "";
      const currentBotJid = currentBotNum ? `${currentBotNum}@s.whatsapp.net` : "";


      let botData = db.getBot(currentBotJid) || db.getBot("main");


      const nombreBot = name(sock);
      const urlFoto = img(sock) || botData?.banner;


      // المقبس نفسه هو المرجع: جدول البوتات قد يحمل صفاً قديماً بـisMain:false،
      // والمقترن حديثاً قد لا يملك صفاً بعد — فيُعرَض الرئيسي كـ"بوت فرعي".
      // الوسم sock.isMainBot يُضبط عند إنشاء الاتصال، فهو الفصل القاطع.
      const esVerdaderoMain =
        sock.isMainBot === true
          ? true
          : sock.isMainBot === false
            ? false
            : sock === getMainSock() ||
              botData?.isMain === true ||
              botData?.isMain === 1 ||
              (global.mainBotNum && currentBotNum === String(global.mainBotNum));


      const esOwnerOCoOwner =
        config.ownerNumber?.includes(senderNum) ||
        config.coOwners?.includes(senderNum);


      const plugins = getPlugins();
      const seen = new Set();


      // ✅ سنبني الأقسام ديناميكيًا بناءً على category في الملفات
      const categories = {}; // { categoryName: Set(commands) }


      for (const [, plugin] of plugins) {
        if (seen.has(plugin)) continue;
        seen.add(plugin);


        // استخرج الـ category كاملًا (قد يحتوي على "owner, المطور")
        const catRaw = plugin.category || "misc";


        // ✅ اقسم على الفاصلة واختر الجزء المطابق للغة
        const catParts = String(catRaw).split(",").map(s => s.trim()).filter(Boolean);


        let catDisplay;
        if (lang === "ar") {
          // ابحث عن الجزء العربي من category
          const arabicPart = catParts.find(p => isArabic(p));
          catDisplay = arabicPart || catParts[0] || "misc";
        } else {
          // ابحث عن الجزء غير العربي
          const nonArabicPart = catParts.find(p => !isArabic(p));
          catDisplay = nonArabicPart || catParts[0] || "misc";
        }


        // أقسام المالك/المطور مخفية عن غير المصرّح لهم.
        if ((catDisplay === "المالك" || catDisplay === "المطور") && !esOwnerOCoOwner) continue;


        const names = Array.isArray(plugin.name) ? plugin.name : [plugin.name];
        const arabicNames = names.filter(n => isArabic(n));
        const nonArabicNames = names.filter(n => !isArabic(n));


        if (!categories[catDisplay]) categories[catDisplay] = new Set();


        if (lang === "ar") {
          if (arabicNames.length === 0) continue;
          categories[catDisplay].add(arabicNames[0]);
        } else {
          if (nonArabicNames.length === 0) continue;
          categories[catDisplay].add(nonArabicNames[0]);
        }
      }


      if (Object.keys(categories).length === 0) {
        return await sock.sendMessage(from, {
          text: lang === "ar"
            ? "❌ لا توجد أوامر عربية حاليًا."
            : "❌ No hay comandos disponibles."
        }, { quoted: msg });
      }


      // ✅ نصوص الواجهة حسب اللغة
      const ui = {
        ar: {
          greeting: `*أهلاً!* *@${senderNum}* أنا "${nombreBot}"`,
          type: "النوع",
          system: "النظام/المشغل",
          user: "المستخدم",
          uptime: "وقت تشغيل",
          botMain: "بوت رئيسي",
          subbot: "بوت فرعي",
          android: "أندرويد",
          sector: "القسم",
        },
        es: {
          greeting: `*𝐇𝐨𝐥𝐚!* *@${senderNum}* soy "${nombreBot}"`,
          type: "ᴛɪᴘᴏ",
          system: "sɪsᴛᴇᴍᴀ/ᴏᴘʀ",
          user: "ᴜsᴇʀ",
          uptime: "ᴜᴘᴛɪᴍᴇ",
          botMain: "Bot Principal",
          subbot: "Subbot",
          android: "Android",
          sector: "SECTOR",
        },
      }[lang];


      const tipoBot = esVerdaderoMain ? ui.botMain : ui.subbot;


      let textoMenu = `${ui.greeting}\n`;
      textoMenu += `╭━━━━━━━━━━━━━━━━━━\n`;
      textoMenu += `│ 𖠌 \`${ui.type}::\` ${tipoBot}\n`;
      textoMenu += `│ 𖠌 \`${ui.system}::\` ${ui.android}\n`;
      textoMenu += `│ 𖠌 \`${ui.user}::\` @${senderNum}\n`;
      textoMenu += `│ 𖠌 \`${ui.uptime}::\` ${getUptime()}\n`;
      textoMenu += `╰━━━━━━━━━━━━━━━━━━\n\n`;


      // ✅ اعرض الأقسام كما استخرجناها من الملفات
      for (const [cat, cmds] of Object.entries(categories)) {
        textoMenu += `𓆩◇𓆪 ⸙ ${ui.sector}│ *${cat.toUpperCase()}* ·°ᰍ•\n`;


        for (const cmd of cmds) {
          textoMenu += `> ⏤͟͟͞͞⊱🌀 *${usedPrefix}${cmd}*\n`;
        }
        textoMenu += `\n`;
      }


      textoMenu += `╭━─━─━─━─━─━─━─━╮\n`;
      textoMenu += `🕴🏻 _تم تطوير من قبل Taib_ │\n`;
      textoMenu += `╰━─━─━─━─━─━─━─━╯\n\n`;
      textoMenu += getRmr();


      const nombreRandom = global.botNames[Math.floor(Math.random() * global.botNames.length)];
      const nombreRandom2 = global.botNames[Math.floor(Math.random() * global.botNames.length)];
      const imagenRandom = global.botImages[Math.floor(Math.random() * global.botImages.length)];


      const linkCanal = "https://whatsapp.com/channel/0029Vb8hDbBDuMRXBFk3u02L";
      const canalJid = "120363429662971001@newsletter";


      const buttons = lang === "ar" ? [
        { text: "📢 القناة", url: linkCanal },
        { text: "📋 نسخ الرابط", copy: linkCanal }
      ] : [
        { text: "📢 Canal", url: linkCanal },
        { text: "📋 Copiar enlace", copy: linkCanal }
      ];


      await sock.sendButtonMessage(from, textoMenu, buttons, {
        title: nombreBot,
        footer: nombreRandom,
        quoted: msg,
        image: imagenRandom,
        mentions: [sender],
        contextInfo: {
          mentionedJid: [sender],
          isForwarded: true,
          forwardingScore: 1,
          forwardedNewsletterMessageInfo: {
            newsletterJid: canalJid,
            newsletterName: nombreRandom2,
            serverMessageId: -1,
          },
        }
      });


    } catch (error) {
      console.error("Error crítico en el comando menu:", error);
    }
  },
};
