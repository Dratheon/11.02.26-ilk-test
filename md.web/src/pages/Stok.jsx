import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { getStockItems, getStockMovements } from '../services/dataService';

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR');
  } catch {
    return dateStr;
  }
};

const Stok = () => {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [stock, movement] = await Promise.all([getStockItems(), getStockMovements()]);
        setItems(stock);
        setMovements(movement);
      } catch (err) {
        setError(err.message || 'Stok verisi alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = useMemo(() => {
    const totalItems = items.length;
    const totalOnHand = items.reduce((sum, item) => sum + (item.onHand || 0), 0);
    const totalReserved = items.reduce((sum, item) => sum + (item.reserved || 0), 0);
    const criticalCount = items.filter((item) => (item.onHand || 0) - (item.reserved || 0) <= (item.critical || 0)).length;

    return { totalItems, totalOnHand, totalReserved, criticalCount };
  }, [items]);

  const recentMovements = useMemo(() => {
    return movements.slice(0, 5);
  }, [movements]);

  const getMovementIcon = (type) => {
    switch (type) {
      case 'stockIn': return { icon: 'add_circle', color: 'var(--color-success)' };
      case 'stockOut': return { icon: 'remove_circle', color: 'var(--color-danger)' };
      case 'reserve': return { icon: 'lock', color: 'var(--color-warning)' };
      case 'release': return { icon: 'lock_open', color: 'var(--color-info)' };
      case 'consume': return { icon: 'precision_manufacturing', color: 'var(--color-primary)' };
      default: return { icon: 'swap_horiz', color: 'var(--color-secondary)' };
    }
  };

  if (loading) return <Loader text="Stok verisi yükleniyor..." />;

  return (
    <div>
      <PageHeader 
        title="Stok" 
        subtitle="Stok seviyeleri ve hareketlerinin özet görünümü"
        actions={
          <a href="/stok/list" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusIcon icon="list" style={{ fontSize: 16 }} />
            Stok Listesi
          </a>
        }
      />

      {error && (
        <div className="card error-card" style={{ marginBottom: 16 }}>
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Stok verisi alınamadı
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <StatusIcon icon="inventory_2" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Ürün Çeşidi</div>
            <div className="kpi-value">{formatNumber(summary.totalItems)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <StatusIcon icon="warehouse" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Mevcut Stok</div>
            <div className="kpi-value">{formatNumber(summary.totalOnHand)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="lock" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Rezerve</div>
            <div className="kpi-value">{formatNumber(summary.totalReserved)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <StatusIcon icon="warning" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Kritik Kalem</div>
            <div className="kpi-value">{formatNumber(summary.criticalCount)}</div>
          </div>
        </div>
      </div>

      {/* Son Hareketler */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon="history" />
            Son Hareketler
          </h3>
          <a href="/stok/hareketler" className="btn btn-secondary btn-small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StatusIcon icon="visibility" style={{ fontSize: 14 }} />
            Tümünü Gör
          </a>
        </div>
        <div className="card-body">
          {recentMovements.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <StatusIcon icon="inbox" style={{ fontSize: 48, marginBottom: 8, display: 'block' }} />
              <div>Henüz stok hareketi yok</div>
            </div>
          ) : (
            recentMovements.map((movement) => {
              const moveInfo = getMovementIcon(movement.type);
              return (
                <div 
                  className="metric-row" 
                  key={movement.id} 
                  style={{ 
                    marginBottom: 12, 
                    padding: '12px 16px', 
                    background: 'var(--color-bg-secondary)', 
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <StatusIcon icon={moveInfo.icon} style={{ fontSize: 24, color: moveInfo.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {movement.productCode && <span style={{ color: 'var(--color-primary)' }}>{movement.productCode}</span>}
                      {movement.colorCode && <span style={{ color: 'var(--color-text-secondary)' }}>-{movement.colorCode}</span>}
                      {' '}{movement.item}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {movement.reason} • {formatDate(movement.date)}
                    </div>
                  </div>
                  <span 
                    style={{ 
                      fontWeight: 700, 
                      fontSize: 16,
                      color: movement.change >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                    }}
                  >
                    {movement.change >= 0 ? '+' : ''}{formatNumber(movement.change)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Hızlı Bağlantılar */}
      <div className="grid grid-4" style={{ marginTop: 24, gap: 16 }}>
        <a href="/stok/list" className="card subtle-card" style={{ padding: 20, textAlign: 'center', textDecoration: 'none' }}>
          <StatusIcon icon="list_alt" style={{ fontSize: 32, color: 'var(--color-primary)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>Stok Listesi</div>
          <div className="text-muted" style={{ fontSize: 12 }}>Tüm ürünleri görüntüle</div>
        </a>
        <a href="/stok/hareketler" className="card subtle-card" style={{ padding: 20, textAlign: 'center', textDecoration: 'none' }}>
          <StatusIcon icon="swap_horiz" style={{ fontSize: 32, color: 'var(--color-success)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>Hareketler</div>
          <div className="text-muted" style={{ fontSize: 12 }}>Giriş / Çıkış kayıtları</div>
        </a>
        <a href="/stok/kritik" className="card subtle-card" style={{ padding: 20, textAlign: 'center', textDecoration: 'none' }}>
          <StatusIcon icon="warning" style={{ fontSize: 32, color: 'var(--color-danger)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>Kritik Stok</div>
          <div className="text-muted" style={{ fontSize: 12 }}>Dikkat gereken kalemler</div>
        </a>
        <a href="/stok/rezervasyonlar" className="card subtle-card" style={{ padding: 20, textAlign: 'center', textDecoration: 'none' }}>
          <StatusIcon icon="lock" style={{ fontSize: 32, color: 'var(--color-warning)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>Rezervasyonlar</div>
          <div className="text-muted" style={{ fontSize: 12 }}>İşlere ayrılan stoklar</div>
        </a>
      </div>
    </div>
  );
};

export default Stok;
