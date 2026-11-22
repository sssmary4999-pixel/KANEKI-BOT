// عدّاد تحذيرات لمضادات المجموعات: لكل (مضاد + مجموعة + عضو) في الذاكرة.
// كل مضاد يمنح MAX_WARNINGS تحذيرات مستقلة (يحذف الرسالة في كل مرة)، ثم يطرد في المخالفة التالية.
export const MAX_WARNINGS = 3;

const strikes = new Map();
const MAX_KEYS = 2000;

const keyOf = (scope, groupJid, userJid) => `${scope}:${groupJid}:${userJid}`;

/** يزيد عدّاد العضو في نطاق المضاد ويعيد العدد الجديد. */
export function addWarning(scope, groupJid, userJid) {
  const key = keyOf(scope, groupJid, userJid);
  const count = (strikes.get(key) || 0) + 1;
  strikes.set(key, count);
  if (strikes.size > MAX_KEYS) strikes.delete(strikes.keys().next().value);
  return count;
}

/** يصفّر عدّاد العضو في نطاق المضاد (يُستدعى بعد الطرد). */
export function clearWarnings(scope, groupJid, userJid) {
  strikes.delete(keyOf(scope, groupJid, userJid));
}
