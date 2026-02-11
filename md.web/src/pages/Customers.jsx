import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { createCustomer, getCustomers, softDeleteCustomer, updateCustomer, getJobs, getDocuments } from '../services/dataService';

// Müşteri Tipi (Manuel seçilir)
const CUSTOMER_TYPE_CONFIG = {
  'B2C': { label: 'Bireysel', icon: 'person', color: 'secondary' },
  'B2B': { label: 'Kurumsal', icon: 'business', color: 'primary' },
};

// Performans Segmenti (Otomatik hesaplanır)
const PERFORMANCE_SEGMENT_CONFIG = {
  'VIP': { label: 'VIP', icon: 'star', color: 'warning', description: 'Ciro >100K, Tahsilat >%90, 3+ iş' },
  'Normal': { label: 'Normal', icon: 'check_circle', color: 'success', description: 'Tahsilat %70-90' },
  'Riskli': { label: 'Riskli', icon: 'warning', color: 'warning', description: 'Tahsilat %50-70' },
  'Kara Liste': { label: 'Kara Liste', icon: 'block', color: 'danger', description: 'Tahsilat <%50' },
  'Yeni': { label: 'Yeni', icon: 'fiber_new', color: 'info', description: 'Henüz iş yok' },
};

// Durum badge'leri (Material Icons ile)
const STATUS_BADGES = {
  'KAPALI': { label: 'Kapandı', tone: 'success', icon: 'check_circle' },
  'URETIME_HAZIR': { label: 'Üretime Hazır', tone: 'success', icon: 'check_circle' },
  'URETIMDE': { label: 'Üretimde', tone: 'primary', icon: 'build' },
  'SONRA_URETILECEK': { label: 'Sonra Üretilecek', tone: 'info', icon: 'inventory_2' },
  'MONTAJA_HAZIR': { label: 'Montaja Hazır', tone: 'success', icon: 'check_circle' },
  'MONTAJ_TERMIN': { label: 'Montaj Terminli', tone: 'primary', icon: 'local_shipping' },
  'ANLASMA_TAMAMLANDI': { label: 'Anlaşma Tamam', tone: 'success', icon: 'check_circle' },
  'ANLASMA_YAPILIYOR': { label: 'Anlaşma Yapılıyor', tone: 'primary', icon: 'edit_note' },
  'FIYAT_VERILDI': { label: 'Fiyat Verildi', tone: 'warning', icon: 'hourglass_empty' },
  'OLCU_ALINDI': { label: 'Ölçü Alındı', tone: 'success', icon: 'straighten' },
};

const renderStatus = (status) => {
  const info = STATUS_BADGES[status];
  if (info) {
    return (
      <span className={`badge badge-${info.tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <StatusIcon icon={info.icon} style={{ fontSize: 14 }} /> {info.label}
      </span>
    );
  }
  return <span className="badge badge-secondary">{status || 'Bilinmiyor'}</span>;
};

const renderCustomerType = (segment) => {
  const config = CUSTOMER_TYPE_CONFIG[segment] || CUSTOMER_TYPE_CONFIG['B2C'];
  return (
    <span 
      className={`badge badge-${config.color}`} 
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      <StatusIcon icon={config.icon} style={{ fontSize: 14 }} /> {config.label}
    </span>
  );
};

const renderPerformanceSegment = (segment) => {
  const config = PERFORMANCE_SEGMENT_CONFIG[segment] || PERFORMANCE_SEGMENT_CONFIG['Yeni'];
  return (
    <span 
      className={`badge badge-${config.color}`} 
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      title={config.description}
    >
      <StatusIcon icon={config.icon} style={{ fontSize: 14 }} /> {config.label}
    </span>
  );
};

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // B2C, B2B, all
  const [perfFilter, setPerfFilter] = useState('all'); // VIP, Riskli, etc.
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [customerDetailModal, setCustomerDetailModal] = useState(null);
  const [jobDetailModal, setJobDetailModal] = useState(null);
  
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    segment: 'B2C', // Bireysel / Kurumsal
    location: '',
    contact: '',
    phone: '',
    phone2: '',
    address: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [customersData, jobsData, docsData] = await Promise.all([
          getCustomers(),
          getJobs(),
          getDocuments(),
        ]);
        setCustomers(customersData);
        setJobs(jobsData);
        setDocuments(docsData);
      } catch (err) {
        setError(err.message || 'Veriler alınamadı');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Müşterinin işlerini al
  const getCustomerJobs = (customerId) => {
    return jobs.filter(job => job.customerId === customerId && !job.deleted);
  };

  // İşin dökümanlarını al
  const getJobDocuments = (jobId) => {
    return documents.filter(doc => doc.jobId === jobId);
  };

  // Tek bir işin tutarını al
  const getJobAmount = (job) => {
    return job?.offer?.total || job?.approval?.paymentPlan?.total || 0;
  };

  // Tahsilat tutarını hesapla
  const getJobCollected = (job) => {
    if (!job?.approval?.paymentPlan?.payments) return 0;
    return job.approval.paymentPlan.payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  // Müşteri istatistikleri ve performans segmenti hesapla
  const getCustomerStats = (customerId) => {
    const customerJobs = getCustomerJobs(customerId);
    const closedJobs = customerJobs.filter(j => j.status === 'KAPALI').length;
    const activeJobs = customerJobs.length - closedJobs;
    const totalAmount = customerJobs.reduce((sum, j) => sum + getJobAmount(j), 0);
    const totalCollected = customerJobs.reduce((sum, j) => sum + getJobCollected(j), 0);
    const collectionRate = totalAmount > 0 ? Math.round((totalCollected / totalAmount) * 100) : 0;
    
    // Performans segmenti hesapla (backend mantığıyla aynı)
    let performanceSegment = 'Yeni';
    if (totalAmount >= 100000 && collectionRate >= 90 && closedJobs >= 3) {
      performanceSegment = 'VIP';
    } else if (collectionRate >= 70) {
      performanceSegment = 'Normal';
    } else if (collectionRate >= 50) {
      performanceSegment = 'Riskli';
    } else if (totalAmount > 0) {
      performanceSegment = 'Kara Liste';
    }
    
    return { 
      total: customerJobs.length, 
      closed: closedJobs, 
      active: activeJobs, 
      totalAmount,
      totalCollected,
      collectionRate,
      performanceSegment
    };
  };

  // Tüm müşterilerin istatistikleri (memoized)
  const customersWithStats = useMemo(() => {
    return customers.filter(c => !c.deleted).map(customer => ({
      ...customer,
      stats: getCustomerStats(customer.id)
    }));
  }, [customers, jobs]);

  // KPI Hesaplamaları
  const kpiData = useMemo(() => {
    const stats = {
      total: customersWithStats.length,
      b2c: customersWithStats.filter(c => c.segment === 'B2C' || !c.segment).length,
      b2b: customersWithStats.filter(c => c.segment === 'B2B').length,
      vip: customersWithStats.filter(c => c.stats.performanceSegment === 'VIP').length,
      normal: customersWithStats.filter(c => c.stats.performanceSegment === 'Normal').length,
      risky: customersWithStats.filter(c => c.stats.performanceSegment === 'Riskli').length,
      blacklist: customersWithStats.filter(c => c.stats.performanceSegment === 'Kara Liste').length,
      new: customersWithStats.filter(c => c.stats.performanceSegment === 'Yeni').length,
      withActiveJobs: customersWithStats.filter(c => c.stats.active > 0).length,
    };
    return stats;
  }, [customersWithStats]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      if (editing) {
        const updated = await updateCustomer(editing.id, form);
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setEditing(null);
      } else {
        const newCustomer = await createCustomer(form);
        setCustomers((prev) => [newCustomer, ...prev]);
      }
      setForm({ name: '', segment: 'B2C', location: '', contact: '', phone: '', phone2: '', address: '' });
      setShowModal(false);
    } catch (err) {
      setError(err.message || 'Müşteri kaydı başarısız');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name || '',
      segment: customer.segment || 'B2C',
      location: customer.location || '',
      contact: customer.contact || '',
      phone: customer.phone || '',
      phone2: customer.phone2 || '',
      address: customer.address || '',
    });
    setShowModal(true);
  };

  const handleSoftDelete = async (customer) => {
    try {
      await softDeleteCustomer(customer.id);
      setCustomers((prev) => prev.map((c) => (c.id === customer.id ? { ...c, deleted: true } : c)));
      setConfirmTarget(null);
      setShowModal(false);
      setEditing(null);
    } catch (err) {
      setError(err.message || 'Silme işlemi başarısız');
    }
  };

  // Filtrelenmiş müşteriler
  const filteredCustomers = useMemo(() => {
    let result = customersWithStats;
    
    // Müşteri tipi filtresi
    if (typeFilter !== 'all') {
      result = result.filter(c => c.segment === typeFilter || (!c.segment && typeFilter === 'B2C'));
    }
    
    // Performans segmenti filtresi
    if (perfFilter !== 'all') {
      if (perfFilter === 'active_jobs') {
        result = result.filter(c => c.stats.active > 0);
      } else {
        result = result.filter(c => c.stats.performanceSegment === perfFilter);
      }
    }
    
    // Arama filtresi
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(c => 
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.phone2 || '').includes(q) ||
        (c.location || '').toLowerCase().includes(q) ||
        (c.accountCode || '').toLowerCase().includes(q) ||
        (c.contact || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [customersWithStats, typeFilter, perfFilter, search]);

  // KPI kart tıklama
  const handleKPIClick = (filterType, value) => {
    if (filterType === 'type') {
      setTypeFilter(typeFilter === value ? 'all' : value);
    } else if (filterType === 'perf') {
      setPerfFilter(perfFilter === value ? 'all' : value);
    }
  };

  // Tablo kolonları
  const columns = [
    { 
      label: 'Müşteri', 
      accessor: 'name',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusIcon icon="person" style={{ fontSize: 16, color: 'var(--color-primary)' }} />
            {row.name}
          </div>
          {row.accountCode && (
            <div className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <StatusIcon icon="sell" style={{ fontSize: 12 }} /> {row.accountCode}
            </div>
          )}
        </div>
      )
    },
    { 
      label: 'Tip', 
      accessor: 'segment', 
      render: (val) => renderCustomerType(val || 'B2C') 
    },
    { 
      label: 'Performans', 
      accessor: 'performanceSegment', 
      render: (_, row) => renderPerformanceSegment(row.stats?.performanceSegment) 
    },
    { 
      label: 'Lokasyon', 
      accessor: 'location',
      render: (val) => val ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <StatusIcon icon="location_on" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
          {val}
        </span>
      ) : <span className="text-muted">-</span>
    },
    { 
      label: 'İletişim', 
      accessor: 'phone',
      render: (_, row) => (
        <div style={{ fontSize: 12 }}>
          {row.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon icon="phone" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }} /> {row.phone}
            </div>
          )}
          {row.contact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <StatusIcon icon="email" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }} /> {row.contact}
            </div>
          )}
          {!row.phone && !row.contact && <span className="text-muted">-</span>}
        </div>
      )
    },
    { 
      label: 'İşler', 
      accessor: 'jobs',
      render: (_, row) => (
        <div style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <StatusIcon icon="work" style={{ fontSize: 14, color: 'var(--color-primary)' }} />
            {row.stats?.total || 0} iş
          </span>
          {row.stats?.active > 0 && (
            <span className="text-muted" style={{ fontSize: 11 }}>
              ({row.stats.active} aktif)
            </span>
          )}
        </div>
      )
    },
    {
      label: 'Ciro / Tahsilat',
      accessor: 'revenue',
      render: (_, row) => {
        const stats = row.stats || {};
        if (!stats.totalAmount) return <span className="text-muted">-</span>;
        return (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600 }}>₺{stats.totalAmount.toLocaleString('tr-TR')}</div>
            <div style={{ 
              fontSize: 11, 
              color: stats.collectionRate >= 70 ? 'var(--color-success)' : 
                     stats.collectionRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
            }}>
              %{stats.collectionRate} tahsilat
            </div>
          </div>
        );
      }
    },
  ];

  return (
    <div>
      <PageHeader
        title="Müşteriler"
        subtitle="Müşteri listesi ve iş geçmişi"
        actions={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setEditing(null);
              setForm({ name: '', segment: 'B2C', location: '', contact: '', phone: '', phone2: '', address: '' });
              setShowModal(true);
            }}
          >
            <StatusIcon icon="person_add" style={{ fontSize: 16, marginRight: 4 }} />
            Yeni Müşteri
          </button>
        }
      />

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        {/* Toplam */}
        <div
          className={`kpi-card ${typeFilter === 'all' && perfFilter === 'all' ? 'active' : ''}`}
          onClick={() => { setTypeFilter('all'); setPerfFilter('all'); }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <StatusIcon icon="groups" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tüm Müşteriler</div>
            <div className="kpi-value">{kpiData.total}</div>
          </div>
        </div>

        {/* Bireysel */}
        <div
          className={`kpi-card ${typeFilter === 'B2C' ? 'active' : ''}`}
          onClick={() => handleKPIClick('type', 'B2C')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' }}>
            <StatusIcon icon="person" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Bireysel</div>
            <div className="kpi-value">{kpiData.b2c}</div>
          </div>
        </div>

        {/* Kurumsal */}
        <div
          className={`kpi-card ${typeFilter === 'B2B' ? 'active' : ''}`}
          onClick={() => handleKPIClick('type', 'B2B')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="business" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Kurumsal</div>
            <div className="kpi-value">{kpiData.b2b}</div>
          </div>
        </div>

        {/* VIP */}
        <div
          className={`kpi-card ${perfFilter === 'VIP' ? 'active' : ''}`}
          onClick={() => handleKPIClick('perf', 'VIP')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="star" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">VIP</div>
            <div className="kpi-value">{kpiData.vip}</div>
          </div>
        </div>

        {/* Riskli */}
        <div
          className={`kpi-card ${perfFilter === 'Riskli' ? 'active' : ''}`}
          onClick={() => handleKPIClick('perf', 'Riskli')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}>
            <StatusIcon icon="warning" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Riskli</div>
            <div className="kpi-value">{kpiData.risky}</div>
          </div>
        </div>

        {/* Kara Liste */}
        <div
          className={`kpi-card ${perfFilter === 'Kara Liste' ? 'active' : ''}`}
          onClick={() => handleKPIClick('perf', 'Kara Liste')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <StatusIcon icon="block" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Kara Liste</div>
            <div className="kpi-value">{kpiData.blacklist}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <StatusIcon icon="search" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
          <input
            className="form-input"
            placeholder="Müşteri adı, telefon, lokasyon, cari kod ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 400, border: 'none', background: 'transparent', padding: '8px 0' }}
          />
          {search && (
            <button 
              className="btn btn-secondary btn-small" 
              onClick={() => setSearch('')}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon="close" style={{ fontSize: 14 }} />
              Temizle
            </button>
          )}
        </div>
        
        <div className="filter-toggle-group">
          <button
            className={`filter-toggle-btn ${perfFilter === 'active_jobs' ? 'active' : ''}`}
            onClick={() => handleKPIClick('perf', 'active_jobs')}
          >
            <StatusIcon icon="work" style={{ fontSize: 14 }} />
            Aktif İşi Var ({kpiData.withActiveJobs})
          </button>
          <button
            className={`filter-toggle-btn ${perfFilter === 'Yeni' ? 'active' : ''}`}
            onClick={() => handleKPIClick('perf', 'Yeni')}
          >
            <StatusIcon icon="fiber_new" style={{ fontSize: 14 }} />
            Yeni ({kpiData.new})
          </button>
        </div>
        
        <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {filteredCustomers.length} / {customersWithStats.length} müşteri
        </span>
      </div>

      {/* Müşteri Ekleme/Düzenleme Modal */}
      <Modal
        open={showModal}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon={editing ? 'edit' : 'person_add'} />
            {editing ? 'Müşteri Güncelle' : 'Yeni Müşteri Ekle'}
          </span>
        }
        size="medium"
        onClose={() => {
          setShowModal(false);
          setEditing(null);
          setForm({ name: '', segment: 'B2C', location: '', contact: '', phone: '', phone2: '', address: '' });
        }}
        actions={
          <>
            {editing && (
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => setConfirmTarget(editing)}
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <StatusIcon icon="delete" style={{ fontSize: 16 }} />
                Sil
              </button>
            )}
            <button 
              className="btn btn-secondary" 
              type="button" 
              onClick={() => setShowModal(false)} 
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon="close" style={{ fontSize: 16 }} />
              Vazgeç
            </button>
            <button 
              className="btn btn-primary" 
              type="submit" 
              form="customer-form" 
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon={submitting ? 'hourglass_empty' : 'save'} style={{ fontSize: 16 }} />
              {submitting ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit}>
          {/* Temel Bilgiler */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusIcon icon="edit_note" /> Temel Bilgiler
            </h4>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  <StatusIcon icon="person" style={{ fontSize: 14, marginRight: 4 }} />
                  Ad Soyad / Firma Adı *
                </label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="Örn: Ahmet Kaya veya ABC Yapı Ltd."
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  <StatusIcon icon="category" style={{ fontSize: 14, marginRight: 4 }} />
                  Müşteri Tipi
                </label>
                <select
                  className="form-select"
                  value={form.segment}
                  onChange={(e) => setForm((prev) => ({ ...prev, segment: e.target.value }))}
                >
                  <option value="B2C">Bireysel (B2C)</option>
                  <option value="B2B">Kurumsal (B2B)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Adres Bilgileri */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusIcon icon="location_on" /> Adres Bilgileri
            </h4>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  <StatusIcon icon="place" style={{ fontSize: 14, marginRight: 4 }} />
                  İl / İlçe
                </label>
                <input
                  className="form-input"
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Örn: Nevşehir / Merkez"
                />
              </div>
              <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                <label className="form-label">
                  <StatusIcon icon="home" style={{ fontSize: 14, marginRight: 4 }} />
                  Açık Adres
                </label>
                <textarea
                  className="form-input"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Mahalle, sokak, bina no..."
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* İletişim Bilgileri */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusIcon icon="phone" /> İletişim
            </h4>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  <StatusIcon icon="phone" style={{ fontSize: 14, marginRight: 4 }} />
                  Telefon 1 (Birincil)
                </label>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+90 5XX XXX XX XX"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  <StatusIcon icon="phone_android" style={{ fontSize: 14, marginRight: 4 }} />
                  Telefon 2 (Yedek)
                </label>
                <input
                  className="form-input"
                  value={form.phone2}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone2: e.target.value }))}
                  placeholder="+90 5XX XXX XX XX"
                />
              </div>
              <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                <label className="form-label">
                  <StatusIcon icon="email" style={{ fontSize: 14, marginRight: 4 }} />
                  E-posta
                </label>
                <input
                  className="form-input"
                  type="email"
                  value={form.contact}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
                  placeholder="ornek@email.com"
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Silme Onay Modal */}
      <Modal
        open={Boolean(confirmTarget)}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon="warning" style={{ color: 'var(--color-danger)' }} />
            Silme Onayı
          </span>
        }
        size="small"
        onClose={() => setConfirmTarget(null)}
        actions={
          <>
            <button 
              className="btn btn-secondary" 
              type="button" 
              onClick={() => setConfirmTarget(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon="close" style={{ fontSize: 16 }} />
              Vazgeç
            </button>
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => confirmTarget && handleSoftDelete(confirmTarget)}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon="delete" style={{ fontSize: 16 }} />
              Sil
            </button>
          </>
        }
      >
        <p>
          <strong>{confirmTarget?.name}</strong> müşterisini silmek üzeresiniz. Bu işlem geri alınabilir.
        </p>
      </Modal>

      {/* MÜŞTERİ DETAY MODAL */}
      <Modal
        open={Boolean(customerDetailModal)}
        title={
          customerDetailModal ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusIcon icon="person" />
              {customerDetailModal.name}
            </span>
          ) : ''
        }
        size="large"
        onClose={() => setCustomerDetailModal(null)}
        actions={
          <>
            <button 
              className="btn btn-secondary" 
              type="button" 
              onClick={() => handleEdit(customerDetailModal)}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon="edit" style={{ fontSize: 16 }} />
              Düzenle
            </button>
            <button 
              className="btn btn-primary" 
              type="button" 
              onClick={() => setCustomerDetailModal(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon="close" style={{ fontSize: 16 }} />
              Kapat
            </button>
          </>
        }
      >
        {customerDetailModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Müşteri Bilgileri */}
            <div style={{ 
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
              padding: 16, 
              borderRadius: 12,
              border: '1px solid var(--color-border)'
            }}>
              <div className="grid grid-4" style={{ gap: 16 }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Müşteri Tipi</div>
                  {renderCustomerType(customerDetailModal.segment)}
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Performans</div>
                  {renderPerformanceSegment(customerDetailModal.stats?.performanceSegment)}
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Cari Kod</div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="sell" style={{ fontSize: 16 }} />
                    {customerDetailModal.accountCode || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Lokasyon</div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="location_on" style={{ fontSize: 16 }} />
                    {customerDetailModal.location || '-'}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-2" style={{ gap: 16, marginTop: 16 }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Telefon</div>
                  <div>
                    {customerDetailModal.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <StatusIcon icon="phone" style={{ fontSize: 16 }} /> {customerDetailModal.phone}
                      </div>
                    )}
                    {customerDetailModal.phone2 && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <StatusIcon icon="phone_android" style={{ fontSize: 14 }} /> {customerDetailModal.phone2}
                      </div>
                    )}
                    {!customerDetailModal.phone && !customerDetailModal.phone2 && <span className="text-muted">-</span>}
                  </div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>E-posta</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {customerDetailModal.contact ? (
                      <>
                        <StatusIcon icon="email" style={{ fontSize: 16 }} />
                        {customerDetailModal.contact}
                      </>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </div>
                </div>
              </div>

              {customerDetailModal.address && (
                <div style={{ marginTop: 16 }}>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Adres</div>
                  <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="home" style={{ fontSize: 16 }} />
                    {customerDetailModal.address}
                  </div>
                </div>
              )}
            </div>

            {/* İstatistikler */}
            {(() => {
              const stats = customerDetailModal.stats || getCustomerStats(customerDetailModal.id);
              return (
                <div className="grid grid-4" style={{ gap: 12 }}>
                  <div className="card subtle-card" style={{ padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>{stats.total}</div>
                    <div className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <StatusIcon icon="work" style={{ fontSize: 12 }} /> Toplam İş
                    </div>
                  </div>
                  <div className="card subtle-card" style={{ padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-warning)' }}>{stats.active}</div>
                    <div className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <StatusIcon icon="pending" style={{ fontSize: 12 }} /> Aktif
                    </div>
                  </div>
                  <div className="card subtle-card" style={{ padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>₺{(stats.totalAmount || 0).toLocaleString('tr-TR')}</div>
                    <div className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <StatusIcon icon="payments" style={{ fontSize: 12 }} /> Toplam Ciro
                    </div>
                  </div>
                  <div className="card subtle-card" style={{ padding: 12, textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: 24, 
                      fontWeight: 700, 
                      color: stats.collectionRate >= 70 ? 'var(--color-success)' : 
                             stats.collectionRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
                    }}>
                      %{stats.collectionRate || 0}
                    </div>
                    <div className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <StatusIcon icon="account_balance" style={{ fontSize: 12 }} /> Tahsilat
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* İş Listesi */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusIcon icon="folder_open" /> İşler
                <span className="badge badge-secondary">{getCustomerJobs(customerDetailModal.id).length}</span>
              </h4>
              
              {getCustomerJobs(customerDetailModal.id).length === 0 ? (
                <div className="card subtle-card" style={{ padding: 30, textAlign: 'center' }}>
                  <StatusIcon icon="inbox" style={{ fontSize: 32, marginBottom: 8, display: 'block', color: 'var(--color-text-secondary)' }} />
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Henüz iş kaydı yok</div>
                  <div className="text-muted" style={{ fontSize: 13 }}>Bu müşteriye ait iş bulunmuyor</div>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ maxHeight: 300, overflow: 'auto' }}>
                    <table className="table" style={{ fontSize: 13, marginBottom: 0 }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg)' }}>
                        <tr>
                          <th>İş Kodu</th>
                          <th>Başlık</th>
                          <th>Tarih</th>
                          <th>Tutar</th>
                          <th>Durum</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {getCustomerJobs(customerDetailModal.id).map(job => (
                          <tr 
                            key={job.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setJobDetailModal(job)}
                          >
                            <td><code style={{ fontSize: 11 }}>{job.id}</code></td>
                            <td style={{ fontWeight: 600 }}>{job.title || '-'}</td>
                            <td className="text-muted" style={{ fontSize: 12 }}>
                              {job.createdAt ? new Date(job.createdAt).toLocaleDateString('tr-TR') : '-'}
                            </td>
                            <td>
                              {getJobAmount(job) > 0
                                ? `₺${getJobAmount(job).toLocaleString('tr-TR')}` 
                                : <span className="text-muted">-</span>
                              }
                            </td>
                            <td>{renderStatus(job.status)}</td>
                            <td>
                              <button 
                                className="btn btn-secondary btn-small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setJobDetailModal(job);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <StatusIcon icon="visibility" style={{ fontSize: 14 }} />
                                Detay
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* İŞ DETAY MODAL */}
      <Modal
        open={Boolean(jobDetailModal)}
        title={
          jobDetailModal ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusIcon icon="assignment" />
              {jobDetailModal.title || jobDetailModal.id}
            </span>
          ) : ''
        }
        size="medium"
        onClose={() => setJobDetailModal(null)}
        actions={
          <>
            <button 
              className="btn btn-secondary" 
              type="button" 
              onClick={() => window.open(`/isler/list?job=${jobDetailModal?.id}`, '_blank')}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon="open_in_new" style={{ fontSize: 16 }} />
              İşe Git
            </button>
            <button 
              className="btn btn-primary" 
              type="button" 
              onClick={() => setJobDetailModal(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon="close" style={{ fontSize: 16 }} />
              Kapat
            </button>
          </>
        }
      >
        {jobDetailModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* İş Bilgileri */}
            <div style={{ background: 'var(--color-bg-secondary)', padding: 16, borderRadius: 12 }}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>İş Kodu</div>
                  <code style={{ fontSize: 12 }}>{jobDetailModal.id}</code>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Durum</div>
                  {renderStatus(jobDetailModal.status)}
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Oluşturma</div>
                  <div>{jobDetailModal.createdAt ? new Date(jobDetailModal.createdAt).toLocaleDateString('tr-TR') : '-'}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Tutar</div>
                  <div style={{ fontWeight: 600 }}>
                    {getJobAmount(jobDetailModal) > 0
                      ? `₺${getJobAmount(jobDetailModal).toLocaleString('tr-TR')}` 
                      : '-'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Dökümanlar */}
            {(() => {
              const jobDocs = getJobDocuments(jobDetailModal.id);
              if (jobDocs.length === 0) return null;
              
              return (
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusIcon icon="attach_file" /> Dökümanlar ({jobDocs.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {jobDocs.map(doc => (
                      <div 
                        key={doc.id}
                        className="card subtle-card"
                        style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <StatusIcon icon="description" style={{ fontSize: 14 }} />
                            {doc.description || doc.originalName}
                          </div>
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            {new Date(doc.uploadedAt).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                        <a 
                          href={`http://localhost:8000/documents/file/${doc.filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-small"
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <StatusIcon icon="visibility" style={{ fontSize: 14 }} />
                          Görüntüle
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Müşteri Listesi */}
      {loading ? (
        <Loader text="Müşteriler yükleniyor..." />
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Liste yüklenemedi
          </div>
          <div className="error-message">{error}</div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="card subtle-card" style={{ padding: 40, textAlign: 'center' }}>
          <StatusIcon icon="groups" style={{ fontSize: 48, marginBottom: 12, display: 'block', color: 'var(--color-text-secondary)' }} />
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {search || typeFilter !== 'all' || perfFilter !== 'all' ? 'Sonuç bulunamadı' : 'Henüz müşteri yok'}
          </div>
          <div className="text-muted">
            {search || typeFilter !== 'all' || perfFilter !== 'all' 
              ? 'Farklı bir filtre deneyin' 
              : 'Yeni müşteri eklemek için butona tıklayın'}
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filteredCustomers}
          getKey={(row) => row.id}
          onRowClick={(row) => setCustomerDetailModal(row)}
        />
      )}
    </div>
  );
};

export default Customers;
