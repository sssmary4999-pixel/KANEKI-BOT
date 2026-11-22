import { db } from "../../database/db.js";

const pendingProposals = new Map(); // proposerJid -> { targetJid, at }
const PROPOSAL_TTL_MS = 5 * 60 * 1000;

function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");
  if (atIndex === -1) return jid.split(":")[0];
  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

function cleanExpired() {
  const now = Date.now();
  for (const [proposer, data] of pendingProposals) {
    if (now - data.at > PROPOSAL_TTL_MS) pendingProposals.delete(proposer);
  }
}

function labelPorGenero(jid) {
  const genero = (db.getGenero(jid) || "").toLowerCase();
  if (genero === "ذكر") return "زوج";
  if (genero === "أنثى") return "زوجة";
  return "زوج/زوجة";
}

export default {
  name: ["زواج"],
  description: "يعرض الزواج على أحدهم أو يقبله",
  category: "المعلومات",

  async run(ctx) {

    const { sock, msg, from, sender, reply, resolveLid, groupMeta } = ctx;
    cleanExpired();

    const contextInfo = msg?.message?.extendedTextMessage?.contextInfo;

    let targetJid = null;
    if (contextInfo?.mentionedJid?.length > 0) {
      targetJid = contextInfo.mentionedJid[0];
    } else if (contextInfo?.participant) {
      targetJid = contextInfo.participant;
    }

    if (!targetJid) {
      return reply({
        text: ( "💍 يجب أن تذكر شخصاً أو تردّ على رسالته لقبول الزواج أو عرضه.\n> مثال » *.زواج @مستخدم* أو ردّ على رسالته بـ *.زواج*"),
      });
    }

    if (targetJid.endsWith("@lid") || isNaN(targetJid.split("@")[0])) {
      const found = groupMeta?.participants?.find((p) => p.id === targetJid || p.lid === targetJid);
      if (found?.id) targetJid = found.id;
    }

    if (targetJid.endsWith("@lid")) {
      targetJid = await resolveLid(targetJid);
    }

    const target = cleanJid(targetJid);

    if (target === sender) {
      return reply({ text: ( "💀 لا يمكنك الزواج من نفسك.") });
    }

    const senderPartner = db.getMarriage(sender);
    if (senderPartner) {
      return reply({ text: ( `❌ أنت متزوج بالفعل من @${senderPartner.split("@")[0]}.`), mentions: [senderPartner] });
    }

    const targetPartner = db.getMarriage(target);
    if (targetPartner) {
      return reply({ text: ( `❌ هذا الشخص متزوج بالفعل من @${targetPartner.split("@")[0]}.`), mentions: [targetPartner] });
    }

    const reverseProposal = pendingProposals.get(target);
    if (reverseProposal && reverseProposal.targetJid === sender) {
      pendingProposals.delete(target);
      db.marry(sender, target);

      const labelTarget = labelPorGenero(target);
      const labelSender = labelPorGenero(sender);

      const texto = `𓂃 ࣪˖ ⋆.˚ ʚїɞ ⋆ ˚ ༘♡ ⋆｡˚\n¡𝑆𝑒 ℎ𝑎𝑛 𝑐𝑎𝑠𝑎𝑑𝑜! \n𓂃ෆ˚\n\n*ʚଓ ${labelTarget}:*\n *@${target.split("@")[0]} ˃͈◡˂͈*\n\n*ʚଓ ${labelSender}:*\n *@${sender.split("@")[0]} ˃͈◡˂͈*\n\n*𝑑𝑖𝑠𝑓𝑟𝑢𝑡𝑒𝑛 𝑠𝑢 𝑙𝑢𝑛𝑎 𝑑𝑒 𝑚𝑖𝑒𝑙 🍯𖤐⭒๋࣭ ⭑*`;

      return reply({ text: texto, mentions: [sender, target] });
    }

    pendingProposals.set(sender, { targetJid: target, at: Date.now() });

    return reply({
      text: ( `💌 @${sender.split("@")[0]} تقدّم بطلب زواج لـ @${target.split("@")[0]}.\n> @${target.split("@")[0]}، استخدم *.زواج @${sender.split("@")[0]}* (أو ردّ على هذه الرسالة بـ *.زواج*) للقبول (ينتهي خلال 5 دقائق).`),
      mentions: [sender, target],
    });
  },
};