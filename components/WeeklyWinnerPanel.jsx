'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendWinnersToTelegram } from '../lib/telegram';

export default function DistributorWeeklyWinner() {
  const [selectedWinner, setSelectedWinner] = useState(null);
  const [isWeekendShowTime, setIsWeekendShowTime] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchWinner() {
      const today = new Date();
      const currentDay = today.getDay(); // 5 = الجمعة، 6 = السبت
      const isWeekend = (currentDay === 5 || currentDay === 6);
      
      setIsWeekendShowTime(isWeekend);

      if (!isWeekend) return;

      // استدعاء الدالة الخاصة بالفائز من Supabase
      const { data, error } = await supabase.rpc('get_weekly_winner');

      if (!error && data) {
        const winnerObj = Array.isArray(data) ? data[0] : data;
        setSelectedWinner(winnerObj);

        // إرسال الإشعار التلقائي للبوت يوم الجمعة حصراً ولمرة واحدة في الأسبوع
        const weekKey = `telegram_notified_week_${today.getFullYear()}_${getWeekNumber(today)}`;
        const hasNotified = localStorage.getItem(weekKey);

        if (!hasNotified) {
          const winnersArray = Array.isArray(data) ? data : [data];
          if (typeof sendWinnersToTelegram === 'function') {
            await sendWinnersToTelegram(winnersArray);
            localStorage.setItem(weekKey, 'true');
          }
        }
      } else {
        setSelectedWinner(null);
      }
    }

    fetchWinner();
  }, []);

  // دالة حساب رقم الأسبوع لضبط التكرار
  function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  // دالة تجربة الإشعار المباشر عبر السكريبت والتليجرام
  const handleTestSend = async () => {
    setSending(true);
    try {
      const winnerData = selectedWinner || {
        customer_name: 'أحمد محسن',
        distributor_name: 'حساب التجربة'
      };

      const winnersArray = [winnerData];

      if (typeof sendWinnersToTelegram === 'function') {
        await sendWinnersToTelegram(winnersArray);
        alert('✅ تم تشغيل سكريبت الإرسال بنجاح إلى التليجرام!');
      } else {
        alert('⚠️ دالة sendWinnersToTelegram غير معرفة في ملف lib/telegram.js');
      }
    } catch (err) {
      alert(`❌ حدث خطأ أثناء تشغيل السكريبت: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px rgba(49, 46, 129, 0.2)',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>🏆 مسابقة السحب الأسبوعي للزبائن</h3>
        <span style={{
          background: isWeekendShowTime ? '#10B981' : '#7C3AED',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '700'
        }}>
          {isWeekendShowTime ? '✨ الفائز معتمد' : '⏳ قيد التنافس'}
        </span>
      </div>

      {isWeekendShowTime ? (
        selectedWinner ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '11px', color: '#34D399', fontWeight: '700', marginBottom: '4px' }}>
              🎉 الفائز في السحب الأسبوعي لهذا الأسبوع:
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#fff' }}>
              {selectedWinner.customer_name || selectedWinner.winner_name || 'أحمد محسن'}
            </div>
            <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '4px' }}>
              عبر الموزع: <strong>{selectedWinner.distributor_name || 'غير محدد'}</strong>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#CBD5E1', padding: '10px' }}>
            لا توجد مبيعات مسجلة للسحب هذا الأسبوع.
          </div>
        )
      ) : (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px dashed rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '12px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#CBD5E1'
        }}>
          🔒 سيظهر اسم الفائز الثابت حصرياً يومي <strong>الجمعة والسبت</strong>. استمر في بيع الكروت لزيادة فرصة زبائنك!
        </div>
      )}

      {/* زر اختبار سكريبت الإشعار */}
      <div style={{ marginTop: '14px', textAlign: 'center' }}>
        <button
          onClick={handleTestSend}
          disabled={sending}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            opacity: sending ? 0.6 : 1
          }}
        >
          {sending ? 'جاري تشغيل السكريبت...' : '🧪 تجربة إرسال الإشعار عبر السكريبت'}
        </button>
      </div>
    </div>
  );
}
