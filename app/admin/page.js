'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import { AdSlotAdmin } from '../../components/AdSlot';
import WeeklyWinnerPanel from '../../components/WeeklyWinnerPanel';
import { useProfile } from '../../lib/useProfile';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
const { profile, loading } = useProfile('admin');

const [stats, setStats] = useState(null);

const [salesStats, setSalesStats] = useState({
totalRevenue: 0,
soldCardsCount: 0,
});

const [salesByPackage, setSalesByPackage] = useState({});
const [recentSales, setRecentSales] = useState([]);

const formatNum = (num) => {
const val = Math.round(Number(num) || 0);

return val.toLocaleString('en-US', {
  maximumFractionDigits: 0,
});

};

async function loadData() {
try {
/*
* =========================================================
* 1. الإحصائيات الأساسية
* =========================================================
*/

  const [
    { count: totalCards, error: totalCardsError },
    { count: availableCards, error: availableCardsError },
    { count: activeDist, error: activeDistError },
    { count: pendingReq, error: pendingReqError },
  ] = await Promise.all([
    supabase
      .from('cards')
      .select('*', {
        count: 'exact',
        head: true,
      }),

    supabase
      .from('cards')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'available'),

    supabase
      .from('profiles')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('role', 'distributor')
      .eq('status', 'approved'),

    supabase
      .from('card_requests')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'pending'),
  ]);

  if (totalCardsError) {
    console.error(
      'Total cards error:',
      totalCardsError
    );
  }

  if (availableCardsError) {
    console.error(
      'Available cards error:',
      availableCardsError
    );
  }

  if (activeDistError) {
    console.error(
      'Active distributors error:',
      activeDistError
    );
  }

  if (pendingReqError) {
    console.error(
      'Pending requests error:',
      pendingReqError
    );
  }

  setStats({
    totalCards: totalCards ?? 0,
    availableCards: availableCards ?? 0,
    activeDist: activeDist ?? 0,
    pendingReq: pendingReq ?? 0,
  });

  /*
   * =========================================================
   * 2. المبيعات والإيرادات
   * =========================================================
   */

  const {
    data: soldList,
    error: soldError,
  } = await supabase
    .from('cards')
    .select(
      'id, code, sold_at, packages(name, price)'
    )
    .eq('status', 'sold')
    .order('sold_at', {
      ascending: false,
    });

  if (soldError) {
    console.error(
      'Sold cards error:',
      soldError
    );
  }

  let revenue = 0;
  let soldCount = 0;

  const pkgStats = {};

  (soldList || []).forEach((item) => {
    soldCount += 1;

    const price =
      Number(item.packages?.price) || 0;

    revenue += price;

    const pkgName =
      item.packages?.name || 'غير محدد';

    if (!pkgStats[pkgName]) {
      pkgStats[pkgName] = {
        count: 0,
        total: 0,
      };
    }

    pkgStats[pkgName].count += 1;
    pkgStats[pkgName].total += price;
  });

  setSalesStats({
    totalRevenue: revenue,
    soldCardsCount: soldCount,
  });

  setSalesByPackage(pkgStats);

  setRecentSales(
    (soldList || []).slice(0, 5)
  );
} catch (error) {
  console.error(
    'Admin dashboard loading error:',
    error
  );
}

}

useEffect(() => {
if (profile) {
loadData();
}
}, [profile]);

if (loading) {
return null;
}

if (!profile) {
return null;
}

return (
<div className="app">
<Sidebar
role="admin"
active="/admin"
name={profile.full_name}
/>

  <div className="main">
    {/* =====================================================
        رأس الصفحة
    ====================================================== */}

    <div
      className="topbar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 15,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1>نظرة عامة والتقارير</h1>

        <div className="greet">
          مرحبًا بعودتك يا {profile.full_name}
        </div>
      </div>
    </div>

    {/* =====================================================
        الإحصائيات الأساسية
    ====================================================== */}

    <div
      className="grid-stats"
      style={{
        marginBottom: 20,
      }}
    >
      <div className="stat">
        <div className="label">
          إجمالي الكروت
        </div>

        <div className="value">
          {stats?.totalCards ?? '—'}
        </div>
      </div>

      <div className="stat">
        <div className="label">
          كروت متاحة
        </div>

        <div className="value">
          {stats?.availableCards ?? '—'}
        </div>
      </div>

      <div className="stat">
        <div className="label">
          موزعون نشطون
        </div>

        <div className="value">
          {stats?.activeDist ?? '—'}
        </div>
      </div>

      <div className="stat">
        <div className="label">
          طلبات معلّقة
        </div>

        <div className="value">
          {stats?.pendingReq ?? '—'}
        </div>
      </div>
    </div>

    {/* =====================================================
        الإحصائيات المالية
    ====================================================== */}

    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          '1fr 1fr',
        gap: 15,
        marginBottom: 20,
      }}
    >
      <div
        className="panel"
        style={{
          margin: 0,
          padding: 18,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            fontWeight: 700,
          }}
        >
          إجمالي الإيرادات المالية
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#7C3AED',
            marginTop: 5,
          }}
        >
          {salesStats.totalRevenue.toLocaleString()}

          <span
            style={{
              fontSize: 12,
              marginRight: 4,
            }}
          >
            ريال
          </span>
        </div>
      </div>

      <div
        className="panel"
        style={{
          margin: 0,
          padding: 18,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            fontWeight: 700,
          }}
        >
          إجمالي الكروت المباعة
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#10B981',
            marginTop: 5,
          }}
        >
          {salesStats.soldCardsCount}
        </div>
      </div>
    </div>

    {/* =====================================================
        المسابقة الأسبوعية
    ====================================================== */}

    <WeeklyWinnerPanel />

    {/* =====================================================
        تحليل المبيعات حسب الباقات
    ====================================================== */}

    <div
      className="panel"
      style={{
        marginBottom: 20,
      }}
    >
      <div className="panel-head">
        <h3>
          تحليل المبيعات حسب الباقات
        </h3>
      </div>

      {Object.keys(salesByPackage).length ===
      0 ? (
        <div
          style={{
            color: 'var(--ink-soft)',
            fontSize: 13,
            padding: '10px 0',
          }}
        >
          لا توجد مبيعات مسجلة بعد
        </div>
      ) : (
        Object.entries(
          salesByPackage
        ).map(([name, data]) => (
          <div
            key={name}
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom:
                '1px solid #F3F0FB',
              fontSize: 13.5,
              gap: 10,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                color: '#3A1D66',
              }}
            >
              {name}
            </span>

            <span
              style={{
                color: '#5B21B6',
                fontWeight: 700,
                textAlign: 'left',
              }}
            >
              {data.count} كروت —{' '}

              <b
                style={{
                  color: '#10B981',
                }}
              >
                {data.total.toLocaleString()}{' '}
                ريال
              </b>
            </span>
          </div>
        ))
      )}
    </div>

    {/* =====================================================
        آخر المبيعات
    ====================================================== */}

    <div
      className="panel"
      style={{
        marginBottom: 20,
      }}
    >
      <div className="panel-head">
        <h3>
          آخر المبيعات في النظام
        </h3>
      </div>

      {recentSales.length === 0 ? (
        <div
          style={{
            color: 'var(--ink-soft)',
            fontSize: 13,
            padding: '10px 0',
          }}
        >
          لا توجد عمليات بيع حديثة
        </div>
      ) : (
        recentSales.map((c) => (
          <div
            className="timer-row"
            key={c.id}
          >
            <div>
              <div className="tcode mono">
                {c.code}
              </div>

              <div className="tpkg">
                {c.packages?.name ||
                  'غير محدد'}{' '}
                —{' '}
                {Number(
                  c.packages?.price || 0
                ).toLocaleString()}{' '}
                ريال
              </div>
            </div>

            <div
              className="tleft"
              style={{
                fontSize: 11.5,
              }}
            >
              {c.sold_at
                ? new Date(
                    c.sold_at
                  ).toLocaleDateString(
                    'ar-YE'
                  )
                : '—'}
            </div>
          </div>
        ))
      )}
    </div>

    {/* =====================================================
        الإعلان
    ====================================================== */}

    <AdSlotAdmin />
  </div>
</div>

);
}
