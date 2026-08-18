import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { distributor_name, content } = await req.json();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Telegram credentials missing' }, { status: 500 });
    }

    // تصميم الرسالة بشكل جذاب مع شعار وتنسيق خاص بالموزعين
    const message = `🔔 *طلب / ملاحظة جديدة من موزع*\n\n` +
                    `👤 *الموزع:* ${distributor_name}\n` +
                    `💬 *الرسالة:* ${content}\n\n` +
                    `⚡ *نظام إدارة شبكة تواصل*`;

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json({ error: data.description }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
