import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { getRequests } from '../services/dataService';

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  } catch {
    return dateStr;
  }
};

const STATUS_CONFIG = {
  'Bekliyor': { tone: 'warning', icon: 'hourglass_empty' },
  'Onaylandı': { tone: 'success', icon: 'check_circle' },
  'Reddedildi': { tone: 'danger', icon: 'cancel' },
  'Siparişte': { tone: 'info', icon: 'local_shipping' },
  'Tamamlandı': { tone: 'success', icon: 'task_alt' },
};

const SatinalmaTalepler = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getRequests();
        setRows(payload);
      } catch (err) {
        setError(err.message || 'Talepler alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredRows = useMemo(() => {
    let data = [...rows];
    const query = search.trim().toLowerCase();

    if (query) {
      data = data.filter(
        (r) =>
          (r.id || '').toLowerCase().includes(query) ||
          (r.requester || '').toLowerCase().includes(query) ||
          (r.item || '').toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      data = data.filter((r) => r.status === statusFilter);
    }

    return data;
  }, [rows, search, statusFilter]);

  const summary = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.status === 'Bekliyor').length;
    const approved = rows.filter((r) => r.status === 'Onaylandı' || r.status === 'Siparişte').length;
    const completed = rows.filter((r) => r.status === 'Tamamlandı').length;
    return { total, pending, approved, completed };
  }, [rows]);

  return (
    <div>
      <PageHeader 
        title="Malzeme Talepleri" 
        subtitle="Departmanlardan gelen malzeme talepleri"
      />

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div 
          className={`kpi-card ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <StatusIcon icon="inbox" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Toplam Talep</div>
            <div className="kpi-value">{formatNumber(summary.total)}</div>
          </div>
        </div>

        <div 
          className={`kpi-card ${statusFilter === 'Bekliyor' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'Bekliyor' ? 'all' : 'Bekliyor')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="hourglass_empty" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Bekleyen</div>
            <div className="kpi-value">{formatNumber(summary.pending)}</div>
          </div>
        </div>

        <div 
          className={`kpi-card ${statusFilter === 'Onaylandı' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'Onaylandı' ? 'all' : 'Onaylandı')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="thumb_up" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Onaylanan</div>
            <div className="kpi-value">{formatNumber(summary.approved)}</div>
          </div>
        </div>

        <div 
          className={`kpi-card ${statusFilter === 'Tamamlandı' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'Tamamlandı' ? 'all' : 'Tamamlandı')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <StatusIcon icon="task_alt" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tamamlanan</div>
            <div className="kpi-value">{formatNumber(summary.completed)}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <StatusIcon icon="search" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
          <input
            type="search"
            placeholder="Talep no, talep eden, kalem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 300, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
          />
        </div>

        <div className="filter-toggle-group">
          {Object.keys(STATUS_CONFIG).map((status) => (
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
          {filteredRows.length} / {rows.length}
        </span>
      </div>

      {/* Hata Mesajı */}
      {error && (
        <div className="card error-card" style={{ marginBottom: 16 }}>
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Talepler alınamadı
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <Loader text="Talepler yükleniyor..." />
      ) : filteredRows.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <StatusIcon icon="inbox" style={{ fontSize: 48, color: 'var(--color-text-secondary)', marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>Talep Bulunamadı</h3>
          <p className="text-muted">Henüz malzeme talebi yok veya filtrelere uygun talep bulunamadı.</p>
        </div>
      ) : (
        <div className="card">
          <DataTable
            columns={[
              {
                label: 'Talep No',
                accessor: 'id',
                render: (val) => <strong>{val}</strong>,
              },
              {
                label: 'Talep Eden',
                accessor: 'requester',
                render: (val) => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="person" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
                    {val}
                  </span>
                ),
              },
              {
                label: 'Kalem',
                accessor: 'item',
                render: (val) => val || '-',
              },
              {
                label: 'Miktar',
                accessor: 'qty',
                render: (val) => formatNumber(val),
              },
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
                label: 'İhtiyaç Tarihi',
                accessor: 'neededDate',
                render: (val) => {
                  if (!val) return '-';
                  const isOverdue = new Date(val) < new Date();
                  return (
                    <span style={{ 
                      color: isOverdue ? 'var(--color-danger)' : 'inherit',
                      fontWeight: isOverdue ? 600 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      {isOverdue && <StatusIcon icon="warning" style={{ fontSize: 14 }} />}
                      {formatDate(val)}
                    </span>
                  );
                },
              },
            ]}
            rows={filteredRows}
            emptyText="Talep bulunamadı"
          />
        </div>
      )}
    </div>
  );
};

export default SatinalmaTalepler;
