import { db } from "../../database/db.js";

const VALIDOS = ["ذكر", "أنثى"];

export default {
  name: ["جنسي"],
  description: "يضبط جنسك (ذكر/أنثى) لملفك الشخصي",
  category: "المعلومات",
  ownerOnly: false,

  async run({ sender, text, reply }) {

    const genero = (text || "").trim().toLowerCase();

    if (!VALIDOS.includes(genero)) {
      return await reply({ text: ( `⚠️ يمكنك اختيار *ذكر* أو *أنثى* فقط.\n\n*مثال:* .جنسي ذكر`) });
    }

    db.setGenero(sender, genero);

    return await reply({ text: ( `✅ تم، أنت الآن تُعرّف نفسك كـ: *${genero}*`) });
  }
};