'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

function timeLeft(soldAt) {
  const expiry = new Date(soldAt).getTime() + 24 * 60 * 60 * 1000;
  const diff = expiry - Date.now();
  if (diff <= 0) return 'انتهت';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `تختفي خلال ${h}س ${m}د`;
}

export default function SalesPage() {
  const { profile, loading } = useProfile('distributor');
  const [available, setAvailable] = useState([]);
  const [sold, setSold] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function loadData() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: avail }, { data: soldList }] = await Promise.all([
      supabase.from('cards').select('*, packages(name)').eq('assigned_to', profile.id).eq('status', 'with_distributor'),
      supabase.from('cards').select('*, packages(name)').eq('assigned_to', profile.id).eq('status', 'sold').gte('sold_at', since),
    ]);
    setAvailable(avail || []);
    setSold((soldList || []).sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at)));
  }

  useEffect(() => { if (profile) loadData(); }, [profile]);

  async function markSold(id) {
    setBusyId(id);
    await supabase.rpc('sell_card', { c_id: id });
    setBusyId(null);
    loadData();
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor/sales" name={profile.full_name} />
      <div className="main">
        <h1>مبيعاتي</h1>
        <p className="greet" style={{ marginBottom: 20 }}>الكروت المباعة تبقى ظاهرة لمدة 24 ساعة فقط ثم تختفي تلقائيًا</p>

        <div className="panel">
          <div className="panel-head"><h3>كروتي المتاحة للبيع</h3><span className="muted">{available.length}</span></div>
          {available.length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>لا توجد كروت متاحة لديك حاليًا</div>}
          <table>
            <thead><tr><th>الكود</th><th>الباقة</th><th></th></tr></thead>
            <tbody>
              {available.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.code}</td>
                  <td>{c.packages?.name}</td>
                  <td>
                    <button className="btn-sm btn-approve" disabled={busyId === c.id} onClick={() => markSold(c.id)}>
                      {busyId === c.id ? '...' : 'تسجيل كمباع'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>الكروت المباعة — آخر 24 ساعة</h3><span className="muted">{sold.length}</span></div>
          {sold.map((c) => (
            <div className="timer-row" key={c.id}>
              <div><div className="tcode mono">{c.code}</div><div className="tpkg">{c.packages?.name}</div></div>
              <div className="tleft">{timeLeft(c.sold_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
