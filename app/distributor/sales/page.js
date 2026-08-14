'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  const [sold, setSold] = useState([]);

  async function loadData() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: soldList } = await supabase
      .from('cards')
      .select('*, packages(name)')
      .eq('assigned_to', profile.id)
      .eq('status', 'sold')
      .gte('sold_at', since);
    setSold((soldList || []).sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at)));
  }

  useEffect(() => { if (profile) loadData(); }, [profile]);

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor/sales" name={profile.full_name} />
      <div className="main">
        <h1>مبيعاتي</h1>
        <p className="greet" style={{ marginBottom: 20 }}>
          لإظهار كرت للبيع، روح إلى <Link href="/distributor" style={{ color: 'var(--grape)', fontWeight: 800 }}>الرئيسية</Link> واضغط "إظهار كرت" على الباقة
        </p>

        <div className="panel">
          <div className="panel-head">
            <h3>الكروت المباعة — آخر 24 ساعة</h3>
            <span className="muted">{sold.length}</span>
          </div>
          {sold.length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>لا توجد مبيعات خلال آخر 24 ساعة</div>}
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
