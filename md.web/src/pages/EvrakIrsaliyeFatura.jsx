import { useEffect, useState, useMemo } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { getDocuments, getDocumentDownloadUrl, getSuppliersFromAPI } from '../services/dataService';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const EvrakIrsaliyeFatura = () => {
  const [documents, setDocuments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtreler
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [docsData, suppliersData] = await Promise.all([
        getDocuments(),
        getSuppliersFromAPI().catch(() => []),
      ]);
      setDocuments(docsData || []);
      setSuppliers(suppliersData || []);
    } catch (err) {
      setError(err.message || 'Evraklar alınamadı');
    } finally {
      setLoading(false);
    }
  };

  // Sadece irsaliye tipindeki belgeleri filtrele
  const irsaliyeDocs = useMemo(() => {
    return documents.filter(doc => doc.type === 'irsaliye');
  }, [documents]);

  // Tedarikçi adını bul
  const getSupplierName = (supplierId) => {
    if (!supplierId) return null;
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || null;
  };

  // Filtrelenmiş belgeler
  const filteredDocs = useMemo(() => {
    let data = [...irsaliyeDocs];

    // Arama
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(doc =>
        (doc.description || '').toLowerCase().includes(q) ||
        (doc.originalName || '').toLowerCase().includes(q) ||
        (doc.jobId || '').toLowerCase().includes(q) ||
        (getSupplierName(doc.supplierId) || '').toLowerCase().includes(q)
      );
    }

    // Tedarikçi filtresi
    if (supplierFilter !== 'all') {
      data = data.filter(doc => doc.supplierId === supplierFilter);
    }

    // Tarih filtresi
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate;
      if (dateFilter === 'week') {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateFilter === 'month') {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (dateFilter === '3months') {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
      }
      if (startDate) {
        data = data.filter(doc => new Date(doc.uploadedAt) >= startDate);
      }
    }

    // En yeni en üstte
    data.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return data;
  }, [irsaliyeDocs, search, supplierFilter, dateFilter, suppliers]);

  // KPI verileri
  const kpiData = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const total = irsaliyeDocs.length;
    const thisMonthCount = irsaliyeDocs.filter(d => new Date(d.uploadedAt) >= thisMonth).length;
    const withSupplier = irsaliyeDocs.filter(d => d.supplierId).length;
    const uniqueSuppliers = new Set(irsaliyeDocs.filter(d => d.supplierId).map(d => d.supplierId)).size;

    return { total, thisMonthCount, withSupplier, uniqueSuppliers };
  }, [irsaliyeDocs]);

  // İrsaliyesi olan tedarikçiler (filtre dropdown için)
  const suppliersWithDocs = useMemo(() => {
    const ids = new Set(irsaliyeDocs.filter(d => d.supplierId).map(d => d.supplierId));
    return suppliers.filter(s => ids.has(s.id));
  }, [irsaliyeDocs, suppliers]);

  return (
    <div>
      <PageHeader
        title="İrsaliye & Fatura"
        subtitle="Tedarikçi teslimat irsaliyeleri ve belgeler"
      />

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <StatusIcon icon="description" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Toplam İrsaliye</div>
            <div className="kpi-value">{kpiData.total}</div>
          </div>
        </div>

        <div 
          className={`kpi-card ${dateFilter === 'month' ? 'active' : ''}`}
          onClick={() => setDateFilter(dateFilter === 'month' ? 'all' : 'month')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <StatusIcon icon="today" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Bu Ay</div>
            <div className="kpi-value">{kpiData.thisMonthCount}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="business" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tedarikçi</div>
            <div className="kpi-value">{kpiData.uniqueSuppliers}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="link" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tedarikçiye Bağlı</div>
            <div className="kpi-value">{kpiData.withSupplier}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <StatusIcon icon="search" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
          <input
            type="search"
            placeholder="Dosya adı, açıklama, sipariş no, tedarikçi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 350, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
          />
        </div>

        <select
          className="form-select"
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="all">Tüm Tedarikçiler</option>
          {suppliersWithDocs.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="filter-toggle-group">
          {[
            { key: 'week', label: 'Son 7 Gün' },
            { key: 'month', label: 'Bu Ay' },
            { key: '3months', label: 'Son 3 Ay' },
          ].map(opt => (
            <button
              key={opt.key}
              className={`filter-toggle-btn ${dateFilter === opt.key ? 'active' : ''}`}
              onClick={() => setDateFilter(dateFilter === opt.key ? 'all' : opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {filteredDocs.length} / {irsaliyeDocs.length}
        </span>
      </div>

      {/* Hata */}
      {error && (
        <div className="card error-card" style={{ marginBottom: 16 }}>
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Evraklar alınamadı
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <Loader text="İrsaliyeler yükleniyor..." />
      ) : filteredDocs.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <StatusIcon icon="description" style={{ fontSize: 48, color: 'var(--color-text-secondary)', marginBottom: 16, display: 'block' }} />
          <h3 style={{ marginBottom: 8 }}>
            {irsaliyeDocs.length === 0 ? 'Henüz İrsaliye Yok' : 'Sonuç Bulunamadı'}
          </h3>
          <p className="text-muted" style={{ fontSize: 13 }}>
            {irsaliyeDocs.length === 0
              ? 'Satınalma siparişlerinde teslimat kaydederken irsaliye yükleyebilirsiniz.'
              : 'Farklı bir filtre deneyin.'}
          </p>
        </div>
      ) : (
        <div className="card">
          <DataTable
            columns={[
              {
                label: 'Tarih',
                accessor: 'uploadedAt',
                render: (val) => (
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{formatDate(val)}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                      {new Date(val).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ),
              },
              {
                label: 'İrsaliye',
                accessor: 'originalName',
                render: (val, row) => (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon="description" style={{ fontSize: 16, color: 'var(--color-primary)' }} />
                      {val}
                    </div>
                    {row.description && (
                      <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{row.description}</div>
                    )}
                  </div>
                ),
              },
              {
                label: 'Tedarikçi',
                accessor: 'supplierId',
                render: (val) => {
                  const name = getSupplierName(val);
                  return name ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon="business" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
                      {name}
                    </span>
                  ) : <span className="text-muted">-</span>;
                },
              },
              {
                label: 'Sipariş',
                accessor: 'jobId',
                render: (val) => val ? (
                  <code style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="receipt_long" style={{ fontSize: 12 }} />
                    {val.startsWith('PO-') ? val : `#${val.slice(-6)}`}
                  </code>
                ) : <span className="text-muted">-</span>,
              },
              {
                label: 'Boyut',
                accessor: 'size',
                render: (val) => (
                  <span className="text-muted" style={{ fontSize: 12 }}>{formatFileSize(val)}</span>
                ),
              },
              {
                label: 'İşlem',
                accessor: 'actions',
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a
                      href={getDocumentDownloadUrl(row.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-small btn-icon"
                      title="Görüntüle"
                    >
                      <StatusIcon icon="visibility" style={{ fontSize: 16 }} />
                    </a>
                    <a
                      href={getDocumentDownloadUrl(row.id)}
                      download
                      className="btn btn-secondary btn-small btn-icon"
                      title="İndir"
                    >
                      <StatusIcon icon="download" style={{ fontSize: 16 }} />
                    </a>
                  </div>
                ),
              },
            ]}
            rows={filteredDocs}
            getKey={(row) => row.id}
          />
        </div>
      )}
    </div>
  );
};

export default EvrakIrsaliyeFatura;
