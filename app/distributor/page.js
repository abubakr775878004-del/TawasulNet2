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

  /*
   * حماية إرسال الكرت إلى واتساب.
   *
   * يتم حفظ الكرت الذي تم بدء مشاركته في واتساب
   * في localStorage حتى لا يمكن إعادة مشاركته
   * من نفس المتصفح حتى بعد Refresh أو إغلاق الصفحة.
   */
  const [whatsappShared, setWhatsappShared] = useState(false);
  const [whatsappBusy, setWhatsappBusy] = useState(false);

  const [personalCopied, setPersonalCopied] = useState(false);

  const [noteContent, setNoteContent] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');

  const formatNum = (num) => {
    const val = Math.round(Number(num) || 0);

    return val.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    });
  };

  /*
   * التحقق من حالة إرسال الكرت إلى واتساب.
   */
  useEffect(() => {
    if (!revealedCard?.code) {
      setWhatsappShared(false);
      return;
    }

    try {
      const storageKey =
        `tawasul_whatsapp_shared_${revealedCard.code}`;

      const alreadyShared =
        localStorage.getItem(storageKey) === '1';

      setWhatsappShared(alreadyShared);
    } catch (error) {
      console.error(
        'WhatsApp localStorage read error:',
        error
      );

      setWhatsappShared(false);
    }
  }, [revealedCard]);

  /*
   * جلب بيانات الموزع.
   *
   * الدين يتم قراءته من قاعدة البيانات.
   */
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
        console.error(
          'Error loading available cards:',
          availableCardsError
        );
      }

      setMyCards(availableCards || []);

      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const {
        count,
        error: soldCountError,
      } = await supabase
        .from('cards')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte(
          'sold_at',
          since.toISOString()
        );

      if (soldCountError) {
        console.error(
          'Error loading sold count:',
          soldCountError
        );
      }

      setSoldToday(count || 0);

      const {
        data: salesData,
        error: salesError,
      } = await supabase
        .from('cards')
        .select(
          'id, code, sold_at, customer_name, packages(name, price)'
        )
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte(
          'sold_at',
          since.toISOString()
        )
        .order('sold_at', {
          ascending: false,
        })
        .limit(10);

      if (salesError) {
        console.error(
          'Error loading recent sales:',
          salesError
        );
      }

      setRecentSales(salesData || []);

      const {
        data: freshProfile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('debt_balance, debt')
        .eq('id', profile.id)
        .single();

      if (profileError) {
        console.error(
          'Error loading distributor debt:',
          profileError
        );
      } else {
        const currentNetDebt = Number(
          freshProfile?.debt_balance ??
            freshProfile?.debt ??
            0
        );

        setNetDebt(
          Number.isFinite(currentNetDebt)
            ? currentNetDebt
            : 0
        );
      }
    } catch (err) {
      console.error(
        'Error loading distributor data:',
        err
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!profile) return;

    load(true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener(
      'online',
      handleOnline
    );

    window.addEventListener(
      'offline',
      handleOffline
    );

    return () => {
      window.removeEventListener(
        'online',
        handleOnline
      );

      window.removeEventListener(
        'offline',
        handleOffline
      );
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
    setRevealError('');
  }

  async function confirmReveal() {
    if (
      !pendingPackage ||
      !profile ||
      revealBusy
    ) {
      return;
    }

    setRevealBusy(true);
    setRevealError('');

    try {
      /*
       * نبحث عن أول كرت متاح للموزع
       * من الباقة المطلوبة.
       */
      const {
        data,
        error,
      } = await supabase
        .from('cards')
        .select(
          'id, code, package_id, packages(name, price)'
        )
        .eq('assigned_to', profile.id)
        .eq(
          'package_id',
          pendingPackage.id
        )
        .eq('status', 'with_distributor')
        .order('created_at', {
          ascending: true,
        })
        .limit(1);

      if (error) {
        console.error(
          'Find card error:',
          error
        );

        setRevealError(
          'حدث خطأ أثناء البحث عن الكرت'
        );

        return;
      }

      if (!data || data.length === 0) {
        setRevealError(
          'تعذّر إيجاد كرت متاح من هذه الباقة'
        );

        setPendingPackage(null);

        return;
      }

      const card = data[0];

      const trimmedCustomerName =
        customerName.trim();

      const cardPrice = Number(
        card.packages?.price || 0
      );

      if (
        !Number.isFinite(cardPrice) ||
        cardPrice <= 0
      ) {
        setRevealError(
          'سعر الباقة غير صحيح، لا يمكن إتمام البيع'
        );

        return;
      }

      const managerShare =
        cardPrice * 0.9;

      const distributorShare =
        cardPrice * 0.1;

      /*
       * حفظ وقت البيع المحلي مباشرة بعد نجاح RPC.
       *
       * هذا أفضل من استخدام وقت الضغط على واتساب.
       */
      const saleCompletedAt =
        new Date().toISOString();

      const {
        data: saleResult,
        error: saleError,
      } = await supabase.rpc(
        'confirm_card_sale',
        {
          p_card_id: card.id,
          p_distributor_id: profile.id,
          p_package_id: card.package_id,
          p_price: cardPrice,
          p_manager_share:
            managerShare,
          p_distributor_share:
            distributorShare,
          p_customer_name:
            trimmedCustomerName !== ''
              ? trimmedCustomerName
              : null,
        }
      );

      if (saleError) {
        console.error(
          'confirm_card_sale error:',
          saleError
        );

        setRevealError(
          saleError.message ||
            'تعذّر تأكيد البيع، لم يتم خصم أي مبلغ'
        );

        return;
      }

      /*
       * إعادة قراءة الدين الحقيقي من قاعدة البيانات.
       */
      const {
        data: updatedProfile,
        error: updatedProfileError,
      } = await supabase
        .from('profiles')
        .select(
          'debt_balance, debt'
        )
        .eq('id', profile.id)
        .single();

      if (updatedProfileError) {
        console.error(
          'Error refreshing debt after sale:',
          updatedProfileError
        );
      } else {
        const updatedDebt = Number(
          updatedProfile?.debt_balance ??
            updatedProfile?.debt ??
            0
        );

        setNetDebt(
          Number.isFinite(updatedDebt)
            ? updatedDebt
            : 0
        );
      }

      /*
       * نحافظ على الكود القادم من RPC إن وجد.
       */
      let soldCode = card.code;

      if (
        saleResult &&
        typeof saleResult === 'object'
      ) {
        if (saleResult.code) {
          soldCode = saleResult.code;
        } else if (
          saleResult.card_code
        ) {
          soldCode =
            saleResult.card_code;
        }
      }

      /*
       * نحتفظ أيضًا بـ:
       * - id
       * - وقت البيع
       *
       * حتى نستخدمهما عند مشاركة الكرت.
       */
      setRevealedCard({
        id: card.id,
        code: soldCode,
        packageName:
          pendingPackage.name,
        soldAt:
          saleResult?.sold_at ||
          saleResult?.sale_time ||
          saleCompletedAt,
      });

      /*
       * هذا كرت جديد ولم تتم مشاركته بعد.
       */
      setWhatsappShared(false);

      setPendingPackage(null);
      setCustomerName('');
      setCopied(false);

      await load(true);
    } catch (error) {
      console.error(
        'Confirm reveal error:',
        error
      );

      setRevealError(
        error?.message ||
          'حدث خطأ غير متوقع، حاول مرة أخرى'
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
      await navigator.clipboard.writeText(
        revealedCard.code
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        'Copy code error:',
        error
      );
    }
  }

  async function copyPersonalCode(
    codeText
  ) {
    if (!codeText) return;

    try {
      await navigator.clipboard.writeText(
        codeText
      );

      setPersonalCopied(true);

      setTimeout(() => {
        setPersonalCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        'Copy personal card error:',
        error
      );
    }
  }

  /*
   * 30 ذكرًا / دعاءً / حكمة قصيرة.
   *
   * يتم اختيار واحدة عشوائيًا عند مشاركة الكرت.
   */
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

  /*
   * إرسال الكرت إلى واتساب.
   *
   * الحماية:
   * 1. منع الضغط أثناء فتح المشاركة.
   * 2. منع مشاركة نفس الكرت مرة أخرى.
   * 3. حفظ حالة المشاركة في localStorage.
   * 4. وقت الرسالة = وقت البيع وليس وقت الضغط على واتساب.
   */
  function shareWhatsapp() {
    if (
      !revealedCard?.code ||
      whatsappBusy ||
      whatsappShared
    ) {
      return;
    }

    const code = String(
      revealedCard.code
    ).trim();

    if (!code) return;

    const storageKey =
      `tawasul_whatsapp_shared_${code}`;

    try {
      /*
       * فحص إضافي قبل فتح واتساب.
       */
      if (
        localStorage.getItem(
          storageKey
        ) === '1'
      ) {
        setWhatsappShared(true);
        return;
      }

      setWhatsappBusy(true);

      const dailyReminder =
        dailyReminders[
          Math.floor(
            Math.random() *
              dailyReminders.length
          )
        ];

      /*
       * نستخدم وقت البيع المحفوظ.
       * إذا لم يكن موجودًا لأي سبب نستخدم الوقت الحالي
       * كحل احتياطي فقط.
       */
      const saleDateTime =
        revealedCard.soldAt
          ? new Date(
              revealedCard.soldAt
            )
          : new Date();

      const saleDate =
        saleDateTime.toLocaleDateString(
          'ar-YE',
          {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }
        );

      const saleTime =
        saleDateTime.toLocaleTimeString(
          'ar-YE',
          {
            hour: '2-digit',
            minute: '2-digit',
          }
        );

      /*
       * رسالة واتساب الجديدة.
       *
       * تم استخدام تنسيق واتساب الرسمي:
       * Bold + Inline Code + Italic.
       */
      const text = `🌐 *شبكة تواصل* 📶

🎫 *كرت إنترنت*

🔐 *رمز الكرت*
\`${code}\`

📦 *الباقة:* *${revealedCard.packageName}*
📅 *${saleDate}*  |  🕐 *${saleTime}*

✨ _${dailyReminder}_

💙 *شكرًا لاختياركم شبكة تواصل*`;

      /*
       * نحفظ حالة المشاركة قبل فتح واتساب.
       *
       * هذا يمنع الضغط المزدوج أو فتح رابطين لنفس الكرت.
       */
      localStorage.setItem(
        storageKey,
        '1'
      );

      setWhatsappShared(true);

      window.open(
        `https://wa.me/?text=${encodeURIComponent(
          text
        )}`,
        '_blank'
      );
    } catch (error) {
      console.error(
        'WhatsApp share error:',
        error
      );

      /*
       * إذا فشلت عملية فتح المشاركة،
       * نعيد السماح بالمحاولة.
       */
      try {
        localStorage.removeItem(
          storageKey
        );
      } catch (storageError) {
        console.error(
          'WhatsApp localStorage remove error:',
          storageError
        );
      }

      setWhatsappShared(false);
    } finally {
      setWhatsappBusy(false);
    }
  }

  async function sendNoteToAdmin(e) {
    e.preventDefault();

    if (!profile || noteBusy) {
      return;
    }

    const content =
      noteContent.trim();

    if (!content) {
      setNoteMessage(
        '⚠️ اكتب الرسالة أولًا'
      );

      return;
    }

    setNoteBusy(true);
    setNoteMessage('');

    try {
      const {
        error: dbError,
      } = await supabase
        .from('distributor_notes')
        .insert({
          distributor_id:
            profile.id,
          distributor_name:
            profile.full_name,
          content,
        });

      if (dbError) {
        console.error(
          'Send note error:',
          dbError
        );

        setNoteMessage(
          '❌ تعذّر حفظ الرسالة، حاول مرة أخرى'
        );

        return;
      }

      setNoteContent('');

      setNoteMessage(
        '✓ تم إرسال رسالتك للمدير بنجاح'
      );

      setTimeout(() => {
        setNoteMessage('');
      }, 4000);
    } catch (error) {
      console.error(
        'Unexpected note error:',
        error
      );

      setNoteMessage(
        '❌ حدث خطأ غير متوقع، حاول مرة أخرى'
      );
    } finally {
      setNoteBusy(false);
    }
  }

  if (loading || !profile) {
    return null;
  }

  const byPackage = {};

  myCards.forEach((c) => {
    const key =
      c.packages?.name ||
      'غير محدد';

    if (!byPackage[key]) {
      byPackage[key] = {
        count: 0,
        packageId:
          c.package_id,
        price:
          c.packages?.price || 0,
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
        <div
          className="topbar"
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1>
              مرحبًا،{' '}
              {profile.full_name} 👋
            </h1>

            <div className="greet">
              إليك ملخص حسابك اليوم
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isOnline
                ? '#ECFDF5'
                : '#FEF2F2',
              color: isOnline
                ? '#059669'
                : '#DC2626',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 11.5,
              fontWeight: '800',
              border: `1px solid ${
                isOnline
                  ? '#A7F3D0'
                  : '#FECACA'
              }`,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isOnline
                  ? '#10B981'
                  : '#EF4444',
                display:
                  'inline-block',
              }}
            />

            {isOnline
              ? 'نشط'
              : 'خامل'}
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
              padding:
                '20px 24px',
              color: '#fff',
              marginBottom: 20,
              display: 'flex',
              justifyContent:
                'space-between',
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
                copyPersonalCode(
                  profile.personal_card
                )
              }
              style={{
                background:
                  'rgba(255,255,255,0.2)',
                border:
                  '1px solid rgba(255,255,255,0.4)',
                color: '#fff',
                padding:
                  '10px 18px',
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1fr 1fr',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            className="balance-card"
            style={{
              marginBottom: 0,
            }}
          >
            <div className="lbl">
              رصيدك الحالي بمخزنك
            </div>

            <div className="amt">
              {Number(
                profile.balance
              ).toLocaleString(
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
                كروت لديك الآن:{' '}
                {myCards.length}
              </div>

              <Link href="/distributor/request">
                <button className="req-btn">
                  طلب كروت جديد
                </button>
              </Link>
            </div>
          </div>

          <div
            style={{
              background:
                netDebt > 0
                  ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
              borderRadius: 20,
              padding: 20,
              color: '#fff',
              display: 'flex',
              flexDirection:
                'column',
              justifyContent:
                'space-between',
              boxShadow:
                '0 10px 25px rgba(0, 0, 0, 0.1)',
              transition:
                'background 0.3s ease',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: '#f1f5f9',
                  fontWeight: '700',
                  marginBottom: 6,
                }}
              >
                المبلغ الصافي المستحق للمدير
              </div>

              <div
                className="mono"
                style={{
                  fontSize: 26,
                  fontWeight: '900',
                  letterSpacing: 0.5,
                }}
              >
                {formatNum(
                  netDebt
                )}{' '}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight:
                      'normal',
                  }}
                >
                  ريال
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: 11.5,
                color: '#f8fafc',
                marginTop: 10,
                opacity: 0.9,
              }}
            >
              {netDebt > 0
                ? '⚠️ إجمالي المستحقات المالية الحالية'
                : '✓ الحساب مسدد بالكامل'}
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
          <div
            className="panel-head"
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3>
                باقاتي المتاحة
              </h3>

              <span className="muted">
                اضغط &quot;إظهار كرت&quot; عند وجود زبون
              </span>
            </div>

            <button
              onClick={() =>
                load(true)
              }
              disabled={
                isRefreshing
              }
              style={{
                background:
                  '#F3F0FB',
                border:
                  '1px solid #DDD3F5',
                color:
                  '#5B21B6',
                padding:
                  '6px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: '800',
                cursor:
                  'pointer',
                display: 'flex',
                alignItems:
                  'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  display:
                    'inline-block',
                  transform:
                    isRefreshing
                      ? 'rotate(360deg)'
                      : 'none',
                  transition:
                    'transform 0.5s',
                }}
              >
                🔄
              </span>

              {isRefreshing
                ? 'جاري التحديث...'
                : 'تحديث القائمة'}
            </button>
          </div>

          {revealError && (
            <div
              style={{
                color: '#DC2626',
                background:
                  '#FEF2F2',
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
                fontSize: 13,
              }}
            >
              {revealError}
            </div>
          )}

          {Object.keys(
            byPackage
          ).length === 0 && (
            <div
              style={{
                color:
                  'var(--ink-soft)',
                fontSize: 13,
              }}
            >
              لا توجد كروت لديك حاليًا
            </div>
          )}

          <div className="pkg-grid">
            {Object.entries(
              byPackage
            ).map(
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
                    <span>
                      كرت لديك
                    </span>
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

        <div
          className="panel"
          style={{
            marginTop: 20,
          }}
        >
          <div className="panel-head">
            <h3>
              سجل مبيعات اليوم الأخيرة
            </h3>

            <span className="muted">
              آخر الكروت التي قمت ببيعها اليوم
            </span>
          </div>

          {recentSales.length ===
          0 ? (
            <div
              style={{
                color:
                  'var(--ink-soft)',
                fontSize: 13,
                padding:
                  '10px 0',
              }}
            >
              لم تقم ببيع أي كرت حتى الآن اليوم.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection:
                  'column',
                gap: 10,
                marginTop: 10,
              }}
            >
              {recentSales.map(
                (sale) => (
                  <div
                    key={sale.id}
                    style={{
                      display:
                        'flex',
                      justifyContent:
                        'space-between',
                      alignItems:
                        'center',
                      background:
                        '#F8FAFC',
                      padding:
                        '10px 14px',
                      borderRadius:
                        12,
                      border:
                        '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight:
                            '800',
                          color:
                            '#1E293B',
                        }}
                      >
                        {sale
                          .packages
                          ?.name ||
                          'باقة'}{' '}
                        {sale.customer_name
                          ? `(الزبون: ${sale.customer_name})`
                          : ''}
                      </div>

                      <div
                        className="mono"
                        style={{
                          fontSize: 12,
                          color:
                            '#64748B',
                        }}
                      >
                        {sale.code}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign:
                          'left',
                        fontSize:
                          10.5,
                        color:
                          '#94A3B8',
                      }}
                    >
                      {new Date(
                        sale.sold_at
                      ).toLocaleTimeString(
                        'ar-YE',
                        {
                          hour: '2-digit',
                          minute:
                            '2-digit',
                        }
                      )}
                    </div>
                  </div>
                )
              )}
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

          <form
            onSubmit={
              sendNoteToAdmin
            }
          >
            <textarea
              rows={3}
              value={
                noteContent
              }
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
                    noteMessage.startsWith(
                      '✓'
                    )
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
                padding:
                  '10px 20px',
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
            alignItems:
              'center',
            justifyContent:
              'center',
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
              textAlign:
                'center',
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
                  color:
                    '#E3D6FF',
                  fontWeight:
                    '700',
                  marginBottom: 6,
                }}
              >
                إظهار كرت من باقة
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight:
                    '900',
                }}
              >
                {
                  pendingPackage.name
                }
              </div>
            </div>

            <div
              style={{
                padding:
                  '20px 24px 24px',
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  color:
                    'var(--ink-soft)',
                  marginBottom: 15,
                  textAlign:
                    'right',
                }}
              >
                <label
                  style={{
                    display:
                      'block',
                    marginBottom: 6,
                    fontWeight:
                      '700',
                    color:
                      '#374151',
                  }}
                >
                  اسم الزبون (اختياري للسحب الأسبوعي):
                </label>

                <input
                  type="text"
                  value={
                    customerName
                  }
                  onChange={(e) =>
                    setCustomerName(
                      e.target.value
                    )
                  }
                  placeholder="مثال: أحمد محمد"
                  style={{
                    width: '100%',
                    padding:
                      '10px 12px',
                    borderRadius:
                      10,
                    border:
                      '1.5px solid var(--line)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div
                style={{
                  display:
                    'flex',
                  gap: 10,
                }}
              >
                <button
                  onClick={
                    cancelReveal
                  }
                  disabled={
                    revealBusy
                  }
                  style={{
                    flex: 1,
                    padding:
                      '13px 0',
                    borderRadius:
                      12,
                    border:
                      '1.5px solid var(--line)',
                    background:
                      '#fff',
                    fontWeight:
                      '800',
                    cursor:
                      'pointer',
                  }}
                >
                  إلغاء
                </button>

                <button
                  onClick={
                    confirmReveal
                  }
                  disabled={
                    revealBusy
                  }
                  style={{
                    flex: 1,
                    padding:
                      '13px 0',
                    borderRadius:
                      12,
                    border: 'none',
                    background:
                      'linear-gradient(120deg, #7C3AED, #DB2777)',
                    color: '#fff',
                    fontWeight:
                      '800',
                    cursor:
                      'pointer',
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
            alignItems:
              'center',
            justifyContent:
              'center',
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
              textAlign:
                'center',
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
                  '18px 20px',
                color: '#fff',
                position:
                  'relative',
              }}
            >
              <button
                onClick={
                  closeModal
                }
                style={{
                  position:
                    'absolute',
                  top: 12,
                  left: 12,
                  width: 30,
                  height: 30,
                  borderRadius:
                    10,
                  border: 'none',
                  background:
                    'rgba(255,255,255,0.25)',
                  color: '#fff',
                  fontWeight:
                    '900',
                  cursor:
                    'pointer',
                }}
              >
                ✕
              </button>

              <div
                style={{
                  fontSize: 12.5,
                  color:
                    '#E3D6FF',
                  fontWeight:
                    '700',
                }}
              >
                {
                  revealedCard.packageName
                }
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight:
                    '900',
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
                  fontWeight:
                    '900',
                  margin:
                    '4px 0 18px',
                  direction:
                    'ltr',
                  color:
                    '#3A1D66',
                }}
              >
                {
                  revealedCard.code
                }
              </div>

              <div
                style={{
                  display:
                    'flex',
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <button
                  onClick={
                    copyCode
                  }
                  style={{
                    flex: 1,
                    padding:
                      '11px 0',
                    borderRadius:
                      12,
                    border:
                      '1.5px solid #DDD3F5',
                    background:
                      '#F3F0FB',
                    color:
                      '#5B21B6',
                    fontWeight:
                      '800',
                    cursor:
                      'pointer',
                  }}
                >
                  {copied
                    ? '✓ تم النسخ'
                    : '📋 نسخ الكود'}
                </button>

                <button
                  onClick={
                    shareWhatsapp
                  }
                  disabled={
                    whatsappShared ||
                    whatsappBusy
                  }
                  style={{
                    flex: 1,
                    padding:
                      '11px 0',
                    borderRadius:
                      12,
                    border: 'none',
                    background:
                      whatsappShared
                        ? '#94A3B8'
                        : '#25D366',
                    color: '#fff',
                    fontWeight:
                      '800',
                    cursor:
                      whatsappShared ||
                      whatsappBusy
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      whatsappBusy
                        ? 0.75
                        : 1,
                  }}
                >
                  {whatsappBusy
                    ? 'جاري الفتح...'
                    : whatsappShared
                      ? '✓ تم الإرسال'
                      : 'واتساب'}
                </button>
              </div>

              <button
                onClick={
                  closeModal
                }
                style={{
                  width: '100%',
                  padding:
                    '13px 0',
                  borderRadius:
                    14,
                  border: 'none',
                  background:
                    '#F3F0FB',
                  color:
                    '#5B21B6',
                  fontWeight:
                    '800',
                  cursor:
                    'pointer',
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
