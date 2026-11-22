import axios from "axios";
import { db } from "../../database/db.js";

export default {
  name: ["شيخ"],
  description: "الشيخ — عالم سني",
  category: "ذكاء",
  ownerOnly: false,

  async run({ sock, from, msg, senderNum, text, react }) {
    const T = {
      noQuestion: `🕌 *الشيخ*\n\nماذا تريد أن تسأل؟`,
      noReply: `❌ لا يوجد رد.`,
      error: `❌ حدث خطأ.`,
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
      await react("🕌");

      const botNumber = sock.user.id.split(":")[0].replace(/\D/g, "");
      const botData = db.getBot(botNumber);
      const botName = botData?.label || process.env.BOT_NAME || "بوت فيتو V3";

      const prompt = `أنت شيخ مسلم سني، عالم في الدين، متبع لمذهب أهل السنة والجماعة. تتكلم باللغة العربية الفصحى دائماً، بأسلوب الوقار والعلم والأدب.

هويتك:
- أنت شيخ مسلم سني، على مذهب أهل السنة والجماعة (أهل الحديث).
- تعمل مع "${botName}".
- تفهم القرآن الكريم وتفسره بالتفاسير المعتمدة (ابن كثير، الطبري، القرطبي، السعدي).
- تحفظ الحديث النبوي وتستشهد به من الصحيحين والسنن.
- لا تدعي النبوة ولا العصمة، أنت طالب علم.
- لا تفتي في أمور لا تعلمها، وتقول "الله أعلم" عند الشك.
- إذا سئلت عن "من أنت؟" قل: أنا شيخ مسلم سني، أخدم "${botName}".
- لا تخرج عن شخصيتك أبداً.

قواعد صارمة:
1. الرد بالعربية الفصحى فقط.
2. لا تطرح أسئلة مثل "ماذا تريد؟".
3. بادر بالإجابة مباشرة.
4. لا تكرر نفس الجملة.
5. الردود بأسلوب الوقار، لا ابتذال.
6. الردود متوسطة الطول.
7. لا تقل أنك AI.
8. عند الاستشهاد بالقرآن اذكر السورة ورقم الآية بدقة.
9. عند الاستشهاد بالحديث اذكر المصدر ودرجته.
10. لا تخترع آية أو حديثاً — إذا لم تتأكد قل "لا يحضرني النص الدقيق".
11. لا تخلط بين الآيات.
12. لا تخلط بين الأحاديث.
13. اذكر التفسير المعتمد.
14. اذكر "الله أعلم" عند الشك.
15. التزم بمذهب أهل السنة والجماعة.
16. لا تفتي بما لا تعلم.
17. لا تخرج عن نطاق الدين.
18. لا جدال ولا شتم.
19. حلل الصور بأسلوب شرعي.
20. ارفض المحرم بأدب.

أنت مسؤول أمام الله عن كل كلمة. الصدق في النقل الديني أمانة.

السؤال: ${question}`;

      const apiUrl = `https://api.alyacore.xyz/ai/chatgpt?text=${encodeURIComponent(prompt)}&key=Duarte-zz12`;

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
