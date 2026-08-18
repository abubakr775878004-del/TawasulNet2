import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req) {
  try {
    // قراءة البيانات
    const body = await req.json();

    const distributorName = String(body?.distributor_name || '').trim();
    const content = String(body?.content || '').trim();

    // التحقق من البيانات
    if (!distributorName) {
      return NextResponse.json(
        {
          success: false,
          error: 'اسم الموزع مطلوب',
        },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: 'محتوى الرسالة مطلوب',
        },
        { status: 400 }
      );
    }

    // قراءة متغيرات البيئة
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

    if (!botToken || !chatId) {
      console.error('Telegram environment variables are missing');

      return NextResponse.json(
        {
          success: false,
          error: 'إعدادات تيليجرام غير موجودة في Environment Variables',
        },
        { status: 500 }
      );
    }

    // حماية النص من HTML
    const safeDistributorName = escapeHtml(distributorName);
    const safeContent = escapeHtml(content);

    // رسالة تيليجرام
    const message = [
      '🚨 <b>طلب جديد من موزع</b>',
      '',
      `👤 <b>الموزع:</b> ${safeDistributorName}`,
      '',
      `💬 <b>الرسالة:</b>`,
      safeContent,
      '',
      '⚡ <b>نظام إدارة شبكة تواصل</b>',
    ].join('\n');

    const telegramUrl =
      `https://api.telegram.org/bot${botToken}/sendMessage`;

    // مهلة 15 ثانية
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    let response;

    try {
      response = await fetch(telegramUrl, {
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
    } finally {
      clearTimeout(timeout);
    }

    let data;

    try {
      data = await response.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'تعذر قراءة استجابة Telegram',
        },
        { status: 502 }
      );
    }

    // Telegram API أعاد خطأ
    if (!response.ok || !data?.ok) {
      console.error('Telegram API error:', data);

      return NextResponse.json(
        {
          success: false,
          error:
            data?.description ||
            `Telegram HTTP error ${response.status}`,
        },
        { status: 502 }
      );
    }

    // نجاح
    return NextResponse.json(
      {
        success: true,
        message: 'تم إرسال الإشعار إلى تيليجرام بنجاح',
        telegramMessageId: data?.result?.message_id || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Telegram route error:', error);

    if (error?.name === 'AbortError') {
      return NextResponse.json(
        {
          success: false,
          error: 'انتهت مهلة الاتصال بخوادم Telegram',
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'حدث خطأ غير معروف',
      },
      { status: 500 }
    );
  }
}
