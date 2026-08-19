'use client';
import { useEffect, useState, useMemo } from 'react';
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
  const [myCards, setMyCards] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // الشهر الحالي

  async function loadData() {
    if (!profile) return;

    // جلب كل المبيعات للموزع (لنقوم بفلترتها برمجياً حسب الشهر)
    const { data: soldList } = await supabase
      .from('cards')
      .select('*, packages(name, price)')
      .eq('assigned_to', profile.id)
      .eq('status', 'sold');

    setSold((soldList || []).sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at)));

    // جلب المخزون الحالي
    const { data: inventoryList } = await supabase
      .from('cards')
      .select('*, packages(name, price)')
      .eq('assigned_to', profile.id)
      .eq('status', 'with_distributor');

    setMyCards(inventoryList || []);
  }

  useEffect(() => { if (profile) loadData(); }, [profile]);

  // فلترة المبيعات بناءً على الشهر المختار
  const filteredSold = useMemo(() => {
    return sold.filter(c => c.sold_at.startsWith(selectedMonth));
  }, [sold, selectedMonth]);

  const totalRevenue = filteredSold.reduce((sum, card) => sum + (card.packages?.price || 0), 0);
  const totalCommission = totalRevenue * 0.10;
  const remainingInventoryValue = myCards.reduce((sum, card) => sum + (card.packages?.price || 0), 0);

  const salesByPackage = useMemo(() => {
    const data = {};
    filteredSold.forEach((c) => {
      const name = c.packages?.name || 'غير محدد';
      if (!data[name]) data[name] = { count: 0, revenue: 0 };
      data[name].count += 1;
      data[name].revenue += (c.packages?.price || 0);
    });
    return data;
  }, [filteredSold]);

  const inventoryByPackage = useMemo(() => {
    const data = {};
    myCards.forEach((c) => {
      const name = c.packages?.name || 'غير محدد';
      data[name] = (data[name] || 0) + 1;
    });
    return data;
  }, [myCards]);

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor/sales" name={profile.full_name} />
      <div className="main">
        <h1>سجل المبيعات والتقارير</h1>
        
        {/* اختيار الشهر */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>استعراض تقرير شهر:</label>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ display: 'block', padding: '8px', borderRadius: 8, border: '1px solid #E5E7EB', width: '100%', marginTop: 5 }}
          />
        </div>

        {/* بطاقات الإحصائيات */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#F3F0FB', padding: '15px', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#5B21B6' }}>إيرادات الشهر</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{totalRevenue.toLocaleString()} ر.ي</div>
          </div>
          <div style={{ background: '#ECFDF5', padding: '15px', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#065F46' }}>عمولتك (10%)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#059669' }}>{totalCommission.toLocaleString()} ر.ي</div>
          </div>
        </div>

        {/* تحليل وتفاصيل */}
        <div className="panel">
          <h3>ملخص مبيعات الشهر</h3>
          {Object.entries(salesByPackage).map(([name, d]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
              <span>{name}</span>
              <span style={{ fontWeight: 800 }}>{d.count} كرت ({d.revenue} ر.ي)</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3>المخزون الحالي ({myCards.length} كرت)</h3>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 10 }}>قيمة الرصيد المتبقي: {remainingInventoryValue.toLocaleString()} ر.ي</div>
          {Object.entries(inventoryByPackage).map(([name, count]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
              <span>{name}</span>
              <span style={{ color: count < 5 ? 'red' : 'green' }}>{count} متوفر</span>
            </div>
          ))}
        </div>

        {/* سجل الكروت المباعة */}
        <div className="panel">
          <h3>سجل المبيعات المفصل</h3>
          {filteredSold.map((c) => (
            <div className="timer-row" key={c.id}>
              <div><div className="tcode mono">{c.code}</div><div className="tpkg">{c.packages?.name}</div></div>
              <div className="tleft" style={{ fontSize: 11 }}>{new Date(c.sold_at).toLocaleDateString('ar-YE')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
