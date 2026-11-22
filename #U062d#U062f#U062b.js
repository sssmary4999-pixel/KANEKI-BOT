const TIMEZONES = {
  cuba: "America/Havana",
  colombia: "America/Bogota",
  mexico: "America/Mexico_City",
  argentina: "America/Argentina/Buenos_Aires",
  chile: "America/Santiago",
  peru: "America/Lima",
  venezuela: "America/Caracas",
  ecuador: "America/Guayaquil",
  bolivia: "America/La_Paz",
  paraguay: "America/Asuncion",
  uruguay: "America/Montevideo",
  panama: "America/Panama",
  "costa rica": "America/Costa_Rica",
  guatemala: "America/Guatemala",
  honduras: "America/Tegucigalpa",
  "el salvador": "America/El_Salvador",
  nicaragua: "America/Managua",
  "republica dominicana": "America/Santo_Domingo",
  españa: "Europe/Madrid",
  usa: "America/New_York",
  "estados unidos": "America/New_York"
};

function getTimeZoneOffsetMinutes(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  const parts = dtf.formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    map.year, map.month - 1, map.day,
    map.hour === "24" ? 0 : map.hour, map.minute, map.second
  );
  return (asUTC - date.getTime()) / 60000;
}

function localTimeToUtc(year, month, day, hour, minute, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMinutes * 60000);
}

export default {
  name: ["حدث"],
  description: "ينشئ حدثاً جماعياً مع تأكيد الحضور",
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ sock, from, text, reply }) {

    if (!text) {
      return await reply({
        text: ( `『📅』*الاستخدام:* .حدث الاسم | الوصف | يوم/شهر/سنة ساعة:دقيقة | البلد\n\n*مثال:*\n.حدث اجتماع | حديث أسبوعي | 20/08/2026 19:00 | كولومبيا\n\n*البلدان المدعومة:*\n${Object.keys(TIMEZONES).join(", ")}\n\n_يمكنك أيضاً تمرير منطقة IANA مباشرة (مثال: America/Bogota)._`)
      });
    }

    const [name, description, dateStr, tzArg] = text.split("|").map((s) => s.trim());

    if (!name || !dateStr) {
      return await reply({
        text: ( "『📅』بيانات ناقصة. استخدم: .حدث الاسم | الوصف | يوم/شهر/سنة ساعة:دقيقة | البلد")
      });
    }

    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!match) {
      return await reply({
        text: ( "『📅』صيغة تاريخ غير صالحة. استخدم DD/MM/AAAA HH:MM")
      });
    }

    const timeZone = tzArg
      ? TIMEZONES[tzArg.toLowerCase()] || tzArg
      : "America/Havana";

    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    } catch {
      return await reply({
        text: ( `『📅』لا أعرف هذه المنطقة الزمنية: "${tzArg}".\n\n*البلدان المدعومة:*\n${Object.keys(TIMEZONES).join(", ")}`)
      });
    }

    const [, day, month, year, hour, minute] = match.map(Number);
    const startDate = localTimeToUtc(year, month, day, hour, minute, timeZone);

    if (isNaN(startDate.getTime()) || startDate.getTime() < Date.now()) {
      return await reply({
        text: ( "『📅』التاريخ غير صالح أو مضى.")
      });
    }

    try {
      await sock.sendMessage(from, {
        event: {
          name,
          description: description || "",
          startDate,
          extraGuestsAllowed: true
        }
      });
    } catch (e) {
      await reply({ text: ( `❌ تعذّر إنشاء الحدث:\n${e.message}`) });
    }
  }
};