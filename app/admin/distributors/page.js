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
  const [debts, setDebts] = useState({}); // حالة خاصة لمبالغ الديون والعهدة

  async function loadList() {
    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'distributor')
      .order('created_at', { ascending: false });
    if (loadError) { setError('تعذّر تحميل قائمة الموزعين: ' + loadError.message); return; }
    setList(data || []);
    const initialCards = {};
    const initialDebts = {};
    (data || []).forEach((d) => { 
      initialCards[d.id] = d.personal_card || ''; 
      initialDebts[d.id] = '';
    });
    setPersonalCards(initialCards);
    setDebts(initialDebts);
  }

  useEffect(() => { if (profile) loadList(); }, [profile]);

  async function updateStatus(id, status) {
    setError(''); setBusyId(id);
    const { error: updateError } = await supabase.from('profiles').update({ status }).eq('id', id);
    setBusyId(null);
    if (updateError) { setError('تعذّر تنفيذ الإجراء: ' + updateError.message); return; }
    loadList();
  }

  async function deleteDistributor(id, name) {
    if (!window.confirm(`سيتم حذف حساب "${name}" نهائيًا من التطبيق مع كل بياناته. ملاحظة: بريده وكلمة سره في نظام تسجيل الدخول تبقى موجودة إلا إذا حذفتها يدويًا من Supabase. متابعة؟`)) return;
    setError(''); setBusyId(id);
    const { error: deleteError } = await supabase.from('profiles').delete().eq('id', id);
    setBusyId(null);
    if (deleteError) { setError('تعذّر حذف الحساب: ' + deleteError.message); return; }
    loadList();
  }

  async function addBalance(id) {
    const amount = parseFloat(topUps[id]);
    if (!amount || amount <= 0) return;
    setError(''); setBusyId(id);
    const current = list.find((d) => d.id === id);
    const newBalance = (current?.balance || 0) + amount;
    const { error: updateError } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', id);
    setBusyId(null);
    if (updateError) { setError('تعذّرت إضافة الرصيد: ' + updateError.message); return; }
    setTopUps({ ...topUps, [id]: '' });
    loadList();
  }

  // دالة تحديث وعمليات الدين / العهدة أو السداد
  async function updateDebt(id, actionType) {
    const amount = parseFloat(debts[id]);
    if (!amount || amount <= 0) return;
    setError(''); setBusyId(id);
    
    const current = list.find((d) => d.id === id);
    const currentDebt = Number(current?.debt_balance || 0);
    
    // إذا كانت العملية أخذ عهدة جديدة يزاد الدين، وإذا كانت سداد يخصم من الدين
    const newDebt = actionType === 'add' ? currentDebt + amount : Math.max(0, currentDebt - amount);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ debt_balance: newDebt })
      .eq('id', id);

    setBusyId(null);
    if (updateError) { setError('تعذّر تحديث حساب العهدة: ' + updateError.message); return; }
    
    setDebts({ ...debts, [id]: '' });
    loadList();
  }

  async function savePersonalCard(id) {
    setError(''); setBusyId(id);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ personal_card: personalCards[id] || null })
      .eq('id', id);
    setBusyId(null);
    if (updateError) { setError('تعذّر حفظ الكرت الشخصي: ' + updateError.message); return; }
    loadList();
  }

  const deleteBtnStyle = {
    backgroundColor: '#dc2626', color: '#ffffff', opacity: 1,
    padding: '7px 16px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
  };

  if (loading) return null;
  const pending = list.filter((d) => d.status === 'pending');
  const others = list.filter((d) => d.status !== 'pending');

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/distributors" name={profile.full_name} />
      <div className="main">
        <h1>الموزعون</h1>
        <p className="greet" style={{ marginBottom: 20 }}>إدارة طلبات التسجيل والحسابات الحالية وإضافة الرصيد والذمم المالية</p>

        {error && <div className="error-note">{error}</div>}

        <div className="panel">
          <div className="panel-head"><h3>طلبات بانتظار الموافقة</h3><span className="muted">{pending.length} طلب</span></div>
          {pending.length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>لا توجد طلبات معلّقة حاليًا</div>}
          {pending.map((d) => (
            <div key={d.id} className="req-row">
              <div className="req-user">
                <div className="ini">{d.full_name?.slice(0, 2)}</div>
                <div><div className="nm">{d.full_name}</div><div className="em">{d.email}</div></div>
              </div>
              <div className="req-actions">
                <button className="btn-sm btn-approve" disabled={busyId === d.id} onClick={() => updateStatus(d.id, 'approved')}>
                  {busyId === d.id ? '...' : 'قبول'}
                </button>
                <button className="btn-sm btn-reject" disabled={busyId === d.id} onClick={() => updateStatus(d.id, 'rejected')}>رفض</button>
                <button style={deleteBtnStyle} disabled={busyId === d.id} onClick={() => deleteDistributor(d.id, d.full_name)}>حذف</button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head"><h3>كل الموزعين</h3><span className="muted">{others.length}</span></div>
          {others.length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>لا يوجد موزعون بعد</div>}
          {others.map((d) => (
            <div
              key={d.id}
              style={{
                borderTop: '1px solid var(--line)', padding: '14px 4px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{d.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{d.email}</div>
                </div>
                <button style={deleteBtnStyle} disabled={busyId === d.id} onClick={() => deleteDistributor(d.id, d.full_name)}>
                  حذف الحساب
                </button>
              </div>

              {/* قسم الرصيد وحالة الحساب */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {Number(d.balance).toLocaleString('en-US')} ريال
                  </span>
                  <span className={`pill ${d.status === 'approved' ? 'green' : 'red'}`}>
                    {d.status === 'approved' ? 'مقبول' : 'مرفوض'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number"
                    min="0"
                    placeholder="مثلاً 50000"
                    value={topUps[d.id] || ''}
                    onChange={(e) => setTopUps({ ...topUps, [d.id]: e.target.value })}
                    style={{ width: 110, padding: '8px 10px', borderRadius: 10, border: '1.5px solid var(--line)', fontFamily: 'monospace', fontSize: 12.5 }}
                  />
                  <button className="btn-sm btn-approve" disabled={busyId === d.id || !topUps[d.id]} onClick={() => addBalance(d.id)}>
                    إضافة رصيد
                  </button>
                </div>
              </div>

              {/* قسم إدارة الذمم والديون (العهدة) الجديد */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: '#FEF2F2', padding: 10, borderRadius: 12, border: '1px solid #FEE2E2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#991B1B', fontWeight: 800 }}>العهدَة / الدين:</span>
                  <span className="mono" style={{ fontWeight: 900, fontSize: 13.5, color: '#DC2626' }}>
                    {Number(d.debt_balance || 0).toLocaleString('en-US')} ريال
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    placeholder="المبلغ"
                    value={debts[d.id] || ''}
                    onChange={(e) => setDebts({ ...debts, [d.id]: e.target.value })}
                    style={{ width: 90, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #FCA5A5', fontFamily: 'monospace', fontSize: 12 }}
                  />
                  <button 
                    disabled={busyId === d.id || !debts[d.id]} 
                    onClick={() => updateDebt(d.id, 'add')}
                    style={{ background: '#3B82F6', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    تسجيل عهدة
                  </button>
                  <button 
                    disabled={busyId === d.id || !debts[d.id]} 
                    onClick={() => updateDebt(d.id, 'pay')}
                    style={{ background: '#10B981', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    سداد
                  </button>
                </div>
              </div>

              {/* قسم الكرت الشخصي */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#F3F0FB', padding: 10, borderRadius: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700, whiteSpace: 'nowrap' }}>كرته الشخصي:</span>
                <input
                  type="text"
                  placeholder="اكتب كود الكرت هنا"
                  value={personalCards[d.id] ?? ''}
                  onChange={(e) => setPersonalCards({ ...personalCards, [d.id]: e.target.value })}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1.5px solid var(--line)', fontFamily: 'monospace', fontSize: 12.5 }}
                />
                <button
                  className="btn-sm btn-approve"
                  disabled={busyId === d.id}
                  onClick={() => savePersonalCard(d.id)}
                >
                  حفظ
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
