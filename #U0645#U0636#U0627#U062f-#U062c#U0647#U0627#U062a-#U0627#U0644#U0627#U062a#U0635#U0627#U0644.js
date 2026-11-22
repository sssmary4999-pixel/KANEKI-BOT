import { log } from "../logger.js";
import config from "../settings.js";

const numOf = (jid = "") => String(jid).split("@")[0].split(":")[0];

/** هل الرسالة تحمل جهة اتصال (مفردة أو قائمة)؟ */
function hasContact(msg) {
  const m = msg?.message || {};
  return !!(m.contactMessage || m.contactsArrayMessage);
}

/** أرقام المالك/المشاركين، مجرّدة من اللاحقة. */
function ownerNumbers() {
  return [config.ownerNumber, config.coOwners]
    .flat()
    .filter(Boolean)
    .map((n) => numOf(String(n)));
}

export default {
  name: "مضاد-جهات-الاتصال",
  flag: "anticontact",

  // حذف وطرد فوري بلا تحذير، مثل مضاد الروابط.
  async check({ sock, msg, from, sender, isBotAdmin, isAdmin, isOwner, isMod, botLabel }) {
    if (!hasContact(msg)) return false;
    if (!isBotAdmin) return false;

    // استثناءات: البوت نفسه، المالك، مشرف المجموعة، عائلة الإشراف.
    if (numOf(sender) === numOf(sock.user?.id)) return false;
    if (isOwner || isAdmin || isMod) return false;
    if (ownerNumbers().includes(numOf(sender))) return false;

    try {
      await sock.sendMessage(from, {
        delete: { remoteJid: from, id: msg.key.id, participant: sender, fromMe: false },
      });

      await sock.groupParticipantsUpdate(from, [sender], "remove");

      await sock.sendMessage(from, {
        text: `🚫 تم حذف جهة الاتصال وطرد @${numOf(sender)}`,
        mentions: [sender],
      });

      log.cmdExec({ cmdName: "anticontact", sender: numOf(sender), botLabel });
    } catch (e) {
      log.error(`مضاد جهات الاتصال: ${e.message}`);
    }

    return true;
  },
};
