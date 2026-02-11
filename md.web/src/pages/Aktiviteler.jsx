import { useState, useEffect, useMemo } from 'react';
import { getActivities, getActivitySummary, getUsers } from '../services/dataService';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';

const Aktiviteler = () => {
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtreler
  const [filters, setFilters] = useState({
    userId: '',
    targetType: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  });
  
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
  });

  useEffect(() => {
    loadData();
  }, [filters, pagination.offset, pagination.limit]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [activitiesRes, summaryRes, usersRes] = await Promise.all([
        getActivities({
          ...filters,
          limit: pagination.limit,
          offset: pagination.offset,
        }),
        getActivitySummary(7),
        getUsers().catch(() => []),
      ]);
      
      setActivities(activitiesRes.items || []);
      setPagination((p) => ({ ...p, total: activitiesRes.total || 0 }));
      setSummary(summaryRes);
      setUsers(usersRes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const targetTypeLabels = {
    job: 'İş',
    customer: 'Müşteri',
    personnel: 'Personel',
    task: 'Görev',
    stock: 'Stok',
    purchase: 'Satınalma',
    supplier: 'Tedarikçi',
    document: 'Belge',
    invoice: 'Fatura',
    payment: 'Ödeme',
    planning: 'Planlama',
    team: 'Ekip',
    auth: 'Giriş/Çıkış',
    user: 'Kullanıcı',
    settings: 'Ayarlar',
    assembly: 'Montaj',
    production: 'Üretim',
  };

  const actionLabels = {
    create: 'Oluşturma',
    update: 'Güncelleme',
    delete: 'Silme',
    view: 'Görüntüleme',
    login: 'Giriş',
    logout: 'Çıkış',
    job_create: 'İş Oluşturma',
    job_status_change: 'Durum Değişikliği',
    job_assign: 'Atama',
    upload: 'Yükleme',
    approve: 'Onaylama',
    reject: 'Reddetme',
    complete: 'Tamamlama',
    cancel: 'İptal',
    schedule: 'Planlama',
    reschedule: 'Yeniden Planlama',
    move: 'Taşıma',
  };

  const columns = [
    {
      accessor: 'timestamp',
      label: 'Tarih/Saat',
      render: (value) => {
        const date = new Date(value);
        return (
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{date.toLocaleDateString('tr-TR')}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      },
    },
    {
      accessor: 'icon',
      label: '',
      render: (value) => (
        <StatusIcon icon={value || 'assignment'} style={{ fontSize: 18 }} />
      ),
    },
    {
      accessor: 'userName',
      label: 'Kullanıcı',
      render: (value) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <StatusIcon icon="person" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
          {value || 'Sistem'}
        </span>
      ),
    },
    {
      accessor: 'action',
      label: 'İşlem',
      render: (value) => (
        <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {actionLabels[value] || value}
        </span>
      ),
    },
    {
      accessor: 'targetType',
      label: 'Alan',
      render: (value) => (
        <span className="badge badge-secondary">
          {targetTypeLabels[value] || value}
        </span>
      ),
    },
    {
      accessor: 'targetName',
      label: 'Hedef',
      render: (value, row) => (
        <div>
          {value && <div style={{ fontWeight: 500, fontSize: 13 }}>{value}</div>}
          {row.targetId && (
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
              {row.targetId}
            </div>
          )}
        </div>
      ),
    },
    {
      accessor: 'details',
      label: 'Detay',
      render: (value) => (
        <div style={{ maxWidth: 250, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {value}
        </div>
      ),
    },
  ];

  const uniqueTargetTypes = useMemo(() => {
    const types = new Set(activities.map((a) => a.targetType).filter(Boolean));
    return Array.from(types).sort();
  }, [activities]);

  const uniqueActions = useMemo(() => {
    const actions = new Set(activities.map((a) => a.action).filter(Boolean));
    return Array.from(actions).sort();
  }, [activities]);

  // Bugünkü aktivite sayısı
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return activities.filter(a => a.timestamp?.startsWith(today)).length;
  }, [activities]);

  if (loading && activities.length === 0) {
    return <Loader text="Aktiviteler yükleniyor..." />;
  }

  const hasActiveFilters = filters.userId || filters.targetType || filters.action || filters.dateFrom || filters.dateTo;

  return (
    <div>
      <PageHeader
        title="Aktivite Logları"
        subtitle="Sistem üzerindeki tüm kullanıcı hareketleri"
      />

      {error && (
        <div className="card error-card" style={{ marginBottom: 16 }}>
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Hata
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* KPI Kartları */}
      {summary && (
        <div className="kpi-cards-container">
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
              <StatusIcon icon="bar_chart" />
            </div>
            <div className="kpi-info">
              <div className="kpi-label">Son 7 Gün</div>
              <div className="kpi-value">{summary.totalActivities || 0}</div>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <StatusIcon icon="today" />
            </div>
            <div className="kpi-info">
              <div className="kpi-label">Bugün</div>
              <div className="kpi-value">{todayCount}</div>
            </div>
          </div>

          {summary.userCounts?.slice(0, 3).map((uc, idx) => (
            <div 
              key={idx} 
              className={`kpi-card ${filters.userId === uc.userId ? 'active' : ''}`}
              onClick={() => setFilters(f => ({ ...f, userId: filters.userId === uc.userId ? '' : uc.userId }))}
              style={{ cursor: 'pointer' }}
            >
              <div className="kpi-icon" style={{ background: `linear-gradient(135deg, ${['#3b82f6', '#8b5cf6', '#f59e0b'][idx]} 0%, ${['#2563eb', '#7c3aed', '#d97706'][idx]} 100%)` }}>
                <StatusIcon icon="person" />
              </div>
              <div className="kpi-info">
                <div className="kpi-label">{uc.name}</div>
                <div className="kpi-value">{uc.count}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <select
          className="form-select"
          value={filters.userId}
          onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
          style={{ width: 140 }}
        >
          <option value="">Tüm Kullanıcılar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName}</option>
          ))}
        </select>

        <select
          className="form-select"
          value={filters.targetType}
          onChange={(e) => setFilters((f) => ({ ...f, targetType: e.target.value }))}
          style={{ width: 120 }}
        >
          <option value="">Tüm Alanlar</option>
          {uniqueTargetTypes.map((t) => (
            <option key={t} value={t}>{targetTypeLabels[t] || t}</option>
          ))}
        </select>

        <select
          className="form-select"
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          style={{ width: 130 }}
        >
          <option value="">Tüm İşlemler</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>{actionLabels[a] || a}</option>
          ))}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            className="form-input"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            style={{ width: 130, padding: '6px 8px', fontSize: 13 }}
          />
          <span className="text-muted">-</span>
          <input
            type="date"
            className="form-input"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            style={{ width: 130, padding: '6px 8px', fontSize: 13 }}
          />
        </div>

        {hasActiveFilters && (
          <button 
            className="btn btn-secondary btn-small"
            onClick={() => setFilters({ userId: '', targetType: '', action: '', dateFrom: '', dateTo: '' })}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <StatusIcon icon="close" style={{ fontSize: 14 }} />
            Temizle
          </button>
        )}

        <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap', marginLeft: 'auto' }}>
          {pagination.total} kayıt
        </span>
      </div>

      {/* Aktivite Tablosu */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon="history" />
            Aktiviteler
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-small"
              disabled={pagination.offset === 0}
              onClick={() => setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
              style={{ display: 'flex', alignItems: 'center', gap: 2 }}
            >
              <StatusIcon icon="chevron_right" style={{ fontSize: 16, transform: 'rotate(180deg)' }} />
              Önceki
            </button>
            <span style={{ padding: '4px 10px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} / {pagination.total}
            </span>
            <button
              className="btn btn-secondary btn-small"
              disabled={pagination.offset + pagination.limit >= pagination.total}
              onClick={() => setPagination((p) => ({ ...p, offset: p.offset + p.limit }))}
              style={{ display: 'flex', alignItems: 'center', gap: 2 }}
            >
              Sonraki
              <StatusIcon icon="chevron_right" style={{ fontSize: 16 }} />
            </button>
          </div>
        </div>
        <div style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Loader size="small" />
            </div>
          ) : activities.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <StatusIcon icon="inbox" style={{ fontSize: 48, color: 'var(--color-text-secondary)', marginBottom: 12, display: 'block' }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Aktivite bulunamadı</div>
              <div className="text-muted" style={{ fontSize: 13 }}>Seçili filtrelere uygun kayıt yok</div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={activities}
              keyField="id"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Aktiviteler;
