import { useMemo } from 'react';
import { StatusIcon } from '../utils/muiIcons';

/**
 * İş listesi için KPI kartları
 * Tıklanabilir - filtre uygular
 */
const JobsKPICards = ({ jobs, onFilterClick, activeFilter }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    return {
      olcuBekliyor: jobs.filter(j => 
        ['OLCU_RANDEVU_BEKLIYOR', 'OLCU_RANDEVULU', 'MUSTERI_OLCUSU_BEKLENIYOR'].includes(j.status)
      ).length,
      
      uretimde: jobs.filter(j => 
        ['URETIME_HAZIR', 'URETIMDE', 'SONRA_URETILECEK'].includes(j.status)
      ).length,
      
      montajda: jobs.filter(j => 
        ['MONTAJA_HAZIR', 'MONTAJ_TERMIN', 'TESLIME_HAZIR'].includes(j.status)
      ).length,
      
      tamamlanan: jobs.filter(j => {
        if (!['KAPALI', 'TAMAMLANDI'].includes(j.status)) return false;
        if (!j.updatedAt) return false;
        const updated = new Date(j.updatedAt);
        return updated.getMonth() === thisMonth && updated.getFullYear() === thisYear;
      }).length,
      
      fiyatBekliyor: jobs.filter(j => 
        ['FIYATLANDIRMA', 'FIYAT_VERILDI', 'ANLASMA_YAPILIYOR'].includes(j.status)
      ).length,
    };
  }, [jobs]);

  const cards = [
    {
      id: 'olcu',
      label: 'Ölçü Bekliyor',
      value: stats.olcuBekliyor,
      icon: 'straighten',
      color: '#ef4444', // red
      bgColor: 'rgba(239, 68, 68, 0.1)',
      statuses: ['OLCU_RANDEVU_BEKLIYOR', 'OLCU_RANDEVULU', 'MUSTERI_OLCUSU_BEKLENIYOR'],
    },
    {
      id: 'fiyat',
      label: 'Fiyat/Anlaşma',
      value: stats.fiyatBekliyor,
      icon: 'attach_money',
      color: '#f59e0b', // amber
      bgColor: 'rgba(245, 158, 11, 0.1)',
      statuses: ['FIYATLANDIRMA', 'FIYAT_VERILDI', 'ANLASMA_YAPILIYOR'],
    },
    {
      id: 'uretim',
      label: 'Üretimde',
      value: stats.uretimde,
      icon: 'precision_manufacturing',
      color: '#3b82f6', // blue
      bgColor: 'rgba(59, 130, 246, 0.1)',
      statuses: ['URETIME_HAZIR', 'URETIMDE', 'SONRA_URETILECEK'],
    },
    {
      id: 'montaj',
      label: 'Montajda',
      value: stats.montajda,
      icon: 'build',
      color: '#10b981', // green
      bgColor: 'rgba(16, 185, 129, 0.1)',
      statuses: ['MONTAJA_HAZIR', 'MONTAJ_TERMIN', 'TESLIME_HAZIR'],
    },
    {
      id: 'tamamlanan',
      label: 'Bu Ay Kapanan',
      value: stats.tamamlanan,
      icon: 'check_circle',
      color: '#6b7280', // gray
      bgColor: 'rgba(107, 114, 128, 0.1)',
      statuses: ['KAPALI', 'TAMAMLANDI'],
    },
  ];

  return (
    <div className="jobs-kpi-container">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          className={`jobs-kpi-card ${activeFilter === card.id ? 'active' : ''}`}
          onClick={() => onFilterClick(card.id, card.statuses)}
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

export default JobsKPICards;
