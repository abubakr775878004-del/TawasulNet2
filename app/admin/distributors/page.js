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

  async function loadList() {
    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'distributor')
      .order('created_at', { ascending: false });
    if (loadError) { setError('تعذّر تحميل قائمة الموزعين: ' + loadError.message); return; }
    setList(data || []);
  }

  useEffect(() => { if (profile) loadList(); }, [profile]);

  async function updateStatus(id, status) {
    setError(''); setBusyId(id);
    const { error: updateError } = await supabase.from('profiles').update({ status }).eq('id', id);
    setBusyId(null);
    if (updateError) { setError('تعذّر تنفيذ الإجراء: ' + updateError.message); return; }
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

  if (loading) return null;
  const pending = list.filter((d) => d.status === 'pending');
  const others = list.filter((d) => d.status !== 'pending');

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/distributors" name={profile.full_name} />
      <div className="main">
        <h1>الموزعون</h1>
        <p className="greet" style={{ marginBottom: 20 }}>إدارة طلبات التسجيل والحسابات الحالية وإضافة الرصيد</p>

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
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head"><h3>كل الموزعين</h3><span className="muted">{others.length}</span></div>
          <table>
            <thead><tr><th>الاسم</th><th>البريد</th><th>الرصيد</th><th>الحالة</th><th>إضافة رصيد (ريال يمني)</th></tr></thead>
            <tbody>
              {others.map((d) => (
                <tr key={d.id}>
                  <td>{d.full_name}</td>
                  <td>{d.email}</td>
                  <td className="mono">{Number(d.balance).toLocaleString('en-US')} ريال</td>
                  <td>
                    <span className={`pill ${d.status === 'approved' ? 'green' : 'red'}`}>
                      {d.status === 'approved' ? 'مقبول' : 'مرفوض'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="مثلاً 50000"
                        value={topUps[d.id] || ''}
                        onChange={(e) => setTopUps({ ...topUps, [d.id]: e.target.value })}
                        style={{ width: 110, padding: '8px 10px', borderRadius: 10, border: '1.5px solid var(--line)', fontFamily: 'monospace', fontSize: 12.5 }}
                      />
                      <button
                        className="btn-sm btn-approve"
                        disabled={busyId === d.id || !topUps[d.id]}
                        onClick={() => addBalance(d.id)}
                      >
                        إضافة
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
