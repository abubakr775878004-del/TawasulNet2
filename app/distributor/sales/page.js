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
  const [timeFilter, setTimeFilter] = useState('today'); // 'today', '14days', 'month'

  async function loadData(filter) {
    if (!profile) return;

    let sinceDate = new Date();
    if (filter === 'today') {
      sinceDate.setHours(0, 0, 0, 0);
    } else if (filter === '14days') {
      sinceDate.setDate(sinceDate.getDate() - 14);
    } else if (filter === 'month') {
      sinceDate.setDate(sinceDate.getDate() - 30);
    }

    const { data: soldList } = await supabase
      .from('cards')
      .select('*, packages(name, price)')
      .eq('assigned_to', profile.id)
      .eq('status', 'sold')
      .gte('sold_at', sinceDate.toISOString());

    setSold((soldList || []).sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at)));
  }

  useEffect(() => { 
    if (profile) loadData(timeFilter); 
  }, [profile, timeFilter]);

  // حساب إجمالي قيمة المبيعات للفترة الحالية
  const totalRevenue = sold.reduce((sum, card) => sum + (card.packages?.price || 0), 0);

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor/sales" name={profile.full_name} />
      <div className="main">
        <h1>مبيعاتي</h1>
        <p className="greet" style={{ marginBottom: 20 }}>
          لإظهار كرت للبيع، روح إلى <Link href="/distributor" style={{ color: 'var(--grape)', fontWeight: 800 }}>الرئيسية</Link> واضغط "إظهار كرت" على الباقة
        </p>

        {/* أزرار الفلترة الزمنية */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => setTimeFilter('today')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              background: timeFilter === 'today' ? 'var(--grape, #7C3AED)' : '#F3F0FB',
              color: timeFilter === 'today' ? '#fff' : '#5B21B6',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            اليوم
          </button>
          <button
            onClick={() => setTimeFilter('14days')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              background: timeFilter === '14days' ? 'var(--grape, #7C3AED)' : '#F3F0FB',
              color: timeFilter === '14days' ? '#fff' : '#5B21B6',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            آخر أسبوعين
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              background: timeFilter === 'month' ? 'var(--grape, #7C3AED)' : '#F3F0FB',
              color: timeFilter === 'month' ? '#fff' : '#5B21B6',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            خلال شهر
          </button>
        </div>

        {/* شريط ملخص المبيعات والإيرادات للفترة */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#fff', padding: '16px', borderRadius: 16, border: '1.5px solid var(--line, #E5E7EB)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>عدد الكروت المباعة</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#3A1D66', marginTop: 4 }}>{sold.length}</div>
          </div>
          <div style={{ background: '#fff', padding: '16px', borderRadius: 16, border: '1.5px solid var(--line, #E5E7EB)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>إجمالي الإيرادات</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#3A1D66', marginTop: 4 }}>
              {totalRevenue.toLocaleString('en-US')} <span style={{ fontSize: 12 }}>ريال</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>
              {timeFilter === 'today' && 'الكروت المباعة — اليوم'}
              {timeFilter === '14days' && 'الكروت المباعة — آخر أسبوعين'}
              {timeFilter === 'month' && 'الكروت المباعة — خلال شهر'}
            </h3>
            <span className="muted">{sold.length}</span>
          </div>
          {sold.length === 0 && (
            <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>
              لا توجد مبيعات مسجلة في هذه الفترة
            </div>
          )}
          {sold.map((c) => (
            <div className="timer-row" key={c.id}>
              <div>
                <div className="tcode mono">{c.code}</div>
                <div className="tpkg">{c.packages?.name}</div>
              </div>
              <div className="tleft">
                {timeFilter === 'today' ? timeLeft(c.sold_at) : new Date(c.sold_at).toLocaleDateString('ar-YE')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
