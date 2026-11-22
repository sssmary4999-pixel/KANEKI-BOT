import { db } from "../../database/db.js";

export default {
  name: ["حذف-جنسي"],
  description: "يحذف إعداد الجنس الخاص بك",
  category: "المعلومات",
  ownerOnly: false,

  async run({ sender, reply }) {

    const generoActual = db.getGenero(sender);

    if (!generoActual) {
      return await reply({ text: ( `⚠️ ليس لديك أي جنس معيّن.`) });
    }

    db.setGenero(sender, null);

    return await reply({ text: ( `✅ تم حذف إعداد الجنس الخاص بك.`) });
  }
};