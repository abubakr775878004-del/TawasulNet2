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

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null,
    distributorId: null,
    distributorName: '',
    amount: 0
  });

  const formatNum = (num) => {
    const val = Math.round(Number(num) || 0);
    return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  async function loadList() {
    setError('');
    
    // 1. جلب قائمة الموزعين
    const { data: distributors, error: loadError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'distributor')
      .order('created_at', { ascending: false });

    if (loadError) { 
      setError('تعذّر تحميل قائمة الموزعين: ' + loadError.message); 
      return; 
    }

    if (!distributors || distributors.length === 0) {
      setList([]);
      return;
    }

    // 2. حساب الصافي لكل موزع بدقة مطابقة لصفحة الموزع (إجمالي مبيعات الكروت مع خصم 10% مطروحاً منها السدادات النقدية)
    const listWithDetails = await Promise.all(
      distributors.map(async (dist) => {
        // جلب الكروت المباعة الخاصة بالموزع وحساب قيمتها
        const { data: soldCards } = await supabase
          .from('cards')
          .select('packages(price)')
          .eq('assigned_to', dist.id)
          .eq('status', 'sold');

        const totalSoldValue = (soldCards || []).reduce(
          (sum, item) => sum + Number(item.packages?.price || 0),
          0
        );

        // تطبيق خصم 10% على إجمالي المبيعات
        const grossDebt = totalSoldValue * 0.9;

        // جلب السدادات النقدية من جدول distributor_payments المرتبط بالموزع
        const { data: paymentsData } = await supabase
          .from('distributor_payments')
          .select('amount')
          .eq('distributor_id', dist.id);

        const totalPaid = (paymentsData || []).reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );

        // الصافي المستحق الفعلي بدقة تامة
        const netDebt = Math.max(0, Math.round(grossDebt - totalPaid));

        // عد الكروت المتاحة في مخزنه الحالي
        const { count: myCardsCount } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', dist.id)
          .eq('status', 'with_distributor');

        return {
          ...dist,
          debt: netDebt,
          myCardsCount: myCardsCount || 0,
        };
      })
    );

    setList(listWithDetails);
    
    const initialCards = {};
    const initialDebts = {};
    listWithDetails.forEach((d) => { 
      initialCards[d.id] = d.personal_card || ''; 
      initialDebts[d.id] = '';
    });
    setPersonalCards(initialCards);
    setDebts(initialDebts);
  }

  useEffect(() => { 
    if (profile) loadList(); 
  }, [profile]);

  function requestConfirmation(type, id, name, amount) {
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) return;
    setConfirmModal({
      isOpen: true,
      type,
      distributorId: id,
      distributorName: name,
      amount: numericAmount
    });
  }

  async function handleConfirmedAction() {
    const { type, distributorId, amount } = confirmModal;
    setConfirmModal({ ...confirmModal, isOpen: false });

    if (type === 'balance') {
      await executeAddBalance(distributorId, amount);
    } else if (type === 'payment') {
      await executePayDebt(distributorId, amount);
    }
  }

  async function executeAddBalance(id, amount) {
    setError(''); 
    setBusyId(id);
    
    // تحديث الرصيد بجدول profiles
    const { error: updateError } = await supabase.rpc('modify_distributor_balance', {
      target_id: id,
      amount: amount,
      is_debt: false,
      is_add: true
    });

    setBusyId(null);
    if (updateError) { 
      setError('تعذّرت إضافة الرصيد: ' + updateError.message); 
      return; 
    }
    setTopUps({ ...topUps, [id]: '' });
    loadList();
  }

  async function executePayDebt(id, amount) {
    setError(''); 
    setBusyId(id);
    
    // تسجيل السداد النقدي في جدول distributor_payments لخصمه فوراً من الصافي المستحق
    const { error: payError } = await supabase
      .from('distributor_payments')
      .insert([{ distributor_id: id, amount: amount }]);

    if (payError) {
      setBusyId(null);
      setError('تعذّر تسجيل عملية السداد: ' + payError.message);
      return;
    }

    setBusyId(null);
    setDebts({ ...debts, [id]: '' });
    loadList();
    alert('✓ تم تسجيل السداد النقدي وخصمه من صافي الدين بنجاح');
  }

  async function updateStatus(id, status) {
    setError(''); 
    setBusyId(id);
    const { error: updateError } = await supabase.from('profiles').update({ status }).eq('id', id);
    setBusyId(null);
    if (updateError) { 
      setError('تعذّر تنفيذ الإجراء: ' + updateError.message); 
      return; 
    }
    loadList();
  }

  async function deleteDistributor(id, name) {
    if (!window.confirm(`سيتم حذف حساب "${name}" نهائيًا من التطبيق مع كل بياناته. متابعة؟`)) return;
    setError(''); 
    setBusyId(id);
    const { error: deleteError } = await supabase.from('profiles').delete().eq('id', id);
    setBusyId(null);
    if (deleteError) { 
      setError('تعذّر حذف الحساب: ' + deleteError.message); 
      return; 
    }
    loadList();
  }

  async function savePersonalCard(id) {
    setError(''); 
    setBusyId(id);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ personal_card: personalCards[id] || null })
      .eq('id', id);
    setBusyId(null);
    if (updateError) { 
      setError('تعذّر حفظ الكرت الشخصي: ' + updateError.message); 
      return; 
    }
    loadList();
  }

  const deleteBtnStyle = {
    backgroundColor: '#fee2e2', 
    color: '#dc2626', 
    opacity: 1,
    padding: '6px 12px', 
    borderRadius: 8, 
    border: '1px solid #fca5a5', 
    fontWeight: 700, 
    fontSize: 12, 
    cursor: 'pointer',
  };

  if (loading) return null;
  const pending = list.filter((d) => d.status === 'pending');
  const others = list.filter((d) => d.status !== 'pending');

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/distributors" name={profile?.full_name} />
      <div className="main">
        <h1>الموزعون</h1>
        <p className="greet" style={{ marginBottom: 20 }}>
          إدارة طلبات التسجيل والحسابات الحالية والمستحقات المباشرة
        </p>

        {error && <div className="error-note">{error}</div>}

        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-head">
            <h3>طلبات بانتظار الموافقة</h3>
            <span className="muted">{pending.length} طلب</span>
          </div>
          {pending.length === 0 && (
            <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
              لا توجد طلبات معلّقة حاليًا
            </div>
          )}
          {pending.map((d) => (
            <div key={d.id} className="req-row">
              <div className="req-user">
                <div className="ini">{d.full_name?.slice(0, 2)}</div>
                <div>
                  <div className="nm">{d.full_name}</div>
                  <div className="em">{d.email}</div>
                </div>
              </div>
              <div className="req-actions">
                <button className="btn-sm btn-approve" disabled={busyId === d.id} onClick={() => updateStatus(d.id, 'approved')}>
                  {busyId === d.id ? '...' : 'قبول'}
                </button>
                <button className="btn-sm btn-reject" disabled={busyId === d.id} onClick={() => updateStatus(d.id, 'rejected')}>
                  رفض
                </button>
                <button style={deleteBtnStyle} disabled={busyId === d.id} onClick={() => deleteDistributor(d.id, d.full_name)}>
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head" style={{ marginBottom: 16 }}>
            <h3>كل الموزعين</h3>
            <span className="muted">{others.length}</span>
          </div>

          {others.length === 0 && (
            <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
              لا يوجد موزعون بعد
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {others.map((d) => {
              const currentNetDebt = Number(d.debt) || 0;

              return (
                <div
                  key={d.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: '#1e1b4b', letterSpacing: '-0.2px' }}>
                        {d.full_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: 500 }}>
                        {d.email}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`pill ${d.status === 'approved' ? 'green' : 'red'}`} style={{ fontSize: 11, padding: '4px 8px' }}>
                        {d.status === 'approved' ? 'مقبول' : 'مرفوض'}
                      </span>
                      <button style={deleteBtnStyle} disabled={busyId === d.id} onClick={() => deleteDistributor(d.id, d.full_name)}>
                        حذف
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>الرصيد المتبقي بمخزنه</div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                        {formatNum(d.balance)} <span style={{ fontSize: 11 }}>ريال</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>عدد الكروت لديه: {d.myCardsCount}</div>
                    </div>
                    
                    <div style={{ 
                      background: currentNetDebt > 0 ? '#fef2f2' : '#f0fdf4', 
                      border: currentNetDebt > 0 ? '1px solid #fca5a5' : '1px solid #bbf7d0', 
                      borderRadius: 10, 
                      padding: '8px 12px' 
                    }}>
                      <div style={{ fontSize: 11, color: currentNetDebt > 0 ? '#991b1b' : '#166534', fontWeight: 700 }}>
                        المبلغ الصافي المستحق للمدير
                      </div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 900, color: currentNetDebt > 0 ? '#dc2626' : '#059669', marginTop: 2 }}>
                        {formatNum(currentNetDebt)} <span style={{ fontSize: 11 }}>ريال</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                      📦 شحن كروت ومخزون للموزع:
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                      <input
                        type="number"
                        min="0"
                        maxLength={9}
                        placeholder="أدخل مبلغ المخزون (مثلاً 50000)"
                        value={topUps[d.id] || ''}
                        onChange={(e) => {
                          if (e.target.value.length <= 9) {
                            setTopUps({ ...topUps, [d.id]: e.target.value });
                          }
                        }}
                        style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #93c5fd', fontFamily: 'monospace', fontSize: 12.5 }}
                      />
                      <button 
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        disabled={busyId === d.id || !topUps[d.id]} 
                        onClick={() => requestConfirmation('balance', d.id, d.full_name, topUps[d.id])}
                      >
                        إضافة رصيد مخزون
                      </button>
                    </div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#166534', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                      💵 تسجيل سداد نقدي مقبوض (خصم دين):
                    </div>
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                      <input
                        type="number"
                        min="0"
                        maxLength={9}
                        placeholder="أدخل المبلغ المقبوض كاش"
                        value={debts[d.id] || ''}
                        onChange={(e) => {
                          if (e.target.value.length <= 9) {
                            setDebts({ ...debts, [d.id]: e.target.value });
                          }
                        }}
                        style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #86efac', fontFamily: 'monospace', fontSize: 12.5 }}
                      />
                      <button 
                        disabled={busyId === d.id || !debts[d.id]} 
                        onClick={() => requestConfirmation('payment', d.id, d.full_name, debts[d.id])}
                        style={{ background: '#059669', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        تسجيل سداد نقدي
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f5f3ff', padding: 10, borderRadius: 12, border: '1px solid #ede9fe' }}>
                    <input
                      type="text"
                      placeholder="رمز الكرت الشخصي"
                      value={personalCards[d.id] ?? ''}
                      onChange={(e) => setPersonalCards({ ...personalCards, [d.id]: e.target.value })}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #ddd6fe', fontFamily: 'monospace', fontSize: 12.5 }}
                    />
                    <button
                      className="btn-sm btn-approve"
                      style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}
                      disabled={busyId === d.id}
                      onClick={() => savePersonalCard(d.id)}
                    >
                      حفظ الكرت
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </div>

      {confirmModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: 16
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: 24,
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ fontSize: 42, margin: '0 auto' }}>
              {confirmModal.type === 'balance' ? '📦' : '💵'}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
                تأكيد عملية {confirmModal.type === 'balance' ? 'شحن المخزون' : 'السداد النقدي'}
              </h3>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
                هل أنت متأكد من {confirmModal.type === 'balance' ? 'إضافة رصيد مخزون بقيمة' : 'تسجيل سداد نقدي مقبوض بقيمة'}{' '}
                <strong style={{ color: confirmModal.type === 'balance' ? '#2563eb' : '#059669', fontSize: 16 }}>
                  {formatNum(confirmModal.amount)} ريال
                </strong>{' '}
                للموزع <strong>({confirmModal.distributorName})</strong>؟
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleConfirmedAction}
                style={{
                  flex: 1,
                  background: confirmModal.type === 'balance' ? '#2563eb' : '#059669',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                نعم، تأكيد
              </button>
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                style={{
                  flex: 1,
                  background: '#f1f5f9',
                  color: '#64748b',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
