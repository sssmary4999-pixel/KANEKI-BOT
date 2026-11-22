import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../database/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// خلفية بطاقة المستوى تُحمَّل من ملف محلي (لا رابط خارجي).
const BACKGROUND_PATH = path.join(here, "..", "assets", "level-bg.jpg");

/** يحمّل الخلفية من الملف المحلي. */
async function loadBackground() {
  return loadImage(await readFile(BACKGROUND_PATH));
}

const GOLD_LIGHT = "#f7e7a1";
const GOLD = "#d4af37";
const GOLD_DARK = "#8a6d1f";

// إحداثيات مقيسة بالبكسل من خلفية 1080×607.
const BG_W = 1080;
const BG_H = 607;
const AVATAR = { cx: 230, cy: 385, r: 68 };       // الدائرة الفارغة يسار الإطار
const NAME_Y = 508;                                // أسفل الدائرة
const PANEL = { x: 304, y: 343, w: 361, h: 91 };   // المستطيل الفارغ يمين الإطار

function registerFont(candidates, family) {
  for (const p of candidates) {
    try {
      if (GlobalFonts.registerFromPath(p, family)) return family;
    } catch {}
  }
  return "sans-serif";
}

const FONT_BOLD = registerFont(["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"], "LevelBold");
const FONT_REGULAR = registerFont(["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"], "LevelRegular");

function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD_LIGHT);
  g.addColorStop(0.5, GOLD);
  g.addColorStop(1, GOLD_DARK);
  return g;
}

function cleanJid(jid = "") {
  const at = jid.lastIndexOf("@");
  if (at === -1) return jid.split(":")[0];
  return `${jid.slice(0, at).split(":")[0]}@${jid.slice(at + 1)}`;
}

/** يجلب الصورة الرمزية للعضو، ويعيد null إن تعذّر ذلك. */
export async function resolveAvatar(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(cleanJid(jid), "image");
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/** يقصّ الصورة الرمزية على شكل دائرة داخل الفتحة اليسرى. */
function drawAvatar(ctx, avatar, cx, cy, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  if (avatar) {
    ctx.clip();
    const side = Math.min(avatar.width, avatar.height);
    ctx.drawImage(
      avatar,
      (avatar.width - side) / 2,
      (avatar.height - side) / 2,
      side,
      side,
      cx - radius,
      cy - radius,
      radius * 2,
      radius * 2,
    );
  } else {
    ctx.fillStyle = "rgba(26, 13, 6, 0.92)";
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = goldGradient(ctx, cx - radius, cy - radius, cx + radius, cy + radius);
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
}

/** يكتب اسم المستخدم أسفل الدائرة. */
function drawName(ctx, displayName, cx, y) {
  if (!displayName) return;
  const name = displayName.length > 20 ? `${displayName.slice(0, 20)}…` : displayName;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 32px "${FONT_BOLD}"`;
  ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#f3ead8";
  ctx.fillText(name, cx, y);
  ctx.restore();
}

/** يكتب رقم المستوى بخط ذهبي كبير داخل المستطيل الفارغ يمين الإطار. */
function drawLevel(ctx, level, panel) {
  const cx = panel.x + panel.w / 2;
  const cy = panel.y + panel.h / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 66px "${FONT_BOLD}"`;
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = goldGradient(ctx, panel.x, panel.y, panel.x + panel.w, panel.y + panel.h);
  ctx.fillText(`LVL ${level}`, cx, cy);
  ctx.restore();
}

export async function renderLevelCard({ avatar, displayName, level }) {
  const background = await loadBackground();

  const canvas = createCanvas(BG_W, BG_H);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(background, 0, 0, BG_W, BG_H);

  drawAvatar(ctx, avatar, AVATAR.cx, AVATAR.cy, AVATAR.r);
  drawName(ctx, displayName, AVATAR.cx, NAME_Y);
  drawLevel(ctx, level, PANEL);

  return canvas.toBuffer("image/jpeg", 92);
}

/** يرسل إعلان الترقية: بطاقة مصوّرة (المستوى داخل الصورة)، وإن تعذّر الرسم فنبضة نصّية. */
export async function announceLevelUp({ sock, from, jid, level }) {
  const caption = `⬆️ *ترقية* — @${jid.split("@")[0]}`;
  try {
    const avatar = await resolveAvatar(sock, jid);
    const image = await renderLevelCard({ avatar, displayName: db.getPushName(jid) || null, level });
    await sock.sendMessage(from, { image, caption, mentions: [jid] });
  } catch {
    await sock.sendMessage(from, { text: caption, mentions: [jid] });
  }
}
