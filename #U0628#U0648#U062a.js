import axios from "axios";

export default {
  name: ["بوت"],
  description: "تحدّث مع ChatGPT",
  category: "ذكاء",
  ownerOnly: false,

  async run({ sock, from, msg, senderNum, text, reply, react }) {
    const T = {
      noText: `❓ ماذا تريد أن تسأل ChatGPT؟\n\n💡 مثال: .بوت مرحبا، كيف حالك`,
      noResult: `❌ لم أستطع الحصول على رد من ChatGPT، حاول مرة أخرى.`,
      error: `❌ حدث خطأ أثناء الاتصال بـ ChatGPT API.`,
    };

    const senderJid = msg?.sender || `${senderNum}@s.whatsapp.net`;

    const buildContextInfo = () => ({
      mentionedJid: [senderJid],
      isForwarded: true,
      forwardingScore: 1,
      forwardedNewsletterMessageInfo: {
        newsletterJid: global.my?.canal1,
        newsletterName: global.botNames?.[Math.floor(Math.random() * (global.botNames?.length || 1))],
        serverMessageId: -1,
      },
    });

    const sendWithChannel = async (texto) => {
      return await sock.sendMessage(from, {
        text: texto,
        mentions: [senderJid],
        contextInfo: buildContextInfo()
      }, { quoted: msg });
    };

    if (!text) {
      return await sendWithChannel(T.noText);
    }

    try {
      await react("🤖")

      const { data } = await axios.get("https://api.alyacore.xyz/ai/chatgpt", {
        params: {
          text,
          key: "Duarte-zz12"
        }
      })

      if (!data.status || !data.result) {
        await react("❌")
        return await sendWithChannel(T.noResult)
      }

      await sendWithChannel(data.result)
      await react("✅")
    } catch (err) {
      console.error(err)
      await react("❌")
      await sendWithChannel(T.error)
    }
  }
}
