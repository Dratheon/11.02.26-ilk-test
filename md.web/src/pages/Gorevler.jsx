import { useEffect, useState, useMemo } from 'react';
import { StatusIcon } from '../utils/muiIcons';
import DataTable from '../components/DataTable';
import DateInput from '../components/DateInput';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  softDeleteTask,
  assignTask,
  updateTaskStatus,
  getPersonnel,
  getTeams,
} from '../services/dataService';

const DURUM_LABELS = {
  todo: { label: 'Yapılacak', tone: 'secondary', icon: 'assignment' },
  in_progress: { label: 'Devam Ediyor', tone: 'primary', icon: 'sync' },
  blocked: { label: 'Bloke', tone: 'warning', icon: 'block' },
  done: { label: 'Tamamlandı', tone: 'success', icon: 'check_circle' },
};

const ONCELIK_LABELS = {
  low: { label: 'Düşük', tone: 'secondary' },
  med: { label: 'Orta', tone: 'info' },
  high: { label: 'Yüksek', tone: 'warning' },
};

const renderDurum = (durum) => {
  const info = DURUM_LABELS[durum] || { label: durum, tone: 'secondary', icon: 'help_outline' };
  return (
    <span className={`badge badge-${info.tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <StatusIcon icon={info.icon} style={{ fontSize: 14 }} />
      {info.label}
    </span>
  );
};

const renderOncelik = (oncelik) => {
  const info = ONCELIK_LABELS[oncelik] || { label: oncelik, tone: 'secondary' };
  return <span className={`badge badge-${info.tone}`}>{info.label}</span>;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
};

const defaultForm = {
  baslik: '',
  aciklama: '',
  oncelik: 'med',
  durum: 'todo',
  baslangicTarihi: '',
  bitisTarihi: '',
};

const Gorevler = () => {
  const [tasks, setTasks] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [oncelikFilter, setOncelikFilter] = useState('');

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [detailTask, setDetailTask] = useState(null);

  // Assign form state
  const [assignForm, setAssignForm] = useState({
    assigneeType: 'personnel',
    assigneeId: '',
    note: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [tasksData, personnelData, teamsData] = await Promise.all([
          getTasks(),
          getPersonnel(true),
          getTeams(true),
        ]);
        setTasks(tasksData);
        setPersonnel(personnelData);
        setTeams(teamsData);
      } catch (err) {
        setError(err.message || 'Görevler alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // KPI Hesaplamaları
  const kpiStats = useMemo(() => {
    const total = tasks.filter((t) => !t.deleted).length;
    const todo = tasks.filter((t) => !t.deleted && t.durum === 'todo').length;
    const inProgress = tasks.filter((t) => !t.deleted && t.durum === 'in_progress').length;
    const blocked = tasks.filter((t) => !t.deleted && t.durum === 'blocked').length;
    const done = tasks.filter((t) => !t.deleted && t.durum === 'done').length;

    return { total, todo, inProgress, blocked, done };
  }, [tasks]);

  const getAssigneeName = (task) => {
    if (task.assigneeName) {
      return task.assigneeType === 'team' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><StatusIcon icon="groups" style={{ fontSize: 16 }} /> {task.assigneeName}</span> : task.assigneeName;
    }
    return 'Atanmamış';
  };

  const filtered = useMemo(() => {
    let result = tasks.filter((t) => !t.deleted);
    if (durumFilter) {
      result = result.filter((t) => t.durum === durumFilter);
    }
    if (oncelikFilter) {
      result = result.filter((t) => t.oncelik === oncelikFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (t) =>
          (t.baslik || '').toLowerCase().includes(q) ||
          (t.aciklama || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, search, durumFilter, oncelikFilter]);

  // CRUD Handlers
  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      baslik: task.baslik || '',
      aciklama: task.aciklama || '',
      oncelik: task.oncelik || 'med',
      durum: task.durum || 'todo',
      baslangicTarihi: task.baslangicTarihi || '',
      bitisTarihi: task.bitisTarihi || '',
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const openAssign = (task) => {
    setAssignTarget(task);
    setAssignForm({
      assigneeType: 'personnel',
      assigneeId: '',
      note: '',
    });
    setAssignModalOpen(true);
  };

  const openDetail = async (task) => {
    try {
      const fullTask = await getTask(task.id);
      setDetailTask(fullTask);
      setDetailModalOpen(true);
    } catch (err) {
      setError(err.message || 'Görev detayı alınamadı');
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.baslik.trim()) errors.baslik = 'Başlık gerekli';
    if (form.baslangicTarihi && form.bitisTarihi) {
      const start = new Date(form.baslangicTarihi);
      const end = new Date(form.bitisTarihi);
      if (end < start) {
        errors.bitisTarihi = 'Bitiş tarihi başlangıç tarihinden önce olamaz';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveForm = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      setError('');
      if (editing) {
        const updated = await updateTask(editing.id, form);
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setEditing(null);
      } else {
        const newTask = await createTask(form);
        setTasks((prev) => [newTask, ...prev]);
      }
      setForm(defaultForm);
      setFormOpen(false);
    } catch (err) {
      setError(err.message || 'Görev kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteTask(deleteTarget.id);
      setTasks((prev) =>
        prev.map((t) => (t.id === deleteTarget.id ? { ...t, deleted: true } : t))
      );
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Görev silinemedi');
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignTarget || !assignForm.assigneeId) {
      setError('Lütfen atama yapılacak kişi veya ekibi seçin');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await assignTask(assignTarget.id, assignForm);
      // Listeyi yenile
      const tasksData = await getTasks();
      setTasks(tasksData);
      setAssignModalOpen(false);
      setAssignTarget(null);
      setAssignForm({ assigneeType: 'personnel', assigneeId: '', note: '' });
    } catch (err) {
      setError(err.message || 'Atama yapılamadı');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      const updated = await updateTaskStatus(task.id, newStatus);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err.message || 'Durum güncellenemedi');
    }
  };

  const columns = useMemo(
    () => [
      {
        accessor: 'baslik',
        label: 'Görev',
        render: (baslik, row) => (
          <div>
            <div className="font-medium">{baslik}</div>
            {row.aciklama && (
              <div className="text-sm text-muted">{row.aciklama.substring(0, 50)}...</div>
            )}
          </div>
        ),
      },
      {
        accessor: 'oncelik',
        label: 'Öncelik',
        render: (oncelik) => renderOncelik(oncelik),
      },
      {
        accessor: 'durum',
        label: 'Durum',
        render: (durum) => renderDurum(durum),
      },
      {
        accessor: 'bitisTarihi',
        label: 'Termin',
        render: (bitisTarihi) => formatDate(bitisTarihi),
      },
      {
        accessor: 'assignee',
        label: 'Atanan',
        render: (_, row) => getAssigneeName(row),
      },
      {
        accessor: 'actions',
        label: 'İşlem',
        render: (_, row) => (
          <div className="action-buttons" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-sm btn-secondary btn-icon"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openDetail(row);
              }}
              title="Detay"
            >
              <StatusIcon icon="visibility" />
            </button>
            <button
              className="btn btn-sm btn-primary btn-icon"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
              title="Düzenle"
              data-testid="btn-edit"
            >
              <StatusIcon icon="edit" />
            </button>
            <button
              className="btn btn-sm btn-info btn-icon"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openAssign(row);
              }}
              title="Ata"
              data-testid="btn-assign"
            >
              <StatusIcon icon="person" />
            </button>
            <button
              className="btn btn-sm btn-danger btn-icon"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
              title="Sil"
            >
              <StatusIcon icon="delete" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  if (loading) return <Loader />;

  return (
    <div data-testid="gorevler-page">
      <PageHeader
        title="Görevler"
        subtitle="Ekip görevlerinizi durumlarına göre takip edin"
        actions={
          <button className="btn btn-primary" type="button" onClick={openCreate} data-testid="btn-new-task">
            + Yeni Görev
          </button>
        }
      />

      {error && (
        <div className="card error-card">
          <div className="error-title">Hata</div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* KPI Kartları */}
      <div className="kpi-cards-container">
        <div
          className={`kpi-card ${durumFilter === '' ? 'active' : ''}`}
          onClick={() => setDurumFilter('')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <StatusIcon icon="assignment" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Toplam Görev</div>
            <div className="kpi-value">{kpiStats.total}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${durumFilter === 'todo' ? 'active' : ''}`}
          onClick={() => setDurumFilter(durumFilter === 'todo' ? '' : 'todo')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' }}>
            <StatusIcon icon="edit_note" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Yapılacak</div>
            <div className="kpi-value">{kpiStats.todo}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${durumFilter === 'in_progress' ? 'active' : ''}`}
          onClick={() => setDurumFilter(durumFilter === 'in_progress' ? '' : 'in_progress')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            <StatusIcon icon="sync" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Devam Ediyor</div>
            <div className="kpi-value">{kpiStats.inProgress}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${durumFilter === 'blocked' ? 'active' : ''}`}
          onClick={() => setDurumFilter(durumFilter === 'blocked' ? '' : 'blocked')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <StatusIcon icon="block" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Bloke</div>
            <div className="kpi-value">{kpiStats.blocked}</div>
          </div>
        </div>

        <div
          className={`kpi-card ${durumFilter === 'done' ? 'active' : ''}`}
          onClick={() => setDurumFilter(durumFilter === 'done' ? '' : 'done')}
        >
          <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <StatusIcon icon="check_circle" />
          </div>
          <div className="kpi-info">
            <div className="kpi-label">Tamamlandı</div>
            <div className="kpi-value">{kpiStats.done}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <StatusIcon icon="search" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
          <input
            type="text"
            placeholder="Görev ara (başlık, açıklama)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 400, border: 'none', background: 'transparent', padding: '8px 0', fontSize: 14 }}
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
          {Object.entries(ONCELIK_LABELS).map(([key, config]) => (
            <button
              key={key}
              className={`filter-toggle-btn ${oncelikFilter === key ? 'active' : ''}`}
              onClick={() => setOncelikFilter(oncelikFilter === key ? '' : key)}
            >
              {config.label}
            </button>
          ))}
        </div>
        
        <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {filtered.length} / {kpiStats.total} görev
        </span>
      </div>

      {/* Görev Tablosu */}
      <div className="card" data-testid="tasks-table-card">
        <DataTable columns={columns} rows={filtered} emptyMessage="Henüz görev bulunmamaktadır. Yeni görev oluşturmak için üstteki 'Yeni Görev' butonuna tıklayın." />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setForm(defaultForm);
          setFormErrors({});
        }}
        title={editing ? <><StatusIcon icon="edit" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Görev Düzenle</> : <><StatusIcon icon="add_task" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Yeni Görev Oluştur</>}
      >
        <form onSubmit={saveForm}>
          {/* Başlık */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusIcon icon="assignment" style={{ fontSize: 18 }} /> Başlık <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              className={`form-input ${formErrors.baslik ? 'input-error' : ''}`}
              value={form.baslik}
              onChange={(e) => setForm({ ...form, baslik: e.target.value })}
              placeholder="Örn: Atölye kesim listesi hazırlama"
              data-testid="input-task-baslik"
            />
            {formErrors.baslik && (
              <div className="form-error" style={{ marginTop: 6, fontSize: 13, color: 'var(--color-danger)' }}>
                <StatusIcon icon="warning" style={{ fontSize: 14, marginRight: 4 }} /> {formErrors.baslik}
              </div>
            )}
          </div>

          {/* Açıklama */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusIcon icon="description" style={{ fontSize: 18 }} /> Açıklama</label>
            <textarea
              className="form-textarea"
              rows="4"
              value={form.aciklama}
              onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
              placeholder="Görev detaylarını buraya yazabilirsiniz..."
              style={{ minHeight: 100 }}
            />
          </div>

          {/* Öncelik ve Durum - İki Kolon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusIcon icon="priority_high" style={{ fontSize: 18 }} /> Öncelik</label>
              <select
                className="form-select"
                value={form.oncelik}
                onChange={(e) => setForm({ ...form, oncelik: e.target.value })}
              >
                <option value="low">Düşük</option>
                <option value="med">Orta</option>
                <option value="high">Yüksek</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusIcon icon="pending_actions" style={{ fontSize: 18 }} /> Durum</label>
              <select
                className="form-select"
                value={form.durum}
                onChange={(e) => setForm({ ...form, durum: e.target.value })}
              >
                <option value="todo">Yapılacak</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="blocked">Bloke</option>
                <option value="done">Tamamlandı</option>
              </select>
            </div>
          </div>

          {/* Tarihler - İki Kolon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusIcon icon="event" style={{ fontSize: 18 }} /> Başlangıç Tarihi</label>
              <DateInput
                value={form.baslangicTarihi ? form.baslangicTarihi.split('T')[0] : ''}
                onChange={(val) => setForm({ ...form, baslangicTarihi: val ? `${val}T00:00:00` : '' })}
                style={{ fontSize: 16 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                <StatusIcon icon="event_available" style={{ fontSize: 18, marginRight: 6 }} /> Bitiş Tarihi
              </label>
              <DateInput
                className={`form-input ${formErrors.bitisTarihi ? 'input-error' : ''}`}
                value={form.bitisTarihi ? form.bitisTarihi.split('T')[0] : ''}
                onChange={(val) => setForm({ ...form, bitisTarihi: val ? `${val}T00:00:00` : '' })}
                style={{ fontSize: 16 }}
              />
              {formErrors.bitisTarihi && (
                <div className="form-error" style={{ marginTop: 6, fontSize: 13, color: 'var(--color-danger)' }}>
                  <StatusIcon icon="warning" style={{ fontSize: 14, marginRight: 4 }} /> {formErrors.bitisTarihi}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="modal-actions" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              <StatusIcon icon="close" style={{ fontSize: 18, marginRight: 4 }} /> İptal
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting} data-testid="btn-task-save">
              {submitting ? <><StatusIcon icon="hourglass_empty" style={{ fontSize: 18, marginRight: 4 }} /> Kaydediliyor...</> : editing ? <><StatusIcon icon="save" style={{ fontSize: 18, marginRight: 4 }} /> Güncelle</> : <><StatusIcon icon="add" style={{ fontSize: 18, marginRight: 4 }} /> Oluştur</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setAssignTarget(null);
          setAssignForm({ assigneeType: 'personnel', assigneeId: '', note: '' });
        }}
        title={<><StatusIcon icon="person_add" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Görev Ata</>}
      >
        {assignTarget && (
          <form onSubmit={handleAssign}>
            {/* Görev Bilgisi */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusIcon icon="assignment" style={{ fontSize: 18 }} /> Görev</label>
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 14,
                  color: 'var(--color-text)',
                }}
              >
                {assignTarget.baslik}
              </div>
            </div>

            {/* Atama Tipi */}
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon="category" style={{ fontSize: 18, marginRight: 6 }} /> Atama Tipi <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="form-select"
                value={assignForm.assigneeType}
                onChange={(e) => setAssignForm({ ...assignForm, assigneeType: e.target.value, assigneeId: '' })}
                data-testid="select-assignee-type"
              >
                <option value="personnel">Personel</option>
                <option value="team">Ekip</option>
              </select>
            </div>

            {/* Personel/Ekip Seçimi */}
            <div className="form-group">
              <label className="form-label">
                <StatusIcon icon={assignForm.assigneeType === 'personnel' ? 'person' : 'groups'} style={{ fontSize: 18, marginRight: 6 }} /> {assignForm.assigneeType === 'personnel' ? 'Personel' : 'Ekip'}{' '}
                <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="form-select"
                value={assignForm.assigneeId}
                onChange={(e) => setAssignForm({ ...assignForm, assigneeId: e.target.value })}
                data-testid="select-assignee"
              >
                <option value="">Seçin...</option>
                {assignForm.assigneeType === 'personnel'
                  ? personnel
                      .filter((p) => p.aktifMi && !p.deleted)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.ad} {p.soyad} {p.email ? `(${p.email})` : ''}
                        </option>
                      ))
                  : teams
                      .filter((t) => t.aktifMi && !t.deleted)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.ad} {t.aciklama ? `- ${t.aciklama}` : ''}
                        </option>
                      ))}
              </select>
            </div>

            {/* Not */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusIcon icon="notes" style={{ fontSize: 18 }} /> Not (Opsiyonel)</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={assignForm.note}
                onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
                placeholder="Atama ile ilgili notlarınızı buraya yazabilirsiniz..."
                style={{ minHeight: 80 }}
              />
            </div>

            {/* Actions */}
            <div className="modal-actions" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAssignModalOpen(false)}
              >
                <StatusIcon icon="close" style={{ fontSize: 18, marginRight: 4 }} /> İptal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !assignForm.assigneeId} data-testid="btn-assign-submit">
                {submitting ? <><StatusIcon icon="hourglass_empty" style={{ fontSize: 18, marginRight: 4 }} /> Atanıyor...</> : <><StatusIcon icon="check" style={{ fontSize: 18, marginRight: 4 }} /> Ata</>}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailTask(null);
        }}
        title={<><StatusIcon icon="assignment" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Görev Detayı</>}
        size="large"
      >
        {detailTask && (
          <div>
            {/* Header */}
            <div style={{ marginBottom: 32, paddingBottom: 20, borderBottom: '2px solid var(--color-border)' }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: 'var(--color-text)' }}>
                {detailTask.baslik}
              </h2>
              {detailTask.aciklama && (
                <p style={{ fontSize: 15, color: 'var(--color-text-light)', lineHeight: 1.6, margin: 0 }}>
                  {detailTask.aciklama}
                </p>
              )}
            </div>

            {/* Özellikler - İki Kolon Grid */}
            <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text)' }}>
                <StatusIcon icon="info" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Görev Bilgileri
              </h3>
              <div className="grid grid-2" style={{ gap: 16 }}>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}><StatusIcon icon="priority_high" style={{ marginRight: 6, fontSize: 14 }} /> Öncelik</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{renderOncelik(detailTask.oncelik)}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}><StatusIcon icon="pending_actions" style={{ marginRight: 6, fontSize: 14 }} /> Durum</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{renderDurum(detailTask.durum)}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}><StatusIcon icon="event" style={{ marginRight: 6, fontSize: 14 }} /> Başlangıç</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{formatDate(detailTask.baslangicTarihi) || '-'}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}><StatusIcon icon="event_available" style={{ marginRight: 6, fontSize: 14 }} /> Bitiş</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{formatDate(detailTask.bitisTarihi) || '-'}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}><StatusIcon icon="schedule" style={{ marginRight: 6, fontSize: 14 }} /> Oluşturulma</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{formatDateTime(detailTask.createdAt)}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}><StatusIcon icon="update" style={{ marginRight: 6, fontSize: 14 }} /> Güncellenme</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{formatDateTime(detailTask.updatedAt)}</div>
                </div>
              </div>
            </div>

            {/* Mevcut Atamalar */}
            <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text)' }}>
                <StatusIcon icon="groups" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Mevcut Atamalar
              </h3>
              {detailTask.currentAssignments && detailTask.currentAssignments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {detailTask.currentAssignments.map((assignment) => {
                    const personnelMap = personnel.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
                    const teamsMap = teams.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});
                    let assigneeName = 'Bilinmiyor';
                    if (assignment.assigneeType === 'personnel') {
                      const person = personnelMap[assignment.assigneeId];
                      if (person) assigneeName = `${person.ad} ${person.soyad}`;
                    } else if (assignment.assigneeType === 'team') {
                      const team = teamsMap[assignment.assigneeId];
                      if (team) assigneeName = team.ad;
                    }
                    
                    return (
                      <div 
                        key={assignment.id} 
                        style={{
                          padding: 16,
                          background: 'var(--color-bg)',
                          borderRadius: 8,
                          border: '1px solid var(--color-primary)',
                          borderLeftWidth: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>
                            <StatusIcon icon={assignment.assigneeType === 'personnel' ? 'person' : 'groups'} />
                          </span>
                          <strong style={{ fontSize: 15 }}>
                            {assignment.assigneeType === 'personnel' ? 'Personel' : 'Ekip'}
                          </strong>
                          <span style={{ fontSize: 15, fontWeight: 500 }}>{assigneeName}</span>
                        </div>
                        {assignment.note && (
                          <div style={{ 
                            marginTop: 8, 
                            padding: 8, 
                            background: 'var(--color-white)', 
                            borderRadius: 4,
                            fontSize: 13,
                            color: 'var(--color-text-light)'
                          }}>
                            <StatusIcon icon="notes" style={{ fontSize: 14, marginRight: 4 }} /> {assignment.note}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginTop: 8 }}>
                          <StatusIcon icon="schedule" style={{ fontSize: 14, marginRight: 6 }} /> {formatDateTime(assignment.createdAt)} tarihinde atandı
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ 
                  padding: 24, 
                  textAlign: 'center', 
                  background: 'var(--color-bg)', 
                  borderRadius: 8,
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-light)'
                }}>
                  <StatusIcon icon="inbox" style={{ fontSize: 18, marginRight: 8 }} /> Henüz atama yapılmamış
                </div>
              )}
            </div>

            {/* Atama Geçmişi */}
            {detailTask.assignmentHistory && detailTask.assignmentHistory.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text)' }}>
                  <StatusIcon icon="history" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Atama Geçmişi
                </h3>
                <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detailTask.assignmentHistory.map((assignment) => {
                    const personnelMap = personnel.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
                    const teamsMap = teams.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});
                    let assigneeName = 'Bilinmiyor';
                    if (assignment.assigneeType === 'personnel') {
                      const person = personnelMap[assignment.assigneeId];
                      if (person) assigneeName = `${person.ad} ${person.soyad}`;
                    } else if (assignment.assigneeType === 'team') {
                      const team = teamsMap[assignment.assigneeId];
                      if (team) assigneeName = team.ad;
                    }
                    
                    return (
                      <div
                        key={assignment.id}
                        style={{
                          padding: 12,
                          background: 'var(--color-bg)',
                          borderRadius: 6,
                          borderLeft: assignment.active ? '4px solid var(--color-primary)' : '4px solid var(--color-border)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <StatusIcon icon={assignment.assigneeType === 'personnel' ? 'person' : 'groups'} />
                            <strong style={{ fontSize: 14 }}>
                              {assignment.assigneeType === 'personnel' ? 'Personel' : 'Ekip'}
                            </strong>
                            <span style={{ fontSize: 14 }}>{assigneeName}</span>
                          </div>
                          {assignment.active && (
                            <span className="badge badge-success" style={{ fontSize: 11 }}>
                              <StatusIcon icon="check_circle" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }} /> Aktif
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: assignment.note ? 6 : 0 }}>
                          <StatusIcon icon="schedule" style={{ fontSize: 14, marginRight: 6 }} /> {formatDateTime(assignment.createdAt)}
                        </div>
                        {assignment.note && (
                          <div style={{ 
                            fontSize: 13, 
                            color: 'var(--color-text-light)', 
                            marginTop: 6,
                            paddingTop: 6,
                            borderTop: '1px solid var(--color-border)'
                          }}>
                            <StatusIcon icon="notes" style={{ fontSize: 14, marginRight: 6 }} /> {assignment.note}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div 
              className="modal-actions" 
              style={{ 
                marginTop: 32, 
                paddingTop: 24, 
                borderTop: '2px solid var(--color-border)',
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end'
              }}
            >
              {detailTask.durum !== 'done' && (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => {
                    const nextStatus =
                      detailTask.durum === 'todo'
                        ? 'in_progress'
                        : detailTask.durum === 'in_progress'
                        ? 'done'
                        : 'todo';
                    handleStatusChange(detailTask, nextStatus);
                    setDetailModalOpen(false);
                  }}
                >
                  {detailTask.durum === 'todo'
                    ? <><StatusIcon icon="play_arrow" style={{ fontSize: 18, marginRight: 4 }} /> Başlat</>
                    : detailTask.durum === 'in_progress'
                    ? <><StatusIcon icon="check_circle" style={{ fontSize: 18, marginRight: 4 }} /> Tamamla</>
                    : <><StatusIcon icon="refresh" style={{ fontSize: 18, marginRight: 4 }} /> Yeniden Aç</>}
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDetailModalOpen(false);
                  openEdit(detailTask);
                }}
              >
                <StatusIcon icon="edit" style={{ fontSize: 18, marginRight: 4 }} /> Düzenle
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDetailModalOpen(false)}
              >
                <StatusIcon icon="close" style={{ fontSize: 18, marginRight: 4 }} /> Kapat
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={<><StatusIcon icon="delete" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Görev Sil</>}
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
              {deleteTarget && deleteTarget.baslik}
            </strong>
            {' '}görevini silmek istediğinize emin misiniz?
          </p>
          <p style={{ 
            fontSize: 13, 
            textAlign: 'center', 
            color: 'var(--color-text-light)',
            marginBottom: 0
          }}>
            Bu işlem geri alınamaz ve görev listeden kaldırılacaktır.
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
            <StatusIcon icon="close" style={{ fontSize: 18, marginRight: 4 }} /> İptal
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            <StatusIcon icon="delete" style={{ fontSize: 18, marginRight: 4 }} /> Sil
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Gorevler;
