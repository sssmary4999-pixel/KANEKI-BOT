export const PERSONAJES = {
  yuji:   { nombre: "يوجي إيتادوري",   generacion: "الجيل الجديد", precio: 120000, imagen: "https://cdn.dix.lat/me/0hdc_20260829-c91x-jdo5-fe64.jpg" },
  megumi: { nombre: "ميغومي فوشيغورو", generacion: "الجيل الجديد", precio: 135000, imagen: "https://cdn.dix.lat/me/f6ww_20260829-c91x-faxf-c0e1.jpg" },
  vito:   { nombre: "فيتو كورليوني",    generacion: "الجيل الجديد", precio: 150000, imagen: "https://cdn.dix.lat/me/icq7_20260829-c91x-u7r7-bb6c.jpg" },
  nanami: { nombre: "كينتو نانامي",    generacion: "الجيل القديم", precio: 300000, imagen: "https://cdn.dix.lat/me/pfbr_20260829-c91x-8bxq-79ce.jpg" },
  geto:   { nombre: "سوغورو غيتو",     generacion: "الجيل القديم", precio: 450000, imagen: "https://cdn.dix.lat/me/qmxi_20260829-c91x-p4p0-8c6b.jpg" },
  gojo:   { nombre: "ساتورو غوجو",     generacion: "الجيل القديم", precio: 700000, imagen: "https://cdn.dix.lat/me/czoi_20260829-c91x-k5en-fddf.jpg" },
};

export const ITEMS = {
  pala: { nombre: "🪏 مجرفة", precio: 500, poder: 10, tipo: "سلاح" },
  pico: { nombre: "⛏️ فأس", precio: 1200, poder: 25, tipo: "سلاح" },
  guantelete_maldito: { nombre: "🥊 قفاز ملعون", precio: 2200, poder: 45, tipo: "سلاح" },
  amuleto_protector: { nombre: "📿 تميمة حماية", precio: 2800, poder: 55, tipo: "درع" },
  katana_maldita: { nombre: "🗡️ كاتانا ملعونة", precio: 3000, poder: 70, tipo: "سلاح" },
  armadura_reforzada: { nombre: "🛡️ درع مقوّى", precio: 4500, poder: 95, tipo: "درع" },
  cristal_dominio: { nombre: "💎 بلورة السيطرة", precio: 8000, poder: 150, tipo: "درع" },
  manto_hechicero: { nombre: "🧥 عباءة ساحر درجة أولى", precio: 12000, poder: 220, tipo: "درع" },

  cuchillos_yuji: { nombre: "🔪 سكاكين سوكونا الملعونة", precio: 25000, poder: 300, tipo: "سلاح", restriccion: "yuji" },
  perro_divino: { nombre: "🐺 الكلاب الإلهية (شيكيغامي)", precio: 28000, poder: 320, tipo: "سلاح", restriccion: "megumi" },
  rika_espada: { nombre: "⚔️ ريكا - سيف ملك اللعنات", precio: 35000, poder: 400, tipo: "سلاح", restriccion: "vito" },
  overtime_nanami: { nombre: "⏱️ تقنية النسبة - ساعات إضافية", precio: 60000, poder: 550, tipo: "سلاح", restriccion: "nanami" },
  utero_maldito: { nombre: "🩸 الرحم الملعون - الجثث", precio: 90000, poder: 700, tipo: "سلاح", restriccion: "geto" },
  infinito_gojo: { nombre: "♾️ اللانهاية اللامحدودة", precio: 150000, poder: 1000, tipo: "درع", restriccion: "gojo" },
};

export function xpParaNivel(nivel) {
  return nivel * 500;
}

export function calcularPoder(personaje) {
  const nivelPoder = personaje.nivel * 20;
  const armaPoder = personaje.arma ? (ITEMS[personaje.arma]?.poder || 0) : 0;
  const armaduraPoder = personaje.armadura ? (ITEMS[personaje.armadura]?.poder || 0) : 0;
  return nivelPoder + armaPoder + armaduraPoder;
}
