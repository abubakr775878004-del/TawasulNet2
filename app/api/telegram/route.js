import { NextResponse } from 'next/server';

import {
  sendTelegramMessage,
} from '../../../lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();

    const type = String(
      body?.type || 'distributor_request'
    ).trim();

    // ==========================================
    // إرسال إشعار الفائزين الأسبوعيين
    // ==========================================
    if (type === 'weekly_winner') {
      const message = String(
        body?.content || ''
      ).trim();

      if (!message) {
        return NextResponse.json(
          {
            success: false,
            error: 'محتوى رسالة الفائزين مطلوب',
          },
          { status: 400 }
        );
      }

      const result =
        await sendTelegramMessage(message);

      return NextResponse.json(
        {
          success: true,
          message:
            'تم إرسال الفائزين إلى تيليجرام بنجاح',
          telegramMessageId:
            result.messageId,
        },
        { status: 200 }
      );
    }

    // ==========================================
    // طلب كروت من الموزع
    // ==========================================
    const distributorName = String(
      body?.distributor_name || ''
    ).trim();

    const content = String(
      body?.content || ''
    ).trim();

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

    const message = [
      '🚨 <b>طلب جديد من موزع</b>',
      '',
      `👤 <b>الموزع:</b> ${escapeHtml(
        distributorName
      )}`,
      '',
      '💬 <b>الرسالة:</b>',
      escapeHtml(content),
      '',
      '⚡ <b>نظام إدارة شبكة تواصل</b>',
    ].join('\n');

    const result =
      await sendTelegramMessage(message);

    return NextResponse.json(
      {
        success: true,
        message:
          'تم إرسال الإشعار إلى تيليجرام بنجاح',
        telegramMessageId:
          result.messageId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'Telegram route error:',
      error
    );

    if (error?.name === 'AbortError') {
      return NextResponse.json(
        {
          success: false,
          error:
            'انتهت مهلة الاتصال بخوادم Telegram',
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'حدث خطأ غير معروف',
      },
      { status: 500 }
    );
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
