import { requestSubbotCode, activeBots } from "../../Corleone/subbotManager.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

const cooldowns = new Map();

export default {
  name: ["كود"],
  description: "يربط رقمك كبوت فرعي",
  category: "البوتات الفرعية",
  ownerOnly: false,

  async run({ sock, from, sender, react, reply, msg, resolveLid, args }) {

    await react("🔑");

    let resolved = jidNormalizedUser(sender);

    if (resolved.endsWith("@lid")) {
      resolved = await resolveLid(resolved);
    }

    let phone = resolved.endsWith("@lid") ? "" : resolved.split("@")[0].replace(/\D/g, "");

    // خيار احتياطي يدوي: إن تعذّر الكشف التلقائي (اسم مستخدم بلا جهة اتصال)،
    // يمكن للمستخدم تمرير رقمه مباشرة: .code 5215512345678
    if (!phone && args?.[0]) {
      const manual = args[0].replace(/\D/g, "");
      if (manual.length >= 8) phone = manual;
    }

    if (!phone || phone.length < 8) {
      return await reply({
        text:
          ( `⚠️ لم أستطع اكتشاف رقمك تلقائياً (يحدث إذا كان لديك *اسم مستخدم* في واتساب ولست في جهات اتصالي).\n\n`) +
          ( `اكتب رقمك مع رمز الدولة هكذا: *.كود 5215512345678*`)
      });
    }

    const id = `sub_${phone}`;

    if (activeBots.has(id) && activeBots.get(id).status === "online") {
      return await reply({
        text: ( `⚠️ رقمك مرتبط بالفعل كبوت فرعي.\nاستخدم *.حذف-بوت* لفصله.`)
      });
    }

    if (cooldowns.has(phone)) {
      const diff = Date.now() - cooldowns.get(phone);
      const restante = Math.ceil((60000 - diff) / 1000);
      if (diff < 60000) {
        return await reply({
          text: ( `🌾 طلبت كوداً مؤخراً.\nانتظر *${restante} ثانية* قبل طلب آخر.`)
        });
      }
    }

    cooldowns.set(phone, Date.now());

    await reply({
      text:
        ( `⚔️ *ربط البوت الفرعي*\n\n`) +
        `📋 *Instrucciones:*\n` +
        ( ` ✦ افتح واتساب على هاتفك\n`) +
        ` ✦ Ve a *Dispositivos vinculados*\n` +
        ` ✦ Toca *Vincular dispositivo*\n` +
        ( ` ✦ اضغط *الربط برقم الهاتف*\n`) +
        ( ` ✦ أدخل الكود الذي سيصلك الآن\n`) +
        ( ` ✦ لديك *60 ثانية* قبل انتهاء صلاحيته\n\n`) +
        `⏳ _Generando código..._`
    });

    try {
      const code = await requestSubbotCode(id, phone, sock, from);
      await sock.sendMessage(from, { text: `${code}` }, { quoted: msg });
      await react("✅");
    } catch (e) {
      cooldowns.delete(phone);
      await react("❌");
      await reply({ text: ( `❌ خطأ في توليد الكود:\n${e.message}`) });
    }
  }
};