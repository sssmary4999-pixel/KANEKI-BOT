export default { 
  name: ["اعادة"], 
  description: "يعيد تشغيل البوت", 
category : "المالك",
  ownerOnly: true,
  async run({ conn, m, reply }) {

    await reply(( '📍 *جارٍ إعادة تشغيل البوت، انتظر لحظة...*'))
    setTimeout(() => { process.exit(1) }, 1000)
  }
}
