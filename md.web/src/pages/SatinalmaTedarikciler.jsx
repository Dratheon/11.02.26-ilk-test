import { useEffect, useState, useMemo } from 'react';
import DataTable from '../components/DataTable';
import DateInput from '../components/DateInput';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import {
  getSuppliersFromAPI,
  getSupplierBalance,
  getSupplierTransactions,
  createSupplierTransaction,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  searchStockItems,
  getJobRolesConfig,
} from '../services/dataService';

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);

const defaultSupplierForm = {
  name: '',
  type: 'manufacturer',
  category: '',
  jobRoleId: '',
  supplyType: 'stock',
  leadTimeDays: 7,
  notes: '',
  contact: {
    phone: '',
    email: '',
    address: '',
    contactPerson: '',
  },
};

const defaultTransactionForm = {
  productCode: '',
  colorCode: '',
  productName: '',
  quantity: 1,
  unit: 'boy',
  type: 'received',
  date: new Date().toISOString().slice(0, 10),
  note: '',
};

const SatinalmaTedarikciler = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [jobRoles, setJobRoles] = useState([]);

  // Supplier form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [supplierForm, setSupplierForm] = useState(defaultSupplierForm);
  const [submitting, setSubmitting] = useState(false);

  // Supplier detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierBalance, setSupplierBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Transaction form
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionForm, setTransactionForm] = useState(defaultTransactionForm);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadSuppliers();
    loadJobRoles();
  }, []);

  const loadJobRoles = async () => {
    try {
      const roles = await getJobRolesConfig(true);
      setJobRoles(roles || []);
    } catch (err) {
      console.warn('Job roles yüklenemedi:', err);
    }
  };

  const loadSuppliers = async () => {
      try {
        setLoading(true);
        setError('');
      const payload = await getSuppliersFromAPI();
      setSuppliers(payload);
      } catch (err) {
        setError(err.message || 'Tedarikçiler alınamadı');
      } finally {
        setLoading(false);
      }
    };

  const filteredSuppliers = useMemo(() => {
    let data = [...suppliers];
    
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.category || '').toLowerCase().includes(q) ||
          (s.contact?.contactPerson || '').toLowerCase().includes(q)
      );
    }
    
    if (typeFilter !== 'all') {
      data = data.filter((s) => s.type === typeFilter);
    }
    
    return data;
  }, [suppliers, search, typeFilter]);

  const openCreate = () => {
    setEditing(null);
    setSupplierForm(defaultSupplierForm);
    setFormOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    setSupplierForm({
      name: supplier.name || '',
      type: supplier.type || 'manufacturer',
      category: supplier.category || '',
      jobRoleId: supplier.jobRoleId || '',
      supplyType: supplier.supplyType || 'stock',
      leadTimeDays: supplier.leadTimeDays || 7,
      notes: supplier.notes || '',
      contact: {
        phone: supplier.contact?.phone || '',
        email: supplier.contact?.email || '',
        address: supplier.contact?.address || '',
        contactPerson: supplier.contact?.contactPerson || '',
      },
    });
    setFormOpen(true);
  };

  const saveSupplier = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editing) {
        const updated = await updateSupplier(editing.id, supplierForm);
        setSuppliers((prev) => prev.map((s) => (s.id === editing.id ? updated : s)));
      } else {
        const created = await createSupplier(supplierForm);
        setSuppliers((prev) => [created, ...prev]);
      }
      setFormOpen(false);
    } catch (err) {
      setError(err.message || 'Kayıt yapılamadı');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSubmitting(true);
      await deleteSupplier(deleteTarget.id);
      setSuppliers((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Silinemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (supplier) => {
    setSelectedSupplier(supplier);
    setDetailOpen(true);
    setBalanceLoading(true);
    
    try {
      const [balanceData, transData] = await Promise.all([
        getSupplierBalance(supplier.id),
        getSupplierTransactions(supplier.id),
      ]);
      setSupplierBalance(balanceData);
      setTransactions(transData);
    } catch (err) {
      console.error('Balance load error:', err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const openAddTransaction = () => {
    setTransactionForm({
      ...defaultTransactionForm,
      date: new Date().toISOString().slice(0, 10),
    });
    setProductSearch('');
    setProductResults([]);
    setTransactionOpen(true);
  };

  // Ürün arama
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) {
      setProductResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setProductSearching(true);
      try {
        const results = await searchStockItems(productSearch, '');
        setProductResults(results.slice(0, 10));
      } catch (err) {
        console.error('Product search error:', err);
      } finally {
        setProductSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch]);

  const selectProduct = (product) => {
    setTransactionForm((prev) => ({
      ...prev,
      productCode: product.productCode,
      colorCode: product.colorCode,
      productName: product.name,
      unit: product.unit || 'boy',
    }));
    setProductSearch('');
    setProductResults([]);
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    
    try {
      setSubmitting(true);
      const created = await createSupplierTransaction(selectedSupplier.id, transactionForm);
      setTransactions((prev) => [created, ...prev]);
      
      // Bakiyeyi yeniden yükle
      const balanceData = await getSupplierBalance(selectedSupplier.id);
      setSupplierBalance(balanceData);
      
      setTransactionOpen(false);
    } catch (err) {
      setError(err.message || 'Hareket kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(() => {
    const manufacturers = suppliers.filter((s) => s.type === 'manufacturer').length;
    const dealers = suppliers.filter((s) => s.type === 'dealer').length;
    return { total: suppliers.length, manufacturers, dealers };
  }, [suppliers]);

  return (
    <div>
      <PageHeader
        title="Tedarikçiler & Bayiler"
        subtitle="Tedarikçi yönetimi ve ürün bazlı hesap takibi"
        actions={
          <button className="btn btn-primary" type="button" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusIcon icon="add" style={{ fontSize: 16 }} />
            Yeni Tedarikçi
          </button>
        }
      />

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div 
          className={`kpi-card ${typeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setTypeFilter('all')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <StatusIcon icon="groups" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Toplam</div>
            <div className="kpi-value">{formatNumber(summary.total)}</div>
          </div>
        </div>

        <div 
          className={`kpi-card ${typeFilter === 'manufacturer' ? 'active' : ''}`}
          onClick={() => setTypeFilter(typeFilter === 'manufacturer' ? 'all' : 'manufacturer')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="factory" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Üretici/Fabrika</div>
            <div className="kpi-value">{formatNumber(summary.manufacturers)}</div>
          </div>
        </div>

        <div 
          className={`kpi-card ${typeFilter === 'dealer' ? 'active' : ''}`}
          onClick={() => setTypeFilter(typeFilter === 'dealer' ? 'all' : 'dealer')}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="storefront" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Bayi</div>
            <div className="kpi-value">{formatNumber(summary.dealers)}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <StatusIcon icon="search" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
          <input
            type="search"
            placeholder="Tedarikçi adı, kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 300, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
          />
        </div>

        <div className="filter-toggle-group">
          <button
            className={`filter-toggle-btn ${typeFilter === 'manufacturer' ? 'active' : ''}`}
            onClick={() => setTypeFilter(typeFilter === 'manufacturer' ? 'all' : 'manufacturer')}
          >
            Üretici
          </button>
          <button
            className={`filter-toggle-btn ${typeFilter === 'dealer' ? 'active' : ''}`}
            onClick={() => setTypeFilter(typeFilter === 'dealer' ? 'all' : 'dealer')}
          >
            Bayi
          </button>
        </div>

        <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {filteredSuppliers.length} / {suppliers.length}
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
        <Loader text="Tedarikçiler yükleniyor..." />
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusIcon icon="list_alt" />
              Tedarikçi Listesi
            </h3>
            <span className="badge badge-secondary">{filteredSuppliers.length} kayıt</span>
          </div>
        <DataTable
          columns={[
              {
                label: 'Tedarikçi',
                accessor: 'name',
                render: (_, row) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{row.name}</div>
                    <div className="text-muted">{row.category || 'Genel'}</div>
                  </div>
                ),
              },
              {
                label: 'Tür',
                accessor: 'type',
                render: (val) => (
                  <span className={`badge badge-${val === 'dealer' ? 'warning' : 'primary'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon={val === 'dealer' ? 'storefront' : 'factory'} style={{ fontSize: 14 }} />
                    {val === 'dealer' ? 'Bayi' : 'Üretici'}
                  </span>
                ),
              },
              {
                label: 'Tedarik Türü',
                accessor: 'supplyType',
                render: (val, row) => {
                  const roleName = jobRoles.find(r => r.id === row.jobRoleId)?.name;
                  const config = {
                    glass: { icon: 'window', label: 'Cam', tone: 'info' },
                    production: { icon: 'precision_manufacturing', label: 'Dış Üretim', tone: 'success' },
                    stock: { icon: 'inventory_2', label: 'Stok', tone: 'secondary' },
                  };
                  const c = config[val] || config.stock;
                  return (
                    <div>
                      <span className={`badge badge-${c.tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <StatusIcon icon={c.icon} style={{ fontSize: 14 }} />
                        {c.label}
                      </span>
                      {roleName && <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{roleName}</div>}
                    </div>
                  );
                },
              },
              {
                label: 'İletişim',
                accessor: 'contact',
                render: (_, row) => (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon="person" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
                      {row.contact?.contactPerson || '-'}
                    </div>
                    <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon="phone" style={{ fontSize: 12 }} />
                      {row.contact?.phone || '-'}
                    </div>
                  </div>
                ),
              },
              {
                label: 'Temin Süresi',
                accessor: 'leadTimeDays',
                render: (val) => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="schedule" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
                    {val || 7} gün
                  </span>
                ),
              },
              {
                label: 'Aksiyon',
                accessor: 'actions',
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary btn-small"
                      type="button"
                      onClick={() => openDetail(row)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <StatusIcon icon="account_balance" style={{ fontSize: 14 }} />
                      Hesap
                    </button>
                    <button
                      className="btn btn-secondary btn-icon"
                      type="button"
                      onClick={() => openEdit(row)}
                      title="Düzenle"
                    >
                      <StatusIcon icon="edit" style={{ fontSize: 16 }} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon"
                      type="button"
                      onClick={() => setDeleteTarget(row)}
                      title="Sil"
                    >
                      <StatusIcon icon="delete" style={{ fontSize: 16 }} />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filteredSuppliers}
          />
        </div>
      )}

      {/* Tedarikçi Ekleme/Düzenleme Modal */}
      <Modal
        open={formOpen}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon={editing ? 'edit' : 'add_circle'} />
            {editing ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}
          </span>
        }
        size="large"
        onClose={() => setFormOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setFormOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon icon="close" style={{ fontSize: 16 }} />
              İptal
            </button>
            <button className="btn btn-primary" type="submit" form="supplier-form" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon icon={submitting ? 'hourglass_empty' : 'save'} style={{ fontSize: 16 }} />
              {submitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={saveSupplier} className="grid grid-2">
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="business" style={{ fontSize: 14, marginRight: 4 }} />
              Tedarikçi Adı *
            </label>
            <input
              className="form-input"
              value={supplierForm.name}
              onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="category" style={{ fontSize: 14, marginRight: 4 }} />
              Tür *
            </label>
            <select
              className="form-select"
              value={supplierForm.type}
              onChange={(e) => setSupplierForm((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="manufacturer">Üretici/Fabrika</option>
              <option value="dealer">Bayi</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="label" style={{ fontSize: 14, marginRight: 4 }} />
              Kategori
            </label>
            <input
              className="form-input"
              value={supplierForm.category}
              onChange={(e) => setSupplierForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="PVC Profil, Aksesuar, Cam..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="local_shipping" style={{ fontSize: 14, marginRight: 4 }} />
              Tedarik Türü *
            </label>
            <select
              className="form-select"
              value={supplierForm.supplyType}
              onChange={(e) => setSupplierForm((p) => ({ ...p, supplyType: e.target.value, jobRoleId: e.target.value === 'stock' ? '' : p.jobRoleId }))}
            >
              <option value="stock">Stok Tedarikçisi</option>
              <option value="glass">Cam Tedarikçisi (Üretim)</option>
              <option value="production">Dış Üretim Tedarikçisi</option>
            </select>
          </div>
          {(supplierForm.supplyType === 'glass' || supplierForm.supplyType === 'production') && (
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="work" style={{ fontSize: 14, marginRight: 4 }} />
                İş Kolu *
              </label>
              <select
                className="form-select"
                value={supplierForm.jobRoleId}
                onChange={(e) => setSupplierForm((p) => ({ ...p, jobRoleId: e.target.value }))}
              >
                <option value="">Tümü (Genel)</option>
                {jobRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              <small className="text-muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                Bu tedarikçi hangi iş kolu için sipariş verilecek? Boş bırakırsanız tüm iş kollarında görünür.
              </small>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="schedule" style={{ fontSize: 14, marginRight: 4 }} />
              Temin Süresi (gün)
            </label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={supplierForm.leadTimeDays}
              onChange={(e) => setSupplierForm((p) => ({ ...p, leadTimeDays: Number(e.target.value) }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="person" style={{ fontSize: 14, marginRight: 4 }} />
              Yetkili Kişi
            </label>
            <input
              className="form-input"
              value={supplierForm.contact.contactPerson}
              onChange={(e) =>
                setSupplierForm((p) => ({ ...p, contact: { ...p.contact, contactPerson: e.target.value } }))
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="phone" style={{ fontSize: 14, marginRight: 4 }} />
              Telefon
            </label>
            <input
              className="form-input"
              value={supplierForm.contact.phone}
              onChange={(e) =>
                setSupplierForm((p) => ({ ...p, contact: { ...p.contact, phone: e.target.value } }))
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="email" style={{ fontSize: 14, marginRight: 4 }} />
              E-posta
            </label>
            <input
              className="form-input"
              type="email"
              value={supplierForm.contact.email}
              onChange={(e) =>
                setSupplierForm((p) => ({ ...p, contact: { ...p.contact, email: e.target.value } }))
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="location_on" style={{ fontSize: 14, marginRight: 4 }} />
              Adres
            </label>
            <input
              className="form-input"
              value={supplierForm.contact.address}
              onChange={(e) =>
                setSupplierForm((p) => ({ ...p, contact: { ...p.contact, address: e.target.value } }))
              }
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">
              <StatusIcon icon="notes" style={{ fontSize: 14, marginRight: 4 }} />
              Notlar
            </label>
            <textarea
              className="form-textarea"
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Ek bilgiler..."
            />
          </div>
        </form>
      </Modal>

      {/* Tedarikçi Detay / Ürün Bazlı Hesap Modal */}
      <Modal
        open={detailOpen}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon="account_balance" />
            {selectedSupplier?.name || 'Tedarikçi'} - Ürün Hesabı
          </span>
        }
        size="xxlarge"
        onClose={() => {
          setDetailOpen(false);
          setSelectedSupplier(null);
          setSupplierBalance(null);
          setTransactions([]);
        }}
      >
        {balanceLoading ? (
          <Loader text="Hesap bilgileri yükleniyor..." />
        ) : (
          <div>
            {/* Tedarikçi Bilgileri */}
            <div className="card subtle-card" style={{ marginBottom: 16 }}>
              <div className="grid grid-4" style={{ gap: 16 }}>
                <div>
                  <div className="metric-label">Tür</div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon={selectedSupplier?.type === 'dealer' ? 'storefront' : 'factory'} style={{ fontSize: 16 }} />
                    {selectedSupplier?.type === 'dealer' ? 'Bayi' : 'Üretici'}
                  </div>
                </div>
                <div>
                  <div className="metric-label">Kategori</div>
                  <div style={{ fontWeight: 600 }}>{selectedSupplier?.category || '-'}</div>
                </div>
                <div>
                  <div className="metric-label">Temin Süresi</div>
                  <div style={{ fontWeight: 600 }}>{selectedSupplier?.leadTimeDays || 7} gün</div>
                </div>
                <div>
                  <div className="metric-label">İletişim</div>
                  <div style={{ fontWeight: 600 }}>{selectedSupplier?.contact?.phone || '-'}</div>
                </div>
              </div>
            </div>

            {/* Ürün Bazlı Bakiye Özeti */}
            {supplierBalance && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <h4 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusIcon icon="inventory_2" />
                    Ürün Bazlı Bakiye
                  </h4>
                  <button className="btn btn-primary btn-small" type="button" onClick={openAddTransaction} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="add" style={{ fontSize: 14 }} />
                    Hareket Ekle
                  </button>
                </div>

                {/* Bakiye Özeti */}
                <div
                  className="grid grid-3"
                  style={{ gap: 12, marginBottom: 16, padding: '0 16px' }}
                >
                  <div style={{ padding: 12, background: 'var(--color-success-bg)', borderRadius: 8, textAlign: 'center' }}>
                    <div className="metric-label">Aldık (Toplam)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-success)' }}>
                      {formatNumber(supplierBalance.summary?.totalReceived || 0)}
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--color-warning-bg)', borderRadius: 8, textAlign: 'center' }}>
                    <div className="metric-label">Verdik (Toplam)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-warning)' }}>
                      {formatNumber(supplierBalance.summary?.totalGiven || 0)}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: 12,
                      background:
                        (supplierBalance.summary?.netBalance || 0) >= 0
                          ? 'var(--color-info-bg)'
                          : 'var(--color-danger-bg)',
                      borderRadius: 8,
                      textAlign: 'center',
                    }}
                  >
                    <div className="metric-label">Net Bakiye</div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color:
                          (supplierBalance.summary?.netBalance || 0) >= 0
                            ? 'var(--color-info)'
                            : 'var(--color-danger)',
                      }}
                    >
                      {(supplierBalance.summary?.netBalance || 0) >= 0 ? '+' : ''}
                      {formatNumber(supplierBalance.summary?.netBalance || 0)}
                    </div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {(supplierBalance.summary?.netBalance || 0) >= 0
                        ? 'Biz fazla aldık'
                        : 'Biz fazla verdik'}
                    </div>
                  </div>
                </div>

                {/* Ürün Detay Tablosu */}
                {supplierBalance.items?.length > 0 ? (
                  <div className="table-container" style={{ maxHeight: 300 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Ürün Kodu</th>
                          <th>Renk Kodu</th>
                          <th>Ürün Adı</th>
                          <th>Birim</th>
                          <th style={{ textAlign: 'right' }}>Aldık</th>
                          <th style={{ textAlign: 'right' }}>Verdik</th>
                          <th style={{ textAlign: 'right' }}>Bakiye</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierBalance.items.map((item, idx) => (
                          <tr key={`${item.productCode}-${item.colorCode}-${idx}`}>
                            <td><strong>{item.productCode}</strong></td>
                            <td>{item.colorCode}</td>
                            <td>{item.productName}</td>
                            <td>{item.unit}</td>
                            <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                              +{formatNumber(item.received)}
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--color-warning)' }}>
                              -{formatNumber(item.given)}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: item.balance >= 0 ? 'var(--color-info)' : 'var(--color-danger)',
                              }}
                            >
                              {item.balance >= 0 ? '+' : ''}
                              {formatNumber(item.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: 20, textAlign: 'center' }}>
                    <StatusIcon icon="inbox" style={{ fontSize: 48, color: 'var(--color-text-secondary)', marginBottom: 8 }} />
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Henüz hareket yok</div>
                    <div className="text-muted">
                      Bu tedarikçi ile ürün alışverişi kaydı bulunmuyor.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Son Hareketler */}
            <div className="card">
              <div className="card-header">
                <h4 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StatusIcon icon="history" />
                  Son Hareketler
                </h4>
                <span className="badge badge-secondary">{transactions.length} kayıt</span>
              </div>
              {transactions.length > 0 ? (
                <div className="table-container" style={{ maxHeight: 250 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>Ürün</th>
                        <th>Miktar</th>
                        <th>İşlem</th>
                        <th>Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 20).map((t) => (
                        <tr key={t.id}>
                          <td>{t.date}</td>
                          <td>
                            <strong>{t.productCode}</strong>-{t.colorCode}
                            <div className="text-muted" style={{ fontSize: 12 }}>
                              {t.productName}
                            </div>
                          </td>
                          <td>
                            {formatNumber(t.quantity)} {t.unit}
                          </td>
                          <td>
                            <span
                              className={`badge badge-${t.type === 'received' ? 'success' : 'warning'}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <StatusIcon icon={t.type === 'received' ? 'arrow_downward' : 'arrow_upward'} style={{ fontSize: 14 }} />
                              {t.type === 'received' ? 'Aldık' : 'Verdik'}
                            </span>
                          </td>
                          <td className="text-muted">{t.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-muted" style={{ padding: 16, textAlign: 'center' }}>
                  Henüz hareket kaydı yok.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Hareket Ekleme Modal */}
      <Modal
        open={transactionOpen}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon="add_circle" />
            Ürün Hareketi Ekle
          </span>
        }
        size="large"
        onClose={() => setTransactionOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setTransactionOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon icon="close" style={{ fontSize: 16 }} />
              İptal
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form="transaction-form"
              disabled={submitting || !transactionForm.productCode}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon={submitting ? 'hourglass_empty' : 'save'} style={{ fontSize: 16 }} />
              {submitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="transaction-form" onSubmit={saveTransaction}>
          {/* Ürün Arama */}
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="search" style={{ fontSize: 14, marginRight: 4 }} />
              Ürün Ara (kod veya ad)
            </label>
            <input
              className="form-input"
              placeholder="Ürün kodu veya adı yazın..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            {productSearching && <div className="text-muted" style={{ marginTop: 4 }}>Aranıyor...</div>}
            {productResults.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {productResults.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                    onClick={() => selectProduct(p)}
                    onKeyDown={(e) => e.key === 'Enter' && selectProduct(p)}
                    tabIndex={0}
                    role="button"
                  >
                    <strong>{p.productCode}</strong>-{p.colorCode} · {p.name} {p.colorName || ''}
                    <span className="text-muted" style={{ marginLeft: 8 }}>
                      ({p.unit})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seçilen Ürün */}
          {transactionForm.productCode && (
            <div
              style={{
                padding: 12,
                background: 'var(--color-primary-bg)',
                borderRadius: 8,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <StatusIcon icon="check_circle" style={{ color: 'var(--color-primary)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>
                  {transactionForm.productCode}-{transactionForm.colorCode}
                </div>
                <div>{transactionForm.productName}</div>
              </div>
            </div>
          )}

          <div className="grid grid-2" style={{ gap: 16 }}>
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="qr_code" style={{ fontSize: 14, marginRight: 4 }} />
                Ürün Kodu *
              </label>
              <input
                className="form-input"
                value={transactionForm.productCode}
                onChange={(e) => setTransactionForm((p) => ({ ...p, productCode: e.target.value }))}
                placeholder="18300"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="palette" style={{ fontSize: 14, marginRight: 4 }} />
                Renk Kodu *
              </label>
              <input
                className="form-input"
                value={transactionForm.colorCode}
                onChange={(e) => setTransactionForm((p) => ({ ...p, colorCode: e.target.value }))}
                placeholder="3"
                required
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">
                <StatusIcon icon="inventory_2" style={{ fontSize: 14, marginRight: 4 }} />
                Ürün Adı
              </label>
              <input
                className="form-input"
                value={transactionForm.productName}
                onChange={(e) => setTransactionForm((p) => ({ ...p, productName: e.target.value }))}
                placeholder="Carisma Kasa Beyaz"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="numbers" style={{ fontSize: 14, marginRight: 4 }} />
                Miktar *
              </label>
              <input
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                value={transactionForm.quantity}
                onChange={(e) => setTransactionForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="straighten" style={{ fontSize: 14, marginRight: 4 }} />
                Birim
              </label>
              <select
                className="form-select"
                value={transactionForm.unit}
                onChange={(e) => setTransactionForm((p) => ({ ...p, unit: e.target.value }))}
              >
                <option value="boy">Boy</option>
                <option value="adet">Adet</option>
                <option value="m2">m²</option>
                <option value="kg">Kg</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="swap_horiz" style={{ fontSize: 14, marginRight: 4 }} />
                İşlem Türü *
              </label>
              <select
                className="form-select"
                value={transactionForm.type}
                onChange={(e) => setTransactionForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="received">Aldık (Biz onlardan aldık)</option>
                <option value="given">Verdik (Biz onlara verdik)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="event" style={{ fontSize: 14, marginRight: 4 }} />
                Tarih
              </label>
              <DateInput
                value={transactionForm.date}
                onChange={(val) => setTransactionForm((p) => ({ ...p, date: val }))}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">
                <StatusIcon icon="notes" style={{ fontSize: 14, marginRight: 4 }} />
                Not
              </label>
              <input
                className="form-input"
                value={transactionForm.note}
                onChange={(e) => setTransactionForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Acil ihtiyaç için, ödünç verildi vb."
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Silme Onay Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon="warning" style={{ color: 'var(--color-danger)' }} />
            Silme Onayı
          </span>
        }
        size="small"
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon icon="close" style={{ fontSize: 16 }} />
              Vazgeç
            </button>
            <button className="btn btn-danger" type="button" onClick={confirmDelete} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon icon="delete" style={{ fontSize: 16 }} />
              Sil
            </button>
          </>
        }
      >
        <p>
          <strong>{deleteTarget?.name}</strong> tedarikçisini silmek istediğinize emin misiniz?
        </p>
        <p className="text-muted" style={{ marginTop: 8 }}>Bu işlem geri alınamaz.</p>
      </Modal>
    </div>
  );
};

export default SatinalmaTedarikciler;
