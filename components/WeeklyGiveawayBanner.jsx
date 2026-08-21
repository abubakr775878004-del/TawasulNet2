'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function WeeklyGiveawayBanner() {
  const [weeklyWinner, setWeeklyWinner] = useState(null);

  useEffect(() => {
    async function fetchWeeklyWinner() {
      try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: winnersData } = await supabase
          .from('cards')
          .select('customer_name, assigned_to, profiles:assigned_to(full_name), sold_at')
          .eq('status', 'sold')
          .not('customer_name', 'is', null)
          .gte('sold_at', oneWeekAgo.toISOString())
          .order('sold_at', { ascending: false });

        if (winnersData && winnersData.length > 0) {
          const randomIndex = Math.floor(Math.random() * winnersData.length);
          setWeeklyWinner(winnersData[randomIndex]);
        } else {
          setWeeklyWinner(null);
        }
      } catch (err) {
        console.error('Error fetching weekly winner:', err);
      }
    }

    fetchWeeklyWinner();
  }, []);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
      borderRadius: '16px',
      padding: '16px 20px',
      color: '#fff',
      marginBottom: '20px',
      boxShadow: '0 8px 20px rgba(49, 46, 129, 0.25)',
      border: '1px solid #4338CA'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#A5B4FC' }}>
          🏆 مسابقة السحب الأسبوعي للزبائن
        </div>
        <div style={{ fontSize: '10.5px', background: '#4F46E5', color: '#fff', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
          سحب تلقائي
        </div>
      </div>
      {weeklyWinner ? (
        <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
          ✨ الفائز في السحب هذا الأسبوع: <strong style={{ color: '#34D399' }}>{weeklyWinner.customer_name}</strong> 
          <span style={{ fontSize: '12px', color: '#C7D2FE', display: 'block', marginTop: 2 }}>
            (تم شراء الكرت عبر الموزع: {weeklyWinner.profiles?.full_name || 'موزع بالشبكة'})
          </span>
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: '#E0E7FF' }}>
          أدخل أسماء زبائنك عند بيع الكروت لتأهيلهم للسحب الأسبوعي التلقائي وإعطائهم الجوائز!
        </div>
      )}
    </div>
  );
}
