import { jidNormalizedUser, isLidUser } from '@whiskeysockets/baileys'

const norm = (j) => (j ? jidNormalizedUser(j) : '')

const identities = (...jids) => {
  const pn = []
  const lid = []
  for (const j of jids.map(norm).filter(Boolean)) (isLidUser(j) ? lid : pn).push(j)
  return { pn, lid }
}

const findParticipant = (participants, { pn, lid }) =>
  (pn.length &&
    participants.find((p) => p.phoneNumber && pn.includes(norm(p.phoneNumber)))) ||
  (lid.length && participants.find((p) => lid.includes(norm(p.id)))) ||
  participants.find((p) => pn.includes(norm(p.id))) ||
  null

const isAdmin = (p) => p?.admin === 'admin' || p?.admin === 'superadmin'

export default {
  name: ["اقفال"],
  description: 'يغلق دردشة المجموعة للمشرفين فقط',
  category: "المجموعات",
  groupOnly: true,

  async run({ sock, from, msg, reply }) {

    const { participants = [] } = await sock.groupMetadata(from)

    const sender = findParticipant(
      participants,
      identities(msg.key.participant, msg.key.participantAlt, msg.participant)
    )
    if (!isAdmin(sender))
      return await reply({ text: ( '❌ مشرفو المجموعة فقط يمكنهم استخدام هذا الأمر.') })

    const bot = findParticipant(participants, identities(sock.user?.id, sock.user?.lid))
    if (!isAdmin(bot))
      return await reply({ text: ( '❌ يحتاج البوت أن يكون مشرفاً لإغلاق المجموعة.') })

    try {
      await sock.groupSettingUpdate(from, 'announcement')
      await reply({
        text: ( '꒰ 𑁍 ꒱ أُغلقت المجموعة.\n> الآن المشرفون فقط يمكنهم إرسال الرسائل!')
      })
    } catch (e) {
      await reply({ text: ( `❌ حدث خطأ أثناء إغلاق المجموعة: ${e.message}`) })
    }
  }
}