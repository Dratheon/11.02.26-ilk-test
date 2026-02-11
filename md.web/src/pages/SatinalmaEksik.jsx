import { useEffect, useState, useMemo } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import {
  getMissingItems,
  createPurchaseOrder,
  getSuppliersFromAPI,
} from '../services/dataService';

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);

const SatinalmaEksik = () => {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Create order modal
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [missingData, suppliersData] = await Promise.all([
        getMissingItems(),
        getSuppliersFromAPI(),
      ]);
      setItems(missingData);
      setSuppliers(suppliersData);
    } catch (err) {
      setError(err.message || 'Veriler alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let data = [...items];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (i) =>
          i.productCode.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.colorName || '').toLowerCase().includes(q)
      );
    }

    if (supplierFilter !== 'all') {
      data = data.filter((i) => i.supplierId === supplierFilter);
    }

    return data;
  }, [items, search, supplierFilter]);

  const summary = useMemo(() => {
    const total = items.length;
    const totalShortage = items.reduce((sum, i) => sum + (i.suggestedQty || 0), 0);
    const suppliersNeeded = new Set(items.map((i) => i.supplierId)).size;
    return { total, totalShortage, suppliersNeeded };
  }, [items]);

  const toggleSelect = (item) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.itemId === item.itemId);
      if (exists) {
        return prev.filter((s) => s.itemId !== item.itemId);
      }
      return [...prev, item];
    });
  };

  const selectAll = () => {
    if (selected.length === filteredItems.length) {
      setSelected([]);
    } else {
      setSelected([...filteredItems]);
    }
  };

  const createOrders = async () => {
    if (selected.length === 0) return;

    // Tedarikçiye göre grupla
    const bySupplier = {};
    selected.forEach((item) => {
      const key = item.supplierId;
      if (!bySupplier[key]) {
        bySupplier[key] = {
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          items: [],
        };
      }
      bySupplier[key].items.push({
        productCode: item.productCode,
        colorCode: item.colorCode,
        productName: item.name,
        quantity: item.suggestedQty,
        unit: item.unit,
        unitCost: 0,
      });
    });

    try {
      setSubmitting(true);
      for (const data of Object.values(bySupplier)) {
        await createPurchaseOrder({
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          items: data.items,
          notes: 'Kritik stok siparişi',
          expectedDate: '',
          relatedJobs: [],
        });
      }
      setSelected([]);
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Sipariş oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  const groupedSelected = useMemo(() => {
    const groups = {};
    selected.forEach((item) => {
      if (!groups[item.supplierId]) {
        groups[item.supplierId] = {
          supplierName: item.supplierName,
          items: [],
        };
      }
      groups[item.supplierId].items.push(item);
    });
    return Object.entries(groups);
  }, [selected]);

  return (
    <div>
      <PageHeader
        title="Eksik Ürünler"
        subtitle="Kritik stok seviyesinin altındaki ürünler - Sipariş verilmesi gerekenler"
        actions={
          selected.length > 0 && (
            <button className="btn btn-primary" type="button" onClick={() => setCreateOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusIcon icon="shopping_cart" style={{ fontSize: 16 }} />
              {selected.length} Ürün İçin Sipariş Oluştur
            </button>
          )
        }
      />

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <StatusIcon icon="warning" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Eksik Ürün</div>
            <div className="kpi-value">{formatNumber(summary.total)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="inventory_2" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Toplam Eksik</div>
            <div className="kpi-value">{formatNumber(summary.totalShortage)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="factory" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tedarikçi</div>
            <div className="kpi-value">{formatNumber(summary.suppliersNeeded)}</div>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="kpi-card active">
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <StatusIcon icon="check_circle" />
            </div>
            <div className="kpi-info">
              <div className="kpi-label">Seçilen</div>
              <div className="kpi-value">{formatNumber(selected.length)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <StatusIcon icon="search" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
          <input
            type="search"
            placeholder="Ürün kodu, adı..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 250, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
          />
        </div>

        <select className="form-select" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} style={{ width: 150 }}>
          <option value="all">Tüm Tedarikçiler</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {filteredItems.length} / {items.length}
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
        <Loader text="Eksik ürünler yükleniyor..." />
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <StatusIcon icon="check_circle" style={{ fontSize: 48, color: 'var(--color-success)', marginBottom: 16 }} />
          <h3>Tüm Stoklar Yeterli</h3>
          <p className="text-muted">Kritik seviyenin altında ürün bulunmuyor.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusIcon icon="priority_high" />
              Eksik Ürün Listesi
            </h3>
            <span className="badge badge-warning">{filteredItems.length} ürün</span>
          </div>
          <DataTable
            columns={[
              {
                label: (
                  <input
                    type="checkbox"
                    checked={selected.length === filteredItems.length && filteredItems.length > 0}
                    onChange={selectAll}
                  />
                ),
                accessor: 'select',
                render: (_, row) => (
                  <input
                    type="checkbox"
                    checked={selected.some((s) => s.itemId === row.itemId)}
                    onChange={() => toggleSelect(row)}
                  />
                ),
              },
              {
                label: 'Ürün',
                accessor: 'name',
                render: (_, row) => (
                  <div>
                    <strong>{row.productCode}</strong>-{row.colorCode}
                    <div className="text-muted">{row.name} {row.colorName || ''}</div>
                  </div>
                ),
              },
              {
                label: 'Tedarikçi',
                accessor: 'supplierName',
                render: (val) => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusIcon icon="business" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
                    {val}
                  </span>
                ),
              },
              {
                label: 'Mevcut',
                accessor: 'available',
                render: (val) => (
                  <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                    {formatNumber(val)}
                  </span>
                ),
              },
              {
                label: 'Kritik',
                accessor: 'critical',
                render: (val) => formatNumber(val),
              },
              {
                label: 'Bekleyen Sipariş',
                accessor: 'pendingInOrders',
                render: (val) =>
                  val > 0 ? (
                    <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon icon="local_shipping" style={{ fontSize: 12 }} />
                      {formatNumber(val)} sipariş edildi
                    </span>
                  ) : (
                    '-'
                  ),
              },
              {
                label: 'Önerilen',
                accessor: 'suggestedQty',
                render: (val, row) => (
                  <strong style={{ color: 'var(--color-primary)' }}>
                    {formatNumber(val)} {row.unit}
                  </strong>
                ),
              },
            ]}
            rows={filteredItems}
          />
        </div>
      )}

      {/* Sipariş Oluşturma Onay Modal */}
      <Modal
        open={createOpen}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon icon="shopping_cart" />
            Sipariş Oluştur
          </span>
        }
        size="large"
        onClose={() => setCreateOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setCreateOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusIcon icon="close" style={{ fontSize: 16 }} />
              İptal
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={submitting}
              onClick={createOrders}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <StatusIcon icon={submitting ? 'hourglass_empty' : 'check_circle'} style={{ fontSize: 16 }} />
              {submitting ? 'Oluşturuluyor...' : `${groupedSelected.length} Sipariş Oluştur`}
            </button>
          </>
        }
      >
        <div className="text-muted" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusIcon icon="info" style={{ fontSize: 16 }} />
          Seçilen ürünler tedarikçiye göre gruplandırılarak sipariş oluşturulacak:
        </div>

        {groupedSelected.map(([supplierId, data]) => (
          <div key={supplierId} className="card subtle-card" style={{ marginBottom: 12, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusIcon icon="factory" style={{ fontSize: 16 }} />
              {data.supplierName}
            </div>
            <div style={{ fontSize: 13 }}>
              {data.items.map((item) => (
                <div key={item.itemId} className="metric-row" style={{ padding: '4px 0' }}>
                  <span>
                    {item.productCode}-{item.colorCode} {item.name}
                  </span>
                  <strong>{formatNumber(item.suggestedQty)} {item.unit}</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
};

export default SatinalmaEksik;
