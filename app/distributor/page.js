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

  useEffect(() => {
    if (!revealedCard?.code) {
      setWhatsappShared(false);
      return;
    }

    try {
      const code = String(revealedCard.code).trim();
      const cardId = String(revealedCard.id || '').trim();

      const newStorageKey =
        `tawasul_whatsapp_shared_v2_${cardId}_${code}`;

      const oldStorageKey =
        `tawasul_whatsapp_shared_${code}`;

      const alreadyShared =
        localStorage.getItem(newStorageKey) === '1' ||
        localStorage.getItem(oldStorageKey) === '1';

      setWhatsappShared(alreadyShared);
    } catch (error) {
      console.error(
        'WhatsApp localStorage read error:',
        error
      );

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
        .gte('sold_at', since.toISOString());

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
        .gte('sold_at', since.toISOString())
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
    setRevealError('');
  }

  async function confirmReveal() {
    if (!pendingPackage || !profile || revealBusy) {
      return;
    }

    setRevealBusy(true);
    setRevealError('');

    try {
      const {
        data,
        error,
      } = await supabase
        .from('cards')
        .select(
          'id, code, package_id, packages(name, price)'
        )
        .eq('assigned_to', profile.id)
        .eq('package_id', pendingPackage.id)
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

      const managerShare = cardPrice * 0.9;
      const distributorShare = cardPrice * 0.1;

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
          p_manager_share: managerShare,
          p_distributor_share: distributorShare,
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

      const {
        data: updatedProfile,
        error: updatedProfileError,
      } = await supabase
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

      let soldCode = card.code;

      if (
        saleResult &&
        typeof saleResult === 'object'
      ) {
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

  async function copyPersonalCode(codeText) {
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

    const cardId = String(
      revealedCard.id || ''
    ).trim();

    if (!code || !cardId) {
      console.error(
        'WhatsApp share blocked: missing card id or code'
      );

      return;
    }

    const newStorageKey =
      `tawasul_whatsapp_shared_v2_${cardId}_${code}`;

    const oldStorageKey =
      `tawasul_whatsapp_shared_${code}`;

    try {
      const alreadyShared =
        localStorage.getItem(
          newStorageKey
        ) === '1' ||
        localStorage.getItem(
          oldStorageKey
        ) === '1';

      if (alreadyShared) {
        setWhatsappShared(true);
        return;
      }

      setWhatsappBusy(true);

      const secondCheck =
        localStorage.getItem(
          newStorageKey
        ) === '1' ||
        localStorage.getItem(
          oldStorageKey
        ) === '1';

      if (secondCheck) {
        setWhatsappShared(true);
        return;
      }

      const dailyReminder =
        dailyReminders[
          Math.floor(
            Math.random() *
              dailyReminders.length
          )
        ];

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

      const text = `🌐 *شبكة تواصل* 📶

🎫 *كرت إنترنت*

🔐 *رمز الكرت*
\`${code}\`

📦 *الباقة:* *${revealedCard.packageName}*
📅 *${saleDate}*  |  🕐 *${saleTime}*

✨ _${dailyReminder}_

💙 *شكرًا لاختياركم شبكة تواصل*`;

      localStorage.setItem(
        newStorageKey,
        '1'
      );

      localStorage.setItem(
        oldStorageKey,
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

      try {
        localStorage.removeItem(
          newStorageKey
        );

        localStorage.removeItem(
          oldStorageKey
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

  async function sendNoteToAdmin() {
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

  /*
   * تجميع الكروت الموجودة عند الموزع حسب الباقة.
   *
   * مهم:
   * لا نعرض code هنا.
   * هذه الكروت ما زالت with_distributor.
   * الكود لا يظهر إلا بعد نجاح البيع.
   */
  const byPackage = {};

  myCards.forEach((c) => {
    const key =
      c.packages?.name ||
      'غير محدد';

    if (!byPackage[key]) {
      byPackage[key] = {
        count: 0,
        packageId: c.package_id,
        price: c.packages?.price || 0,
      };
    }

    byPackage[key].count += 1;
  });

  const packageEntries =
    Object.entries(byPackage);

  const totalInventory =
    myCards.length;

  return (
    <div className="app">
      <Sidebar
        role="distributor"
        active="/distributor"
        name={profile.full_name}
      />

      <div className="main">
        {/* ================= HEADER ================= */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                color: '#7C3AED',
                fontSize: 12,
                fontWeight: '900',
                marginBottom: 5,
              }}
            >
              لوحة الموزع
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 25,
                fontWeight: '900',
                color: '#1E293B',
              }}
            >
              مرحبًا، {profile.full_name} 👋
            </h1>

            <div
              style={{
                marginTop: 6,
                color: '#64748B',
                fontSize: 13,
              }}
            >
              كل ما تحتاجه لإدارة الكروت والمبيعات والحساب في مكان واحد.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: isOnline
                ? '#ECFDF5'
                : '#FEF2F2',
              color: isOnline
                ? '#059669'
                : '#DC2626',
              padding: '8px 13px',
              borderRadius: 30,
              fontSize: 11.5,
              fontWeight: '900',
              border: `1px solid ${
                isOnline
                  ? '#A7F3D0'
                  : '#FECACA'
              }`,
              boxShadow:
                '0 4px 12px rgba(15,23,42,0.05)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isOnline
                  ? '#10B981'
                  : '#EF4444',
                display: 'inline-block',
              }}
            />

            {isOnline
              ? 'متصل ونشط'
              : 'غير متصل'}
          </div>
        </div>

        {/* ================= ADS ================= */}

        <AdSlotBar />

        <WeeklyWinnerPanel />

        {/* ================= PERSONAL CARD ================= */}

        {profile.personal_card && (
          <div
            style={{
              background:
                'linear-gradient(135deg, #4C1D95 0%, #7C3AED 48%, #DB2777 100%)',
              borderRadius: 22,
              padding: '20px 22px',
              color: '#fff',
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 15,
              boxShadow:
                '0 14px 35px rgba(91,33,182,0.22)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: 150,
                height: 150,
                borderRadius: '50%',
                background:
                  'rgba(255,255,255,0.08)',
                left: -50,
                bottom: -80,
              }}
            />

            <div
              style={{
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  color: '#E9D5FF',
                  fontWeight: '800',
                  marginBottom: 5,
                }}
              >
                ⭐ كرتك الشخصي الثابت
              </div>

              <div
                className="mono"
                style={{
                  fontSize: 25,
                  fontWeight: '900',
                  letterSpacing: 1.5,
                }}
              >
                {profile.personal_card}
              </div>

              <div
                style={{
                  fontSize: 10.5,
                  color: '#F3E8FF',
                  marginTop: 5,
                }}
              >
                كرت شخصي مميز خاص بحسابك
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                copyPersonalCode(
                  profile.personal_card
                )
              }
              style={{
                position: 'relative',
                zIndex: 1,
                background:
                  'rgba(255,255,255,0.18)',
                border:
                  '1px solid rgba(255,255,255,0.38)',
                color: '#fff',
                padding: '11px 17px',
                borderRadius: 13,
                fontWeight: '900',
                fontSize: 12.5,
                cursor: 'pointer',
                backdropFilter:
                  'blur(8px)',
              }}
            >
              {personalCopied
                ? '✓ تم النسخ'
                : '📋 نسخ الكرت الشخصي'}
            </button>
          </div>
        )}

        {/* ================= FINANCIAL SUMMARY ================= */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2,minmax(0,1fr))',
            gap: 13,
            marginBottom: 14,
          }}
        >
          <div
            className="balance-card"
            style={{
              marginBottom: 0,
              minHeight: 158,
              borderRadius: 22,
            }}
          >
            <div className="lbl">
              💰 رصيدك الحالي
            </div>

            <div className="amt">
              {formatNum(profile.balance)}{' '}
              <span>ريال</span>
            </div>

            <div className="foot">
              <div
                style={{
                  fontSize: 11.5,
                  color: '#E3D6FF',
                }}
              >
                المخزون عندك:{' '}
                {totalInventory} كرت
              </div>

              <Link
                href="/distributor/request"
                style={{
                  textDecoration: 'none',
                }}
              >
                <button className="req-btn">
                  طلب كروت
                </button>
              </Link>
            </div>
          </div>

          <div
            style={{
              background:
                netDebt > 0
                  ? 'linear-gradient(135deg, #991B1B 0%, #DC2626 100%)'
                  : 'linear-gradient(135deg, #065F46 0%, #059669 100%)',
              borderRadius: 22,
              padding: 20,
              color: '#fff',
              minHeight: 158,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow:
                '0 12px 28px rgba(0,0,0,0.10)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11.5,
                  color: '#F8FAFC',
                  fontWeight: '800',
                  marginBottom: 7,
                }}
              >
                💳 المبلغ المستحق للمدير
              </div>

              <div
                className="mono"
                style={{
                  fontSize: 27,
                  fontWeight: '900',
                }}
              >
                {formatNum(netDebt)}{' '}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  ريال
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: 11,
                color: '#fff',
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

        {/* ================= QUICK STATS ================= */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2,minmax(0,1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 18,
              padding: '16px 18px',
              boxShadow:
                '0 5px 18px rgba(15,23,42,0.05)',
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                color: '#64748B',
                fontWeight: '800',
                marginBottom: 6,
              }}
            >
              📦 كروت موزعة عندك
            </div>

            <div
              style={{
                fontSize: 27,
                fontWeight: '900',
                color: '#5B21B6',
              }}
            >
              {formatNum(totalInventory)}
            </div>

            <div
              style={{
                marginTop: 3,
                fontSize: 10.5,
                color: '#94A3B8',
              }}
            >
              متاحة للبيع
            </div>
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 18,
              padding: '16px 18px',
              boxShadow:
                '0 5px 18px rgba(15,23,42,0.05)',
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                color: '#64748B',
                fontWeight: '800',
                marginBottom: 6,
              }}
            >
              🎫 مبيعات اليوم
            </div>

            <div
              style={{
                fontSize: 27,
                fontWeight: '900',
                color: '#059669',
              }}
            >
              {formatNum(soldToday)}
            </div>

            <div
              style={{
                marginTop: 3,
                fontSize: 10.5,
                color: '#94A3B8',
              }}
            >
              كروت تم بيعها اليوم
            </div>
          </div>
        </div>

        {/* ================= INVENTORY ================= */}

        <div
          className="panel"
          style={{
            borderRadius: 22,
            overflow: 'hidden',
            border:
              '1px solid #E5E7EB',
          }}
        >
          <div
            className="panel-head"
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#F3F0FB',
                    fontSize: 17,
                  }}
                >
                  📦
                </span>

                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  مخزون الكروت الموزعة عندك
                </h3>
              </div>

              <span className="muted">
                الكروت هنا مخزون فقط، ولن يظهر رقم أي كرت إلا بعد نجاح البيع.
              </span>
            </div>

            <button
              type="button"
              onClick={() => load(true)}
              disabled={isRefreshing}
              style={{
                background: '#F3F0FB',
                border:
                  '1px solid #DDD3F5',
                color: '#5B21B6',
                padding: '8px 13px',
                borderRadius: 11,
                fontSize: 11.5,
                fontWeight: '900',
                cursor: isRefreshing
                  ? 'not-allowed'
                  : 'pointer',
                opacity: isRefreshing
                  ? 0.7
                  : 1,
              }}
            >
              {isRefreshing
                ? '⏳ جاري التحديث...'
                : '🔄 تحديث المخزون'}
            </button>
          </div>

          {revealError && (
            <div
              style={{
                color: '#B91C1C',
                background: '#FEF2F2',
                border:
                  '1px solid #FECACA',
                padding: 11,
                borderRadius: 12,
                marginBottom: 13,
                fontSize: 12.5,
                fontWeight: '700',
              }}
            >
              {revealError}
            </div>
          )}

          {packageEntries.length === 0 ? (
            <div
              style={{
                padding: '28px 10px',
                textAlign: 'center',
                color: 'var(--ink-soft)',
                fontSize: 13,
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 8,
                }}
              >
                📦
              </div>

              لا توجد كروت موزعة عندك حاليًا.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(190px,1fr))',
                gap: 12,
              }}
            >
              {packageEntries.map(
                ([name, info]) => (
                  <div
                    key={name}
                    style={{
                      background:
                        'linear-gradient(180deg,#FFFFFF 0%,#FAF8FF 100%)',
                      border:
                        '1px solid #E7E0F7',
                      borderRadius: 18,
                      padding: 16,
                      boxShadow:
                        '0 5px 16px rgba(91,33,182,0.05)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: '900',
                            color: '#312E81',
                          }}
                        >
                          {name}
                        </div>

                        <div
                          style={{
                            fontSize: 10.5,
                            color: '#64748B',
                            marginTop: 4,
                          }}
                        >
                          مخزون موزع
                        </div>
                      </div>

                      <div
                        style={{
                          minWidth: 46,
                          height: 46,
                          borderRadius: 14,
                          background: '#EDE9FE',
                          color: '#6D28D9',
                          display: 'flex',
                          flexDirection:
                            'column',
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 17,
                            lineHeight: 1,
                          }}
                        >
                          {info.count}
                        </strong>

                        <span
                          style={{
                            fontSize: 8.5,
                            marginTop: 3,
                          }}
                        >
                          كرت
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 13,
                        paddingTop: 11,
                        borderTop:
                          '1px dashed #DDD6FE',
                        fontSize: 11,
                        color: '#64748B',
                      }}
                    >
                      السعر:{' '}
                      <strong
                        style={{
                          color: '#334155',
                        }}
                      >
                        {formatNum(info.price)} ريال
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        askReveal(
                          info.packageId,
                          name
                        )
                      }
                      style={{
                        marginTop: 13,
                        width: '100%',
                        borderRadius: 12,
                        fontWeight: '900',
                      }}
                    >
                      بيع كرت
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* ================= RECENT SALES ================= */}

        <div
          className="panel"
          style={{
            marginTop: 20,
            borderRadius: 22,
          }}
        >
          <div
            className="panel-head"
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    background: '#ECFDF5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  🎫
                </span>

                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  سجل مبيعات اليوم
                </h3>
              </div>

              <span className="muted">
                الكروت التي تم بيعها فعلًا اليوم فقط
              </span>
            </div>

            <div
              style={{
                background: '#ECFDF5',
                color: '#047857',
                padding: '6px 10px',
                borderRadius: 10,
                fontSize: 10.5,
                fontWeight: '900',
              }}
            >
              {soldToday} مبيعات
            </div>
          </div>

          {recentSales.length === 0 ? (
            <div
              style={{
                color: 'var(--ink-soft)',
                fontSize: 13,
                padding: '18px 0 8px',
                textAlign: 'center',
              }}
            >
              لم تقم ببيع أي كرت حتى الآن اليوم.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                marginTop: 10,
              }}
            >
              {recentSales.map(
                (sale) => (
                  <div
                    key={sale.id}
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      alignItems: 'center',
                      gap: 12,
                      background:
                        '#F8FAFC',
                      padding:
                        '12px 14px',
                      borderRadius: 14,
                      border:
                        '1px solid #E2E8F0',
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: '900',
                          color: '#1E293B',
                        }}
                      >
                        {sale.packages?.name ||
                          'باقة'}
                      </div>

                      {sale.customer_name && (
                        <div
                          style={{
                            fontSize: 10.5,
                            color: '#64748B',
                            marginTop: 3,
                          }}
                        >
                          👤 الزبون:{' '}
                          {sale.customer_name}
                        </div>
                      )}

                      <div
                        style={{
                          display: 'inline-block',
                          marginTop: 5,
                          background:
                            '#EDE9FE',
                          color:
                            '#5B21B6',
                          padding:
                            '4px 7px',
                          borderRadius: 7,
                          fontSize: 11,
                          fontWeight: '900',
                          letterSpacing:
                            0.5,
                        }}
                      >
                        {sale.code}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: 'left',
                        fontSize: 10.5,
                        color: '#94A3B8',
                        whiteSpace:
                          'nowrap',
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

        {/* ================= NOTES ================= */}

        <div
          className="panel"
          style={{
            marginTop: 20,
            borderRadius: 22,
          }}
        >
          <div
            className="panel-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                background: '#FFF7ED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              💬
            </span>

            <div>
              <h3
                style={{
                  margin: 0,
                }}
              >
                إرسال ملاحظة أو طلب للمدير
              </h3>

              <span className="muted">
                ستصل الرسالة إلى المدير مباشرة
              </span>
            </div>
          </div>

          <div>
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
                padding: 13,
                borderRadius: 13,
                border:
                  '1.5px solid var(--line)',
                marginBottom: 10,
                fontSize: 13.5,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {noteMessage && (
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: '800',
                  marginBottom: 10,
                  color:
                    noteMessage.startsWith(
                      '✓'
                    )
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
              type="button"
              onClick={
                sendNoteToAdmin
              }
              disabled={
                noteBusy ||
                !noteContent.trim()
              }
              className="btn-primary"
              style={{
                width: 'auto',
                minWidth: 145,
                padding:
                  '11px 20px',
                borderRadius: 12,
              }}
            >
              {noteBusy
                ? 'جاري الإرسال...'
                : 'إرسال للمدير'}
            </button>
          </div>
        </div>
      </div>

      {/* ================= SALE CONFIRMATION ================= */}

      {pendingPackage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(15,23,42,0.68)',
            backdropFilter:
              'blur(5px)',
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
              maxWidth: 370,
              width: '100%',
              textAlign: 'center',
              boxShadow:
                '0 25px 80px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background:
                  'linear-gradient(120deg,#5B21B6,#7C3AED,#DB2777)',
                padding:
                  '25px 20px 22px',
                color: '#fff',
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  color: '#E9D5FF',
                  fontWeight: '800',
                  marginBottom: 6,
                }}
              >
                تأكيد بيع كرت
              </div>

              <div
                style={{
                  fontSize: 25,
                  fontWeight: '900',
                }}
              >
                {pendingPackage.name}
              </div>

              <div
                style={{
                  marginTop: 7,
                  fontSize: 10.5,
                  color: '#F3E8FF',
                }}
              >
                سيتم أخذ كرت واحد من مخزونك
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
                  background:
                    '#F8FAFC',
                  border:
                    '1px solid #E2E8F0',
                  borderRadius: 13,
                  padding: 11,
                  marginBottom: 15,
                  fontSize: 11.5,
                  color: '#64748B',
                  textAlign: 'right',
                }}
              >
                🔐 رقم الكرت لن يظهر الآن.
                <br />
                سيظهر لك فقط بعد نجاح عملية البيع.
              </div>

              <div
                style={{
                  fontSize: 12.5,
                  color:
                    'var(--ink-soft)',
                  marginBottom: 15,
                  textAlign: 'right',
                }}
              >
                <label
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontWeight: '800',
                    color: '#374151',
                  }}
                >
                  اسم الزبون
                  <span
                    style={{
                      fontWeight: '500',
                      color: '#94A3B8',
                    }}
                  >
                    {' '}
                    (اختياري للسحب الأسبوعي)
                  </span>
                </label>

                <input
                  type="text"
                  value={customerName}
                  onChange={(e) =>
                    setCustomerName(
                      e.target.value
                    )
                  }
                  placeholder="مثال: أحمد محمد"
                  style={{
                    width: '100%',
                    padding:
                      '11px 12px',
                    borderRadius: 11,
                    border:
                      '1.5px solid var(--line)',
                    fontSize: 13,
                    boxSizing:
                      'border-box',
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
                  type="button"
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
                      revealBusy
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  إلغاء
                </button>

                <button
                  type="button"
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
                      'linear-gradient(120deg,#7C3AED,#DB2777)',
                    color: '#fff',
                    fontWeight:
                      '900',
                    cursor:
                      revealBusy
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      revealBusy
                        ? 0.75
                        : 1,
                  }}
                >
                  {revealBusy
                    ? 'جاري تأكيد البيع...'
                    : 'تأكيد البيع'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SOLD CARD ================= */}

      {revealedCard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(15,23,42,0.68)',
            backdropFilter:
              'blur(5px)',
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
              borderRadius: 25,
              maxWidth: 390,
              width: '100%',
              textAlign: 'center',
              boxShadow:
                '0 25px 80px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background:
                  'linear-gradient(120deg,#5B21B6,#7C3AED,#DB2777)',
                padding:
                  '20px 20px',
                color: '#fff',
                position:
                  'relative',
              }}
            >
              <button
                type="button"
                onClick={
                  closeModal
                }
                style={{
                  position:
                    'absolute',
                  top: 12,
                  left: 12,
                  width: 31,
                  height: 31,
                  borderRadius:
                    10,
                  border: 'none',
                  background:
                    'rgba(255,255,255,0.22)',
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
                    '#E9D5FF',
                  fontWeight:
                    '800',
                }}
              >
                {revealedCard.packageName}
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight:
                    '900',
                  marginTop: 4,
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
                style={{
                  background:
                    '#F8FAFC',
                  border:
                    '1px solid #E2E8F0',
                  borderRadius: 16,
                  padding:
                    '15px 10px',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    color: '#64748B',
                    fontWeight: '800',
                    marginBottom: 7,
                  }}
                >
                  🔐 كود الكرت المباع
                </div>

                <div
                  className="mono"
                  style={{
                    fontSize: 29,
                    fontWeight:
                      '900',
                    direction:
                      'ltr',
                    color:
                      '#3A1D66',
                    letterSpacing:
                      1.5,
                  }}
                >
                  {revealedCard.code}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <button
                  type="button"
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
                      '900',
                    cursor:
                      'pointer',
                  }}
                >
                  {copied
                    ? '✓ تم النسخ'
                    : '📋 نسخ الكود'}
                </button>

                <button
                  type="button"
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
                      '900',
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
                type="button"
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
                    '900',
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
