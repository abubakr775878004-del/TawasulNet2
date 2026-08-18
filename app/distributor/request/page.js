'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function RequestCardsPage() {
  const { profile, loading } = useProfile('distributor');
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function loadData() {
    const [{ data: pkgs }, { data: reqs }] = await Promise.all([
      supabase.from('packages').select('*'),
      supabase.from('card_requests').select('*, packages(name)').eq('distributor_id', profile.id).order('created_at', { ascending: false }),
    ]);
    setPackages(pkgs || []);
    setMyRequests(reqs || []);
  }

  useEffect(() => { if (profile) loadData(); }, [profile]);

  const parsedQty = parseInt(quantity, 10) || 0;
  const selectedPkg = packages.find((p) => p.id === packageId);
  const total = selectedPkg ? (selectedPkg.price * parsedQty).toFixed(2) : 0;

  async function submitRequest(e) {
    e.preventDefault();
    setError(''); setDone(false);
    if (!packageId || parsedQty < 1) return;

    // 1) حفظ طلب الكروت في قاعدة البيانات أولاً
    const { error: insertError } = await supabase.from('card_requests').insert({
      distributor_id: profile.id, 
      package_id: packageId, 
      quantity: parsedQty,
    });

    if (insertError) { 
      setError(insertError.message); 
      return; 
    }

    setDone(true);

    // 2) إرسال إشعار إلى تليجرام تلقائياً
    try {
      const packageName = selectedPkg ? selectedPkg.name : 'باقة غير معروفةة';
      const telegramContent = `طلب كروت جديد:\n📦 الباقة: ${packageName}\n🔢 الكمية: ${parsedQty}\n💰 الإجمالي: ${total} ريال`;

      await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distributor_name: profile.full_name,
          content: telegramContent,
        }),
        cache: 'no-store',
      });
    } catch (telegramError) {
      console.error('Telegram notification error for card request:', telegramError);
    }

    setQuantity('');
    setPackageId('');
    loadData();
  }

  async function deleteRequest(id) {
    setBusyId(id);
    await supabase.from('card_requests').delete().eq('id', id);
    setBusyId(null);
    loadData();
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor/request" name={profile.full_name} />
      <div className="main">
        <h1>طلب كروت جديد</h1>
        <p className="greet" style={{ marginBottom: 20 }}>يُخصم المبلغ من رصيدك تلقائيًا فور موافقة المدير</p>

        <div className="panel">
          {error && <div className="error-note">{error}</div>}
          {done && <div className="pending-note">✅ تم إرسال طلبك وحفظه، وتم إشعار المدير بنجاح</div>}
          <form onSubmit={submitRequest} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label>الباقة</label>
              <select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                <option value="">اختر باقة</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.price} ريال/كرت</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0, width: 140 }}>
              <label>الكمية</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : e.target.value)}
              />
            </div>
            <button className="btn-primary" style={{ width: 160 }} type="submit">
              إرسال الطلب {selectedPkg && parsedQty > 0 ? `(${total} ريال)` : ''}
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>طلباتي السابقة</h3><span className="muted">{myRequests.length}</span></div>
          <table>
            <thead><tr><th>الباقة</th><th>الكمية</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {myRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.packages?.name}</td>
                  <td>{r.quantity}</td>
                  <td>
                    <span className={`pill ${r.status === 'fulfilled' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}`}>
                      {r.status === 'fulfilled' ? 'تم التنفيذ' : r.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-sm"
                      style={{ backgroundColor: '#dc2626', color: '#ffffff', opacity: 1, padding: '6px 14px', borderRadius: '6px', border: 'none' }}
                      disabled={busyId === r.id}
                      onClick={() => deleteRequest(r.id)}
                    >
                      حذف
                    </button>
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
