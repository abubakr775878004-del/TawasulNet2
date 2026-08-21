'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function WeeklyWinnerPanel() {
  const [participants, setParticipants] = useState([]);
  const [selectedWinner, setSelectedWinner] = useState(null);

  useEffect(() => {
    async function fetchParticipants() {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data } = await supabase
        .from('cards')
        .select('customer_name, sold_at, profiles:assigned_to(full_name)')
        .eq('status', 'sold')
        .not('customer_name', 'is', null)
        .gte('sold_at', oneWeekAgo.toISOString())
        .order('sold_at', { ascending: false });

      setParticipants(data || []);
    }
    fetchParticipants();
  }, []);

  const pickRandomWinner = () => {
    if (participants.length === 0) return;
    const randomIndex = Math.floor(Math.random() * participants.length);
    setSelectedWinner(participants[randomIndex]);
  };

  return (
    <div className="panel" style={{ marginTop: 20, background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0' }}>
      <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1E293B' }}>🏆 إدارة مسابقة السحب الأسبوعي</h3>
          <span style={{ fontSize: '12px', color: '#64748B' }}>الزبائن المشاركون في السحب خلال آخر 7 أيام</span>
        </div>
        <button
          onClick={pickRandomWinner}
          style={{
            background: 'linear-gradient(120deg, #7C3AED, #DB2777)',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '10px',
            fontWeight: '800',
            fontSize: '12.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
          }}
        >
          🎲 إجراء سحب عشوائي
        </button>
      </div>

      {selectedWinner && (
        <div style={{
          background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
          border: '1.5px solid #34D399',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '15px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '850', color: '#065F46', marginBottom: '4px' }}>
            🎉 الفائز في السحب الحالي (جاهز لتسليم الجائزة):
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#047857' }}>
            {selectedWinner.customer_name}
          </div>
          <div style={{ fontSize: '12px', color: '#047857', marginTop: '4px' }}>
            الموزع المسؤول عن الزبون: <strong>{selectedWinner.profiles?.full_name || 'غير محدد'}</strong>
          </div>
        </div>
      )}

      <div style={{ fontSize: '13px', fontWeight: '755', color: '#334155', marginBottom: '8px' }}>
        قائمة الزبائن المشاركين ({participants.length}):
      </div>

      {participants.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          {participants.map((p, index) => (
            <div key={index} style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '13px', color: '#1E293B' }}>{p.customer_name}</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>عبر الموزع: {p.profiles?.full_name || 'موزع'}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                {new Date(p.sold_at).toLocaleDateString('ar-YE')}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '15px', textAlign: 'center', color: '#64748B', fontSize: '13px', background: '#F8FAFC', borderRadius: '10px' }}>
          لا يوجد زبائن مسجلين في السحب هذا الأسبوع حتى الآن.
        </div>
      )}
    </div>
  );
}
