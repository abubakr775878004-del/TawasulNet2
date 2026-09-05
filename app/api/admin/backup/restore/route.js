import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '../../../../../lib/server/adminAuth';

export const dynamic = 'force-dynamic';

const RESTORE_ORDER = [
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

const SKIP_TABLES = new Set();

function getRequestId() {
try {
return crypto.randomUUID();
} catch {
return "${Date.now()}-${Math.random().toString(36).slice(2)}";
}
}

function getRowsFromBackup(backup, tableName) {
const table = backup?.tables?.[tableName];

if (Array.isArray(table)) {
return table;
}

if (Array.isArray(table?.rows)) {
return table.rows;
}

if (Array.isArray(table?.data)) {
return table.data;
}

return [];
}

function isPlainObject(value) {
return (
value !== null &&
typeof value === 'object' &&
!Array.isArray(value)
);
}

function cloneRow(row) {
return isPlainObject(row) ? { ...row } : null;
}

function getRowId(row) {
return row?.id || null;
}

function getRowCode(row) {
return typeof row?.code === 'string' ? row.code.trim() : null;
}

function getRowEmail(row) {
return typeof row?.email === 'string'
? row.email.trim().toLowerCase()
: null;
}

function getRowName(row) {
return typeof row?.full_name === 'string'
? row.full_name.trim()
: null;
}

function createResult() {
return {
inserted: 0,
updated: 0,
skipped: 0,
failed: 0,
};
}

function safeError(error) {
return {
message: error?.message || 'Unknown error',
code: error?.code || null,
details: error?.details || null,
hint: error?.hint || null,
};
}

async function findExistingProfile(adminClient, row) {
if (row?.id) {
const { data, error } = await adminClient
.from('profiles')
.select('id')
.eq('id', row.id)
.maybeSingle();

if (!error && data?.id) {
  return {
    id: data.id,
    matchedBy: 'id',
  };
}

}

const email = getRowEmail(row);

if (email) {
const { data, error } = await adminClient
.from('profiles')
.select('id')
.ilike('email', email)
.limit(1)
.maybeSingle();

if (!error && data?.id) {
  return {
    id: data.id,
    matchedBy: 'email',
  };
}

}

const name = getRowName(row);

if (name) {
const { data, error } = await adminClient
.from('profiles')
.select('id')
.eq('full_name', name)
.limit(1)
.maybeSingle();

if (!error && data?.id) {
  return {
    id: data.id,
    matchedBy: 'full_name',
  };
}

}

return null;
}

async function findExistingPackage(adminClient, row) {
if (row?.id) {
const { data, error } = await adminClient
.from('packages')
.select('id')
.eq('id', row.id)
.maybeSingle();

if (!error && data?.id) {
  return {
    id: data.id,
    matchedBy: 'id',
  };
}

}

if (row?.name) {
const { data, error } = await adminClient
.from('packages')
.select('id')
.eq('name', row.name)
.limit(1)
.maybeSingle();

if (!error && data?.id) {
  return {
    id: data.id,
    matchedBy: 'name',
  };
}

}

return null;
}

async function findExistingCard(adminClient, row) {
if (row?.id) {
const { data, error } = await adminClient
.from('cards')
.select('id')
.eq('id', row.id)
.maybeSingle();

if (!error && data?.id) {
  return {
    id: data.id,
    matchedBy: 'id',
  };
}

}

const code = getRowCode(row);

if (code) {
const { data, error } = await adminClient
.from('cards')
.select('id')
.eq('code', code)
.limit(1)
.maybeSingle();

if (!error && data?.id) {
  return {
    id: data.id,
    matchedBy: 'code',
  };
}

}

return null;
}

async function profileExistsInAuth(adminClient, id) {
if (!id) {
return false;
}

try {
const { data, error } = await adminClient.auth.admin.getUserById(id);

return !error && !!data?.user;

} catch {
return false;
}
}

function remapForeignKeys(row, maps) {
const result = cloneRow(row);

if (!result) {
return null;
}

if (
result.assigned_to &&
maps.profiles.has(result.assigned_to)
) {
result.assigned_to = maps.profiles.get(result.assigned_to);
}

if (
result.distributor_id &&
maps.profiles.has(result.distributor_id)
) {
result.distributor_id = maps.profiles.get(result.distributor_id);
}

if (
result.user_id &&
maps.profiles.has(result.user_id)
) {
result.user_id = maps.profiles.get(result.user_id);
}

if (
result.profile_id &&
maps.profiles.has(result.profile_id)
) {
result.profile_id = maps.profiles.get(result.profile_id);
}

if (
result.requested_by &&
maps.profiles.has(result.requested_by)
) {
result.requested_by = maps.profiles.get(result.requested_by);
}

if (
result.package_id &&
maps.packages.has(result.package_id)
) {
result.package_id = maps.packages.get(result.package_id);
}

if (
result.card_id &&
maps.cards.has(result.card_id)
) {
result.card_id = maps.cards.get(result.card_id);
}

return result;
}

async function restoreProfiles(
adminClient,
rows,
result,
maps,
requestId
) {
for (const originalRow of rows) {
const row = cloneRow(originalRow);

if (!row) {
  result.skipped += 1;
  continue;
}

const existing = await findExistingProfile(
  adminClient,
  row
);

let targetId = existing?.id || row.id || null;

/*
 * profiles.id مرتبط بـ auth.users.
 * لذلك لا ننشئ profile جديدًا إذا لم يكن مستخدم Auth
 * موجودًا بالفعل.
 */
if (!existing) {
  if (!targetId) {
    result.skipped += 1;

    console.warn('Restore profile skipped: missing id.', {
      request_id: requestId,
    });

    continue;
  }

  const authUserExists = await profileExistsInAuth(
    adminClient,
    targetId
  );

  if (!authUserExists) {
    result.skipped += 1;

    console.warn(
      'Restore profile skipped: Auth user does not exist.',
      {
        request_id: requestId,
        profile_id: targetId,
        email: row.email || null,
      }
    );

    continue;
  }
}

if (targetId) {
  maps.profiles.set(row.id, targetId);
  row.id = targetId;
}

const { error } = await adminClient
  .from('profiles')
  .upsert(row, {
    onConflict: 'id',
  });

if (error) {
  result.failed += 1;

  console.error('Restore profile failed:', {
    request_id: requestId,
    error: safeError(error),
    profile_id: row.id || null,
    email: row.email || null,
  });

  continue;
}

if (existing) {
  result.updated += 1;
} else {
  result.inserted += 1;
}

}
}

async function restorePackages(
adminClient,
rows,
result,
maps,
requestId
) {
for (const originalRow of rows) {
const row = cloneRow(originalRow);

if (!row) {
  result.skipped += 1;
  continue;
}

const existing = await findExistingPackage(
  adminClient,
  row
);

if (existing?.id) {
  maps.packages.set(row.id, existing.id);
  row.id = existing.id;
}

const { error } = await adminClient
  .from('packages')
  .upsert(row, {
    onConflict: 'id',
  });

if (error) {
  result.failed += 1;

  console.error('Restore package failed:', {
    request_id: requestId,
    error: safeError(error),
    package_id: row.id || null,
    name: row.name || null,
  });

  continue;
}

if (existing) {
  result.updated += 1;
} else {
  result.inserted += 1;
}

}
}

async function restoreCards(
adminClient,
rows,
result,
maps,
requestId
) {
for (const originalRow of rows) {
let row = cloneRow(originalRow);

if (!row) {
  result.skipped += 1;
  continue;
}

row = remapForeignKeys(row, maps);

const existing = await findExistingCard(
  adminClient,
  row
);

if (existing?.id) {
  if (row.id) {
    maps.cards.set(row.id, existing.id);
  }

  row.id = existing.id;
}

const { error } = await adminClient
  .from('cards')
  .upsert(row, {
    onConflict: 'id',
  });

if (error) {
  result.failed += 1;

  console.error('Restore card failed:', {
    request_id: requestId,
    error: safeError(error),
    card_id: row.id || null,
    code: row.code || null,
  });

  continue;
}

if (existing) {
  result.updated += 1;
} else {
  result.inserted += 1;
}

}
}

async function restoreGenericTable(
adminClient,
tableName,
rows,
result,
maps,
requestId
) {
for (const originalRow of rows) {
let row = cloneRow(originalRow);

if (!row) {
  result.skipped += 1;
  continue;
}

row = remapForeignKeys(row, maps);

/*
 * السجلات التي لا تحتوي على id لا نقوم بتخمين مفتاح
 * جديد لها؛ لأن ذلك قد ينتج سجلات مكررة.
 */
if (!row.id) {
  result.skipped += 1;

  console.warn(
    `Restore skipped row without id in ${tableName}.`,
    {
      request_id: requestId,
      table: tableName,
    }
  );

  continue;
}

const { data: existing, error: lookupError } =
  await adminClient
    .from(tableName)
    .select('id')
    .eq('id', row.id)
    .maybeSingle();

if (lookupError) {
  result.failed += 1;

  console.error(
    `Restore lookup failed for ${tableName}:`,
    {
      request_id: requestId,
      table: tableName,
      error: safeError(lookupError),
    }
  );

  continue;
}

const { error } = await adminClient
  .from(tableName)
  .upsert(row, {
    onConflict: 'id',
  });

if (error) {
  result.failed += 1;

  console.error(
    `Restore failed for ${tableName}:`,
    {
      request_id: requestId,
      table: tableName,
      error: safeError(error),
      row_id: row.id,
    }
  );

  continue;
}

if (existing) {
  result.updated += 1;
} else {
  result.inserted += 1;
}

}
}

export async function POST(request) {
const requestId = getRequestId();

try {
/*
* الحماية الأساسية:
* المدير النشط فقط يستطيع تنفيذ الاستعادة.
*
* requireAdmin يتحقق من:
* - Bearer token
* - Supabase Auth
* - profiles
* - role = admin
* - status = active
*/
const auth = await requireAdmin(request);

if (!auth.ok) {
  return auth.response;
}

const { adminClient, user, adminProfile } = auth;

const formData = await request.formData();
const file = formData.get('file');

if (!file) {
  return NextResponse.json(
    {
      error: 'لم يتم إرسال ملف النسخة الاحتياطية.',
      code: 'BACKUP_FILE_MISSING',
      request_id: requestId,
    },
    {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
      },
    }
  );
}

if (
  typeof file.name === 'string' &&
  !file.name.toLowerCase().endsWith('.json')
) {
  return NextResponse.json(
    {
      error: 'ملف النسخة الاحتياطية يجب أن يكون بصيغة JSON.',
      code: 'INVALID_FILE_TYPE',
      request_id: requestId,
    },
    {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
      },
    }
  );
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

if (
  typeof file.size === 'number' &&
  file.size > MAX_FILE_SIZE
) {
  return NextResponse.json(
    {
      error:
        'حجم ملف النسخة الاحتياطية أكبر من الحد المسموح به وهو 50MB.',
      code: 'BACKUP_FILE_TOO_LARGE',
      request_id: requestId,
    },
    {
      status: 413,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
      },
    }
  );
}

let backup;

try {
  const text = await file.text();
  backup = JSON.parse(text);
} catch (error) {
  console.error('Backup JSON parsing failed:', {
    request_id: requestId,
    message: error?.message,
  });

  return NextResponse.json(
    {
      error:
        'تعذر قراءة ملف النسخة الاحتياطية. الملف غير صالح أو تالف.',
      code: 'INVALID_BACKUP_JSON',
      request_id: requestId,
    },
    {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
      },
    }
  );
}

if (
  !backup ||
  typeof backup !== 'object' ||
  !backup.tables ||
  typeof backup.tables !== 'object'
) {
  return NextResponse.json(
    {
      error:
        'صيغة النسخة الاحتياطية غير صحيحة. لم يتم العثور على tables.',
      code: 'INVALID_BACKUP_STRUCTURE',
      request_id: requestId,
    },
    {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
      },
    }
  );
}

const availableTables = RESTORE_ORDER.filter(
  (tableName) =>
    !SKIP_TABLES.has(tableName) &&
    Object.prototype.hasOwnProperty.call(
      backup.tables,
      tableName
    )
);

if (availableTables.length === 0) {
  return NextResponse.json(
    {
      error:
        'لم يتم العثور على أي جدول قابل للاستعادة داخل النسخة.',
      code: 'NO_RESTORE_TABLES',
      request_id: requestId,
    },
    {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
      },
    }
  );
}

const maps = {
  profiles: new Map(),
  packages: new Map(),
  cards: new Map(),
};

const results = {};

for (const tableName of RESTORE_ORDER) {
  if (SKIP_TABLES.has(tableName)) {
    continue;
  }

  const rows = getRowsFromBackup(
    backup,
    tableName
  );

  if (!Object.prototype.hasOwnProperty.call(
    backup.tables,
    tableName
  )) {
    continue;
  }

  results[tableName] = createResult();

  if (rows.length === 0) {
    continue;
  }

  if (tableName === 'profiles') {
    await restoreProfiles(
      adminClient,
      rows,
      results[tableName],
      maps,
      requestId
    );

    continue;
  }

  if (tableName === 'packages') {
    await restorePackages(
      adminClient,
      rows,
      results[tableName],
      maps,
      requestId
    );

    continue;
  }

  if (tableName === 'cards') {
    await restoreCards(
      adminClient,
      rows,
      results[tableName],
      maps,
      requestId
    );

    continue;
  }

  await restoreGenericTable(
    adminClient,
    tableName,
    rows,
    results[tableName],
    maps,
    requestId
  );
}

const summary = Object.values(results).reduce(
  (total, result) => {
    total.inserted += result.inserted;
    total.updated += result.updated;
    total.skipped += result.skipped;
    total.failed += result.failed;

    return total;
  },
  {
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  }
);

console.log('Database restore completed:', {
  request_id: requestId,
  user_id: user.id,
  admin_email: user.email || null,
  admin_name: adminProfile?.full_name || null,
  inserted: summary.inserted,
  updated: summary.updated,
  skipped: summary.skipped,
  failed: summary.failed,
});

const hasFailures = summary.failed > 0;

return NextResponse.json(
  {
    success: !hasFailures,
    message: hasFailures
      ? 'اكتملت محاولة الاستعادة، لكن توجد سجلات لم تتم استعادتها. راجع التقرير.'
      : 'تمت استعادة النسخة بنجاح. تم تحديث السجلات المطابقة وإضافة السجلات غير الموجودة دون تنفيذ حذف شامل.',
    request_id: requestId,

    safety: {
      delete_operations_performed: false,
      existing_records_updated: true,
      missing_records_inserted: true,
    },

    summary,

    tables: results,
  },
  {
    status: hasFailures ? 207 : 200,
    headers: {
      'Cache-Control': 'no-store',
      'X-Request-ID': requestId,
    },
  }
);

} catch (error) {
console.error('Database restore unexpected error:', {
request_id: requestId,
message: error?.message,
name: error?.name,
stack: error?.stack,
});

return NextResponse.json(
  {
    error:
      'حدث خطأ غير متوقع أثناء استعادة النسخة الاحتياطية.',
    code: 'RESTORE_UNEXPECTED_ERROR',
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
