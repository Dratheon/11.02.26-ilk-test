import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { getStockReservations, getJobs } from '../services/dataService';

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const STATUS_CONFIG = {
  'Aktif': { tone: 'success', icon: 'check_circle' },
  'Bekliyor': { tone: 'warning', icon: 'hourglass_empty' },
  'İptal': { tone: 'danger', icon: 'cancel' },
  'Tamamlandı': { tone: 'info', icon: 'task_alt' },
  'Kısmi': { tone: 'warning', icon: 'pie_chart' },
};

const StokRezervasyonlar = () => {
  const [reservations, setReservations] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [reservationsPayload, jobsPayload] = await Promise.all([
          getStockReservations(),
          getJobs().catch(() => []),
        ]);
        setReservations(reservationsPayload);
        setJobs(jobsPayload);
      } catch (err) {
        setError(err.message || 'Rezervasyonlar alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Özet istatistikler
  const summary = useMemo(() => {
    const total = reservations.length;
    const active = reservations.filter((r) => r.status === 'Aktif' || r.status === 'Bekliyor').length;
    const cancelled = reservations.filter((r) => r.status === 'İptal').length;
    const completed = reservations.filter((r) => r.status === 'Tamamlandı').length;
    const totalQty = reservations
      .filter((r) => r.status === 'Aktif' || r.status === 'Bekliyor')
      .reduce((sum, r) => sum + (r.qty || 0), 0);
    return { total, active, cancelled, completed, totalQty };
  }, [reservations]);

  // Filtreleme
  const filteredReservations = useMemo(() => {
    let data = [...reservations];
    const query = search.trim().toLowerCase();

    if (query) {
      data = data.filter(
        (r) =>
          (r.item || '').toLowerCase().includes(query) ||
          (r.productCode || '').toLowerCase().includes(query) ||
          (r.colorCode || '').toLowerCase().includes(query) ||
          (r.jobId || '').toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      data = data.filter((r) => r.status === statusFilter);
    }

    // En yeni en üstte
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return data;
  }, [reservations, search, statusFilter]);

  // İş bilgisini bul
  const getJobInfo = (jobId) => {
    const job = jobs.find((j) => j.id === jobId);
    return job || null;
  };

  return (
    <div>
      <PageHeader 
        title="Stok Rezervasyonları" 
        subtitle="İşlere ayrılmış stok kalemleri"
        actions={
          <a href="/stok/list" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusIcon icon="inventory_2" style={{ fontSize: 16 }} />
            Stok Listesi
          </a>
        }
      />

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div
          className={`kpi-card ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <StatusIcon icon="bookmark" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Toplam</div>
            <div className="kpi-value">{formatNumber(summary.total)}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${statusFilter === 'Aktif' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'Aktif' ? 'all' : 'Aktif')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <StatusIcon icon="check_circle" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Aktif</div>
            <div className="kpi-value">{formatNumber(summary.active)}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${statusFilter === 'Tamamlandı' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'Tamamlandı' ? 'all' : 'Tamamlandı')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="task_alt" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tamamlandı</div>
            <div className="kpi-value">{formatNumber(summary.completed)}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${statusFilter === 'İptal' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'İptal' ? 'all' : 'İptal')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <StatusIcon icon="cancel" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">İptal</div>
            <div className="kpi-value">{formatNumber(summary.cancelled)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="lock" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Rezerve Miktar</div>
            <div className="kpi-value">{formatNumber(summary.totalQty)}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <StatusIcon icon="search" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
          <input
            type="search"
            placeholder="Ürün, kod, iş..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 250, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
          />
        </div>

        <div className="filter-toggle-group">
          {['Aktif', 'Bekliyor', 'Tamamlandı', 'İptal'].map((status) => (
            <button
              key={status}
              className={`filter-toggle-btn ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            >
              {status}
            </button>
          ))}
        </div>

        <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {filteredReservations.length} / {reservations.length}
        </span>
      </div>

      {/* Hata Mesajı */}
      {error && (
        <div className="card error-card" style={{ marginBottom: 16 }}>
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Rezervasyonlar alınamadı
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <Loader text="Rezervasyonlar yükleniyor..." />
      ) : filteredReservations.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <StatusIcon icon="bookmark_border" style={{ fontSize: 48, color: 'var(--color-text-secondary)', marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>Rezervasyon Bulunamadı</h3>
          <p className="text-muted">Henüz stok rezervasyonu yapılmamış.</p>
        </div>
      ) : (
        <div className="card">
          <DataTable
            columns={[
              {
                label: 'Durum',
                accessor: 'status',
                render: (val) => {
                  const config = STATUS_CONFIG[val] || { tone: 'secondary', icon: 'help' };
                  return (
                    <span className={`badge badge-${config.tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon={config.icon} style={{ fontSize: 14 }} />
                      {val}
                    </span>
                  );
                },
              },
              {
                label: 'Ürün',
                accessor: 'item',
                render: (_, row) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{row.item}</div>
                    <div className="text-muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon="qr_code" style={{ fontSize: 12 }} />
                      {row.productCode}-{row.colorCode}
                    </div>
                  </div>
                ),
              },
              {
                label: 'İş',
                accessor: 'jobId',
                render: (val) => {
                  if (!val) return <span className="text-muted">-</span>;
                  const job = getJobInfo(val);
                  return (
                    <a href={`/isler?job=${val}`} className="link" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon="work" style={{ fontSize: 14 }} />
                      <div>
                        <div>#{val.slice(-6)}</div>
                        {job && <div className="text-muted" style={{ fontSize: 11 }}>{job.title}</div>}
                      </div>
                    </a>
                  );
                },
              },
              {
                label: 'Miktar',
                accessor: 'qty',
                render: (val, row) => (
                  <span style={{ fontWeight: 600 }}>
                    {formatNumber(val)} {row.unit}
                  </span>
                ),
              },
              {
                label: 'Oluşturulma',
                accessor: 'createdAt',
                render: (val) => (
                  <div>
                    <div>{formatDate(val)}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {new Date(val).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ),
              },
              {
                label: 'Not',
                accessor: 'note',
                render: (val) => val ? (
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {val.length > 40 ? val.substring(0, 40) + '...' : val}
                  </span>
                ) : '-',
              },
            ]}
            rows={filteredReservations}
            emptyText="Rezervasyon bulunamadı"
          />
        </div>
      )}
    </div>
  );
};

export default StokRezervasyonlar;
