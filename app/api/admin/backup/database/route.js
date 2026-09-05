import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

function getSupabaseAdmin() {
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
throw new Error(
'Supabase environment variables are not configured.'
);
}

return createClient(supabaseUrl, serviceRoleKey, {
auth: {
autoRefreshToken: false,
persistSession: false,
},
});
}

async function verifyAdmin(request, supabase) {
const authorization = request.headers.get('authorization');

if (!authorization || !authorization.startsWith('Bearer ')) {
return {
ok: false,
response: NextResponse.json(
{ error: 'غير مصرح بالوصول.' },
{ status: 401 }
),
};
}

const token = authorization.replace('Bearer ', '').trim();

if (!token) {
return {
ok: false,
response: NextResponse.json(
{ error: 'رمز المصادقة مفقود.' },
{ status: 401 }
),
};
}

const {
data: { user },
error: userError,
} = await supabase.auth.getUser(token);

if (userError || !user) {
return {
ok: false,
response: NextResponse.json(
{ error: 'جلسة المستخدم غير صالحة.' },
{ status: 401 }
),
};
}

const { data: profile, error: profileError } = await supabase
.from('profiles')
.select('id, role, status')
.eq('id', user.id)
.maybeSingle();

if (profileError) {
console.error('Admin verification error:', profileError);

return {
  ok: false,
  response: NextResponse.json(
    { error: 'تعذر التحقق من صلاحيات المدير.' },
    { status: 500 }
  ),
};

}

if (
!profile ||
profile.role !== 'admin' ||
profile.status !== 'active'
) {
return {
ok: false,
response: NextResponse.json(
{ error: 'ليس لديك صلاحية تنفيذ النسخ الاحتياطي.' },
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
try {
const supabase = getSupabaseAdmin();

const auth = await verifyAdmin(request, supabase);

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
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      console.error(
        `Backup error for table ${tableName}:`,
        error
      );

      backup.skipped_tables.push({
        table: tableName,
        reason: error.message || 'Unknown error',
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
      tableError
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

const filename = `tawasul-net-backup-${new Date()
  .toISOString()
  .replace(/[:.]/g, '-')}.json`;

return new NextResponse(JSON.stringify(backup, null, 2), {
  status: 200,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  },
});

} catch (error) {
console.error('Database backup error:', error);

return NextResponse.json(
  {
    error: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية.',
  },
  { status: 500 }
);

}
}
