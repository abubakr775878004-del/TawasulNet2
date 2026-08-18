import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { distributor_name, content } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('CRITICAL: Telegram environment variables are missing!');
      return NextResponse.json({ error: 'Telegram credentials missing in environment variables' }, { status: 500 });
    }

    const message = `🚨 *طلب جديد من موزع*\n\n` +
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
      console.error('Telegram Server rejected message:', data);
      return NextResponse.json({ error: data.description || 'Telegram rejection' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Route Catch Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
