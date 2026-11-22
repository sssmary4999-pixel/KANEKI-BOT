export default {
  name: ["اعادة-تحميل"],
  description: "يعيد تشغيل جلسة هذا البوت (إعادة اتصال سريعة، ~1-2 ثانية)",
  category: "المالك",
  ownerOnly: true,

  async run({ sock, reply, react, botLabel }) {

    await react("🔄");
    await reply({ text: ( `🔄 جارٍ إعادة تحميل جلسة *${botLabel}*، أعود بعد لحظة...`) });

    try {
      const { clearSocketFiles } = await import("../../Corleone/connection.js");
      if (sock.sessionDir) {
        await clearSocketFiles(sock.sessionDir);
      }
    } catch (e) {
      console.error(( "[reload] خطأ في تنظيف الجلسة:"), e.message);
    }

    setTimeout(() => {
      try {
        sock.end(new Error("Reload manual solicitado"));
      } catch (e) {
        console.error(( "[reload] خطأ في إغلاق الاتصال:"), e.message);
      }
    }, 500);
  },
};