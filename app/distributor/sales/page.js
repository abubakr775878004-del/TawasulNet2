'use client';
import { useEffect, useState, useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

function formatNumericDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export default function SalesPage() {
  const { profile, loading } = useProfile('distributor');
  const [sold, setSold] = useState([]);
  const [myCards, setMyCards] = useState([]);

  // الحسابات الزمنية بالأرقام فقط
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(String(currentDate.getMonth() + 1).padStart(2, '0'));

  // الشهر المحدد بصيغة YYYY-MM
  const selectedMonth = `${selectedYear}-${selectedMonthNum}`;

  async function loadData() {
    if (!profile) return;

    const { data: soldList } = await supabase
      .from('cards')
      .select('*, packages(name, price)')
      .eq('assigned_to', profile.id)
      .eq('status', 'sold');

    setSold((soldList || []).sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at)));

    const { data: inventoryList } = await supabase
      .from('cards')
      .select('*, packages(name, price)')
      .eq('assigned_to', profile.id)
      .eq('status', 'with_distributor');

    setMyCards(inventoryList || []);
  }

  useEffect(() => { if (profile) loadData(); }, [profile]);

  const filteredSold = useMemo(() => {
    return sold.filter(c => c.sold_at.startsWith(selectedMonth));
  }, [sold, selectedMonth]);

  const totalRevenue = filteredSold.reduce((sum, card) => sum + (card.packages?.price || 0), 0);
  const totalCommission = totalRevenue * 0.10;
  const netDueToAdmin = totalRevenue - totalCommission;
  const remainingInventoryValue = myCards.reduce((sum, card) => sum + (card.packages?.price || 0), 0);
  const userDebt = profile?.debt_balance || 0;

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
        
        {/* اختيار الشهر والسنة بالأرقام الصريحة 100% */}
        <div style={{ marginBottom: 20, background: '#FFFFFF', padding: 14, borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>
            تحديد تقرير الشهر (أرقام):
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* قائمة السنة */}
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontWeight: 800, fontSize: 14 }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>

            {/* قائمة الأشهر بالرقم من 01 إلى 12 */}
            <select 
              value={selectedMonthNum} 
              onChange={(e) => setSelectedMonthNum(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontWeight: 800, fontSize: 14, direction: 'ltr' }}
            >
              <option value="01">شهر 01</option>
              <option value="02">شهر 02</option>
              <option value="03">شهر 03</option>
              <option value="04">شهر 04</option>
              <option value="05">شهر 05</option>
              <option value="06">شهر 06</option>
              <option value="07">شهر 07</option>
              <option value="08">شهر 08</option>
              <option value="09">شهر 09</option>
              <option value="10">شهر 10</option>
              <option value="11">شهر 11</option>
              <option value="12">شهر 12</option>
            </select>
          </div>
        </div>

        {/* بطاقات الإحصائيات السريعة */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#F3F0FB', padding: '14px', borderRadius: 14, border: '1px solid #DDD6FE' }}>
            <div style={{ fontSize: 11, color: '#6D28D9', fontWeight: 700 }}>إيرادات الشهر</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4C1D95', marginTop: 2 }}>{totalRevenue.toLocaleString()} <span style={{ fontSize: 11 }}>ر.ي</span></div>
          </div>
          <div style={{ background: '#ECFDF5', padding: '14px', borderRadius: 14, border: '1px solid #A7F3D0' }}>
            <div style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>عمولتك (10%)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#059669', marginTop: 2 }}>{totalCommission.toLocaleString()} <span style={{ fontSize: 11 }}>ر.ي</span></div>
          </div>
        </div>

        {/* 1. ملخص مبيعات الشهر */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <h3>ملخص مبيعات الشهر</h3>
          {Object.keys(salesByPackage).length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', padding: '10px 0' }}>لا توجد مبيعات في هذا الشهر</div>
          )}
          {Object.entries(salesByPackage).map(([name, d]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>{name}</span>
              <span style={{ fontWeight: 800, color: '#111827' }}>{d.count} كرت <span style={{ color: '#6B7280', fontWeight: 500 }}>({d.revenue.toLocaleString()} ر.ي)</span></span>
            </div>
          ))}
        </div>

        {/* 2. بطاقة التقرير المالي والتصفية الشاملة */}
        <div className="panel" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 20 }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#0F172A' }}>كشف الحساب والتصفية المالية</h3>
              <span style={{ fontSize: 12, color: '#0284C7', fontWeight: 800, fontFamily: 'monospace' }}>
                موقف الحساب لشهر: {selectedYear} / {selectedMonthNum}
              </span>
            </div>
            <span style={{ background: '#F1F5F9', color: '#475569', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6 }}>10% صافي</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: '#F8FAFC', padding: '10px 12px', borderRadius: 10 }}>
              <span style={{ color: '#475569', fontWeight: 600 }}>إجمالي المبيعات للمواطنين:</span>
              <span style={{ fontWeight: 900, fontSize: 14, color: '#0F172A' }}>{totalRevenue.toLocaleString()} ر.ي</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: '#ECFDF5', padding: '10px 12px', borderRadius: 10, border: '1px solid #D1FAE5' }}>
              <span style={{ color: '#065F46', fontWeight: 700 }}>أرباحك وعمولتك المستقطعة (10%):</span>
              <span style={{ fontWeight: 900, fontSize: 14, color: '#059669' }}>- {totalCommission.toLocaleString()} ر.ي</span>
            </div>

            <div style={{ background: '#1E293B', color: '#FFFFFF', padding: '14px 16px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>الصافي الواجب تسليمه للشبكة (90%):</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#38BDF8', marginTop: 2 }}>{netDueToAdmin.toLocaleString()} <span style={{ fontSize: 12, color: '#94A3B8' }}>ر.ي</span></div>
              </div>
              <div style={{ background: '#0F172A', padding: '6px 12px', borderRadius: 8, fontSize: 11, color: '#E2E8F0', fontWeight: 700 }}>
                مطلوب تسليمه
              </div>
            </div>

            {userDebt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#991B1B', background: '#FEF2F2', padding: '8px 12px', borderRadius: 10, border: '1px solid #FECACA' }}>
                <span style={{ fontWeight: 700 }}>عهدة متبقية سابقة عليك:</span>
                <span style={{ fontWeight: 900 }}>{Number(userDebt).toLocaleString()} ر.ي</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748B', background: '#FAF5FF', padding: '10px 12px', borderRadius: 10, border: '1px solid #F3E8FF', marginTop: 2 }}>
              <span style={{ fontWeight: 600, color: '#6B21A8' }}>قيمة الكروت المتبقية في مخزنك ({myCards.length} كرت):</span>
              <span style={{ fontWeight: 800, color: '#7E22CE', fontSize: 13 }}>{remainingInventoryValue.toLocaleString()} ر.ي</span>
            </div>
          </div>
        </div>

        {/* 3. سجل المبيعات المفصل بالتواريخ الرقمية الكاملة YYYY/MM/DD */}
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
              <div className="tleft mono" style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                {formatNumericDate(c.sold_at)}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
