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

  const [netDebt, setNetDebt] = useState(0);

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

  const formatNum = (num) => {
    const val = Math.round(Number(num) || 0);
    return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  async function load() {
    if (!profile) return;
    setIsRefreshing(true);

    try {
      const { data: availableCards } = await supabase
        .from('cards')
        .select('*, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'with_distributor');

      setMyCards(availableCards || []);

      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString());

      setSoldToday(count || 0);

      const { data: salesData } = await supabase
        .from('cards')
        .select('id, code, sold_at, customer_name, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString())
        .order('sold_at', { ascending: false })
        .limit(10);

      setRecentSales(salesData || []);

      // قراءة الدين المحدث مباشرة من جدول profiles
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('debt_balance, debt')
        .eq('id', profile.id)
        .single();

      const currentNetDebt = Number(freshProfile?.debt_balance ?? freshProfile?.debt ?? profile?.debt_balance ?? profile?.debt ?? 0);
      setNetDebt(currentNetDebt);

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
      // 1. جلب أول كرت متاح من هذه الباقة للموزع مع سعر الباقة
      const { data, error } = await supabase
        .from('cards')
        .select('id, code, package_id, packages(price)')
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
      const cardPrice = Number(card.packages?.price || 0);
      
      const managerShare = cardPrice * 0.9;
      const distributorShare = cardPrice * 0.1;
      const soldAtTimestamp = new Date().toISOString();

      // 2. تحديث حالة الكرت إلى مباع
      const { error: updateCardError } = await supabase
        .from('cards')
        .update({
          status: 'sold',
          sold_at: soldAtTimestamp,
          customer_name: trimmedCustomerName !== '' ? trimmedCustomerName : null,
        })
        .eq('id', card.id);

      if (updateCardError) {
        setRevealError('حدث خطأ أثناء تحديث حالة الكرت');
        setRevealBusy(false);
        return;
      }

      // 3. جلب الدين الحالي بدقة وتحديثه بحصة المدير (90%)
      const { data: currentDistProfile } = await supabase
        .from('profiles')
        .select('debt_balance, debt')
        .eq('id', profile.id)
        .single();

      const existingDebt = Number(currentDistProfile?.debt_balance ?? currentDistProfile?.debt ?? netDebt ?? 0);
      const newTotalDebt = existingDebt + managerShare;

      // تحديث الحقلين معا في جدول profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          debt_balance: newTotalDebt,
          debt: newTotalDebt 
        })
        .eq('id', profile.id);

      if (profileError) {
        console.error('Profile update debt error (RLS restriction?):', profileError);
      }

      // 4. تسجيل العملية في جدول السجلات (sales_log) مع حفظ حصة المدير والموزع
      await supabase.from('sales_log').insert({
        distributor_id: profile.id,
        card_id: card.id,
        package_id: card.package_id,
        price: cardPrice,
        manager_share: managerShare,
        distributor_share: distributorShare,
        sold_at: soldAtTimestamp
      });

      // تثبيت القيمة مباشرة في الشاشة لضمان عدم اختفائها
      setNetDebt(newTotalDebt);

      // 5. إظهار الكرت بنجاح للموزع
      setRevealedCard({
        code: card.code,
        packageName: pendingPackage.name,
      });

      setPendingPackage(null);
      setCustomerName('');
      setCopied(false);

      // تحديث باقي البيانات بهدوء بدون التأثير على الدين المعروض
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const { data: availableCards } = await supabase
        .from('cards')
        .select('*, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'with_distributor');

      setMyCards(availableCards || []);

      const { count } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString());

      setSoldToday(count || 0);

      const { data: salesData } = await supabase
        .from('cards')
        .select('id, code, sold_at, customer_name, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString())
        .order('sold_at', { ascending: false })
        .limit(10);

      setRecentSales(salesData || []);

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
      'أكثروا من الصلاة على النبي (صلى الله عليه وسلم)',
      'سبحان الله وبحمده، سبحان الله العظيم',
      'لا تنسَ ذكر الله، فبذكره تطمئن القلوب',
      'اللهم صل وسلم وبارك على نبينا محمد'
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

      setNoteContent('');
      setNoteMessage('✓ تم إرسال رسالتك للمدير بنجاح');

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
            padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: '800',
            border: `1px solid ${isOnline ? '#A7F3D0' : '#FECACA'}`
          }}>
            <span style={{ 
              width: 7, height: 7, borderRadius: '50%', 
              background: isOnline ? '#10B981' : '#EF4444',
              display: 'inline-block'
            }}></span>
            {isOnline ? 'نشط' : 'خامل'}
          </div>
        </div>

        <AdSlotBar />

        <WeeklyWinnerPanel />

        {profile.personal_card && (
          <div
            style={{
              background:
                'linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #DB2777 100%)',
              borderRadius: 20,
              padding: '20px 24px',
              color: '#fff',
              marginBottom: 20,
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
                  fontWeight: '700',
                  marginBottom: 4,
                }}
              >
                ⭐ كرتك الشخصي (ثابت ومميز)
              </div>

              <div
                className="mono"
                style={{
                  fontSize: 24,
                  fontWeight: '900',
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
                fontWeight: '800',
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div className="balance-card" style={{ marginBottom: 0 }}>
            <div className="lbl">
              رصيدك الحالي بمخزنك
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

          <div style={{
            background: netDebt > 0 
              ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' 
              : 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
            borderRadius: 20,
            padding: 20,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            transition: 'background 0.3s ease'
          }}>
            <div>
              <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: '700', marginBottom: 6 }}>
                المبلغ الصافي المستحق للمدير
              </div>
              <div className="mono" style={{ fontSize: 26, fontWeight: '900', letterSpacing: 0.5 }}>
                {formatNum(netDebt)} <span style={{ fontSize: 13, fontWeight: 'normal' }}>ريال</span>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: '#f8fafc', marginTop: 10, opacity: 0.9 }}>
              {netDebt > 0 ? '⚠️ إجمالي المستحقات المالية الحالية' : '✓ الحساب مسدد بالكامل'}
            </div>
          </div>
        </div>

        <div
          className="grid-stats"
          style={{
            gridTemplateColumns:
              'repeat(2,1fr)',
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
        </div>

        <div className="panel">
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>باقاتي المتاحة</h3>

              <span className="muted">
                اضغط &quot;إظهار كرت&quot; عند وجود زبون
              </span>
            </div>

            <button 
              onClick={load} 
              disabled={isRefreshing}
              style={{
                background: '#F3F0FB', border: '1px solid #DDD3F5', color: '#5B21B6',
                padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
              {isRefreshing ? 'جاري التحديث...' : 'تحديث القائمة'}
            </button>
          </div>

          {revealError && (
            <div style={{ color: '#DC2626', background: '#FEF2F2', padding: '10px', borderRadius: '8px', marginBottom: '10px', fontSize: '13px' }}>
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
                    <div className="mono" style={{ fontSize: '12px', color: '#64748B' }}>
                      {sale.code}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left', fontSize: '10.5px', color: '#94A3B8' }}>
                    {new Date(sale.sold_at).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
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
              }}
            />

            {noteMessage && (
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: '700',
                  marginBottom: 10,
                  color:
                    noteMessage.startsWith('✓')
                      ? '#10B981'
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
                color: '#fff',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#E3D6FF',
                  fontWeight: '700',
                  marginBottom: 6,
                }}
              >
                إظهار كرت من باقة
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight: '900',
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
                  textAlign: 'right',
                }}
              >
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '700', color: '#374151' }}>
                  اسم الزبون (اختياري للسحب الأسبوعي):
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid var(--line)',
                    fontSize: '13px',
                  }}
                />
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
                    fontWeight: '800',
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
                    fontWeight: '800',
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
              background: '#fff',
              borderRadius: 24,
              maxWidth: 380,
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
                padding: '18px 20px',
                color: '#fff',
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
                  fontWeight: '900',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>

              <div
                style={{
                  fontSize: 12.5,
                  color: '#E3D6FF',
                  fontWeight: '700',
                }}
              >
                {revealedCard.packageName}
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: '900',
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
                  fontWeight: '900',
                  margin: '4px 0 18px',
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
                    fontWeight: '800',
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
                    flex: 1,
                    padding: '11px 0',
                    borderRadius: 12,
                    border: 'none',
                    background: '#25D366',
                    color: '#fff',
                    fontWeight: '800',
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
                  fontWeight: '800',
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
