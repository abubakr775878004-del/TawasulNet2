'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function ReportsPage() {
  const { profile, loading } = useProfile('admin');
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(true);

  async function loadReport() {
    setBusy(true);

    let since = null;
    if (filter === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      since = d.toISOString();
    } else if (filter === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      since = d.toISOString();
    }

    const [{ data: distributors }, { data: heldCards }, salesQuery] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('role', 'distributor'),
      supabase.from('cards').select('assigned_to, packages(price)').eq('status', 'with_distributor'),
      (() => {
        let q = supabase.from('sales_log').select('distributor_id, distributor_name, price, sold_at');
        if (since) q = q.gte('sold_at', since);
        return q;
      })(),
    ]);

    const { data: sales } = salesQuery;

    const map = {};
    (distributors || []).forEach((d) => {
      map[d.id] = { name: d.full_name, heldCount: 0, heldValue: 0, salesCount: 0, salesValue: 0 };
    });

    (heldCards || []).forEach((c) => {
      if (!map[c.assigned_to]) return;
      map[c.assigned_to].heldCount += 1;
      map[c.assigned_to].heldValue += c.packages?.price || 0;
    });

    (sales || []).forEach((s) => {
      if (!map[s.distributor_id]) {
        map[s.distributor_id] = { name: s.distributor_name, heldCount: 0, heldValue: 0, salesCount: 0, salesValue: 0 };
      }
      map[s.distributor_id].salesCount += 1;
      map[s.distributor_id].salesValue += Number(s.price);
    });

    const result = Object.values(map).sort((a, b) => b.salesValue - a.salesValue);
    setRows(result);
    setBusy(false);
  }

  useEffect(() => { if (profile) loadReport(); }, [profile, filter]);

  if (loading) return null;

  const filterLabel = { all: 'الكل', month: 'آخر 30 يومًا', week: 'آخر 7 أيام' };

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/reports" name={profile.full_name} />
      <div className="main">
        <h1>التقارير</h1>
        <p className="greet" style={{ marginBottom: 20 }}>مقارنة أداء الموزعين — الكروت الموجودة عندهم والمبيعات الفعلية</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {['all', 'month', 'week'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '9px 18px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                background: filter === f ? 'linear-gradient(120deg, #7C3AED, #DB2777)' : '#F3F0FB',
                color: filter === f ? '#fff' : '#5B21B6',
              }}
            >
              {filterLabel[f]}
            </button>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head"><h3>مقارنة الموزعين</h3><span className="muted">{rows.length}</span></div>
          {busy && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>جاري التحميل...</div>}
          {!busy && rows.length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>لا توجد بيانات بعد</div>}

          {!busy && rows.map((r, i) => (
            <div
              key={i}
              style={{
                borderTop: '1px solid var(--line)', padding: '14px 4px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14 }}>{r.name}</div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>كروت لديه الآن</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                    {r.heldCount} كرت — {r.heldValue.toLocaleString('en-US')} ريال
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>مبيعات ({filterLabel[filter]})</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#10B981' }}>
                    {r.salesCount} كرت — {r.salesValue.toLocaleString('en-US')} ريال
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
