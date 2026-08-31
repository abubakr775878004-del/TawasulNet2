'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

function getDateKey(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthKey(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function getYearKey(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return '';

  return String(date.getFullYear());
}

function getCurrentDate() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');
}

function getCurrentMonth() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0')
  ].join('-');
}

function getCurrentYear() {
  return String(new Date().getFullYear());
}

export default function ReportsPage() {
  const { profile, loading } = useProfile('admin');

  const [distributors, setDistributors] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [dataLoading, setDataLoading] = useState(true);

  const [reportType, setReportType] = useState('month');

  const [selectedDay, setSelectedDay] =
    useState(getCurrentDate());

  const [selectedMonth, setSelectedMonth] =
    useState(getCurrentMonth());

  const [selectedYear, setSelectedYear] =
    useState(getCurrentYear());

  async function loadReport() {
    if (!profile) return;

    setDataLoading(true);

    try {
      /*
       * الموزعون:
       *
       * debt_balance هو الرصيد الرسمي الحالي
       * للدين في النظام.
       *
       * لا نقوم بإعادة حساب الدين من المبيعات
       * أو السدادات داخل صفحة التقارير.
       */
      const {
        data: distributorData,
        error: distributorError
      } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          debt_balance,
          commission_rate
        `)
        .eq('role', 'distributor')
        .order('full_name', {
          ascending: true
        });

      if (distributorError) {
        throw distributorError;
      }

      /*
       * المبيعات الفعلية فقط.
       *
       * لا يتم احتساب with_distributor
       * أو available كمبيعات.
       */
      const {
        data: salesData,
        error: salesError
      } = await supabase
        .from('cards')
        .select(`
          id,
          assigned_to,
          status,
          sold_at,
          packages (
            name,
            price
          )
        `)
        .eq('status', 'sold')
        .order('sold_at', {
          ascending: false
        });

      if (salesError) {
        throw salesError;
      }

      /*
       * المخزون الحالي لدى الموزعين.
       *
       * with_distributor فقط.
       */
      const {
        data: inventoryData,
        error: inventoryError
      } = await supabase
        .from('cards')
        .select(`
          id,
          assigned_to,
          status,
          packages (
            name,
            price
          )
        `)
        .eq('status', 'with_distributor');

      if (inventoryError) {
        throw inventoryError;
      }

      setDistributors(distributorData || []);
      setSales(salesData || []);
      setInventory(inventoryData || []);
    } catch (error) {
      console.error(
        'Manager reports error:',
        error
      );

      setDistributors([]);
      setSales([]);
      setInventory([]);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (profile) {
      loadReport();
    }
  }, [profile]);

  /*
   * المبيعات الخاصة بالفترة المختارة.
   */
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
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
    sales,
    reportType,
    selectedDay,
    selectedMonth,
    selectedYear
  ]);

  /*
   * بناء تقرير كل موزع.
   */
  const rows = useMemo(() => {
    const map = {};

    /*
     * إنشاء سجل لكل موزع حتى يظهر
     * حتى لو لم تكن لديه مبيعات.
     */
    distributors.forEach((distributor) => {
      map[distributor.id] = {
        id: distributor.id,
        name:
          distributor.full_name ||
          'موزع بدون اسم',

        commissionRate:
          Number(
            distributor.commission_rate ?? 10
          ),

        /*
         * هذا هو الدين الرسمي.
         *
         * لا يتم حسابه من المبيعات.
         */
        currentDebt:
          Number(
            distributor.debt_balance ?? 0
          ),

        salesCount: 0,
        salesValue: 0,

        inventoryCount: 0,
        inventoryValue: 0
      };
    });

    /*
     * المبيعات للفترة المختارة.
     */
    filteredSales.forEach((sale) => {
      if (
        !sale.assigned_to ||
        !map[sale.assigned_to]
      ) {
        return;
      }

      const price = Number(
        sale.packages?.price || 0
      );

      map[sale.assigned_to].salesCount += 1;

      map[sale.assigned_to].salesValue += price;
    });

    /*
     * المخزون الحالي.
     */
    inventory.forEach((card) => {
      if (
        !card.assigned_to ||
        !map[card.assigned_to]
      ) {
        return;
      }

      const price = Number(
        card.packages?.price || 0
      );

      map[card.assigned_to].inventoryCount += 1;

      map[card.assigned_to].inventoryValue += price;
    });

    /*
     * حصة المدير حسب نسبة العمولة
     * المخزنة للموزع.
     */
    Object.values(map).forEach((row) => {
      row.distributorCommission =
        row.salesValue *
        (row.commissionRate / 100);

      row.managerShare =
        row.salesValue -
        row.distributorCommission;
    });

    /*
     * ترتيب الموزعين حسب المبيعات.
     */
    return Object.values(map).sort(
      (a, b) =>
        b.salesValue -
        a.salesValue
    );
  }, [
    distributors,
    filteredSales,
    inventory
  ]);

  /*
   * إجماليات الشبكة.
   */
  const networkSummary = useMemo(() => {
    const salesCount =
      filteredSales.length;

    const salesValue =
      filteredSales.reduce(
        (sum, sale) =>
          sum +
          Number(
            sale.packages?.price || 0
          ),
        0
      );

    const managerShare =
      rows.reduce(
        (sum, row) =>
          sum +
          Number(row.managerShare || 0),
        0
      );

    const distributorCommission =
      rows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.distributorCommission || 0
          ),
        0
      );

    const currentDebt =
      rows.reduce(
        (sum, row) =>
          sum +
          Number(row.currentDebt || 0),
        0
      );

    const inventoryCount =
      rows.reduce(
        (sum, row) =>
          sum +
          Number(row.inventoryCount || 0),
        0
      );

    const inventoryValue =
      rows.reduce(
        (sum, row) =>
          sum +
          Number(row.inventoryValue || 0),
        0
      );

    return {
      salesCount,
      salesValue,
      managerShare,
      distributorCommission,
      currentDebt,
      inventoryCount,
      inventoryValue
    };
  }, [filteredSales, rows]);

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
        role="admin"
        active="/admin/reports"
        name={profile.full_name}
      />

      <div
        className="main"
        style={{
          paddingBottom: 50
        }}
      >

        {/* رأس الصفحة */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
            marginBottom: 24
          }}
        >

          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: '#0F172A',
                margin: 0,
                marginBottom: 8
              }}
            >
              تقارير المدير
            </h1>

            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#64748B'
              }}
            >
              تقرير شامل لجميع الموزعين والمبيعات
              والدين الحالي والمخزون
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="no-print"
            style={{
              padding: '13px 20px',
              borderRadius: 12,
              border:
                '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontWeight: 900,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            🖨️ طباعة / PDF
          </button>

        </div>

        {/* اختيار التقرير */}

        <div
          className="no-print"
          style={{
            background: '#FFFFFF',
            border:
              '1px solid #E2E8F0',
            borderRadius: 18,
            padding: 20,
            marginBottom: 24
          }}
        >

          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: '#0F172A',
              marginBottom: 14
            }}
          >
            الفترة الزمنية
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(3, minmax(0, 1fr))',
              gap: 12
            }}
          >

            {[
              ['day', 'يومي'],
              ['month', 'شهري'],
              ['year', 'سنوي']
            ].map(([type, label]) => (
              <button
                key={type}
                onClick={() =>
                  setReportType(type)
                }
                style={{
                  minHeight: 54,
                  borderRadius: 12,
                  border:
                    reportType === type
                      ? '2px solid #0F766E'
                      : '1px solid #CBD5E1',
                  background:
                    reportType === type
                      ? '#F0FDFA'
                      : '#FFFFFF',
                  color:
                    reportType === type
                      ? '#0F766E'
                      : '#334155',
                  fontSize: 15,
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                {label}
              </button>
            ))}

          </div>

          <div
            style={{
              marginTop: 14
            }}
          >

            {reportType === 'day' && (
              <input
                type="date"
                value={selectedDay}
                onChange={(event) =>
                  setSelectedDay(
                    event.target.value
                  )
                }
                style={{
                  width: '100%',
                  minHeight: 52,
                  padding: '0 14px',
                  borderRadius: 12,
                  border:
                    '1px solid #CBD5E1',
                  fontSize: 15,
                  fontWeight: 800,
                  background: '#F8FAFC'
                }}
              />
            )}

            {reportType === 'month' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) =>
                  setSelectedMonth(
                    event.target.value
                  )
                }
                style={{
                  width: '100%',
                  minHeight: 52,
                  padding: '0 14px',
                  borderRadius: 12,
                  border:
                    '1px solid #CBD5E1',
                  fontSize: 15,
                  fontWeight: 800,
                  background: '#F8FAFC'
                }}
              />
            )}

            {reportType === 'year' && (
              <select
                value={selectedYear}
                onChange={(event) =>
                  setSelectedYear(
                    event.target.value
                  )
                }
                style={{
                  width: '100%',
                  minHeight: 52,
                  padding: '0 14px',
                  borderRadius: 12,
                  border:
                    '1px solid #CBD5E1',
                  fontSize: 15,
                  fontWeight: 800,
                  background: '#F8FAFC'
                }}
              >
                {Array.from(
                  {
                    length: 7
                  },
                  (_, index) =>
                    String(
                      new Date().getFullYear() -
                        3 +
                        index
                    )
                ).map((year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                ))}
              </select>
            )}

          </div>

        </div>

        {/* الفترة الحالية */}

        <div
          style={{
            background: '#F8FAFC',
            border:
              '1px solid #E2E8F0',
            borderRadius: 14,
            padding: '14px 18px',
            marginBottom: 24,
            fontSize: 15,
            fontWeight: 800,
            color: '#475569'
          }}
        >
          التقرير الحالي:
          <span
            style={{
              color: '#0F172A',
              marginRight: 8
            }}
          >
            {reportTitle}
          </span>
        </div>

        {/* ملخص الشبكة */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 28
          }}
        >

          <SummaryCard
            title="المبيعات الفعلية"
            value={networkSummary.salesCount}
            suffix="كرت"
            background="#EFF6FF"
            border="#BFDBFE"
            valueColor="#1D4ED8"
          />

          <SummaryCard
            title="قيمة المبيعات"
            value={formatNumber(
              networkSummary.salesValue
            )}
            suffix="ر.ي"
            background="#F5F3FF"
            border="#DDD6FE"
            valueColor="#6D28D9"
          />

          <SummaryCard
            title="حصة المدير"
            value={formatNumber(
              networkSummary.managerShare
            )}
            suffix="ر.ي"
            background="#FFF7ED"
            border="#FED7AA"
            valueColor="#C2410C"
          />

          <SummaryCard
            title="الدين الحالي للموزعين"
            value={formatNumber(
              networkSummary.currentDebt
            )}
            suffix="ر.ي"
            background={
              networkSummary.currentDebt > 0
                ? '#FEF2F2'
                : '#ECFDF5'
            }
            border={
              networkSummary.currentDebt > 0
                ? '#FCA5A5'
                : '#A7F3D0'
            }
            valueColor={
              networkSummary.currentDebt > 0
                ? '#DC2626'
                : '#059669'
            }
          />

        </div>

        {/* جدول الموزعين */}

        <div
          style={{
            background: '#FFFFFF',
            border:
              '1px solid #E2E8F0',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow:
              '0 4px 12px rgba(15,23,42,0.04)'
          }}
        >

          <div
            style={{
              padding: '20px 24px',
              background: '#F8FAFC',
              borderBottom:
                '1px solid #E2E8F0',
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >

            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 19,
                  fontWeight: 900,
                  color: '#0F172A'
                }}
              >
                جميع الموزعين
              </h2>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 13,
                  color: '#64748B',
                  fontWeight: 700
                }}
              >
                الدين المعروض هو الرصيد الرسمي
                المسجل في حساب كل موزع
              </div>
            </div>

            <div
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                background: '#E2E8F0',
                color: '#334155',
                fontSize: 13,
                fontWeight: 900
              }}
            >
              {rows.length} موزع
            </div>

          </div>

          {dataLoading ? (

            <div
              style={{
                padding: 50,
                textAlign: 'center',
                color: '#64748B',
                fontSize: 15,
                fontWeight: 800
              }}
            >
              جاري تحميل التقارير...
            </div>

          ) : rows.length === 0 ? (

            <div
              style={{
                padding: 50,
                textAlign: 'center',
                color: '#64748B',
                fontSize: 15,
                fontWeight: 800
              }}
            >
              لا يوجد موزعون حاليًا
            </div>

          ) : (

            <div
              style={{
                display: 'flex',
                flexDirection: 'column'
              }}
            >

              {rows.map((row, index) => (

                <div
                  key={row.id}
                  style={{
                    padding: '24px',
                    borderTop:
                      index === 0
                        ? 'none'
                        : '1px solid #E2E8F0'
                  }}
                >

                  {/* اسم الموزع */}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 18
                    }}
                  >

                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: '#0F766E',
                        flexShrink: 0
                      }}
                    />

                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        color: '#0F172A'
                      }}
                    >
                      {row.name}
                    </div>

                  </div>

                  {/* بيانات الموزع */}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: 16
                    }}
                  >

                    {/* المبيعات */}

                    <ReportBox
                      title="المبيعات الفعلية"
                      description={`خلال الفترة: ${reportTitle}`}
                      value={row.salesCount}
                      suffix="كرت"
                      secondary={`${formatNumber(
                        row.salesValue
                      )} ر.ي`}
                      background="#F0FDF4"
                      border="#BBF7D0"
                      titleColor="#166534"
                      valueColor="#059669"
                    />

                    {/* حصة المدير */}

                    <ReportBox
                      title="حصة المدير"
                      description={`بعد عمولة الموزع ${row.commissionRate}%`}
                      value={formatNumber(
                        row.managerShare
                      )}
                      suffix="ر.ي"
                      background="#FFF7ED"
                      border="#FED7AA"
                      titleColor="#9A3412"
                      valueColor="#C2410C"
                    />

                    {/* الدين الرسمي */}

                    <ReportBox
                      title="الدين الحالي"
                      description="الرصيد الرسمي من حساب الموزع"
                      value={formatNumber(
                        row.currentDebt
                      )}
                      suffix="ر.ي"
                      background={
                        row.currentDebt > 0
                          ? '#FEF2F2'
                          : '#F0FDF4'
                      }
                      border={
                        row.currentDebt > 0
                          ? '#FCA5A5'
                          : '#BBF7D0'
                      }
                      titleColor={
                        row.currentDebt > 0
                          ? '#991B1B'
                          : '#166534'
                      }
                      valueColor={
                        row.currentDebt > 0
                          ? '#DC2626'
                          : '#059669'
                      }
                    />

                    {/* المخزون */}

                    <ReportBox
                      title="المخزون الحالي"
                      description="كروت لم يتم بيعها بعد"
                      value={row.inventoryCount}
                      suffix="كرت"
                      secondary={`${formatNumber(
                        row.inventoryValue
                      )} ر.ي`}
                      background="#F8FAFC"
                      border="#E2E8F0"
                      titleColor="#475569"
                      valueColor="#0F172A"
                    />

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: #ffffff !important;
          }

          .app {
            background: #ffffff !important;
          }

          .main {
            padding: 20px !important;
          }
        }

        @media (max-width: 700px) {
          .main {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
        }
      `}</style>

    </div>
  );
}

function SummaryCard({
  title,
  value,
  suffix,
  background,
  border,
  valueColor
}) {
  return (
    <div
      style={{
        background,
        border: `1px solid ${border}`,
        borderRadius: 18,
        padding: '22px 24px',
        minHeight: 125,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >

      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: '#475569',
          marginBottom: 10
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: valueColor,
          lineHeight: 1.2
        }}
      >
        {value}

        <span
          style={{
            fontSize: 14,
            marginRight: 7,
            fontWeight: 800
          }}
        >
          {suffix}
        </span>
      </div>

    </div>
  );
}

function ReportBox({
  title,
  description,
  value,
  suffix,
  secondary,
  background,
  border,
  titleColor,
  valueColor
}) {
  return (
    <div
      style={{
        background,
        border: `1px solid ${border}`,
        borderRadius: 16,
        padding: '20px 22px',
        minHeight: 145,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >

      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: titleColor,
          marginBottom: 6
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#64748B',
          marginBottom: 12,
          lineHeight: 1.5
        }}
      >
        {description}
      </div>

      <div
        style={{
          fontSize: 25,
          fontWeight: 900,
          color: valueColor
        }}
      >
        {value}

        <span
          style={{
            fontSize: 13,
            marginRight: 7,
            fontWeight: 800
          }}
        >
          {suffix}
        </span>
      </div>

      {secondary && (
        <div
          style={{
            marginTop: 8,
            fontSize: 15,
            fontWeight: 900,
            color: '#334155'
          }}
        >
          {secondary}
        </div>
      )}

    </div>
  );
}
