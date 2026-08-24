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
  const [calculatedDebts, setCalculatedDebts] = useState({});

  async function loadList() {
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

    setList(distributors || []);
    
    const initialCards = {};
    const initialDebts = {};
    (distributors || []).forEach((d) => { 
      initialCards[d.id] = d.personal_card || ''; 
      initialDebts[d.id] = '';
    });
    setPersonalCards(initialCards);
    setDebts(initialDebts);

    if (!distributors || distributors.length === 0) return;

    const distIds = distributors.map(d => d.id);

    // 2. جلب كل الكروت المباعة لكل الموزعين دفعة واحدة
    const { data: soldCards } = await supabase
      .from('cards')
      .select('assigned_to, price, packages(price)')
      .in('assigned_to', distIds)
      .eq('status', 'sold');

    // 3. جلب كل المقبوضات/السدادات النقدية
    const { data: payments } = await supabase
      .from('payments')
      .select('distributor_id, amount')
      .in('distributor_id', distIds);

    // 4. احتساب الدين التراكمي (90% للمدير بعد خصم 10% عمولة الموزع)
    const debtMap = {};

    distributors.forEach((dist) => {
      // جمع إجمالي مبيعات هذا الموزع (يقرأ سعر الكرت الفعلي أو سعر الباقة المربوطة)
      const distSoldCards = (soldCards || []).filter(c => c.assigned_to === dist.id);
      const totalSales = distSoldCards.reduce((sum, card) => {
        const cardPrice = Number(card.price || card.packages?.price || 0);
        return sum + cardPrice;
      }, 0);

      // صافي حق المدير = 90% من إجمالي المبيعات (خصم 10% للموزع)
      // مثال: 14,000 * 0.90 = 12,600 ريال
      const requiredNetAdmin = totalSales * 0.90;

      // إجمالي ما سدده الموزع نقداً للمدير
      const distPayments = (payments || []).filter(p => p.distributor_id === dist.id);
      const totalPaid = distPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // العهدة / الدين التراكمي النهائي
      debtMap[dist.id] = Math.max(0, requiredNetAdmin - totalPaid);
    });

    setCalculatedDebts(debtMap);
  }

  useEffect(() => { 
    if (profile) loadList(); 
  }, [profile]);

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

  async function addBalance(id) {
    const amount = parseFloat(topUps[id]);
    if (!amount || amount <= 0) return;
    setError(''); 
    setBusyId(id);
    
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

  async function payDebt(id) {
    const amount = parseFloat(debts[id]);
    if (!amount || amount <= 0) return;
    setError(''); 
    setBusyId(id);
    
    // 1. تسجيل عملية السداد في جدول المدفوعات لتحديث الدين المحسوب آلياً
    const { error: payError } = await supabase
      .from('payments')
      .insert([{ distributor_id: id, amount: amount, notes: 'سداد نقدي من لوحة الأدمن' }]);

    if (payError) {
      setBusyId(null);
      setError('تعذّر تسجيل عملية السداد: ' + payError.message);
      return;
    }

    // 2. تحديث سجل البروفايل
    await supabase.rpc('modify_distributor_balance', {
      target_id: id,
      amount: amount,
      is_debt: true,
      is_add: false
    });

    setBusyId(null);
    setDebts({ ...debts, [id]: '' });
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
      <Sidebar role="admin" active="/admin/distributors" name={profile.full_name} />
      <div className="main">
        <h1>الموزعون</h1>
        <p className="greet" style={{ marginBottom: 20 }}>
          إدارة طلبات التسجيل والحسابات الحالية وإضافة الرصيد والذمم المالية
        </p>

        {error && <div className="error-note">{error}</div>}

        {/* طلبات بانتظار الموافقة */}
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
                <button 
                  className="btn-sm btn-approve" 
                  disabled={busyId === d.id} 
                  onClick={() => updateStatus(d.id, 'approved')}
                >
                  {busyId === d.id ? '...' : 'قبول'}
                </button>
                <button 
                  className="btn-sm btn-reject" 
                  disabled={busyId === d.id} 
                  onClick={() => updateStatus(d.id, 'rejected')}
                >
                  رفض
                </button>
                <button 
                  style={deleteBtnStyle} 
                  disabled={busyId === d.id} 
                  onClick={() => deleteDistributor(d.id, d.full_name)}
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* قائمة الموزعين بالكامل */}
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
              const currentDebt = calculatedDebts[d.id] ?? 0;
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
                  {/* 1. ترويسة الموزع */}
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

                  {/* 2. شريط عرض الأرقام والبيانات المالية الحسابية المباشرة */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>الرصيد الحالي</div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                        {Number(d.balance).toLocaleString('en-US')} <span style={{ fontSize: 11 }}>ريال</span>
                      </div>
                    </div>
                    <div style={{ background: currentDebt > 0 ? '#fef2f2' : '#f0fdf4', border: currentDebt > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0', borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, color: currentDebt > 0 ? '#991b1b' : '#166534', fontWeight: 600 }}>العهدة / الدين التراكمي</div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 900, color: currentDebt > 0 ? '#dc2626' : '#059669', marginTop: 2 }}>
                        {currentDebt.toLocaleString('en-US')} <span style={{ fontSize: 11 }}>ريال</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. قسم إضافة الرصيد */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                    <input
                      type="number"
                      min="0"
                      placeholder="مبلغ الرصيد (مثلاً 50000)"
                      value={topUps[d.id] || ''}
                      onChange={(e) => setTopUps({ ...topUps, [d.id]: e.target.value })}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontFamily: 'monospace', fontSize: 12.5 }}
                    />
                    <button 
                      className="btn-sm btn-approve" 
                      style={{ padding: '9px 14px', whiteSpace: 'nowrap' }} 
                      disabled={busyId === d.id || !topUps[d.id]} 
                      onClick={() => addBalance(d.id)}
                    >
                      إضافة رصيد
                    </button>
                  </div>

                  {/* 4. قسم تسديد العهدة */}
                  <div style={{ background: '#f0fdf4', padding: 10, borderRadius: 12, border: '1px solid #dcfce7', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11.5, color: '#166534', fontWeight: 700 }}>تسجيل سداد نقدي من الموزع:</div>
                    <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="مبلغ السداد المقبوض"
                        value={debts[d.id] || ''}
                        onChange={(e) => setDebts({ ...debts, [d.id]: e.target.value })}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #86efac', fontFamily: 'monospace', fontSize: 12 }}
                      />
                      <button 
                        disabled={busyId === d.id || !debts[d.id]} 
                        onClick={() => payDebt(d.id)}
                        style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        تسجيل السداد
                      </button>
                    </div>
                  </div>

                  {/* 5. قسم الكرت الشخصي */}
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
    </div>
  );
}
