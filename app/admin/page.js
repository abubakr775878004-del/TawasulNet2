'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import { AdSlotAdmin } from '../../components/AdSlot';
import { useProfile } from '../../lib/useProfile';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const { profile, loading } = useProfile('admin');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!profile) return;
    async function loadStats() {
      const [{ count: totalCards }, { count: availableCards }, { count: activeDist }, { count: pendingReq }] = await Promise.all([
        supabase.from('cards').select('*', { count: 'exact', head: true }),
        supabase.from('cards').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'distributor').eq('status', 'approved'),
        supabase.from('card_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setStats({ totalCards, availableCards, activeDist, pendingReq });
    }
    loadStats();
  }, [profile]);

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin" name={profile.full_name} />
      <div className="main">
        <div className="topbar">
          <div>
            <h1>نظرة عامة</h1>
            <div className="greet">مرحبًا بعودتك يا {profile.full_name}</div>
          </div>
        </div>

        <div className="grid-stats">
          <div className="stat"><div className="label">إجمالي الكروت</div><div className="value">{stats?.totalCards ?? '—'}</div></div>
          <div className="stat"><div className="label">كروت متاحة</div><div className="value">{stats?.availableCards ?? '—'}</div></div>
          <div className="stat"><div className="label">موزعون نشطون</div><div className="value">{stats?.activeDist ?? '—'}</div></div>
          <div className="stat"><div className="label">طلبات معلّقة</div><div className="value">{stats?.pendingReq ?? '—'}</div></div>
        </div>

        <AdSlotAdmin />
      </div>
    </div>
  );
}
