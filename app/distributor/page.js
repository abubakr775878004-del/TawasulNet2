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
    <div className="app min-h-screen bg-gray-50 text-right antialiased selection:bg-purple-100 selection:text-purple-900" dir="rtl">
      <Sidebar
        role="distributor"
        active="/distributor"
        name={profile.full_name}
      />

      <div className="main max-w-md mx-auto px-3.5 py-4 space-y-3.5 pb-12">
        {/* الترويسة العليا وتنبيه حالة الاتصال - محسّنة للهواتف */}
        <div className="flex items-center justify-between bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="min-w-0 pr-1">
            <h1 className="text-base sm:text-lg font-bold text-gray-800 truncate">
              مرحبًا، {profile.full_name} 👋
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
              إليك ملخص حسابك اليوم
            </p>
          </div>

          <div className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold border shrink-0 ${
            isOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_6px_#10B981]' : 'bg-red-500'}`}></span>
            {isOnline ? 'نشط' : 'خامل'}
          </div>
        </div>

        <AdSlotBar />

        {/* لوحة الفائز الأسبوعي الموحدة */}
        <WeeklyWinnerPanel />

        {/* تنبيه حساب العهدة والديون - محسّنة للموبيل */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
          Number(profile?.debt_balance || 0) > 0 
            ? 'bg-red-50/80 border-red-200 text-red-900' 
            : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] sm:text-xs font-bold mb-0.5">
                {Number(profile?.debt_balance || 0) > 0 ? 'المبلغ المطلوب سداده (عهدة):' : 'حساب العهدة والديون:'}
              </div>
              <div className={`text-xl sm:text-2xl font-black ${Number(profile?.debt_balance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {Number(profile?.debt_balance || 0).toLocaleString('en-US')} <span className="text-xs font-semibold">ريال</span>
              </div>
            </div>
            {Number(profile?.debt_balance || 0) > 0 && (
              <span className="text-[10px] sm:text-[11px] bg-red-500 text-white px-2.5 py-1 rounded-lg font-bold shrink-0">
                مبالغ معلقة
              </span>
            )}
          </div>
        </div>

        {/* الكرت الشخصي المتميز - تصميم متجاوب للموبيل */}
        {profile.personal_card && (
          <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-pink-600 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] sm:text-xs text-purple-200 font-bold mb-1">
                ⭐ كرتك الشخصي (ثابت ومميز)
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black tracking-widest dir-ltr text-right sm:text-left">
                {profile.personal_card}
              </div>
            </div>

            <button
              onClick={() => copyPersonalCode(profile.personal_card)}
              className="w-full sm:w-auto bg-white/20 border border-white/30 hover:bg-white/30 active:scale-[0.98] text-white px-4 py-2.5 rounded-xl font-bold text-xs transition"
            >
              {personalCopied ? '✓ تم النسخ' : '📋 نسخ الكرت الشخصي'}
            </button>
          </div>
        )}

        {/* البطاقة الرئيسية - الرصيد وطلب الكروت */}
        <div className="bg-[#1e293b] text-white rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="text-xs text-slate-300 mb-1">رصيدك الحالي</div>
          <div className="text-3xl sm:text-4xl font-bold mb-5 text-sky-400 tracking-tight">
            {Number(profile.balance).toLocaleString('en-US')} <span className="text-base font-normal text-white">ريال</span>
          </div>

          <div className="text-xs text-slate-300 mb-3 flex items-center justify-between">
            <span>كروت لديك الآن:</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-700">{myCards.length} كرت</span>
          </div>

          <Link href="/distributor/request" className="block w-full">
            <button className="w-full bg-[#059669] hover:bg-[#047857] active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl transition duration-200 text-sm shadow-sm">
              طلب كروت جديد
            </button>
          </Link>
        </div>

        {/* شبكة البطاقات الإحصائية (المواصفات للموبايل 2x2 ثم 1x1) */}
        <div className="grid grid-cols-2 gap-3">
          {/* بطاقة كروت متاحة عندي */}
          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
            <span className="text-gray-500 text-[11px] sm:text-xs mb-1 font-medium">كروت متاحة عندي</span>
            <span className="text-2xl sm:text-3xl font-bold text-gray-800">{myCards.length}</span>
          </div>

          {/* بطاقة مبيعات اليوم */}
          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
            <span className="text-gray-500 text-[11px] sm:text-xs mb-1 font-medium">مبيعات اليوم</span>
            <span className="text-2xl sm:text-3xl font-bold text-gray-800">{soldToday}</span>
          </div>
        </div>

        {/* بطاقة القيمة الإجمالية لكروتك */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
          <span className="text-gray-500 text-[11px] sm:text-xs mb-1 font-medium">القيمة الإجمالية لكروتك</span>
          <span className="text-xl sm:text-2xl font-bold text-[#059669]">
            {totalValue.toLocaleString('en-US')} <span className="text-xs font-normal">ريال</span>
          </span>
        </div>

        {/* قسم الباقات المتاحة */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-center mb-1">
            <h2 className="text-base font-bold text-gray-800">باقاتي المتاحة</h2>
            <p className="text-xs text-gray-400 mt-0.5">اضغط "إظهار كرت" عند وجود زبون</p>
          </div>

          {/* زر تحديث القائمة */}
          <div className="flex justify-center my-3">
            <button
              onClick={load}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-600 text-xs px-3.5 py-2 rounded-xl border border-gray-200 transition font-medium"
            >
              <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isRefreshing ? 'جاري التحديث...' : 'تحديث القائمة'}
            </button>
          </div>

          {revealError && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl mb-3 border border-red-100 text-center font-medium">
              {revealError}
            </div>
          )}

          {Object.keys(byPackage).length === 0 && (
            <div className="text-gray-400 text-xs text-center py-6">
              لا توجد كروت لديك حاليًا
            </div>
          )}

          {/* عرض بطاقات الباقات المتاحة */}
          <div className="space-y-3">
            {Object.entries(byPackage).map(([name, info]) => (
              <div key={name} className="bg-gray-50/80 rounded-xl p-3.5 text-center border border-gray-100">
                <div className="font-bold text-gray-800 text-base mb-1">{name}</div>
                <div className="text-xs text-[#059669] font-bold mb-0.5">{info.count} كرت لديك</div>
                <div className="text-[11px] text-gray-500 mb-3">
                  القيمة: {(info.count * info.price).toLocaleString('en-US')} ريال
                </div>

                <button
                  onClick={() => askReveal(info.packageId, name)}
                  className="w-full bg-[#059669] hover:bg-[#047857] active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm"
                >
                  إظهار كرت
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* سجل مبيعات اليوم الأخيرة */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-gray-800">سجل مبيعات اليوم الأخيرة</h3>
            <span className="text-xs text-gray-400 block mt-0.5">آخر الكروت التي قمت ببيعها اليوم</span>
          </div>

          {recentSales.length === 0 ? (
            <div className="text-gray-400 text-xs py-4 text-center">
              لم تقم ببيع أي كرت حتى الآن اليوم.
            </div>
          ) : (
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center bg-gray-50/80 p-3 rounded-xl border border-gray-100 gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-800 truncate">
                      {sale.packages?.name || 'باقة'} {sale.customer_name ? `(${sale.customer_name})` : ''}
                    </div>
                    <div className="font-mono text-xs text-gray-500 tracking-wide mt-0.5 dir-ltr text-right">
                      {sale.code}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-xs font-bold text-[#059669]">
                      {sale.packages?.price || 0} ريال
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {new Date(sale.sold_at).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* نموذج إرسال ملاحظة للمدير */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-2.5">
            إرسال ملاحظة أو طلب للمدير
          </h3>

          <form onSubmit={sendNoteToAdmin}>
            <textarea
              rows={3}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              disabled={noteBusy}
              placeholder="اكتب رسالتك أو طلبك هنا ليظهر لدى المدير مباشرة..."
              className="w-full p-3 rounded-xl border border-gray-200 text-xs mb-3 focus:outline-none focus:border-purple-500 transition resize-y disabled:opacity-70 bg-gray-50/50"
            />

            {noteMessage && (
              <div className={`text-xs font-bold mb-3 ${
                noteMessage.startsWith('✓') ? 'text-emerald-600' : noteMessage.startsWith('⚠️') ? 'text-amber-600' : 'text-red-600'
              }`}>
                {noteMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={noteBusy || !noteContent.trim()}
              className="w-full sm:w-auto bg-[#059669] hover:bg-[#047857] active:scale-[0.98] text-white font-bold py-2.5 px-6 rounded-xl text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {noteBusy ? 'جاري الإرسال...' : 'إرسال للمدير'}
            </button>
          </form>
        </div>
      </div>

      {/* مودال طلب تأكيد إظهار الكرت وتدوين اسم الزبون - متوافق كلياً مع الجوال */}
      {pendingPackage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 dir-rtl">
          <div className="bg-white rounded-3xl max-w-xs w-full text-center shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-pink-600 p-5 text-white">
              <div className="text-xs text-purple-200 font-bold mb-1">
                إظهار كرت من باقة
              </div>
              <div className="text-xl sm:text-2xl font-black">
                {pendingPackage.name}
              </div>
            </div>

            <div className="p-5">
              <div className="text-right mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  اسم الزبون (اختياري للسحب الأسبوعي):
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد محمد (لإدخاله في السحب)"
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-purple-500 bg-gray-50/50"
                />
                <span className="text-[11px] text-purple-600 font-bold block mt-1.5 leading-relaxed">
                  💡 كتابة الاسم تؤهل الزبون لدخول السحب الأسبوعي تلقائياً!
                </span>
              </div>

              <div className="text-xs text-gray-500 mb-4">
                سيتم تسليم كرت واحد وتأكيده كمباع
              </div>

              <div className="flex gap-2">
                <button
                  onClick={cancelReveal}
                  disabled={revealBusy}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-xs hover:bg-gray-50 active:bg-gray-100 transition"
                >
                  إلغاء
                </button>

                <button
                  onClick={confirmReveal}
                  disabled={revealBusy}
                  className="flex-1 py-2.5 rounded-xl border-none bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs hover:opacity-90 active:scale-[0.98] transition shadow-sm"
                >
                  {revealBusy ? 'جاري التأكيد...' : 'تأكيد البيع'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال عرض الكرت المباع ونسخه أو مشاركته - متوافق مع الموبايل */}
      {revealedCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 dir-rtl">
          <div className="bg-gradient-to-b from-white via-white to-purple-50 rounded-3xl max-w-xs w-full text-center relative shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-pink-600 p-4 relative">
              <button
                onClick={closeModal}
                className="absolute top-3 left-3 w-7 h-7 rounded-lg border-none bg-white/20 text-white text-sm font-black flex items-center justify-center hover:bg-white/30 transition"
                title="إغلاق"
              >
                ✕
              </button>

              <div className="text-xs text-purple-200 font-bold">
                {revealedCard.packageName}
              </div>

              <div className="text-xs text-white font-black mt-0.5">
                ✓ تم البيع بنجاح
              </div>
            </div>

            <div className="p-5">
              <div className="font-mono text-2xl font-black my-3 tracking-wider text-purple-950 dir-ltr select-all">
                {revealedCard.code}
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={copyCode}
                  className="flex-1 py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-800 font-bold text-xs hover:bg-purple-100 active:bg-purple-200 transition"
                >
                  {copied ? '✓ تم النسخ' : '📋 نسخ الكود'}
                </button>

                <button
                  onClick={shareWhatsapp}
                  className="flex-1 py-2.5 rounded-xl border-none bg-[#25D366] text-white font-bold text-xs hover:bg-emerald-600 active:bg-emerald-700 transition shadow-sm"
                >
                  واتساب
                </button>
              </div>

              <button
                onClick={closeModal}
                className="w-full py-2.5 rounded-xl border-none bg-purple-100 text-purple-800 font-bold text-xs hover:bg-purple-200 transition"
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
