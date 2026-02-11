import { useMemo } from 'react';
import { StatusIcon } from '../utils/muiIcons';

/**
 * Bugün yapılması gereken acil işler
 */
const JobsUrgentSection = ({ jobs, onJobClick }) => {
  const urgentJobs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    return jobs.filter((job) => {
      // Bugün montaj planı olan işler
      if (job.assemblyDate) {
        const assemblyDate = job.assemblyDate.split('T')[0];
        if (assemblyDate === todayStr && !['KAPALI', 'TAMAMLANDI'].includes(job.status)) {
          return true;
        }
      }
      
      // Bugün ölçü randevusu olan işler
      if (job.measureDate) {
        const measureDate = job.measureDate.split('T')[0];
        if (measureDate === todayStr && ['OLCU_RANDEVULU', 'OLCU_RANDEVU_BEKLIYOR'].includes(job.status)) {
          return true;
        }
      }

      return false;
    }).slice(0, 5); // Max 5 iş göster
  }, [jobs]);

  if (urgentJobs.length === 0) {
    return null;
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="jobs-urgent-section">
      <div className="jobs-urgent-header">
        <div className="jobs-urgent-title">
          <StatusIcon icon="warning" />
          <span>Bugün Yapılacaklar ({urgentJobs.length})</span>
        </div>
        <span className="jobs-urgent-link">Tümünü Gör →</span>
      </div>
      
      <div className="jobs-urgent-list">
        {urgentJobs.map((job) => (
          <div
            key={job.id}
            className="jobs-urgent-card"
            onClick={() => onJobClick(job)}
          >
            <div className="jobs-urgent-card-title">
              {job.id} - {job.title || 'İsimsiz İş'}
            </div>
            <div className="jobs-urgent-card-info">
              <StatusIcon icon="person" />
              <span>{job.customerName}</span>
              {job.assemblyDate && (
                <>
                  <span>•</span>
                  <StatusIcon icon="schedule" />
                  <span>{formatTime(job.assemblyDate)}</span>
                </>
              )}
              {job.location && (
                <>
                  <span>•</span>
                  <StatusIcon icon="location_on" />
                  <span style={{ 
                    maxWidth: 80, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap' 
                  }}>
                    {job.location}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobsUrgentSection;
