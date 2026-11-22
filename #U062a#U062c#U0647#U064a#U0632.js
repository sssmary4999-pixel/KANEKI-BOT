import { db } from "../../database/db.js";
import { ITEMS } from "../../Corleone/gamedata.js";

function getPersonajes(jid) {
  const user = db.getUser(jid);
  return user.personajes || {};
}

export default {
  name: ["تجهيز"],
  description: "يجهّز شخصية بسلاح أو درع",
  category: "الاقتصاد",

  async run({ sender, args, reply, react }) {

    const itemId = args[0]?.toLowerCase();
    const personajeId = args[1]?.toLowerCase();

    if (!itemId || !personajeId) {
      return await reply({
        text: ( `⚠️ *الاستخدام:* .تجهيز <العنصر> <الشخصية>\n\n*مثال:* .تجهيز katana_maldita gojo`)
      });
    }

    const item = ITEMS[itemId];
    if (!item) {
      return await reply({ text: ( "❌ العنصر غير موجود.\n\n> استخدم *.متجر* لعرض العناصر.") });
    }

    const misPersonajes = getPersonajes(sender);
    const personaje = misPersonajes[personajeId];
    if (!personaje) {
      return await reply({ text: ( "❌ ليس لديك هذه الشخصية.\n\n> استخدم *.شخصية* لشرائها.") });
    }

    const eco = db.getEco(sender);
    if (!eco.inventario.includes(itemId)) {
      return await reply({ text: ( "❌ ليس لديك هذا العنصر في حقيبتك.\n\n> استخدم *.شراء* لشرائه.") });
    }

    if (item.restriccion && item.restriccion !== personajeId) {
      return await reply({
        text: ( `🔒 *${item.nombre}* حصري لـ *${item.restriccion}*، لا يمكنك تجهيزه لهذه الشخصية.`)
      });
    }

    personaje[item.tipo] = itemId;
    misPersonajes[personajeId] = personaje;
    db.setUser(sender, { personajes: misPersonajes });

    await react("✅");
    await reply({
      text: ( `✅ جهّزت *${item.nombre}* لشخصيتك.\n\n*الخانة:* ${item.tipo}\n*قوة العنصر:* +${item.poder}`)
    });
  }
};