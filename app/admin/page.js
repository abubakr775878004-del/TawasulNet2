'use client';

import { useEffect, useMemo, useState } from 'react';
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
    todayRevenue: 0,
    todaySoldCount: 0,
  });

  const [salesByPackage, setSalesByPackage] = useState({});
  const [recentSales, setRecentSales] = useState([]);
  const [packageStock, setPackageStock] = useState([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [error, setError] = useState('');

  const formatNum = (num) => {
    const val = Math.round(Number(num) || 0);

    return val.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    });
  };

  const formatDate = (date) => {
    if (!date) return '—';

    try {
      return new Date(date).toLocaleDateString('ar-YE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  async function loadData() {
    try {
      setError('');

      /*
       * =========================================================
       * 1. الإحصائيات الأساسية
       * =========================================================
       */

      const [
        { count: totalCards, error: totalCardsError },
        { count: availableCards, error: availableCardsError },
        { count: distributorCards, error: distributorCardsError },
        { count: soldCards, error: soldCardsError },
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
          .from('cards')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('status', 'with_distributor'),

        supabase
          .from('cards')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('status', 'sold'),

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
        console.error('Total cards error:', totalCardsError);
      }

      if (availableCardsError) {
        console.error('Available cards error:', availableCardsError);
      }

      if (distributorCardsError) {
        console.error(
          'Distributor cards error:',
          distributorCardsError
        );
      }

      if (soldCardsError) {
        console.error('Sold cards error:', soldCardsError);
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
        distributorCards: distributorCards ?? 0,
        soldCards: soldCards ?? 0,
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
          'id, code, sold_at, customer_name, assigned_to, packages(name, price)'
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
      let todayRevenue = 0;
      let todaySoldCount = 0;

      const pkgStats = {};

      const today = new Date();

      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDate = today.getDate();

      (soldList || []).forEach((item) => {
        soldCount += 1;

        const price =
          Number(item.packages?.price) || 0;

        revenue += price;

        const soldDate = item.sold_at
          ? new Date(item.sold_at)
          : null;

        const isToday =
          soldDate &&
          soldDate.getFullYear() === todayYear &&
          soldDate.getMonth() === todayMonth &&
          soldDate.getDate() === todayDate;

        if (isToday) {
          todaySoldCount += 1;
          todayRevenue += price;
        }

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
        todayRevenue,
        todaySoldCount,
      });

      setSalesByPackage(pkgStats);

      setRecentSales(
        (soldList || []).slice(0, 7)
      );

      /*
       * =========================================================
       * 3. المخزون حسب الباقات
       * =========================================================
       */

      const {
        data: packagesList,
        error: packagesError,
      } = await supabase
        .from('packages')
        .select('id, name, price')
        .order('price', {
          ascending: true,
        });

      if (packagesError) {
        console.error(
          'Packages error:',
          packagesError
        );
      }

      const stockRows = [];

      for (const pkg of packagesList || []) {
        const [
          { count: availableCount },
          { count: distributorCount },
          { count: soldCountForPackage },
        ] = await Promise.all([
          supabase
            .from('cards')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq('package_id', pkg.id)
            .eq('status', 'available'),

          supabase
            .from('cards')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq('package_id', pkg.id)
            .eq('status', 'with_distributor'),

          supabase
            .from('cards')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq('package_id', pkg.id)
            .eq('status', 'sold'),
        ]);

        stockRows.push({
          id: pkg.id,
          name: pkg.name,
          price: Number(pkg.price) || 0,
          available: availableCount ?? 0,
          withDistributor: distributorCount ?? 0,
          sold: soldCountForPackage ?? 0,
        });
      }

      setPackageStock(stockRows);

      /*
       * =========================================================
       * 4. إجمالي ديون الموزعين
       * =========================================================
       */

      const {
        data: distributors,
        error: distributorsError,
      } = await supabase
        .from('profiles')
        .select('debt_balance, debt')
        .eq('role', 'distributor')
        .eq('status', 'approved');

      if (distributorsError) {
        console.error(
          'Distributor debts error:',
          distributorsError
        );
      }

      const debtTotal = (distributors || []).reduce(
        (sum, distributor) => {
          const debt =
            Number(
              distributor.debt_balance ??
                distributor.debt ??
                0
            ) || 0;

          return sum + debt;
        },
        0
      );

      setTotalDebt(debtTotal);
    } catch (loadError) {
      console.error(
        'Admin dashboard loading error:',
        loadError
      );

      setError(
        'حدث خطأ أثناء تحميل بيانات لوحة التحكم'
      );
    }
  }

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const stockTotal = useMemo(() => {
    return packageStock.reduce(
      (sum, pkg) => sum + pkg.available,
      0
    );
  }, [packageStock]);

  const lowStockPackages = useMemo(() => {
    return packageStock.filter(
      (pkg) =>
        pkg.available > 0 &&
        pkg.available <= 10
    );
  }, [packageStock]);

  const outOfStockPackages = useMemo(() => {
    return packageStock.filter(
      (pkg) => pkg.available === 0
    );
  }, [packageStock]);

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
          style={{
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: '20px 18px',
              borderRadius: 18,
              background:
                'linear-gradient(135deg, #F5F0FF 0%, #FFFFFF 55%, #EEFDF7 100%)',
              border: '1px solid #E8DDF7',
              boxShadow:
                '0 8px 24px rgba(91, 33, 182, 0.07)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 15,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#7C3AED',
                    marginBottom: 5,
                  }}
                >
                  شبكة تواصل
                </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: 27,
                    fontWeight: 900,
                    color: '#32165A',
                    lineHeight: 1.25,
                  }}
                >
                  لوحة التحكم
                </h1>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#5B4675',
                  }}
                >
                  مرحبًا بعودتك يا{' '}
                  <span
                    style={{
                      color: '#7C3AED',
                      fontWeight: 900,
                    }}
                  >
                    {profile.full_name}
                  </span>
                </div>
              </div>

              {/* =================================================
                  التاريخ
              ================================================== */}

              <div
                style={{
                  minWidth: 190,
                  padding: '12px 15px',
                  borderRadius: 14,
                  background: '#FFFFFF',
                  border: '1px solid #E9DFF7',
                  textAlign: 'center',
                  boxShadow:
                    '0 5px 15px rgba(91, 33, 182, 0.06)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: '#8B7A9F',
                    fontWeight: 800,
                    marginBottom: 5,
                  }}
                >
                  اليوم
                </div>

                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 900,
                    color: '#5B21B6',
                    lineHeight: 1.5,
                  }}
                >
                  {new Date().toLocaleDateString(
                    'ar-YE',
                    {
                      weekday: 'long',
                    }
                  )}
                </div>

                <div
                  style={{
                    marginTop: 2,
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#6B5A7D',
                  }}
                >
                  {new Date().toLocaleDateString(
                    'ar-YE',
                    {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }
                  )}
                </div>
              </div>
            </div>

            {/* =================================================
                الفائزون الأسبوعيون
            ================================================== */}

            <div
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop:
                  '1px solid rgba(124, 58, 237, 0.12)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      'linear-gradient(135deg, #FDE68A, #F59E0B)',
                    fontSize: 18,
                    boxShadow:
                      '0 5px 12px rgba(245, 158, 11, 0.20)',
                  }}
                >
                  🏆
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: '#3A1D66',
                    }}
                  >
                    الفائزون الأسبوعيون
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: '#8B7A9F',
                      marginTop: 2,
                    }}
                  >
                    نتائج المسابقة الأسبوعية
                  </div>
                </div>
              </div>

              <WeeklyWinnerPanel />
            </div>
          </div>
        </div>

        {/* =====================================================
            رسالة الخطأ
        ====================================================== */}

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              borderRadius: 12,
              background: '#FEF2F2',
              color: '#B91C1C',
              fontSize: 13,
              fontWeight: 700,
              border: '1px solid #FECACA',
            }}
          >
            {error}
          </div>
        )}

        {/* =====================================================
            ملخص الكروت
        ====================================================== */}

        <div
          className="grid-stats"
          style={{
            marginBottom: 20,
          }}
        >
          <div
            className="stat"
            style={{
              borderTop: '4px solid #7C3AED',
              background:
                'linear-gradient(180deg, #FFFFFF, #FAF7FF)',
            }}
          >
            <div className="label">
              إجمالي الكروت
            </div>

            <div
              className="value"
              style={{
                color: '#6D28D9',
              }}
            >
              {stats?.totalCards ?? '—'}
            </div>

            <div
              style={{
                marginTop: 5,
                color: 'var(--ink-soft)',
                fontSize: 11,
              }}
            >
              جميع الحالات
            </div>
          </div>

          <div
            className="stat"
            style={{
              borderTop: '4px solid #2563EB',
              background:
                'linear-gradient(180deg, #FFFFFF, #F5F9FF)',
            }}
          >
            <div className="label">
              مخزون المدير
            </div>

            <div
              className="value"
              style={{
                color: '#2563EB',
              }}
            >
              {stats?.availableCards ?? '—'}
            </div>

            <div
              style={{
                marginTop: 5,
                color: 'var(--ink-soft)',
                fontSize: 11,
              }}
            >
              كروت متاحة للبيع
            </div>
          </div>

          <div
            className="stat"
            style={{
              borderTop: '4px solid #F59E0B',
              background:
                'linear-gradient(180deg, #FFFFFF, #FFF9ED)',
            }}
          >
            <div className="label">
              مع الموزعين
            </div>

            <div
              className="value"
              style={{
                color: '#D97706',
              }}
            >
              {stats?.distributorCards ?? '—'}
            </div>

            <div
              style={{
                marginTop: 5,
                color: 'var(--ink-soft)',
                fontSize: 11,
              }}
            >
              كروت موزعة حاليًا
            </div>
          </div>

          <div
            className="stat"
            style={{
              borderTop: '4px solid #10B981',
              background:
                'linear-gradient(180deg, #FFFFFF, #F1FFF9)',
            }}
          >
            <div className="label">
              الكروت المباعة
            </div>

            <div
              className="value"
              style={{
                color: '#059669',
              }}
            >
              {stats?.soldCards ?? '—'}
            </div>

            <div
              style={{
                marginTop: 5,
                color: 'var(--ink-soft)',
                fontSize: 11,
              }}
            >
              الحالة الحالية
            </div>
          </div>
        </div>

        {/* =====================================================
            الملخص المالي والموزعين
        ====================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 15,
            marginBottom: 20,
          }}
        >
          <div
            className="panel"
            style={{
              margin: 0,
              padding: 18,
              borderTop: '4px solid #10B981',
              background:
                'linear-gradient(180deg, #FFFFFF, #F4FFFA)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-soft)',
                fontWeight: 700,
              }}
            >
              مبيعات اليوم
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#059669',
                marginTop: 5,
              }}
            >
              {salesStats.todaySoldCount}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: 'var(--ink-soft)',
              }}
            >
              كرت مباع
            </div>
          </div>

          <div
            className="panel"
            style={{
              margin: 0,
              padding: 18,
              borderTop: '4px solid #8B5CF6',
              background:
                'linear-gradient(180deg, #FFFFFF, #FAF7FF)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-soft)',
                fontWeight: 700,
              }}
            >
              قيمة مبيعات اليوم
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#7C3AED',
                marginTop: 5,
              }}
            >
              {formatNum(
                salesStats.todayRevenue
              )}

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
              borderTop: '4px solid #6366F1',
              background:
                'linear-gradient(180deg, #FFFFFF, #F6F7FF)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-soft)',
                fontWeight: 700,
              }}
            >
              إجمالي الإيرادات
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#6366F1',
                marginTop: 5,
              }}
            >
              {formatNum(
                salesStats.totalRevenue
              )}

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
              borderTop:
                totalDebt > 0
                  ? '4px solid #EF4444'
                  : '4px solid #10B981',
              background:
                totalDebt > 0
                  ? 'linear-gradient(180deg, #FFFFFF, #FFF5F5)'
                  : 'linear-gradient(180deg, #FFFFFF, #F4FFFA)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-soft)',
                fontWeight: 700,
              }}
            >
              إجمالي ديون الموزعين
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color:
                  totalDebt > 0
                    ? '#DC2626'
                    : '#059669',
                marginTop: 5,
              }}
            >
              {formatNum(totalDebt)}

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
        </div>

        {/* =====================================================
            حالة النظام والتنبيهات
        ====================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 15,
            marginBottom: 20,
          }}
        >
          <div
            className="panel"
            style={{
              margin: 0,
              padding: 18,
              borderRight: '4px solid #2563EB',
              background:
                'linear-gradient(180deg, #FFFFFF, #F5F9FF)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-soft)',
                fontWeight: 700,
              }}
            >
              الموزعون النشطون
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                marginTop: 5,
                color: '#2563EB',
              }}
            >
              {stats?.activeDist ?? '—'}
            </div>
          </div>

          <div
            className="panel"
            style={{
              margin: 0,
              padding: 18,
              borderRight:
                stats?.pendingReq > 0
                  ? '4px solid #D97706'
                  : '4px solid #10B981',
              background:
                stats?.pendingReq > 0
                  ? 'linear-gradient(180deg, #FFFFFF, #FFF9ED)'
                  : 'linear-gradient(180deg, #FFFFFF, #F4FFFA)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-soft)',
                fontWeight: 700,
              }}
            >
              الطلبات المعلقة
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                marginTop: 5,
                color:
                  stats?.pendingReq > 0
                    ? '#D97706'
                    : '#10B981',
              }}
            >
              {stats?.pendingReq ?? '—'}
            </div>
          </div>

          <div
            className="panel"
            style={{
              margin: 0,
              padding: 18,
              borderRight:
                lowStockPackages.length > 0
                  ? '4px solid #DC2626'
                  : '4px solid #10B981',
              background:
                lowStockPackages.length > 0
                  ? 'linear-gradient(180deg, #FFFFFF, #FFF5F5)'
                  : 'linear-gradient(180deg, #FFFFFF, #F4FFFA)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-soft)',
                fontWeight: 700,
              }}
            >
              تنبيه المخزون المنخفض
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                marginTop: 5,
                color:
                  lowStockPackages.length > 0
                    ? '#DC2626'
                    : '#10B981',
              }}
            >
              {lowStockPackages.length}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: 'var(--ink-soft)',
              }}
            >
              باقات ≤ 10 كروت
            </div>
          </div>

          <div
            className="panel"
            style={{
              margin: 0,
              padding: 18,
              borderRight:
                outOfStockPackages.length > 0
                  ? '4px solid #DC2626'
                  : '4px solid #10B981',
              background:
                outOfStockPackages.length > 0
                  ? 'linear-gradient(180deg, #FFFFFF, #FFF5F5)'
                  : 'linear-gradient(180deg, #FFFFFF, #F4FFFA)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-soft)',
                fontWeight: 700,
              }}
            >
              باقات نفد مخزونها
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                marginTop: 5,
                color:
                  outOfStockPackages.length > 0
                    ? '#DC2626'
                    : '#10B981',
              }}
            >
              {outOfStockPackages.length}
            </div>
          </div>
        </div>

        {/* =====================================================
            حالة المخزون حسب الباقات
        ====================================================== */}

        <div
          className="panel"
          style={{
            marginBottom: 20,
          }}
        >
          <div className="panel-head">
            <div>
              <h3>
                حالة المخزون حسب الباقات
              </h3>

              <div
                style={{
                  marginTop: 3,
                  color: 'var(--ink-soft)',
                  fontSize: 11.5,
                }}
              >
                إجمالي مخزون المدير المتاح: {stockTotal}
              </div>
            </div>
          </div>

          {packageStock.length === 0 ? (
            <div
              style={{
                color: 'var(--ink-soft)',
                fontSize: 13,
                padding: '10px 0',
              }}
            >
              لا توجد باقات مسجلة
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 10,
              }}
            >
              {packageStock.map((pkg) => {
                const lowStock =
                  pkg.available <= 10;

                return (
                  <div
                    key={pkg.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: lowStock
                        ? '#FFF8F8'
                        : '#FAF9FC',
                      border: lowStock
                        ? '1px solid #FECACA'
                        : '1px solid #F0ECF7',
                    }}
                  >
                    <div
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
                            fontWeight: 900,
                            color: '#3A1D66',
                            fontSize: 13.5,
                          }}
                        >
                          {pkg.name}
                        </div>

                        <div
                          style={{
                            marginTop: 3,
                            color:
                              'var(--ink-soft)',
                            fontSize: 11,
                          }}
                        >
                          {formatNum(pkg.price)} ريال
                        </div>
                      </div>

                      {lowStock && (
                        <div
                          style={{
                            background: '#FEE2E2',
                            color: '#B91C1C',
                            padding:
                              '5px 8px',
                            borderRadius: 8,
                            fontSize: 10.5,
                            fontWeight: 800,
                          }}
                        >
                          مخزون منخفض
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(3, 1fr)',
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      <div
                        style={{
                          background: '#EFF6FF',
                          borderRadius: 9,
                          padding: 8,
                          textAlign: 'center',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: '#2563EB',
                            fontWeight: 700,
                          }}
                        >
                          متاح
                        </div>

                        <div
                          style={{
                            marginTop: 2,
                            fontWeight: 900,
                            color: '#1D4ED8',
                          }}
                        >
                          {pkg.available}
                        </div>
                      </div>

                      <div
                        style={{
                          background: '#FFF7ED',
                          borderRadius: 9,
                          padding: 8,
                          textAlign: 'center',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: '#D97706',
                            fontWeight: 700,
                          }}
                        >
                          مع موزع
                        </div>

                        <div
                          style={{
                            marginTop: 2,
                            fontWeight: 900,
                            color: '#B45309',
                          }}
                        >
                          {pkg.withDistributor}
                        </div>
                      </div>

                      <div
                        style={{
                          background: '#ECFDF5',
                          borderRadius: 9,
                          padding: 8,
                          textAlign: 'center',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: '#059669',
                            fontWeight: 700,
                          }}
                        >
                          مباع
                        </div>

                        <div
                          style={{
                            marginTop: 2,
                            fontWeight: 900,
                            color: '#047857',
                          }}
                        >
                          {pkg.sold}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                  padding: '11px 0',
                  borderBottom:
                    '1px solid #F3F0FB',
                  fontSize: 13.5,
                  gap: 10,
                  flexWrap: 'wrap',
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
                    {formatNum(data.total)} ريال
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
                    {formatNum(
                      c.packages?.price || 0
                    )}{' '}
                    ريال
                  </div>
                </div>

                <div
                  className="tleft"
                  style={{
                    fontSize: 11.5,
                  }}
                >
                  {formatDate(c.sold_at)}
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
