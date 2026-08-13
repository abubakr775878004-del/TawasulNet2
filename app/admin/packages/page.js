'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function PackagesPage() {
  const { profile, loading } = useProfile('admin');
  const [packages, setPackages] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');

  async function loadPackages() {
    const { data } = await supabase.from('packages').select('*').order('created_at', { ascending: false });
    setPackages(data || []);
  }

  useEffect(() => { if (profile) loadPackages(); }, [profile]);

  async function addPackage(e) {
    e.preventDefault();
    setError('');
    if (!name || !price) return;
    const { error: insertError } = await supabase.from('packages').insert({ name, price: parseFloat(price) });
    if (insertError) { setError(insertError.message); return; }
    setName(''); setPrice('');
    loadPackages();
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/packages" name={profile.full_name} />
      <div className="main">
        <h1>الباقات</h1>
        <p className="greet" style={{ marginBottom: 20 }}>إدارة باقات الكروت وأسعارها</p>

        <div className="panel">
          <div className="panel-head"><h3>إضافة باقة جديدة</h3></div>
          {error && <div className="error-note">{error}</div>}
          <form onSubmit={addPackage} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
              <label>اسم الباقة</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: باقة 20GB" />
            </div>
            <div className="field" style={{ marginBottom: 0, width: 140 }}>
              <label>السعر (لكل كرت)</label>
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="25" />
            </div>
            <button className="btn-primary" style={{ width: 140 }} type="submit">إضافة</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>الباقات الحالية</h3><span className="muted">{packages.length}</span></div>
          <table>
            <thead><tr><th>الاسم</th><th>السعر</th><th>تاريخ الإنشاء</th></tr></thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.price} ريال</td>
                  <td>{new Date(p.created_at).toLocaleDateString('ar')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
