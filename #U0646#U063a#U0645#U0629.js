import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";

const execAsync = promisify(exec);

const SAMPLE_RATE = 44100;
const DURACION_DEFAULT = 5;
const FRECUENCIA_MIN = 20;
const FRECUENCIA_MAX = 20000;

export default {
  name: ["نغمة"],
  description: "يولّد نغمة نقية بتردد (هرتز) محدد",
  category: "المالك",
  ownerOnly: true,

  async run({ sock, from, msg, text, reply, react }) {

    let wavPath, oggPath;

    try {
      if (!text.trim()) {
        return reply({
          text: ( "⛧ اكتب التردد بالهرتز، مثال: !tono 400\n⛧ يمكنك أيضاً تحديد المدة: !tono 400 8"),
        });
      }

      const partes = text.trim().split(/\s+/);
      const frecuencia = Number(partes[0]);
      const duracion = partes[1] ? Number(partes[1]) : DURACION_DEFAULT;

      if (isNaN(frecuencia) || frecuencia < FRECUENCIA_MIN || frecuencia > FRECUENCIA_MAX) {
        return reply({
          text: ( `⛧ تردد غير صالح، استخدم قيمة بين ${FRECUENCIA_MIN} و${FRECUENCIA_MAX} هرتز`),
        });
      }

      if (isNaN(duracion) || duracion <= 0 || duracion > 30) {
        return reply({
          text: ( "⛧ مدة غير صالحة، استخدم قيمة بين 1 و30 ثانية"),
        });
      }

      await react("🎵");

      const buffer = generarTonoWav(frecuencia, duracion);

      const tmpDir = os.tmpdir();
      const id = Date.now();
      wavPath = path.join(tmpDir, `tono_${id}.wav`);
      oggPath = path.join(tmpDir, `tono_${id}.ogg`);

      await fs.writeFile(wavPath, buffer);

      await execAsync(
        `ffmpeg -y -i "${wavPath}" -c:a libopus -b:a 96k -vbr on -application audio "${oggPath}"`
      );

      const oggBuffer = await fs.readFile(oggPath);

      await sock.sendMessage(
        from,
        {
          audio: oggBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: false,
        },
        { quoted: msg }
      );

      await react("✅");

    } catch (e) {
      console.error(e);

      await react("❌");

      await reply({
        text: `⛧ ${e.message}`,
      });
    } finally {
      if (wavPath) await fs.unlink(wavPath).catch(() => {});
      if (oggPath) await fs.unlink(oggPath).catch(() => {});
    }
  },
};

function generarTonoWav(frecuencia, duracionSegundos = 5, sampleRate = SAMPLE_RATE, volumen = 0.5) {
  const numMuestras = Math.floor(sampleRate * duracionSegundos);
  const bytesPorMuestra = 2;
  const dataSize = numMuestras * bytesPorMuestra;

  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPorMuestra, 28);
  buffer.writeUInt16LE(bytesPorMuestra, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const amplitud = Math.floor(32767 * volumen);
  const fadeMuestras = Math.min(500, Math.floor(numMuestras / 10));

  for (let i = 0; i < numMuestras; i++) {
    const t = i / sampleRate;
    let muestra = Math.sin(2 * Math.PI * frecuencia * t) * amplitud;

    if (i < fadeMuestras) {
      muestra *= i / fadeMuestras;
    } else if (i > numMuestras - fadeMuestras) {
      muestra *= (numMuestras - i) / fadeMuestras;
    }

    buffer.writeInt16LE(Math.floor(muestra), 44 + i * bytesPorMuestra);
  }

  return buffer;
}