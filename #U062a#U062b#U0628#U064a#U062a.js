import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["تثبيت"],
  description: "يثبّت رسالة بالردّ عليها",
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ sock, from, msg, reply, resolveLid }) {

    const quoted = msg.message?.extendedTextMessage?.contextInfo;

    if (!quoted?.stanzaId) {
      return await reply({
        text: ( "『📌』ردّ على الرسالة التي تريد تثبيتها.")
      });
    }

    const isFromMe = !quoted.participant || quoted.participant === sock.user?.id;
    let participant = quoted.participant;

    if (!isFromMe && participant) {
      participant = await resolveLid(participant);
    }

    const pinKey = {
      remoteJid: from,
      id: quoted.stanzaId,
      participant: isFromMe ? undefined : participant,
      fromMe: isFromMe
    };

    try {
      await sock.sendMessage(from, {
        pin: pinKey,
        type: 1
      });

      await reply({ text: ( "『📌』ثُبّتت الرسالة.") });
    } catch (e) {
      await reply({ text: ( `❌ تعذّر التثبيت:\n${e.message}`) });
    }
  }
};