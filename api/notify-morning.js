const NTFY_URL = 'https://ntfy.sh/Sophialingo_aorn54';
const APP_URL = 'https://sophialingo.vercel.app';

const MESSAGES = [
  { title: '¡Hora de practicar, Sophia! 🌅',   message: 'Hoy solo necesitas unos minutos 📚' },
  { title: '¡Buenos días, Sophia! 🌞',           message: 'Tus palabras te esperan. ¡Vamos!' },
  { title: '¡Un nuevo día, nuevas palabras! 📖', message: '5 minutos de práctica hacen la diferencia' },
  { title: '¡Sophia, es hora! ⭐',               message: 'Cada palabra aprendida es un paso adelante' },
  { title: '¡Buenos días! ☀️',                  message: '¿Lista para repasar tus palabras de hoy?' },
  { title: '¡Practica un poco hoy! 💪',          message: 'Tu cerebro te lo agradecerá 🧠' },
  { title: 'SophiaLingo te espera 🦜',           message: '¡Unos minutos de repaso y listo!' },
  { title: '¡No olvides tus palabras! 📝',       message: 'Un poco cada día marca la diferencia' },
  { title: '¡Desafíate hoy, Sophia! 🎯',         message: 'A ver cuántas palabras recuerdas hoy' },
  { title: '¡Momento de aprender! 🇪🇸',          message: 'Tu alemán mejora cada día que practicas' },
];

export default async function handler(req, res) {
  // Protect endpoint — only allow Vercel cron calls
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).end();
  }

  const { title, message } = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  try {
    await fetch(NTFY_URL, {
      method: 'POST',
      headers: {
        'Title': encodeURIComponent(title),
        'Priority': '3',
        'Tags': 'es',
        'Click': APP_URL,
        'Actions': `view, Comenzar, ${APP_URL}, clear=true`,
      },
      body: message,
    });
    res.json({ ok: true, title });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
