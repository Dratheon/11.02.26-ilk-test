import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import DateInput from '../components/DateInput';
import Modal from '../components/Modal';
import AutocompleteInput from '../components/AutocompleteInput';
import AssemblyKPICards from '../components/AssemblyKPICards';
import { StatusIcon } from '../utils/muiIcons';
import {
  getAssemblyTasks,
  getAssemblySummary,
  updateAssemblyTask,
  getTeams,
  getPersonnel,
  checkTeamAvailability,
} from '../services/dataService';

const STATUS_MAP = {
  pending: { label: 'Planlanmadı', color: 'var(--text-muted)', icon: 'hourglass_empty' },
  planned: { label: 'Planlandı', color: 'var(--info)', icon: 'event' },
  in_progress: { label: 'Devam Ediyor', color: 'var(--warning)', icon: 'engineering' },
  completed: { label: 'Tamamlandı', color: 'var(--success)', icon: 'check_circle' },
  blocked: { label: 'Beklemede', color: 'var(--danger)', icon: 'block' },
};

const MontajPlanlanan = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [teams, setTeams] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('week'); // week | month | all
  const [kpiFilter, setKpiFilter] = useState(null);
  
  // Planlama Modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [planForm, setPlanForm] = useState({
    plannedDate: '',
    teamId: '',
    teamName: '',
    assignedPersonnel: [],
  });
  const [teamWarning, setTeamWarning] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters = {};
      
      // Tarih filtresi
      const today = new Date();
      if (dateRange === 'week') {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        filters.dateTo = nextWeek.toISOString().slice(0, 10);
      } else if (dateRange === 'month') {
        const nextMonth = new Date(today);
        nextMonth.setMonth(today.getMonth() + 1);
        filters.dateTo = nextMonth.toISOString().slice(0, 10);
      }
      
      const [tasksData, summaryData, teamsData, personnelData] = await Promise.all([
        getAssemblyTasks(filters),
        getAssemblySummary(),
        getTeams(),
        getPersonnel(),
      ]);
      
      setTasks(tasksData || []);
      setSummary(summaryData || {});
      setTeams(teamsData || []);
      setPersonnel(personnelData || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    
    // KPI filtresi
    if (kpiFilter) {
      result = result.filter(t => t.status === kpiFilter);
    } else if (statusFilter) {
      result = result.filter(t => t.status === statusFilter);
    }
    
    if (teamFilter) {
      result = result.filter(t => t.teamId === teamFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.customerName?.toLowerCase().includes(q) ||
        t.roleName?.toLowerCase().includes(q) ||
        t.stageName?.toLowerCase().includes(q) ||
        t.location?.toLowerCase().includes(q)
      );
    }
    
    // Sırala: planlanmamış önce, sonra tarihe göre
    result.sort((a, b) => {
      if (!a.plannedDate && b.plannedDate) return -1;
      if (a.plannedDate && !b.plannedDate) return 1;
      if (a.plannedDate && b.plannedDate) {
        return a.plannedDate.localeCompare(b.plannedDate);
      }
      return 0;
    });
    
    return result;
  }, [tasks, statusFilter, teamFilter, search, kpiFilter]);

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('tr-TR', { 
        day: 'numeric', 
        month: 'short',
        weekday: 'short'
      });
    } catch {
      return d;
    }
  };

  const openPlanModal = (task) => {
    setSelectedTask(task);
    setPlanForm({
      plannedDate: task.plannedDate || task.estimatedDate || '',
      teamId: task.teamId || '',
      teamName: task.teamName || '',
      assignedPersonnel: task.assignedPersonnel || [],
    });
    setTeamWarning(null);
    setShowPlanModal(true);
  };

  const handleTeamChange = async (teamId) => {
    const team = teams.find(t => t.id === teamId);
    setPlanForm(prev => ({
      ...prev,
      teamId,
      teamName: team?.ad || '',
      assignedPersonnel: [],
    }));
    
    // Müsaitlik kontrolü
    if (teamId && planForm.plannedDate) {
      try {
        const availability = await checkTeamAvailability(teamId, planForm.plannedDate);
        setTeamWarning(availability.warning);
      } catch {
        setTeamWarning(null);
      }
    }
  };

  const handleDateChange = async (date) => {
    setPlanForm(prev => ({ ...prev, plannedDate: date }));
    
    // Müsaitlik kontrolü
    if (planForm.teamId && date) {
      try {
        const availability = await checkTeamAvailability(planForm.teamId, date);
        setTeamWarning(availability.warning);
      } catch {
        setTeamWarning(null);
      }
    }
  };

  const savePlan = async () => {
    if (!selectedTask) return;
    
    try {
      setSaving(true);
      await updateAssemblyTask(selectedTask.id, {
        plannedDate: planForm.plannedDate,
        teamId: planForm.teamId,
        teamName: planForm.teamName,
        assignedPersonnel: planForm.assignedPersonnel,
        status: planForm.plannedDate ? 'planned' : 'pending',
      });
      await loadData();
      setShowPlanModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      header: 'Müşteri / Konum',
      accessor: 'customerName',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.customerName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            📍 {row.location || 'Konum belirtilmedi'}
          </div>
        </div>
      ),
    },
    {
      header: 'İş Kolu / Aşama',
      accessor: 'roleName',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.roleName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {row.stageName}
          </div>
        </div>
      ),
    },
    {
      header: 'Müşteri Termini',
      accessor: 'estimatedDate',
      render: (val, row) => (
        <div>
          <div style={{ color: row.isOverdue ? 'var(--danger)' : 'inherit' }}>
            {formatDate(val)}
          </div>
          {row.isOverdue && (
            <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
              ⏰ {Math.abs(row.daysUntilEstimated)} gün geçti
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Planlanan Tarih',
      accessor: 'plannedDate',
      render: (val) => (
        <div style={{ color: val ? 'inherit' : 'var(--text-muted)' }}>
          {val ? formatDate(val) : 'Planlanmadı'}
        </div>
      ),
    },
    {
      header: 'Ekip',
      accessor: 'teamName',
      render: (val) => val || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      header: 'Durum',
      accessor: 'status',
      render: (val) => {
        const status = STATUS_MAP[val] || {};
        return (
          <span 
            className="badge" 
            style={{ background: status.color, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <StatusIcon icon={status.icon} style={{ fontSize: '14px' }} /> {status.label}
          </span>
        );
      },
    },
    {
      header: 'İşlem',
      accessor: 'actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => openPlanModal(row)}
            title="Planla"
          >
            <StatusIcon icon="event" />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => navigate(`/isler/list?job=${row.jobId}&stage=5`)}
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
        <PageHeader title="Planlanan Montajlar" subtitle="Yükleniyor..." />
        <div className="card subtle-card">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Planlanan Montajlar"
        subtitle={`${filteredTasks.length} montaj görevi`}
      />

      {/* KPI Cards */}
      <AssemblyKPICards
        tasks={tasks}
        onFilterClick={(id, filterValue) => {
          if (kpiFilter === id) {
            setKpiFilter(null);
            setStatusFilter('');
          } else {
            setKpiFilter(id);
            setStatusFilter(filterValue);
          }
        }}
        activeFilter={kpiFilter}
        variant="default"
      />

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group" style={{ flex: 1 }}>
          <div className="filter-input-wrapper">
            <StatusIcon icon="search" />
            <input
              type="text"
              className="filter-input"
              placeholder="Müşteri, konum, iş kolu ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <select
            className="filter-select"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="">Tüm Ekipler</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.ad}</option>
            ))}
          </select>
        </div>

        <div className="filter-toggle-group">
          <button
            type="button"
            className={`filter-toggle-btn ${dateRange === 'week' ? 'active' : ''}`}
            onClick={() => setDateRange('week')}
          >
            Bu Hafta
          </button>
          <button
            type="button"
            className={`filter-toggle-btn ${dateRange === 'month' ? 'active' : ''}`}
            onClick={() => setDateRange('month')}
          >
            Bu Ay
          </button>
          <button
            type="button"
            className={`filter-toggle-btn ${dateRange === 'all' ? 'active' : ''}`}
            onClick={() => setDateRange('all')}
          >
            Tümü
          </button>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="card">
        <DataTable 
          columns={columns} 
          data={filteredTasks} 
          emptyMessage="Montaj görevi bulunamadı" 
        />
      </div>

      {/* Plan Modal */}
      <Modal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title="Montaj Planla"
        size="medium"
      >
        {selectedTask && (
          <>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div><strong>Müşteri:</strong> {selectedTask.customerName}</div>
              <div><strong>İş Kolu:</strong> {selectedTask.roleName}</div>
              <div><strong>Aşama:</strong> {selectedTask.stageName}</div>
              {selectedTask.estimatedDate && (
                <div style={{ marginTop: '0.5rem', color: selectedTask.isOverdue ? 'var(--danger)' : 'var(--info)' }}>
                  <strong>Müşteri Termini:</strong> {formatDate(selectedTask.estimatedDate)}
                  {selectedTask.isOverdue && ' ⚠️ GEÇTİ!'}
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Planlanan Tarih *</label>
                <DateInput
                  value={planForm.plannedDate}
                  onChange={handleDateChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ekip *</label>
                <select
                  className="form-control"
                  value={planForm.teamId}
                  onChange={(e) => handleTeamChange(e.target.value)}
                >
                  <option value="">Ekip seçin...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.ad}</option>
                  ))}
                </select>
              </div>
            </div>

            {teamWarning && (
              <div style={{ 
                padding: '0.75rem', 
                background: 'rgba(245, 158, 11, 0.1)', 
                border: '1px solid var(--warning)',
                borderRadius: 6,
                marginBottom: '1rem',
                color: 'var(--warning)'
              }}>
                {teamWarning}
              </div>
            )}

            {planForm.teamId && (
              <div className="form-group">
                <label className="form-label">Personel (Opsiyonel)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {personnel
                    .filter(p => p.ekipId === planForm.teamId || !p.ekipId)
                    .map((p) => {
                      const isSelected = planForm.assignedPersonnel.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => {
                            setPlanForm(prev => ({
                              ...prev,
                              assignedPersonnel: isSelected
                                ? prev.assignedPersonnel.filter(id => id !== p.id)
                                : [...prev.assignedPersonnel, p.id]
                            }));
                          }}
                        >
                          {isSelected ? '✓ ' : ''}{p.ad}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowPlanModal(false)}>
                İptal
              </button>
              <button 
                className="btn btn-primary" 
                onClick={savePlan}
                disabled={saving || !planForm.plannedDate || !planForm.teamId}
              >
                {saving ? 'Kaydediliyor...' : 'Planla'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default MontajPlanlanan;
