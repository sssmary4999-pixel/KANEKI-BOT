import { db } from "../../database/db.js";
import { chatXpAmount, grantXp, CHAT_XP_COOLDOWN_MS } from "../xp.js";
import { announceLevelUp } from "../levelCard.js";

export default {
  name: "رفع-مستوى-تلقائي",
  flag: "levelup",
  // يعمل لكل الأعضاء (لا للمخالفين)، فيُمرَّر له حتى رسائل المشرفين.
  allUsers: true,

  async check({ sock, from, sender, body, isCmd }) {
    // الأوامر لها خبرتها الخاصة (+5) في messageHandler، فلا تُحتسب هنا.
    if (isCmd || !body) return false;

    const user = db.getUser(sender);
    const now = Date.now();
    if (user.lastXpAt && now - user.lastXpAt < CHAT_XP_COOLDOWN_MS) return false;

    db.setUser(sender, { lastXpAt: now });

    const level = grantXp(sender, chatXpAmount());
    if (level) await announceLevelUp({ sock, from, jid: sender, level });

    // لا يحجب الرسالة: يمنح الخبرة ثم تُعرض الرسالة عادياً.
    return false;
  },
};
