'use client';
import { useEffect, useState, useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function SalesPage() {
  const { profile, loading } = useProfile('distributor');
  const [sold, setSold] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // الشهر الحالي

  async function loadData() {
    if (!profile) return;

    // جلب كل المبيعات للموزع
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

  // الحسابات المالية الدقيقة
  const totalRevenue = filteredSold.reduce((sum, card) => sum + (card.packages?.price || 0), 0); // إجمالي مبيعات الشهر
  const totalCommission = totalRevenue * 0.10; // عمولة الموزع 10%
  const netDueToAdmin = totalRevenue - totalCommission; // الصافي المستحق للمدير (90%)
  const remainingInventoryValue = myCards.reduce((sum, card) => sum + (card.packages?.price || 0), 0); // قيمة المخزون الحالي
  const userDebt = profile?.debt_balance || 0; // العهدة والديون المسجلة من الأدمن

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

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor/sales" name={profile?.full_name} />
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

        {/* بطاقات الإحصائيات السريعة */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#F3F0FB', padding: '15px', borderRadius: 12, border: '1px solid #DDD6FE' }}>
            <div style={{ fontSize: 11, color: '#5B21B6', fontWeight: 700 }}>إيرادات الشهر</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1E1B4B', marginTop: 4 }}>{totalRevenue.toLocaleString()} ر.ي</div>
          </div>
          <div style={{ background: '#ECFDF5', padding: '15px', borderRadius: 12, border: '1px solid #A7F3D0' }}>
            <div style={{ fontSize: 11, color: '#065F46', fontWeight: 700 }}>عمولتك (10%)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#059669', marginTop: 4 }}>{totalCommission.toLocaleString()} ر.ي</div>
          </div>
        </div>

        {/* 1. ملخص مبيعات الشهر */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <h3>ملخص مبيعات الشهر</h3>
          {Object.keys(salesByPackage).length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', padding: '10px 0' }}>لا توجد مبيعات في هذا الشهر</div>
          )}
          {Object.entries(salesByPackage).map(([name, d]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderBottom: '1px solid #F3F4F6' }}>
              <span>{name}</span>
              <span style={{ fontWeight: 800 }}>{d.count} كرت ({d.revenue.toLocaleString()} ر.ي)</span>
            </div>
          ))}
        </div>

        {/* 2. بطاقة التقرير المالي والتصفية الشاملة (الجديدة كلياً) */}
        <div className="panel" style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: 18, marginBottom: 20 }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', pb: 10, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#0F172A' }}>كشف الحساب والتصفية المالية</h3>
            <span style={{ fontSize: 11, color: '#64748B' }}>موقف الحساب الحالي لشهر ({selectedMonth})</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* إجمالي المبيعات */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#475569' }}>إجمالي المبيعات للمواطنين:</span>
              <span style={{ fontWeight: 800 }}>{totalRevenue.toLocaleString()} ر.ي</span>
            </div>

            {/* خصم العمولة */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#059669' }}>
              <span>أرباحك وعمولتك المستقطعة (10%):</span>
              <span style={{ fontWeight: 800 }}>- {totalCommission.toLocaleString()} ر.ي</span>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #E2E8F0', margin: '4px 0' }} />

            {/* الصافي للشبكة */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 800, color: '#1E293B' }}>
              <span>الصافي الواجب تسليمه للشبكة (90%):</span>
              <span style={{ color: '#2563EB' }}>{netDueToAdmin.toLocaleString()} ر.ي</span>
            </div>

            {/* العهدة والديون إن وجدت */}
            {userDebt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#DC2626', background: '#FEF2F2', padding: '6px 10px', borderRadius: 8 }}>
                <span>عهد سابقة متبقية عليك:</span>
                <span style={{ fontWeight: 900 }}>{Number(userDebt).toLocaleString()} ر.ي</span>
              </div>
            )}

            {/* قيمة المخزون الحالي */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#475569', background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, marginTop: 4 }}>
              <span>قيمة الكروت المتبقية في مخزنك ({myCards.length} كرت):</span>
              <span style={{ fontWeight: 700 }}>{remainingInventoryValue.toLocaleString()} ر.i</span>
            </div>
          </div>
        </div>

        {/* 3. سجل المبيعات المفصل */}
        <div className="panel">
          <h3>سجل المبيعات المفصل</h3>
          {filteredSold.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', padding: '10px 0' }}>لا يوجد سجل مبيعات</div>
          )}
          {filteredSold.map((c) => (
            <div className="timer-row" key={c.id}>
              <div>
                <div className="tcode mono">{c.code}</div>
                <div className="tpkg">{c.packages?.name}</div>
              </div>
              <div className="tleft" style={{ fontSize: 11 }}>
                {new Date(c.sold_at).toLocaleDateString('ar-YE')}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
