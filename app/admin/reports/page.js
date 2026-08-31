'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function ReportsPage() {
  const { profile, loading } = useProfile('admin');

  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(true);

  const [networkStats, setNetworkStats] = useState({
    salesCount: 0,
    grossSales: 0,
    managerSales: 0,
  });

  const formatNum = (num) => {
    const value = Number(num) || 0;

    return Math.round(value).toLocaleString('en-US', {
      maximumFractionDigits: 0,
    });
  };

  const formatDate = (date) => {
    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const filterConfig = useMemo(() => {
    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const startOfYear = new Date(
      now.getFullYear(),
      0,
      1
    );

    return {
      all: {
        label: 'الكل',
        sub: 'من بداية النظام حتى الآن',
        start: null,
        end: now,
      },

      day: {
        label: 'اليومي',
        sub: `${formatDate(startOfToday)} إلى ${formatDate(now)}`,
        start: startOfToday,
        end: now,
      },

      month: {
        label: 'الشهري',
        sub: `${formatDate(startOfMonth)} إلى ${formatDate(now)}`,
        start: startOfMonth,
        end: now,
      },

      year: {
        label: 'السنوي',
        sub: `${formatDate(startOfYear)} إلى ${formatDate(now)}`,
        start: startOfYear,
        end: now,
      },
    };
  }, []);

  const isSaleInSelectedPeriod = (soldAt) => {
    if (filter === 'all') {
      return true;
    }

    if (!soldAt) {
      return false;
    }

    const saleDate = new Date(soldAt);

    if (Number.isNaN(saleDate.getTime())) {
      return false;
    }

    const config = filterConfig[filter];

    return (
      saleDate >= config.start &&
      saleDate <= config.end
    );
  };

  async function loadReport() {
    setBusy(true);

    try {
      const [
        { data: distributors, error: distributorsError },
        { data: cards, error: cardsError },
        { data: payments, error: paymentsError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'distributor'),

        supabase
          .from('cards')
          .select(`
            id,
            assigned_to,
            status,
            sold_at,
            manager_price,
            packages (
              price
            )
          `),

        supabase
          .from('payments')
          .select('distributor_id, amount'),
      ]);

      if (distributorsError) {
        throw distributorsError;
      }

      if (cardsError) {
        throw cardsError;
      }

      if (paymentsError) {
        throw paymentsError;
      }

      /*
       * ==========================================================
       * إجمالي السدادات لكل موزع
       * ==========================================================
       */

      const paymentsMap = {};

      (payments || []).forEach((payment) => {
        if (!payment.distributor_id) return;

        paymentsMap[payment.distributor_id] =
          (paymentsMap[payment.distributor_id] || 0) +
          Number(payment.amount || 0);
      });

      /*
       * ==========================================================
       * إنشاء بيانات جميع الموزعين
       * ==========================================================
       */

      const distributorMap = {};

      (distributors || []).forEach((distributor) => {
        distributorMap[distributor.id] = {
          id: distributor.id,
          name: distributor.full_name || 'موزع',

          salesCount: 0,
          grossSales: 0,
          managerSales: 0,

          totalManagerSales: 0,
          totalPaid: paymentsMap[distributor.id] || 0,

          remainingDebt: 0,
        };
      });

      let networkSalesCount = 0;
      let networkGrossSales = 0;
      let networkManagerSales = 0;

      /*
       * ==========================================================
       * حساب المبيعات الفعلية
       * ==========================================================
       */

      (cards || []).forEach((card) => {
        const distributorId = card.assigned_to;

        if (
          !distributorId ||
          !distributorMap[distributorId]
        ) {
          return;
        }

        const status = String(card.status || '')
          .trim()
          .toLowerCase();

        /*
         * لا تعتبر العملية بيعًا إلا إذا:
         * 1- حالة الكرت sold
         * 2- يوجد sold_at
         */

        if (status !== 'sold' || !card.sold_at) {
          return;
        }

        const packagePrice = Number(
          card.packages?.price || 0
        );

        /*
         * استخدام manager_price المحفوظ.
         *
         * للسجلات القديمة:
         * 90% من سعر الباقة.
         */

        let managerPrice = Number(card.manager_price);

        if (
          !Number.isFinite(managerPrice) ||
          managerPrice < 0
        ) {
          managerPrice = packagePrice * 0.90;
        }

        /*
         * حماية من قيمة أكبر من سعر الكرت.
         */

        if (
          packagePrice > 0 &&
          managerPrice > packagePrice
        ) {
          managerPrice = packagePrice * 0.90;
        }

        /*
         * إجمالي حصة المدير التاريخية.
         * تستخدم لحساب الدين الحالي.
         */

        distributorMap[distributorId].totalManagerSales +=
          managerPrice;

        /*
         * تطبيق الفلتر الزمني على المبيعات فقط.
         */

        if (!isSaleInSelectedPeriod(card.sold_at)) {
          return;
        }

        distributorMap[distributorId].salesCount += 1;

        distributorMap[distributorId].grossSales +=
          packagePrice;

        distributorMap[distributorId].managerSales +=
          managerPrice;

        networkSalesCount += 1;
        networkGrossSales += packagePrice;
        networkManagerSales += managerPrice;
      });

      /*
       * ==========================================================
       * حساب الدين الحالي
       * ==========================================================
       *
       * الدين الحالي مستقل عن الفلتر.
       */

      Object.values(distributorMap).forEach((distributor) => {
        distributor.remainingDebt = Math.max(
          0,
          Math.round(
            distributor.totalManagerSales -
              distributor.totalPaid
          )
        );
      });

      /*
       * ==========================================================
       * تحديث ملخص الشبكة
       * ==========================================================
       */

      setNetworkStats({
        salesCount: networkSalesCount,
        grossSales: networkGrossSales,
        managerSales: networkManagerSales,
      });

      /*
       * الأعلى مبيعًا يظهر أولًا.
       * عند التساوي يظهر صاحب الدين الأعلى أولًا.
       */

      const result = Object.values(distributorMap).sort(
        (a, b) => {
          if (b.managerSales !== a.managerSales) {
            return b.managerSales - a.managerSales;
          }

          return b.remainingDebt - a.remainingDebt;
        }
      );

      setRows(result);
    } catch (error) {
      console.error(
        'خطأ في تحميل تقارير المدير:',
        error
      );

      setRows([]);

      setNetworkStats({
        salesCount: 0,
        grossSales: 0,
        managerSales: 0,
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (profile) {
      loadReport();
    }
  }, [profile, filter]);

  if (loading) {
    return null;
  }

  const currentFilter = filterConfig[filter];

  return (
    <div className="app">
      <Sidebar
        role="admin"
        active="/admin/reports"
        name={profile?.full_name}
      />

      <div
        className="main"
        style={{
          paddingBottom: '50px',
        }}
      >
        {/* =====================================================
            رأس الصفحة
        ====================================================== */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '18px',
            marginBottom: '28px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '30px',
                lineHeight: 1.2,
                fontWeight: 900,
                color: '#0F172A',
                margin: '0 0 8px',
              }}
            >
              تقارير المدير
            </h1>

            <p
              style={{
                fontSize: '15px',
                color: '#64748B',
                fontWeight: 600,
                margin: 0,
                lineHeight: 1.7,
              }}
            >
              ملخص واضح للمبيعات الفعلية وحصة المدير والدين الحالي لجميع الموزعين
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="no-print"
            style={{
              padding: '13px 21px',
              minHeight: '48px',
              borderRadius: '13px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontWeight: 900,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
            }}
          >
            🖨️ طباعة التقرير
          </button>
        </div>

        {/* =====================================================
            اختيار الفترة
        ====================================================== */}

        <div
          className="no-print"
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '13px',
            marginBottom: '30px',
          }}
        >
          {['all', 'day', 'month', 'year'].map(
            (item) => {
              const active = filter === item;

              return (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  style={{
                    padding: '17px 18px',
                    minHeight: '78px',
                    borderRadius: '15px',
                    border: active
                      ? '2px solid #0F766E'
                      : '1px solid #E2E8F0',
                    background: active
                      ? '#F0FDFA'
                      : '#FFFFFF',
                    cursor: 'pointer',
                    textAlign: 'right',
                    boxShadow: active
                      ? '0 5px 15px rgba(15,118,110,0.10)'
                      : '0 2px 5px rgba(0,0,0,0.03)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 900,
                      color: active
                        ? '#0F766E'
                        : '#0F172A',
                      marginBottom: '6px',
                    }}
                  >
                    {filterConfig[item].label}
                  </div>

                  <div
                    style={{
                      fontSize: '12px',
                      color: '#64748B',
                      fontWeight: 700,
                      lineHeight: 1.5,
                    }}
                  >
                    {filterConfig[item].sub}
                  </div>
                </button>
              );
            }
          )}
        </div>

        {/* =====================================================
            بطاقات ملخص الشبكة
        ====================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '18px',
            marginBottom: '30px',
          }}
        >
          {/* عدد المبيعات */}

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '18px',
              padding: '24px',
              minHeight: '145px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxShadow:
                '0 3px 8px rgba(15,23,42,0.04)',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                color: '#64748B',
                fontWeight: 800,
                marginBottom: '12px',
              }}
            >
              عدد المبيعات
            </div>

            <div
              style={{
                fontSize: '32px',
                lineHeight: 1,
                fontWeight: 900,
                color: '#0F766E',
              }}
            >
              {formatNum(networkStats.salesCount)}

              <span
                style={{
                  fontSize: '15px',
                  marginRight: '7px',
                  fontWeight: 800,
                  color: '#475569',
                }}
              >
                كرت
              </span>
            </div>
          </div>

          {/* إجمالي المبيعات */}

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '18px',
              padding: '24px',
              minHeight: '145px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxShadow:
                '0 3px 8px rgba(15,23,42,0.04)',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                color: '#64748B',
                fontWeight: 800,
                marginBottom: '12px',
              }}
            >
              إجمالي قيمة المبيعات
            </div>

            <div
              style={{
                fontSize: '32px',
                lineHeight: 1,
                fontWeight: 900,
                color: '#0F172A',
              }}
            >
              {formatNum(networkStats.grossSales)}

              <span
                style={{
                  fontSize: '15px',
                  marginRight: '7px',
                  fontWeight: 800,
                  color: '#475569',
                }}
              >
                ريال
              </span>
            </div>
          </div>

          {/* حصة المدير */}

          <div
            style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '18px',
              padding: '24px',
              minHeight: '145px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxShadow:
                '0 3px 8px rgba(16,185,129,0.06)',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                color: '#166534',
                fontWeight: 800,
                marginBottom: '12px',
              }}
            >
              حصة المدير
            </div>

            <div
              style={{
                fontSize: '32px',
                lineHeight: 1,
                fontWeight: 900,
                color: '#059669',
              }}
            >
              {formatNum(networkStats.managerSales)}

              <span
                style={{
                  fontSize: '15px',
                  marginRight: '7px',
                  fontWeight: 800,
                  color: '#166534',
                }}
              >
                ريال
              </span>
            </div>
          </div>
        </div>

        {/* =====================================================
            عنوان قائمة الموزعين
        ====================================================== */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '15px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#0F172A',
                margin: 0,
              }}
            >
              أداء جميع الموزعين
            </h2>

            <div
              style={{
                fontSize: '13px',
                color: '#64748B',
                fontWeight: 700,
                marginTop: '5px',
              }}
            >
              المبيعات المعروضة حسب الفترة: {currentFilter.label}
            </div>
          </div>

          <div
            style={{
              background: '#F1F5F9',
              color: '#475569',
              borderRadius: '20px',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 900,
            }}
          >
            {rows.length} موزع
          </div>
        </div>

        {/* =====================================================
            قائمة الموزعين
        ====================================================== */}

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow:
              '0 4px 12px rgba(15,23,42,0.04)',
          }}
        >
          {busy && (
            <div
              style={{
                padding: '55px 20px',
                textAlign: 'center',
                color: '#64748B',
                fontWeight: 800,
                fontSize: '15px',
              }}
            >
              جاري تحميل التقرير...
            </div>
          )}

          {!busy && rows.length === 0 && (
            <div
              style={{
                padding: '55px 20px',
                textAlign: 'center',
                color: '#64748B',
                fontWeight: 800,
                fontSize: '15px',
              }}
            >
              لا توجد بيانات للموزعين.
            </div>
          )}

          {!busy &&
            rows.length > 0 &&
            rows.map((row, index) => (
              <div
                key={row.id}
                style={{
                  padding: '25px 28px',
                  borderTop:
                    index > 0
                      ? '1px solid #E2E8F0'
                      : 'none',
                }}
              >
                {/* =================================================
                    اسم الموزع
                ================================================== */}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '18px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <span
                      style={{
                        width: '11px',
                        height: '11px',
                        borderRadius: '50%',
                        background:
                          row.salesCount > 0
                            ? '#0F766E'
                            : '#CBD5E1',
                        flexShrink: 0,
                      }}
                    />

                    <span
                      style={{
                        fontSize: '19px',
                        fontWeight: 900,
                        color: '#0F172A',
                      }}
                    >
                      {row.name}
                    </span>
                  </div>

                  {index < 3 &&
                    row.salesCount > 0 && (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 900,
                          color: '#0F766E',
                          background: '#F0FDFA',
                          border: '1px solid #99F6E4',
                          borderRadius: '20px',
                          padding: '6px 11px',
                        }}
                      >
                        #{index + 1}
                      </span>
                    )}
                </div>

                {/* =================================================
                    بيانات الموزع
                ================================================== */}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                  }}
                >
                  {/* عدد المبيعات */}

                  <div
                    style={{
                      minHeight: '105px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '14px',
                      padding: '17px 19px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#64748B',
                        fontWeight: 800,
                        marginBottom: '9px',
                      }}
                    >
                      عدد المبيعات
                    </div>

                    <div
                      style={{
                        fontSize: '23px',
                        fontWeight: 900,
                        color: '#0F766E',
                      }}
                    >
                      {formatNum(row.salesCount)}

                      <span
                        style={{
                          fontSize: '13px',
                          marginRight: '6px',
                          color: '#475569',
                        }}
                      >
                        كرت
                      </span>
                    </div>
                  </div>

                  {/* قيمة المبيعات */}

                  <div
                    style={{
                      minHeight: '105px',
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '14px',
                      padding: '17px 19px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#64748B',
                        fontWeight: 800,
                        marginBottom: '9px',
                      }}
                    >
                      قيمة المبيعات
                    </div>

                    <div
                      style={{
                        fontSize: '23px',
                        fontWeight: 900,
                        color: '#0F172A',
                      }}
                    >
                      {formatNum(row.grossSales)}

                      <span
                        style={{
                          fontSize: '13px',
                          marginRight: '6px',
                          color: '#475569',
                        }}
                      >
                        ريال
                      </span>
                    </div>
                  </div>

                  {/* حصة المدير */}

                  <div
                    style={{
                      minHeight: '105px',
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '14px',
                      padding: '17px 19px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#166534',
                        fontWeight: 800,
                        marginBottom: '9px',
                      }}
                    >
                      حصة المدير
                    </div>

                    <div
                      style={{
                        fontSize: '23px',
                        fontWeight: 900,
                        color: '#059669',
                      }}
                    >
                      {formatNum(row.managerSales)}

                      <span
                        style={{
                          fontSize: '13px',
                          marginRight: '6px',
                          color: '#166534',
                        }}
                      >
                        ريال
                      </span>
                    </div>
                  </div>

                  {/* الدين الحالي */}

                  <div
                    style={{
                      minHeight: '105px',
                      background:
                        row.remainingDebt > 0
                          ? '#FEF2F2'
                          : '#F0FDF4',
                      border:
                        row.remainingDebt > 0
                          ? '1px solid #FCA5A5'
                          : '1px solid #BBF7D0',
                      borderRadius: '14px',
                      padding: '17px 19px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color:
                          row.remainingDebt > 0
                            ? '#991B1B'
                            : '#166534',
                        fontWeight: 900,
                        marginBottom: '9px',
                      }}
                    >
                      الدين الحالي
                    </div>

                    <div
                      style={{
                        fontSize: '23px',
                        fontWeight: 900,
                        color:
                          row.remainingDebt > 0
                            ? '#DC2626'
                            : '#059669',
                      }}
                    >
                      {formatNum(row.remainingDebt)}

                      <span
                        style={{
                          fontSize: '13px',
                          marginRight: '6px',
                          color:
                            row.remainingDebt > 0
                              ? '#991B1B'
                              : '#166534',
                        }}
                      >
                        ريال
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
