import config from '../../Corleone/settings.js'

export default {
  name: ["مالك"],
  description: 'يعرض معلومات مالك البوت',
  category: "المعلومات",
  ownerOnly: false,

  async run({ sock, from, msg }) {
    const ownerNum = '967735541558'

    if (!ownerNum) return

    await sock.sendMessage(from, {
      contacts: {
        displayName: 'Taib',
        contacts: [{
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Taib\nTEL;type=CELL;type=VOICE;waid=${ownerNum}:+${ownerNum}\nEND:VCARD`
        }]
      }
    }, { quoted: msg })
  }
}