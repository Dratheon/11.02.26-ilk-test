import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { getStockItems } from '../services/dataService';

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);

const getUrgencyLevel = (item) => {
  const available = (item.onHand || 0) - (item.reserved || 0);
  const critical = item.critical || 0;

  if (available <= 0) return { label: 'Tükendi', tone: 'danger', icon: 'cancel', priority: 1 };
  if (available <= critical * 0.5) return { label: 'Çok Kritik', tone: 'danger', icon: 'error', priority: 2 };
  if (available <= critical) return { label: 'Kritik', tone: 'warning', icon: 'warning', priority: 3 };
  return { label: 'Düşük', tone: 'warning', icon: 'trending_down', priority: 4 };
};

const StokKritik = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getStockItems();
        setItems(payload);
      } catch (err) {
        setError(err.message || 'Kritik stoklar alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Tüm kritik kalemler
  const criticalItems = useMemo(() => {
    return items
      .filter((item) => (item.onHand || 0) - (item.reserved || 0) <= (item.critical || 0))
      .map((item) => ({
        ...item,
        available: Math.max(0, (item.onHand || 0) - (item.reserved || 0)),
        urgency: getUrgencyLevel(item),
      }))
      .sort((a, b) => a.urgency.priority - b.urgency.priority);
  }, [items]);

  // Filtreleme
  const filteredItems = useMemo(() => {
    if (urgencyFilter === 'all') return criticalItems;
    return criticalItems.filter((item) => item.urgency.label === urgencyFilter);
  }, [criticalItems, urgencyFilter]);

  // Özet
  const summary = useMemo(() => {
    const depletedCount = criticalItems.filter((i) => i.urgency.label === 'Tükendi').length;
    const veryCriticalCount = criticalItems.filter((i) => i.urgency.label === 'Çok Kritik').length;
    const criticalCount = criticalItems.filter((i) => i.urgency.label === 'Kritik').length;
    const lowCount = criticalItems.filter((i) => i.urgency.label === 'Düşük').length;
    return { depletedCount, veryCriticalCount, criticalCount, lowCount, total: criticalItems.length };
  }, [criticalItems]);

  return (
    <div>
      <PageHeader 
        title="Kritik Stok" 
        subtitle="Kritik seviyenin altındaki kalemler - acil sipariş gerektiren ürünler"
        actions={
          <a href="/stok/list" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusIcon icon="list" style={{ fontSize: 16 }} />
            Tüm Stok
          </a>
        }
      />

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div
          className={`kpi-card ${urgencyFilter === 'all' ? 'active' : ''}`}
          onClick={() => setUrgencyFilter('all')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <StatusIcon icon="priority_high" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Toplam Kritik</div>
            <div className="kpi-value">{formatNumber(summary.total)}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${urgencyFilter === 'Tükendi' ? 'active' : ''}`}
          onClick={() => setUrgencyFilter(urgencyFilter === 'Tükendi' ? 'all' : 'Tükendi')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' }}>
            <StatusIcon icon="cancel" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tükendi</div>
            <div className="kpi-value">{formatNumber(summary.depletedCount)}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${urgencyFilter === 'Çok Kritik' ? 'active' : ''}`}
          onClick={() => setUrgencyFilter(urgencyFilter === 'Çok Kritik' ? 'all' : 'Çok Kritik')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}>
            <StatusIcon icon="error" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Çok Kritik</div>
            <div className="kpi-value">{formatNumber(summary.veryCriticalCount)}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${urgencyFilter === 'Kritik' ? 'active' : ''}`}
          onClick={() => setUrgencyFilter(urgencyFilter === 'Kritik' ? 'all' : 'Kritik')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="warning" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Kritik</div>
            <div className="kpi-value">{formatNumber(summary.criticalCount)}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${urgencyFilter === 'Düşük' ? 'active' : ''}`}
          onClick={() => setUrgencyFilter(urgencyFilter === 'Düşük' ? 'all' : 'Düşük')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' }}>
            <StatusIcon icon="trending_down" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Düşük</div>
            <div className="kpi-value">{formatNumber(summary.lowCount)}</div>
          </div>
        </div>
      </div>

      {/* Hata Mesajı */}
      {error && (
        <div className="card error-card" style={{ marginBottom: 16 }}>
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Kritik stoklar alınamadı
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <Loader text="Kritik stoklar yükleniyor..." />
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <StatusIcon icon="check_circle" style={{ fontSize: 48, color: 'var(--color-success)', marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>Kritik Stok Yok</h3>
          <p className="text-muted">Tüm stok seviyeleri sağlıklı durumda.</p>
        </div>
      ) : (
        <div className="card">
          <DataTable
            columns={[
              {
                label: 'Durum',
                accessor: 'urgency',
                render: (_, row) => (
                  <span className={`badge badge-${row.urgency.tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon={row.urgency.icon} style={{ fontSize: 14 }} />
                    {row.urgency.label}
                  </span>
                ),
              },
              {
                label: 'Ürün',
                accessor: 'name',
                render: (_, row) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{row.name}</div>
                    <div className="text-muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon="qr_code" style={{ fontSize: 12 }} />
                      {row.productCode}-{row.colorCode}
                    </div>
                  </div>
                ),
              },
              {
                label: 'Stok Durumu',
                accessor: 'onHand',
                render: (_, row) => (
                  <div>
                    <div>
                      Mevcut: <strong>{formatNumber(row.onHand || 0)}</strong>
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      Rezerve: {formatNumber(row.reserved || 0)} • Kullanılabilir: <strong style={{ color: row.available <= 0 ? 'var(--color-danger)' : 'inherit' }}>{formatNumber(row.available)}</strong>
                    </div>
                  </div>
                ),
              },
              {
                label: 'Kritik Limit',
                accessor: 'critical',
                render: (val) => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="flag" style={{ fontSize: 14, color: 'var(--color-warning)' }} />
                    {formatNumber(val || 0)}
                  </span>
                ),
              },
              {
                label: 'Eksik Miktar',
                accessor: 'shortage',
                render: (_, row) => {
                  const shortage = Math.max(0, (row.critical || 0) - row.available);
                  return (
                    <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                      +{formatNumber(shortage)} gerek
                    </span>
                  );
                },
              },
              {
                label: 'Tedarikçi',
                accessor: 'supplierName',
                render: (val) => val ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="business" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
                    {val}
                  </span>
                ) : '-',
              },
            ]}
            rows={filteredItems}
            emptyText="Kritik stok kalemi bulunamadı"
          />
        </div>
      )}
    </div>
  );
};

export default StokKritik;
