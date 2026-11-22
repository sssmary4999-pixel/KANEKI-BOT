import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["حذف"],
  description: "يحذف رسالة بالردّ عليها",
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,
  botAdmin: true,

  async run({ sock, from, msg, reply }) {

    const quoted = msg.message?.extendedTextMessage?.contextInfo;

    if (!quoted?.stanzaId) {
      return await reply({
        text: ( "『✖️』ردّ على الرسالة التي تريد حذفها.")
      });
    }

    try {
      await sock.sendMessage(from, {
        delete: {
          remoteJid: from,
          id: quoted.stanzaId,
          participant: jidNormalizedUser(quoted.participant),
          fromMe: false
        }
      });
    } catch (e) {
      await reply({
        text: ( `❌ تعذّر الحذف:\n${e.message}`)
      });
    }
  }
}