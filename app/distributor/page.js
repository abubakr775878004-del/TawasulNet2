'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import { AdSlotBar } from '../../components/AdSlot';
import WeeklyWinnerPanel from '../../components/WeeklyWinnerPanel';
import { useProfile } from '../../lib/useProfile';
import { supabase } from '../../lib/supabase';

export default function DistributorPage() {
  const { profile, loading } = useProfile('distributor');

  const [myCards, setMyCards] = useState([]);
  const [soldToday, setSoldToday] = useState(0);
  const [recentSales, setRecentSales] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // حالة العهدة المحسوبة تلقائياً
  const [calculatedDebt, setCalculatedDebt] = useState(0);

  const [pendingPackage, setPendingPackage] = useState(null);
  const [customerName, setCustomerName] = useState('');

  const [revealedCard, setRevealedCard] = useState(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [copied, setCopied] = useState(false);

  const [personalCopied, setPersonalCopied] = useState(false);

  const [noteContent, setNoteContent] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');

  async function load() {
    if (!profile) return;
    setIsRefreshing(true);

    try {
      // 1. جلب الكروت المتاحة حالياً
      const { data } = await supabase
        .from('cards')
        .select('*, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'with_distributor');

      setMyCards(data || []);

      const since = new Date();
      since.setHours(0, 0, 0, 0);

      // 2. عدد مبيعات اليوم
      const { count } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString());

      setSoldToday(count || 0);

      // 3. آخر مبيعات اليوم
      const { data: salesData } = await supabase
        .from('cards')
        .select('id, code, sold_at, customer_name, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString())
        .order('sold_at', { ascending: false })
        .limit(10);

      setRecentSales(salesData || []);

      // 4. حساب إجمالي المبيعات التراكمية للموزع (حصة الإدارة 90%)
      const { data: allSoldCards } = await supabase
        .from('cards')
        .select('packages(price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'sold');

      const totalSalesAmount = (allSoldCards || []).reduce(
        (sum, card) => sum + (card.packages?.price || 0),
        0
      );
      const totalRequiredFromSales = totalSalesAmount * 0.9;

      // 5. جلب إجمالي السدادات النقديّة المسجلة من المدير
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('amount')
        .eq('distributor_id', profile.id);

      const totalPayments = (paymentsData || []).reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );

      // 6. حساب صافي الدين المترتب
      const netDebt = Math.max(0, totalRequiredFromSales - totalPayments);
      setCalculatedDebt(netDebt);

    } catch (err) {
      console.error('Error loading distributor data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (profile) {
      load();
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [profile]);

  function askReveal(pkgId, pkgName) {
    setRevealError('');
    setCustomerName('');
    setPendingPackage({
      id: pkgId,
      name: pkgName,
    });
  }

  function cancelReveal() {
    if (revealBusy) return;
    setPendingPackage(null);
    setCustomerName('');
  }

  async function confirmReveal() {
    if (!pendingPackage || !profile || revealBusy) return;

    setRevealBusy(true);
    setRevealError('');

    try {
      const { data, error } = await supabase
        .from('cards')
        .select('id, code')
        .eq('assigned_to', profile.id)
        .eq('package_id', pendingPackage.id)
        .eq('status', 'with_distributor')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) {
        setRevealError('تعذّر إيجاد كرت متاح من هذه الباقة');
        setPendingPackage(null);
        setRevealBusy(false);
        return;
      }

      const card = data[0];
      const trimmedCustomerName = customerName.trim();

      const { error: updateError } = await supabase
        .from('cards')
        .update({
          status: 'sold',
          sold_at: new Date().toISOString(),
          customer_name: trimmedCustomerName !== '' ? trimmedCustomerName : null,
        })
        .eq('id', card.id);

      if (updateError) {
        console.error('Update card error:', updateError);
        setRevealError('حدث خطأ أثناء حفظ بيانات البيع');
        setRevealBusy(false);
        return;
      }

      setRevealedCard({
        code: card.code,
        packageName: pendingPackage.name,
      });

      setPendingPackage(null);
      setCustomerName('');
      setCopied(false);

      await load();
    } catch (error) {
      console.error('Confirm reveal error:', error);
      setRevealError('حدث خطأ غير متوقع، حاول مرة أخرى');
    } finally {
      setRevealBusy(false);
    }
  }

  function closeModal() {
    setRevealedCard(null);
    setCopied(false);
  }

  async function copyCode() {
    if (!revealedCard) return;

    try {
      await navigator.clipboard.writeText(revealedCard.code);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Copy code error:', error);
    }
  }

  async function copyPersonalCode(codeText) {
    if (!codeText) return;

    try {
      await navigator.clipboard.writeText(codeText);
      setPersonalCopied(true);
      setTimeout(() => {
        setPersonalCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Copy personal card error:', error);
    }
  }

  function shareWhatsapp() {
    if (!revealedCard) return;

    const dailyReminders = [
      'أكثروا من الصلاة على النبي (صل الله عليه وسلم)',
      'سبحان الله وبحمده، سبحان الله العظيم',
      'لا تنسَ ذكر الله، فبذكره تطمئن القلوب',
      'اللهم صل وسلم وبارك على نبينا محمد',
      'استغفر الله وأكثر من ذكره',
      'الحمد لله على كل نعمة',
      'اتقِ الله واجعل الخير طريقك دائمًا',
      'اللهم اجعل يومكم خيرًا وبركة',
      'من توكل على الله كفاه'
    ];

    const dailyReminder =
      dailyReminders[
        Math.floor(Math.random() * dailyReminders.length)
      ];

    const now = new Date();

    const saleDate = now.toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const saleTime = now.toLocaleTimeString('ar-YE', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const text = `🌐 *شبكة تواصل*

🎫 *كرت الإنترنت*

\`${revealedCard.code}\`

📦 *الباقة:* ${revealedCard.packageName}
📅 ${saleDate} | 🕐 ${saleTime}

✨ ${dailyReminder}

*شكرًا لاختياركم شبكة تواصل*`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  }

  async function sendNoteToAdmin(e) {
    e.preventDefault();

    if (!profile || noteBusy) {
      return;
    }

    const content = noteContent.trim();

    if (!content) {
      setNoteMessage('⚠️ اكتب الرسالة أولًا');
      return;
    }

    setNoteBusy(true);
    setNoteMessage('');

    try {
      const { error: dbError } = await supabase
        .from('distributor_notes')
        .insert({
          distributor_id: profile.id,
          distributor_name: profile.full_name,
          content: content,
        });

      if (dbError) {
        setNoteMessage('❌ تعذّر حفظ الرسالة، حاول مرة أخرى');
        return;
      }

      let telegramSuccess = false;

      try {
        const telegramResponse = await fetch('/api/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            distributor_name: profile.full_name,
            content: content,
          }),
          cache: 'no-store',
        });

        let telegramResult = null;
        try {
          telegramResult = await telegramResponse.json();
        } catch (jsonError) {}

        if (telegramResponse.ok && telegramResult?.success === true) {
          telegramSuccess = true;
        }
      } catch (telegramError) {}

      setNoteContent('');

      if (telegramSuccess) {
        setNoteMessage('✓ تم إرسال رسالتك للمدير بنجاح');
      } else {
        setNoteMessage('✓ تم حفظ رسالتك، لكن تعذر إرسال إشعار تيليجرام');
      }

      setTimeout(() => {
        setNoteMessage('');
      }, 4000);

    } catch (error) {
      setNoteMessage('❌ حدث خطأ غير متوقع، حاول مرة أخرى');
    } finally {
      setNoteBusy(false);
    }
  }

  if (loading || !profile) {
    return null;
  }

  const byPackage = {};

  myCards.forEach((c) => {
    const key = c.packages?.name || 'غير محدد';

    if (!byPackage[key]) {
      byPackage[key] = {
        count: 0,
        packageId: c.package_id,
        price: c.packages?.price || 0,
      };
    }

    byPackage[key].count += 1;
  });

  const totalValue = Object.values(byPackage).reduce(
    (sum, p) => sum + p.count * p.price,
    0
  );

  return (
    <div className="app">
      <Sidebar
        role="distributor"
        active="/distributor"
        name={profile.full_name}
      />

      <div className="main">
        <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>
              مرحبًا، {profile.full_name} 👋
            </h1>

            <div className="greet">
              إليك ملخص حسابك اليوم
            </div>
          </div>

          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 6, 
            background: isOnline ? '#ECFDF5' : '#FEF2F2', 
            color: isOnline ? '#059669' : '#DC2626', 
            padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 800,
            border: `1px solid ${isOnline ? '#A7F3D0' : '#FECACA'}`
          }}>
            <span style={{ 
              width: 7, height: 7, borderRadius: '50%', 
              background: isOnline ? '#10B981' : '#EF4444',
              display: 'inline-block',
              boxShadow: isOnline ? '0 0 6px #10B981' : 'none'
            }}></span>
            {isOnline ? 'نشط' : 'خامل'}
          </div>
        </div>

        <AdSlotBar />

        {/* لوحة الفائز الأسبوعي الموحدة */}
        <WeeklyWinnerPanel />

        {/* الخانة الخضراء الحساسة التلقائية المربوطة 100% بالتقارير والسداد */}
        <div style={{ 
          background: calculatedDebt > 0 ? '#FEF2F2' : '#F0FDF4', 
          border: calculatedDebt > 0 ? '1px solid #FECACA' : '1px solid #BBF7D0',
          padding: '16px', 
          borderRadius: '16px', 
          marginBottom: '20px' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', color: calculatedDebt > 0 ? '#991B1B' : '#166534', fontWeight: 700 }}>
                {calculatedDebt > 0 ? 'المبلغ المطلوب سداده للإدارة (عهدة):' : 'حساب العهدة والديون:'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: calculatedDebt > 0 ? '#DC2626' : '#059669' }}>
                {calculatedDebt.toLocaleString('en-US')} <span style={{ fontSize: '13px' }}>ريال</span>
              </div>
            </div>
            {calculatedDebt > 0 && (
              <div style={{ fontSize: '11px', background: '#FCA5A5', color: '#fff', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>
                عليكم مبالغ معلقة
              </div>
            )}
          </div>
        </div>

        {profile.personal_card && (
          <div
            style={{
              background:
                'linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #DB2777 100%)',
              borderRadius: 20,
              padding: '20px 24px',
              color: '#fff',
              marginBottom: 20,
              boxShadow:
                '0 10px 25px rgba(124, 58, 237, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 15,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: '#E3D6FF',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                ⭐ كرتك الشخصي (ثابت ومميز)
              </div>

              <div
                className="mono"
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: 1.5,
                }}
              >
                {profile.personal_card}
              </div>
            </div>

            <button
              onClick={() =>
                copyPersonalCode(profile.personal_card)
              }
              style={{
                background:
                  'rgba(255,255,255,0.2)',
                border:
                  '1px solid rgba(255,255,255,0.4)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {personalCopied
                ? '✓ تم النسخ'
                : '📋 نسخ الكرت الشخصي'}
            </button>
          </div>
        )}

        <div className="balance-card">
          <div className="lbl">
            رصيدك الحالي
          </div>

          <div className="amt">
            {Number(profile.balance).toLocaleString(
              'en-US'
            )}{' '}
            <span>ريال</span>
          </div>

          <div className="foot">
            <div
              style={{
                fontSize: 11.5,
                color: '#E3D6FF',
              }}
            >
              كروت لديك الآن: {myCards.length}
            </div>

            <Link href="/distributor/request">
              <button className="req-btn">
                طلب كروت جديد
              </button>
            </Link>
          </div>
        </div>

        <div
          className="grid-stats"
          style={{
            gridTemplateColumns:
              'repeat(3,1fr)',
          }}
        >
          <div className="stat">
            <div className="label">
              كروت متاحة عندي
            </div>

            <div className="value">
              {myCards.length}
            </div>
          </div>

          <div className="stat">
            <div className="label">
              مبيعات اليوم
            </div>

            <div className="value">
              {soldToday}
            </div>
          </div>

          <div className="stat">
            <div className="label">
              القيمة الإجمالية لكروتك
            </div>

            <div
              className="value"
              style={{
                fontSize: 20,
              }}
            >
              {totalValue.toLocaleString(
                'en-US'
              )}{' '}

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ريال
              </span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>باقاتي المتاحة</h3>

              <span className="muted">
                اضغط "إظهار كرت" عند وجود زبون
              </span>
            </div>

            <button 
              onClick={load} 
              disabled={isRefreshing}
              style={{
                background: '#F3F0FB', border: '1px solid #DDD3F5', color: '#5B21B6',
                padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
              {isRefreshing ? 'جاري التحديث...' : 'تحديث القائمة'}
            </button>
          </div>

          {revealError && (
            <div className="error-note" style={{ color: '#DC2626', background: '#FEF2F2', padding: '10px', borderRadius: '8px', marginBottom: '10px', fontSize: '13px' }}>
              {revealError}
            </div>
          )}

          {Object.keys(byPackage).length === 0 && (
            <div
              style={{
                color: 'var(--ink-soft)',
                fontSize: 13,
              }}
            >
              لا توجد كروت لديك حاليًا
            </div>
          )}

          <div className="pkg-grid">
            {Object.entries(byPackage).map(
              ([name, info]) => (
                <div
                  className="pkg-card"
                  key={name}
                >
                  <div className="pname">
                    {name}
                  </div>

                  <div className="pcount">
                    {info.count}{' '}
                    <span>كرت لديك</span>
                  </div>

                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--ink-soft)',
                      fontWeight: 700,
                      marginTop: 4,
                    }}
                  >
                    القيمة:{' '}
                    {(
                      info.count *
                      info.price
                    ).toLocaleString(
                      'en-US'
                    )}{' '}
                    ريال
                  </div>

                  <button
                    className="btn-primary"
                    style={{
                      marginTop: 14,
                      width: '100%',
                    }}
                    onClick={() =>
                      askReveal(
                        info.packageId,
                        name
                      )
                    }
                  >
                    إظهار كرت
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-head">
            <h3>سجل مبيعات اليوم الأخيرة</h3>
            <span className="muted">آخر الكروت التي قمت ببيعها اليوم</span>
          </div>

          {recentSales.length === 0 ? (
            <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>
              لم تقم ببيع أي كرت حتى الآن اليوم.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {recentSales.map((sale) => (
                <div key={sale.id} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  background: '#F8FAFC', padding: '10px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' 
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                      {sale.packages?.name || 'باقة'} {sale.customer_name ? `(الزبون: ${sale.customer_name})` : ''}
                    </div>
                    <div className="mono" style={{ fontSize: '12px', color: '#64748B', letterSpacing: '0.5px' }}>
                      {sale.code}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>
                      {sale.packages?.price || 0} ريال
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                      {new Date(sale.sold_at).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="panel"
          style={{
            marginTop: 20,
          }}
        >
          <div className="panel-head">
            <h3>
              إرسال ملاحظة أو طلب للمدير
            </h3>
          </div>

          <form onSubmit={sendNoteToAdmin}>
            <textarea
              rows={3}
              value={noteContent}
              onChange={(e) =>
                setNoteContent(
                  e.target.value
                )
              }
              disabled={noteBusy}
              placeholder="اكتب رسالتك أو طلبك هنا ليظهر لدى المدير مباشرة..."
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border:
                  '1.5px solid var(--line)',
                marginBottom: 10,
                fontSize: 13.5,
                resize: 'vertical',
                opacity: noteBusy ? 0.7 : 1,
              }}
            />

            {noteMessage && (
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 10,
                  color:
                    noteMessage.startsWith('✓')
                      ? '#10B981'
                      : noteMessage.startsWith(
                          '⚠️'
                        )
                      ? '#D97706'
                      : '#DC2626',
                }}
              >
                {noteMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={
                noteBusy ||
                !noteContent.trim()
              }
              className="btn-primary"
              style={{
                width: 'auto',
                padding: '10px 20px',
                opacity:
                  noteBusy ||
                  !noteContent.trim()
                    ? 0.65
                    : 1,
                cursor:
                  noteBusy ||
                  !noteContent.trim()
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {noteBusy
                ? 'جاري الإرسال...'
                : 'إرسال للمدير'}
            </button>
          </form>
        </div>
      </div>

      {pendingPackage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(20,10,40,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 22,
              padding: 0,
              maxWidth: 340,
              width: '100%',
              textAlign: 'center',
              boxShadow:
                '0 20px 60px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background:
                  'linear-gradient(120deg, #5B21B6, #7C3AED, #DB2777)',
                padding:
                  '26px 20px 22px',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#E3D6FF',
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                إظهار كرت من باقة
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: '#fff',
                  lineHeight: 1.2,
                }}
              >
                {pendingPackage.name}
              </div>
            </div>

            <div
              style={{
                padding: '20px 24px 24px',
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--ink-soft)',
                  marginBottom: 15,
                  textAlign: 'right'
                }}
              >
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, color: '#374151' }}>
                  اسم الزبون (اختياري للسحب الأسبوعي):
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد محمد (لإدخاله في السحب)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid var(--line)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#7C3AED', display: 'block', marginTop: 4, fontWeight: 600 }}>
                  💡 كتابة الاسم تؤهل الزبون لدخول السحب الأسبوعي تلقائياً!
                </span>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: 'var(--ink-soft)',
                  marginBottom: 20,
                }}
              >
                سيتم تسليم كرت واحد وتأكيده كمباع
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                }}
              >
                <button
                  onClick={cancelReveal}
                  disabled={revealBusy}
                  style={{
                    flex: 1,
                    padding: '13px 0',
                    borderRadius: 12,
                    border:
                      '1.5px solid var(--line)',
                    background: '#fff',
                    color:
                      'var(--ink-soft)',
                    fontWeight: 800,
                    fontSize: 13.5,
                    cursor: 'pointer',
                  }}
                >
                  إلغاء
                </button>

                <button
                  onClick={confirmReveal}
                  disabled={revealBusy}
                  style={{
                    flex: 1,
                    padding: '13px 0',
                    borderRadius: 12,
                    border: 'none',
                    background:
                      'linear-gradient(120deg, #7C3AED, #DB2777)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 13.5,
                    cursor: 'pointer',
                  }}
                >
                  {revealBusy
                    ? 'جاري التأكيد...'
                    : 'تأكيد البيع'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {revealedCard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(20,10,40,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background:
                'linear-gradient(160deg, #ffffff 0%, #ffffff 60%, #F3F0FB 100%)',
              borderRadius: 24,
              padding: 0,
              maxWidth: 380,
              width: '100%',
              textAlign: 'center',
              position: 'relative',
              boxShadow:
                '0 20px 60px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background:
                  'linear-gradient(120deg, #5B21B6, #7C3AED, #DB2777)',
                padding: '18px 20px',
                position: 'relative',
              }}
            >
              <button
                onClick={closeModal}
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  border: 'none',
                  background:
                    'rgba(255,255,255,0.25)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
                title="إغلاق"
              >
                ✕
              </button>

              <div
                style={{
                  fontSize: 12.5,
                  color: '#E3D6FF',
                  fontWeight: 700,
                }}
              >
                {revealedCard.packageName}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#fff',
                  fontWeight: 900,
                  marginTop: 2,
                }}
              >
                ✓ تم البيع بنجاح
              </div>
            </div>

            <div
              style={{
                padding: 26,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  margin: '4px 0 18px',
                  letterSpacing: 1,
                  direction: 'ltr',
                  color: '#3A1D66',
                }}
              >
                {revealedCard.code}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <button
                  onClick={copyCode}
                  style={{
                    flex: 1,
                    padding: '11px 0',
                    borderRadius: 12,
                    border:
                      '1.5px solid #DDD3F5',
                    background: '#F3F0FB',
                    color: '#5B21B6',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {copied
                    ? '✓ تم النسخ'
                    : '📋 نسخ الكود'}
                </button>

                <button
                  onClick={shareWhatsapp}
                  style={{
                    flex: '1',
                    padding: '11px 0',
                    borderRadius: 12,
                    border: 'none',
                    background: '#25D366',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  واتساب
                </button>
              </div>

              <button
                onClick={closeModal}
                style={{
                  width: '100%',
                  padding: '13px 0',
                  borderRadius: 14,
                  border: 'none',
                  background: '#F3F0FB',
                  color: '#5B21B6',
                  fontWeight: 800,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
