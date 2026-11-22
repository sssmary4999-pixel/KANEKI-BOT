export default {
  name: ["تخفي"],
  description: "يرسل رسالة طويلة يقطعها واتساب بـ«قراءة المزيد» في نفس السطر",
  category: "أدوات",
  ownerOnly: false,

  async run({ reply, text }) {

    if (!text) {
      return await reply({ text: ( "❌ اكتب النص الذي تريد إخفاءه.\n\n*مثال:* .تخفي الجواب هو 42") })
    }

    const partes = text.split("|").map(p => p.trim())
    const visible = partes[0]
    const oculto = partes[1] || partes[0]

    // مسافة صفرية العرض: لا تشغل حيزاً مرئياً ولا تُنشئ سطراً جديداً،
    // فيبقى ( "قراءة المزيد") ملتصقاً بعد النص المرئي مباشرة.
    const relleno = "\u200b".repeat(3000)

    const mensaje = `${visible}${relleno}${oculto}`

    await reply({ text: mensaje })
  }
}