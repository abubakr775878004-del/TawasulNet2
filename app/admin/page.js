'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import { AdSlotAdmin } from '../../components/AdSlot';
import WeeklyWinnerPanel from '../../components/WeeklyWinnerPanel';
import { useProfile } from '../../lib/useProfile';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const { profile, loading } = useProfile('admin');
  const [stats, setStats] = useState(null);
  const [salesStats, setSalesStats] = useState({ totalRevenue: 0, soldCardsCount: 0 });
  const [salesByPackage, setSalesByPackage] = useState({});
  const [recentSales, setRecentSales] = useState([]);
  
  // حالات جديدة لإدارة الموزعين والديون والسداد
  const [distributors, setDistributors] = useState([]);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  const formatNum = (num) => {
    const val = Math.round(Number(num) || 0);
    return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  async function loadData() {
    // 1. الإحصائيات الأساسية السابقة
    const [{ count: totalCards }, { count: availableCards }, { count: activeDist }, { count: pendingReq }] = await Promise.all([
      supabase.from('cards').select('*', { count: 'exact', head: true }),
      supabase.from('cards').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'distributor').eq('status', 'approved'),
      supabase.from('card_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setStats({ totalCards, availableCards, activeDist, pendingReq });

    // 2. جلب المبيعات والإيرادات المالية
    const { data: soldList } = await supabase
      .from('cards')
      .select('id, code, sold_at, packages(name, price)')
      .eq('status', 'sold')
      .order('sold_at', { ascending: false });

    let revenue = 0;
    let soldCount = 0;
    const pkgStats = {};

    (soldList || []).forEach(item => {
      soldCount += 1;
      const price = item.packages?.price || 0;
      revenue += price;

      const pkgName = item.packages?.name || 'غير محدد';
      if (!pkgStats[pkgName]) {
        pkgStats[pkgName] = { count: 0, total: 0 };
      }
      pkgStats[pkgName].count += 1;
      pkgStats[pkgName].total += price;
    });

    setSalesStats({ totalRevenue: revenue, soldCardsCount: soldCount });
    setSalesByPackage(pkgStats);
    setRecentSales((soldList || []).slice(0, 5));

    // 3. جلب قائمة الموزعين مع ديونهم الحالية (debt_balance)
    const { data: distData } = await supabase
      .from('profiles')
      .select('id, full_name, balance, debt_balance')
      .eq('role', 'distributor')
      .eq('status', 'approved');

    setDistributors(distData || []);
  }

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  // دالة تنفيذ السداد عبر استدعاء دالة قاعدة البيانات الآمنة (RPC)
  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!selectedDistributor || paymentBusy) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentMessage('❌ يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    setPaymentBusy(true);
    setPaymentMessage('');

    try {
      const { error } = await supabase.rpc('process_distributor_payment', {
        p_distributor_id: selectedDistributor.id,
        p_amount: amount
      });

      if (error) {
        console.error('Payment RPC error:', error);
        setPaymentMessage('❌ حدث خطأ أثناء تنفيذ عملية السداد');
        setPaymentBusy(false);
        return;
      }

      setPaymentMessage('✓ تم تسجيل السداد وتحديث رصيد الموزع بنجاح');
      setPaymentAmount('');
      
      // إعادة تحميل البيانات لتحديث الأرقام في الواجهة
      await loadData();

      setTimeout(() => {
        setSelectedDistributor(null);
        setPaymentMessage('');
      }, 1500);

    } catch (err) {
      console.error('Payment error:', err);
      setPaymentMessage('❌ حدث خطأ غير متوقع');
    } finally {
      setPaymentBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin" name={profile.full_name} />
      <div className="main">
        <div className="topbar">
          <div>
            <h1>نظرة عامة والتقارير</h1>
            <div className="greet">مرحبًا بعودتك يا {profile.full_name}</div>
          </div>
        </div>

        {/* شبكة الإحصائيات الأساسية */}
        <div className="grid-stats" style={{ marginBottom: 20 }}>
          <div className="stat"><div className="label">إجمالي الكروت</div><div className="value">{stats?.totalCards ?? '—'}</div></div>
          <div className="stat"><div className="label">كروت متاحة</div><div className="value">{stats?.availableCards ?? '—'}</div></div>
          <div className="stat"><div className="label">موزعون نشطون</div><div className="value">{stats?.activeDist ?? '—'}</div></div>
          <div className="stat"><div className="label">طلبات معلّقة</div><div className="value">{stats?.pendingReq ?? '—'}</div></div>
        </div>

        {/* بطاقات الإيرادات المالية والبيانات الاحترافية */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
          <div className="panel" style={{ margin: 0, padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>إجمالي الإيرادات المالية</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#7C3AED', marginTop: 5 }}>
              {salesStats.totalRevenue.toLocaleString()} <span style={{ fontSize: 12 }}>ريال</span>
            </div>
          </div>
          <div className="panel" style={{ margin: 0, padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>إجمالي الكروت المباعة</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#10B981', marginTop: 5 }}>{salesStats.soldCardsCount}</div>
          </div>
        </div>

        {/* لوحة إدارة مسابقة السحب الأسبوعي للمدير */}
        <WeeklyWinnerPanel />

        {/* لوحة إدارة الديون وسداد الموزعين */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>ديون ومستحقات الموزعين</h3>
            <span className="muted">إدارة السداد والأرصدة</span>
          </div>

          {distributors.length === 0 ? (
            <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>لا توجد حسابات موزعين مسجلة حالياً</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {distributors.map((dist) => {
                const debt = Number(dist.debt_balance || 0);
                return (
                  <div key={dist.id} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' 
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E293B' }}>{dist.full_name}</div>
                      <div style={{ fontSize: '12px', color: debt > 0 ? '#DC2626' : '#059669', fontWeight: '700', marginTop: 2 }}>
                        المستحق للمدير: {formatNum(debt)} ريال
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDistributor(dist);
                        setPaymentAmount('');
                        setPaymentMessage('');
                      }}
                      style={{
                        background: '#7C3AED', color: '#fff', border: 'none',
                        padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      تسجيل سداد
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* تحليل المبيعات حسب الباقات */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h3>تحليل المبيعات حسب الباقات</h3>
          </div>
          {Object.keys(salesByPackage).length === 0 ? (
            <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>لا توجد مبيعات مسجلة بعد</div>
          ) : (
            Object.entries(salesByPackage).map(([name, data]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F0FB', fontSize: 13.5 }}>
                <span style={{ fontWeight: 800, color: '#3A1D66' }}>{name}</span>
                <span style={{ color: '#5B21B6', fontWeight: 700 }}>
                  {data.count} كروت — <b style={{ color: '#10B981' }}>{data.total.toLocaleString()} ريال</b>
                </span>
              </div>
            ))
          )}
        </div>

        {/* آخر المبيعات المسجلة */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h3>آخر المبيعات في النظام</h3>
          </div>
          {recentSales.length === 0 ? (
            <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>لا توجد عمليات بيع حديثة</div>
          ) : (
            recentSales.map((c) => (
              <div className="timer-row" key={c.id}>
                <div>
                  <div className="tcode mono">{c.code}</div>
                  <div className="tpkg">{c.packages?.name} — {c.packages?.price} ريال</div>
                </div>
                <div className="tleft" style={{ fontSize: 11.5 }}>
                  {new Date(c.sold_at).toLocaleDateString('ar-YE')}
                </div>
              </div>
            ))
          )}
        </div>

        <AdSlotAdmin />
      </div>

      {/* نافذة تسجيل السداد (Modal) */}
      {selectedDistributor && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 22, maxWidth: 360, width: '100%',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden'
          }}>
            <div style={{ background: 'linear-gradient(120deg, #5B21B6, #7C3AED)', padding: '22px 20px', color: '#fff' }}>
              <div style={{ fontSize: 12, color: '#E3D6FF', fontWeight: 700, marginBottom: 4 }}>تسجيل سداد للموزع</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{selectedDistributor.full_name}</div>
            </div>

            <form onSubmit={handlePaymentSubmit} style={{ padding: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12, textAlign: 'right' }}>
                الدين الحالي: <b style={{ color: '#DC2626' }}>{formatNum(selectedDistributor.debt_balance)} ريال</b>
              </div>

              <div style={{ textAlign: 'right', marginBottom: 15 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  المبلغ المدفوع (ريال):
                </label>
                <input
                  type="number"
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="أدخل المبلغ المسدد"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid var(--line)', fontSize: '13.5px'
                  }}
                  disabled={paymentBusy}
                />
              </div>

              {paymentMessage && (
                <div style={{
                  fontSize: 12.5, fontWeight: 700, marginBottom: 12,
                  color: paymentMessage.startsWith('✓') ? '#10B981' : '#DC2626'
                }}>
                  {paymentMessage}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setSelectedDistributor(null)}
                  disabled={paymentBusy}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12,
                    border: '1.5px solid var(--line)', background: '#fff', fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={paymentBusy || !paymentAmount}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(120deg, #7C3AED, #DB2777)', color: '#fff', fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  {paymentBusy ? 'جاري الحفظ...' : 'تأكيد السداد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
