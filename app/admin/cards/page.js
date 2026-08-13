'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

const statusLabel = { available: ['متاح', 'green'], with_distributor: ['مع موزع', 'amber'], sold: ['مباع', 'red'] };

export default function CardsPage() {
  const { profile, loading } = useProfile('admin');
  const [packages, setPackages] = useState([]);
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filterDate, setFilterDate] = useState('');

  const [code, setCode] = useState('');
  const [packageId, setPackageId] = useState('');
  const [error, setError] = useState('');

  async function loadAll() {
    const [{ data: pkgs }, { data: crds }] = await Promise.all([
      supabase.from('packages').select('*'),
      supabase.from('cards').select('*, packages(name)').order('created_at', { ascending: false }).limit(200),
    ]);
    setPackages(pkgs || []);
    setCards(crds || []);
  }

  useEffect(() => { if (profile) loadAll(); }, [profile]);

  async function addCard(e) {
    e.preventDefault();
    setError('');
    if (!code || !packageId) return;
    const { error: insertError } = await supabase.from('cards').insert({ code, package_id: packageId });
    if (insertError) { setError('تعذّرت إضافة الكرت — تأكد أن الرقم غير مكرر'); return; }
    setCode('');
    loadAll();
  }

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    await supabase.from('cards').delete().in('id', Array.from(selected));
    setSelected(new Set());
    loadAll();
  }

  async function deleteByDate() {
    if (!filterDate) return;
    const start = `${filterDate}T00:00:00`;
    const end = `${filterDate}T23:59:59`;
    await supabase.from('cards').delete().gte('created_at', start).lte('created_at', end).eq('status', 'available');
    loadAll();
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/cards" name={profile.full_name} />
      <div className="main">
        <h1>المخزون والكروت</h1>
        <p className="greet" style={{ marginBottom: 20 }}>إضافة الكروت يدويًا وإدارة الحذف</p>

        <div className="panel">
          <div className="panel-head"><h3>إضافة كرت يدويًا</h3></div>
          {error && <div className="error-note">{error}</div>}
          <form onSubmit={addCard} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label>رقم الكرت (تسلسلي بدون فواصل)</label>
              <input className="mono" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="72419038221501" />
            </div>
            <div className="field" style={{ marginBottom: 0, width: 200 }}>
              <label>الباقة</label>
              <select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                <option value="">اختر باقة</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button className="btn-primary" style={{ width: 140 }} type="submit">إضافة</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>حذف حسب التاريخ</h3>
            <span className="muted">يحذف فقط الكروت المتاحة (غير المباعة) بذلك التاريخ</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>التاريخ</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </div>
            <button className="btn-sm" style={{ background: 'var(--red)', color: '#fff', padding: '12px 18px' }} onClick={deleteByDate}>
              حذف كل كروت هذا التاريخ
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>قائمة الكروت (آخر 200)</h3>
            <span className="muted">{cards.length}</span>
          </div>
          <table>
            <thead><tr><th></th><th>الكود</th><th>الباقة</th><th>تاريخ الإضافة</th><th>الحالة</th></tr></thead>
            <tbody>
              {cards.map((c) => {
                const [label, color] = statusLabel[c.status] || ['—', 'amber'];
                return (
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                    <td className="mono">{c.code}</td>
                    <td>{c.packages?.name}</td>
                    <td>{new Date(c.created_at).toLocaleDateString('ar')}</td>
                    <td><span className={`pill ${color}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {selected.size > 0 && (
            <div className="del-bar">
              <span>تم تحديد {selected.size} كرت</span>
              <button onClick={deleteSelected}>حذف المحدد</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
