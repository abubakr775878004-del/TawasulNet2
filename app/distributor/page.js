'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import { AdSlotBar } from '../../components/AdSlot';
import { useProfile } from '../../lib/useProfile';
import { supabase } from '../../lib/supabase';

export default function DistributorPage() {
  const { profile, loading } = useProfile('distributor');
  const [myCards, setMyCards] = useState([]);
  const [soldToday, setSoldToday] = useState(0);
  const [revealedCard, setRevealedCard] = useState(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState('');

  async function load() {
    if (!profile) return;
    const { data } = await supabase
      .from('cards')
      .select('*, packages(name)')
      .eq('assigned_to', profile.id)
      .eq('status', 'with_distributor');
    setMyCards(data || []);

    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', profile.id)
      .eq('status', 'sold')
      .gte('sold_at', since.toISOString());
    setSoldToday(count || 0);
  }

  useEffect(() => { load(); }, [profile]);

  async function revealCard(pkgId, pkgName) {
    setRevealError('');
    const { data, error } = await supabase
      .from('cards')
      .select('id, code')
      .eq('assigned_to', profile.id)
      .eq('package_id', pkgId)
      .eq('status', 'with_distributor')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !data || data.length === 0) {
      setRevealError('تعذّر إيجاد كرت متاح من هذه الباقة');
      return;
    }
    setRevealedCard({ id: data[0].id, code: data[0].code, packageName: pkgName });
  }

  async function confirmGiven() {
    if (!revealedCard) return;
    if (!window.confirm('هل أعطيت هذا الكرت للزبون بالفعل؟ سيتم تسجيله كمباع ولا يمكن التراجع.')) return;
    setRevealBusy(true);
    await supabase.rpc('sell_card', { c_id: revealedCard.id });
    setRevealBusy(false);
    setRevealedCard(null);
    load();
  }

  if (loading) return null;

  const byPackage = {};
  myCards.forEach((c) => {
    const key = c.packages?.name || 'غير محدد';
    if (!byPackage[key]) byPackage[key] = { count: 0, packageId: c.package_id };
    byPackage[key].count += 1;
  });

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor" name={profile.full_name} />
      <div className="main">
        <div className="topbar">
          <div><h1>مرحبًا، {profile.full_name} 👋</h1><div className="greet">إليك ملخص حسابك اليوم</div></div>
        </div>

        <AdSlotBar />

        <div className="balance-card">
          <div className="lbl">رصيدك الحالي</div>
          <div className="amt">{Number(profile.balance).toLocaleString('en-US')} <span>ريال</span></div>
          <div className="foot">
            <div style={{ fontSize: 11.5, color: '#E3D6FF' }}>كروت لديك الآن: {myCards.length}</div>
            <Link href="/distributor/request"><button className="req-btn">طلب كروت جديد</button></Link>
          </div>
        </div>

        <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <div className="stat"><div className="label">كروت متاحة عندي</div><div className="value">{myCards.length}</div></div>
          <div className="stat"><div className="label">مبيعات اليوم</div><div className="value">{soldToday}</div></div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>باقاتي المتاحة</h3>
            <span className="muted">اضغط "إظهار كرت" عند وجود زبون</span>
          </div>
          {revealError && <div className="error-note">{revealError}</div>}
          {Object.keys(byPackage).length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>لا توجد كروت لديك حاليًا</div>}
          <div className="pkg-grid">
            {Object.entries(byPackage).map(([name, info]) => (
              <div className="pkg-card" key={name}>
                <div className="pname">{name}</div>
                <div className="pcount">{info.count} <span>كرت لديك</span></div>
                <button
                  className="btn-primary"
                  style={{ marginTop: 14, width: '100%' }}
                  onClick={() => revealCard(info.packageId, name)}
                >
                  إظهار كرت
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {revealedCard && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 22, padding: 28, maxWidth: 360, width: '100%',
            textAlign: 'center', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <button
              onClick={confirmGiven}
              disabled={revealBusy}
              style={{
                position: 'absolute', top: 14, left: 14, width: 34, height: 34, borderRadius: 12,
                border: 'none', background: '#FEE6EA', color: '#F43F5E', fontSize: 18, fontWeight: 900, cursor: 'pointer',
              }}
              title="أعطيت الكرت للزبون — إغلاق"
            >
              ✕
            </button>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 700, marginTop: 10 }}>{revealedCard.packageName}</div>
            <div className="mono" style={{ fontSize: 30, fontWeight: 900, margin: '18px 0', letterSpacing: 1, direction: 'ltr' }}>
              {revealedCard.code}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>اعطِ هذا الكود للزبون، ثم اضغط ✕ لتأكيد البيع</div>
          </div>
        </div>
      )}
    </div>
  );
}
