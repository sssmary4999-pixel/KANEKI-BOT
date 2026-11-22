import { db } from "../../database/db.js";

function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");

  if (atIndex === -1) return jid.split(":")[0];

  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);

  return `${userPart}@${domainPart}`;
}

export default {
  name: ["تحذيرات"],
  description: 'يعرض قائمة تحذيرات المجموعة',
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ sock, from, msg, reply }) {

    try {
      const groupData = db.getGroup(from) || {};
      const currentWarns = groupData.warns || {};

      const users = Object.entries(currentWarns)
        .filter(([_, warns]) => Array.isArray(warns) && warns.length > 0);

      if (users.length === 0) {
        return await reply({
          text: ( `📋 *قائمة التحذيرات*\n\n✅ لا يوجد مستخدمون لديهم تحذيرات نشطة في هذه المجموعة.`)
        });
      }

      let texto = ( `📋 *قائمة التحذيرات*\n`);
      texto += `━━━━━━━━━━━━━━━━━━\n\n`;

      const mentions = [];

      users.forEach(([jid, warns], index) => {
        const cleanJidUser = cleanJid(jid);
        const number = warns[0]?.targetNum || cleanJidUser.split('@')[0];

        mentions.push(cleanJidUser);

        texto += `👤 *${index + 1}. @${number}*\n`;
        texto += ( `📊 *التحذيرات:* ${warns.length}/3\n`);

        warns.forEach((warn, warnIndex) => {
          texto += ( `\n   ⚠️ *تحذير رقم ${warnIndex + 1}*\n`);
          texto += ( `   📝 *السبب:* ${warn.razon || "غير محدد"}\n`);
          texto += ( `   📅 *التاريخ:* ${warn.fecha || "غير معروف"}\n`);
          texto += ( `   👮‍♂️ *بواسطة:* ${warn.by || "غير معروف"}\n`);
        });

        texto += `\n━━━━━━━━━━━━━━━━━━\n\n`;
      });

      texto += ( `👥 *المستخدمون المحذَّرون:* ${users.length}`);

      await sock.sendMessage(
        from,
        {
          text: texto,
          mentions
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error(( "خطأ في أمر listwarn:"), err);

      await reply({
        text: ( "❌ حدث خطأ داخلي أثناء تنفيذ الأمر.")
      });
    }
  }
};