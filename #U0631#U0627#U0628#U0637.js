export default {
  name: ["رابط"],
  description: "يحصل على رابط المجموعة",
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ sock, from, reply }) {

    try {
      const code = await sock.groupInviteCode(from);
      const link = `https://chat.whatsapp.com/${code}`;

      await reply({
        text: ( `🔗 *رابط المجموعة:*\n${link}`)
      });

    } catch (e) {
      await reply({
        text: ( "❌ لم أستطع الحصول على رابط المجموعة.")
      });
    }
  }
};