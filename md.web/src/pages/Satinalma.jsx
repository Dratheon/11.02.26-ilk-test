import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { getPurchaseOrdersFromAPI, getSuppliersFromAPI } from '../services/dataService';

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);

const Satinalma = () => {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [po, supplierList] = await Promise.all([getPurchaseOrdersFromAPI(), getSuppliersFromAPI()]);
        setOrders(po);
        setSuppliers(supplierList);
      } catch (err) {
        setError(err.message || 'Satınalma verisi alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = useMemo(() => {
    const waiting = orders.filter((po) => po.status?.toLowerCase().includes('onay') || po.status === 'draft').length;
    const inTransit = orders.filter((po) => po.status?.toLowerCase().includes('yolda') || ['sent', 'partial'].includes(po.status)).length;
    const completed = orders.filter((po) => po.status === 'delivered').length;
    const supplierCount = suppliers.length;

    return { total: orders.length, waiting, inTransit, completed, supplierCount };
  }, [orders, suppliers]);

  if (loading) return <Loader text="Satınalma verisi yükleniyor..." />;

  return (
    <div>
      <PageHeader 
        title="Satınalma" 
        subtitle="Tedarik siparişleri, tedarikçiler ve talepler yönetimi"
      />

      {error && (
        <div className="card error-card" style={{ marginBottom: 16 }}>
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Veri alınamadı
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <StatusIcon icon="shopping_cart" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Toplam Sipariş</div>
            <div className="kpi-value">{formatNumber(summary.total)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="hourglass_empty" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Bekleyen</div>
            <div className="kpi-value">{formatNumber(summary.waiting)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="local_shipping" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Yolda</div>
            <div className="kpi-value">{formatNumber(summary.inTransit)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <StatusIcon icon="check_circle" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tamamlanan</div>
            <div className="kpi-value">{formatNumber(summary.completed)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
            <StatusIcon icon="business" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tedarikçi</div>
            <div className="kpi-value">{formatNumber(summary.supplierCount)}</div>
          </div>
        </div>
      </div>

      {/* Hızlı Bağlantılar */}
      <div className="grid grid-4" style={{ marginTop: 24, gap: 16 }}>
        <a href="/satinalma/siparisler" className="card subtle-card" style={{ padding: 20, textAlign: 'center', textDecoration: 'none' }}>
          <StatusIcon icon="receipt_long" style={{ fontSize: 32, color: 'var(--color-primary)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>Siparişler</div>
          <div className="text-muted" style={{ fontSize: 12 }}>Tedarik siparişi oluştur ve takip et</div>
        </a>
        <a href="/satinalma/tedarikciler" className="card subtle-card" style={{ padding: 20, textAlign: 'center', textDecoration: 'none' }}>
          <StatusIcon icon="groups" style={{ fontSize: 32, color: 'var(--color-success)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>Tedarikçiler</div>
          <div className="text-muted" style={{ fontSize: 12 }}>Tedarikçi ve bayi yönetimi</div>
        </a>
        <a href="/satinalma/bekleyen" className="card subtle-card" style={{ padding: 20, textAlign: 'center', textDecoration: 'none' }}>
          <StatusIcon icon="pending_actions" style={{ fontSize: 32, color: 'var(--color-warning)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>Bekleyen Teslimat</div>
          <div className="text-muted" style={{ fontSize: 12 }}>Teslim alınmamış ürünler</div>
        </a>
        <a href="/satinalma/eksik" className="card subtle-card" style={{ padding: 20, textAlign: 'center', textDecoration: 'none' }}>
          <StatusIcon icon="warning" style={{ fontSize: 32, color: 'var(--color-danger)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>Eksik Ürünler</div>
          <div className="text-muted" style={{ fontSize: 12 }}>Kritik stok altındaki ürünler</div>
        </a>
      </div>
    </div>
  );
};

export default Satinalma;
