import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { getRoles, createRole, updateRole, softDeleteRole } from '../services/dataService';

const defaultForm = {
  ad: '',
  aciklama: '',
  permissions: [],
  aktifMi: true,
};

const AVAILABLE_PERMISSIONS = [
  { value: '*', label: 'Tüm Yetkiler (Admin)' },
  { value: 'tasks.*', label: 'Tüm Görev İşlemleri' },
  { value: 'tasks.view', label: 'Görevleri Görüntüle' },
  { value: 'tasks.create', label: 'Görev Oluştur' },
  { value: 'tasks.update', label: 'Görev Güncelle' },
  { value: 'tasks.delete', label: 'Görev Sil' },
  { value: 'personnel.*', label: 'Tüm Personel İşlemleri' },
  { value: 'personnel.view', label: 'Personeli Görüntüle' },
  { value: 'personnel.create', label: 'Personel Oluştur' },
  { value: 'personnel.update', label: 'Personel Güncelle' },
  { value: 'teams.*', label: 'Tüm Ekip İşlemleri' },
  { value: 'teams.view', label: 'Ekipleri Görüntüle' },
  { value: 'teams.create', label: 'Ekip Oluştur' },
  { value: 'teams.update', label: 'Ekip Güncelle' },
];

const Roles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [aktifFilter, setAktifFilter] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getRoles();
        setRoles(data);
      } catch (err) {
        setError(err.message || 'Rol verileri alınamadı');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = roles.filter((r) => !r.deleted);
    if (aktifFilter !== null) {
      result = result.filter((r) => r.aktifMi === aktifFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          (r.ad || '').toLowerCase().includes(q) ||
          (r.aciklama || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [roles, search, aktifFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setForm({
      ad: role.ad || '',
      aciklama: role.aciklama || '',
      permissions: role.permissions || [],
      aktifMi: role.aktifMi !== false,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors = {};
    if (!form.ad.trim()) errors.ad = 'Rol adı gerekli';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const togglePermission = (perm) => {
    setForm((prev) => {
      const perms = prev.permissions || [];
      if (perms.includes(perm)) {
        return { ...prev, permissions: perms.filter((p) => p !== perm) };
      }
      return { ...prev, permissions: [...perms, perm] };
    });
  };

  const saveForm = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      setError('');
      if (editing) {
        const updated = await updateRole(editing.id, form);
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setEditing(null);
      } else {
        const newRole = await createRole(form);
        setRoles((prev) => [newRole, ...prev]);
      }
      setForm(defaultForm);
      setFormOpen(false);
    } catch (err) {
      setError(err.message || 'Kayıt başarısız');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteRole(deleteTarget.id);
      setRoles((prev) =>
        prev.map((r) => (r.id === deleteTarget.id ? { ...r, deleted: true, aktifMi: false } : r))
      );
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Silme işlemi başarısız');
    }
  };

  const columns = useMemo(
    () => [
      { accessor: 'ad', label: 'Rol Adı' },
      { accessor: 'aciklama', label: 'Açıklama' },
      {
        accessor: 'permissions',
        label: 'İzinler',
        render: (permissions) => (
          <span className="badge badge-info">
            {permissions?.length || 0} izin
          </span>
        ),
      },
      {
        accessor: 'aktifMi',
        label: 'Durum',
        render: (aktifMi) => (
          <span className={`badge ${aktifMi ? 'badge-success' : 'badge-secondary'}`}>
            {aktifMi ? 'Aktif' : 'Pasif'}
          </span>
        ),
      },
      {
        accessor: 'actions',
        label: 'İşlem',
        render: (_, row) => (
          <div className="action-buttons">
            <button
              className="btn btn-sm btn-secondary"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
            >
              Düzenle
            </button>
            <button
              className="btn btn-sm btn-danger"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
            >
              Sil
            </button>
          </div>
        ),
      },
    ],
    []
  );

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Rol Yönetimi"
        subtitle="Rolleri ve izinleri yönetin"
        actions={
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            + Yeni Rol
          </button>
        }
      />

      {error && (
        <div className="card error-card">
          <div className="error-title">Hata</div>
          <div className="error-message">{error}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="filters">
            <input
              type="text"
              className="input"
              placeholder="Ara (ad, açıklama)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select"
              value={aktifFilter === null ? 'all' : aktifFilter ? 'aktif' : 'pasif'}
              onChange={(e) => {
                const val = e.target.value;
                setAktifFilter(val === 'all' ? null : val === 'aktif');
              }}
            >
              <option value="all">Tümü</option>
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
            </select>
          </div>
        </div>
        <DataTable columns={columns} rows={filtered} />
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setForm(defaultForm);
          setFormErrors({});
        }}
        title={editing ? <><StatusIcon icon="edit" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Rol Düzenle</> : <><StatusIcon icon="add_moderator" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Yeni Rol</>}
      >
        <form onSubmit={saveForm}>
          {/* Rol Adı */}
          <div className="form-group">
            <label className="form-label">
              <StatusIcon icon="badge" style={{ marginRight: 6, fontSize: 18 }} /> Rol Adı <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              className={`form-input ${formErrors.ad ? 'input-error' : ''}`}
              value={form.ad}
              onChange={(e) => setForm({ ...form, ad: e.target.value })}
              placeholder="Örn: admin, manager, user"
            />
            {formErrors.ad && (
              <div className="form-error" style={{ marginTop: 6, fontSize: 13, color: 'var(--color-danger)' }}>
                <StatusIcon icon="warning" style={{ marginRight: 6, fontSize: 14 }} /> {formErrors.ad}
              </div>
            )}
          </div>

          {/* Açıklama */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusIcon icon="description" style={{ fontSize: 18 }} /> Açıklama</label>
            <textarea
              className="form-textarea"
              rows="3"
              value={form.aciklama}
              onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
              placeholder="Rol hakkında açıklama yazabilirsiniz..."
              style={{ minHeight: 80 }}
            />
          </div>

          {/* İzinler */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusIcon icon="vpn_key" style={{ fontSize: 18 }} /> İzinler</label>
            <div 
              style={{
                padding: 16,
                background: 'var(--color-bg)',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                maxHeight: 200,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <label 
                  key={perm.value} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    cursor: 'pointer',
                    padding: '4px 0'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(perm.value)}
                    onChange={() => togglePermission(perm.value)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14 }}>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Aktif */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.aktifMi}
                onChange={(e) => setForm({ ...form, aktifMi: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <StatusIcon icon="check_circle" style={{ marginRight: 6, fontSize: 18 }} /> Aktif
            </label>
          </div>

          {/* Actions */}
          <div className="modal-actions" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              <StatusIcon icon="close" style={{ marginRight: 6, fontSize: 18 }} /> İptal
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><StatusIcon icon="hourglass_empty" style={{ marginRight: 6, fontSize: 18 }} /> Kaydediliyor...</> : editing ? <><StatusIcon icon="save" style={{ marginRight: 6, fontSize: 18 }} /> Güncelle</> : <><StatusIcon icon="add" style={{ marginRight: 6, fontSize: 18 }} /> Oluştur</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={<><StatusIcon icon="delete" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Rol Sil</>}
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: 24,
            fontSize: 48
          }}>
            <StatusIcon icon="warning" style={{ fontSize: 48, color: 'var(--color-warning)' }} />
          </div>
          <p style={{ 
            fontSize: 16, 
            textAlign: 'center', 
            marginBottom: 8,
            color: 'var(--color-text)',
            lineHeight: 1.6
          }}>
            <strong style={{ fontSize: 18, color: 'var(--color-danger)' }}>
              {deleteTarget && deleteTarget.ad}
            </strong>
            {' '}rolünü silmek istediğinize emin misiniz?
          </p>
          <p style={{ 
            fontSize: 13, 
            textAlign: 'center', 
            color: 'var(--color-text-light)',
            marginBottom: 0
          }}>
            Bu işlem geri alınamaz ve rol listeden kaldırılacaktır.
          </p>
        </div>
        <div 
          className="modal-actions" 
          style={{ 
            marginTop: 32, 
            paddingTop: 20, 
            borderTop: '1px solid var(--color-border)'
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
            <StatusIcon icon="close" style={{ marginRight: 6, fontSize: 18 }} /> İptal
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            <StatusIcon icon="delete" style={{ marginRight: 6, fontSize: 18 }} /> Sil
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Roles;
