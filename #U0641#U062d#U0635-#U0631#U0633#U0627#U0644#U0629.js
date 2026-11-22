async function resolverJid(sock, jid) {
    if (!jid) return null
    if (!jid.endsWith('@lid')) {
        return jid.split(':')[0].split('@')[0] + '@s.whatsapp.net'
    }
    try {
        const pn = await sock.signalRepository?.lidMapping?.getPNForLID(jid)
        if (pn) return pn.split(':')[0].split('@')[0] + '@s.whatsapp.net'
    } catch {}
    return jid // no se pudo resolver: se queda como LID (WhatsApp lo muestra con nombre al mencionarlo)
}

export default {
    name: ["فحص-رسالة"],
    description: 'يفحص رابط مجموعة أو مجتمع أو قناة واتساب',
    category: "أدوات",

    async run({ sock, from, msg, text, reply }) {

        const sender = msg.key.participant || msg.key.remoteJid

        let fkontak = {
            "key": {
                "participants": "0@s.whatsapp.net",
                "remoteJid": "status@broadcast",
                "fromMe": false,
                "id": "Halo"
            },
            "message": {
                "contactMessage": {
                    "vcard": `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:y\nitem1.TEL;waid=${sender.split('@')[0]}:${sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            },
            "participant": "0@s.whatsapp.net"
        }

        if (!text) return await reply({ text: ( '```ⓘ أدخل رابط مجموعة أو مجتمع أو قناة.```') })

        const groupUrl = text.match(/(?:https?:\/\/)?(?:chat\.whatsapp\.com\/)([0-9A-Za-z]{22,24})/i)?.[1]
        const channelUrl = text.match(/(?:https?:\/\/)?(?:whatsapp\.com\/channel\/)([0-9A-Za-z@.]+)/i)?.[1]

        let caption = ''
        let mentions = []

        // ─── القناة ───
        if (channelUrl) {
            try {
                const info = await sock.newsletterMetadata("invite", channelUrl).catch(() => null)

                if (!info) {
                    return await reply({ text: ( `❌ لم تُعثر على معلومات القناة. تحقق من صحة الرابط.`) })
                }

                const meta = info.thread_metadata || {}

                const id = info.id || ( 'غير موجود')
                const nombre = meta.name?.text || ( 'بدون اسم')
                const descripcion = meta.description?.text || ( 'بدون وصف')
                const suscriptores = meta.subscribers_count ?? ( 'غير متاح')
                const verificado = meta.verification === 'VERIFIED' ? ( '✅ موثّق') : ( '❌ غير موثّق')

                caption =
( `📢 *معلومات القناة*`) + `

` + ( `🪪 *الاسم:* ${nombre}`) + `
` + ( `🆔 *المعرّف:* ${id}`) + `
` + ( `👥 *المشتركون:* ${suscriptores}`) + `
${verificado}
` + ( `📝 *الوصف:* ${descripcion}`)

            } catch (e) {
                console.error(( 'خطأ في القناة:'), e)
                return await reply({ text: ( `❌ خطأ في جلب معلومات القناة.`) })
            }

        // ─── المجموعة / المجتمع ───
        } else if (groupUrl) {
            try {
                const info = await sock.groupGetInviteInfo(groupUrl).catch(() => null)

                if (!info) {
                    return await reply({ text: ( `❌ لم تُعثر على معلومات. تحقق من صحة الرابط.`) })
                }

                const id = info.id || ( 'غير موجود')
                const nombre = info.subject || ( 'بدون اسم')
                const descripcion = info.desc || ( 'بدون وصف')
                const participantes = info.size ?? info.participants?.length ?? ( 'غير متاح')
                const esComunidad = !!info.isCommunity

                // المنشئ (معالجة LID): يُقدّم ownerPn، وإلا يُحلّ LID
                const creadorJid = await resolverJid(sock, info.ownerPn || info.owner)
                let creador = ( 'غير متاح / غادر المجموعة')
                if (creadorJid) {
                    creador = `@${creadorJid.split('@')[0]}`
                    mentions.push(creadorJid)
                }

                const creacion = info.creation
                    ? new Date(info.creation * 1000).toLocaleDateString('es-ES')
                    : ( 'غير متاح')

                caption =
( esComunidad ? '🏘️ *معلومات المجتمع*' : '👥 *معلومات المجموعة*') + `

` + ( `📛 *الاسم:* ${nombre}`) + `
` + ( `🆔 *المعرّف:* ${id}`) + `
` + ( `👑 *المُنشئ:* ${creador}`) + `
` + ( `👥 *المشاركون:* ${participantes}`) + `
` + ( `📅 *تاريخ الإنشاء:* ${creacion}`) + `
` + ( `📝 *الوصف:* ${descripcion}`)

            } catch (e) {
                console.error(( 'خطأ في المجموعة/المجتمع:'), e)
                return await reply({ text: ( `❌ خطأ في جلب معلومات المجموعة أو المجتمع.`) })
            }

        } else {
            return await reply({ text: ( `❌ لم يُكتشف رابط صالح لمجموعة أو مجتمع أو قناة واتساب.`) })
        }

        await sock.sendMessage(from, {
            text: caption,
            contextInfo: { mentionedJid: mentions }
        }, { quoted: fkontak })
    }
}