import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '../../../../../lib/server/adminAuth';

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

export async function GET(request) {
  const requestId = getRequestId();

  try {
    /*
     * حماية مركزية:
     * - تتأكد من وجود Bearer token
     * - تتحقق من جلسة المستخدم عبر Supabase Auth
     * - تتأكد أن المستخدم موجود في profiles
     * - تتأكد أن role = admin
     * - تتأكد أن status = active
     * - تستخدم Service Role فقط داخل الخادم
     */
    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { adminClient, user, adminProfile } = auth;

    const backup = {
      backup_type: 'tawasul_net_database_data',
      backup_version: 1,
      created_at: new Date().toISOString(),

      created_by: {
        id: user.id,
        email: user.email || null,
        full_name: adminProfile?.full_name || null,
      },

      tables: {},
      skipped_tables: [],
    };

    for (const tableName of BACKUP_TABLES) {
      try {
        const {
          data,
          error,
        } = await adminClient
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
      user_id: user.id,
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

          'X-Request-ID': requestId,
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
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-ID': requestId,
        },
      }
    );
  }
}
