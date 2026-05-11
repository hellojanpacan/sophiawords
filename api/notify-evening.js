const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwOnch7in0KD4ktQVGZW-XLhyw2Va8DT2sgqhghpRlxrKkruUDYcrhQlYo9kcAnmNI-/exec';
const NTFY_URL = 'https://ntfy.sh/Sophialingo_aorn54';
const APP_URL = 'https://sophialingo.vercel.app';

const MESSAGES = [
  { title: '¡Todavía hay tiempo, Sophia! 🌙',  message: 'Aún no has practicado hoy — ¡solo 5 minutos!' },
  { title: '¡La noche es joven! 🌙',            message: 'No olvides tus palabras de hoy 📚' },
  { title: 'Último aviso del día 🔔',           message: '¡Practica un poco antes de dormir, Sophia!' },
  { title: '¿Aún no has practicado? 😴',        message: 'Cinco minutitos antes de dormir' },
  { title: 'El día casi termina 🌛',             message: '¡Sophia, tus palabras te necesitan!' },
];

export default async function handler(req, res) {
  // Protect endpoint — only allow Vercel cron calls
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).end();
  }

  // Check if Sophia has already practiced today
  try {
    const statsRes = await fetch(`${APPS_SCRIPT_URL}?action=getStats`);
    const stats = await statsRes.json();
    if (stats.reviewed_today > 0) {
      return res.json({ ok: true, skipped: true, reason: 'already practiced today' });
    }
  } catch {
    // If stats check fails, send the reminder anyway to be safe
  }

  const { title, message } = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  try {
    await fetch(NTFY_URL, {
      method: 'POST',
      headers: {
        'Title': encodeURIComponent(title),
        'Priority': '4',
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
