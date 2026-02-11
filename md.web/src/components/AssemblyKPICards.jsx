import { useMemo } from 'react';
import { StatusIcon } from '../utils/muiIcons';

/**
 * Montaj görevleri için KPI kartları
 * Tıklanabilir - filtre uygular
 */
const AssemblyKPICards = ({ tasks, onFilterClick, activeFilter, variant = 'default' }) => {
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    return {
      pending: tasks.filter(t => t.status === 'pending').length,
      planned: tasks.filter(t => t.status === 'planned').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      today: tasks.filter(t => {
        if (!t.plannedDate) return false;
        return t.plannedDate.split('T')[0] === todayStr;
      }).length,
      hasIssues: tasks.filter(t => 
        t.issues?.some(i => i.status === 'pending')
      ).length,
    };
  }, [tasks]);

  // Variant'a göre farklı kart setleri
  const cards = variant === 'today' ? [
    {
      id: 'pending',
      label: 'Bekleyen',
      value: stats.pending,
      icon: 'hourglass_empty',
      color: '#6b7280',
      bgColor: 'rgba(107, 114, 128, 0.1)',
      filterValue: 'pending',
    },
    {
      id: 'in_progress',
      label: 'Devam Eden',
      value: stats.inProgress,
      icon: 'engineering',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      filterValue: 'in_progress',
    },
    {
      id: 'blocked',
      label: 'Beklemede',
      value: stats.blocked,
      icon: 'block',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      filterValue: 'blocked',
    },
    {
      id: 'completed',
      label: 'Tamamlanan',
      value: stats.completed,
      icon: 'check_circle',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      filterValue: 'completed',
    },
  ] : variant === 'issues' ? [
    {
      id: 'hasIssues',
      label: 'Açık Sorun',
      value: stats.hasIssues,
      icon: 'warning',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      filterValue: 'hasIssues',
    },
    {
      id: 'blocked',
      label: 'Beklemede',
      value: stats.blocked,
      icon: 'block',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      filterValue: 'blocked',
    },
  ] : [
    // Default - Planlanan görünümü
    {
      id: 'pending',
      label: 'Planlanmadı',
      value: stats.pending,
      icon: 'hourglass_empty',
      color: '#6b7280',
      bgColor: 'rgba(107, 114, 128, 0.1)',
      filterValue: 'pending',
    },
    {
      id: 'planned',
      label: 'Planlandı',
      value: stats.planned,
      icon: 'event',
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.1)',
      filterValue: 'planned',
    },
    {
      id: 'in_progress',
      label: 'Devam Eden',
      value: stats.inProgress,
      icon: 'engineering',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      filterValue: 'in_progress',
    },
    {
      id: 'blocked',
      label: 'Beklemede',
      value: stats.blocked,
      icon: 'block',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      filterValue: 'blocked',
    },
    {
      id: 'completed',
      label: 'Tamamlanan',
      value: stats.completed,
      icon: 'check_circle',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      filterValue: 'completed',
    },
  ];

  return (
    <div className="jobs-kpi-container">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          className={`jobs-kpi-card ${activeFilter === card.id ? 'active' : ''}`}
          onClick={() => onFilterClick(card.id, card.filterValue)}
          style={{
            '--kpi-color': card.color,
            '--kpi-bg': card.bgColor,
          }}
        >
          <div className="jobs-kpi-icon">
            <StatusIcon icon={card.icon} />
          </div>
          <div className="jobs-kpi-value">{card.value}</div>
          <div className="jobs-kpi-label">{card.label}</div>
          {activeFilter === card.id && (
            <div className="jobs-kpi-active-indicator" />
          )}
        </button>
      ))}
    </div>
  );
};

export default AssemblyKPICards;
