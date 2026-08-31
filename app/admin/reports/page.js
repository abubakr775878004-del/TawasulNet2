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
       * السدادات التاريخية لكل موزع
       * ==========================================================
       */

      const paymentsMap = {};

      (payments || []).forEach((payment) => {
        if (!payment.distributor_id) {
          return;
        }

        paymentsMap[payment.distributor_id] =
          (paymentsMap[payment.distributor_id] || 0) +
          Number(payment.amount || 0);
      });

      /*
       * ==========================================================
       * إنشاء سجل لجميع الموزعين
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
       * تحليل المبيعات الفعلية
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
         * لا توجد عملية بيع إلا إذا كانت حالة الكرت sold
         * ويوجد لها sold_at.
         */

        if (status !== 'sold' || !card.sold_at) {
          return;
        }

        const packagePrice = Number(
          card.packages?.price || 0
        );

        /*
         * manager_price هي القيمة المالية المسجلة للمدير.
         *
         * للسجلات القديمة التي لا تحتوي عليها:
         * نستخدم 90% من سعر الباقة.
         */

        let managerPrice = Number(card.manager_price);

        if (
          !Number.isFinite(managerPrice) ||
          managerPrice < 0
        ) {
          managerPrice = packagePrice * 0.90;
        }

        /*
         * حماية من قيمة أكبر من سعر البيع.
         */

        if (
          packagePrice > 0 &&
          managerPrice > packagePrice
        ) {
          managerPrice = packagePrice * 0.90;
        }

        /*
         * ========================================================
         * إجمالي المبيعات التاريخية
         * ========================================================
         *
         * يستخدم فقط لحساب الدين الحالي.
         */

        distributorMap[distributorId].totalManagerSales +=
          managerPrice;

        /*
         * ========================================================
         * مبيعات الفترة المحددة
         * ========================================================
         */

        if (
          !isSaleInSelectedPeriod(card.sold_at)
        ) {
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
       * الدين لا يعتمد على الفلتر.
       *
       * الدين =
       * إجمالي حصة المدير من كل المبيعات
       * - إجمالي السدادات
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
       * ترتيب الموزعين:
       * الأعلى مبيعًا أولًا.
       * ثم الدين الحالي عند تساوي المبيعات.
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
          paddingBottom: '40px',
        }}
      >
        {/* =====================================================
            رأس الصفحة
        ====================================================== */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '20px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: '#0F172A',
                margin: '0 0 5px',
              }}
            >
              تقارير المدير
            </h1>

            <p
              style={{
                fontSize: '13px',
                color: '#64748B',
                fontWeight: 600,
                margin: 0,
              }}
            >
              المبيعات الفعلية وحصة المدير والدين الحالي لجميع الموزعين
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="no-print"
            style={{
              padding: '10px 17px',
              borderRadius: '11px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            🖨️ طباعة التقرير
          </button>
        </div>

        {/* =====================================================
            الفترات
        ====================================================== */}

        <div
          className="no-print"
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '10px',
            marginBottom: '22px',
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
                    padding: '12px 14px',
                    borderRadius: '13px',
                    border: active
                      ? '2px solid #0F766E'
                      : '1px solid #E2E8F0',
                    background: active
                      ? '#F0FDFA'
                      : '#FFFFFF',
                    cursor: 'pointer',
                    textAlign: 'right',
                  }}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 900,
                      color: active
                        ? '#0F766E'
                        : '#0F172A',
                      marginBottom: '3px',
                    }}
                  >
                    {filterConfig[item].label}
                  </div>

                  <div
                    style={{
                      fontSize: '10.5px',
                      color: '#64748B',
                      fontWeight: 700,
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
            ملخص التقرير
        ====================================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px',
            marginBottom: '22px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '15px',
              padding: '18px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#64748B',
                fontWeight: 700,
                marginBottom: '7px',
              }}
            >
              عدد المبيعات
            </div>

            <div
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: '#0F766E',
              }}
            >
              {formatNum(networkStats.salesCount)}

              <span
                style={{
                  fontSize: '13px',
                  marginRight: '5px',
                }}
              >
                كرت
              </span>
            </div>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '15px',
              padding: '18px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#64748B',
                fontWeight: 700,
                marginBottom: '7px',
              }}
            >
              إجمالي قيمة المبيعات
            </div>

            <div
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: '#0F172A',
              }}
            >
              {formatNum(networkStats.grossSales)}

              <span
                style={{
                  fontSize: '13px',
                  marginRight: '5px',
                }}
              >
                ريال
              </span>
            </div>
          </div>

          <div
            style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '15px',
              padding: '18px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#166534',
                fontWeight: 700,
                marginBottom: '7px',
              }}
            >
              حصة المدير
            </div>

            <div
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: '#059669',
              }}
            >
              {formatNum(networkStats.managerSales)}

              <span
                style={{
                  fontSize: '13px',
                  marginRight: '5px',
                }}
              >
                ريال
              </span>
            </div>
          </div>
        </div>

        {/* =====================================================
            تقرير الموزعين
        ====================================================== */}

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '17px 20px',
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '15px',
                  fontWeight: 900,
                  color: '#0F172A',
                  margin: 0,
                }}
              >
                أداء الموزعين
              </h2>

              <div
                style={{
                  fontSize: '11px',
                  color: '#64748B',
                  fontWeight: 700,
                  marginTop: '4px',
                }}
              >
                الفترة: {currentFilter.label}
              </div>
            </div>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#475569',
              }}
            >
              {rows.length} موزع
            </span>
          </div>

          {busy && (
            <div
              style={{
                padding: '35px 20px',
                textAlign: 'center',
                color: '#64748B',
                fontWeight: 700,
              }}
            >
              جاري تحميل التقرير...
            </div>
          )}

          {!busy && rows.length === 0 && (
            <div
              style={{
                padding: '35px 20px',
                textAlign: 'center',
                color: '#64748B',
                fontWeight: 700,
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
                  padding: '17px 20px',
                  borderTop:
                    index > 0
                      ? '1px solid #F1F5F9'
                      : 'none',
                }}
              >
                {/* اسم الموزع */}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    marginBottom: '12px',
                  }}
                >
                  <span
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background:
                        row.salesCount > 0
                          ? '#0F766E'
                          : '#CBD5E1',
                    }}
                  />

                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: 900,
                      color: '#0F172A',
                    }}
                  >
                    {row.name}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {/* عدد المبيعات */}

                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '11px',
                      padding: '11px 14px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10.5px',
                        color: '#64748B',
                        fontWeight: 700,
                        marginBottom: '5px',
                      }}
                    >
                      عدد المبيعات
                    </div>

                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 900,
                        color: '#0F766E',
                      }}
                    >
                      {formatNum(row.salesCount)} كرت
                    </div>
                  </div>

                  {/* قيمة المبيعات */}

                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '11px',
                      padding: '11px 14px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10.5px',
                        color: '#64748B',
                        fontWeight: 700,
                        marginBottom: '5px',
                      }}
                    >
                      قيمة المبيعات
                    </div>

                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 900,
                        color: '#0F172A',
                      }}
                    >
                      {formatNum(row.grossSales)} ريال
                    </div>
                  </div>

                  {/* حصة المدير */}

                  <div
                    style={{
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '11px',
                      padding: '11px 14px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10.5px',
                        color: '#166534',
                        fontWeight: 700,
                        marginBottom: '5px',
                      }}
                    >
                      حصة المدير
                    </div>

                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 900,
                        color: '#059669',
                      }}
                    >
                      {formatNum(row.managerSales)} ريال
                    </div>
                  </div>

                  {/* الدين الحالي */}

                  <div
                    style={{
                      background:
                        row.remainingDebt > 0
                          ? '#FEF2F2'
                          : '#F0FDF4',
                      border:
                        row.remainingDebt > 0
                          ? '1px solid #FCA5A5'
                          : '1px solid #BBF7D0',
                      borderRadius: '11px',
                      padding: '11px 14px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10.5px',
                        color:
                          row.remainingDebt > 0
                            ? '#991B1B'
                            : '#166534',
                        fontWeight: 800,
                        marginBottom: '5px',
                      }}
                    >
                      الدين الحالي
                    </div>

                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 900,
                        color:
                          row.remainingDebt > 0
                            ? '#DC2626'
                            : '#059669',
                      }}
                    >
                      {formatNum(row.remainingDebt)} ريال
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
