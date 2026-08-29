  async function loadReport() {
    setBusy(true);

    let filterTime = null;
    if (filter === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      filterTime = d.getTime();
    } else if (filter === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      filterTime = d.getTime();
    }

    const [{ data: distributors }, { data: allCards }, { data: payments }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'distributor'),
      supabase.from('cards').select('assigned_to, status, updated_at, created_at, packages(price)').not('assigned_to', 'is', null),
      supabase.from('payments').select('distributor_id, amount')
    ]);

    const paymentsMap = {};
    (payments || []).forEach((p) => {
      paymentsMap[p.distributor_id] = (paymentsMap[p.distributor_id] || 0) + Number(p.amount || 0);
    });

    const map = {};
    (distributors || []).forEach((d) => {
      map[d.id] = { 
        name: d.full_name, 
        heldCount: 0, 
        heldValue: 0, 
        salesCount: 0, 
        salesValue: 0,
        totalSalesAllTime: 0,
        totalPaid: paymentsMap[d.id] || 0,
        remainingDebt: Number(d.debt) || 0
      };
    });

    let netSalesCount = 0;
    let netSalesValue = 0;

    (allCards || []).forEach((c) => {
      if (!map[c.assigned_to]) return;

      const cardPrice = Number(c.packages?.price || 0);
      const st = (c.status || '').toLowerCase();

      // الكروت الموجودة بحوزته
      if (st === 'with_distributor' || st === 'available' || st === '') {
        map[c.assigned_to].heldCount += 1;
        map[c.assigned_to].heldValue += cardPrice;
      }

      // الكروت المباعة أو المستخدمة (نعتبر أي كرت ليس بحوزته أو حالته sold/used بمثابة مبيعات)
      if (st === 'sold' || st === 'used' || st === 'expired' || st === 'active') {
        // إذا كنت تريد حصر المباعة بدقة حسب منطق نظامك، يمكنك تعديل الشرط هنا
        const adminNetPriceAllTime = cardPrice * 0.90;
        map[c.assigned_to].totalSalesAllTime += adminNetPriceAllTime;

        const soldDate = new Date(c.updated_at || c.created_at || Date.now()).getTime();

        if (!filterTime || soldDate >= filterTime) {
          map[c.assigned_to].salesCount += 1;
          map[c.assigned_to].salesValue += adminNetPriceAllTime;

          netSalesCount += 1;
          netSalesValue += adminNetPriceAllTime;
        }
      }
    });

    Object.keys(map).forEach(id => {
      const dist = map[id];
      const calculatedDebt = Math.max(0, Math.round(dist.totalSalesAllTime - dist.totalPaid));
      if (calculatedDebt > 0) {
        dist.remainingDebt = calculatedDebt;
      }
    });

    setTotalNetworkSalesCount(netSalesCount);
    setTotalNetworkSalesValue(netSalesValue);

    const result = Object.values(map).sort((a, b) => b.salesValue - a.salesValue);
    setRows(result);
    setBusy(false);
  }
