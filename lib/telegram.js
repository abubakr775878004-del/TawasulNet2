// lib/telegram.js

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendTelegramMessage(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID غير موجود'
    );
  }

  const telegramUrl =
    `https://api.telegram.org/bot${botToken}/sendMessage`;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error('تعذر قراءة استجابة Telegram');
    }

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.description ||
          `Telegram HTTP error ${response.status}`
      );
    }

    return {
      success: true,
      messageId: data?.result?.message_id || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildWeeklyWinnerMessage(winners) {
  const safeWinners = Array.isArray(winners)
    ? winners
    : [];

  const badges = [
    '🥇 <b>المركز الأول:</b>',
    '🥈 <b>المركز الثاني:</b>',
    '🥉 <b>المركز الثالث:</b>',
  ];

  let message =
    '👑 <b>الفائزون بالسحب الأسبوعي</b> 👑\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n';

  safeWinners.slice(0, 3).forEach((winner, index) => {
    const customerName = escapeHtml(
      winner?.customer_name || 'غير محدد'
    );

    const distributorName = escapeHtml(
      winner?.distributor_name || 'غير محدد'
    );

    message += `${badges[index] || '🏆'} ${customerName}\n`;
    message += `🏪 <b>الموزع:</b> ${distributorName}\n\n`;
  });

  message +=
    '━━━━━━━━━━━━━━━━━━━━\n' +
    '🎁 <b>تم اعتماد الفائزين رسميًا</b>\n' +
    '📞 <b>للاستفسار واستلام الجائزة:</b>\n' +
    'يرجى التواصل مع إدارة الشبكة: 775878004\n' +
    '━━━━━━━━━━━━━━━━━━━━\n' +
    '✨ <i>تم السحب والاعتماد عبر منصة تواصل</i>';

  return message;
}
