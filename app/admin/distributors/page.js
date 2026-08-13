'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function DistributorsPage() {
  const { profile, loading } = useProfile('admin');
  const [list, setList] = useState([]);

  async function loadList() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'distributor').order('created_at', { ascending: false });
    setList(data || []);
  }

  useEffect(() => { if (profile) loadList(); }, [profile]);

  async function updateStatus(id, status) {
    await supabase.from('profiles').update({ status }).eq('id', id);
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
        <p className="greet" style={{ marginBottom: 20 }}>إدارة طلبات التسجيل والحسابات الحالية</p>

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
                <button className="btn-sm btn-approve" onClick={() => updateStatus(d.id, 'approved')}>قبول</button>
                <button className="btn-sm btn-reject" onClick={() => updateStatus(d.id, 'rejected')}>رفض</button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head"><h3>كل الموزعين</h3><span className="muted">{others.length}</span></div>
          <table>
            <thead><tr><th>الاسم</th><th>البريد</th><th>الرصيد</th><th>الحالة</th></tr></thead>
            <tbody>
              {others.map((d) => (
                <tr key={d.id}>
                  <td>{d.full_name}</td>
                  <td>{d.email}</td>
                  <td>{d.balance} ريال</td>
                  <td>
                    <span className={`pill ${d.status === 'approved' ? 'green' : 'red'}`}>
                      {d.status === 'approved' ? 'مقبول' : 'مرفوض'}
                    </span>
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
