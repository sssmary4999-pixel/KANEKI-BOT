import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { log } from "../logger.js";
import { db } from "../../database/db.js";

const BACKGROUND_URL = "https://i.postimg.cc/L5jnccN4/generated-image-(3).png";

const SERIF_BOLD_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
];
function registerFont(paths, family) {
  try {
    for (const p of paths) {
      if (GlobalFonts.registerFromPath(p, family)) return family;
    }
  } catch {}
  return null;
}
const SERIF_BOLD = registerFont(SERIF_BOLD_CANDIDATES, "PosterSerifBold") || "serif";

export async function renderGodfatherCard({ avatar, displayName, isJoin, memberCount }) {
  const bgResponse = await fetch(BACKGROUND_URL);
  const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());
  const background = await loadImage(bgBuffer);

  const canvas = createCanvas(background.width, background.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

  const centerX = canvas.width * 0.65;
  const centerY = canvas.height * 0.55;
  const avatarSize = 220;
  const avatarY = centerY - (avatarSize / 2) - 20;

  if (avatar) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.beginPath();
    ctx.arc(centerX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();

    const side = Math.min(avatar.width, avatar.height);
    const sx = (avatar.width - side) / 2;
    const sy = (avatar.height - side) / 2;
    ctx.drawImage(avatar, sx, sy, side, side, centerX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#b3121f";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const nameY = avatarY + (avatarSize / 2) + 30;
  ctx.font = `bold 40px "${SERIF_BOLD}"`;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 10;

  let finalName = displayName;
  if (finalName.length > 18) finalName = finalName.substring(0, 18) + "...";

  ctx.fillText(finalName, centerX, nameY);

  const statusY = nameY + 55;
  ctx.font = `italic 30px "${SERIF_BOLD}"`;
  if (isJoin) {
    ctx.fillStyle = "#d4af37";
    ctx.fillText("Welcome to the Family", centerX, statusY);
  } else {
    ctx.fillStyle = "#999999";
    ctx.fillText("You broke my heart", centerX, statusY);
  }

  if (Number.isFinite(memberCount)) {
    const membersY = statusY + 60;
    ctx.font = `25px "${SERIF_BOLD}"`;
    ctx.fillStyle = "#e8e4dc";
    ctx.shadowBlur = 5;
    ctx.fillText(`Members: ${memberCount}`, centerX, membersY);
  }

  return canvas.toBuffer("image/png");
}

// ═══════════════════════════════════════════════
// الدوال المساعدة (تم منع طباعة الأرقام)
// ═══════════════════════════════════════════════

function cleanJid(jid = "") {
  const at = jid.lastIndexOf("@");
  if (at === -1) return jid.split(":")[0];
  return `${jid.slice(0, at).split(":")[0]}@${jid.slice(at + 1)}`;
}

export function resolveDisplayName({ sock, jid, pushName, number }) {
  const bare = jid ? cleanJid(jid) : "";
  const contact = sock?.store?.contacts?.[bare] || sock?.store?.contacts?.[jid] || null;
  const fromStore = contact?.name || contact?.notify || contact?.verifiedName || null;
  const stored = db.getPushName?.(number) || null;

  let finalName = pushName || fromStore || stored;

  // ⛔ تم إلغاء طباعة الأرقام نهائياً هنا
  if (!finalName) {
    finalName = "Guest"; // الاسم الافتراضي إذا لم يتوفر اسم حقيقي
  }

  return finalName;
}

async function resolveAvatar(sock, jid) {
  const urls = [];
  try {
    const url = await sock.profilePictureUrl(jid, "image");
    if (url) urls.push(url);
  } catch {}

  if (Array.isArray(global.botImages) && global.botImages.length) {
    const pick = global.botImages[Math.floor(Math.random() * global.botImages.length)];
    if (pick) urls.push(pick);
  }

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return await loadImage(Buffer.from(await res.arrayBuffer()));
    } catch {}
  }
  return null;
}

async function resolveMemberCount(sock, groupJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta?.participants?.length;
  } catch {
    return undefined;
  }
}

function normalizeParticipants(participants) {
  const out = [];
  for (const p of participants || []) {
    if (!p) continue;
    let jid = typeof p === "string" ? p : p.id;
    if (typeof p === "object") {
      jid = p.id || p.jid || p.participant || p.participantAlt || jid;
    }
    if (!jid || typeof jid !== "string") continue;
    const pushName = typeof p === "string" ? null : p.pushName;
    out.push({ jid: cleanJid(jid), pushName });
  }
  return out;
}

// ═══════════════════════════════════════════════
// أوامر البوت
// ═══════════════════════════════════════════════

export default {
  name: "ترحيب-وداع",
  flag: "welcome",

  async onJoin({ sock, groupJid, participants, botLabel }) {
    const memberCount = await resolveMemberCount(sock, groupJid);

    for (const { jid, pushName } of normalizeParticipants(participants)) {
      const number = jid.split("@")[0];
      try {
        db.getUser(jid);
        const avatar = await resolveAvatar(sock, jid);
        const buffer = await renderGodfatherCard({
          avatar,
          displayName: resolveDisplayName({ sock, jid, pushName, number }),
          isJoin: true,
          memberCount,
        });

        await sock.sendMessage(groupJid, {
          image: buffer,
          // تم إبقاء الرقم في المنشن فقط لكي يعمل واتساب، لكنه لا يظهر في الصورة
          caption: `أهلاً بك في العائلة، @${number}`,
          mentions: [jid],
        });
      } catch (e) {
        log.error(`[${botLabel}] الترحيب: ${e.message}`);
        try {
          await sock.sendMessage(groupJid, {
            text: `أهلاً وسهلاً @${number} في المجموعة!`,
            mentions: [jid],
          });
        } catch (inner) {}
      }
    }
  },

  async onLeave({ sock, groupJid, participants, botLabel }) {
    const memberCount = await resolveMemberCount(sock, groupJid);

    for (const { jid, pushName } of normalizeParticipants(participants)) {
      const number = jid.split("@")[0];
      try {
        const avatar = await resolveAvatar(sock, jid);
        const buffer = await renderGodfatherCard({
          avatar,
          displayName: resolveDisplayName({ sock, jid, pushName, number }),
          isJoin: false,
          memberCount,
        });

        await sock.sendMessage(groupJid, {
          image: buffer,
          caption: `وداعاً @${number}`,
          mentions: [jid],
        });
      } catch (e) {
        log.error(`[${botLabel}] الوداع: ${e.message}`);
        try {
          await sock.sendMessage(groupJid, {
            text: `وداعاً @${number}`,
            mentions: [jid],
          });
        } catch (inner) {}
      }
    }
  },
};
