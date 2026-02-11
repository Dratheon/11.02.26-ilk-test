import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { StatusIcon } from '../utils/muiIcons';
import {
  getAssemblyTasks,
  resolveAssemblyIssue,
  getSettingsAll,
} from '../services/dataService';

// Fallback değerler (settings yüklenemezse)
const DEFAULT_ISSUE_TYPES_MAP = {
  broken: { label: 'Kırık/Hasarlı', icon: 'heart_broken' },
  missing: { label: 'Eksik Malzeme', icon: 'help_outline' },
  wrong: { label: 'Yanlış Ürün', icon: 'cancel' },
  damage: { label: 'Hasar', icon: 'warning' },
  other: { label: 'Diğer', icon: 'edit_note' },
};

const DEFAULT_FAULT_SOURCES_MAP = {
  production: { label: 'Üretim Hatası', color: 'var(--warning)' },
  team: { label: 'Ekip Hatası', color: 'var(--danger)' },
  accident: { label: 'Kaza', color: 'var(--info)' },
};

// Source colors for display
const FAULT_SOURCE_COLORS = {
  production: 'var(--warning)',
  supplier: 'var(--warning)',
  transport: 'var(--info)',
  team: 'var(--danger)',
  measurement: 'var(--primary)',
  customer: 'var(--secondary)',
  accident: 'var(--info)',
};

const MontajSorunlar = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Settings'den çekilen config
  const [issueTypesMap, setIssueTypesMap] = useState(DEFAULT_ISSUE_TYPES_MAP);
  const [faultSourcesMap, setFaultSourcesMap] = useState(DEFAULT_FAULT_SOURCES_MAP);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksData, settingsData] = await Promise.all([
        getAssemblyTasks({}),
        getSettingsAll().catch(() => ({})),
      ]);
      setTasks(tasksData || []);
      
      // Settings'den issue types map oluştur
      if (settingsData?.issueTypes?.length) {
        const newMap = {};
        settingsData.issueTypes.forEach(it => {
          newMap[it.id] = { label: it.name, icon: it.icon || 'help_outline' };
        });
        setIssueTypesMap(newMap);
      }
      
      // Settings'den fault sources map oluştur
      if (settingsData?.faultSources?.length) {
        const newMap = {};
        settingsData.faultSources.forEach(fs => {
          newMap[fs.id] = { 
            label: fs.name, 
            color: FAULT_SOURCE_COLORS[fs.id] || 'var(--secondary)' 
          };
        });
        setFaultSourcesMap(newMap);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bekleyen sorunları olan görevleri filtrele ve sorunları düzleştir
  const pendingIssues = useMemo(() => {
    const issues = [];
    
    for (const task of tasks) {
      for (const issue of (task.issues || [])) {
        if (issue.status === 'pending') {
          issues.push({
            ...issue,
            taskId: task.id,
            customerName: task.customerName,
            location: task.location,
            roleName: task.roleName,
            stageName: task.stageName,
            teamName: task.teamName,
            jobId: task.jobId,
          });
        }
      }
    }
    
    // Filtrele
    let result = [...issues];
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.customerName?.toLowerCase().includes(q) ||
        i.item?.toLowerCase().includes(q) ||
        i.note?.toLowerCase().includes(q)
      );
    }
    
    if (typeFilter) {
      result = result.filter(i => i.type === typeFilter);
    }
    
    // Tarihe göre sırala (en yeni önce)
    result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    
    return result;
  }, [tasks, search, typeFilter]);

  const handleResolve = async (issue) => {
    if (!confirm('Bu sorunu çözüldü olarak işaretlemek istediğinize emin misiniz?')) return;
    
    try {
      setActionLoading(true);
      await resolveAssemblyIssue(issue.taskId, issue.id);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return d;
    }
  };

  const columns = [
    {
      header: 'Müşteri / Konum',
      accessor: 'customerName',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.customerName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <StatusIcon icon="location_on" style={{ fontSize: 12 }} /> {row.location || '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Görev',
      accessor: 'roleName',
      render: (_, row) => (
        <div>
          <div>{row.roleName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.stageName}</div>
        </div>
      ),
    },
    {
      header: 'Sorun',
      accessor: 'item',
      render: (_, row) => {
        const issueType = issueTypesMap[row.type] || { label: row.type, icon: 'help_outline' };
        return (
          <div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <StatusIcon icon={issueType.icon} style={{ fontSize: 16 }} /> {row.item} ({row.quantity} adet)
            </div>
            <span className="badge" style={{ fontSize: '0.65rem' }}>
              {issueType.label}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Hata Kaynağı',
      accessor: 'faultSource',
      render: (val) => {
        const source = faultSourcesMap[val] || { label: val, color: 'var(--secondary)' };
        return (
          <span 
            className="badge" 
            style={{ background: source.color, color: '#fff' }}
          >
            {source.label}
          </span>
        );
      },
    },
    {
      header: 'Yedek Sipariş',
      accessor: 'replacementOrderId',
      render: (val) => val ? (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => navigate(`/isler/uretim-takip/siparisler?search=${val}`)}
          style={{ color: 'var(--primary)' }}
        >
          <StatusIcon icon="inventory_2" style={{ marginRight: 4 }} /> {val}
        </button>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      ),
    },
    {
      header: 'Tarih',
      accessor: 'createdAt',
      render: (val) => formatDate(val),
    },
    {
      header: 'İşlem',
      accessor: 'actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            className="btn btn-sm btn-success"
            onClick={() => handleResolve(row)}
            disabled={actionLoading}
            title="Çözüldü Olarak İşaretle"
          >
            <StatusIcon icon="check" />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => navigate(`/isler/list?job=${row.jobId}&stage=5`)}
            title="İşe Git"
          >
            <StatusIcon icon="arrow_forward" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title="Bekleyen Montaj Sorunları" subtitle="Yükleniyor..." />
        <div className="card subtle-card">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bekleyen Montaj Sorunları"
        subtitle={`${pendingIssues.length} bekleyen sorun`}
      />

      {/* KPI Cards */}
      <div className="jobs-kpi-container">
        <button
          type="button"
          className="jobs-kpi-card"
          style={{ '--kpi-color': '#ef4444', '--kpi-bg': 'rgba(239, 68, 68, 0.1)' }}
        >
          <div className="jobs-kpi-icon">
            <StatusIcon icon="error" />
          </div>
          <div className="jobs-kpi-value">{pendingIssues.length}</div>
          <div className="jobs-kpi-label">Toplam Bekleyen</div>
        </button>
        <button
          type="button"
          className="jobs-kpi-card"
          style={{ '--kpi-color': '#f59e0b', '--kpi-bg': 'rgba(245, 158, 11, 0.1)' }}
        >
          <div className="jobs-kpi-icon">
            <StatusIcon icon="precision_manufacturing" />
          </div>
          <div className="jobs-kpi-value">{pendingIssues.filter(i => i.faultSource === 'production').length}</div>
          <div className="jobs-kpi-label">Üretim Hatası</div>
        </button>
        <button
          type="button"
          className="jobs-kpi-card"
          style={{ '--kpi-color': '#3b82f6', '--kpi-bg': 'rgba(59, 130, 246, 0.1)' }}
        >
          <div className="jobs-kpi-icon">
            <StatusIcon icon="groups" />
          </div>
          <div className="jobs-kpi-value">{pendingIssues.filter(i => i.faultSource === 'team').length}</div>
          <div className="jobs-kpi-label">Ekip Hatası</div>
        </button>
        <button
          type="button"
          className="jobs-kpi-card"
          style={{ '--kpi-color': '#8b5cf6', '--kpi-bg': 'rgba(139, 92, 246, 0.1)' }}
        >
          <div className="jobs-kpi-icon">
            <StatusIcon icon="inventory_2" />
          </div>
          <div className="jobs-kpi-value">{pendingIssues.filter(i => i.replacementOrderId).length}</div>
          <div className="jobs-kpi-label">Yedek Sipariş</div>
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group" style={{ flex: 1 }}>
          <div className="filter-input-wrapper">
            <StatusIcon icon="search" />
            <input
              type="text"
              className="filter-input"
              placeholder="Müşteri, ürün ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Tüm Türler</option>
            {Object.entries(issueTypesMap).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <DataTable 
          columns={columns} 
          data={pendingIssues} 
          emptyMessage="Bekleyen montaj sorunu yok" 
        />
      </div>
    </div>
  );
};

export default MontajSorunlar;
