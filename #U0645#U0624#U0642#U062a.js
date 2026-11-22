const DURATIONS = {
  off: 0,
  "24h": 86400,
  "7d": 604800,
  "90d": 7776000
};

export default {
  name: ["مؤقت"],
  description: "يضبط مدة الرسائل المؤقتة في المجموعة",
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ sock, from, args, reply }) {

    const opcion = args[0]?.toLowerCase();

    if (!DURATIONS.hasOwnProperty(opcion)) {
      return await reply({
        text: ( "『⏳』*الاستخدام:* .مؤقت off/24h/7d/90d\n\n*مثال:* .مؤقت 7d")
      });
    }

    try {
      await sock.groupToggleEphemeral(from, DURATIONS[opcion]);
      await reply({
        text: opcion === "off"
          ? "『⏳』الرسائل المؤقتة: مُوقَفة."
          : `『⏳』الرسائل المؤقتة: مُفعَّلة (${opcion}).`
      });
    } catch (e) {
      await reply({ text: ( `❌ تعذّر التغيير:\n${e.message}`) });
    }
  }
};