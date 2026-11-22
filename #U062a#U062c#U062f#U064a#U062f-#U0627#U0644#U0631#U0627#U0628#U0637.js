export default {
  name: ["تجديد-الرابط"],
  description: "يلغي رابط المجموعة الحالي ويولّد رابطاً جديداً",
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ sock, from, reply }) {

    try {
      const code = await sock.groupRevokeInvite(from);
      const link = `https://chat.whatsapp.com/${code}`;

      await reply({
        text: ( `🔄 *تم تجديد رابط المجموعة*\n\nالرابط السابق لم يعد يعمل.\n\n🔗 *الرابط الجديد:*\n${link}`)
      });

    } catch (e) {
      await reply({
        text: ( "❌ لم أستطع تجديد رابط المجموعة.")
      });
    }
  }
};