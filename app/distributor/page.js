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

  // ط­ط§ظ„ط© ظ„طھط®ط²ظٹظ† ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„طµط§ظپظٹ ط§ظ„ظ…ط³طھط­ظ‚ ظ„ظ„ظ…ط¯ظٹط±
  const [netDebt, setNetDebt] = useState(0);

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

  // ط¯ط§ظ„ط© طھظ†ط³ظٹظ‚ ط§ظ„ط£ط±ظ‚ط§ظ…
  const formatNum = (num) => {
    const val = Math.round(Number(num) || 0);
    return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  async function load() {
    if (!profile) return;
    setIsRefreshing(true);

    try {
      // 1. ط¬ظ„ط¨ ط§ظ„ظƒط±ظˆطھ ط§ظ„ظ…طھط§ط­ط© ط­ط§ظ„ظٹط§ظ‹ ظ„ط¯ظ‰ ط§ظ„ظ…ظˆط²ط¹
      const { data } = await supabase
        .from('cards')
        .select('*, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'with_distributor');

      setMyCards(data || []);

      const since = new Date();
      since.setHours(0, 0, 0, 0);

      // 2. ط¹ط¯ط¯ ظ…ط¨ظٹط¹ط§طھ ط§ظ„ظٹظˆظ…
      const { count } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString());

      setSoldToday(count || 0);

      // 3. ط¢ط®ط± ظ…ط¨ظٹط¹ط§طھ ط§ظ„ظٹظˆظ…
      const { data: salesData } = await supabase
        .from('cards')
        .select('id, code, sold_at, customer_name, packages(name, price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'sold')
        .gte('sold_at', since.toISOString())
        .order('sold_at', { ascending: false })
        .limit(10);

      setRecentSales(salesData || []);

      // 4. ط¬ظ„ط¨ ط¬ظ…ظٹط¹ ط§ظ„ظƒط±ظˆطھ ط§ظ„ظ…ط¨ط§ط¹ط© ظپط¹ظ„ظٹط§ظ‹ ظ…ظ† ط¬ط¯ظˆظ„ cards ظ„ظ‡ط°ط§ ط§ظ„ظ…ظˆط²ط¹ ظ„ط­ط³ط§ط¨ ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…ط¨ظٹط¹ط§طھ ط§ظ„طµط­ظٹط­
      const { data: soldCardsData, error: soldErr } = await supabase
        .from('cards')
        .select('packages(price)')
        .eq('assigned_to', profile.id)
        .eq('status', 'sold');

      if (soldErr) {
        console.error('Error fetching sold cards:', soldErr);
      }

      const totalSalesRevenue = (soldCardsData || []).reduce((sum, c) => {
        return sum + Number(c.packages?.price || 0);
      }, 0);

      // 5. ط¬ظ„ط¨ ط³ط¯ط§ط¯ط§طھ ظ‡ط°ط§ ط§ظ„ظ…ظˆط²ط¹ ط§ظ„ظ…ط³ط¬ظ„ط© ظپظٹ ط¬ط¯ظˆظ„ payments ط¥ظ† ظˆط¬ط¯طھ
      const { data: paymentsData, error: payErr } = await supabase
        .from('payments')
        .select('amount')
        .eq('distributor_id', profile.id);

      if (payErr) {
        console.error('Error fetching payments:', payErr);
      }

      const totalPaid = (paymentsData || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // ط­ط³ط§ط¨ ط§ظ„ط¯ظٹظ† ط§ظ„ظ…طھط¨ظ‚ظٹ ط§ظ„طµط§ظپظٹ ط¨ط¯ظ‚ط© طھط§ظ…ط© (ط§ظ„ظ…ط¨ظٹط¹ط§طھ ظƒط§ظ…ظ„ط© ظ…ط·ط±ظˆط­ط§ظ‹ ظ…ظ†ظ‡ط§ ط§ظ„ظ…ط³ط¯ط¯)
      const remainingDebt = Math.max(0, Math.round(totalSalesRevenue - totalPaid));
      setNetDebt(remainingDebt);

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
        .select('id, code, package_id, packages(price)')
        .eq('assigned_to', profile.id)
        .eq('package_id', pendingPackage.id)
        .eq('status', 'with_distributor')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) {
        setRevealError('طھط¹ط°ظ‘ط± ط¥ظٹط¬ط§ط¯ ظƒط±طھ ظ…طھط§ط­ ظ…ظ† ظ‡ط°ظ‡ ط§ظ„ط¨ط§ظ‚ط©');
        setPendingPackage(null);
        setRevealBusy(false);
        return;
      }

      const card = data[0];
      const trimmedCustomerName = customerName.trim();
      const cardPrice = Number(card.packages?.price || 0);

      const soldAtTimestamp = new Date().toISOString();

      // 1. طھط­ط¯ظٹط« ط§ظ„ظƒط±طھ ط¥ظ„ظ‰ ظ…ط¨ط§ط¹ ظپظٹ ط¬ط¯ظˆظ„ cards
      const { error: updateError } = await supabase
        .from('cards')
        .update({
          status: 'sold',
          sold_at: soldAtTimestamp,
          customer_name: trimmedCustomerName !== '' ? trimmedCustomerName : null,
        })
        .eq('id', card.id);

      if (updateError) {
        console.error('Update card error:', updateError);
        setRevealError('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط­ظپط¸ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¨ظٹط¹');
        setRevealBusy(false);
        return;
      }

      // 2. ط¥ط¯ط±ط§ط¬ ط§ظ„ط³ط¬ظ„ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ظپظٹ sales_log ظ„ط¶ظ…ط§ظ† طھظˆط§ظپظ‚ ط§ظ„ط£ظ†ط¸ظ…ط© ظƒط§ظ…ظ„ط©
      await supabase.from('sales_log').insert({
        distributor_id: profile.id,
        card_id: card.id,
        package_id: card.package_id,
        price: cardPrice,
        sold_at: soldAtTimestamp
      });

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
      setRevealError('ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹طŒ ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰');
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
      'ط£ظƒط«ط±ظˆط§ ظ…ظ† ط§ظ„طµظ„ط§ط© ط¹ظ„ظ‰ ط§ظ„ظ†ط¨ظٹ (طµظ„ظ‰ ط§ظ„ظ„ظ‡ ط¹ظ„ظٹظ‡ ظˆط³ظ„ظ…)',
      'ط³ط¨ط­ط§ظ† ط§ظ„ظ„ظ‡ ظˆط¨ط­ظ…ط¯ظ‡طŒ ط³ط¨ط­ط§ظ† ط§ظ„ظ„ظ‡ ط§ظ„ط¹ط¸ظٹظ…',
      'ظ„ط§ طھظ†ط³ظژ ط°ظƒط± ط§ظ„ظ„ظ‡طŒ ظپط¨ط°ظƒط±ظ‡ طھط·ظ…ط¦ظ† ط§ظ„ظ‚ظ„ظˆط¨',
      'ط§ظ„ظ„ظ‡ظ… طµظ„ ظˆط³ظ„ظ… ظˆط¨ط§ط±ظƒ ط¹ظ„ظ‰ ظ†ط¨ظٹظ†ط§ ظ…ط­ظ…ط¯',
      'ط§ط³طھط؛ظپط± ط§ظ„ظ„ظ‡ ظˆط£ظƒط«ط± ظ…ظ† ط°ظƒط±ظ‡',
      'ط§ظ„ط­ظ…ط¯ ظ„ظ„ظ‡ ط¹ظ„ظ‰ ظƒظ„ ظ†ط¹ظ…ط©',
      'ط§طھظ‚ظگ ط§ظ„ظ„ظ‡ ظˆط§ط¬ط¹ظ„ ط§ظ„ط®ظٹط± ط·ط±ظٹظ‚ظƒ ط¯ط§ط¦ظ…ظ‹ط§',
      'ط§ظ„ظ„ظ‡ظ… ط§ط¬ط¹ظ„ ظٹظˆظ…ظƒظ… ط®ظٹط±ظ‹ط§ ظˆط¨ط±ظƒط©',
      'ظ…ظ† طھظˆظƒظ„ ط¹ظ„ظ‰ ط§ظ„ظ„ظ‡ ظƒظپط§ظ‡'
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

    const text = `ًںŒگ *ط´ط¨ظƒط© طھظˆط§طµظ„*

ًںژ« *ظƒط±طھ ط§ظ„ط¥ظ†طھط±ظ†طھ*

\`${revealedCard.code}\`

ًں“¦ *ط§ظ„ط¨ط§ظ‚ط©:* ${revealedCard.packageName}
ًں“… ${saleDate} | ًں•گ ${saleTime}

âœ¨ ${dailyReminder}

*ط´ظƒط±ظ‹ط§ ظ„ط§ط®طھظٹط§ط±ظƒظ… ط´ط¨ظƒط© طھظˆط§طµظ„*`;

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
      setNoteMessage('âڑ ï¸ڈ ط§ظƒطھط¨ ط§ظ„ط±ط³ط§ظ„ط© ط£ظˆظ„ظ‹ط§');
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
        setNoteMessage('â‌Œ طھط¹ط°ظ‘ط± ط­ظپط¸ ط§ظ„ط±ط³ط§ظ„ط©طŒ ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰');
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
        setNoteMessage('âœ“ طھظ… ط¥ط±ط³ط§ظ„ ط±ط³ط§ظ„طھظƒ ظ„ظ„ظ…ط¯ظٹط± ط¨ظ†ط¬ط§ط­');
      } else {
        setNoteMessage('âœ“ طھظ… ط­ظپط¸ ط±ط³ط§ظ„طھظƒطŒ ظ„ظƒظ† طھط¹ط°ط± ط¥ط±ط³ط§ظ„ ط¥ط´ط¹ط§ط± طھظٹظ„ظٹط¬ط±ط§ظ…');
      }

      setTimeout(() => {
        setNoteMessage('');
      }, 4000);

    } catch (error) {
      setNoteMessage('â‌Œ ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹طŒ ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰');
    } finally {
      setNoteBusy(false);
    }
  }

  if (loading || !profile) {
    return null;
  }

  const byPackage = {};

  myCards.forEach((c) => {
    const key = c.packages?.name || 'ط؛ظٹط± ظ…ط­ط¯ط¯';

    if (!byPackage[key]) {
      byPackage[key] = {
        count: 0,
        packageId: c.package_id,
        price: c.packages?.price || 0,
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
        <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>
              ظ…ط±ط­ط¨ظ‹ط§طŒ {profile.full_name} ًں‘‹
            </h1>

            <div className="greet">
              ط¥ظ„ظٹظƒ ظ…ظ„ط®طµ ط­ط³ط§ط¨ظƒ ط§ظ„ظٹظˆظ…
            </div>
          </div>

          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 6, 
            background: isOnline ? '#ECFDF5' : '#FEF2F2', 
            color: isOnline ? '#059669' : '#DC2626', 
            padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: '800',
            border: `1px solid ${isOnline ? '#A7F3D0' : '#FECACA'}`
          }}>
            <span style={{ 
              width: 7, height: 7, borderRadius: '50%', 
              background: isOnline ? '#10B981' : '#EF4444',
              display: 'inline-block',
              boxShadow: isOnline ? '0 0 6px #10B981' : 'none'
            }}></span>
            {isOnline ? 'ظ†ط´ط·' : 'ط®ط§ظ…ظ„'}
          </div>
        </div>

        <AdSlotBar />

        {/* ظ…ط³ط§ط¨ظ‚ط© ط§ظ„ط³ط­ط¨ ط§ظ„ط£ط³ط¨ظˆط¹ظٹ */}
        <WeeklyWinnerPanel />

        {profile.personal_card && (
          <div
            style={{
              background:
                'linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #DB2777 100%)',
              borderRadius: 20,
              padding: '20px 24px',
              color: '#fff',
              marginBottom: 20,
              boxShadow:
                '0 10px 25px rgba(124, 58, 237, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
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
                â­گ ظƒط±طھظƒ ط§ظ„ط´ط®طµظٹ (ط«ط§ط¨طھ ظˆظ…ظ…ظٹط²)
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
                copyPersonalCode(profile.personal_card)
              }
              style={{
                background:
                  'rgba(255,255,255,0.2)',
                border:
                  '1px solid rgba(255,255,255,0.4)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: 12,
                fontWeight: '800',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {personalCopied
                ? 'âœ“ طھظ… ط§ظ„ظ†ط³ط®'
                : 'ًں“‹ ظ†ط³ط® ط§ظ„ظƒط±طھ ط§ظ„ط´ط®طµظٹ'}
            </button>
          </div>
        )}

        {/* ط¨ط·ط§ظ‚ط§طھ ط§ظ„ط£ط±طµط¯ط© ظˆط§ظ„ظ…ط³طھط­ظ‚ط§طھ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div className="balance-card" style={{ marginBottom: 0 }}>
            <div className="lbl">
              ط±طµظٹط¯ظƒ ط§ظ„ط­ط§ظ„ظٹ ط¨ظ…ط®ط²ظ†ظƒ
            </div>

            <div className="amt">
              {Number(profile.balance).toLocaleString(
                'en-US'
              )}{' '}
              <span>ط±ظٹط§ظ„</span>
            </div>

            <div className="foot">
              <div
                style={{
                  fontSize: 11.5,
                  color: '#E3D6FF',
                }}
              >
                ظƒط±ظˆطھ ظ„ط¯ظٹظƒ ط§ظ„ط¢ظ†: {myCards.length}
              </div>

              <Link href="/distributor/request">
                <button className="req-btn">
                  ط·ظ„ط¨ ظƒط±ظˆطھ ط¬ط¯ظٹط¯
                </button>
              </Link>
            </div>
          </div>

          {/* ط¨ط·ط§ظ‚ط© ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„طµط§ظپظٹ ط§ظ„ظ…ط³طھط­ظ‚ ظ„ظ„ظ…ط¯ظٹط± */}
          <div style={{
            background: netDebt > 0 ? 'linear-gradient(135deg, #065f46 0%, #059669 100%)' : 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
            borderRadius: 20,
            padding: 20,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
          }}>
            <div>
              <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: '700', marginBottom: 6 }}>
                ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„طµط§ظپظٹ ط§ظ„ظ…ط³طھط­ظ‚ ظ„ظ„ظ…ط¯ظٹط±
              </div>
              <div className="mono" style={{ fontSize: 26, fontWeight: '900', letterSpacing: 0.5 }}>
                {formatNum(netDebt)} <span style={{ fontSize: 13, fontWeight: 'normal' }}>ط±ظٹط§ظ„</span>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: '#f8fafc', marginTop: 10, opacity: 0.9 }}>
              {netDebt > 0 ? 'âڑ ï¸ڈ ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…ط³طھط­ظ‚ط§طھ ط§ظ„ظ…ط§ظ„ظٹط© ط§ظ„ط­ط§ظ„ظٹط©' : 'âœ“ ط§ظ„ط­ط³ط§ط¨ ظ…ط³ط¯ط¯ ط¨ط§ظ„ظƒط§ظ…ظ„'}
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
              ظƒط±ظˆطھ ظ…طھط§ط­ط© ط¹ظ†ط¯ظٹ
            </div>

            <div className="value">
              {myCards.length}
            </div>
          </div>

          <div className="stat">
            <div className="label">
              ظ…ط¨ظٹط¹ط§طھ ط§ظ„ظٹظˆظ…
            </div>

            <div className="value">
              {soldToday}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>ط¨ط§ظ‚ط§طھظٹ ط§ظ„ظ…طھط§ط­ط©</h3>

              <span className="muted">
                ط§ط¶ط؛ط· &quot;ط¥ط¸ظ‡ط§ط± ظƒط±طھ&quot; ط¹ظ†ط¯ ظˆط¬ظˆط¯ ط²ط¨ظˆظ†
              </span>
            </div>

            <button 
              onClick={load} 
              disabled={isRefreshing}
              style={{
                background: '#F3F0FB', border: '1px solid #DDD3F5', color: '#5B21B6',
                padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>ًں”„</span>
              {isRefreshing ? 'ط¬ط§ط±ظٹ ط§ظ„طھط­ط¯ظٹط«...' : 'طھط­ط¯ظٹط« ط§ظ„ظ‚ط§ط¦ظ…ط©'}
            </button>
          </div>

          {revealError && (
            <div className="error-note" style={{ color: '#DC2626', background: '#FEF2F2', padding: '10px', borderRadius: '8px', marginBottom: '10px', fontSize: '13px' }}>
              {revealError}
            </div>
          )}

          {Object.keys(byPackage).length === 0 && (
            <div
              style={{
                color: 'var(--ink-soft)',
                fontSize: 13,
              }}
            >
              ظ„ط§ طھظˆط¬ط¯ ظƒط±ظˆطھ ظ„ط¯ظٹظƒ ط­ط§ظ„ظٹظ‹ط§
            </div>
          )}

          <div className="pkg-grid">
            {Object.entries(byPackage).map(
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
                    <span>ظƒط±طھ ظ„ط¯ظٹظƒ</span>
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
                    ط¥ط¸ظ‡ط§ط± ظƒط±طھ
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-head">
            <h3>ط³ط¬ظ„ ظ…ط¨ظٹط¹ط§طھ ط§ظ„ظٹظˆظ… ط§ظ„ط£ط®ظٹط±ط©</h3>
            <span className="muted">ط¢ط®ط± ط§ظ„ظƒط±ظˆطھ ط§ظ„طھظٹ ظ‚ظ…طھ ط¨ط¨ظٹط¹ظ‡ط§ ط§ظ„ظٹظˆظ…</span>
          </div>

          {recentSales.length === 0 ? (
            <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>
              ظ„ظ… طھظ‚ظ… ط¨ط¨ظٹط¹ ط£ظٹ ظƒط±طھ ط­طھظ‰ ط§ظ„ط¢ظ† ط§ظ„ظٹظˆظ….
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {recentSales.map((sale) => (
                <div key={sale.id} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  background: '#F8FAFC', padding: '10px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' 
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                      {sale.packages?.name || 'ط¨ط§ظ‚ط©'} {sale.customer_name ? `(ط§ظ„ط²ط¨ظˆظ†: ${sale.customer_name})` : ''}
                    </div>
                    <div className="mono" style={{ fontSize: '12px', color: '#64748B', letterSpacing: '0.5px' }}>
                      {sale.code}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                      {new Date(sale.sold_at).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
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
              ط¥ط±ط³ط§ظ„ ظ…ظ„ط§ط­ط¸ط© ط£ظˆ ط·ظ„ط¨ ظ„ظ„ظ…ط¯ظٹط±
            </h3>
          </div>

          <form onSubmit={sendNoteToAdmin}>
            <textarea
              rows={3}
              value={noteContent}
              onChange={(e) =>
                setNoteContent(
                  e.target.value
                )
              }
              disabled={noteBusy}
              placeholder="ط§ظƒطھط¨ ط±ط³ط§ظ„طھظƒ ط£ظˆ ط·ظ„ط¨ظƒ ظ‡ظ†ط§ ظ„ظٹط¸ظ‡ط± ظ„ط¯ظ‰ ط§ظ„ظ…ط¯ظٹط± ظ…ط¨ط§ط´ط±ط©..."
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border:
                  '1.5px solid var(--line)',
                marginBottom: 10,
                fontSize: 13.5,
                resize: 'vertical',
                opacity: noteBusy ? 0.7 : 1,
              }}
            />

            {noteMessage && (
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: '700',
                  marginBottom: 10,
                  color:
                    noteMessage.startsWith('âœ“')
                      ? '#10B981'
                      : noteMessage.startsWith(
                          'âڑ ï¸ڈ'
                        )
                      ? '#D97706'
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
                padding: '10px 20px',
                opacity:
                  noteBusy ||
                  !noteContent.trim()
                    ? 0.65
                    : 1,
                cursor:
                  noteBusy ||
                  !noteContent.trim()
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {noteBusy
                ? 'ط¬ط§ط±ظٹ ط§ظ„ط¥ط±ط³ط§ظ„...'
                : 'ط¥ط±ط³ط§ظ„ ظ„ظ„ظ…ط¯ظٹط±'}
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
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 22,
              padding: 0,
              maxWidth: 340,
              width: '100%',
              textAlign: 'center',
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
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#E3D6FF',
                  fontWeight: '700',
                  marginBottom: 6,
                }}
              >
                ط¥ط¸ظ‡ط§ط± ظƒط±طھ ظ…ظ† ط¨ط§ظ‚ط©
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight: '900',
                  color: '#fff',
                  lineHeight: 1.2,
                }}
              >
                {pendingPackage.name}
              </div>
            </div>

            <div
              style={{
                padding: '20px 24px 24px',
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--ink-soft)',
                  marginBottom: 15,
                  textAlign: 'right'
                }}
              >
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '700', color: '#374151' }}>
                  ط§ط³ظ… ط§ظ„ط²ط¨ظˆظ† (ط§ط®طھظٹط§ط±ظٹ ظ„ظ„ط³ط­ط¨ ط§ظ„ط£ط³ط¨ظˆط¹ظٹ):
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ظ…ط«ط§ظ„: ط£ط­ظ…ط¯ ظ…ط­ظ…ط¯ (ظ„ط¥ط¯ط®ط§ظ„ظ‡ ظپظٹ ط§ظ„ط³ط­ط¨)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid var(--line)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#7C3AED', display: 'block', marginTop: 4, fontWeight: '600' }}>
                  ًں’، ظƒطھط§ط¨ط© ط§ظ„ط§ط³ظ… طھط¤ظ‡ظ„ ط§ظ„ط²ط¨ظˆظ† ظ„ط¯ط®ظˆظ„ ط§ظ„ط³ط­ط¨ ط§ظ„ط£ط³ط¨ظˆط¹ظٹ طھظ„ظ‚ط§ط¦ظٹط§ظ‹!
                </span>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: 'var(--ink-soft)',
                  marginBottom: 20,
                }}
              >
                ط³ظٹطھظ… طھط³ظ„ظٹظ… ظƒط±طھ ظˆط§ط­ط¯ ظˆطھط£ظƒظٹط¯ظ‡ ظƒظ…ط¨ط§ط¹
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                }}
              >
                <button
                  onClick={cancelReveal}
                  disabled={revealBusy}
                  style={{
                    flex: 1,
                    padding: '13px 0',
                    borderRadius: 12,
                    border:
                      '1.5px solid var(--line)',
                    background: '#fff',
                    color:
                      'var(--ink-soft)',
                    fontWeight: '800',
                    fontSize: 13.5,
                    cursor: 'pointer',
                  }}
                >
                  ط¥ظ„ط؛ط§ط،
                </button>

                <button
                  onClick={confirmReveal}
                  disabled={revealBusy}
                  style={{
                    flex: 1,
                    padding: '13px 0',
                    borderRadius: 12,
                    border: 'none',
                    background:
                      'linear-gradient(120deg, #7C3AED, #DB2777)',
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: 13.5,
                    cursor: 'pointer',
                  }}
                >
                  {revealBusy
                    ? 'ط¬ط§ط±ظٹ ط§ظ„طھط£ظƒظٹط¯...'
                    : 'طھط£ظƒظٹط¯ ط§ظ„ط¨ظٹط¹'}
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
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background:
                'linear-gradient(160deg, #ffffff 0%, #ffffff 60%, #F3F0FB 100%)',
              borderRadius: 24,
              padding: 0,
              maxWidth: 380,
              width: '100%',
              textAlign: 'center',
              position: 'relative',
              boxShadow:
                '0 20px 60px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background:
                  'linear-gradient(120deg, #5B21B6, #7C3AED, #DB2777)',
                padding: '18px 20px',
                position: 'relative',
              }}
            >
              <button
                onClick={closeModal}
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  border: 'none',
                  background:
                    'rgba(255,255,255,0.25)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: '900',
                  cursor: 'pointer',
                }}
                title="ط¥ط؛ظ„ط§ظ‚"
              >
                âœ•
              </button>

              <div
                style={{
                  fontSize: 12.5,
                  color: '#E3D6FF',
                  fontWeight: '700',
                }}
              >
                {revealedCard.packageName}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#fff',
                  fontWeight: '900',
                  marginTop: 2,
                }}
              >
                âœ“ طھظ… ط§ظ„ط¨ظٹط¹ ط¨ظ†ط¬ط§ط­
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
                  fontWeight: '900',
                  margin: '4px 0 18px',
                  letterSpacing: 1,
                  direction: 'ltr',
                  color: '#3A1D66',
                }}
              >
                {revealedCard.code}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <button
                  onClick={copyCode}
                  style={{
                    flex: 1,
                    padding: '11px 0',
                    borderRadius: 12,
                    border:
                      '1.5px solid #DDD3F5',
                    background: '#F3F0FB',
                    color: '#5B21B6',
                    fontWeight: '800',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {copied
                    ? 'âœ“ طھظ… ط§ظ„ظ†ط³ط®'
                    : 'ًں“‹ ظ†ط³ط® ط§ظ„ظƒظˆط¯'}
                </button>

                <button
                  onClick={shareWhatsapp}
                  style={{
                    flex: 1,
                    padding: '11px 0',
                    borderRadius: 12,
                    border: 'none',
                    background: '#25D366',
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  ظˆط§طھط³ط§ط¨
                </button>
              </div>

              <button
                onClick={closeModal}
                style={{
                  width: '100%',
                  padding: '13px 0',
                  borderRadius: 14,
                  border: 'none',
                  background: '#F3F0FB',
                  color: '#5B21B6',
                  fontWeight: '800',
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                ط¥ط؛ظ„ط§ظ‚
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
