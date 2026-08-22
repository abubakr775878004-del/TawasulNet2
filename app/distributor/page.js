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
      const { data } = await supabase
        .from('cards')
        .select('*, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'with_distributor');

      setMyCards(data || []);

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
    <div className="app-layout">
      <Sidebar
        role="distributor"
        active="/distributor"
        name={profile.full_name}
      />

      <div className="main-content">
        {/* الشريط العلوي */}
        <div className="topbar">
          <div>
            <h1 className="user-greeting">
              مرحبًا، {profile.full_name} 👋
            </h1>
            <div className="sub-greet">
              إليك ملخص حسابك اليوم
            </div>
          </div>

          <div className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
            <span className="dot"></span>
            {isOnline ? 'نشط' : 'خامل'}
          </div>
        </div>

        <AdSlotBar />

        {/* لوحة الفائز الأسبوعي */}
        <WeeklyWinnerPanel />

        {/* كرت العهدة والديون */}
        <div className={`debt-card ${Number(profile?.debt_balance || 0) > 0 ? 'has-debt' : 'no-debt'}`}>
          <div className="debt-flex">
            <div>
              <div className="debt-label">
                {Number(profile?.debt_balance || 0) > 0 ? 'المبلغ المطلوب سداده للإدارة (عهدة):' : 'حساب العهدة والديون:'}
              </div>
              <div className="debt-amount">
                {Number(profile?.debt_balance || 0).toLocaleString('en-US')} <span>ريال</span>
              </div>
            </div>
            {Number(profile?.debt_balance || 0) > 0 && (
              <div className="debt-warning-tag">
                عليكم مبالغ معلقة
              </div>
            )}
          </div>
        </div>

        {/* الكرت الشخصي */}
        {profile.personal_card && (
          <div className="personal-card-box">
            <div>
              <div className="pcard-tag">
                ⭐ كرتك الشخصي (ثابت ومميز)
              </div>
              <div className="mono pcard-code">
                {profile.personal_card}
              </div>
            </div>

            <button
              className="btn-pcard-copy"
              onClick={() => copyPersonalCode(profile.personal_card)}
            >
              {personalCopied ? '✓ تم النسخ' : '📋 نسخ الكرت الشخصي'}
            </button>
          </div>
        )}

        {/* كرت الرصيد الحالي */}
        <div className="balance-card">
          <div className="lbl">رصيدك الحالي</div>
          <div className="amt">
            {Number(profile.balance).toLocaleString('en-US')} <span>ريال</span>
          </div>

          <div className="foot">
            <div className="my-cards-cnt">
              كروت لديك الآن: {myCards.length}
            </div>
            <Link href="/distributor/request">
              <button className="req-btn">
                طلب كروت جديد
              </button>
            </Link>
          </div>
        </div>

        {/* شبكة الإحصائيات */}
        <div className="grid-stats">
          <div className="stat-card">
            <div className="label">كروت متاحة عندي</div>
            <div className="value">{myCards.length}</div>
          </div>

          <div className="stat-card">
            <div className="label">مبيعات اليوم</div>
            <div className="value">{soldToday}</div>
          </div>

          <div className="stat-card">
            <div className="label">القيمة الإجمالية لكروتك</div>
            <div className="value highlight">
              {totalValue.toLocaleString('en-US')} <span>ريال</span>
            </div>
          </div>
        </div>

        {/* قسم الباقات المتاحة */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>باقاتي المتاحة</h3>
              <span className="muted">اضغط "إظهار كرت" عند وجود زبون</span>
            </div>

            <button 
              onClick={load} 
              disabled={isRefreshing}
              className="refresh-btn"
            >
              <span className={`refresh-icon ${isRefreshing ? 'spin' : ''}`}>🔄</span>
              {isRefreshing ? 'جاري التحديث...' : 'تحديث القائمة'}
            </button>
          </div>

          {revealError && (
            <div className="error-note-box">
              {revealError}
            </div>
          )}

          {Object.keys(byPackage).length === 0 && (
            <div className="empty-state">
              لا توجد كروت لديك حاليًا
            </div>
          )}

          <div className="pkg-grid">
            {Object.entries(byPackage).map(([name, info]) => (
              <div className="pkg-card" key={name}>
                <div className="pname">{name}</div>
                <div className="pcount">
                  {info.count} <span>كرت لديك</span>
                </div>
                <div className="pval">
                  القيمة: {(info.count * info.price).toLocaleString('en-US')} ريال
                </div>

                <button
                  className="btn-reveal"
                  onClick={() => askReveal(info.packageId, name)}
                >
                  إظهار كرت
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* سجل المبيعات */}
        <div className="panel gap-top">
          <div className="panel-head">
            <h3>سجل مبيعات اليوم الأخيرة</h3>
            <span className="muted">آخر الكروت التي قمت ببيعها اليوم</span>
          </div>

          {recentSales.length === 0 ? (
            <div className="empty-state">
              لم تقم ببيع أي كرت حتى الآن اليوم.
            </div>
          ) : (
            <div className="sales-list">
              {recentSales.map((sale) => (
                <div key={sale.id} className="sale-item">
                  <div>
                    <div className="sale-title">
                      {sale.packages?.name || 'باقة'} {sale.customer_name ? `(الزبون: ${sale.customer_name})` : ''}
                    </div>
                    <div className="mono sale-code">
                      {sale.code}
                    </div>
                  </div>
                  <div className="sale-meta">
                    <div className="sale-price">
                      {sale.packages?.price || 0} ريال
                    </div>
                    <div className="sale-time">
                      {new Date(sale.sold_at).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* إرسال ملاحظة */}
        <div className="panel gap-top">
          <div className="panel-head">
            <h3>إرسال ملاحظة أو طلب للمدير</h3>
          </div>

          <form onSubmit={sendNoteToAdmin}>
            <textarea
              rows={3}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              disabled={noteBusy}
              placeholder="اكتب رسالتك أو طلبك هنا ليظهر لدى المدير مباشرة..."
              className="note-textarea"
            />

            {noteMessage && (
              <div className={`note-status ${
                noteMessage.startsWith('✓') ? 'success' : noteMessage.startsWith('⚠️') ? 'warning' : 'error'
              }`}>
                {noteMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={noteBusy || !noteContent.trim()}
              className="btn-send-note"
            >
              {noteBusy ? 'جاري الإرسال...' : 'إرسال للمدير'}
            </button>
          </form>
        </div>
      </div>

      {/* مودال اختيار اسم الزبون قبل التأكيد */}
      {pendingPackage && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-sub">إظهار كرت من باقة</div>
              <div className="modal-title">{pendingPackage.name}</div>
            </div>

            <div className="modal-body">
              <div className="field-block">
                <label className="field-label">
                  اسم الزبون (اختياري للسحب الأسبوعي):
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد محمد (لإدخاله في السحب)"
                  className="modal-input"
                />
                <span className="field-hint">
                  💡 كتابة الاسم تؤهل الزبون لدخول السحب الأسبوعي تلقائياً!
                </span>
              </div>

              <div className="modal-note">
                سيتم تسليم كرت واحد وتأكيده كمباع
              </div>

              <div className="modal-actions">
                <button
                  onClick={cancelReveal}
                  disabled={revealBusy}
                  className="btn-cancel"
                >
                  إلغاء
                </button>

                <button
                  onClick={confirmReveal}
                  disabled={revealBusy}
                  className="btn-confirm"
                >
                  {revealBusy ? 'جاري التأكيد...' : 'تأكيد البيع'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال إظهار الكرت المباع */}
      {revealedCard && (
        <div className="modal-overlay">
          <div className="modal-card card-reveal">
            <div className="modal-header">
              <button onClick={closeModal} className="close-btn" title="إغلاق">✕</button>
              <div className="modal-sub">{revealedCard.packageName}</div>
              <div className="modal-success-tag">✓ تم البيع بنجاح</div>
            </div>

            <div className="modal-body">
              <div className="mono revealed-code">
                {revealedCard.code}
              </div>

              <div className="modal-actions gap-bottom">
                <button onClick={copyCode} className="btn-copy-code">
                  {copied ? '✓ تم النسخ' : '📋 نسخ الكود'}
                </button>

                <button onClick={shareWhatsapp} className="btn-whatsapp">
                  واتساب
                </button>
              </div>

              <button onClick={closeModal} className="btn-close-modal">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* التنسيقات المضمنة المباشرة */}
      <style jsx>{`
        .app-layout {
          display: flex;
          min-height: 100vh;
          background: #f8fafc;
          direction: rtl;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .main-content {
          flex: 1;
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .user-greeting {
          font-size: 26px;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
        }

        .sub-greet {
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
        }

        .status-badge.online {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .status-badge.offline {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .online .dot {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .offline .dot {
          background: #ef4444;
        }

        /* كرت الديون */
        .debt-card {
          padding: 18px 20px;
          border-radius: 16px;
          margin-bottom: 20px;
          transition: all 0.2s ease;
        }

        .debt-card.has-debt {
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .debt-card.no-debt {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .debt-flex {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .debt-label {
          font-size: 13px;
          font-weight: 700;
        }

        .has-debt .debt-label { color: #991b1b; }
        .no-debt .debt-label { color: #166534; }

        .debt-amount {
          font-size: 24px;
          font-weight: 900;
        }

        .has-debt .debt-amount { color: #dc2626; }
        .no-debt .debt-amount { color: #059669; }

        .debt-warning-tag {
          font-size: 11px;
          background: #ef4444;
          color: #ffffff;
          padding: 5px 10px;
          border-radius: 8px;
          font-weight: 800;
        }

        /* الكرت الشخصي */
        .personal-card-box {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #d946ef 100%);
          border-radius: 20px;
          padding: 20px 24px;
          color: #ffffff;
          margin-bottom: 20px;
          box-shadow: 0 10px 25px rgba(124, 58, 237, 0.25);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
        }

        .pcard-tag {
          font-size: 12px;
          color: #e0e7ff;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .pcard-code {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .btn-pcard-copy {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: background 0.2s;
        }

        .btn-pcard-copy:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* كرت الرصيد */
        .balance-card {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 20px;
          padding: 24px;
          color: #ffffff;
          margin-bottom: 20px;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.15);
        }

        .balance-card .lbl {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 700;
        }

        .balance-card .amt {
          font-size: 36px;
          font-weight: 900;
          color: #38bdf8;
          margin: 6px 0 16px 0;
        }

        .balance-card .amt span {
          font-size: 16px;
          color: #94a3b8;
        }

        .balance-card .foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 16px;
        }

        .my-cards-cnt {
          font-size: 13px;
          color: #cbd5e1;
          font-weight: 600;
        }

        .req-btn {
          background: #059669;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .req-btn:hover {
          background: #047857;
        }

        /* شبكة الإحصائيات */
        .grid-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 18px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .stat-card .label {
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .stat-card .value {
          font-size: 24px;
          font-weight: 900;
          color: #0f172a;
        }

        .stat-card .value.highlight {
          color: #059669;
        }

        /* اللوحات الرئيسية */
        .panel {
          background: #ffffff;
          border-radius: 20px;
          padding: 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        }

        .panel.gap-top {
          margin-top: 20px;
        }

        .panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .panel-head h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .panel-head .muted {
          font-size: 12px;
          color: #94a3b8;
          display: block;
          margin-top: 2px;
        }

        .refresh-btn {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .refresh-icon.spin {
          animation: spin 0.8s linear infinite;
        }

        .error-note-box {
          color: #dc2626;
          background: #fef2f2;
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 700;
          border: 1px solid #fecaca;
        }

        .empty-state {
          color: #94a3b8;
          font-size: 13px;
          padding: 10px 0;
        }

        /* شبكة الباقات */
        .pkg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }

        .pkg-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .pkg-card .pname {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }

        .pkg-card .pcount {
          font-size: 13px;
          color: #059669;
          font-weight: 800;
          margin-top: 4px;
        }

        .pkg-card .pval {
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
          margin-top: 4px;
        }

        .btn-reveal {
          margin-top: 16px;
          width: 100%;
          padding: 10px;
          background: #059669;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-reveal:hover {
          background: #047857;
        }

        /* سجل المبيعات */
        .sales-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sale-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .sale-title {
          font-size: 13px;
          font-weight: 800;
          color: #1e293b;
        }

        .sale-code {
          font-size: 12px;
          color: #64748b;
          letter-spacing: 0.5px;
        }

        .sale-meta {
          text-align: left;
        }

        .sale-price {
          font-size: 13px;
          font-weight: 800;
          color: #059669;
        }

        .sale-time {
          font-size: 11px;
          color: #94a3b8;
        }

        /* نموذج إرسال الرسائل */
        .note-textarea {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          margin-bottom: 12px;
          font-size: 14px;
          resize: vertical;
          outline: none;
          box-sizing: border-box;
        }

        .note-textarea:focus {
          border-color: #059669;
        }

        .note-status {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .note-status.success { color: #10b981; }
        .note-status.warning { color: #d97706; }
        .note-status.error { color: #dc2626; }

        .btn-send-note {
          padding: 10px 24px;
          background: #0f172a;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }

        /* النوافذ المنبثقة (Modals) */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-card {
          background: #ffffff;
          border-radius: 24px;
          maxWidth: 380px;
          width: 100%;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        .modal-header {
          background: linear-gradient(135deg, #0f172a 0%, #064e3b 100%);
          padding: 24px 20px;
          color: #ffffff;
          text-align: center;
          position: relative;
        }

        .modal-sub {
          font-size: 12px;
          color: #a7f3d0;
          font-weight: 700;
        }

        .modal-title {
          font-size: 24px;
          font-weight: 900;
          margin-top: 4px;
        }

        .modal-success-tag {
          font-size: 13px;
          color: #6ee7b7;
          font-weight: 800;
          margin-top: 4px;
        }

        .close-btn {
          position: absolute;
          top: 14px;
          left: 14px;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: none;
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          font-size: 16px;
          cursor: pointer;
        }

        .modal-body {
          padding: 24px;
        }

        .field-block {
          text-align: right;
          margin-bottom: 16px;
        }

        .field-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 700;
          font-size: 13px;
          color: #334155;
        }

        .modal-input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid #cbd5e1;
          font-size: 13px;
          outline: none;
          box-sizing: border-box;
        }

        .field-hint {
          font-size: 11px;
          color: #059669;
          display: block;
          margin-top: 6px;
          font-weight: 700;
        }

        .modal-note {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 20px;
          text-align: center;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
        }

        .modal-actions.gap-bottom {
          margin-bottom: 16px;
        }

        .btn-cancel {
          flex: 1;
          padding: 12px 0;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
        }

        .btn-confirm {
          flex: 1;
          padding: 12px 0;
          border-radius: 12px;
          border: none;
          background: #059669;
          color: #ffffff;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
        }

        .revealed-code {
          font-size: 28px;
          font-weight: 900;
          margin: 12px 0 24px 0;
          letter-spacing: 1.5px;
          direction: ltr;
          color: #0f172a;
          text-align: center;
          background: #f1f5f9;
          padding: 14px;
          border-radius: 14px;
          border: 1px dashed #cbd5e1;
        }

        .btn-copy-code {
          flex: 1;
          padding: 12px 0;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          background: #f8fafc;
          color: #0f172a;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }

        .btn-whatsapp {
          flex: 1;
          padding: 12px 0;
          border-radius: 12px;
          border: none;
          background: #25d366;
          color: #ffffff;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }

        .btn-close-modal {
          width: 100%;
          padding: 12px 0;
          border-radius: 12px;
          border: none;
          background: #f1f5f9;
          color: #475569;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* الاستجابة للهواتف */
        @media (max-width: 768px) {
          .main-content {
            padding: 16px;
          }

          .grid-stats {
            grid-template-columns: repeat(1, 1fr);
          }

          .topbar {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .personal-card-box {
            flex-direction: column;
            align-items: flex-start;
          }

          .btn-pcard-copy {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
