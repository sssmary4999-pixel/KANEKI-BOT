import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../../../')

export default {
  name: ["فحص"],
  description: 'يتحقق من حالة البوت والمكتبات والإضافات',
  category: "المالك",
  ownerOnly: true,

  async run({ react, reply }) {

    await react('🔍')

    const hora  = new Date().toLocaleTimeString('es-CO', { hour12: false })
    const fecha = new Date().toLocaleDateString('es-CO')

    // ─── 1. المكتبات ────────────────────────────────────
    let libsOk   = []
    let libsFail = []

    try {
      const pkg  = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
      const deps = Object.keys(pkg.dependencies || {})
      for (const dep of deps) {
        try {
          await import(dep)
          libsOk.push(dep)
        } catch {
          libsFail.push(dep)
        }
      }
    } catch (e) {
      libsFail.push(`package.json: ${e.message}`)
    }

    // ─── 2. الإضافات ────────────────────────────────────
    let pluginsOk   = []
    let pluginsFail = []

    const pluginsDir = path.join(root, 'Famiglia', 'plugins')
    if (fs.existsSync(pluginsDir)) {
      const walkDir = async (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) await walkDir(full)
          else if (entry.name.endsWith('.js')) {
            try {
              await execAsync(`node --input-type=module --check < "${full}"`)
              pluginsOk.push(entry.name)
            } catch (e) {
              pluginsFail.push({
                name: entry.name,
                error: e.stderr?.split('\n')[0] || e.message
              })
            }
          }
        }
      }
      try { await walkDir(pluginsDir) } catch {}
    }

    // ─── 3. الأدوات ─────────────────────────────────────
    const tools = ['ffmpeg', 'ffprobe']
    const toolsStatus = {}

    for (const tool of tools) {
      try {
        const { stdout } = await execAsync(`${tool} -version 2>&1`)
        toolsStatus[tool] = { ok: true, version: stdout.split('\n')[0].slice(0, 40) }
      } catch {
        toolsStatus[tool] = { ok: false }
      }
    }

    // Node على حدة
    try {
      const { stdout } = await execAsync(`node --version`)
      toolsStatus['node'] = { ok: true, version: stdout.trim() }
    } catch {
      toolsStatus['node'] = { ok: false }
    }

    const nodeModulesExiste = fs.existsSync(path.join(root, 'node_modules'))

    // ─── الرد ───────────────────────────────────────
    let text = `✨ ═══ 🫧 *BOT VITO V3* 🫧 ═══ ✨\n`
    text += ( `🔍 _التحقق من النظام_\n\n`)

    text += ( `🔧 ─── ❖ *الأدوات* ❖ ─── 🔧\n`)
    for (const [tool, status] of Object.entries(toolsStatus)) {
      text += `  ${status.ok ? '✅' : '❌'} *${tool}*${status.ok ? `: ${status.version}` : ( ': غير موجود')}\n`
    }
    text += `  ${nodeModulesExiste ? '✅' : '❌'} *node_modules*${nodeModulesExiste ? ( ': مثبّت') : ( ': مفقود — npm install')}\n\n`

    text += ( `📦 ─── ❖ *المكتبات* ❖ ─── 📦\n`)
    text += `  ✅ OK: ${libsOk.length}\n`
    if (libsFail.length > 0) {
      text += ( `  ❌ مفقودة:\n`)
      for (const lib of libsFail) text += `    ✦ ${lib}\n`
    } else {
      text += ( `  ✅ كلها مثبّتة بشكل صحيح\n`)
    }
    text += '\n'

    text += ( `🧩 ─── ❖ *الإضافات* ❖ ─── 🧩\n`)
    text += `  ✅ OK: ${pluginsOk.length}\n`
    if (pluginsFail.length > 0) {
      text += ( `  ❌ فيها أخطاء:\n`)
      for (const p of pluginsFail) text += `    ✦ *${p.name}*: ${p.error?.slice(0, 60) || ( 'خطأ غير معروف')}\n`
    } else {
      text += ( `  ✅ كلها بلا أخطاء صياغة\n`)
    }
    text += '\n'

    text += `_${hora} • ${fecha}_\n`
    text += `⚔️ _BOT VITO V3 | Taib_`

    await reply({ text })
  }
}