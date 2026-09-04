'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function DistributorsPage() {
const { profile, loading } = useProfile('admin');

const [list, setList] = useState([]);
const [error, setError] = useState('');
const [busyId, setBusyId] = useState(null);

const [topUps, setTopUps] = useState({});
const [personalCards, setPersonalCards] = useState({});
const [debts, setDebts] = useState({});

// نافذة تأكيد العمليات المالية
const [confirmModal, setConfirmModal] = useState({
isOpen: false,
type: null,
distributorId: null,
distributorName: '',
amount: 0
});

// نافذة تأكيد حذف الموزع
const [deleteModal, setDeleteModal] = useState({
isOpen: false,
distributorId: null,
distributorName: '',
balance: 0,
debt: 0,
cardsCount: 0
});

const formatNum = (num) => {
const val = Math.round(Number(num) || 0);

return val.toLocaleString('en-US', {
  maximumFractionDigits: 0
});

};

// =====================================================
// تحميل قائمة الموزعين
// =====================================================

async function loadList() {
setError('');

const {
  data: distributors,
  error: loadError
} = await supabase
  .from('profiles')
  .select('*')
  .eq('role', 'distributor')
  .neq('status', 'deleted')
  .order('created_at', {
    ascending: false
  });

if (loadError) {
  setError(
    'تعذّر تحميل قائمة الموزعين: ' +
    loadError.message
  );
  return;
}

if (
  !distributors ||
  distributors.length === 0
) {
  setList([]);
  setPersonalCards({});
  setDebts({});
  return;
}

const listWithDetails =
  await Promise.all(
    distributors.map(async (dist) => {
      const {
        count: myCardsCount
      } = await supabase
        .from('cards')
        .select('*', {
          count: 'exact',
          head: true
        })
        .eq('assigned_to', dist.id)
        .eq(
          'status',
          'with_distributor'
        );

      const permanentNetDebt =
        Number(
          dist.debt_balance ??
          dist.debt ??
          0
        );

      return {
        ...dist,
        debt: permanentNetDebt,
        balance: Number(
          dist.balance || 0
        ),
        myCardsCount:
          myCardsCount || 0
      };
    })
  );

setList(listWithDetails);

const initialCards = {};
const initialDebts = {};

listWithDetails.forEach((d) => {
  initialCards[d.id] =
    d.personal_card || '';

  initialDebts[d.id] = '';
});

setPersonalCards(initialCards);
setDebts(initialDebts);

}

useEffect(() => {
if (profile) {
loadList();
}
}, [profile]);

// =====================================================
// طلب تأكيد العملية المالية
// =====================================================

function requestConfirmation(
type,
id,
name,
amount
) {
const numericAmount =
Number(amount);

if (
  !Number.isFinite(numericAmount) ||
  numericAmount <= 0
) {
  setError(
    type === 'balance'
      ? 'أدخل مبلغ شحن صحيحًا أكبر من صفر'
      : 'أدخل مبلغ سداد صحيحًا أكبر من صفر'
  );
  return;
}

setError('');

setConfirmModal({
  isOpen: true,
  type,
  distributorId: id,
  distributorName: name,
  amount: numericAmount
});

}

// =====================================================
// تنفيذ العملية المالية بعد التأكيد
// =====================================================

async function handleConfirmedAction() {
if (
busyId ||
!confirmModal.distributorId ||
!confirmModal.amount
) {
return;
}

const {
  type,
  distributorId,
  amount
} = confirmModal;

if (type === 'balance') {
  await executeAddBalance(
    distributorId,
    amount
  );
} else if (type === 'payment') {
  await executePayDebt(
    distributorId,
    amount
  );
}

setConfirmModal((prev) => ({
  ...prev,
  isOpen: false
}));

}

// =====================================================
// شحن رصيد المخزون
//
// مهم:
// لا يتم تعديل profiles.balance مباشرة.
//
// يتم استخدام RPC:
// modify_distributor_balance
//
// التوقيع المؤكد:
// target_id uuid
// amount numeric
// is_debt boolean
// is_add boolean
//
// شحن الرصيد العادي:
// is_debt = false
// is_add  = true
// =====================================================

async function executeAddBalance(
id,
amount
) {
setError('');
setBusyId(id);

try {
  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      'مبلغ شحن المخزون يجب أن يكون أكبر من صفر'
    );
  }

  const {
    error: rpcError
  } = await supabase.rpc(
    'modify_distributor_balance',
    {
      target_id: id,
      amount: numericAmount,
      is_debt: false,
      is_add: true
    }
  );

  if (rpcError) {
    throw rpcError;
  }

  setTopUps((prev) => ({
    ...prev,
    [id]: ''
  }));

  await loadList();

  alert(
    `✓ تمت إضافة ${formatNum(
      numericAmount
    )} ريال إلى رصيد الموزع بنجاح`
  );
} catch (err) {
  console.error(
    'Add distributor balance RPC error:',
    err
  );

  setError(
    'تعذّرت إضافة الرصيد: ' +
    (err?.message ||
      'خطأ غير معروف')
  );
} finally {
  setBusyId(null);
}

}

// =====================================================
// سداد الدين
// يستخدم RPC ولا يعدل الدين مباشرة
// =====================================================

async function executePayDebt(
id,
amount
) {
setError('');
setBusyId(id);

try {
  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      'مبلغ السداد يجب أن يكون أكبر من صفر'
    );
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error(
      'يجب تسجيل الدخول كمدير لتنفيذ السداد'
    );
  }

  const {
    error: rpcError
  } = await supabase.rpc(
    'record_distributor_payment',
    {
      p_distributor_id: id,
      p_amount: numericAmount,
      p_admin_id: user.id,
      p_notes:
        'سداد نقدي من لوحة الأدمن'
    }
  );

  if (rpcError) {
    throw rpcError;
  }

  setDebts((prev) => ({
    ...prev,
    [id]: ''
  }));

  await loadList();

  alert(
    `✓ تم تسجيل سداد ${formatNum(
      numericAmount
    )} ريال وخصم المبلغ من دين الموزع بنجاح`
  );
} catch (err) {
  console.error(
    'Pay debt RPC error:',
    err
  );

  setError(
    'تعذّر تسجيل عملية السداد: ' +
    (err?.message ||
      'خطأ غير معروف')
  );
} finally {
  setBusyId(null);
}

}

// =====================================================
// تحديث حالة الموزع
// يستخدم RPC آمن للموافقة والرفض
// =====================================================

async function updateStatus(
id,
status
) {
setError('');
setBusyId(id);

try {
  const {
    error: rpcError
  } = await supabase.rpc(
    'review_distributor_request',
    {
      p_distributor_id: id,
      p_action:
        status === 'approved'
          ? 'approve'
          : 'reject'
    }
  );

  if (rpcError) {
    throw rpcError;
  }

  await loadList();

  alert(
    status === 'approved'
      ? '✓ تمت الموافقة على طلب الموزع بنجاح'
      : '✓ تم رفض طلب الموزع'
  );
} catch (err) {
  console.error(
    'Review distributor error:',
    err
  );

  setError(
    'تعذّر تنفيذ الإجراء: ' +
    (err?.message ||
      'خطأ غير معروف')
  );
} finally {
  setBusyId(null);
}

}

// =====================================================
// فتح نافذة حذف الموزع
// =====================================================

function requestDeleteDistributor(
distributor
) {
setError('');

setDeleteModal({
  isOpen: true,
  distributorId: distributor.id,
  distributorName:
    distributor.full_name || '',
  balance: Number(
    distributor.balance || 0
  ),
  debt: Number(
    distributor.debt || 0
  ),
  cardsCount: Number(
    distributor.myCardsCount || 0
  )
});

}

// =====================================================
// إغلاق نافذة الحذف
// =====================================================

function closeDeleteModal() {
if (
busyId ===
deleteModal.distributorId
) {
return;
}

setDeleteModal({
  isOpen: false,
  distributorId: null,
  distributorName: '',
  balance: 0,
  debt: 0,
  cardsCount: 0
});

}

// =====================================================
// أرشفة / إزالة الموزع من القائمة
//
// لا نحذف profiles فعليًا.
// يتم تغيير status إلى deleted.
// =====================================================

async function executeDeleteDistributor() {
const {
distributorId,
distributorName
} = deleteModal;

if (
  !distributorId ||
  busyId === distributorId
) {
  return;
}

setError('');
setBusyId(distributorId);

try {
  // منع أرشفة موزع عليه دين قائم
  const {
    data: currentDistributor,
    error: fetchError
  } = await supabase
    .from('profiles')
    .select(
      'id, role, status, debt_balance'
    )
    .eq('id', distributorId)
    .eq('role', 'distributor')
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (!currentDistributor) {
    throw new Error(
      'تعذّر العثور على حساب الموزع'
    );
  }

  const currentDebt =
    Number(
      currentDistributor.debt_balance || 0
    );

  if (currentDebt > 0) {
    throw new Error(
      'لا يمكن حذف حساب الموزع لأن عليه دينًا قائمًا بقيمة ' +
      formatNum(currentDebt) +
      ' ريال'
    );
  }

  // =================================================
  // الأرشفة بدل الحذف الفعلي
  // =================================================

  const {
    error: archiveError
  } = await supabase
    .from('profiles')
    .update({
      status: 'deleted'
    })
    .eq('id', distributorId)
    .eq('role', 'distributor');

  if (archiveError) {
    throw archiveError;
  }

  // تنظيف البيانات المحلية
  setTopUps((prev) => {
    const next = { ...prev };
    delete next[distributorId];
    return next;
  });

  setPersonalCards((prev) => {
    const next = { ...prev };
    delete next[distributorId];
    return next;
  });

  setDebts((prev) => {
    const next = { ...prev };
    delete next[distributorId];
    return next;
  });

  setList((prev) =>
    prev.filter(
      (item) =>
        item.id !== distributorId
    )
  );

  closeDeleteModal();

  alert(
    `✓ تم حذف حساب الموزع "${distributorName}" من قائمة الموزعين بنجاح\n\nتم الحفاظ على الكروت المباعة والسجل المالي.`
  );
} catch (err) {
  console.error(
    'Archive distributor error:',
    err
  );

  setDeleteModal({
    isOpen: false,
    distributorId: null,
    distributorName: '',
    balance: 0,
    debt: 0,
    cardsCount: 0
  });

  setError(
    'تعذّر حذف حساب الموزع: ' +
    (err?.message ||
      'خطأ غير معروف')
  );
} finally {
  setBusyId(null);
}

}

// =====================================================
// حفظ الكرت الشخصي
// =====================================================

async function savePersonalCard(id) {
setError('');
setBusyId(id);

try {
  const {
    error: updateError
  } = await supabase
    .from('profiles')
    .update({
      personal_card:
        personalCards[id] ||
        null
    })
    .eq('id', id);

  if (updateError) {
    throw updateError;
  }

  await loadList();

  alert(
    '✓ تم حفظ الكرت الشخصي بنجاح'
  );
} catch (err) {
  console.error(
    'Save personal card error:',
    err
  );

  setError(
    'تعذّر حفظ الكرت الشخصي: ' +
    (err?.message ||
      'خطأ غير معروف')
  );
} finally {
  setBusyId(null);
}

}

// =====================================================
// تنسيق زر الحذف
// =====================================================

const deleteBtnStyle = {
backgroundColor: '#fee2e2',
color: '#dc2626',
opacity: 1,
padding: '7px 13px',
borderRadius: 9,
border: '1px solid #fca5a5',
fontWeight: 800,
fontSize: 12,
cursor: 'pointer'
};

if (loading) {
return null;
}

const pending =
list.filter(
(d) => d.status === 'pending'
);

const others =
list.filter(
(d) => d.status !== 'pending'
);

return (
<div className="app">

  <Sidebar
    role="admin"
    active="/admin/distributors"
    name={profile?.full_name}
  />

  <div className="main">

    <h1>الموزعون</h1>

    <p
      className="greet"
      style={{
        marginBottom: 20
      }}
    >
      إدارة طلبات التسجيل والحسابات الحالية
      والمستحقات المباشرة
    </p>

    {/* رسالة الخطأ */}

    {error && (
      <div
        className="error-note"
        style={{
          background: '#fef2f2',
          color: '#dc2626',
          padding: '12px 14px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid #fca5a5',
          fontSize: '13px',
          fontWeight: 'bold',
          lineHeight: 1.7
        }}
      >
        {error}
      </div>
    )}

    {/* =================================================
        الطلبات المعلقة
    ================================================= */}

    <div
      className="panel"
      style={{
        marginBottom: 24
      }}
    >

      <div className="panel-head">

        <h3>
          طلبات بانتظار الموافقة
        </h3>

        <span className="muted">
          {pending.length} طلب
        </span>

      </div>

      {pending.length === 0 && (
        <div
          style={{
            color:
              'var(--ink-soft)',
            fontSize: 13
          }}
        >
          لا توجد طلبات معلّقة حاليًا
        </div>
      )}

      {pending.map((d) => (

        <div
          key={d.id}
          className="req-row"
        >

          <div className="req-user">

            <div className="ini">
              {d.full_name?.slice(
                0,
                2
              )}
            </div>

            <div>

              <div className="nm">
                {d.full_name}
              </div>

              <div className="em">
                {d.email}
              </div>

            </div>

          </div>

          <div className="req-actions">

            <button
              className="btn-sm btn-approve"
              disabled={
                busyId === d.id
              }
              onClick={() =>
                updateStatus(
                  d.id,
                  'approved'
                )
              }
            >
              {busyId === d.id
                ? '...'
                : 'قبول'}
            </button>

            <button
              className="btn-sm btn-reject"
              disabled={
                busyId === d.id
              }
              onClick={() =>
                updateStatus(
                  d.id,
                  'rejected'
                )
              }
            >
              {busyId === d.id
                ? '...'
                : 'رفض'}
            </button>

            <button
              style={deleteBtnStyle}
              disabled={
                busyId === d.id
              }
              onClick={() =>
                requestDeleteDistributor(
                  d
                )
              }
            >
              🗑️ حذف
            </button>

          </div>

        </div>

      ))}

    </div>

    {/* =================================================
        كل الموزعين
    ================================================= */}

    <div className="panel">

      <div
        className="panel-head"
        style={{
          marginBottom: 16
        }}
      >

        <h3>
          كل الموزعين
        </h3>

        <span className="muted">
          {others.length}
        </span>

      </div>

      {others.length === 0 && (
        <div
          style={{
            color:
              'var(--ink-soft)',
            fontSize: 13
          }}
        >
          لا يوجد موزعون بعد
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection:
            'column',
          gap: 16
        }}
      >

        {others.map((d) => {

          const currentNetDebt =
            Number(d.debt) || 0;

          const canDelete =
            currentNetDebt <= 0;

          return (

            <div
              key={d.id}
              style={{
                background:
                  '#ffffff',
                border:
                  '1px solid #e2e8f0',
                borderRadius: 16,
                padding: 16,
                boxShadow:
                  '0 4px 12px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection:
                  'column',
                gap: 14
              }}
            >

              {/* رأس الموزع */}

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'flex-start',
                  borderBottom:
                    '1px solid #f1f5f9',
                  paddingBottom: 10
                }}
              >

                <div>

                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 16,
                      color: '#1e1b4b',
                      letterSpacing:
                        '-0.2px'
                    }}
                  >
                    {d.full_name}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      marginTop: 2,
                      fontWeight: 500
                    }}
                  >
                    {d.email}
                  </div>

                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: 8,
                    flexWrap:
                      'wrap',
                    justifyContent:
                      'flex-end'
                  }}
                >

                  <span
                    className={`pill ${
                      d.status ===
                      'approved'
                        ? 'green'
                        : 'red'
                    }`}
                    style={{
                      fontSize: 11,
                      padding:
                        '4px 8px'
                    }}
                  >
                    {d.status ===
                    'approved'
                      ? 'مقبول'
                      : 'مرفوض'}
                  </span>

                  <button
                    style={{
                      ...deleteBtnStyle,
                      opacity:
                        canDelete
                          ? 1
                          : 0.55,
                      cursor:
                        canDelete
                          ? 'pointer'
                          : 'not-allowed'
                    }}
                    disabled={
                      busyId ===
                        d.id ||
                      !canDelete
                    }
                    title={
                      !canDelete
                        ? 'لا يمكن حذف موزع عليه دين'
                        : 'إزالة حساب الموزع من القائمة'
                    }
                    onClick={() =>
                      requestDeleteDistributor(
                        d
                      )
                    }
                  >
                    🗑️ حذف
                  </button>

                </div>

              </div>

              {/* الرصيد والدين */}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '1fr 1fr',
                  gap: 10
                }}
              >

                {/* الرصيد */}

                <div
                  style={{
                    background:
                      '#f8fafc',
                    border:
                      '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding:
                      '8px 12px'
                  }}
                >

                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      fontWeight: 600
                    }}
                  >
                    الرصيد المتبقي بمخزنه
                  </div>

                  <div
                    className="mono"
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#0f172a',
                      marginTop: 2
                    }}
                  >
                    {formatNum(
                      d.balance
                    )}

                    <span
                      style={{
                        fontSize: 11
                      }}
                    >
                      {' '}ريال
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 10.5,
                      color: '#94A3B8',
                      marginTop: 2
                    }}
                  >
                    عدد الكروت لديه:{' '}
                    {d.myCardsCount}
                  </div>

                </div>

                {/* الدين */}

                <div
                  style={{
                    background:
                      currentNetDebt >
                      0
                        ? '#fef2f2'
                        : '#f0fdf4',
                    border:
                      currentNetDebt >
                      0
                        ? '1px solid #fca5a5'
                        : '1px solid #bbf7d0',
                    borderRadius: 10,
                    padding:
                      '8px 12px'
                  }}
                >

                  <div
                    style={{
                      fontSize: 11,
                      color:
                        currentNetDebt >
                        0
                          ? '#991b1b'
                          : '#166534',
                      fontWeight: 700
                    }}
                  >
                    المبلغ الصافي المستحق للمدير
                  </div>

                  <div
                    className="mono"
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color:
                        currentNetDebt >
                        0
                          ? '#dc2626'
                          : '#059669',
                      marginTop: 2
                    }}
                  >
                    {formatNum(
                      currentNetDebt
                    )}

                    <span
                      style={{
                        fontSize: 11
                      }}
                    >
                      {' '}ريال
                    </span>
                  </div>

                </div>

              </div>

              {/* =================================================
                  شحن المخزون
              ================================================= */}

              <div
                style={{
                  background:
                    '#eff6ff',
                  border:
                    '1px solid #bfdbfe',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection:
                    'column',
                  gap: 8
                }}
              >

                <div
                  style={{
                    fontSize: 12,
                    color: '#1e40af',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: 4
                  }}
                >
                  📦 شحن كروت ومخزون للموزع:
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems:
                      'center',
                    width: '100%'
                  }}
                >

                  <input
                    type="number"
                    min="0"
                    max="999999999"
                    placeholder="أدخل مبلغ المخزون (مثلاً 50000)"
                    value={
                      topUps[d.id] ||
                      ''
                    }
                    onChange={(e) => {
                      if (
                        e.target.value
                          .length <=
                        9
                      ) {
                        setTopUps(
                          (prev) => ({
                            ...prev,
                            [d.id]:
                              e.target.value
                          })
                        );
                      }
                    }}
                    style={{
                      flex: 1,
                      padding:
                        '9px 12px',
                      borderRadius: 10,
                      border:
                        '1.5px solid #93c5fd',
                      fontFamily:
                        'monospace',
                      fontSize: 12.5
                    }}
                  />

                  <button
                    style={{
                      background:
                        '#2563eb',
                      color: '#fff',
                      border: 'none',
                      padding:
                        '9px 14px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor:
                        busyId === d.id
                          ? 'wait'
                          : 'pointer',
                      whiteSpace:
                        'nowrap',
                      opacity:
                        busyId === d.id
                          ? 0.7
                          : 1
                    }}
                    disabled={
                      busyId ===
                        d.id ||
                      !topUps[d.id]
                    }
                    onClick={() =>
                      requestConfirmation(
                        'balance',
                        d.id,
                        d.full_name,
                        topUps[d.id]
                      )
                    }
                  >
                    {busyId === d.id
                      ? 'جاري التنفيذ...'
                      : 'إضافة رصيد مخزون'}
                  </button>

                </div>

              </div>

              {/* =================================================
                  السداد النقدي
              ================================================= */}

              <div
                style={{
                  background:
                    '#f0fdf4',
                  border:
                    '1px solid #bbf7d0',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection:
                    'column',
                  gap: 8
                }}
              >

                <div
                  style={{
                    fontSize: 12,
                    color: '#166534',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: 4
                  }}
                >
                  💵 تسجيل سداد نقدي مقبوض (خصم دين):
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    width: '100%'
                  }}
                >

                  <input
                    type="number"
                    min="0"
                    max="999999999"
                    placeholder="أدخل المبلغ المقبوض كاش"
                    value={
                      debts[d.id] ||
                      ''
                    }
                    onChange={(e) => {
                      if (
                        e.target.value
                          .length <=
                        9
                      ) {
                        setDebts(
                          (prev) => ({
                            ...prev,
                            [d.id]:
                              e.target.value
                          })
                        );
                      }
                    }}
                    style={{
                      flex: 1,
                      padding:
                        '9px 12px',
                      borderRadius: 10,
                      border:
                        '1.5px solid #86efac',
                      fontFamily:
                        'monospace',
                      fontSize: 12.5
                    }}
                  />

                  <button
                    disabled={
                      busyId ===
                        d.id ||
                      !debts[d.id]
                    }
                    onClick={() =>
                      requestConfirmation(
                        'payment',
                        d.id,
                        d.full_name,
                        debts[d.id]
                      )
                    }
                    style={{
                      background:
                        '#059669',
                      color:
                        '#fff',
                      border: 'none',
                      padding:
                        '9px 14px',
                      borderRadius:
                        10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor:
                        busyId === d.id
                          ? 'wait'
                          : 'pointer',
                      whiteSpace:
                        'nowrap',
                      opacity:
                        busyId === d.id
                          ? 0.7
                          : 1
                    }}
                  >
                    {busyId === d.id
                      ? 'جاري التنفيذ...'
                      : 'تسجيل سداد نقدي'}
                  </button>

                </div>

              </div>

              {/* =================================================
                  الكرت الشخصي
              ================================================= */}

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems:
                    'center',
                  background:
                    '#f5f3ff',
                  padding: 10,
                  borderRadius: 12,
                  border:
                    '1px solid #ede9fe'
                }}
              >

                <input
                  type="text"
                  placeholder="رمز الكرت الشخصي"
                  value={
                    personalCards[
                      d.id
                    ] ?? ''
                  }
                  onChange={(e) =>
                    setPersonalCards(
                      (prev) => ({
                        ...prev,
                        [d.id]:
                          e.target.value
                      })
                    )
                  }
                  style={{
                    flex: 1,
                    padding:
                      '8px 10px',
                    borderRadius: 8,
                    border:
                      '1.5px solid #ddd6fe',
                    fontFamily:
                      'monospace',
                    fontSize: 12.5
                  }}
                />

                <button
                  className="btn-sm btn-approve"
                  style={{
                    padding:
                      '8px 14px',
                    whiteSpace:
                      'nowrap'
                  }}
                  disabled={
                    busyId ===
                    d.id
                  }
                  onClick={() =>
                    savePersonalCard(
                      d.id
                    )
                  }
                >
                  {busyId === d.id
                    ? 'جاري الحفظ...'
                    : 'حفظ الكرت'}
                </button>

              </div>

            </div>

          );

        })}

      </div>

    </div>

  </div>

  {/* =====================================================
      نافذة تأكيد العملية المالية
  ===================================================== */}

  {confirmModal.isOpen && (

    <div
      style={{
        position: 'fixed',
        inset: 0,
        background:
          'rgba(15, 23, 42, 0.65)',
        backdropFilter:
          'blur(5px)',
        display: 'flex',
        alignItems:
          'center',
        justifyContent:
          'center',
        zIndex: 99999,
        padding: 16
      }}
    >

      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: 24,
          maxWidth: 400,
          width: '100%',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          textAlign: 'center',
          display: 'flex',
          flexDirection:
            'column',
          gap: 16
        }}
      >

        <div
          style={{
            fontSize: 42,
            margin: '0 auto'
          }}
        >
          {confirmModal.type ===
          'balance'
            ? '📦'
            : '💵'}
        </div>

        <div>

          <h3
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: '#0f172a',
              marginBottom: 6
            }}
          >
            تأكيد عملية{' '}
            {confirmModal.type ===
            'balance'
              ? 'شحن المخزون'
              : 'السداد النقدي'}
          </h3>

          <p
            style={{
              fontSize: 14,
              color: '#475569',
              lineHeight: 1.5
            }}
          >
            هل أنت متأكد من{' '}
            {confirmModal.type ===
            'balance'
              ? 'إضافة رصيد مخزون بقيمة'
              : 'تسجيل سداد نقدي مقبوض بقيمة'}{' '}

            <strong
              style={{
                color:
                  confirmModal.type ===
                  'balance'
                    ? '#2563eb'
                    : '#059669',
                fontSize: 16
              }}
            >
              {formatNum(
                confirmModal.amount
              )}{' '}
              ريال
            </strong>{' '}

            للموزع{' '}

            <strong>
              (
              {
                confirmModal.distributorName
              }
              )
            </strong>
            ؟
          </p>

        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 8
          }}
        >

          <button
            onClick={
              handleConfirmedAction
            }
            disabled={
              busyId !== null
            }
            style={{
              flex: 1,
              background:
                confirmModal.type ===
                'balance'
                  ? '#2563eb'
                  : '#059669',
              color:
                '#ffffff',
              border: 'none',
              padding: '12px',
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 14,
              cursor:
                busyId !== null
                  ? 'wait'
                  : 'pointer',
              opacity:
                busyId !== null
                  ? 0.65
                  : 1
            }}
          >
            {busyId !== null
              ? 'جاري التنفيذ...'
              : 'نعم، تأكيد'}
          </button>

          <button
            onClick={() =>
              setConfirmModal(
                (prev) => ({
                  ...prev,
                  isOpen: false
                })
              )
            }
            disabled={
              busyId !== null
            }
            style={{
              flex: 1,
              background:
                '#f1f5f9',
              color:
                '#64748b',
              border: 'none',
              padding: '12px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor:
                busyId !== null
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                busyId !== null
                  ? 0.6
                  : 1
            }}
          >
            إلغاء
          </button>

        </div>

      </div>

    </div>

  )}

  {/* =====================================================
      نافذة تأكيد حذف الموزع
  ===================================================== */}

  {deleteModal.isOpen && (

    <div
      onClick={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          closeDeleteModal();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background:
          'rgba(15, 23, 42, 0.72)',
        backdropFilter:
          'blur(7px)',
        display: 'flex',
        alignItems:
          'center',
        justifyContent:
          'center',
        zIndex: 100000,
        padding: 18,
        direction: 'rtl'
      }}
    >

      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#ffffff',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow:
            '0 30px 80px rgba(15, 23, 42, 0.35)',
          animation:
            'fadeIn 0.2s ease-out'
        }}
      >

        <div
          style={{
            height: 6,
            background:
              'linear-gradient(90deg, #b91c1c, #dc2626, #ef4444)'
          }}
        />

        <div
          style={{
            padding: 24
          }}
        >

          <div
            style={{
              width: 70,
              height: 70,
              margin:
                '0 auto 16px',
              borderRadius:
                '50%',
              background:
                '#fef2f2',
              border:
                '1px solid #fecaca',
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              boxShadow:
                '0 8px 20px rgba(220, 38, 38, 0.10)'
            }}
          >
            <span
              style={{
                fontSize: 32,
                lineHeight: 1
              }}
            >
              🗑️
            </span>
          </div>

          <h3
            style={{
              margin: 0,
              textAlign:
                'center',
              color: '#111827',
              fontSize: 21,
              fontWeight: 900
            }}
          >
            تأكيد حذف الموزع
          </h3>

          <p
            style={{
              textAlign:
                'center',
              color: '#64748b',
              fontSize: 13,
              margin:
                '8px 0 20px',
              lineHeight: 1.7
            }}
          >
            سيتم إزالة الحساب من قائمة
            الموزعين مع الحفاظ على
            سجله السابق.
          </p>

          <div
            style={{
              background:
                '#f8fafc',
              border:
                '1px solid #e2e8f0',
              borderRadius: 15,
              padding:
                '14px 16px',
              textAlign:
                'center',
              marginBottom: 14
            }}
          >

            <div
              style={{
                color: '#111827',
                fontWeight: 900,
                fontSize: 18
              }}
            >
              {
                deleteModal.distributorName
              }
            </div>

            <div
              style={{
                color: '#94a3b8',
                fontSize: 11,
                marginTop: 4
              }}
            >
              حساب موزع
            </div>

          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: 10,
              marginBottom: 14
            }}
          >

            <div
              style={{
                background:
                  '#f0fdf4',
                border:
                  '1px solid #bbf7d0',
                borderRadius: 13,
                padding: 11,
                textAlign:
                  'center'
              }}
            >

              <div
                style={{
                  fontSize: 10,
                  color: '#166534',
                  fontWeight: 700
                }}
              >
                الرصيد الحالي
              </div>

              <div
                style={{
                  fontSize: 15,
                  color: '#059669',
                  fontWeight: 900,
                  marginTop: 3
                }}
              >
                {formatNum(
                  deleteModal.balance
                )}{' '}
                ريال
              </div>

            </div>

            <div
              style={{
                background:
                  deleteModal.debt >
                  0
                    ? '#fef2f2'
                    : '#f0fdf4',
                border:
                  deleteModal.debt >
                  0
                    ? '1px solid #fecaca'
                    : '1px solid #bbf7d0',
                borderRadius: 13,
                padding: 11,
                textAlign:
                  'center'
              }}
            >

              <div
                style={{
                  fontSize: 10,
                  color:
                    deleteModal.debt >
                    0
                      ? '#991b1b'
                      : '#166534',
                  fontWeight: 700
                }}
              >
                الدين الحالي
              </div>

              <div
                style={{
                  fontSize: 15,
                  color:
                    deleteModal.debt >
                    0
                      ? '#dc2626'
                      : '#059669',
                  fontWeight: 900,
                  marginTop: 3
                }}
              >
                {formatNum(
                  deleteModal.debt
                )}{' '}
                ريال
              </div>

            </div>

          </div>

          {deleteModal.cardsCount >
            0 && (
            <div
              style={{
                background:
                  '#eff6ff',
                border:
                  '1px solid #bfdbfe',
                borderRadius: 13,
                padding:
                  '10px 12px',
                marginBottom: 14,
                color: '#1e40af',
                fontSize: 12,
                lineHeight: 1.7
              }}
            >
              📦 يوجد حاليًا{' '}
              <strong>
                {
                  deleteModal.cardsCount
                }
              </strong>{' '}
              كرت غير مباع مع هذا الموزع.
              <br />
              ستبقى الكروت المباعة
              وسجلاتها محفوظة.
            </div>
          )}

          <div
            style={{
              background:
                '#fff7ed',
              border:
                '1px solid #fed7aa',
              borderRadius: 13,
              padding:
                '11px 13px',
              marginBottom: 20,
              color: '#9a3412',
              fontSize: 12,
              lineHeight: 1.8
            }}
          >

            <strong>
              ⚠️ تنبيه مهم
            </strong>

            <br />

            سيتم إزالة الحساب من قائمة
            الموزعين الحالية.

            <br />

            <span
              style={{
                color:
                  '#166534'
              }}
            >
              ✓ الكروت المباعة لن تُحذف.
            </span>

            <br />

            <span
              style={{
                color:
                  '#166534'
              }}
            >
              ✓ سجلات المبيعات والسداد
              ستبقى محفوظة.
            </span>

            <br />

            <span
              style={{
                color:
                  '#991b1b'
              }}
            >
              ✓ وجود دين قائم يمنع
              عملية الحذف.
            </span>

          </div>

          <div
            style={{
              display: 'flex',
              gap: 10
            }}
          >

            <button
              onClick={
                executeDeleteDistributor
              }
              disabled={
                busyId ===
                deleteModal.distributorId
              }
              style={{
                flex: 1,
                background:
                  'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: '#ffffff',
                border: 'none',
                padding:
                  '13px 10px',
                borderRadius: 13,
                fontWeight: 900,
                fontSize: 13,
                cursor:
                  busyId ===
                  deleteModal.distributorId
                    ? 'wait'
                    : 'pointer',
                boxShadow:
                  '0 5px 15px rgba(220, 38, 38, 0.25)'
              }}
            >
              {busyId ===
              deleteModal.distributorId
                ? 'جاري الحذف...'
                : '🗑️ نعم، تأكيد الحذف'}
            </button>

            <button
              onClick={
                closeDeleteModal
              }
              disabled={
                busyId ===
                deleteModal.distributorId
              }
              style={{
                flex: 1,
                background:
                  '#f1f5f9',
                color:
                  '#475569',
                border:
                  '1px solid #e2e8f0',
                padding:
                  '13px 10px',
                borderRadius:
                  13,
                fontWeight: 800,
                fontSize: 13,
                cursor:
                  busyId ===
                  deleteModal.distributorId
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  busyId ===
                  deleteModal.distributorId
                    ? 0.6
                    : 1
              }}
            >
              إلغاء
            </button>

          </div>

        </div>

      </div>

    </div>

  )}

</div>

);
}
