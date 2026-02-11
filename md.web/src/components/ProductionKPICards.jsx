import { useMemo } from 'react';
import { StatusIcon } from '../utils/muiIcons';

/**
 * Üretim siparişleri için KPI kartları
 * Tıklanabilir - filtre uygular
 */
const ProductionKPICards = ({ orders, onFilterClick, activeFilter }) => {
  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return {
      pending: orders.filter(o => o.status === 'pending').length,
      partial: orders.filter(o => o.status === 'partial').length,
      overdue: orders.filter(o => {
        if (!o.estimatedDelivery || o.status === 'completed') return false;
        const delivery = new Date(o.estimatedDelivery);
        delivery.setHours(0, 0, 0, 0);
        return delivery < now;
      }).length,
      completed: orders.filter(o => o.status === 'completed').length,
      hasIssues: orders.filter(o => 
        o.issues?.some(i => i.status === 'pending')
      ).length,
    };
  }, [orders]);

  const cards = [
    {
      id: 'pending',
      label: 'Bekleyen',
      value: stats.pending,
      icon: 'hourglass_empty',
      color: '#f59e0b', // amber
      bgColor: 'rgba(245, 158, 11, 0.1)',
      filterValue: 'pending',
    },
    {
      id: 'partial',
      label: 'Kısmi Teslim',
      value: stats.partial,
      icon: 'inventory_2',
      color: '#3b82f6', // blue
      bgColor: 'rgba(59, 130, 246, 0.1)',
      filterValue: 'partial',
    },
    {
      id: 'overdue',
      label: 'Geciken',
      value: stats.overdue,
      icon: 'warning',
      color: '#ef4444', // red
      bgColor: 'rgba(239, 68, 68, 0.1)',
      filterValue: 'overdue',
    },
    {
      id: 'issues',
      label: 'Sorunlu',
      value: stats.hasIssues,
      icon: 'report_problem',
      color: '#dc2626', // dark red
      bgColor: 'rgba(220, 38, 38, 0.1)',
      filterValue: 'issues',
    },
    {
      id: 'completed',
      label: 'Tamamlanan',
      value: stats.completed,
      icon: 'check_circle',
      color: '#10b981', // green
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

export default ProductionKPICards;
