import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DateInput from '../components/DateInput';
import NumberInput from '../components/NumberInput';
import Modal from '../components/Modal';
import AutocompleteInput from '../components/AutocompleteInput';
import ProductionKPICards from '../components/ProductionKPICards';
import { StatusIcon } from '../utils/muiIcons';
import {
  getProductionOrders,
  getProductionSummary,
  getProductionAlerts,
  createProductionOrder,
  recordProductionDelivery,
  resolveProductionIssue,
  deleteProductionOrder,
  getJobs,
  getJobRolesConfig,
  getSuppliersFromAPI,
  getGlassTypes,
  getProductionCombinations,
} from '../services/dataService';

const ORDER_TYPES = {
  internal: { label: 'İç Üretim', color: 'var(--success)', icon: 'factory' },
  external: { label: 'Dış Sipariş', color: 'var(--warning)', icon: 'local_shipping' },
  glass: { label: 'Cam Siparişi', color: 'var(--info)', icon: 'window' },
};

const STATUS_MAP = {
  pending: { label: 'Bekliyor', color: 'var(--warning)' },
  partial: { label: 'Kısmi Teslim', color: 'var(--info)' },
  completed: { label: 'Tamamlandı', color: 'var(--success)' },
};

const ISSUE_TYPES = {
  broken: { label: 'Kırık/Hasarlı', icon: 'broken_image' },
  missing: { label: 'Eksik', icon: 'help_outline' },
  wrong: { label: 'Yanlış Ürün', icon: 'cancel' },
  other: { label: 'Diğer', icon: 'warning' },
};

const RESOLUTION_TYPES = [
  { value: 'replaced', label: 'Değişim yapıldı' },
  { value: 'refunded', label: 'İade alındı' },
  { value: 'credited', label: 'Alacak yazıldı' },
  { value: 'cancelled', label: 'İptal edildi' },
];

const UretimSiparisler = ({ orderType = null, showIssues = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [alerts, setAlerts] = useState([]);
  
  // Reference data
  const [jobs, setJobs] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [glassTypes, setGlassTypes] = useState([]);
  const [combinations, setCombinations] = useState([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [kpiFilter, setKpiFilter] = useState(null); // KPI kartlarından gelen filtre
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  
  const [actionLoading, setActionLoading] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    jobId: '',
    roleId: '',
    roleName: '',
    orderType: 'internal',
    supplierId: '',
    supplierName: '',
    items: [{ glassType: '', glassName: '', quantity: 1, unit: 'adet', combination: '', notes: '' }],
    estimatedDelivery: '',
    notes: '',
  });

  // Delivery form
  const [deliveryForm, setDeliveryForm] = useState({
    deliveries: [],
    deliveryDate: new Date().toISOString().slice(0, 10),
    deliveryNote: '',
  });

  // Issue resolution form
  const [issueForm, setIssueForm] = useState({
    resolution: 'replaced',
    resolvedQty: 0,
    note: '',
    newIssueQty: 0,
    newIssueType: '',
    newIssueNote: '',
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [orderType, showIssues]);

  const loadData = async () => {
    setLoading(true);
    
    const filters = {};
    if (orderType) filters.orderType = orderType;
    if (overdueOnly) filters.overdue = true;
    
    // Her API'yi ayrı ayrı çağır - birisi hata verse diğerleri çalışsın
    let ordersData = [], summaryData = {}, alertsData = {}, jobsData = [];
    let rolesData = [], suppliersData = [], glassData = [], combData = [];
    
    try { ordersData = await getProductionOrders(filters); } catch (e) { console.warn('Orders error:', e); }
    try { summaryData = await getProductionSummary(); } catch (e) { console.warn('Summary error:', e); }
    try { alertsData = await getProductionAlerts(); } catch (e) { console.warn('Alerts error:', e); }
    try { jobsData = await getJobs(); } catch (e) { console.warn('Jobs error:', e); }
    try { rolesData = await getJobRolesConfig(true); } catch (e) { console.warn('Roles error:', e); }
    try { suppliersData = await getSuppliersFromAPI(); } catch (e) { console.warn('Suppliers error:', e); }
    try { glassData = await getGlassTypes(); } catch (e) { console.warn('Glass error:', e); }
    try { combData = await getProductionCombinations(); } catch (e) { console.warn('Combinations error:', e); }
    
    setOrders(ordersData || []);
    setSummary(summaryData || {});
    setAlerts(alertsData || {});
    setJobs(jobsData || []);
    setJobRoles(rolesData || []);
    setSuppliers(suppliersData || []);
    setGlassTypes(glassData || []);
    setCombinations(combData || []);
    setLoading(false);
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];
    
    // KPI filtresi (en önce)
    if (kpiFilter) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (kpiFilter === 'overdue') {
        result = result.filter((o) => {
          if (!o.estimatedDelivery || o.status === 'completed') return false;
          const delivery = new Date(o.estimatedDelivery);
          delivery.setHours(0, 0, 0, 0);
          return delivery < now;
        });
      } else if (kpiFilter === 'issues') {
        result = result.filter((o) => o.issues?.some((i) => i.status === 'pending'));
      } else {
        result = result.filter((o) => o.status === kpiFilter);
      }
    } else {
      // Normal filtreler (KPI aktif değilse)
      if (statusFilter) {
        result = result.filter((o) => o.status === statusFilter);
      }
      if (overdueOnly) {
        result = result.filter((o) => o.isOverdue);
      }
      if (showIssues) {
        result = result.filter((o) => o.issues?.some((i) => i.status === 'pending'));
      }
    }
    
    if (supplierFilter) {
      result = result.filter((o) => o.supplierId === supplierFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((o) =>
        o.jobTitle?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.roleName?.toLowerCase().includes(q) ||
        o.supplierName?.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [orders, statusFilter, supplierFilter, search, overdueOnly, showIssues, kpiFilter]);

  // Page title based on filter
  const pageTitle = useMemo(() => {
    if (showIssues) return 'Sorun Takip';
    if (orderType === 'internal') return 'İç Üretim Emirleri';
    if (orderType === 'external') return 'Dış Üretim Emirleri';
    if (orderType === 'glass') return 'Cam Emirleri';
    return 'Tüm Üretim Emirleri';
  }, [orderType, showIssues]);

  // Filtrelenmiş veriden hesaplanan summary (orderType'a göre doğru rakamlar)
  const localSummary = useMemo(() => {
    const pending = orders.filter(o => o.status === 'pending').length;
    const partial = orders.filter(o => o.status === 'partial').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const overdue = orders.filter(o => o.isOverdue).length;
    
    return { pending, partial, completed, overdue };
  }, [orders]);

  // Filtrelenmiş alerts (orderType'a göre)
  const filteredAlerts = useMemo(() => {
    if (!alerts || !Array.isArray(alerts)) return [];
    if (!orderType) return alerts; // Tüm emirler sayfasında filtre yok
    
    return alerts.filter(alert => {
      // Alert'in orderId'sinden siparişi bul ve orderType'ını kontrol et
      const order = orders.find(o => o.id === alert.orderId);
      return order?.orderType === orderType;
    });
  }, [alerts, orders, orderType]);

  // Helpers
  const formatDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('tr-TR');
    } catch {
      return d;
    }
  };

  const getJob = (jobId) => jobs.find((j) => j.id === jobId);

  // Create order
  const openCreateModal = () => {
    setCreateForm({
      jobId: '',
      roleId: '',
      roleName: '',
      orderType: orderType || 'internal',
      supplierId: '',
      supplierName: '',
      items: [{ glassType: '', glassName: '', quantity: 1, unit: 'adet', combination: '', notes: '' }],
      estimatedDelivery: '',
      notes: '',
    });
    setShowCreateModal(true);
  };

  const handleJobSelect = (job) => {
    if (!job) return;
    setCreateForm((prev) => ({
      ...prev,
      jobId: job.id,
    }));
  };

  const handleRoleSelect = (roleId) => {
    const role = jobRoles.find((r) => r.id === roleId);
    if (!role) return;
    
    // Auto-set order type based on role config
    let newOrderType = role.productionType || 'internal';
    let newSupplierId = '';
    let newSupplierName = '';
    
    if (role.productionType === 'external' && role.defaultSupplier) {
      const supplier = suppliers.find((s) => s.id === role.defaultSupplier);
      if (supplier) {
        newSupplierId = supplier.id;
        newSupplierName = supplier.name;
      }
    }
    
    setCreateForm((prev) => ({
      ...prev,
      roleId: role.id,
      roleName: role.name,
      orderType: newOrderType,
      supplierId: newSupplierId,
      supplierName: newSupplierName,
      estimatedDelivery: prev.estimatedDelivery || calculateEstimatedDate(role.estimatedDays),
    }));
  };

  const calculateEstimatedDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + (days || 5));
    return date.toISOString().slice(0, 10);
  };

  const addItem = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [...prev.items, { glassType: '', glassName: '', quantity: 1, unit: 'adet', combination: '', notes: '' }],
    }));
  };

  const updateItem = (index, field, value) => {
    setCreateForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const removeItem = (index) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const saveOrder = async () => {
    if (!createForm.jobId || !createForm.roleId) {
      alert('İş ve iş kolu seçimi gerekli');
      return;
    }
    
    if (createForm.items.length === 0 || createForm.items.every((i) => !i.quantity)) {
      alert('En az bir kalem eklemelisiniz');
      return;
    }
    
    try {
      setActionLoading(true);
      await createProductionOrder(createForm);
      await loadData();
      setShowCreateModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delivery
  const openDeliveryModal = (order) => {
    setSelectedOrder(order);
    setDeliveryForm({
      deliveries: order.items.map((item, idx) => ({
        lineIndex: idx,
        receivedQty: 0,
        problemQty: 0,
        problemType: '',
        problemNote: '',
      })),
      deliveryDate: new Date().toISOString().slice(0, 10),
      deliveryNote: '',
    });
    setShowDeliveryModal(true);
  };

  const updateDelivery = (index, field, value) => {
    setDeliveryForm((prev) => {
      const deliveries = [...prev.deliveries];
      deliveries[index] = { ...deliveries[index], [field]: value };
      return { ...prev, deliveries };
    });
  };

  const fillAllDeliveries = () => {
    if (!selectedOrder) return;
    setDeliveryForm((prev) => ({
      ...prev,
      deliveries: prev.deliveries.map((d, idx) => ({
        ...d,
        receivedQty: Math.max(0, (selectedOrder.items[idx]?.quantity || 0) - (selectedOrder.items[idx]?.receivedQty || 0)),
      })),
    }));
  };

  const saveDelivery = async () => {
    if (!selectedOrder) return;
    
    const hasDelivery = deliveryForm.deliveries.some((d) => d.receivedQty > 0 || d.problemQty > 0);
    if (!hasDelivery) {
      alert('En az bir teslim miktarı girin');
      return;
    }
    
    try {
      setActionLoading(true);
      await recordProductionDelivery(selectedOrder.id, deliveryForm);
      await loadData();
      setShowDeliveryModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Issue resolution
  const openIssueModal = (order, issue) => {
    setSelectedOrder(order);
    setSelectedIssue(issue);
    setIssueForm({
      resolution: 'replaced',
      resolvedQty: issue.quantity || 0,
      note: '',
      newIssueQty: 0,
      newIssueType: '',
      newIssueNote: '',
    });
    setShowIssueModal(true);
  };

  const saveIssueResolution = async () => {
    if (!selectedOrder || !selectedIssue) return;
    
    try {
      setActionLoading(true);
      await resolveProductionIssue(selectedOrder.id, selectedIssue.id, {
        issueId: selectedIssue.id,
        ...issueForm,
      });
      await loadData();
      setShowIssueModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete order
  const handleDelete = async (orderId) => {
    if (!confirm('Bu siparişi silmek istediğinize emin misiniz?')) return;
    
    try {
      setActionLoading(true);
      await deleteProductionOrder(orderId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Table columns
  const columns = [
    {
      header: 'Sipariş',
      accessor: 'id',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{row.id}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatDate(row.createdAt)}
          </div>
        </div>
      ),
    },
    {
      header: 'İş',
      accessor: 'jobTitle',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.jobTitle}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.customerName}</div>
        </div>
      ),
    },
    {
      header: 'Tür / İş Kolu',
      accessor: 'orderType',
      render: (_, row) => {
        const type = ORDER_TYPES[row.orderType] || {};
        return (
          <div>
            <span className="badge" style={{ background: type.color, color: '#fff', marginBottom: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon icon={type.icon} sx={{ fontSize: 14 }} /> {type.label}
            </span>
            <div style={{ fontSize: '0.75rem' }}>{row.roleName}</div>
          </div>
        );
      },
    },
    {
      header: 'Tedarikçi',
      accessor: 'supplierName',
      render: (val) => val || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      header: 'Kalemler',
      accessor: 'items',
      render: (items) => {
        const total = items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
        const received = items?.reduce((sum, i) => sum + (i.receivedQty || 0), 0) || 0;
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{received} / {total} adet</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{items?.length || 0} kalem</div>
          </div>
        );
      },
    },
    {
      header: 'Tahmini Teslim',
      accessor: 'estimatedDelivery',
      render: (val, row) => (
        <div>
          <div style={{ color: row.isOverdue ? 'var(--danger)' : 'inherit' }}>
            {formatDate(val)}
          </div>
          {row.isOverdue && (
            <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>GECİKTİ</span>
          )}
        </div>
      ),
    },
    {
      header: 'Durum',
      accessor: 'status',
      render: (val, row) => {
        const status = STATUS_MAP[val] || {};
        const pendingIssues = row.issues?.filter((i) => i.status === 'pending').length || 0;
        return (
          <div>
            <span className="badge" style={{ background: status.color, color: '#fff' }}>
              {status.label}
            </span>
            {pendingIssues > 0 && (
              <div style={{ marginTop: '0.25rem' }}>
                <span className="badge badge-danger" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <StatusIcon icon="warning" sx={{ fontSize: 12 }} /> {pendingIssues} sorun
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'İşlem',
      accessor: 'actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {row.status !== 'completed' && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => openDeliveryModal(row)}
              title="Teslim Kaydet"
            >
              <StatusIcon icon="download" sx={{ fontSize: 16 }} />
            </button>
          )}
          {row.issues?.some((i) => i.status === 'pending') && (
            <button
              className="btn btn-sm btn-warning"
              onClick={() => {
                const issue = row.issues.find((i) => i.status === 'pending');
                if (issue) openIssueModal(row, issue);
              }}
              title="Sorun Çöz"
            >
              🔧
            </button>
          )}
          {row.status === 'pending' && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => handleDelete(row.id)}
              title="Sil"
              style={{ color: 'var(--danger)' }}
            >
              <StatusIcon icon="delete" sx={{ fontSize: 16 }} />
            </button>
          )}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => navigate(`/isler/list?job=${row.jobId}&stage=4`)}
            title="İşe Git"
          >
            →
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title={pageTitle} subtitle="Üretim ve tedarik siparişleri" />
        <div className="card subtle-card">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={pageTitle}
        subtitle={`${filteredOrders.length} sipariş listeleniyor`}
      />

      {/* KPI Kartları */}
      <ProductionKPICards
        orders={orders}
        activeFilter={kpiFilter}
        onFilterClick={(filterId, filterValue) => {
          if (kpiFilter === filterId) {
            setKpiFilter(null);
          } else {
            setKpiFilter(filterValue);
            setStatusFilter('');
            setOverdueOnly(false);
          }
        }}
      />

      {/* Uyarılar - Modern Tasarım */}
      {filteredAlerts.length > 0 && (
        <div className="jobs-urgent-section" style={{ marginBottom: 24 }}>
          <div className="jobs-urgent-header">
            <div className="jobs-urgent-title">
              <StatusIcon icon="notifications_active" />
              <span>Dikkat Gerektiren ({filteredAlerts.length})</span>
            </div>
          </div>
          <div className="jobs-urgent-list">
            {filteredAlerts.slice(0, 6).map((alert, idx) => (
              <div
                key={idx}
                className="jobs-urgent-card"
                onClick={() => navigate(`/isler/list?job=${alert.jobId}&stage=4`)}
                style={{ 
                  borderLeft: `3px solid ${alert.severity === 'high' ? 'var(--color-danger)' : 'var(--color-warning)'}` 
                }}
              >
                <div className="jobs-urgent-card-title">
                  <span 
                    className="badge" 
                    style={{ 
                      fontSize: 10, 
                      padding: '2px 6px',
                      background: alert.type === 'overdue' ? 'var(--color-danger)' : alert.type === 'due_today' ? 'var(--color-warning)' : 'var(--color-info)',
                      color: '#fff'
                    }}
                  >
                    {alert.type === 'overdue' ? 'GECİKTİ' : alert.type === 'due_today' ? 'BUGÜN' : 'SORUN'}
                  </span>
                </div>
                <div className="jobs-urgent-card-info" style={{ marginTop: 4 }}>
                  {alert.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar - Modern */}
      <div className="filter-bar">
        {/* Arama */}
        <div className="filter-group search-group">
          <div className="filter-search-wrapper">
            <span className="filter-search-icon">
              <StatusIcon icon="search" />
            </span>
            <input
              className="filter-input"
              type="search"
              placeholder="İş, müşteri, tedarikçi ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Durum */}
        <div className="filter-group">
          <label className="filter-label">Durum</label>
          <select
            className="filter-select"
            value={kpiFilter || statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setKpiFilter(null);
            }}
            disabled={!!kpiFilter}
          >
            {kpiFilter ? (
              <option value={kpiFilter}>KPI Filtresi Aktif</option>
            ) : (
              <>
                <option value="">Tümü</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </>
            )}
          </select>
        </div>

        <div className="filter-divider" />

        {/* Checkbox */}
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => {
              setOverdueOnly(e.target.checked);
              if (e.target.checked) setKpiFilter(null);
            }}
            disabled={!!kpiFilter}
          />
          Sadece Gecikenler
        </label>

        {/* KPI Temizle */}
        {kpiFilter && (
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={() => setKpiFilter(null)}
            style={{ marginLeft: 'auto' }}
          >
            <StatusIcon icon="clear" /> Filtreyi Temizle
          </button>
        )}
      </div>

      {/* Orders Table */}
      <div className="card">
        <DataTable columns={columns} data={filteredOrders} emptyMessage="Sipariş bulunamadı" />
      </div>

      {/* Create Order Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Yeni Üretim/Tedarik Siparişi"
        size="large"
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">İş Seç *</label>
            <AutocompleteInput
              value={createForm.jobId}
              onChange={(val) => setCreateForm((prev) => ({ ...prev, jobId: val }))}
              options={jobs.filter((j) => ['URETIME_HAZIR', 'URETIMDE', 'ANLASMA_TAMAMLANDI'].includes(j.status))}
              displayKey="title"
              valueKey="id"
              placeholder="İş ara..."
              onSelect={handleJobSelect}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">İş Kolu *</label>
            <select
              className="form-control"
              value={createForm.roleId}
              onChange={(e) => handleRoleSelect(e.target.value)}
            >
              <option value="">Seçin...</option>
              {jobRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Sipariş Türü</label>
            <select
              className="form-control"
              value={createForm.orderType}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, orderType: e.target.value }))}
            >
              {Object.entries(ORDER_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Tahmini Teslim</label>
            <DateInput
              value={createForm.estimatedDelivery}
              onChange={(val) => setCreateForm((prev) => ({ ...prev, estimatedDelivery: val }))}
            />
          </div>
          
          {(createForm.orderType === 'external' || createForm.orderType === 'glass') && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Tedarikçi</label>
              <AutocompleteInput
                value={createForm.supplierName}
                onChange={(val) => setCreateForm((prev) => ({ ...prev, supplierName: val }))}
                options={suppliers}
                displayKey="name"
                valueKey="id"
                placeholder="Tedarikçi ara..."
                onSelect={(supplier) => setCreateForm((prev) => ({
                  ...prev,
                  supplierId: supplier?.id || '',
                  supplierName: supplier?.name || '',
                }))}
              />
            </div>
          )}
        </div>

        {/* Items */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ margin: 0 }}>Kalemler</label>
            <button className="btn btn-sm btn-secondary" onClick={addItem}>+ Kalem Ekle</button>
          </div>
          
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {createForm.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: createForm.orderType === 'glass' ? '1fr 1fr 80px 80px 40px' : '1fr 80px 80px 40px',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  marginBottom: '0.5rem',
                }}
              >
                {createForm.orderType === 'glass' ? (
                  <>
                    <select
                      className="form-control"
                      value={item.glassType}
                      onChange={(e) => {
                        const glass = glassTypes.find((g) => g.code === e.target.value);
                        updateItem(idx, 'glassType', e.target.value);
                        updateItem(idx, 'glassName', glass?.name || '');
                      }}
                    >
                      <option value="">Cam tipi...</option>
                      {glassTypes.map((g) => (
                        <option key={g.id} value={g.code}>{g.name}</option>
                      ))}
                    </select>
                    <AutocompleteInput
                      value={item.combination}
                      onChange={(val) => updateItem(idx, 'combination', val)}
                      options={combinations}
                      displayKey="name"
                      valueKey="name"
                      placeholder="Kombinasyon..."
                      onSelect={(c) => updateItem(idx, 'combination', c?.name || '')}
                    />
                  </>
                ) : (
                  <input
                    type="text"
                    className="form-control"
                    value={item.notes}
                    onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                    placeholder="Açıklama..."
                  />
                )}
                <NumberInput
                  className="form-control"
                  value={item.quantity}
                  onChange={(val) => updateItem(idx, 'quantity', val)}
                  min={1}
                  placeholder="Adet"
                />
                <select
                  className="form-control"
                  value={item.unit}
                  onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                >
                  <option value="adet">adet</option>
                  <option value="m²">m²</option>
                  <option value="set">set</option>
                </select>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => removeItem(idx)}
                  style={{ color: 'var(--danger)' }}
                  disabled={createForm.items.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label">Not</label>
          <textarea
            className="form-control"
            value={createForm.notes}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={2}
            placeholder="Ek notlar..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
            İptal
          </button>
          <button className="btn btn-primary" onClick={saveOrder} disabled={actionLoading}>
            {actionLoading ? 'Kaydediliyor...' : 'Sipariş Oluştur'}
          </button>
        </div>
      </Modal>

      {/* Delivery Modal */}
      <Modal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        title={`Teslim Kaydet - ${selectedOrder?.id}`}
        size="large"
      >
        {selectedOrder && (
          <>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <div><strong>İş:</strong> {selectedOrder.jobTitle}</div>
              <div><strong>İş Kolu:</strong> {selectedOrder.roleName}</div>
              {selectedOrder.supplierName && <div><strong>Tedarikçi:</strong> {selectedOrder.supplierName}</div>}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <DateInput
                value={deliveryForm.deliveryDate}
                onChange={(val) => setDeliveryForm((prev) => ({ ...prev, deliveryDate: val }))}
                style={{ width: '200px' }}
              />
              <button className="btn btn-secondary" onClick={fillAllDeliveries}>
                Tümünü Doldur
              </button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Kalem</th>
                    <th style={{ width: '80px' }}>Sipariş</th>
                    <th style={{ width: '80px' }}>Alınan</th>
                    <th style={{ width: '80px' }}>Teslim</th>
                    <th style={{ width: '80px' }}>Sorunlu</th>
                    <th style={{ width: '120px' }}>Sorun Tipi</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item, idx) => {
                    const remaining = (item.quantity || 0) - (item.receivedQty || 0);
                    const delivery = deliveryForm.deliveries[idx] || {};
                    
                    return (
                      <tr key={idx}>
                        <td>
                          {item.glassName || item.notes || `Kalem ${idx + 1}`}
                          {item.combination && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.combination}</div>}
                        </td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>
                          <span style={{ color: remaining === 0 ? 'var(--success)' : 'inherit' }}>
                            {item.receivedQty || 0}
                          </span>
                        </td>
                        <td>
                          <NumberInput
                            className="form-control"
                            value={delivery.receivedQty || 0}
                            onChange={(val) => updateDelivery(idx, 'receivedQty', val)}
                            min={0}
                            max={remaining}
                            style={{ width: '70px', padding: '0.25rem' }}
                            allowEmpty
                          />
                        </td>
                        <td>
                          <NumberInput
                            className="form-control"
                            value={delivery.problemQty || 0}
                            onChange={(val) => updateDelivery(idx, 'problemQty', val)}
                            min={0}
                            style={{ width: '70px', padding: '0.25rem' }}
                            allowEmpty
                          />
                        </td>
                        <td>
                          {delivery.problemQty > 0 && (
                            <select
                              className="form-control"
                              value={delivery.problemType || ''}
                              onChange={(e) => updateDelivery(idx, 'problemType', e.target.value)}
                              style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                            >
                              <option value="">Seçin...</option>
                              {Object.entries(ISSUE_TYPES).map(([k, v]) => (
                                <option key={k} value={k}>{v.icon} {v.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Teslimat Notu</label>
              <input
                type="text"
                className="form-control"
                value={deliveryForm.deliveryNote}
                onChange={(e) => setDeliveryForm((prev) => ({ ...prev, deliveryNote: e.target.value }))}
                placeholder="Opsiyonel not..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowDeliveryModal(false)}>
                İptal
              </button>
              <button className="btn btn-success" onClick={saveDelivery} disabled={actionLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {actionLoading ? 'Kaydediliyor...' : <><StatusIcon icon="download" sx={{ fontSize: 16 }} /> Teslim Kaydet</>}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Issue Resolution Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="Sorun Çözümü"
        size="medium"
      >
        {selectedOrder && selectedIssue && (
          <>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <div><strong>Sipariş:</strong> {selectedOrder.id}</div>
              <div><strong>Sorun:</strong> {ISSUE_TYPES[selectedIssue.type]?.icon} {ISSUE_TYPES[selectedIssue.type]?.label}</div>
              <div><strong>Miktar:</strong> {selectedIssue.quantity} adet</div>
              {selectedIssue.note && <div><strong>Not:</strong> {selectedIssue.note}</div>}
              
              {/* Zincirleme sorun geçmişi */}
              {selectedIssue.history?.length > 0 && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Geçmiş:</div>
                  {selectedIssue.history.map((h, i) => (
                    <div key={i} style={{ fontSize: '0.75rem' }}>
                      {formatDate(h.date)} - {RESOLUTION_TYPES.find((r) => r.value === h.resolution)?.label} ({h.resolvedQty} adet)
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Çözüm Türü</label>
                <select
                  className="form-control"
                  value={issueForm.resolution}
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, resolution: e.target.value }))}
                >
                  {RESOLUTION_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Çözülen Miktar</label>
                <NumberInput
                  className="form-control"
                  value={issueForm.resolvedQty}
                  onChange={(val) => setIssueForm((prev) => ({ ...prev, resolvedQty: val }))}
                  min={0}
                  max={selectedIssue.quantity}
                />
              </div>
            </div>

            {/* Zincirleme sorun */}
            {issueForm.resolution === 'replaced' && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: '6px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>⚠️ Değişim de sorunlu mu?</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Yeni Sorunlu Miktar</label>
                    <NumberInput
                      className="form-control"
                      value={issueForm.newIssueQty}
                      onChange={(val) => setIssueForm((prev) => ({ ...prev, newIssueQty: val }))}
                      min={0}
                    />
                  </div>
                  
                  {issueForm.newIssueQty > 0 && (
                    <div className="form-group">
                      <label className="form-label">Sorun Tipi</label>
                      <select
                        className="form-control"
                        value={issueForm.newIssueType}
                        onChange={(e) => setIssueForm((prev) => ({ ...prev, newIssueType: e.target.value }))}
                      >
                        <option value="">Seçin...</option>
                        {Object.entries(ISSUE_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                {issueForm.newIssueQty > 0 && (
                  <div className="form-group">
                    <label className="form-label">Yeni Sorun Notu</label>
                    <input
                      type="text"
                      className="form-control"
                      value={issueForm.newIssueNote}
                      onChange={(e) => setIssueForm((prev) => ({ ...prev, newIssueNote: e.target.value }))}
                      placeholder="Açıklama..."
                    />
                  </div>
                )}
              </div>
            )}

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Çözüm Notu</label>
              <textarea
                className="form-control"
                value={issueForm.note}
                onChange={(e) => setIssueForm((prev) => ({ ...prev, note: e.target.value }))}
                rows={2}
                placeholder="Açıklama..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowIssueModal(false)}>
                İptal
              </button>
              <button className="btn btn-success" onClick={saveIssueResolution} disabled={actionLoading}>
                {actionLoading ? 'Kaydediliyor...' : '✓ Sorunu Çöz'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default UretimSiparisler;
