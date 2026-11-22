import { db } from "../../database/db.js";

export default {
  name: ["طلاق"],
  description: "ينهي زواجك الحالي",
  category: "المعلومات",

  async run(ctx) {

    const { sender, reply } = ctx;

    const partner = db.getMarriage(sender);
    if (!partner) {
      return reply({ text: ( "💔 أنت غير متزوج من أحد.") });
    }

    db.divorce(sender);

    return reply({
      text: ( `💔 @${sender.split("@")[0]} انفصل عن @${partner.split("@")[0]}.\n> كلاكما أحرار للزواج مرة أخرى.`),
      mentions: [sender, partner],
    });
  },
};