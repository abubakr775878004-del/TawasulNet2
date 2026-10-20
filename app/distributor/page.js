'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import WeeklyWinnerPanel from '../../components/WeeklyWinnerPanel';
import NotificationBell from '../../components/NotificationBell';
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

  const [whatsappShared, setWhatsappShared] = useState(false);
  const [whatsappBusy, setWhatsappBusy] = useState(false);
  const [personalCopied, setPersonalCopied] = useState(false);

  const [noteContent, setNoteContent] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');

  const formatNum = (num) =>
    Math.round(Number(num) || 0).toLocaleString('en-US', {
      maximumFractionDigits: 0,
    });

  useEffect(() => {
    if (!revealedCard?.code) {
      setWhatsappShared(false);
      return;
    }

    try {
      const code = String(revealedCard.code).trim();
      const cardId = String(revealedCard.id || '').trim();

      const newStorageKey = `tawasul_whatsapp_shared_v2_${cardId}_${code}`;
      const oldStorageKey = `tawasul_whatsapp_shared_${code}`;

      setWhatsappShared(
        localStorage.getItem(newStorageKey) === '1' ||
        localStorage.getItem(oldStorageKey) === '1'
      );
    } catch (error) {
      console.error('WhatsApp localStorage read error:', error);
      setWhatsappShared(false);
    }
  }, [revealedCard]);

  async function load(isInitial = false) {
    if (!profile) return;

    setIsRefreshing(true);

    try {
      const {
        data: availableCards,
        error: availableCardsError,
      } = await supabase
        .from('cards')
        .select('*, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'with_distributor');

      if (availableCardsError) {
        console.error('Error loading available cards:', availableCardsError);
      }

      setMyCards(availableCards || []);

      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const { count, error: soldCountError } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString());

      if (soldCountError) {
        console.error('Error loading sold count:', soldCountError);
      }

      setSoldToday(count || 0);

      const { data: salesData, error: salesError } = await supabase
        .from('cards')
        .select('id, code, sold_at, customer_name, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString())
        .order('sold_at', { ascending: false })
        .limit(10);

      if (salesError) {
        console.error('Error loading recent sales:', salesError);
      }

      setRecentSales(salesData || []);

      const { data: freshProfile, error: profileError } = await supabase
        .from('profiles')
        .select('debt_balance, debt')
        .eq('id', profile.id)
        .single();

      if (profileError) {
        console.error('Error loading distributor debt:', profileError);
      } else {
        const currentNetDebt = Number(
          freshProfile?.debt_balance ?? freshProfile?.debt ?? 0
        );

        setNetDebt(
          Number.isFinite(currentNetDebt) ? currentNetDebt : 0
        );
      }
    } catch (err) {
      console.error('Error loading distributor data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!profile) return;

    load(true);

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
    setPendingPackage({ id: pkgId, name: pkgName });
  }

  function cancelReveal() {
    if (revealBusy) return;
    setPendingPackage(null);
    setCustomerName('');
    setRevealError('');
  }

  async function confirmReveal() {
    if (!pendingPackage || !profile || revealBusy) return;

    setRevealBusy(true);
    setRevealError('');

    try {
      const { data, error } = await supabase
        .from('cards')
        .select('id, code, package_id, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('package_id', pendingPackage.id)
        .eq('status', 'with_distributor')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error('Find card error:', error);
        setRevealError('حدث خطأ أثناء البحث عن الكرت');
        return;
      }

      if (!data || data.length === 0) {
        setRevealError('تعذّر إيجاد كرت متاح من هذه الباقة');
        setPendingPackage(null);
        return;
      }

      const card = data[0];
      const trimmedCustomerName = customerName.trim();
      const cardPrice = Number(card.packages?.price || 0);

      if (!Number.isFinite(cardPrice) || cardPrice <= 0) {
        setRevealError('سعر الباقة غير صحيح، لا يمكن إتمام البيع');
        return;
      }

      const managerShare = cardPrice * 0.9;
      const distributorShare = cardPrice * 0.1;
      const saleCompletedAt = new Date().toISOString();

      const { data: saleResult, error: saleError } =
        await supabase.rpc('confirm_card_sale', {
          p_card_id: card.id,
          p_distributor_id: profile.id,
          p_package_id: card.package_id,
          p_price: cardPrice,
          p_manager_share: managerShare,
          p_distributor_share: distributorShare,
          p_customer_name: trimmedCustomerName || null,
        });

      if (saleError) {
        console.error('confirm_card_sale error:', saleError);
        setRevealError(
          saleError.message || 'تعذّر تأكيد البيع، لم يتم خصم أي مبلغ'
        );
        return;
      }

      const { data: updatedProfile, error: updatedProfileError } =
        await supabase
          .from('profiles')
          .select('debt_balance, debt')
          .eq('id', profile.id)
          .single();

      if (updatedProfileError) {
        console.error(
          'Error refreshing debt after sale:',
          updatedProfileError
        );
      } else {
        const updatedDebt = Number(
          updatedProfile?.debt_balance ?? updatedProfile?.debt ?? 0
        );

        setNetDebt(Number.isFinite(updatedDebt) ? updatedDebt : 0);
      }

      let soldCode = card.code;

      if (saleResult && typeof saleResult === 'object') {
        if (saleResult.code) {
          soldCode = saleResult.code;
        } else if (saleResult.card_code) {
          soldCode = saleResult.card_code;
        }
      }

      setRevealedCard({
        id: card.id,
        code: soldCode,
        packageName: pendingPackage.name,
        soldAt:
          saleResult?.sold_at ||
          saleResult?.sale_time ||
          saleCompletedAt,
      });

      setWhatsappShared(false);
      setPendingPackage(null);
      setCustomerName('');
      setCopied(false);

      await load(true);
    } catch (error) {
      console.error('Confirm reveal error:', error);
      setRevealError(
        error?.message || 'حدث خطأ غير متوقع، حاول مرة أخرى'
      );
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
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy code error:', error);
    }
  }

  async function copyPersonalCode(codeText) {
    if (!codeText) return;

    try {
      await navigator.clipboard.writeText(codeText);
      setPersonalCopied(true);
      setTimeout(() => setPersonalCopied(false), 2000);
    } catch (error) {
      console.error('Copy personal card error:', error);
    }
  }

  const dailyReminders = [
    'سبحان الله وبحمده، سبحان الله العظيم.',
    'أستغفر الله وأتوب إليه.',
    'لا إله إلا الله وحده لا شريك له.',
    'سبحان الله، والحمد لله، والله أكبر.',
    'لا حول ولا قوة إلا بالله.',
    'اللهم صل وسلم وبارك على نبينا محمد ﷺ.',
    'الحمد لله على كل نعمة.',
    'اللهم اغفر لنا وارحمنا.',
    'اللهم افتح لنا أبواب الخير والرزق.',
    'اللهم اجعل يومنا خيرًا وبركة.',
    'رب اغفر لي وتب علي إنك أنت التواب الرحيم.',
    'اللهم ارزقنا راحة البال وطمأنينة القلب.',
    'اذكر الله، يطمئن قلبك.',
    'اللهم ارزقنا رزقًا طيبًا مباركًا فيه.',
    'يا رب اجعل لنا في كل خطوة خيرًا.',
    'اللهم اكتب لنا الخير حيث كان.',
    'اللهم بارك لنا في أعمارنا وأعمالنا.',
    'اللهم اجعلنا من أهل الحمد والشكر.',
    'اللهم اجبر خواطرنا وحقق أمنياتنا.',
    'اللهم يسّر لنا أمورنا واشرح صدورنا.',
    'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار.',
    'حسبي الله ونعم الوكيل.',
    'توكل على الله، فالله خير حافظًا.',
    'ابتسم، فالحمد لله دائمًا وأبدًا.',
    'من أكثر من الاستغفار جعل الله له فرجًا ومخرجًا.',
    'اجعل لسانك رطبًا بذكر الله.',
    'رضيت بالله ربًا، وبالإسلام دينًا، وبمحمد ﷺ نبيًا.',
    'اللهم اجعل القادم أجمل وأطيب.',
    'اللهم احفظنا واحفظ أهلنا وأحبابنا.',
    'اللهم اختم يومنا برضاك ومغفرتك.',
  ];

  function shareWhatsapp() {
    if (!revealedCard?.code || whatsappBusy || whatsappShared) return;

    const code = String(revealedCard.code).trim();
    const cardId = String(revealedCard.id || '').trim();

    if (!code || !cardId) {
      console.error('WhatsApp share blocked: missing card id or code');
      return;
    }

    const newStorageKey = `tawasul_whatsapp_shared_v2_${cardId}_${code}`;
    const oldStorageKey = `tawasul_whatsapp_shared_${code}`;

    try {
      const alreadyShared =
        localStorage.getItem(newStorageKey) === '1' ||
        localStorage.getItem(oldStorageKey) === '1';

      if (alreadyShared) {
        setWhatsappShared(true);
        return;
      }

      setWhatsappBusy(true);

      const secondCheck =
        localStorage.getItem(newStorageKey) === '1' ||
        localStorage.getItem(oldStorageKey) === '1';

      if (secondCheck) {
        setWhatsappShared(true);
        return;
      }

      const dailyReminder =
        dailyReminders[Math.floor(Math.random() * dailyReminders.length)];

      const saleDateTime = revealedCard.soldAt
        ? new Date(revealedCard.soldAt)
        : new Date();

      const saleDate = saleDateTime.toLocaleDateString('ar-YE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const saleTime = saleDateTime.toLocaleTimeString('ar-YE', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const text = `🌐 *شبكة تواصل* 📶

🎫 *كرت إنترنت*

🔐 *رمز الكرت*
\`${code}\`

📦 *الباقة:* *${revealedCard.packageName}*
📅 *${saleDate}*  |  🕐 *${saleTime}*

✨ _${dailyReminder}_

💙 *شكرًا لاختياركم شبكة تواصل*`;

      localStorage.setItem(newStorageKey, '1');
      localStorage.setItem(oldStorageKey, '1');
      setWhatsappShared(true);

      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        '_blank'
      );
    } catch (error) {
      console.error('WhatsApp share error:', error);

      try {
        localStorage.removeItem(newStorageKey);
        localStorage.removeItem(oldStorageKey);
      } catch (storageError) {
        console.error('WhatsApp localStorage remove error:', storageError);
      }

      setWhatsappShared(false);
    } finally {
      setWhatsappBusy(false);
    }
  }

  async function sendNoteToAdmin() {
    if (!profile || noteBusy) return;

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
          content,
        });

      if (dbError) {
        console.error('Send note error:', dbError);
        setNoteMessage('❌ تعذّر حفظ الرسالة، حاول مرة أخرى');
        return;
      }

      setNoteContent('');
      setNoteMessage('✓ تم إرسال رسالتك للمدير بنجاح');
      setTimeout(() => setNoteMessage(''), 4000);
    } catch (error) {
      console.error('Unexpected note error:', error);
      setNoteMessage('❌ حدث خطأ غير متوقع، حاول مرة أخرى');
    } finally {
      setNoteBusy(false);
    }
  }

  if (loading || !profile) return null;

  const byPackage = {};

  myCards.forEach((card) => {
    const key = card.packages?.name || 'غير محدد';

    if (!byPackage[key]) {
      byPackage[key] = {
        count: 0,
        packageId: card.package_id,
        price: card.packages?.price || 0,
      };
    }

    byPackage[key].count += 1;
  });

  const packageEntries = Object.entries(byPackage);
  const totalInventory = myCards.length;

  return (
    <div className="app distributor-page" dir="rtl">
      <Sidebar
        role="distributor"
        active="/distributor"
        name={profile.full_name}
      />

      <main className="main distributor-main">
        <header className="dashboard-header">
          <div className="header-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              لوحة تحكم الموزع
            </div>

            <h1>مرحبًا، {profile.full_name} 👋</h1>

            <p>
              تابع مخزونك ومبيعاتك وحسابك من مكان واحد.
            </p>
          </div>

          <div className="header-actions">
            <NotificationBell userId={profile.id} />

            <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
              <span className="status-dot" />
              {isOnline ? 'متصل ونشط' : 'غير متصل'}
            </div>
          </div>
        </header>

        <section className="weekly-section">
          <WeeklyWinnerPanel />
        </section>

        {profile.personal_card && (
          <section className="personal-card">
            <div className="personal-card-decoration decoration-one" />
            <div className="personal-card-decoration decoration-two" />

            <div className="personal-card-content">
              <div className="personal-card-label">
                <span className="personal-star">★</span>
                كرتك الشخصي الثابت
              </div>

              <div className="personal-code">
                {profile.personal_card}
              </div>

              <p>كرت شخصي مميز خاص بحسابك</p>
            </div>

            <button
              type="button"
              className="personal-copy-button"
              onClick={() => copyPersonalCode(profile.personal_card)}
            >
              {personalCopied ? '✓ تم النسخ' : '▣ نسخ الكرت الشخصي'}
            </button>
          </section>
        )}

        <section className="finance-grid">
          <article className="finance-card balance-card-new">
            <div className="finance-card-top">
              <span className="finance-icon">ر.ي</span>
              <span className="finance-label">رصيدك الحالي</span>
            </div>

            <div className="finance-amount">
              {formatNum(profile.balance)}
              <span>ريال</span>
            </div>

            <div className="balance-footer">
              <div className="inventory-mini">
                <span className="inventory-mini-icon">▦</span>
                <span>
                  المخزون عندك <strong>{formatNum(totalInventory)}</strong> كرت
                </span>
              </div>

              <Link href="/distributor/request" className="request-button">
                <span>＋</span>
                طلب كروت
              </Link>
            </div>
          </article>

          <article className={`finance-card debt-card ${netDebt > 0 ? 'has-debt' : 'no-debt'}`}>
            <div className="finance-card-top">
              <span className="finance-icon debt-icon">↗</span>
              <span className="finance-label">المبلغ المستحق للمدير</span>
            </div>

            <div className="finance-amount">
              {formatNum(netDebt)}
              <span>ريال</span>
            </div>

            <div className="debt-footer">
              <span className="debt-status-icon">
                {netDebt > 0 ? '!' : '✓'}
              </span>
              {netDebt > 0
                ? 'إجمالي المستحقات المالية الحالية'
                : 'الحساب مسدد بالكامل'}
            </div>
          </article>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-card-heading">
              <span className="stat-icon stock-icon">▦</span>
              <span>كروت موزعة عندك</span>
            </div>

            <div className="stat-value purple-text">
              {formatNum(totalInventory)}
            </div>

            <div className="stat-caption">كروت متاحة للبيع</div>
          </article>

          <article className="stat-card">
            <div className="stat-card-heading">
              <span className="stat-icon sales-icon">↗</span>
              <span>مبيعات اليوم</span>
            </div>

            <div className="stat-value green-text">
              {formatNum(soldToday)}
            </div>

            <div className="stat-caption">كرت تم بيعه اليوم</div>
          </article>
        </section>

        <section className="content-panel inventory-panel">
          <div className="panel-heading">
            <div className="panel-heading-copy">
              <div className="panel-title-row">
                <span className="panel-icon purple-panel-icon">▦</span>
                <h2>مخزون الكروت الموزعة عندك</h2>
              </div>

              <p>
                اختر الباقة لبيع كرت. لن يظهر رمز الكرت إلا بعد نجاح البيع.
              </p>
            </div>

            <button
              type="button"
              className="refresh-button"
              onClick={() => load(true)}
              disabled={isRefreshing}
            >
              <span className={isRefreshing ? 'refresh-spinning' : ''}>↻</span>
              {isRefreshing ? 'جاري التحديث...' : 'تحديث المخزون'}
            </button>
          </div>

          {revealError && (
            <div className="inline-error" role="alert">
              <span>!</span>
              {revealError}
            </div>
          )}

          {packageEntries.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">▦</span>
              <strong>لا توجد كروت موزعة عندك حاليًا</strong>
              <p>عندما يتم توزيع كروت على حسابك ستظهر هنا.</p>
              <Link href="/distributor/request" className="empty-action">
                طلب كروت جديدة
              </Link>
            </div>
          ) : (
            <div className="packages-grid">
              {packageEntries.map(([name, info]) => (
                <article className="package-card" key={name}>
                  <div className="package-card-top">
                    <div className="package-name-wrap">
                      <span className="package-small-icon">▦</span>
                      <div>
                        <h3>{name}</h3>
                        <p>مخزون موزع</p>
                      </div>
                    </div>

                    <div className="package-count">
                      <strong>{formatNum(info.count)}</strong>
                      <span>كرت</span>
                    </div>
                  </div>

                  <div className="package-price">
                    <span>سعر الباقة</span>
                    <strong>{formatNum(info.price)} <small>ريال</small></strong>
                  </div>

                  <button
                    type="button"
                    className="sell-button"
                    onClick={() => askReveal(info.packageId, name)}
                  >
                    <span>＋</span>
                    بيع كرت
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel sales-panel">
          <div className="panel-heading">
            <div className="panel-heading-copy">
              <div className="panel-title-row">
                <span className="panel-icon green-panel-icon">↗</span>
                <h2>سجل مبيعات اليوم</h2>
              </div>
              <p>آخر الكروت التي تم بيعها فعلًا اليوم.</p>
            </div>

            <span className="sales-count-badge">
              {formatNum(soldToday)} مبيعات
            </span>
          </div>

          {recentSales.length === 0 ? (
            <div className="empty-state compact-empty">
              <span className="empty-state-icon">◷</span>
              <strong>لا توجد مبيعات مسجلة اليوم</strong>
              <p>ستظهر هنا تفاصيل مبيعاتك بعد إتمام البيع.</p>
            </div>
          ) : (
            <div className="sales-list">
              {recentSales.map((sale) => (
                <article className="sale-row" key={sale.id}>
                  <div className="sale-package-icon">✓</div>

                  <div className="sale-details">
                    <strong>{sale.packages?.name || 'باقة'}</strong>

                    {sale.customer_name && (
                      <span className="sale-customer">
                        الزبون: {sale.customer_name}
                      </span>
                    )}

                    <span className="sale-code">
                      {sale.code}
                    </span>
                  </div>

                  <div className="sale-time">
                    <span>وقت البيع</span>
                    <strong>
                      {sale.sold_at
                        ? new Date(sale.sold_at).toLocaleTimeString('ar-YE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel notes-panel">
          <div className="panel-heading notes-heading">
            <div className="panel-heading-copy">
              <div className="panel-title-row">
                <span className="panel-icon note-panel-icon">✉</span>
                <h2>التواصل مع المدير</h2>
              </div>
              <p>أرسل ملاحظة أو طلبًا إلى المدير من داخل النظام.</p>
            </div>
          </div>

          <form
            className="note-form"
            onSubmit={(event) => {
              event.preventDefault();
              sendNoteToAdmin();
            }}
          >
            <label htmlFor="distributor-note">نص الرسالة</label>

            <textarea
              id="distributor-note"
              rows={4}
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              disabled={noteBusy}
              placeholder="اكتب رسالتك أو طلبك هنا..."
            />

            {noteMessage && (
              <div
                className={`note-feedback ${
                  noteMessage.startsWith('✓')
                    ? 'feedback-success'
                    : noteMessage.startsWith('⚠️')
                      ? 'feedback-warning'
                      : 'feedback-error'
                }`}
                role="status"
              >
                {noteMessage}
              </div>
            )}

            <div className="note-form-footer">
              <span className="note-hint">
                <span>ⓘ</span>
                ستصل رسالتك إلى المدير
              </span>

              <button
                type="submit"
                className="send-note-button"
                disabled={noteBusy || !noteContent.trim()}
              >
                {noteBusy ? 'جاري الإرسال...' : 'إرسال الرسالة'}
                <span>←</span>
              </button>
            </div>
          </form>
        </section>

        <footer className="dashboard-footer">
          <span className="footer-mark">T</span>
          <span>شبكة تواصل</span>
          <span className="footer-separator">•</span>
          <span>لوحة الموزع</span>
        </footer>
      </main>

      {pendingPackage && (
        <div className="modal-backdrop" onClick={cancelReveal}>
          <section
            className="app-modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-sale-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <button
                type="button"
                className="modal-close"
                onClick={cancelReveal}
                disabled={revealBusy}
                aria-label="إغلاق"
              >
                ×
              </button>

              <span className="modal-symbol">↗</span>
              <span className="modal-eyebrow">تأكيد عملية البيع</span>
              <h2 id="confirm-sale-title">{pendingPackage.name}</h2>
              <p>سيتم أخذ كرت واحد من مخزونك عند تأكيد البيع.</p>
            </div>

            <div className="modal-body">
              <div className="security-notice">
                <span>🔒</span>
                <div>
                  <strong>الكرت محمي قبل البيع</strong>
                  <p>لن يظهر رمز الكرت إلا بعد نجاح عملية البيع.</p>
                </div>
              </div>

              <div className="modal-field">
                <label htmlFor="customer-name">
                  اسم الزبون <span>(اختياري للسحب الأسبوعي)</span>
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="مثال: أحمد محمد"
                  disabled={revealBusy}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-modal-button"
                  onClick={cancelReveal}
                  disabled={revealBusy}
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  className="primary-modal-button"
                  onClick={confirmReveal}
                  disabled={revealBusy}
                >
                  {revealBusy ? 'جاري تأكيد البيع...' : 'تأكيد البيع'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {revealedCard && (
        <div className="modal-backdrop" onClick={closeModal}>
          <section
            className="app-modal sold-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sold-card-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header sold-modal-header">
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                aria-label="إغلاق"
              >
                ×
              </button>

              <span className="success-symbol">✓</span>
              <span className="modal-eyebrow">تمت عملية البيع بنجاح</span>
              <h2 id="sold-card-title">{revealedCard.packageName}</h2>
              <p>تم تأكيد البيع. يمكنك الآن نسخ رمز الكرت أو مشاركته.</p>
            </div>

            <div className="modal-body">
              <div className="sold-code-box">
                <span>رمز الكرت المباع</span>
                <strong className="sold-code" dir="ltr">
                  {revealedCard.code}
                </strong>
              </div>

              <div className="sold-card-actions">
                <button
                  type="button"
                  className="copy-code-button"
                  onClick={copyCode}
                >
                  <span>▣</span>
                  {copied ? 'تم النسخ ✓' : 'نسخ الكود'}
                </button>

                <button
                  type="button"
                  className="whatsapp-button"
                  onClick={shareWhatsapp}
                  disabled={whatsappShared || whatsappBusy}
                >
                  <span>◉</span>
                  {whatsappBusy
                    ? 'جاري الفتح...'
                    : whatsappShared
                      ? 'تمت المشاركة ✓'
                      : 'مشاركة واتساب'}
                </button>
              </div>

              <button
                type="button"
                className="close-sold-button"
                onClick={closeModal}
              >
                العودة إلى لوحة الموزع
              </button>
            </div>
          </section>
        </div>
      )}

      <style jsx global>{`
        :root {
          --dist-green: #087f63;
          --dist-green-dark: #075b4b;
          --dist-green-light: #e8f7f1;
          --dist-teal: #12a89a;
          --dist-navy: #16324f;
          --dist-text: #243448;
          --dist-muted: #78899a;
          --dist-border: #e1ebe7;
          --dist-surface: #ffffff;
          --dist-bg: #f3f8f6;
        }

        .distributor-page {
          min-height: 100vh;
          background: var(--dist-bg);
          color: var(--dist-text);
          font-family: inherit;
          direction: rtl;
        }

        .distributor-main {
          box-sizing: border-box;
          width: 100%;
          max-width: 1600px;
          min-width: 0;
          margin-inline: auto;
          padding: 30px clamp(14px, 2.4vw, 36px) 24px;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 25px;
        }

        .header-copy {
          min-width: 0;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--dist-green);
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 9px;
        }

        .eyebrow-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--dist-teal);
          box-shadow: 0 0 0 4px #d8f3eb;
        }

        .dashboard-header h1 {
          color: var(--dist-navy);
          font-size: clamp(22px, 2.2vw, 30px);
          line-height: 1.5;
          font-weight: 900;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .dashboard-header p {
          color: var(--dist-muted);
          font-size: 13px;
          line-height: 1.9;
          margin: 7px 0 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex-shrink: 0;
        }

        .connection-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 13px;
          border: 1px solid;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .connection-status.online {
          color: #087451;
          background: #e8f8f0;
          border-color: #bce9d5;
        }

        .connection-status.offline {
          color: #b91c1c;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }

        .weekly-section {
          margin-bottom: 20px;
          min-width: 0;
        }

        .personal-card {
          isolation: isolate;
          position: relative;
          overflow: hidden;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: clamp(19px, 3vw, 28px);
          margin-bottom: 20px;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 23px;
          color: white;
          background: linear-gradient(115deg, #075b4b 0%, #078a78 55%, #19b7a4 100%);
          box-shadow: 0 14px 32px rgba(8, 127, 99, .16);
        }

        .personal-card-decoration {
          position: absolute;
          z-index: -1;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 50%;
          pointer-events: none;
        }

        .decoration-one {
          width: 230px;
          height: 230px;
          left: -65px;
          top: -135px;
        }

        .decoration-two {
          width: 180px;
          height: 180px;
          left: 110px;
          bottom: -140px;
        }

        .personal-card-content {
          min-width: 0;
        }

        .personal-card-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #d8fff4;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 11px;
        }

        .personal-star {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 25px;
          height: 25px;
          border-radius: 8px;
          color: #fff4be;
          background: rgba(255,255,255,.15);
        }

        .personal-code {
          direction: ltr;
          text-align: right;
          font-size: clamp(24px, 3vw, 34px);
          font-weight: 900;
          letter-spacing: 1.4px;
          overflow-wrap: anywhere;
        }

        .personal-card-content p {
          color: #d9fff5;
          font-size: 11px;
          margin: 7px 0 0;
        }

        .personal-copy-button {
          flex-shrink: 0;
          position: relative;
          z-index: 1;
          padding: 12px 17px;
          border: 1px solid rgba(255,255,255,.4);
          border-radius: 12px;
          background: rgba(255,255,255,.14);
          color: white;
          font-family: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          transition: background .2s, transform .2s;
        }

        .personal-copy-button:hover {
          background: rgba(255,255,255,.25);
          transform: translateY(-1px);
        }

        .finance-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .finance-card {
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-width: 0;
          min-height: 175px;
          padding: 22px;
          border-radius: 21px;
          color: #fff;
          box-shadow: 0 10px 28px rgba(31, 65, 60, .09);
        }

        .balance-card-new {
          background: linear-gradient(125deg, #075b4b 0%, #087f63 58%, #13a995 100%);
        }

        .balance-card-new::after {
          content: '';
          position: absolute;
          width: 190px;
          height: 190px;
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 50%;
          left: -70px;
          bottom: -130px;
          pointer-events: none;
        }

        .debt-card.has-debt {
          background: linear-gradient(125deg, #8e3035 0%, #bf4a4d 100%);
        }

        .debt-card.no-debt {
          background: linear-gradient(125deg, #075b4b 0%, #0a9875 100%);
        }

        .finance-card-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .finance-icon {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          width: 37px;
          height: 37px;
          border-radius: 12px;
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.15);
          font-size: 14px;
          font-weight: 900;
          flex-shrink: 0;
        }

        .finance-label {
          font-size: 12px;
          color: rgba(255,255,255,.9);
          font-weight: 800;
        }

        .finance-amount {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 8px;
          margin: 17px 0;
          font-size: clamp(28px, 3vw, 36px);
          font-weight: 900;
          letter-spacing: -.5px;
          overflow-wrap: anywhere;
        }

        .finance-amount > span {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0;
          opacity: .9;
        }

        .balance-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          padding-top: 13px;
          border-top: 1px solid rgba(255,255,255,.18);
        }

        .inventory-mini {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          color: #dcfff5;
        }

        .inventory-mini strong {
          color: white;
        }

        .inventory-mini-icon {
          font-size: 16px;
        }

        .request-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 13px;
          border-radius: 10px;
          color: #075b4b;
          background: #fff;
          text-decoration: none;
          white-space: nowrap;
          font-size: 11px;
          font-weight: 900;
          transition: transform .2s, box-shadow .2s;
        }

        .request-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 5px 12px rgba(0,0,0,.12);
        }

        .request-button span {
          font-size: 16px;
        }

        .debt-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 13px;
          border-top: 1px solid rgba(255,255,255,.17);
          font-size: 11px;
          color: rgba(255,255,255,.93);
        }

        .debt-status-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255,255,255,.16);
          font-weight: 900;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }

        .stat-card {
          min-width: 0;
          padding: 19px 21px;
          border: 1px solid var(--dist-border);
          border-radius: 18px;
          background: var(--dist-surface);
          box-shadow: 0 4px 15px rgba(31,65,60,.025);
          transition: border-color .2s, transform .2s;
        }

        .stat-card:hover {
          border-color: #b8ddd1;
          transform: translateY(-1px);
        }

        .stat-card-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #667b86;
          font-size: 12px;
          font-weight: 800;
        }

        .stat-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 11px;
          font-size: 17px;
          font-weight: 900;
        }

        .stock-icon {
          color: #087f63;
          background: #e5f6ef;
        }

        .sales-icon {
          color: #078c82;
          background: #e1f7f5;
        }

        .stat-value {
          margin-top: 13px;
          font-size: 30px;
          line-height: 1.2;
          font-weight: 900;
        }

        .purple-text {
          color: var(--dist-green);
        }

        .green-text {
          color: #078c82;
        }

        .stat-caption {
          margin-top: 6px;
          color: #93a3ac;
          font-size: 11px;
        }

        .content-panel {
          min-width: 0;
          margin-bottom: 20px;
          padding: clamp(16px, 2vw, 24px);
          border: 1px solid var(--dist-border);
          border-radius: 21px;
          background: var(--dist-surface);
          box-shadow: 0 5px 20px rgba(31,65,60,.035);
        }

        .panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }

        .panel-heading-copy {
          min-width: 0;
        }

        .panel-title-row {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .panel-title-row h2 {
          margin: 0;
          color: var(--dist-navy);
          font-size: 16px;
          font-weight: 900;
          line-height: 1.6;
        }

        .panel-heading-copy > p {
          margin: 7px 0 0;
          color: #8a9aa4;
          font-size: 11px;
          line-height: 1.8;
        }

        .panel-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 39px;
          height: 39px;
          border-radius: 12px;
          font-size: 19px;
          font-weight: 900;
        }

        .purple-panel-icon {
          color: #087f63;
          background: #e6f6ef;
        }

        .green-panel-icon {
          color: #078c82;
          background: #e1f7f5;
        }

        .note-panel-icon {
          color: #087f75;
          background: #e3f7f4;
        }

        .refresh-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          flex-shrink: 0;
          padding: 10px 13px;
          border: 1px solid #bfe6d8;
          border-radius: 11px;
          color: #087f63;
          background: #effaf5;
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          transition: background .2s;
        }

        .refresh-button:hover:not(:disabled) {
          background: #e0f5eb;
        }

        .refresh-button:disabled {
          cursor: wait;
          opacity: .65;
        }

        .refresh-button > span {
          font-size: 17px;
          line-height: 1;
        }

        .refresh-spinning {
          display: inline-block;
          animation: distributor-spin 1s linear infinite;
        }

        @keyframes distributor-spin {
          to { transform: rotate(360deg); }
        }

        .inline-error {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 16px;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          color: #b91c1c;
          background: #fef2f2;
          font-size: 12px;
          font-weight: 800;
        }

        .inline-error > span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 21px;
          height: 21px;
          flex-shrink: 0;
          border-radius: 50%;
          color: white;
          background: #dc2626;
        }

        .packages-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
          gap: 14px;
        }

        .package-card {
          display: flex;
          flex-direction: column;
          min-width: 0;
          padding: 17px;
          border: 1px solid #dcece5;
          border-radius: 17px;
          background: linear-gradient(145deg, #fff 0%, #f7fcf9 100%);
          transition: transform .2s, box-shadow .2s, border-color .2s;
        }

        .package-card:hover {
          transform: translateY(-2px);
          border-color: #a8d9c7;
          box-shadow: 0 9px 23px rgba(8,127,99,.08);
        }

        .package-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .package-name-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .package-small-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          color: #087f63;
          background: #e5f6ef;
          font-size: 17px;
        }

        .package-name-wrap h3 {
          margin: 0;
          color: var(--dist-navy);
          font-size: 13px;
          font-weight: 900;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .package-name-wrap p {
          margin: 3px 0 0;
          color: #92a2aa;
          font-size: 10px;
        }

        .package-count {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          min-width: 48px;
          min-height: 48px;
          padding: 4px;
          box-sizing: border-box;
          border-radius: 13px;
          color: #087f63;
          background: #e5f6ef;
        }

        .package-count strong {
          font-size: 19px;
          line-height: 1.2;
        }

        .package-count span {
          margin-top: 3px;
          font-size: 9px;
        }

        .package-price {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-top: 17px;
          padding-top: 13px;
          border-top: 1px dashed #dcece5;
          color: #82959e;
          font-size: 11px;
        }

        .package-price strong {
          color: var(--dist-navy);
          font-size: 13px;
          font-weight: 900;
        }

        .package-price small {
          font-size: 10px;
          font-weight: 700;
        }

        .sell-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 43px;
          margin-top: 15px;
          padding: 10px;
          border: none;
          border-radius: 12px;
          color: white;
          background: linear-gradient(110deg, #087f63, #11a997);
          box-shadow: 0 5px 12px rgba(8,127,99,.15);
          font-family: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          transition: transform .2s, box-shadow .2s;
        }

        .sell-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 16px rgba(8,127,99,.22);
        }

        .sell-button span {
          font-size: 17px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 15px;
          text-align: center;
          color: #788c96;
        }

        .empty-state-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 54px;
          height: 54px;
          margin-bottom: 13px;
          border-radius: 17px;
          color: #087f63;
          background: #e6f6ef;
          font-size: 24px;
        }

        .empty-state strong {
          color: var(--dist-navy);
          font-size: 13px;
          font-weight: 900;
        }

        .empty-state p {
          margin: 7px 0 0;
          font-size: 11px;
          line-height: 1.8;
        }

        .empty-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 16px;
          padding: 10px 15px;
          border-radius: 11px;
          color: white;
          background: var(--dist-green);
          text-decoration: none;
          font-size: 11px;
          font-weight: 900;
        }

        .sales-count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 9px 12px;
          border-radius: 10px;
          color: #087b5b;
          background: #e8f8f0;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .sales-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .sale-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 13px;
          border: 1px solid #e6eee9;
          border-radius: 14px;
          background: #fbfdfc;
        }

        .sale-package-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          color: #087f63;
          background: #e3f7ef;
          font-size: 16px;
          font-weight: 900;
        }

        .sale-details {
          display: flex;
          flex: 1;
          flex-direction: column;
          align-items: flex-start;
          gap: 5px;
          min-width: 0;
        }

        .sale-details > strong {
          color: var(--dist-navy);
          font-size: 12px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .sale-customer {
          color: #81939c;
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .sale-code {
          max-width: 100%;
          padding: 5px 8px;
          border-radius: 7px;
          color: #08765e;
          background: #e6f6ef;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          font-weight: 900;
          direction: ltr;
          overflow-wrap: anywhere;
        }

        .sale-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
          flex-shrink: 0;
          color: #95a4ac;
          font-size: 10px;
          white-space: nowrap;
        }

        .sale-time strong {
          color: #596e7b;
          font-size: 11px;
          font-weight: 800;
        }

        .compact-empty {
          padding-block: 25px;
        }

        .notes-heading {
          margin-bottom: 17px;
        }

        .note-form {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .note-form label {
          color: #4c6270;
          font-size: 12px;
          font-weight: 900;
        }

        .note-form textarea {
          display: block;
          box-sizing: border-box;
          width: 100%;
          min-height: 115px;
          padding: 13px 14px;
          border: 1px solid #dce8e3;
          border-radius: 13px;
          outline: none;
          color: var(--dist-text);
          background: #fbfdfc;
          font-family: inherit;
          font-size: 13px;
          line-height: 1.9;
          resize: vertical;
          transition: border-color .2s, box-shadow .2s;
        }

        .note-form textarea:focus {
          border-color: #72c8ae;
          box-shadow: 0 0 0 3px rgba(8,127,99,.09);
        }

        .note-form textarea:disabled {
          opacity: .7;
          cursor: wait;
        }

        .note-form textarea::placeholder {
          color: #a0afb5;
        }

        .note-form-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .note-hint {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #8799a2;
          font-size: 10px;
        }

        .note-hint span {
          font-size: 14px;
        }

        .send-note-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-width: 145px;
          padding: 12px 17px;
          border: none;
          border-radius: 12px;
          color: white;
          background: linear-gradient(110deg, #087f63, #11a997);
          font-family: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          transition: opacity .2s, transform .2s;
        }

        .send-note-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .send-note-button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .send-note-button span {
          font-size: 16px;
        }

        .note-feedback {
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 800;
        }

        .feedback-success {
          color: #047857;
          background: #ecfdf5;
        }

        .feedback-warning {
          color: #b45309;
          background: #fffbeb;
        }

        .feedback-error {
          color: #b91c1c;
          background: #fef2f2;
        }

        .dashboard-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 0 2px;
          color: #8fa1a8;
          font-size: 10px;
        }

        .footer-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 21px;
          height: 21px;
          border-radius: 7px;
          color: white;
          background: var(--dist-green);
          font-size: 11px;
          font-weight: 900;
        }

        .footer-separator {
          color: #c5d4ce;
        }

        /* النوافذ المنبثقة */
        .modal-backdrop {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          padding: 18px;
          overflow-y: auto;
          background: rgba(14, 35, 48, .65);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        .app-modal {
          width: 100%;
          max-width: 420px;
          max-height: calc(100dvh - 36px);
          overflow-y: auto;
          border: 1px solid rgba(255,255,255,.65);
          border-radius: 23px;
          background: #fff;
          box-shadow: 0 26px 90px rgba(0,0,0,.28);
          animation: distributor-modal-in .18s ease-out;
        }

        @keyframes distributor-modal-in {
          from {
            opacity: 0;
            transform: translateY(9px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-header {
          position: relative;
          padding: 27px 22px 24px;
          color: white;
          text-align: center;
          background: linear-gradient(120deg, #075b4b, #087f63 58%, #12a89a);
        }

        .modal-close {
          position: absolute;
          top: 12px;
          left: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid rgba(255,255,255,.25);
          border-radius: 10px;
          color: white;
          background: rgba(255,255,255,.13);
          font-family: inherit;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
        }

        .modal-close:disabled {
          cursor: not-allowed;
          opacity: .6;
        }

        .modal-symbol,
        .success-symbol {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          margin: 0 auto 13px;
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 15px;
          color: white;
          background: rgba(255,255,255,.15);
          font-size: 22px;
          font-weight: 900;
        }

        .success-symbol {
          border: none;
          color: #d5ffe8;
          background: rgba(255,255,255,.16);
        }

        .modal-eyebrow {
          display: block;
          margin-bottom: 7px;
          color: #d8fff4;
          font-size: 11px;
          font-weight: 800;
        }

        .modal-header h2 {
          margin: 0;
          color: white;
          font-size: 23px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .modal-header p {
          max-width: 300px;
          margin: 9px auto 0;
          color: #e8fff8;
          font-size: 11px;
          line-height: 1.9;
        }

        .modal-body {
          padding: 22px;
        }

        .security-notice {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-bottom: 19px;
          padding: 13px;
          border: 1px solid #dcebe5;
          border-radius: 13px;
          background: #f5faf7;
        }

        .security-notice > span {
          font-size: 19px;
        }

        .security-notice strong {
          color: var(--dist-navy);
          font-size: 11px;
          font-weight: 900;
        }

        .security-notice p {
          margin: 5px 0 0;
          color: #7b8f97;
          font-size: 10px;
          line-height: 1.8;
        }

        .modal-field {
          margin-bottom: 20px;
        }

        .modal-field label {
          display: block;
          margin-bottom: 8px;
          color: #374d5a;
          font-size: 12px;
          font-weight: 900;
        }

        .modal-field label span {
          color: #95a4aa;
          font-size: 10px;
          font-weight: 500;
        }

        .modal-field input {
          box-sizing: border-box;
          width: 100%;
          padding: 12px;
          border: 1px solid #dce8e3;
          border-radius: 11px;
          outline: none;
          color: var(--dist-text);
          background: white;
          font-family: inherit;
          font-size: 13px;
        }

        .modal-field input:focus {
          border-color: #72c8ae;
          box-shadow: 0 0 0 3px rgba(8,127,99,.09);
        }

        .modal-actions {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 10px;
        }

        .secondary-modal-button,
        .primary-modal-button {
          min-height: 45px;
          padding: 11px 8px;
          border-radius: 12px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .secondary-modal-button {
          border: 1px solid #dce8e3;
          color: #526873;
          background: white;
        }

        .primary-modal-button {
          border: none;
          color: white;
          background: linear-gradient(110deg, #087f63, #11a997);
        }

        .primary-modal-button:disabled,
        .secondary-modal-button:disabled {
          cursor: not-allowed;
          opacity: .6;
        }

        .sold-code-box {
          padding: 17px 12px;
          border: 1px dashed #9ed9c5;
          border-radius: 15px;
          background: #f1faf5;
          text-align: center;
        }

        .sold-code-box > span {
          display: block;
          margin-bottom: 10px;
          color: #7b8f97;
          font-size: 11px;
          font-weight: 800;
        }

        .sold-code {
          display: block;
          color: #075b4b;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: clamp(23px, 6vw, 31px);
          font-weight: 900;
          letter-spacing: 1px;
          overflow-wrap: anywhere;
        }

        .sold-card-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 16px;
        }

        .copy-code-button,
        .whatsapp-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-width: 0;
          min-height: 45px;
          padding: 10px 7px;
          border-radius: 11px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .copy-code-button {
          border: 1px solid #bce4d5;
          color: #08765e;
          background: #eff9f4;
        }

        .whatsapp-button {
          border: none;
          color: white;
          background: #1fae5b;
        }

        .whatsapp-button:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .close-sold-button {
          width: 100%;
          min-height: 45px;
          margin-top: 11px;
          padding: 11px;
          border: none;
          border-radius: 11px;
          color: #08765e;
          background: #eaf7f1;
          font-family: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        button:focus-visible,
        a:focus-visible {
          outline: 3px solid rgba(18,168,154,.4);
          outline-offset: 3px;
        }

        /* الأجهزة اللوحية */
        @media (max-width: 900px) {
          .distributor-main {
            padding: 23px 18px;
          }

          .finance-card {
            padding: 19px;
          }

          .content-panel {
            padding: 18px;
          }

          .packages-grid {
            grid-template-columns: repeat(auto-fill, minmax(min(100%, 205px), 1fr));
          }
        }

        /* الهواتف */
        @media (max-width: 600px) {
          .distributor-main {
            padding: 16px 12px 20px;
          }

          .dashboard-header {
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 17px;
          }

          .dashboard-header h1 {
            font-size: 21px;
          }

          .dashboard-header p {
            max-width: 290px;
            font-size: 11px;
          }

          .eyebrow {
            margin-bottom: 6px;
            font-size: 11px;
          }

          .header-actions {
            gap: 7px;
          }

          .connection-status {
            gap: 6px;
            padding: 8px 9px;
            font-size: 9px;
          }

          .status-dot {
            width: 6px;
            height: 6px;
          }

          .weekly-section {
            margin-bottom: 14px;
          }

          .personal-card {
            align-items: flex-start;
            flex-direction: column;
            gap: 15px;
            padding: 18px;
            border-radius: 18px;
            margin-bottom: 14px;
          }

          .personal-code {
            font-size: 27px;
          }

          .personal-copy-button {
            width: 100%;
            min-height: 42px;
          }

          .finance-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 11px;
            margin-bottom: 12px;
          }

          .finance-card {
            min-height: 151px;
            padding: 17px;
            border-radius: 17px;
          }

          .finance-amount {
            margin: 14px 0;
            font-size: 30px;
          }

          .balance-footer {
            gap: 10px;
          }

          .request-button {
            padding: 9px 11px;
          }

          .stats-grid {
            gap: 10px;
            margin-bottom: 15px;
          }

          .stat-card {
            padding: 14px 12px;
            border-radius: 15px;
          }

          .stat-card-heading {
            align-items: flex-start;
            gap: 7px;
            font-size: 10px;
            line-height: 1.7;
          }

          .stat-icon {
            width: 31px;
            height: 31px;
            border-radius: 9px;
            font-size: 14px;
          }

          .stat-value {
            margin-top: 12px;
            font-size: 26px;
          }

          .stat-caption {
            font-size: 10px;
            line-height: 1.6;
          }

          .content-panel {
            padding: 14px;
            margin-bottom: 14px;
            border-radius: 17px;
          }

          .panel-heading {
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 16px;
          }

          .panel-title-row {
            gap: 8px;
          }

          .panel-title-row h2 {
            font-size: 13px;
          }

          .panel-icon {
            width: 33px;
            height: 33px;
            border-radius: 10px;
            font-size: 16px;
          }

          .panel-heading-copy > p {
            font-size: 10px;
          }

          .refresh-button {
            padding: 8px;
            gap: 5px;
            font-size: 10px;
          }

          .packages-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .package-card {
            padding: 11px;
            border-radius: 14px;
          }

          .package-card-top {
            gap: 6px;
          }

          .package-name-wrap {
            align-items: flex-start;
            gap: 6px;
          }

          .package-small-icon {
            width: 28px;
            height: 28px;
            border-radius: 9px;
            font-size: 13px;
          }

          .package-name-wrap h3 {
            font-size: 11px;
          }

          .package-name-wrap p {
            font-size: 9px;
          }

          .package-count {
            min-width: 36px;
            min-height: 39px;
            border-radius: 10px;
          }

          .package-count strong {
            font-size: 15px;
          }

          .package-count span {
            font-size: 8px;
          }

          .package-price {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
            margin-top: 12px;
            padding-top: 10px;
            font-size: 10px;
          }

          .package-price strong {
            font-size: 12px;
          }

          .sell-button {
            min-height: 39px;
            margin-top: 11px;
            padding: 8px 5px;
            border-radius: 10px;
            font-size: 10px;
          }

          .sale-row {
            align-items: flex-start;
            gap: 9px;
            padding: 10px;
          }

          .sale-package-icon {
            width: 31px;
            height: 31px;
            border-radius: 9px;
          }

          .sale-details > strong {
            font-size: 11px;
          }

          .sale-time {
            font-size: 9px;
          }

          .sale-time strong {
            font-size: 10px;
          }

          .sales-count-badge {
            padding: 7px 8px;
            font-size: 9px;
          }

          .note-form textarea {
            min-height: 105px;
            font-size: 12px;
          }

          .note-form-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .send-note-button {
            width: 100%;
          }

          .dashboard-footer {
            padding-bottom: 0;
          }
        }

        @media (max-width: 360px) {
          .dashboard-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .packages-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .package-card {
            padding: 14px;
          }

          .package-card-top {
            align-items: center;
          }

          .package-price {
            align-items: center;
            flex-direction: row;
          }

          .finance-amount {
            font-size: 27px;
          }

          .sale-row {
            flex-wrap: wrap;
          }

          .sale-time {
            width: 100%;
            padding-right: 40px;
            align-items: flex-start;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .distributor-page *,
          .distributor-page *::before,
          .distributor-page *::after {
            animation-duration: .01ms !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
