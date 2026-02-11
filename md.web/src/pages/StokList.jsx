import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import AutocompleteInput from '../components/AutocompleteInput';
import { StatusIcon } from '../utils/muiIcons';
import {
  getStockItems,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  getColors,
  getSuppliersFromAPI,
} from '../services/dataService';

const defaultForm = {
  productCode: '',
  colorCode: '',
  name: '',
  colorName: '',
  unit: 'boy',
  supplierId: '',
  supplierName: '',
  critical: 0,
  unitCost: 0,
  notes: '',
};

const getStatus = (item) => {
  const available = Math.max(0, (item.onHand || 0) - (item.reserved || 0));
  const threshold = item.critical || 0;
  if (available <= 0) return { label: 'Tükendi', tone: 'danger', icon: 'cancel' };
  if (available <= threshold) return { label: 'Kritik', tone: 'danger', icon: 'warning' };
  if (available <= threshold * 1.5) return { label: 'Düşük', tone: 'warning', icon: 'trending_down' };
  return { label: 'Sağlıklı', tone: 'success', icon: 'check_circle' };
};

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);
const formatCurrency = (value) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value || 0);

const StokList = () => {
  const [items, setItems] = useState([]);
  const [colors, setColors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [productCodeSearch, setProductCodeSearch] = useState('');
  const [colorCodeSearch, setColorCodeSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [stockPayload, colorsPayload, suppliersPayload] = await Promise.all([
        getStockItems(),
        getColors().catch(() => []),
        getSuppliersFromAPI().catch(() => []),
      ]);
      setItems(stockPayload);
      setColors(colorsPayload);
      setSuppliers(suppliersPayload);
    } catch (err) {
      setError(err.message || 'Stok listesi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  // Tedarikçi listesi (autocomplete için)
  const supplierOptions = useMemo(() => {
    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      displayName: `${s.name} (${s.type === 'dealer' ? 'Bayi' : 'Üretici'})`,
    }));
  }, [suppliers]);

  // Renk listesi (autocomplete için)
  const colorOptions = useMemo(() => {
    const colorSet = new Map();
    
    colors.forEach((c) => {
      colorSet.set(c.code || c.id, { code: c.code || c.id, name: c.name });
    });
    
    items.forEach((item) => {
      if (item.colorCode && !colorSet.has(item.colorCode)) {
        colorSet.set(item.colorCode, { code: item.colorCode, name: item.colorName || item.colorCode });
      }
    });

    return Array.from(colorSet.values());
  }, [colors, items]);

  const filteredAndSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const productQuery = productCodeSearch.trim().toLowerCase();
    const colorQuery = colorCodeSearch.trim().toLowerCase();
    let data = [...items];

    if (query) {
      data = data.filter(
        (item) =>
          (item.name || '').toLowerCase().includes(query) ||
          (item.supplierName || '').toLowerCase().includes(query)
      );
    }

    if (productQuery) {
      data = data.filter((item) => (item.productCode || '').toLowerCase().includes(productQuery));
    }

    if (colorQuery) {
      data = data.filter((item) => (item.colorCode || '').toLowerCase().includes(colorQuery));
    }

    if (supplierFilter !== 'all') {
      data = data.filter((item) => item.supplierId === supplierFilter);
    }

    if (statusFilter !== 'all') {
      data = data.filter((item) => getStatus(item).label === statusFilter);
    }

    if (showIssuesOnly) {
      data = data.filter((item) => getStatus(item).tone !== 'success');
    }

    data.sort((a, b) => {
      const aVal = sortKey === 'available' ? (a.onHand || 0) - (a.reserved || 0) : a[sortKey];
      const bVal = sortKey === 'available' ? (b.onHand || 0) - (b.reserved || 0) : b[sortKey];
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? (aVal || '').localeCompare(bVal || '') : (bVal || '').localeCompare(aVal || '');
      }
      return sortDir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });

    return data.map((item) => ({
      ...item,
      available: Math.max(0, (item.onHand || 0) - (item.reserved || 0)),
      stockValue: (item.unitCost || 0) * (item.onHand || 0),
    }));
  }, [items, search, productCodeSearch, colorCodeSearch, supplierFilter, statusFilter, sortKey, sortDir, showIssuesOnly]);

  const summary = useMemo(() => {
    const totalItems = items.length;
    const totalOnHand = items.reduce((sum, item) => sum + (item.onHand || 0), 0);
    const totalAvailable = items.reduce((sum, item) => sum + Math.max(0, (item.onHand || 0) - (item.reserved || 0)), 0);
    const criticalCount = items.filter((item) => getStatus(item).tone !== 'success').length;
    const totalValue = items.reduce((sum, item) => sum + (item.unitCost || 0) * (item.onHand || 0), 0);
    return { totalItems, totalOnHand, totalAvailable, criticalCount, totalValue };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      productCode: item.productCode || '',
      colorCode: item.colorCode || '',
      name: item.name || '',
      colorName: item.colorName || '',
      unit: item.unit || 'boy',
      supplierId: item.supplierId || '',
      supplierName: item.supplierName || '',
      critical: item.critical || 0,
      unitCost: item.unitCost || 0,
      notes: item.notes || '',
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!form.productCode.trim()) errors.productCode = 'Ürün kodu gerekli';
    if (!form.colorCode.trim()) errors.colorCode = 'Renk kodu gerekli';
    if (!form.name.trim()) errors.name = 'Ürün adı gerekli';
    if (!form.unit.trim()) errors.unit = 'Birim gerekli';
    if (!form.supplierId && !form.supplierName.trim()) errors.supplierName = 'Tedarikçi gerekli';
    
    if (Number(form.critical) < 0) errors.critical = '0 veya üzeri olmalı';
    if (Number(form.unitCost) < 0) errors.unitCost = '0 veya üzeri olmalı';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveForm = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const payload = {
      productCode: form.productCode.trim(),
      colorCode: form.colorCode.trim(),
      name: form.name.trim(),
      colorName: form.colorName.trim() || form.colorCode.trim(),
      unit: form.unit,
      supplierId: form.supplierId || `SUP-TEMP-${Date.now()}`,
      supplierName: form.supplierName.trim(),
      critical: Number(form.critical) || 0,
      unitCost: Number(form.unitCost) || 0,
      notes: form.notes || '',
    };

    try {
      setSubmitting(true);
      setError('');
      
      if (editing) {
        const updated = await updateStockItem(editing.id, payload);
        setItems((prev) => prev.map((item) => (item.id === editing.id ? updated : item)));
      } else {
        const created = await createStockItem(payload);
        setItems((prev) => [created, ...prev]);
      }
      
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      const errorMsg = err.message || 'Kayıt yapılamadı';
      if (errorMsg.includes('validation error') || errorMsg.includes('field required')) {
        setError('Eksik veya hatalı alan var. Lütfen tüm zorunlu alanları doldurun.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSubmitting(true);
      await deleteStockItem(deleteTarget.id);
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Silinemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    const header = ['Ürün Kodu', 'Renk Kodu', 'Ürün Adı', 'Tedarikçi', 'Mevcut', 'Rezerve', 'Kullanılabilir', 'Kritik', 'Birim', 'Birim Maliyet', 'Durum'];
    const rows = items.map((item) => {
      const status = getStatus(item).label;
      const available = Math.max(0, (item.onHand || 0) - (item.reserved || 0));
      return [
        item.productCode,
        item.colorCode,
        item.name,
        item.supplierName,
        item.onHand,
        item.reserved,
        available,
        item.critical,
        item.unit,
        item.unitCost,
        status,
      ].map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stok-listesi.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleColorSelect = (colorOption) => {
    if (colorOption) {
      setForm((prev) => ({
        ...prev,
        colorCode: colorOption.code || colorOption,
        colorName: colorOption.name || colorOption,
      }));
    }
  };

  const handleSupplierSelect = (supplierOption) => {
    if (supplierOption) {
      setForm((prev) => ({
        ...prev,
        supplierId: supplierOption.id || '',
        supplierName: supplierOption.name || supplierOption,
      }));
    }
  };

  return (
    <div>
      <PageHeader
        title="Stok Listesi"
        subtitle="Ürün tanımlama ve stok durumu takibi"
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusIcon icon="download" style={{ fontSize: 16 }} />
              CSV Dışa Aktar
            </button>
            <button className="btn btn-primary" type="button" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusIcon icon="add" style={{ fontSize: 16 }} />
              Yeni Ürün
            </button>
          </>
        }
      />

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
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="lock_open" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Kullanılabilir</div>
            <div className="kpi-value">{formatNumber(summary.totalAvailable)}</div>
          </div>
        </div>

        <div 
          className={`kpi-card ${showIssuesOnly ? 'active' : ''}`}
          onClick={() => setShowIssuesOnly(!showIssuesOnly)}
          style={{ cursor: 'pointer' }}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <StatusIcon icon="warning" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Dikkat Gereken</div>
            <div className="kpi-value">{formatNumber(summary.criticalCount)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="payments" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tahmini Değer</div>
            <div className="kpi-value" style={{ fontSize: 18 }}>{formatCurrency(summary.totalValue)}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <StatusIcon icon="search" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
          <input
            type="search"
            placeholder="Ürün adı, tedarikçi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 200, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
          />
          <input
            type="search"
            placeholder="Ürün kodu..."
            value={productCodeSearch}
            onChange={(e) => setProductCodeSearch(e.target.value)}
            style={{ width: 120, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
          />
          <input
            type="search"
            placeholder="Renk kodu..."
            value={colorCodeSearch}
            onChange={(e) => setColorCodeSearch(e.target.value)}
            style={{ width: 100, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
          />
        </div>
        
        <select
          className="form-select"
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          style={{ width: 150 }}
        >
          <option value="all">Tüm Tedarikçiler</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="filter-toggle-group">
          {['Kritik', 'Düşük', 'Sağlıklı', 'Tükendi'].map((status) => (
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
          {filteredAndSorted.length} / {items.length}
        </span>
      </div>

      {/* Hata mesajı */}
      {error && (
        <div className="card error-card" style={{ marginBottom: 16 }}>
          <div className="error-title">
            <StatusIcon icon="error" style={{ marginRight: 8 }} />
            Hata
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <Loader text="Stok listesi yükleniyor..." />
      ) : (
        <div className="card">
          <DataTable
            columns={[
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
                label: 'Tedarikçi',
                accessor: 'supplierName',
                render: (val) => val ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="business" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
                    {val}
                  </span>
                ) : '-',
              },
              {
                label: 'Stok Durumu',
                accessor: 'onHand',
                render: (_, row) => (
                  <div>
                    <strong>{formatNumber(row.onHand || 0)}</strong> {row.unit}
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      Rezerve: {formatNumber(row.reserved || 0)} · Kullanılabilir: <strong>{formatNumber(row.available)}</strong>
                    </div>
                  </div>
                ),
              },
              {
                label: 'Kritik',
                accessor: 'critical',
                render: (val) => formatNumber(val || 0),
              },
              {
                label: 'Durum',
                accessor: 'status',
                render: (_, row) => {
                  const status = getStatus(row);
                  return (
                    <span className={`badge badge-${status.tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon={status.icon} style={{ fontSize: 14 }} />
                      {status.label}
                    </span>
                  );
                },
              },
              {
                label: 'Aksiyon',
                accessor: 'actions',
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: 8 }}>
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
            rows={filteredAndSorted}
          />
        </div>
      )}

      {/* Ürün Ekleme/Düzenleme Modal */}
      <Modal
        open={formOpen}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon={editing ? 'edit' : 'add_circle'} />
            {editing ? 'Ürün Düzenle' : 'Yeni Ürün Tanımla'}
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
            <button className="btn btn-primary" type="submit" form="stock-form" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon icon={submitting ? 'hourglass_empty' : 'save'} style={{ fontSize: 16 }} />
              {submitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="stock-form" onSubmit={saveForm}>
          <div className="grid grid-2" style={{ gap: 16 }}>
            {/* Ürün Kodu */}
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="qr_code" style={{ fontSize: 14, marginRight: 4 }} />
                Ürün Kodu <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                className={`form-input ${formErrors.productCode ? 'input-error' : ''}`}
                value={form.productCode}
                onChange={(e) => setForm((p) => ({ ...p, productCode: e.target.value }))}
                placeholder="Örn: 18300"
                autoFocus
              />
              {formErrors.productCode && <div className="form-error">{formErrors.productCode}</div>}
            </div>

            {/* Renk Kodu - Autocomplete */}
            <AutocompleteInput
              label="Renk Kodu"
              required
              value={form.colorCode}
              onChange={(val) => setForm((p) => ({ ...p, colorCode: val }))}
              onSelect={handleColorSelect}
              options={colorOptions}
              displayKey="name"
              valueKey="code"
              placeholder="Renk kodu yazın..."
              renderOption={(opt) => (
                <div className="autocomplete-option-content">
                  <span className="autocomplete-option-value">{opt.code}</span>
                  <span className="autocomplete-option-label">{opt.name}</span>
                </div>
              )}
              error={formErrors.colorCode}
            />

            {/* Ürün Adı */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">
                <StatusIcon icon="inventory_2" style={{ fontSize: 14, marginRight: 4 }} />
                Ürün Adı <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                className={`form-input ${formErrors.name ? 'input-error' : ''}`}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Örn: Carisma Kasa"
              />
              {formErrors.name && <div className="form-error">{formErrors.name}</div>}
            </div>

            {/* Birim */}
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="straighten" style={{ fontSize: 14, marginRight: 4 }} />
                Birim <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="form-select"
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              >
                <option value="boy">Boy (metre)</option>
                <option value="adet">Adet</option>
                <option value="m2">m² (metrekare)</option>
                <option value="kg">Kg</option>
                <option value="paket">Paket</option>
              </select>
            </div>

            {/* Tedarikçi - Autocomplete */}
            <AutocompleteInput
              label="Tedarikçi"
              required
              value={form.supplierName}
              onChange={(val) => setForm((p) => ({ ...p, supplierName: val, supplierId: '' }))}
              onSelect={handleSupplierSelect}
              options={supplierOptions}
              displayKey="name"
              valueKey="id"
              placeholder="Tedarikçi adı yazın..."
              allowCreate
              createLabel="Yeni tedarikçi ekle"
              onCreate={(name) => {
                setForm((p) => ({ ...p, supplierName: name, supplierId: '' }));
              }}
              renderOption={(opt) => (
                <div className="autocomplete-option-content">
                  <span className="autocomplete-option-label">{opt.displayName || opt.name}</span>
                </div>
              )}
              error={formErrors.supplierName}
            />

            {/* Kritik Stok Seviyesi */}
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="warning" style={{ fontSize: 14, marginRight: 4 }} />
                Kritik Stok Seviyesi
              </label>
              <input
                className={`form-input ${formErrors.critical ? 'input-error' : ''}`}
                type="number"
                min="0"
                value={form.critical}
                onChange={(e) => setForm((p) => ({ ...p, critical: e.target.value }))}
                placeholder="0"
              />
              <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                Bu seviyenin altına düşünce uyarı verilir
              </div>
              {formErrors.critical && <div className="form-error">{formErrors.critical}</div>}
            </div>

            {/* Birim Maliyet */}
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="payments" style={{ fontSize: 14, marginRight: 4 }} />
                Birim Maliyet (₺)
              </label>
              <input
                className={`form-input ${formErrors.unitCost ? 'input-error' : ''}`}
                type="number"
                min="0"
                step="0.01"
                value={form.unitCost}
                onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))}
                placeholder="0"
              />
              {formErrors.unitCost && <div className="form-error">{formErrors.unitCost}</div>}
            </div>

            {/* Not */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">
                <StatusIcon icon="notes" style={{ fontSize: 14, marginRight: 4 }} />
                Not (Opsiyonel)
              </label>
              <textarea
                className="form-textarea"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Ek bilgiler..."
                rows={2}
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
          <strong>{deleteTarget?.name}</strong> ({deleteTarget?.productCode}-{deleteTarget?.colorCode}) ürününü silmek istediğinize emin misiniz?
        </p>
        <p className="text-muted" style={{ marginTop: 8 }}>
          Bu işlem geri alınamaz.
        </p>
      </Modal>
    </div>
  );
};

export default StokList;
