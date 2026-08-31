'use client';

import { useEffect, useState, useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

function formatNumericDate(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return dateString;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}/${month}/${day}`;
}

function getDateKey(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthKey(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function getYearKey(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return '';

  return String(d.getFullYear());
}

export default function DistributorSalesPage() {
  const { profile, loading } = useProfile('distributor');

  const [soldCards, setSoldCards] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [currentDebt, setCurrentDebt] = useState(0);
  const [commissionRate, setCommissionRate] = useState(10);
  const [dataLoading, setDataLoading] = useState(true);

  const today = new Date();

  const currentDateValue = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  const currentMonthValue = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0')
  ].join('-');

  const currentYearValue = String(today.getFullYear());

  const [reportType, setReportType] = useState('month');

  const [selectedDay, setSelectedDay] = useState(
    currentDateValue
  );

  const [selectedMonth, setSelectedMonth] = useState(
    currentMonthValue
  );

  const [selectedYear, setSelectedYear] = useState(
    currentYearValue
  );

  async function loadData() {
    if (!profile) return;

    setDataLoading(true);

    try {
      /*
       * جلب بيانات الموزع الحالية.
       *
       * الدين لا يتم حسابه هنا من المبيعات والسدادات.
       * يتم أخذ الدين الحقيقي مباشرة من قاعدة البيانات.
       */
      const { data: distributorData, error: profileError } =
        await supabase
          .from('profiles')
          .select('debt_balance, debt, commission_rate')
          .eq('id', profile.id)
          .single();

      if (profileError) {
        console.error(
          'Error loading distributor profile:',
          profileError
        );
      }

      if (distributorData) {
        setCurrentDebt(
          Number(
            distributorData.debt_balance ??
            distributorData.debt ??
            0
          )
        );

        setCommissionRate(
          Number(
            distributorData.commission_rate ??
            10
          )
        );
      }

      /*
       * جلب جميع الكروت المباعة الخاصة بالموزع.
       */
      const { data: cardsData, error: cardsError } =
        await supabase
          .from('cards')
          .select(`
            id,
            sold_at,
            packages (
              name,
              price
            )
          `)
          .eq('assigned_to', profile.id)
          .eq('status', 'sold')
          .order('sold_at', {
            ascending: false
          });

      if (cardsError) {
        console.error(
          'Error loading sold cards:',
          cardsError
        );
      }

      const formattedSales = (cardsData || []).map((card) => ({
        id: card.id,
        package_name:
          card.packages?.name ||
          'باقة غير معروفة',
        price: Number(
          card.packages?.price || 0
        ),
        sold_at: card.sold_at
      }));

      setSoldCards(formattedSales);

      /*
       * جلب المخزون الحالي.
       *
       * هذه الكروت لم تبع بعد،
       * لذلك لا تدخل في المبيعات أو الدين.
       */
      const { data: inventoryData, error: inventoryError } =
        await supabase
          .from('cards')
          .select(`
            id,
            packages (
              name,
              price
            )
          `)
          .eq('assigned_to', profile.id)
          .eq('status', 'with_distributor');

      if (inventoryError) {
        console.error(
          'Error loading inventory:',
          inventoryError
        );
      }

      setMyCards(inventoryData || []);

    } catch (error) {
      console.error(
        'Distributor report error:',
        error
      );
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  /*
   * فلترة المبيعات حسب نوع التقرير.
   *
   * يومي:
   * YYYY-MM-DD
   *
   * شهري:
   * YYYY-MM
   *
   * سنوي:
   * YYYY
   */
  const filteredSales = useMemo(() => {
    return soldCards.filter((sale) => {
      if (!sale.sold_at) return false;

      if (reportType === 'day') {
        return (
          getDateKey(sale.sold_at) ===
          selectedDay
        );
      }

      if (reportType === 'month') {
        return (
          getMonthKey(sale.sold_at) ===
          selectedMonth
        );
      }

      if (reportType === 'year') {
        return (
          getYearKey(sale.sold_at) ===
          selectedYear
        );
      }

      return true;
    });
  }, [
    soldCards,
    reportType,
    selectedDay,
    selectedMonth,
    selectedYear
  ]);

  /*
   * إجمالي قيمة المبيعات للفترة.
   */
  const salesTotal = useMemo(() => {
    return filteredSales.reduce(
      (sum, sale) =>
        sum + Number(sale.price || 0),
      0
    );
  }, [filteredSales]);

  /*
   * عدد الكروت المباعة.
   */
  const soldCardsCount =
    filteredSales.length;

  /*
   * عمولة الموزع حسب النسبة المخزنة
   * في profiles.commission_rate.
   */
  const distributorCommission =
    salesTotal *
    (commissionRate / 100);

  /*
   * حصة المدير من مبيعات الفترة.
   */
  const managerShare =
    salesTotal -
    distributorCommission;

  /*
   * قيمة المخزون الحالي.
   */
  const inventoryValue = useMemo(() => {
    return myCards.reduce(
      (sum, card) =>
        sum +
        Number(
          card.packages?.price || 0
        ),
      0
    );
  }, [myCards]);

  /*
   * تجميع المبيعات حسب الباقة.
   */
  const salesByPackage = useMemo(() => {
    const result = {};

    filteredSales.forEach((sale) => {
      const packageName =
        sale.package_name ||
        'باقة غير معروفة';

      if (!result[packageName]) {
        result[packageName] = {
          count: 0,
          revenue: 0
        };
      }

      result[packageName].count += 1;

      result[packageName].revenue +=
        Number(sale.price || 0);
    });

    return result;
  }, [filteredSales]);

  /*
   * عنوان الفترة الحالية.
   */
  const reportTitle = useMemo(() => {
    if (reportType === 'day') {
      return selectedDay || 'اليوم المحدد';
    }

    if (reportType === 'month') {
      return selectedMonth || 'الشهر المحدد';
    }

    if (reportType === 'year') {
      return selectedYear || 'السنة المحددة';
    }

    return '';
  }, [
    reportType,
    selectedDay,
    selectedMonth,
    selectedYear
  ]);

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="app">

      <Sidebar
        role="distributor"
        active="/distributor/sales"
        name={profile.full_name}
      />

      <div className="main">

        {/* رأس الصفحة */}

        <div className="topbar">
          <div>
            <h1>تقارير المبيعات</h1>

            <div className="greet">
              متابعة مبيعاتك وأرباحك وحالة حسابك
            </div>
          </div>
        </div>

        {/* اختيار نوع التقرير */}

        <div
          style={{
            background: '#FFFFFF',
            padding: 16,
            borderRadius: 16,
            border: '1px solid #E2E8F0',
            marginBottom: 16
          }}
        >

          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: '#334155',
              marginBottom: 12
            }}
          >
            نوع التقرير
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr 1fr',
              gap: 8,
              marginBottom: 14
            }}
          >

            <button
              onClick={() =>
                setReportType('day')
              }
              style={{
                padding: '10px',
                borderRadius: 10,
                border:
                  reportType === 'day'
                    ? '2px solid #2563EB'
                    : '1px solid #CBD5E1',
                background:
                  reportType === 'day'
                    ? '#EFF6FF'
                    : '#FFFFFF',
                color:
                  reportType === 'day'
                    ? '#1D4ED8'
                    : '#475569',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              يومي
            </button>

            <button
              onClick={() =>
                setReportType('month')
              }
              style={{
                padding: '10px',
                borderRadius: 10,
                border:
                  reportType === 'month'
                    ? '2px solid #2563EB'
                    : '1px solid #CBD5E1',
                background:
                  reportType === 'month'
                    ? '#EFF6FF'
                    : '#FFFFFF',
                color:
                  reportType === 'month'
                    ? '#1D4ED8'
                    : '#475569',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              شهري
            </button>

            <button
              onClick={() =>
                setReportType('year')
              }
              style={{
                padding: '10px',
                borderRadius: 10,
                border:
                  reportType === 'year'
                    ? '2px solid #2563EB'
                    : '1px solid #CBD5E1',
                background:
                  reportType === 'year'
                    ? '#EFF6FF'
                    : '#FFFFFF',
                color:
                  reportType === 'year'
                    ? '#1D4ED8'
                    : '#475569',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              سنوي
            </button>

          </div>

          {/* اختيار التاريخ */}

          {reportType === 'day' && (
            <input
              type="date"
              value={selectedDay}
              onChange={(e) =>
                setSelectedDay(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 10,
                border:
                  '1.5px solid #CBD5E1',
                fontSize: 14,
                fontWeight: 700,
                background: '#F8FAFC'
              }}
            />
          )}

          {reportType === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) =>
                setSelectedMonth(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 10,
                border:
                  '1.5px solid #CBD5E1',
                fontSize: 14,
                fontWeight: 700,
                background: '#F8FAFC'
              }}
            />
          )}

          {reportType === 'year' && (
            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 10,
                border:
                  '1.5px solid #CBD5E1',
                fontSize: 14,
                fontWeight: 700,
                background: '#F8FAFC'
              }}
            >
              <option value="2025">
                2025
              </option>

              <option value="2026">
                2026
              </option>

              <option value="2027">
                2027
              </option>

              <option value="2028">
                2028
              </option>
            </select>
          )}

        </div>

        {/* عنوان الفترة */}

        <div
          style={{
            background: '#F8FAFC',
            border:
              '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 800,
            color: '#475569'
          }}
        >
          التقرير الحالي:
          {' '}
          <span
            style={{
              color: '#0F172A',
              marginRight: 6
            }}
          >
            {reportTitle}
          </span>
        </div>

        {/* بطاقات التقرير */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1fr 1fr',
            gap: 12,
            marginBottom: 16
          }}
        >

          {/* عدد المبيعات */}

          <div
            style={{
              background:
                'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
              padding: 16,
              borderRadius: 16,
              border:
                '1px solid #BFDBFE'
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#1D4ED8'
              }}
            >
              الكروت المباعة
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#1E3A8A',
                marginTop: 5
              }}
            >
              {soldCardsCount}
              {' '}
              <span
                style={{
                  fontSize: 12
                }}
              >
                كرت
              </span>
            </div>
          </div>

          {/* إجمالي المبيعات */}

          <div
            style={{
              background:
                'linear-gradient(135deg, #F3F0FF, #EDE9FE)',
              padding: 16,
              borderRadius: 16,
              border:
                '1px solid #DDD6FE'
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#6D28D9'
              }}
            >
              إجمالي المبيعات
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: '#4C1D95',
                marginTop: 5
              }}
            >
              {formatNumber(salesTotal)}
              {' '}
              <span
                style={{
                  fontSize: 11
                }}
              >
                ر.ي
              </span>
            </div>
          </div>

          {/* عمولة الموزع */}

          <div
            style={{
              background:
                'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
              padding: 16,
              borderRadius: 16,
              border:
                '1px solid #A7F3D0'
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#047857'
              }}
            >
              عمولتك ({commissionRate}%)
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: '#059669',
                marginTop: 5
              }}
            >
              {formatNumber(
                distributorCommission
              )}
              {' '}
              <span
                style={{
                  fontSize: 11
                }}
              >
                ر.ي
              </span>
            </div>
          </div>

          {/* حصة المدير */}

          <div
            style={{
              background:
                'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
              padding: 16,
              borderRadius: 16,
              border:
                '1px solid #FED7AA'
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#C2410C'
              }}
            >
              حصة المدير للفترة
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: '#9A3412',
                marginTop: 5
              }}
            >
              {formatNumber(
                managerShare
              )}
              {' '}
              <span
                style={{
                  fontSize: 11
                }}
              >
                ر.ي
              </span>
            </div>
          </div>

        </div>

        {/* الدين الحالي */}

        <div
          style={{
            background:
              currentDebt > 0
                ? 'linear-gradient(135deg, #991B1B, #DC2626)'
                : 'linear-gradient(135deg, #065F46, #059669)',
            borderRadius: 16,
            padding: '18px 20px',
            color: '#FFFFFF',
            marginBottom: 16,
            boxShadow:
              '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >

          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              opacity: 0.9,
              marginBottom: 5
            }}
          >
            المبلغ الحالي المستحق للمدير
          </div>

          <div
            style={{
              fontSize: 25,
              fontWeight: 900
            }}
          >
            {formatNumber(currentDebt)}
            {' '}
            <span
              style={{
                fontSize: 13,
                fontWeight: 500
              }}
            >
              ر.ي
            </span>
          </div>

        </div>

        {/* المخزون */}

        <div
          className="panel"
          style={{
            background: '#FFFFFF',
            border:
              '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16
          }}
        >

          <h3
            style={{
              margin:
                '0 0 12px 0',
              fontSize: 15,
              fontWeight: 900,
              color: '#0F172A'
            }}
          >
            المخزون الحالي
          </h3>

          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems:
                'center',
              background: '#F8FAFC',
              padding: '12px 14px',
              borderRadius: 12,
              border:
                '1px solid #E2E8F0'
            }}
          >

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#475569'
                }}
              >
                الكروت المتبقية لديك
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: '#0F172A',
                  marginTop: 4
                }}
              >
                {myCards.length}
                {' '}
                كرت
              </div>
            </div>

            <div
              style={{
                textAlign: 'left'
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#64748B'
                }}
              >
                القيمة الإجمالية
              </div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: '#2563EB',
                  marginTop: 4
                }}
              >
                {formatNumber(
                  inventoryValue
                )}
                {' '}
                ر.ي
              </div>
            </div>

          </div>

        </div>

        {/* ملخص الباقات */}

        <div
          className="panel"
          style={{
            background: '#FFFFFF',
            border:
              '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16
          }}
        >

          <h3
            style={{
              margin:
                '0 0 12px 0',
              fontSize: 15,
              fontWeight: 900,
              color: '#0F172A'
            }}
          >
            ملخص الباقات المباعة
          </h3>

          {Object.keys(
            salesByPackage
          ).length === 0 ? (

            <div
              style={{
                padding: '12px 0',
                textAlign: 'center',
                fontSize: 13,
                color: '#64748B'
              }}
            >
              لا توجد مبيعات في الفترة المحددة
            </div>

          ) : (

            Object.entries(
              salesByPackage
            ).map(
              ([name, data]) => (

                <div
                  key={name}
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    padding: '11px 0',
                    borderBottom:
                      '1px solid #F1F5F9'
                  }}
                >

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#334155'
                    }}
                  >
                    {name}
                  </div>

                  <div
                    style={{
                      textAlign: 'left'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: '#0F172A'
                      }}
                    >
                      {data.count}
                      {' '}
                      كرت
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#059669',
                        marginTop: 2
                      }}
                    >
                      {formatNumber(
                        data.revenue
                      )}
                      {' '}
                      ر.ي
                    </div>
                  </div>

                </div>

              )
            )

          )}

        </div>

        {/* سجل المبيعات */}

        <div
          className="panel"
          style={{
            background: '#FFFFFF',
            border:
              '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20
          }}
        >

          <h3
            style={{
              margin:
                '0 0 12px 0',
              fontSize: 15,
              fontWeight: 900,
              color: '#0F172A'
            }}
          >
            سجل المبيعات
          </h3>

          {dataLoading ? (

            <div
              style={{
                textAlign: 'center',
                padding: 20,
                fontSize: 13,
                color: '#64748B'
              }}
            >
              جاري تحميل التقرير...
            </div>

          ) : filteredSales.length === 0 ? (

            <div
              style={{
                textAlign: 'center',
                padding: 16,
                fontSize: 13,
                color: '#64748B'
              }}
            >
              لا توجد عمليات بيع في الفترة المحددة
            </div>

          ) : (

            filteredSales.map(
              (item) => (

                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    padding: '12px 0',
                    borderBottom:
                      '1px solid #F1F5F9'
                  }}
                >

                  <div>

                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 13,
                        color: '#0F172A'
                      }}
                    >
                      {item.package_name}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: '#059669',
                        fontWeight: 700,
                        marginTop: 3
                      }}
                    >
                      {formatNumber(
                        item.price
                      )}
                      {' '}
                      ر.ي
                    </div>

                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      background: '#F1F5F9',
                      padding: '6px 9px',
                      borderRadius: 8
                    }}
                  >
                    {formatNumericDate(
                      item.sold_at
                    )}
                  </div>

                </div>

              )
            )

          )}

        </div>

      </div>

    </div>
  );
}
