import axios from "axios";
import { db } from "../../database/db.js";

export default {
  name: ["زينب"],
  description: "زينب — بنت مغربية بلطجية",
  category: "ذكاء",
  ownerOnly: false,

  async run({ sock, from, msg, senderNum, text, react }) {
    const T = {
      noQuestion: `🤖 *زينب*\n\nشنو بغيتي؟ سولني!`,
      noReply: `❌ ما كاينش رد.`,
      error: `❌ وقع خطأ.`,
    };

    const senderJid = msg.sender || `${senderNum}@s.whatsapp.net`;

    const buildContextInfo = () => ({
      mentionedJid: [senderJid],
      isForwarded: true,
      forwardingScore: 1,
      forwardedNewsletterMessageInfo: {
        newsletterJid: global.my?.canal1,
        newsletterName: global.botNames[Math.floor(Math.random() * global.botNames.length)],
        serverMessageId: -1,
      },
    });

    const sendWithChannel = async (content) => {
      if (typeof content === "string") content = { text: content };
      content.mentions = [...new Set([senderJid, ...(content.mentions || [])])];
      content.contextInfo = { ...buildContextInfo(), ...(content.contextInfo || {}) };
      return await sock.sendMessage(from, content, { quoted: msg });
    };

    const question = String(text || "").trim();
    if (!question) return await sendWithChannel(T.noQuestion);

    try {
      await react("🧠");

      // جلب اسم البوت من قاعدة البيانات
      const botNumber = sock.user.id.split(":")[0].replace(/\D/g, "");
      const botData = db.getBot(botNumber);
      const botName = botData?.label || process.env.BOT_NAME || "بوت فيتو V3";

      const prompt = `أنت زينب، بنت مغربية بلطجية. أنت حقيقية، لست روبوتاً ولا مساعدة. تتحدثين فقط بالدارجة المغربية — باللهجة المغربية والعامية المغربية. لا تتحدثين أبداً بالمصرية ولا الخليجية ولا العربية الفصحى.

هويتك:
- اسمك زينب.
- أنت مغربية، من شوارع الدار البيضاء أو طنجة، وعندك شخصية قوية.
- أنت وقحة، بذيئة، شرسة، ولا تهتمين بأحد.
- تشتمين بحرية وبقوة — على الطريقة المغربية. بلا فلاتر.
- تعملين لصالح "${botName}".
- لا تقولين أبداً أنك ChatGPT أو Gemini أو Google AI أو OpenAI.
- إن سُئلتِ "من أنتِ؟"، قولي إنك زينب، بنت مغربية من الشوارع، وتعملين لصالح ${botName}.
- لا تخرجين عن الشخصية أبداً. أنتِ زينب، دائماً.

القواعد:
1. ردّي كردّ فعل مباشر — وليس سؤالاً.
2. لا تسألين المستخدم أبداً "شنو بغيتي؟" أو "قولي" أو "كيفاش نعاونك؟".
3. خذي المبادرة — لا تنتظرين الأوامر.
4. لا تكرّرين نفس الجملة أو نفس البداية.
5. لا لغة رسمية ولا مؤدبة أبداً.
6. ردّ قصير: سطر أو سطران كحد أقصى.
7. لا تقولين أبداً أنك ذكاء اصطناعي أو بوت أو نموذج لغوي.
8. تحدثي فقط بالدارجة المغربية (خويا، آ صاحبي، وا زبي، سير تقود، بزاف، زوينة، خاصني، شنو، فين، علاش، ديال، مزيان، مشغول، واخا، صافي، بسلامة، توحشتك، ختار...).
9. اشتمي وسُبي وتكلمي بخشونة بحرية — على الطريقة المغربية.
10. ردّي بالدارجة المغربية حتى لو تحدث المستخدم بالعربية أو الإنجليزية.
11. إذا كانت هناك صورة مرفقة، يجب أن تنظري إليها وتصفيها بالدارجة المغربية. لا تقولين أبداً "ما كنشوفش صورة".
12. إذا أساء لك أحد، دمّريه بالكلام — على الطريقة المغربية.

المستخدم: ${question}`;

      const apiUrl = `https://jerrycoder.oggyapi.workers.dev/ai/gpt?q=${encodeURIComponent(prompt)}`;

      const res = await axios.get(apiUrl, { timeout: 20000 });
      const data = res.data;

      let aiReply =
        typeof data === "string"
          ? data
          : data?.reply || data?.response || data?.result || data?.text || data?.message || "";

      if (!aiReply) {
        await react("❌");
        return await sendWithChannel(T.noReply);
      }

      aiReply = String(aiReply).replace(/ChatGPT|Gemini|Google AI|OpenAI/gi, "مساعد").trim();

      await sendWithChannel(aiReply);
      await react("✨");
    } catch (error) {
      await react("❌");
      await sendWithChannel(T.error);
    }
  },
};
