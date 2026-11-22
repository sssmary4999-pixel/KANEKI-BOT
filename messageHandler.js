import config from "./settings.js";
import { log } from "./logger.js";
import { getPlugins } from "./pluginLoader.js";
import { db } from "../database/db.js";
import { runAntifeatures, runAllUsersAntifeatures } from "./مضاد/index.js";
import { handleCommandXp } from "./xp.js";
import { announceLevelUp } from "./levelCard.js";
import { claimOnce, getLiveSock } from "./subbotManager.js";
import { extractButtonId } from "./buttons.js";

const GROUP_TTL = 10 * 60 * 1000;
const groupCache = new Map();
const prefixes = Array.isArray(config.prefix) ? config.prefix : [config.prefix];
const configuredLidCache = new Map();

export function invalidateGroupCache(groupJid) {
  groupCache.delete(groupJid);
}

export function registerGroupCacheEvents(sock) {
  sock.ev.on("group-participants.update", ({ id }) => invalidateGroupCache(id));
  sock.ev.on("groups.update", (updates) => {
    for (const u of updates) if (u?.id) invalidateGroupCache(u.id);
  });
}

/** "123:5@s.whatsapp.net" -> "123@s.whatsapp.net" (يحذف لاحقة الجهاز). */
function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");
  if (atIndex === -1) return jid.split(":")[0];

  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

async function resolveLid(lidJid, groupMeta, sock) {
  if (!lidJid || !lidJid.endsWith("@lid")) return lidJid;

  const match = groupMeta?.participants?.find((p) => cleanJid(p.id || "") === lidJid);
  if (match?.phoneNumber) return cleanJid(match.phoneNumber);

  try {
    const resolved = await sock.signalRepository?.lidMapping?.getPNForLID(lidJid);
    if (resolved) return cleanJid(resolved);
  } catch {}

  return lidJid;
}

async function matchesConfiguredNumber(numberList, senderNum, rawLid, sock) {
  if (numberList.includes(senderNum)) return true;

  if (rawLid && rawLid.endsWith("@lid")) {
    for (const num of numberList) {
      let lid = configuredLidCache.get(num);

      if (lid === undefined) {
        try {
          const resolved = await sock.signalRepository?.lidMapping?.getLIDForPN(`${num}@s.whatsapp.net`);
          lid = resolved ? cleanJid(resolved) : null;
        } catch {
          lid = null;
        }
        configuredLidCache.set(num, lid);
      }

      if (lid && lid === rawLid) return true;
    }
  }

  return false;
}

export async function handleMessage(sock, rawMsg, botLabel = "MAIN", mainBotNum = null, activeBotsLive = []) {
  try {
    // المقبس المُمرَّر قد يكون أُغلق بعد إعادة اتصال؛ استخدم الحيّ لنفس الرقم.
    sock = getLiveSock(sock);
    const msg = rawMsg;
    const from = msg.key?.remoteJid;
    if (!from) return;
    if (from === "status@broadcast") return;

    const isGroup = from.endsWith("@g.us");

    // مجموعات فقط: تُسقَط رسائل الخاص قبل أي قراءة أو تخزين أو معالجة.
    if (config.groupsOnly && !isGroup) return;

    const participantRaw = isGroup ? msg.key?.participant || msg.participant || "" : "";
    const participantReal = isGroup ? msg.key?.participantAlt || "" : "";

    let senderJid;
    if (isGroup) {
      senderJid =
        participantRaw.endsWith("@lid") && participantReal && !participantReal.endsWith("@lid")
          ? participantReal
          : participantRaw;
    } else {
      const remoteAlt = msg.key?.remoteJidAlt || "";
      senderJid = from.endsWith("@lid") && remoteAlt && !remoteAlt.endsWith("@lid") ? remoteAlt : from;
    }

    const senderLidJid = senderJid.endsWith("@lid")
      ? senderJid
      : isGroup
        ? participantRaw
        : from.endsWith("@lid")
          ? from
          : "";

    let sender = cleanJid(senderJid);
    const senderLid = cleanJid(senderLidJid);
    const botJid = cleanJid(sock.user?.id || "");

    let body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.buttonsResponseMessage?.selectedButtonId ||
      msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      msg.message?.templateButtonReplyMessage?.selectedId ||
      // ضغطة التدفّق الأصلي تصل كـparamsJson، لا كنص.
      extractButtonId(msg.message) ||
      "";

    // منشن البوت في مجموعة = طلب لوحة إعدادات البوت (يُعامل كأمر «تفعيل»).
    const mentionedJid =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
      msg.message?.imageMessage?.contextInfo?.mentionedJid ||
      msg.message?.videoMessage?.contextInfo?.mentionedJid ||
      [];
    const botLidJid = cleanJid(sock.user?.lid || "");
    const botMentioned =
      isGroup &&
      mentionedJid.some((j) => {
        const c = cleanJid(j);
        return c === botJid || (!!botLidJid && c === botLidJid);
      });
    // منشن البوت بلا نصّ أمر: يُحوّل إلى «تفعيل» لعرض لوحته.
    if (botMentioned && !prefixes.some((p) => body.startsWith(p))) body = `${prefixes[0]}تفعيل`;

    const msgType = msg.message ? Object.keys(msg.message)[0] ?? "unknown" : "unknown";

    const msgTypeLabel =
      msgType === "conversation" || msgType === "extendedTextMessage" ? "نص" :
      msgType === "imageMessage" ? "🖼️ صورة" :
      msgType === "videoMessage" ? "🎥 فيديو" :
      msgType === "audioMessage" ? "🎵 صوت" :
      msgType === "stickerMessage" ? "🎴 ملصق" :
      msgType === "documentMessage" ? "📄 ملف" :
      msgType === "ptvMessage" ? "📹 ملاحظة فيديو" :
      msgType === "reactionMessage" ? "🔥 تفاعل" :
      msgType === "contactMessage" ? "👤 جهة اتصال" :
      msgType === "locationMessage" ? "📍 موقع" : "أخرى";

    const usedPrefix = prefixes.find((p) => body.startsWith(p)) ?? null;
    const isCmd = !!usedPrefix;
    const fromMe = !!msg.key?.fromMe;

    if (fromMe && !isCmd) return;

    const afterPrefix = isCmd ? body.slice(usedPrefix.length).trimStart() : "";
    const rawCmdName = isCmd ? afterPrefix.split(/\s+/)[0].toLowerCase() : "";
    // الفحوص الداخلية (توجيه البوت الرئيسي، نص المساعدة) تقارن بالاسم
    // القانوني، فيتصرّف الاسم العربي تماماً كالأصل.
    const cmdName = rawCmdName;
    const canonicalName = rawCmdName;
    const args = isCmd ? afterPrefix.slice(rawCmdName.length).trim().split(/\s+/).filter(Boolean) : [];
    const text = args.join(" ");

    const plugins = getPlugins();
    const plugin = isCmd ? plugins.get(cmdName) : null;

    let groupName = "";
    let groupMeta = null;

    if (isGroup) {
      const cached = groupCache.get(from);
      if (cached && cached.exp > Date.now()) {
        groupMeta = cached.meta;
        groupName = groupMeta?.subject || from;
      } else {
        try {
          groupMeta = await sock.groupMetadata(from);
          groupName = groupMeta?.subject || from;
          groupCache.set(from, { meta: groupMeta, exp: Date.now() + GROUP_TTL });
        } catch {
          groupName = from;
        }
      }

      const primaryBot = db.getPrimary(from);
      if (primaryBot && canonicalName !== "delprimary" && canonicalName !== "setprimary") {
        const myId = botJid.split("@")[0];
        if (primaryBot !== myId) return;
      }

      if (isCmd && (plugin?.adminOnly || plugin?.botAdmin)) {
        try {
          groupMeta = await sock.groupMetadata(from);
          groupName = groupMeta?.subject || from;
          groupCache.set(from, { meta: groupMeta, exp: Date.now() + GROUP_TTL });
        } catch {}
      }
    }

    const rawSenderLid = sender.endsWith("@lid") ? sender : senderLid || "";

    if (sender.endsWith("@lid")) sender = await resolveLid(sender, groupMeta, sock);

    if (msg.pushName) db.setPushName(sender, msg.pushName);

    const senderNum = sender.split("@")[0];

    // في رسالة أرسلها البوت نفسه تُحكم الصلاحيات برقم البوت،
    // فلا يكون البوت الفرعي مالكاً إلا إن كان ذلك الرقم مضبوطاً.
    const botNum = botJid.split("@")[0];
    const botLid = cleanJid(sock.user?.lid || "");
    const permNum = fromMe ? botNum : senderNum;
    const permLid = fromMe ? botLid : rawSenderLid;

    const isMainBotSelf = fromMe && !!mainBotNum && botNum === String(mainBotNum);

    const isOwner = isMainBotSelf || (await matchesConfiguredNumber(config.ownerNumber, permNum, permLid, sock));
    const isCoOwner = await matchesConfiguredNumber(config.coOwners, permNum, permLid, sock);
    const isMod = isOwner || isCoOwner || db.hasRole(permNum, "mod");
    const isPremium = isMod || db.hasRole(permNum, "premium");

    let isAdmin = false;
    let isBotAdmin = false;

    if (isGroup && groupMeta?.participants) {
      const botJidClean = cleanJid(botJid);

      let botLidClean = "";
      try {
        const resolvedBotLid = await sock.signalRepository?.lidMapping?.getLIDForPN(botJidClean);
        if (resolvedBotLid) botLidClean = cleanJid(resolvedBotLid);
      } catch {}

      const senderJidClean = cleanJid(sender);

      const matchesParticipant = (p, targetJid, targetLid) => {
        const pId = cleanJid(p.id);
        const pLid = cleanJid(p.lid || "");
        return (
          pId === targetJid ||
          (targetLid && pId === targetLid) ||
          (targetLid && pLid === targetLid) ||
          pLid === targetJid
        );
      };

      const botParticipant = groupMeta.participants.find((p) => matchesParticipant(p, botJidClean, botLidClean));
      const senderParticipant = groupMeta.participants.find((p) => matchesParticipant(p, senderJidClean, senderLid));

      isAdmin = senderParticipant?.admin === "admin" || senderParticipant?.admin === "superadmin";
      isBotAdmin = botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";
    }

    if (isGroup) {
      const groupData = db.getGroup(from);

      // البوت متوقف عن هذه المجموعة من هذا الرقم: يتجاهل كل شيء.
      // الإعداد لكل (رقم + مجموعة)، ورقم البوت نفسه وحده يعيد التشغيل.
      if (!db.getBotGroup(botNum, from).botOn && !fromMe) return;

      if (groupData?.selfMode && !isOwner && !isCoOwner && !fromMe) return;
      if (groupData?.adminMode && !isAdmin && !isMod) return;

      // المضادات تعمل على النص والوسائط معاً: مضاد العرض مرة واحدة يحتاج
      // رسالة بلا نص، فلا يُشترط `body`.
      if (!isAdmin && !isMod && !isCmd) {
        const handled = await runAntifeatures({ sock, msg, from, sender, body, isBotAdmin, isAdmin, isOwner, isMod, botLabel, isCmd });
        if (handled) return;
      }

      // رفع المستوى التلقائي مضاد يعمل لكل الأعضاء بلا استثناء،
      // فيُمرَّر له حتى رسائل المشرفين، ولا يحجب الرسالة.
      await runAllUsersAntifeatures({ sock, msg, from, sender, body, isBotAdmin, isAdmin, isOwner, isMod, botLabel, isCmd });
    }

    // الأوامر تُطبع في نهاية تنفيذها، أما الرسائل العادية فتُطبع فوراً.
    // الشريط يحمل رقم البوت نفسه، وخانة المرسل تعرض رقم المرسل أولاً.
    const boxInfo = {
      groupName,
      userName: msg.pushName || senderNum,
      userNumber: senderNum,
      messageType: msgTypeLabel,
      content: body,
      command: isCmd ? `${usedPrefix}${cmdName}` : "",
      isGroup,
      botLabel,
      botNumber: botNum,
    };

    if (!isCmd) {
      log.message(boxInfo);
      return;
    }

    if (!plugin) {
      if (!claimOnce(`deny:${msg.key.id}`)) return;
      log.message({ ...boxInfo, isCmd: true });
      return await sock.sendMessage(
        from,
        {
          text: `✖️ لا أعرف هذا العمل يا صديقي: "*${usedPrefix}${cmdName}*".\n> اكتب *${usedPrefix}اوامر* لأعرض لك ما أُجيده.`,
        },
        { quoted: msg }
      );
    }

    const ctx = {
      sock, msg, from, sender, senderNum, botJid, botLabel, mainBotNum, activeBotsLive,
      isGroup, groupName, groupMeta, body, isCmd, cmdName, args, text, usedPrefix,
      isOwner, isCoOwner, isMod, isPremium, isAdmin, isBotAdmin, fromMe, botMentioned,
      resolveLid: (lidJid) => resolveLid(lidJid, groupMeta, sock),
      clearGroupCache: () => groupCache.delete(from),
      reply: async (content) => {
        if (typeof content === "string") content = { text: content };
        if (content.text !== undefined) {
          const extra = content.mentions || [];
          content.mentions = [...new Set([sender, ...extra])];
        }
        try {
          return await sock.sendMessage(from, content, { quoted: msg });
        } catch (e1) {
          log.warn(`[${botLabel}] فشل الرد مع الاقتباس (${e1.message})، إعادة بدون اقتباس...`);
          try {
            return await sock.sendMessage(from, content);
          } catch (e2) {
            log.error(`[${botLabel}] فشل الرد بدون اقتباس: ${e2.message} | from: ${from}`);
          }
        }
      },
      react: async (emoji) => {
        try {
          return await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
        } catch (e) {
          log.warn(`[${botLabel}] فشل التفاعل: ${e.message} | from: ${from}`);
        }
      },
    };

    const denyOnce = (text) => {
      if (!claimOnce(`deny:${msg.key.id}`)) return;
      log.message({ ...boxInfo, isCmd: true });
      return ctx.reply({ text });
    };

    if (plugin.ownerOnly && !isOwner) return denyOnce("❌ هذا العمل للدون وحده.");
    if (plugin.modOnly && !isMod) return denyOnce("❌ هذا العمل لعائلة الإشراف فقط.");
    if (plugin.botAdmin && isGroup && !isBotAdmin) return denyOnce("❌ لا أستطيع؛ يجب أن أكون مشرفاً هنا أولاً.");
    if (plugin.adminOnly && isGroup && !isAdmin && !isMod) return denyOnce("❌ هذا العمل لمشرفي المجموعة فقط.");
    if (plugin.premiumOnly && !isPremium) return denyOnce("⭐ هذا العمل لأصحابنا المميزين فقط.");
    if (plugin.groupOnly && !isGroup) return denyOnce("👥 هذا العمل داخل المجموعات فقط.");
    if (plugin.privateOnly && isGroup) return denyOnce("📩 هذا العمل في الخاص فقط.");

    try {
      await plugin.run(ctx);
      log.message({ ...boxInfo, isCmd: true });
      if (isGroup && db.getGroup(from)?.levelup !== false) {
        const level = handleCommandXp(sender);
        if (level) await announceLevelUp({ sock, from, jid: sender, level });
      }
    } catch (e) {
      log.error(`الأمر ${cmdName}: ${e.message}`);
      log.message({ ...boxInfo, isCmd: true });
      await ctx.react("❌");

      if (e.message?.toLowerCase().includes("forbidden")) {
        await ctx.reply({ text: "❌ تعذّر تنفيذ العملية؛ يجب أن أكون مشرفاً في المجموعة." });
      } else {
        await ctx.reply({ text: `❌ تعثّر تنفيذ \`${cmdName}\`:\n${e.message}` });
      }
    }
  } catch (e) {
    log.error(`handleMessage: ${e.message}`);
  }
}
