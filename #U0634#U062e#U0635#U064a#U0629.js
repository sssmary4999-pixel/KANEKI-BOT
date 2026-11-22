import { db } from "../../database/db.js";
import { PERSONAJES } from "../../Corleone/gamedata.js";

function getPersonajes(jid) {
  const user = db.getUser(jid);
  return user.personajes || {};
}

export default {
  name: ["شخصية"],
  description: "يشتري شخصية من Jujutsu Kaisen",
  category: "الاقتصاد",

  async run({ sock, from, msg, sender, args, reply, react, usedPrefix }) {

    const personajeId = args[0]?.toLowerCase();

    if (personajeId) {
      const personaje = PERSONAJES[personajeId];
      if (!personaje) {
        return await reply({ text: ( "❌ الشخصية غير موجودة.") });
      }

      const misPersonajes = getPersonajes(sender);
      if (misPersonajes[personajeId]) {
        return await reply({ text: ( `❌ لديك *${personaje.nombre}* بالفعل.`) });
      }

      const eco = db.getEco(sender);
      if (eco.bolsillo < personaje.precio) {
        const faltante = personaje.precio - eco.bolsillo;
        return await reply({
          text:
            ( `❌ ليس لديك شظايا كافية.\n\n`) +
            `*السعر:* ${personaje.precio.toLocaleString()} شظية\n` +
            `*المحفظة:* ${eco.bolsillo.toLocaleString()} شظية\n` +
            `*ينقصك:* ${faltante.toLocaleString()} شظية`
        });
      }

      misPersonajes[personajeId] = { nivel: 1, xp: 0, arma: null, armadura: null };
      db.setEco(sender, { bolsillo: eco.bolsillo - personaje.precio });
      db.setUser(sender, { personajes: misPersonajes });

      await react("✅");
      return await reply({
        text:
          ( `✅ *اشتريت ${personaje.nombre}!*\n\n`) +
          `*المبلغ المدفوع:* ${personaje.precio.toLocaleString()} شظية\n` +
          `*المتبقي في المحفظة:* ${(eco.bolsillo - personaje.precio).toLocaleString()} شظية\n\n` +
          ( `> استخدم *.تجهيز <عنصر> ${personajeId}* لتجهيزه`)
      });
    }

    // لا يملك nextgen منشئ أزرار/دوّامات، لذا يُرسل الكتالوج كنص.
    try {
      let lista = "⚔️ *الشخصيات المتاحة للشراء*\n\n";
      for (const [id, p] of Object.entries(PERSONAJES)) {
        lista += `▸ *${p.nombre}*\n`;
        lista += `   الجيل: ${p.generacion}\n`;
        lista += `   السعر: ${p.precio.toLocaleString()} قطعة\n`;
        lista += `   للشراء: ${usedPrefix}buychar ${id}\n\n`;
      }
      await reply({ text: lista });
    } catch (e) {
      await reply({ text: `❌ خطأ في عرض القائمة:\n${e.message}` });
    }
  },
};