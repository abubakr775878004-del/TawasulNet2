'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function RequestsPage() {
  const { profile, loading } = useProfile('admin');
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function loadRequests() {
    const { data } = await supabase
      .from('card_requests')
      .select('*, profiles(full_name, email), packages(name, price)')
      .order('created_at', { ascending: false });
    setRequests(data || []);
  }

  useEffect(() => { if (profile) loadRequests(); }, [profile]);

  async function fulfill(id) {
    setError(''); setBusyId(id);
    const { error: rpcError } = await supabase.rpc('fulfill_request', { req_id: id });
    setBusyId(null);
    if (rpcError) { setError(rpcError.message); return; }
    loadRequests();
  }

  async function reject(id) {
    setBusyId(id);
    await supabase.rpc('reject_request', { req_id: id });
    setBusyId(null);
    loadRequests();
  }

  async function clearHistory() {
    if (!window.confirm('سيتم حذف كل سجل الطلبات المنتهية (المنفذة والمرفوضة) نهائيًا. متابعة؟')) return;
    await supabase.from('card_requests').delete().in('status', ['fulfilled', 'rejected']);
    loadRequests();
  }

  if (loading) return null;
  const pending = requests.filter((r) => r.status === 'pending');
  const history = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/requests" name={profile.full_name} />
      <div className="main">
        <h1>طلبات الموزعين</h1>
        <p className="greet" style={{ marginBottom: 20 }}>الموافقة تخصم من رصيد الموزع تلقائيًا وتعيّن له الكروت</p>

        {error && <div className="error-note">{error}</div>}

        <div className="panel">
          <div className="panel-head"><h3>طلبات بانتظار التنفيذ</h3><span className="muted">{pending.length}</span></div>
          {pending.length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>لا توجد طلبات معلّقة</div>}
          {pending.map((r) => (
            <div key={r.id} className="req-row">
              <div className="req-user">
                <div className="ini">{r.profiles?.full_name?.slice(0, 2)}</div>
                <div>
                  <div className="nm">{r.profiles?.full_name}</div>
                  <div className="em">{r.packages?.name} × {r.quantity} كرت — إجمالي {(r.packages?.price * r.quantity).toFixed(2)} ريال</div>
                </div>
              </div>
              <div className="req-actions">
                <button className="btn-sm btn-approve" disabled={busyId === r.id} onClick={() => fulfill(r.id)}>
                  {busyId === r.id ? '...' : 'تنفيذ وخصم الرصيد'}
                </button>
                <button className="btn-sm btn-reject" disabled={busyId === r.id} onClick={() => reject(r.id)}>رفض</button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>سجل الطلبات</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="muted">{history.length}</span>
              {history.length > 0 && (
                <button
                  className="btn-sm"
                  style={{ backgroundColor: '#dc2626', color: '#ffffff', opacity: 1, padding: '6px 14px', borderRadius: '6px', border: 'none' }}
                  onClick={clearHistory}
                >
                  حذف السجل القديم
                </button>
              )}
            </div>
          </div>
          <table>
            <thead><tr><th>الموزع</th><th>الباقة</th><th>الكمية</th><th>الحالة</th></tr></thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td>{r.profiles?.full_name}</td>
                  <td>{r.packages?.name}</td>
                  <td>{r.quantity}</td>
                  <td><span className={`pill ${r.status === 'fulfilled' ? 'green' : 'red'}`}>{r.status === 'fulfilled' ? 'تم التنفيذ' : 'مرفوض'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
