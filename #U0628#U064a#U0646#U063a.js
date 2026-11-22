export default {
  name: ["بينغ"],
  description: "يقيس زمن استجابة البوت",
  category: "أدوات",
  ownerOnly: false,

  async run({ sock, from, msg, reply }) {

    const start = Date.now();

    const sent = await reply({ text: ( "🏓 `pong!`\n> ⏤͟͟͞͞⊱☕︎ *زمن الاستجابة:* جارٍ القياس...") });

    const latencia = Date.now() - start;

    await sock.sendMessage(from, {
      text: `🏓 \`pong!\`\n> ⏤͟͟͞͞⊱☕︎ *زمن الاستجابة:* ${latencia}ms`,
      edit: sent.key
    });
  },
};