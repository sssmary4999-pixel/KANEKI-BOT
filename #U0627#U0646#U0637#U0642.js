import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const CONFIG = {
  provider: 'auto',
  maxChars: 5000,
  ffmpeg: 'ffmpeg',
  fish: {
    baseUrl: 'https://api.fish.audio',
    model: 's2.1-pro-free',
    apiKey:
      (typeof global !== 'undefined' && global.fishAudioKey) ||
      process.env.FISH_API_KEY ||
      'sk-fish-pI0nuo9eVLv4k6zHJrezV8Co6AV7dEV1GTeO1jLYAWo',
    searchUrl: 'https://api.fish.audio/model',
  },
  fakeyou: {
    baseUrl: 'https://api.fakeyou.com',
    storageUrl: 'https://storage.googleapis.com/vocodes-public',
    cookie: global.fakeyouCookie || process.env.FAYEYOU_COOKIE || '',
    pollTries: 80,
    pollDelayMs: 3000,
    modelsCacheFile: path.join(os.tmpdir(), 'fakeyou_models.json'),
    modelsCacheTtlMs: 1000 * 60 * 60 * 24 * 7,
  },
  uberduck: {
    baseUrl: 'https://api.uberduck.ai',
    apiKey: global.uberduckKey || process.env.UBERDUCK_API_KEY || '',
  },
};

if (!CONFIG.fish.apiKey) {
  console.warn('[say] ⚠️ لم يُضبط مفتاح Fish Audio (global.fishAudioKey).');
}

const VOICES = {
  woody: { emoji: '🪵', nombre: { es: 'Pájaro Loco', ar: 'نقار الخشب' }, descripcion: { es: 'El pájaro carpintero más loco.', ar: 'نقار الخشب المجنون.' }, search: ['woody woodpecker'], token: 'weight_n6xthkxaazpd87q6y2vjt8vrz', fish: '5592eec226c6429e8a86a7afd47fb94e' },
  spiderman: { emoji: '🕷️', nombre: { es: 'Spider-Man', ar: 'سبايدرمان' }, descripcion: { es: 'El héroe arácnido.', ar: 'البطل العنكبوتي.' }, search: ['spider-man'], token: 'weight_r5hbbs90mbefs599313rfqqqk', fish: 'c4d42d515a7f4c4da46f002cc6c464b7' },
  pinky: { emoji: '🐭', nombre: { es: 'Pinky', ar: 'بينكي' }, descripcion: { es: 'El ratón alocado.', ar: 'الفأر المجنون.' }, search: ['pinky'], token: 'weight_yvwvprkck7kvb3nfv45fznw2a', fish: '74cfa5fcc99542708cbc1acacc938031' },
  brain: { emoji: '🧠', nombre: { es: 'Cerebro', ar: 'برين' }, descripcion: { es: 'El ratón genio.', ar: 'الفأر العبقري.' }, search: ['brainiac', 'brain'], token: 'weight_f7sps4eqqevd00k5237gjts2p', fish: '1bef6e0fffe745c7bfb72e6cbe1e42a2' },
  batman: { emoji: '🦇', nombre: { es: 'Batman', ar: 'باتمان' }, descripcion: { es: 'El caballero oscuro.', ar: 'الفارس الأسود.' }, search: ['batman'], token: 'weight_x2e6rzdkvx2htfxeqnwea5vpm', fish: 'c324b5bcf31f454088e371370c452741' },
  superman: { emoji: '🦸', nombre: { es: 'Superman', ar: 'سوبرمان' }, descripcion: { es: 'El hombre de acero.', ar: 'رجل الصلب.' }, search: ['superman'], token: 'weight_2mdtv4q4saq17rbxm52bbv4gd', fish: 'b7b73a0b8f91479faaa1260cbb1e88e1' },
  joker: { emoji: '🃏', nombre: { es: 'Joker', ar: 'الجوكر' }, descripcion: { es: 'El príncipe payaso del crimen.', ar: 'أمير الجريمة المهرّج.' }, search: ['joker'], token: 'weight_yzn1qav1qkvwspyg0ahcmnm75', fish: '14aafc1ebce64950bff42a23343b13f8' },
  mickey: { emoji: '🐭', nombre: { es: 'Mickey Mouse', ar: 'ميكي ماوس' }, descripcion: { es: 'El ratón de Disney.', ar: 'فأر ديزني.' }, search: ['mickey mouse'], token: 'weight_7bsgsyfjskbmzj59naw58r1bm', fish: '5eeab11cdbde477387b40b6f730d0fbb' },
  donald: { emoji: '🦆', nombre: { es: 'Donald Duck', ar: 'دونالد داك' }, descripcion: { es: 'El pato gruñón.', ar: 'البطة الغاضبة.' }, search: ['donald duck'], token: 'weight_0z2ppbwncyys079pgdzxx3eyk', fish: 'a486ca175f0d4fc1b3c99b1082e2928b' },
  homer: { emoji: '🍩', nombre: { es: 'Homero Simpson', ar: 'هومر سيمبسون' }, descripcion: { es: 'El papá de Springfield.', ar: 'أب سبرينغفيلد.' }, search: ['homer simpson'], token: 'weight_43ft1wj8xv6cna5vatawt3175', fish: '9e928f1a5d7d40829ea3c50efbf87612' },
  bart: { emoji: '🛹', nombre: { es: 'Bart Simpson', ar: 'بارت سيمبسون' }, descripcion: { es: 'El travieso de Springfield.', ar: 'مشاغب سبرينغفيلد.' }, search: ['bart simpson'], token: 'weight_jmcdwfk7nzmem4a2f5h7bq0y0', fish: '55bef2337e5a4d6888eeac7f4bd01146' },
  scooby: { emoji: '🐶', nombre: { es: 'Scooby Doo', ar: 'سكوبي دو' }, descripcion: { es: 'El perro detective.', ar: 'الكلب المحقق.' }, search: ['scooby doo'], token: 'weight_gmxwzzk5et2p3abt0bfxp2qbm', fish: '31e36fa665eb464cb66cbe416c91f817' },
  pikachu: { emoji: '⚡', nombre: { es: 'Pikachu', ar: 'بيكاتشو' }, descripcion: { es: 'El Pokémon eléctrico.', ar: 'البوكيمون الكهربائي.' }, search: ['pikachu'], token: 'weight_f5kt2erssc85sn5j35r81rt8w', fish: '4449cc9e62894c1a83169fedc1c91729' },
  yoda: { emoji: '👽', nombre: { es: 'Yoda', ar: 'يودا' }, descripcion: { es: 'El maestro Jedi.', ar: 'المعلم الجيداي.' }, search: ['yoda'], token: 'weight_8ye42btvd3ybnc6srbghr2ap2', fish: '8b749799aa984f389bd75da652147e20' },
  vader: { emoji: '🌑', nombre: { es: 'Darth Vader', ar: 'دارث فيدر' }, descripcion: { es: 'El lord Sith.', ar: 'سيد السيث.' }, search: ['darth vader'], token: 'weight_bwjftsw1s89qwywhfb1dv58w1', fish: '0e0f94fba2574fcebe4384834ac9eeaa' },
  spongebob: { emoji: '🧽', nombre: { es: 'Bob Esponja', ar: 'سبونج بوب' }, descripcion: { es: 'La esponja de Fondo de Bikini.', ar: 'إسفنج قاع الهامور.' }, search: ['spongebob'], token: 'weight_6y87xbjmqjxbf49ad880590kw', fish: '0051da373e0a4ac282399909d1d31b69' },
  patrick: { emoji: '⭐', nombre: { es: 'Patricio Estrella', ar: 'باتريك' }, descripcion: { es: 'La estrella de mar.', ar: 'نجم البحر.' }, search: ['patrick star'], token: 'weight_154man2fzg19nrtc15drner7t', fish: 'd1520b60870b4e9aa01eab5bfefb1c45' },
  bugs: { emoji: '🐰', nombre: { es: 'Bugs Bunny', ar: 'بوجز باني' }, descripcion: { es: 'El conejo de la suerte.', ar: 'الأرنب المحظوظ.' }, search: ['bugs bunny'], token: 'weight_hkzaavpmqzh2b3ppyy3p11r6a', fish: '2423cb44f6eb47f5bedda328005a3dcc' },
  daffy: { emoji: '🦆', nombre: { es: 'Daffy Duck', ar: 'دافي داك' }, descripcion: { es: 'El pato celoso.', ar: 'البطة الغيورة.' }, search: ['daffy duck'], token: 'weight_4w6639bep6jxgsj2d9z3tr2zx', fish: '3932774ca4a04d4c9e909f2f1d01ea1c' },
  tweety: { emoji: '🐤', nombre: { es: 'Piolín', ar: 'تويتي' }, descripcion: { es: 'El canario tierno.', ar: 'الكناري اللطيف.' }, search: ['tweety'], token: 'weight_twjpa14wsk2eakbjs0ksrr2mc', fish: '02c1cd6af69f420a9213e2c0bff15a57' },
  marvin: { emoji: '👾', nombre: { es: 'Marvin', ar: 'مارفن المريخي' }, descripcion: { es: 'El marciano.', ar: 'المريخي.' }, search: ['marvin the martian'], token: 'weight_w7f87y6eprqnbbrbhqms5gkx9', fish: '64d10f9e2d7d4144bc72196ff75dbb8f' },
  goofy: { emoji: '🐕', nombre: { es: 'Goofy', ar: 'غوفي' }, descripcion: { es: 'El perro torpe.', ar: 'الكلب الأخرق.' }, search: ['goofy'], token: 'weight_906msf12mp7kpp3ftarzjc12c', fish: '9e6d8d20973d45ecbdca169391f64782' },
  winnie: { emoji: '🍯', nombre: { es: 'Winnie Pooh', ar: 'ويني ذا بوه' }, descripcion: { es: 'El oso de la miel.', ar: 'دبّ العسل.' }, search: ['winnie the pooh'], token: 'weight_9ms7cs66mtxh8zsywghtnd4zx', fish: 'f848b370486d40a0b0989396f4fa42ca' },
  tigger: { emoji: '🐯', nombre: { es: 'Tigger', ar: 'تيغر' }, descripcion: { es: 'El tigre saltarín.', ar: 'النمر القفّاز.' }, search: ['tigger'], token: 'weight_4w6dfpesbkseknjr76z3wx0hx', fish: '49825438830142fbbe3a5b3fa76f5225' },
  buzz: { emoji: '🚀', nombre: { es: 'Buzz Lightyear', ar: 'باز لايتير' }, descripcion: { es: 'El guardián espacial.', ar: 'حارس الفضاء.' }, search: ['buzz lightyear'], token: 'weight_vh6x45f8r3ed99f6svjxnfagd', fish: 'e4e3e4d933534eccb3e0091bf34bc4fe' },
  elsa: { emoji: '❄️', nombre: { es: 'Elsa', ar: 'إلسا' }, descripcion: { es: 'La reina de hielo.', ar: 'ملكة الجليد.' }, search: ['elsa (frozen'], token: 'weight_7gc2da3gscft9mpmjkqfzswj9', fish: '635e41800f09426fad133caf7345da1d' },
  shrek: { emoji: '🧅', nombre: { es: 'Shrek', ar: 'شريك' }, descripcion: { es: 'El ogro bonachón.', ar: 'الغول الطيّب.' }, search: ['shrek (old'], token: 'weight_0m11ggv4byg14mrmdqnkpma9w', fish: 'f6a4e7781ffc4ae09e81ae39c35c8c1c' },
  mario: { emoji: '🍄', nombre: { es: 'Mario', ar: 'ماريو' }, descripcion: { es: 'El fontanero de Nintendo.', ar: 'سبّاك نينتندو.' }, search: ['mario (charles'], token: 'weight_rnbmdcgym2tmqs7b3826c1zkf', fish: 'a564085babeb4d14802ea31b7b6c2869' },
  sonic: { emoji: '💨', nombre: { es: 'Sonic', ar: 'سونيك' }, descripcion: { es: 'El erizo veloz.', ar: 'القنفذ السريع.' }, search: ['sonic the hedgehog (jason'], token: 'weight_rsb4n5rfr5ty0r8mg7nz06rej', fish: 'e1ccd2d156104873a651bd3916951e8a' },
  popeye: { emoji: '💪', nombre: { es: 'Popeye', ar: 'بوباي' }, descripcion: { es: 'El marinero fuerte.', ar: 'البحّار القوي.' }, search: ['popeye'], token: 'weight_pdhq8nwgbhzc6eq3hnp878x4s', fish: '047f8e7a594a40fc9806a6a82428012f' },
  fred: { emoji: '🦴', nombre: { es: 'Pedro Picapiedra', ar: 'فريد فلينتستون' }, descripcion: { es: 'El cavernícola.', ar: 'رجل الكهف.' }, search: ['fred flintstone'], token: 'weight_q7r36k9g7qtyg7hzf4c4xwf6f', fish: 'ff5af5f9674a4192af1d5e425d0788aa' },
  johnny: { emoji: '🕶️', nombre: { es: 'Johnny Bravo', ar: 'جوني برافو' }, descripcion: { es: 'El galán presumido.', ar: 'الوسيم المغرور.' }, search: ['johnny bravo'], token: 'weight_xjh3ns85eqcd13fjp6ecbnan7', fish: '319a2fab6b5a435b9867bd5aba079a67' },
  dexter: { emoji: '🔬', nombre: { es: 'Dexter', ar: 'دكستر' }, descripcion: { es: 'El niño científico.', ar: 'الطفل العالم.' }, search: ['dexter (candi'], token: 'weight_10kt48q8wfx56q5mkkrds2t3e', fish: '5755e8ace6bb4b6bab880001eb5c1172' },
  peter: { emoji: '🍺', nombre: { es: 'Peter Griffin', ar: 'بيتر غريفين' }, descripcion: { es: 'El papá de Quahog.', ar: 'أب كواهوغ.' }, search: ['peter griffin'], token: 'weight_883h5cw4q48cpsmjvjypxs0dc', fish: 'd75c270eaee14c8aa1e9e980cc37cf1b' },
  stewie: { emoji: '👶', nombre: { es: 'Stewie Griffin', ar: 'ستيوي' }, descripcion: { es: 'El bebé genio.', ar: 'الطفل العبقري.' }, search: ['stewie griffin'], token: 'weight_z08y522wjtc4y2q3ydzhdz3ay', fish: 'e91c4f5974f149478a35affe820d02ac' },
  cartman: { emoji: '🧢', nombre: { es: 'Eric Cartman', ar: 'إريك كارتمان' }, descripcion: { es: 'El travieso de South Park.', ar: 'مشاغب ساوث بارك.' }, search: ['eric cartman'], token: 'weight_xxtg78hea5d5zrg1hbyqe81th', fish: 'd6ea6d64c9fb42bea4dd69b0780ffd7f' },
  squidward: { emoji: '🐙', nombre: { es: 'Calamardo', ar: 'سكويدوارد' }, descripcion: { es: 'El vecino gruñón.', ar: 'الجار الغاضب.' }, search: ['squidward'], token: 'weight_y9arhnd7wjamezhqd27ksvmaz', fish: '549dc86f83e44b0fa15f6c0842486178' },
  rick: { emoji: '🧪', nombre: { es: 'Rick Sanchez', ar: 'ريك سانشيز' }, descripcion: { es: 'El científico loco.', ar: 'العالم المجنون.' }, search: ['rick sanchez'], token: 'weight_qfz806d82b0qmxfn3vzgmtyme', fish: 'd2e75a3e3fd6419893057c02a375a113' },
  morty: { emoji: '😰', nombre: { es: 'Morty Smith', ar: 'مورتي' }, descripcion: { es: 'El nieto nervioso.', ar: 'الحفيد القلق.' }, search: ['morty smith'], token: 'weight_e6872yr5gk5zpsar0dhd0ka9b', fish: '3d445d095ba04681bcba7177faedf55a' },
  naruto: { emoji: '🍥', nombre: { es: 'Naruto', ar: 'ناروتو' }, descripcion: { es: 'El ninja de la Hoja.', ar: 'نينجا القرية الورقية.' }, search: ['naruto uzumaki'], token: 'weight_f95vtyq4nq0y0p2nxqgergpcq', fish: 'd34183dcf4a041f5a82aa3dd19644329' },
  goku: { emoji: '🥋', nombre: { es: 'Goku', ar: 'غوكو' }, descripcion: { es: 'El Saiyajin más fuerte.', ar: 'أقوى محارب سايان.' }, search: ['son goku'], token: 'weight_jm7reg55vqn4b5v2cdn9d8w4v', fish: '6c8645b95abb44e0b9095ae3b241e4cc' },
  sailor: { emoji: '🌙', nombre: { es: 'Sailor Moon', ar: 'سيلور مون' }, descripcion: { es: 'La guerrera lunar.', ar: 'المحاربة القمرية.' }, search: ['sailor moon'], token: 'weight_svc8af76318atcs8yr0hdmkpy', fish: '7d8d22e72cdf41009212571f6ed48dfc' },
};

function getVoiceName(v, lang) {
  if (typeof v.nombre === 'string') return v.nombre;
  return v.nombre?.[lang] || v.nombre?.es || v.nombre?.ar || 'Unknown';
}

function getVoiceFullName(v, lang) {
  const emoji = v.emoji || '';
  const name = getVoiceName(v, lang);
  return `${emoji} ${name}`.trim();
}

function getVoiceDesc(v, lang) {
  if (typeof v.descripcion === 'string') return v.descripcion;
  return v.descripcion?.[lang] || v.descripcion?.es || v.descripcion?.ar || '';
}

function getRawText(msg) {
  const m = msg?.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId ||
    ''
  );
}

function extractAfterCommand(rawText, cmdName) {
  const cleaned = String(rawText || '').replace(/^[.\/!#]/, '');
  if (cmdName && cleaned.startsWith(cmdName)) {
    return cleaned.slice(cmdName.length).trim();
  }
  return cleaned.split(/\s+/).slice(1).join(' ').trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = {
  es: {
    mainTitle: '🎙️ Texto a Voz',
    mainText: 'Elegí la forma de mostrar los personajes:',
    btnInteractive: '🎯 Botones',
    btnDropdown: '📋 Desplegable',
    chooseVoice: 'Elegí un personaje para hablar:',
    more: '➕ Más',
    back: '⬅️ Atrás',
    notFound: '❌ Personaje no encontrado.',
    noText: '❌ Primero enviá el texto así:\n\n.انطق tu texto aquí',
    tooLong: (max) => `⚠️ El texto es muy largo.\n\n📏 Máximo: ${max} caracteres`,
    help: '🎙️ Escribe el comando seguido del texto.\n\nEjemplo:\n.انطق el bot fito es el mejor bot',
    error: '❌ No se pudo generar el audio. Probá de nuevo.',
    noMore: '❌ No hay más personajes.',
    searchTitle: '🔎 Resultados de búsqueda',
    searchNone: '❌ Sin resultados.',
    footer: '',
  },
  ar: {
    mainTitle: '🎙️ تحويل النص إلى صوت',
    mainText: 'اختر طريقة عرض الشخصيات:',
    btnInteractive: '🎯 أزرار قابلة للضغط',
    btnDropdown: '📋 أزرار منسدلة',
    chooseVoice: 'اختر شخصية لتتكلّم:',
    more: '➕ المزيد',
    back: '⬅️ رجوع',
    notFound: '❌ الشخصية غير موجودة.',
    noText: '❌ أرسل النص أولاً بهذا الشكل:\n\n.انطق نصك هنا',
    tooLong: (max) => `⚠️ النص طويل جداً.\n\n📏 الحد الأقصى: ${max} حرف`,
    help: '🎙️ اكتب الأمر متبوعاً بالنص.\n\nمثال:\n.انطق بوت فيتو افضل بوت',
    error: '❌ تعذّر توليد صوت الشخصية.',
    noMore: '❌ لا توجد شخصيات إضافية.',
    searchTitle: '🔎 نتائج البحث',
    searchNone: '❌ لا توجد نتائج.',
    footer: '',
  }
};

const textStore = new Map();
const TEXT_TTL_MS = 1000 * 60 * 30;

function saveText(jid, text) {
  textStore.set(jid, { text, at: Date.now() });
}

function getStoredText(jid) {
  const entry = textStore.get(jid);
  if (!entry) return '';
  if (Date.now() - entry.at > TEXT_TTL_MS) {
    textStore.delete(jid);
    return '';
  }
  return entry.text || '';
}

function toImagePayload(img) {
  if (!img) return null;
  if (typeof img === 'string') return { url: img };
  return img;
}

async function sendStoreMessage(sock, from, msg, sender, { title, text, buttons = [], sections = [], footer, lang, image = null }) {
  const imagenRaw = image || global.botImages[Math.floor(Math.random() * global.botImages.length)];
  const imagenFinal = toImagePayload(imagenRaw);
  const canalJid = global.my?.canal1;

  if ((!buttons || buttons.length === 0) && (!sections || sections.length === 0)) {
    const payload = {
      mentions: [sender],
      contextInfo: {
        mentionedJid: [sender],
        forwardedNewsletterMessageInfo: {
          newsletterJid: canalJid,
          serverMessageId: -1,
        },
      }
    };
    if (image) {
      payload.image = imagenFinal;
      payload.caption = text;
    } else {
      payload.text = text;
    }
    return await sock.sendMessage(from, payload, { quoted: msg });
  }

  await sock.sendButtonMessage(from, text, buttons, {
    title: title || '',
    footer: footer || '',
    quoted: msg,
    image: imagenFinal,
    mentions: [sender],
    sections,
    contextInfo: {
      mentionedJid: [sender],
      forwardedNewsletterMessageInfo: {
        newsletterJid: canalJid,
        serverMessageId: -1,
      },
    }
  });
}

let _modelsMem = null;

function fakeyouHeaders(extra = {}) {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json', ...extra };
  if (CONFIG.fakeyou.cookie) h.Cookie = CONFIG.fakeyou.cookie;
  return h;
}

async function getFakeYouModels() {
  if (_modelsMem) return _modelsMem;

  const { modelsCacheFile, modelsCacheTtlMs } = CONFIG.fakeyou;
  try {
    const st = await fs.promises.stat(modelsCacheFile);
    if (Date.now() - st.mtimeMs < modelsCacheTtlMs) {
      const raw = await fs.promises.readFile(modelsCacheFile, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data?.models)) {
        _modelsMem = data.models;
        return _modelsMem;
      }
    }
  } catch { }

  const res = await fetch(`${CONFIG.fakeyou.baseUrl}/tts/list`);
  if (!res.ok) throw new Error(`FakeYou list failed: ${res.status}`);
  const data = await res.json();
  _modelsMem = data.models || [];

  try {
    await fs.promises.writeFile(modelsCacheFile, JSON.stringify({ models: _modelsMem }));
  } catch { }

  return _modelsMem;
}

async function resolveModelToken(voice) {
  const models = await getFakeYouModels();
  const queries = (voice.search || [getVoiceName(voice, 'es')]).map((s) => String(s).toLowerCase());

  for (const q of queries) {
    const hit = models.find((m) => String(m.title || '').toLowerCase() === q);
    if (hit) return hit.model_token;
  }
  for (const q of queries) {
    const hit = models.find((m) => String(m.title || '').toLowerCase().includes(q));
    if (hit) return hit.model_token;
  }
  throw new Error(`No FakeYou model for ${getVoiceName(voice, 'es')}`);
}

async function fakeyouInfer(modelToken, text) {
  const res = await fetch(`${CONFIG.fakeyou.baseUrl}/tts/inference`, {
    method: 'POST',
    headers: fakeyouHeaders(),
    body: JSON.stringify({
      tts_model_token: modelToken,
      uuid_idempotency_token: crypto.randomUUID(),
      inference_text: text,
    }),
  });
  const data = await res.json();
  if (!data?.success) throw new Error('FakeYou inference failed');
  if (data.inference_job_token === 'synthetic_too_many_requests') {
    throw new Error('FakeYou rate limited (too many requests)');
  }
  return data.inference_job_token;
}

async function fakeyouPoll(jobToken) {
  const { pollTries, pollDelayMs, storageUrl } = CONFIG.fakeyou;
  for (let i = 0; i < pollTries; i++) {
    const res = await fetch(`${CONFIG.fakeyou.baseUrl}/tts/job/${jobToken}`, { headers: fakeyouHeaders() });
    const data = await res.json();
    const status = data?.state?.status;
    if (status === 'complete_success') {
      const p = data.state.maybe_public_bucket_wav_audio_path;
      if (!p) throw new Error('FakeYou: no audio path');
      return `${storageUrl}${p}`;
    }
    if (status && String(status).startsWith('complete_failure')) {
      throw new Error('FakeYou generation failed');
    }
    if (status === 'dead') {
      throw new Error('FakeYou job dead');
    }
    await sleep(pollDelayMs);
  }
  throw new Error('FakeYou timeout');
}

async function downloadToFile(url, ext, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const p = path.join(os.tmpdir(), `tts_${crypto.randomUUID()}.${ext}`);
  await fs.promises.writeFile(p, buf);
  return p;
}

function safeUnlink(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch { }
}

async function convertToOpus(inPath) {
  const outPath = inPath.replace(/\.[a-z0-9]+$/i, '') + `_${crypto.randomUUID().slice(0, 8)}.ogg`;
  await execFileAsync(CONFIG.ffmpeg, [
    '-y', '-i', inPath,
    '-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on',
    '-application', 'voip', outPath,
  ]);
  return outPath;
}

async function fakeyouToFile(text, voice) {
  let token = voice.token;
  if (!token) token = await resolveModelToken(voice);

  let jobToken;
  try {
    jobToken = await fakeyouInfer(token, text);
  } catch (e) {
    if (voice.token) {
      const alt = await resolveModelToken({ ...voice, token: null });
      jobToken = await fakeyouInfer(alt, text);
    } else {
      throw e;
    }
  }

  const url = await fakeyouPoll(jobToken);
  return downloadToFile(url, 'wav');
}

async function uberduckToFile(text, voice) {
  const { apiKey, baseUrl } = CONFIG.uberduck;
  if (!apiKey) throw new Error('Uberduck API key missing');
  const res = await fetch(`${baseUrl}/v1/text-to-speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voice.token || 'polly_joanna', model: 'polly_neural' }),
  });
  const data = await res.json();
  if (!data?.audio_url) throw new Error('Uberduck failed');
  return downloadToFile(data.audio_url, 'mp3');
}

async function resolveFishId(voice) {
  const q = String((voice.search && voice.search[0]) || getVoiceName(voice, 'es')).toLowerCase();
  const res = await fetch(`${CONFIG.fish.searchUrl}?title=${encodeURIComponent(q)}&page_size=10`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Fish Audio search ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) throw new Error(`Fish Audio: no model for "${q}"`);
  const exact = items.find((it) => String(it.title || '').toLowerCase().trim() === q);
  return (exact || items[0])._id;
}

async function fishToFile(text, voice) {
  const key = CONFIG.fish.apiKey;
  if (!key) throw new Error('Fish Audio API key missing');
  const refId = voice.fish || (await resolveFishId(voice));
  const res = await fetch(`${CONFIG.fish.baseUrl}/v1/tts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      model: CONFIG.fish.model,
    },
    body: JSON.stringify({ text, reference_id: refId, format: 'mp3' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fish Audio ${res.status}: ${body.slice(0, 140)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('Fish Audio: empty audio');
  const p = path.join(os.tmpdir(), `fish_${crypto.randomUUID()}.mp3`);
  await fs.promises.writeFile(p, buf);
  return p;
}

async function textToSpeech(text, voice) {
  const errors = [];
  const want = CONFIG.provider;

  if ((want === 'auto' || want === 'fish') && CONFIG.fish.apiKey) {
    try {
      return { path: await fishToFile(text, voice), provider: 'fish' };
    } catch (err) {
      errors.push(`fish: ${err?.message || err}`);
    }
  }

  if (want === 'auto' || want === 'fakeyou') {
    try {
      return { path: await fakeyouToFile(text, voice), provider: 'fakeyou' };
    } catch (err) {
      errors.push(`fakeyou: ${err?.message || err}`);
    }
  }

  if (want === 'uberduck') {
    try {
      return { path: await uberduckToFile(text, voice), provider: 'uberduck' };
    } catch (err) {
      errors.push(`uberduck: ${err?.message || err}`);
    }
  }

  throw new Error(errors.join(' | ') || 'TTS failed');
}

async function sendMainMenu(sock, from, msg, sender, lang) {
  const t = T[lang];
  const texto = `${t.mainTitle}\n\n${t.mainText}`;

  await sendStoreMessage(sock, from, msg, sender, {
    title: t.mainTitle,
    text: texto,
    footer: t.footer,
    lang,
    buttons: [
      { text: t.btnInteractive, id: '.انطق-ازرار' },
      { text: t.btnDropdown, id: '.انطق-قائمه' },
    ]
  });
}

async function sendVoicesButtons(sock, from, msg, sender, lang, page = 0) {
  const t = T[lang];
  const entries = Object.entries(VOICES);
  const itemsPerPage = 2;
  const startIndex = page * itemsPerPage;
  const remaining = entries.slice(startIndex);

  if (remaining.length === 0) {
    return await sendStoreMessage(sock, from, msg, sender, {
      text: t.noMore,
      footer: t.footer,
      lang
    });
  }

  const maxOnPage = remaining.length > 3 ? 2 : 3;
  const pageItems = remaining.slice(0, maxOnPage);

  const buttons = pageItems.map(([id, v]) => ({
    text: getVoiceFullName(v, lang),
    id: `.say_${id}`,
  }));

  const remainingAfter = remaining.length - maxOnPage;
  if (remainingAfter > 0) {
    buttons.push({ text: t.more, id: `.انطق-ازرار-المزيد_${page + 1}` });
  } else if (page > 0) {
    buttons.push({ text: t.back, id: `.انطق-ازرار_0` });
  }

  await sendStoreMessage(sock, from, msg, sender, {
    title: t.mainTitle,
    text: t.chooseVoice,
    footer: t.footer,
    lang,
    buttons,
  });
}

async function sendVoicesList(sock, from, msg, sender, lang) {
  const t = T[lang];
  const entries = Object.entries(VOICES);

  const rows = entries.map(([id, v]) => ({
    title: getVoiceFullName(v, lang),
    description: getVoiceDesc(v, lang),
    id: `.say_${id}`,
  }));

  const sections = [];
  for (let i = 0; i < rows.length; i += 10) {
    sections.push({
      title: `${t.mainTitle} (${i + 1}-${Math.min(i + 10, rows.length)})`,
      rows: rows.slice(i, i + 10),
    });
  }

  const texto = `${t.mainTitle}\n\n${t.chooseVoice}`;

  await sendStoreMessage(sock, from, msg, sender, {
    title: t.mainTitle,
    text: texto,
    footer: t.footer,
    lang,
    buttons: [],
    sections,
  });
}

async function generateAndSend(sock, from, msg, sender, lang, voiceId, text) {
  const t = T[lang];
  const v = VOICES[voiceId];

  if (!v) {
    return await sendStoreMessage(sock, from, msg, sender, {
      text: t.notFound,
      footer: t.footer,
      lang
    });
  }

  let srcPath = null;
  let oggPath = null;

  try {
    const { path: audioPath } = await textToSpeech(text, v);
    srcPath = audioPath;

    try {
      oggPath = await convertToOpus(srcPath);
    } catch {
      oggPath = null;
    }

    const canalJid = global.my?.canal1;
    const contextInfo = {
      mentionedJid: [sender],
      forwardedNewsletterMessageInfo: {
        newsletterJid: canalJid,
        serverMessageId: -1,
      },
    };

    const sendPath = oggPath || srcPath;
    const isOgg = !!oggPath;

    await sock.sendMessage(from, {
      audio: fs.readFileSync(sendPath),
      mimetype: isOgg ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
      ptt: isOgg,
      contextInfo,
    }, { quoted: msg });

  } catch (err) {
    console.error('[say] TTS error:', err?.message || err);
    await sendStoreMessage(sock, from, msg, sender, {
      text: t.error,
      footer: t.footer,
      lang
    });
  } finally {
    safeUnlink(srcPath);
    safeUnlink(oggPath);
  }
}

async function searchModels(sock, from, msg, sender, lang, query) {
  const t = T[lang];
  if (!query) {
    return await sendStoreMessage(sock, from, msg, sender, {
      text: `${t.searchTitle}\n\n.انطق-بحث spider-man`,
      footer: t.footer,
      lang
    });
  }

  try {
    const models = await getFakeYouModels();
    const q = query.toLowerCase();
    const hits = models
      .filter((m) => String(m.title || '').toLowerCase().includes(q))
      .slice(0, 10);

    if (hits.length === 0) {
      return await sendStoreMessage(sock, from, msg, sender, {
        text: t.searchNone,
        footer: t.footer,
        lang
      });
    }

    const lines = hits.map((m, i) => `${i + 1}. ${m.title}\n   \`${m.model_token}\``).join('\n');
    return await sendStoreMessage(sock, from, msg, sender, {
      text: `${t.searchTitle}\n\n${lines}`,
      footer: t.footer,
      lang
    });
  } catch (err) {
    console.error('[say] search error:', err?.message || err);
    return await sendStoreMessage(sock, from, msg, sender, {
      text: t.error,
      footer: t.footer,
      lang
    });
  }
}

export default {
  name: [
    'انطق', 'say',
    'انطق-ازرار', 'انطق-قائمه', 'انطق-بحث',
    'say-buttons', 'say-list', 'say-search',
    'انطق-ازرار-المزيد', 
    // ✅ تسجيل جميع أوامر say_<voiceId> تلقائياً
    ...Object.keys(VOICES).map((id) => `say_${id}`),
    // ✅ توليد أرقام الصفحات (من 1 إلى 100) لتجنب خطأ "الأمر غير موجود" عند الضغط على زر المزيد
    ...Array.from({ length: 100 }, (_, i) => `انطق-ازرار-المزيد_${i + 1}`),
  ],
  description: 'Convierte texto a voz con personajes de dibujos animados',
  category: "ذكاء",
  ownerOnly: false,

  async run(ctx) {
    const { sock, from, msg, sender, senderNum, cmdName, react } = ctx;
    const usedName = String(cmdName || '').trim();
    const isArabic = /[\u0600-\u06FF]/.test(usedName);
    const lang = isArabic ? 'ar' : 'es';
    const t = T[lang];
    const senderJid = msg.sender || `${senderNum}@s.whatsapp.net`;

    const rawText = getRawText(msg);
    const provided = (
      ctx.text ||
      ctx.q ||
      (Array.isArray(ctx.args) ? ctx.args.join(' ') : '') ||
      ''
    ).trim();
    const argText = provided || extractAfterCommand(rawText, usedName);

    if (usedName.startsWith('say_')) {
      const voiceId = usedName.replace(/^say_/, '');
      const text = getStoredText(senderJid) || argText;
      if (!text) {
        await react('❓');
        return await sendStoreMessage(sock, from, msg, senderJid, { text: t.noText, footer: t.footer, lang });
      }
      await react('🎙️');
      return await generateAndSend(sock, from, msg, senderJid, lang, voiceId, text);
    }

    if (usedName.startsWith('انطق-ازرار-المزيد_')) {
      const page = parseInt(usedName.replace('انطق-ازرار-المزيد_', '') || '1');
      
      // ✅ البحث في الذاكرة أولاً لحل مشكلة ضياع النص عند الضغط على "المزيد"
      let text = getStoredText(senderJid) || argText;
      
      if (!text) {
        await react('❓');
        return await sendStoreMessage(sock, from, msg, senderJid, { text: t.noText, footer: t.footer, lang });
      }
      
      // إعادة حفظ النص لضمان عدم ضياعه
      saveText(senderJid, text);
      await react('➕');
      return await sendVoicesButtons(sock, from, msg, senderJid, lang, page);
    }

    if (usedName === 'انطق-ازرار' || usedName === 'say-buttons') {
      const text = getStoredText(senderJid) || argText;
      if (!text) {
        await react('❓');
        return await sendStoreMessage(sock, from, msg, senderJid, { text: t.noText, footer: t.footer, lang });
      }
      saveText(senderJid, text);
      await react('🎯');
      return await sendVoicesButtons(sock, from, msg, senderJid, lang, 0);
    }

    if (usedName === 'انطق-قائمه' || usedName === 'say-list') {
      const text = getStoredText(senderJid) || argText;
      if (!text) {
        await react('❓');
        return await sendStoreMessage(sock, from, msg, senderJid, { text: t.noText, footer: t.footer, lang });
      }
      saveText(senderJid, text);
      await react('📋');
      return await sendVoicesList(sock, from, msg, senderJid, lang);
    }

    if (usedName === 'انطق-بحث' || usedName === 'say-search') {
      await react('🔎');
      return await searchModels(sock, from, msg, senderJid, lang, argText);
    }

    if (['انطق', 'say'].includes(usedName)) {
      if (!argText) {
        await react('❓');
        const helpImage = global.botImages[Math.floor(Math.random() * global.botImages.length)];
        return await sendStoreMessage(sock, from, msg, senderJid, {
          text: t.help,
          footer: t.footer,
          lang,
          image: helpImage
        });
      }
      saveText(senderJid, argText);
      await react('🎙️');
      return await sendMainMenu(sock, from, msg, senderJid, lang);
    }

    return await sendStoreMessage(sock, from, msg, senderJid, {
      text: `❌ أمر غير معروف: ${usedName}`,
      footer: t.footer,
      lang
    });
  }
};
