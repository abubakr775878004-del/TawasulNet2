import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const BACKUP_TABLES = [
  'profiles',
  'packages',
  'cards',
  'card_requests',
  'sales_log',
  'distributor_notes',
  'payments',
  'distributor_debt_transactions',
  'wallet_topup_requests',
  'wallet_transactions',
  'orders',
  'order_items',
  'invoices',
  'ads',
  'audit_logs',
];

function getRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    const error = new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not configured on the server.'
    );
    error.code = 'MISSING_SUPABASE_URL';
    throw error;
  }

  if (!serviceRoleKey) {
    const error = new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.'
    );
    error.code = 'MISSING_SERVICE_ROLE_KEY';
    throw error;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifyAdmin(request, supabase, requestId) {
  const authorization = request.headers.get('authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'غير مصرح بالوصول.',
          code: 'MISSING_AUTHORIZATION',
          request_id: requestId,
        },
        { status: 401 }
      ),
    };
  }

  const token = authorization.replace('Bearer ', '').trim();

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'رمز المصادقة مفقود.',
          code: 'EMPTY_AUTH_TOKEN',
          request_id: requestId,
        },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    console.error('Backup authentication failed:', {
      request_id: requestId,
      error: userError?.message || 'User not found',
    });

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'جلسة المستخدم غير صالحة أو انتهت.',
          code: 'INVALID_SESSION',
          request_id: requestId,
        },
        { status: 401 }
      ),
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('id, role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Admin profile verification error:', {
      request_id: requestId,
      user_id: user.id,
      error: profileError.message,
      code: profileError.code,
      details: profileError.details,
      hint: profileError.hint,
    });

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'تعذر التحقق من بيانات المدير.',
          code: 'PROFILE_LOOKUP_FAILED',
          request_id: requestId,
        },
        { status: 500 }
      ),
    };
  }

  if (!profile) {
    console.error('Admin profile not found:', {
      request_id: requestId,
      user_id: user.id,
    });

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'لم يتم العثور على ملف المدير في قاعدة البيانات.',
          code: 'ADMIN_PROFILE_NOT_FOUND',
          request_id: requestId,
        },
        { status: 403 }
      ),
    };
  }

  if (profile.role !== 'admin') {
    console.error('Backup permission denied: wrong role.', {
      request_id: requestId,
      user_id: user.id,
      role: profile.role,
      status: profile.status,
    });

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'الحساب الحالي ليس حساب مدير.',
          code: 'NOT_ADMIN',
          request_id: requestId,
        },
        { status: 403 }
      ),
    };
  }

  if (profile.status !== 'active') {
    console.error('Backup permission denied: inactive admin.', {
      request_id: requestId,
      user_id: user.id,
      role: profile.role,
      status: profile.status,
    });

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `حالة حساب المدير الحالية هي: ${profile.status || 'غير محددة'}. يجب أن تكون active.`,
          code: 'ADMIN_NOT_ACTIVE',
          request_id: requestId,
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user,
    profile,
  };
}

export async function GET(request) {
  const requestId = getRequestId();

  try {
    let supabase;

    try {
      supabase = getSupabaseAdmin();
    } catch (envError) {
      console.error('Backup environment configuration error:', {
        request_id: requestId,
        code: envError?.code,
        message: envError?.message,
      });

      return NextResponse.json(
        {
          error: 'إعدادات Supabase الخاصة بالخادم غير مكتملة.',
          code: envError?.code || 'SERVER_CONFIGURATION_ERROR',
          request_id: requestId,
        },
        { status: 500 }
      );
    }

    const auth = await verifyAdmin(
      request,
      supabase,
      requestId
    );

    if (!auth.ok) {
      return auth.response;
    }

    const backup = {
      backup_type: 'tawasul_net_database_data',
      backup_version: 1,
      created_at: new Date().toISOString(),
      created_by: {
        id: auth.user.id,
        email: auth.user.email || null,
      },
      tables: {},
      skipped_tables: [],
    };

    for (const tableName of BACKUP_TABLES) {
      try {
        const {
          data,
          error,
        } = await supabase
          .from(tableName)
          .select('*');

        if (error) {
          console.error(
            `Backup error for table ${tableName}:`,
            {
              request_id: requestId,
              table: tableName,
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
            }
          );

          backup.skipped_tables.push({
            table: tableName,
            reason: error.message || 'Unknown database error',
            code: error.code || null,
          });

          continue;
        }

        backup.tables[tableName] = {
          count: Array.isArray(data) ? data.length : 0,
          rows: Array.isArray(data) ? data : [],
        };
      } catch (tableError) {
        console.error(
          `Unexpected backup error for table ${tableName}:`,
          {
            request_id: requestId,
            table: tableName,
            message: tableError?.message,
            stack: tableError?.stack,
          }
        );

        backup.skipped_tables.push({
          table: tableName,
          reason:
            tableError?.message ||
            'Unexpected error while reading table.',
        });
      }
    }

    const totalRows = Object.values(backup.tables).reduce(
      (total, table) => total + table.count,
      0
    );

    backup.summary = {
      tables_backed_up: Object.keys(backup.tables).length,
      tables_skipped: backup.skipped_tables.length,
      total_rows: totalRows,
    };

    console.log('Database backup completed:', {
      request_id: requestId,
      user_id: auth.user.id,
      tables_backed_up: backup.summary.tables_backed_up,
      tables_skipped: backup.summary.tables_skipped,
      total_rows: backup.summary.total_rows,
    });

    const filename = `tawasul-net-backup-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.json`;

    return new NextResponse(
      JSON.stringify(backup, null, 2),
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/json; charset=utf-8',
          'Content-Disposition':
            `attachment; filename="${filename}"`,
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('Database backup unexpected error:', {
      request_id: requestId,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        error: 'حدث خطأ غير متوقع أثناء إنشاء النسخة الاحتياطية.',
        code: 'BACKUP_UNEXPECTED_ERROR',
        request_id: requestId,
      },
      { status: 500 }
    );
  }
}
