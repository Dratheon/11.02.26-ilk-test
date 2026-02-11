import { useEffect, useState, useMemo } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { getPurchaseOrdersFromAPI, getSuppliersFromAPI } from '../services/dataService';

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);

const SatinalmaBekleyen = () => {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [ordersData, suppliersData] = await Promise.all([
        getPurchaseOrdersFromAPI(),
        getSuppliersFromAPI(),
      ]);
      setOrders(ordersData);
      setSuppliers(suppliersData);
    } catch (err) {
      setError(err.message || 'Veriler alınamadı');
    } finally {
      setLoading(false);
    }
  };

  // Bekleyen kalemleri çıkar
  const pendingItems = useMemo(() => {
    const items = [];

    orders
      .filter((o) => ['sent', 'partial'].includes(o.status))
      .forEach((order) => {
        order.items?.forEach((item) => {
          const remaining = item.quantity - (item.receivedQty || 0);
          if (remaining > 0) {
            items.push({
              id: `${order.id}-${item.productCode}-${item.colorCode}`,
              orderId: order.id,
              supplierId: order.supplierId,
              supplierName: order.supplierName,
              expectedDate: order.expectedDate,
              productCode: item.productCode,
              colorCode: item.colorCode,
              productName: item.productName,
              ordered: item.quantity,
              received: item.receivedQty || 0,
              remaining,
              unit: item.unit,
              status: order.status,
            });
          }
        });
      });

    return items;
  }, [orders]);

  const filteredItems = useMemo(() => {
    let data = [...pendingItems];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (i) =>
          i.orderId.toLowerCase().includes(q) ||
          i.productCode.toLowerCase().includes(q) ||
          i.productName.toLowerCase().includes(q)
      );
    }

    if (supplierFilter !== 'all') {
      data = data.filter((i) => i.supplierId === supplierFilter);
    }

    if (showOverdueOnly) {
      data = data.filter((i) => {
        if (!i.expectedDate) return false;
        return new Date(i.expectedDate) < new Date();
      });
    }

    // Beklenen tarihe göre sırala
    return data.sort((a, b) => {
      if (!a.expectedDate) return 1;
      if (!b.expectedDate) return -1;
      return new Date(a.expectedDate) - new Date(b.expectedDate);
    });
  }, [pendingItems, search, supplierFilter, showOverdueOnly]);

  const summary = useMemo(() => {
    const totalItems = pendingItems.length;
    const totalRemaining = pendingItems.reduce((sum, i) => sum + i.remaining, 0);
    const overdueCount = pendingItems.filter((i) => {
      if (!i.expectedDate) return false;
      return new Date(i.expectedDate) < new Date();
    }).length;
    const uniqueOrders = new Set(pendingItems.map((i) => i.orderId)).size;
    return { totalItems, totalRemaining, overdueCount, uniqueOrders };
  }, [pendingItems]);

  const getDaysOverdue = (date) => {
    if (!date) return null;
    const target = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div>
      <PageHeader
        title="Bekleyen Teslimatlar"
        subtitle="Gönderilmiş siparişlerdeki teslim alınmamış ürünler"
      />

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <StatusIcon icon="inventory_2" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Bekleyen Kalem</div>
            <div className="kpi-value">{formatNumber(summary.totalItems)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="receipt_long" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Açık Sipariş</div>
            <div className="kpi-value">{formatNumber(summary.uniqueOrders)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="pending" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Toplam Bekleyen</div>
            <div className="kpi-value">{formatNumber(summary.totalRemaining)}</div>
          </div>
        </div>

        <div 
          className={`kpi-card ${showOverdueOnly ? 'active' : ''}`}
          onClick={() => setShowOverdueOnly(!showOverdueOnly)}
          style={{ cursor: 'pointer', background: summary.overdueCount > 0 ? 'var(--color-danger-bg)' : undefined }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <StatusIcon icon="warning" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Gecikmiş</div>
            <div className="kpi-value" style={{ color: summary.overdueCount > 0 ? 'var(--color-danger)' : undefined }}>
              {formatNumber(summary.overdueCount)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <StatusIcon icon="search" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
          <input
            type="search"
            placeholder="Sipariş no, ürün..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 250, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
          />
        </div>

        <select className="form-select" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} style={{ width: 150 }}>
          <option value="all">Tüm Tedarikçiler</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="filter-toggle-group">
          <button
            className={`filter-toggle-btn ${showOverdueOnly ? 'active' : ''}`}
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <StatusIcon icon="warning" style={{ fontSize: 14 }} />
            Sadece Gecikenler
          </button>
        </div>

        <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {filteredItems.length} / {pendingItems.length}
        </span>
      </div>

      {/* Hata */}
      {error && (
        <div className="card error-card" style={{ marginBottom: 16 }}>
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Hata
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {loading ? (
        <Loader text="Bekleyen teslimatlar yükleniyor..." />
      ) : pendingItems.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <StatusIcon icon="check_circle" style={{ fontSize: 48, color: 'var(--color-success)', marginBottom: 16 }} />
          <h3>Tüm Teslimatlar Tamamlandı</h3>
          <p className="text-muted">Bekleyen ürün bulunmuyor.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusIcon icon="pending_actions" />
              Bekleyen Ürünler
            </h3>
            <span className="badge badge-warning">{filteredItems.length} kalem</span>
          </div>
          <DataTable
            columns={[
              {
                label: 'Sipariş',
                accessor: 'orderId',
                render: (val) => <strong>{val}</strong>,
              },
              {
                label: 'Tedarikçi',
                accessor: 'supplierName',
                render: (val) => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="business" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
                    {val}
                  </span>
                ),
              },
              {
                label: 'Ürün',
                accessor: 'productName',
                render: (_, row) => (
                  <div>
                    <strong>{row.productCode}</strong>-{row.colorCode}
                    <div className="text-muted">{row.productName}</div>
                  </div>
                ),
              },
              {
                label: 'Sipariş',
                accessor: 'ordered',
                render: (val, row) => `${formatNumber(val)} ${row.unit}`,
              },
              {
                label: 'Teslim Alınan',
                accessor: 'received',
                render: (val) => (
                  <span style={{ color: val > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                    {formatNumber(val)}
                  </span>
                ),
              },
              {
                label: 'Kalan',
                accessor: 'remaining',
                render: (val, row) => (
                  <strong style={{ color: 'var(--color-warning)' }}>
                    {formatNumber(val)} {row.unit}
                  </strong>
                ),
              },
              {
                label: 'Beklenen Tarih',
                accessor: 'expectedDate',
                render: (val) => {
                  if (!val) return '-';
                  const daysOver = getDaysOverdue(val);
                  const overdue = daysOver > 0;
                  const today = daysOver === 0;
                  return (
                    <div>
                      <span
                        className={`badge badge-${overdue ? 'danger' : today ? 'warning' : 'secondary'}`}
                      >
                        {val}
                      </span>
                      {overdue && (
                        <div style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <StatusIcon icon="warning" style={{ fontSize: 12 }} />
                          {daysOver} gün geçti!
                        </div>
                      )}
                      {daysOver < 0 && (
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {Math.abs(daysOver)} gün kaldı
                        </div>
                      )}
                      {today && (
                        <div style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <StatusIcon icon="today" style={{ fontSize: 12 }} />
                          Bugün!
                        </div>
                      )}
                    </div>
                  );
                },
              },
              {
                label: 'Durum',
                accessor: 'status',
                render: (val) => (
                  <span className={`badge badge-${val === 'partial' ? 'warning' : 'primary'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon={val === 'partial' ? 'pie_chart' : 'hourglass_empty'} style={{ fontSize: 14 }} />
                    {val === 'partial' ? 'Kısmi' : 'Bekliyor'}
                  </span>
                ),
              },
            ]}
            rows={filteredItems}
          />
        </div>
      )}
    </div>
  );
};

export default SatinalmaBekleyen;
