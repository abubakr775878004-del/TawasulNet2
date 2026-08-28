'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function WeeklyWinnerPanel() {
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchCurrentWinner();
  }, []);

  async function fetchCurrentWinner() {
    setLoading(true);
    try {
      // جلب الفائز الأخير المعرف في الجدول مع التعامل السليم مع حالة عدم وجود بيانات
      const { data, error } = await supabase
        .from('weekly_winners')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setWinner(data);
      } else {
        setWinner(null);
      }
    } catch (err) {
      console.error('خطأ في جلب بيانات الفائز:', err);
    } finally {
      setLoading(false);
    }
  }

  // 🤖 دالة إرسال التلجرام عبر السيرفر لضمان الوصول لمتغيرات البيئة المعلنة في Vercel
  const sendTelegramNotification = async (winnersData) => {
    setSending(true);
    try {
      const response = await fetch('/api/telegram/send-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winners: winnersData }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        alert('✅ تم إرسال إشعار السحب إلى التلجرام بنجاح!');
      } else {
        alert(`❌ فشل الإرسال: ${result.error || 'يرجى التحقق من متغيرات التلجرام'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ حدث خطأ أثناء الاتصال بالسيرفر');
    } finally {
      setSending(false);
    }
  };

  const handleTestSingle = () => {
    sendTelegramNotification([
      { customer_name: "أحمد محسن (تجربة فائز)", distributor_name: "حساب التجربن" }
    ]);
  };

  const handleTestTriple = () => {
    sendTelegramNotification([
      { customer_name: "أحمد محسن (المركز الأول)", distributor_name: "حساب التجربن" },
      { customer_name: "محمد علي (المركز الثاني)", distributor_name: "موزع الأمل" },
      { customer_name: "صالح العنسي (المركز الثالث)", distributor_name: "موزع البركة" }
    ]);
  };

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h3>🏆 لوحة إدارة السحب الأسبوعي</h3>
      </div>
      
      {loading ? (
        <div style={{ padding: '10px 0', fontSize: 13, color: '#888' }}>
          جاري جلب بيانات الفائز الحالي...
        </div>
      ) : winner ? (
        <div style={{ fontSize: 13, padding: '10px 0', lineHeight: '1.6' }}>
          🎉 آخر فائز معتمد: <b>{winner.customer_name}</b> <br />
          🏪 الموزع المسجل: <strong>{winner.distributor_name || 'غير محدد'}</strong>
        </div>
      ) : (
        <div style={{ color: '#64748B', fontSize: 13, padding: '10px 0' }}>
          لا يوجد فائز معتمد حالياً في قاعدة البيانات.
        </div>
      )}

      {/* أزرار تجربة إرسال البوت بدون التأثير على البيانات الحقيقية */}
      <div style={{ display: 'flex', gap: 10, marginTop: 15, paddingTop: 12, borderTop: '1px solid #F3F0FB' }}>
        <button 
          disabled={sending}
          onClick={handleTestSingle} 
          style={{ 
            padding: '8px 14px', 
            background: '#F59E0B', 
            color: '#fff', 
            border: 'none', 
            borderRadius: 6, 
            cursor: 'pointer', 
            fontSize: 12, 
            fontWeight: 'bold',
            opacity: sending ? 0.6 : 1 
          }}
        >
          {sending ? 'جاري الإرسال...' : '🧪 تجربة (فائز واحد)'}
        </button>

        <button 
          disabled={sending}
          onClick={handleTestTriple} 
          style={{ 
            padding: '8px 14px', 
            background: '#10B981', 
            color: '#fff', 
            border: 'none', 
            borderRadius: 6, 
            cursor: 'pointer', 
            fontSize: 12, 
            fontWeight: 'bold',
            opacity: sending ? 0.6 : 1 
          }}
        >
          {sending ? 'جاري الإرسال...' : '🧪 تجربة (3 فائزين)'}
        </button>
      </div>
    </div>
  );
}
