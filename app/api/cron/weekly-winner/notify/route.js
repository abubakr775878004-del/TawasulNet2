import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import {
  buildWeeklyWinnerMessage,
  sendTelegramMessage,
} from '../../../../../lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    console.error('CRON_SECRET غير موجود');
    return false;
  }

  const authorization =
    req.headers.get('authorization') || '';

  return authorization === `Bearer ${secret}`;
}

export async function GET(req) {
  try {
    // ==========================================
    // التحقق من Vercel Cron
    // ==========================================
    if (!isAuthorized(req)) {
      console.error(
        'Weekly winner notification: طلب غير مصرح به'
      );

      return NextResponse.json(
        {
          success: false,
          error: 'غير مصرح',
        },
        { status: 401 }
      );
    }

    // ==========================================
    // بيانات Supabase
    // ==========================================
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        'Weekly winner notification: متغيرات Supabase غير مكتملة'
      );

      return NextResponse.json(
        {
          success: false,
          error:
            'متغيرات Supabase الخاصة بالخادم غير مكتملة',
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // ==========================================
    // استخراج الوقت الحالي بتوقيت اليمن
    // بطريقة آمنة لا تعتمد على Timezone الخادم
    // ==========================================
    const now = new Date();

    const adenParts = new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone: 'Asia/Aden',
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
    ).formatToParts(now);

    const getPart = (type) =>
      adenParts.find(
        (part) => part.type === type
      )?.value;

    const weekday = getPart('weekday');
    const year = getPart('year');
    const month = getPart('month');
    const date = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const second = getPart('second');

    console.log(
      'Weekly winner notification - Aden time:',
      `${year}-${month}-${date} ${hour}:${minute}:${second}`
    );

    // الجمعة فقط
    if (weekday !== 'Fri') {
      console.log(
        'Weekly winner notification: اليوم ليس الجمعة'
      );

      return NextResponse.json(
        {
          success: false,
          message:
            'إشعار الفائزين يعمل يوم الجمعة فقط',
          local_time:
            `${year}-${month}-${date} ${hour}:${minute}:${second}`,
        },
        { status: 400 }
      );
    }

    // ==========================================
    // استخراج تاريخ الجمعة
    // ==========================================
    const weekKey =
      `${year}-${month}-${date}`;

    console.log(
      'Weekly winner notification - week_key:',
      weekKey
    );

    // ==========================================
    // جلب الفائزين المحفوظين
    // ==========================================
    const {
      data: winners,
      error,
    } = await supabase
      .from('weekly_winners')
      .select(`
        id,
        week_key,
        rank,
        card_id,
        customer_name,
        distributor_id,
        distributor_name,
        draw_at,
        expires_at,
        telegram_sent_at
      `)
      .eq('week_key', weekKey)
      .order('rank', {
        ascending: true,
      });

    if (error) {
      console.error(
        'Weekly winners fetch error:',
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          week_key: weekKey,
        },
        { status: 500 }
      );
    }

    console.log(
      'Weekly winner notification - winner count:',
      winners?.length || 0
    );

    // ==========================================
    // يجب أن يكون هناك 3 فائزين بالضبط
    // ==========================================
    if (
      !winners ||
      winners.length !== 3
    ) {
      console.error(
        'Weekly winner notification: لم يتم العثور على 3 فائزين',
        {
          week_key: weekKey,
          winner_count: winners?.length || 0,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            'لم يتم العثور على ثلاثة فائزين محفوظين لهذا الأسبوع',
          week_key: weekKey,
          winner_count:
            winners?.length || 0,
        },
        { status: 409 }
      );
    }

    // ==========================================
    // منع إرسال الرسالة أكثر من مرة
    // ==========================================
    const alreadySent =
      winners.every(
        (winner) =>
          winner.telegram_sent_at !== null
      );

    if (alreadySent) {
      console.log(
        'Weekly winner notification: تم الإرسال مسبقًا',
        {
          week_key: weekKey,
        }
      );

      return NextResponse.json(
        {
          success: true,
          already_sent: true,
          message:
            'تم إرسال الفائزين هذا الأسبوع مسبقاً',
          week_key: weekKey,
        },
        { status: 200 }
      );
    }

    // ==========================================
    // إنشاء رسالة الفائزين
    // ==========================================
    const message =
      buildWeeklyWinnerMessage(
        winners
      );

    console.log(
      'Weekly winner notification: جاري إرسال رسالة Telegram',
      {
        week_key: weekKey,
      }
    );

    // ==========================================
    // إرسال إلى Telegram
    // ==========================================
    const telegramResult =
      await sendTelegramMessage(
        message
      );

    const sentAt =
      new Date().toISOString();

    console.log(
      'Weekly winner notification: تم إرسال Telegram بنجاح',
      {
        week_key: weekKey,
        messageId:
          telegramResult?.messageId || null,
      }
    );

    // ==========================================
    // تسجيل وقت الإرسال
    // ==========================================
    const {
      error: updateError,
    } = await supabase
      .from('weekly_winners')
      .update({
        telegram_sent_at: sentAt,
      })
      .eq('week_key', weekKey);

    if (updateError) {
      console.error(
        'Telegram sent but database update failed:',
        updateError
      );

      return NextResponse.json(
        {
          success: true,
          telegram_sent: true,
          database_updated: false,
          warning:
            'تم إرسال الرسالة ولكن لم يتم تسجيل وقت الإرسال في قاعدة البيانات',
          week_key: weekKey,
          telegramMessageId:
            telegramResult?.messageId || null,
        },
        { status: 200 }
      );
    }

    console.log(
      'Weekly winner notification: تم تسجيل telegram_sent_at بنجاح',
      {
        week_key: weekKey,
      }
    );

    return NextResponse.json(
      {
        success: true,
        telegram_sent: true,
        database_updated: true,
        week_key: weekKey,
        winners,
        telegramMessageId:
          telegramResult?.messageId || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'Weekly winner notification error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'حدث خطأ أثناء إرسال الفائزين',
      },
      { status: 500 }
    );
  }
}
