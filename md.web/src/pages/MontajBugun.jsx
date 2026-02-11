import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { StatusIcon } from '../utils/muiIcons';
import {
  getAssemblyTasksToday,
  startAssemblyTask,
  completeAssemblyTask,
  completeAllAssemblyTasks,
  reportAssemblyIssue,
  resolveAssemblyIssue,
  getTeams,
  uploadDocument,
  getSettingsAll,
} from '../services/dataService';

const STATUS_MAP = {
  pending: { label: 'Bekliyor', color: 'var(--text-muted)', icon: 'hourglass_empty' },
  planned: { label: 'Planlandı', color: 'var(--info)', icon: 'event' },
  in_progress: { label: 'Devam Ediyor', color: 'var(--warning)', icon: 'engineering' },
  completed: { label: 'Tamamlandı', color: 'var(--success)', icon: 'check_circle' },
  blocked: { label: 'Beklemede', color: 'var(--danger)', icon: 'block' },
};

// Statik fallback değerler
const DEFAULT_ISSUE_TYPES = [
  { id: 'broken', name: 'Kırık/Hasarlı', icon: 'heart_broken' },
  { id: 'missing', name: 'Eksik Malzeme', icon: 'help_outline' },
  { id: 'wrong', name: 'Yanlış Ürün', icon: 'warning' },
  { id: 'damage', name: 'Hasar (Taşıma/Montaj)', icon: 'inventory_2' },
  { id: 'other', name: 'Diğer', icon: 'edit_note' },
];

const DEFAULT_FAULT_SOURCES = [
  { id: 'production', name: 'Üretim Hatası (Tedarikçi)' },
  { id: 'team', name: 'Ekip Hatası' },
  { id: 'accident', name: 'Kaza' },
];

const MontajBugun = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  
  // Settings'den çekilen config listeleri
  const [issueTypes, setIssueTypes] = useState(DEFAULT_ISSUE_TYPES);
  const [faultSources, setFaultSources] = useState(DEFAULT_FAULT_SOURCES);
  
  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  
  // Forms
  const [issueForm, setIssueForm] = useState({
    issueType: 'broken',
    item: '',
    quantity: 1,
    faultSource: 'team',
    responsiblePersonId: '',
    photoUrl: '',
    note: '',
    createReplacement: true,
  });
  
  const [completeForm, setCompleteForm] = useState({
    photosBefore: [],
    photosAfter: [],
    customerSignature: '',
    note: '',
  });
  
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedTeam]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsData, teamsData, settingsData] = await Promise.all([
        getAssemblyTasksToday(selectedTeam || null),
        getTeams(),
        getSettingsAll().catch(() => ({})),
      ]);
      setJobs(jobsData || []);
      setTeams(teamsData || []);
      
      // Settings'den config listeleri al
      if (settingsData?.issueTypes?.length) {
        setIssueTypes(settingsData.issueTypes);
      }
      if (settingsData?.faultSources?.length) {
        setFaultSources(settingsData.faultSources);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async (task) => {
    try {
      setActionLoading(true);
      await startAssemblyTask(task.id);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // İş kolundaki son aşama mı kontrolü
  const isLastStageInRole = (task, job) => {
    if (!job || !task) return false;
    const roleTasks = job.tasks.filter(t => t.roleId === task.roleId);
    if (roleTasks.length === 0) return false;
    const lastTask = roleTasks.reduce((a, b) => (a.stageOrder || 0) > (b.stageOrder || 0) ? a : b);
    return lastTask.id === task.id;
  };

  const handleCompleteTask = async (task) => {
    // Fotoğraf zorunluluğu kontrolü - her aşama için
    if (completeForm.photosBefore.length === 0) {
      alert('Montaj öncesi fotoğraf zorunludur!');
      return;
    }
    if (completeForm.photosAfter.length === 0) {
      alert('Montaj sonrası fotoğraf zorunludur!');
      return;
    }
    // Son aşamada imza zorunlu
    const isLast = selectedJob ? true : isLastStageInRole(task, jobs.find(j => j.tasks.some(t => t.id === task.id)));
    if (isLast && !completeForm.customerSignature) {
      alert('Son aşama için müşteri imzası zorunludur!');
      return;
    }
    
    try {
      setActionLoading(true);
      await completeAssemblyTask(task.id, {
        photosBefore: completeForm.photosBefore,
        photosAfter: completeForm.photosAfter,
        customerSignature: completeForm.customerSignature,
        note: completeForm.note,
      });
      await loadData();
      setShowCompleteModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteAll = async (job) => {
    if (!confirm('Tüm görevleri tek seferde tamamlamak istediğinize emin misiniz?')) return;
    
    try {
      setActionLoading(true);
      await completeAllAssemblyTasks(job.jobId, {
        photosBefore: completeForm.photosBefore,
        photosAfter: completeForm.photosAfter,
        customerSignature: completeForm.customerSignature,
        note: completeForm.note,
      });
      await loadData();
      setShowCompleteModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openIssueModal = (task) => {
    setSelectedTask(task);
    setIssueForm({
      issueType: 'broken',
      item: '',
      quantity: 1,
      faultSource: 'team',
      responsiblePersonId: '',
      photoUrl: '',
      note: '',
      createReplacement: true,
    });
    setShowIssueModal(true);
  };

  const openCompleteModal = (task, job = null) => {
    setSelectedTask(task);
    setSelectedJob(job);
    setCompleteForm({
      photosBefore: [],
      photosAfter: [],
      customerSignature: '',
      note: '',
    });
    setShowCompleteModal(true);
  };

  const handleReportIssue = async () => {
    if (!selectedTask || !issueForm.item) {
      alert('Sorunlu ürün/malzeme adı gerekli');
      return;
    }
    
    try {
      setActionLoading(true);
      await reportAssemblyIssue(selectedTask.id, issueForm);
      await loadData();
      setShowIssueModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveIssue = async (task, issueId) => {
    try {
      setActionLoading(true);
      await resolveAssemblyIssue(task.id, issueId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const [uploading, setUploading] = useState(false);
  
  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Hangi job için upload yapılacak
    const jobId = selectedTask?.jobId || selectedJob?.jobId;
    if (!jobId) {
      console.error('No jobId for upload');
      e.target.value = '';
      return;
    }
    
    try {
      setUploading(true);
      
      // Dosya tipini belirle
      let docType = 'montaj';
      let description = 'Montaj fotoğrafı';
      
      if (type === 'before') {
        docType = 'montaj_oncesi';
        description = 'Montaj öncesi fotoğraf';
      } else if (type === 'after') {
        docType = 'montaj_sonrasi';
        description = 'Montaj sonrası fotoğraf';
      } else if (type === 'signature') {
        docType = 'musteri_imza';
        description = 'Müşteri imzası';
      } else if (type === 'issue') {
        docType = 'montaj_sorun';
        description = 'Montaj sorunu fotoğrafı';
      }
      
      // Backend'e yükle
      const result = await uploadDocument(file, jobId, docType, description);
      const url = result?.url || result?.path || URL.createObjectURL(file);
      
      if (type === 'before') {
        setCompleteForm(prev => ({
          ...prev,
          photosBefore: [...prev.photosBefore, url]
        }));
      } else if (type === 'after') {
        setCompleteForm(prev => ({
          ...prev,
          photosAfter: [...prev.photosAfter, url]
        }));
      } else if (type === 'signature') {
        setCompleteForm(prev => ({
          ...prev,
          customerSignature: url
        }));
      } else if (type === 'issue') {
        setIssueForm(prev => ({
          ...prev,
          photoUrl: url
        }));
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Dosya yüklenirken hata oluştu: ' + (err.message || err));
    } finally {
      setUploading(false);
    }
    
    e.target.value = '';
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Bugünkü Montajlar" subtitle="Yükleniyor..." />
        <div className="card subtle-card">Yükleniyor...</div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      <PageHeader
        title="Bugünkü Montajlar"
        subtitle={today}
      />

      {/* Ekip Filtresi */}
      <div className="filter-bar">
        <div className="filter-group">
          <select
            className="filter-select"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="">Tüm Ekipler</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.ad}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={loadData} style={{ marginLeft: 'auto' }}>
          <StatusIcon icon="refresh" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Yenile
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><StatusIcon icon="event_available" style={{ fontSize: 48, color: 'var(--text-muted)' }} /></div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Bugün için planlanmış montaj yok
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            Planlanan Montajlar sayfasından yeni montaj planlayabilirsiniz.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {jobs.map((job) => {
            const allCompleted = job.tasks.every(t => t.status === 'completed');
            const hasBlocked = job.tasks.some(t => t.status === 'blocked');
            const hasInProgress = job.tasks.some(t => t.status === 'in_progress');
            
            return (
              <div key={job.jobId} className="card" style={{ margin: 0 }}>
                {/* Job Header */}
                <div 
                  className="card-header" 
                  style={{ 
                    background: allCompleted ? 'var(--success)' : hasBlocked ? 'var(--danger)' : hasInProgress ? 'var(--warning)' : 'var(--primary)',
                    color: '#fff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        <StatusIcon icon="home" style={{ marginRight: 4, verticalAlign: 'middle' }} /> {job.customerName}
                      </div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                        <StatusIcon icon="location_on" style={{ marginRight: 4, verticalAlign: 'middle' }} /> {job.location || 'Konum belirtilmedi'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {!allCompleted && !hasBlocked && (
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                          onClick={() => openCompleteModal(null, job)}
                        >
                          <StatusIcon icon="done_all" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Tek Seferde Tamamla
                        </button>
                      )}
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                        onClick={() => navigate(`/isler/list?job=${job.jobId}&stage=5`)}
                      >
                        → İşe Git
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tasks */}
                <div className="card-body" style={{ padding: '1rem' }}>
                  {job.tasks.map((task, idx) => {
                    const status = STATUS_MAP[task.status] || {};
                    const isFirst = idx === 0;
                    const isLast = idx === job.tasks.length - 1;
                    const pendingIssues = task.issues?.filter(i => i.status === 'pending') || [];
                    
                    return (
                      <div 
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '1rem',
                          padding: '1rem',
                          background: task.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 
                                     task.status === 'blocked' ? 'rgba(239, 68, 68, 0.1)' :
                                     task.status === 'in_progress' ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-secondary)',
                          borderRadius: 8,
                          marginBottom: idx < job.tasks.length - 1 ? '0.5rem' : 0,
                        }}
                      >
                        {/* Order Number */}
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: status.color,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}>
                            {task.status === 'completed' ? <StatusIcon icon="check" style={{ fontSize: 18 }} /> : task.stageOrder}
                        </div>

                        {/* Task Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                            {task.roleName} - {task.stageName}
                          </div>
                          
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span className="badge" style={{ background: status.color, color: '#fff' }}>
                              <StatusIcon icon={status.icon} style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }} /> {status.label}
                            </span>
                            {task.teamName && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <StatusIcon icon="groups" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }} /> {task.teamName}
                              </span>
                            )}
                          </div>

                          {/* Pending Issues */}
                          {pendingIssues.length > 0 && (
                            <div style={{ 
                              padding: '0.5rem', 
                              background: 'rgba(239, 68, 68, 0.1)', 
                              borderRadius: 4,
                              marginBottom: '0.5rem'
                            }}>
                              {pendingIssues.map((issue) => (
                                <div key={issue.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                                    <StatusIcon icon="warning" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }} /> {issue.item} ({issue.quantity} adet) - {issue.note}
                                  </span>
                                  {issue.replacementOrderId && (
                                    <button
                                      className="btn btn-sm btn-success"
                                      onClick={() => handleResolveIssue(task, issue.id)}
                                      disabled={actionLoading}
                                    >
                                      <StatusIcon icon="check" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Çözüldü
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Photo Requirements - Her aşama için */}
                          {task.status !== 'completed' && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--info)', marginBottom: '0.25rem' }}>
                              <StatusIcon icon="photo_camera" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }} /> Montaj öncesi + sonrası fotoğraf zorunlu
                              {isLast && <><br/><StatusIcon icon="draw" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }} /> Son aşama: Müşteri imzası da zorunlu</>}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {task.status === 'planned' && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleStartTask(task)}
                              disabled={actionLoading}
                            >
                              <StatusIcon icon="play_arrow" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Başlat
                            </button>
                          )}
                          
                          {task.status === 'in_progress' && (
                            <>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => openCompleteModal(task)}
                                disabled={actionLoading || pendingIssues.length > 0}
                                title={pendingIssues.length > 0 ? 'Önce sorunları çözün' : ''}
                              >
                                <StatusIcon icon="check_circle" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Tamamla
                              </button>
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => openIssueModal(task)}
                                disabled={actionLoading}
                              >
                                <StatusIcon icon="warning" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Sorun
                              </button>
                            </>
                          )}
                          
                          {task.status === 'blocked' && pendingIssues.length === 0 && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleStartTask(task)}
                              disabled={actionLoading}
                            >
                              <StatusIcon icon="play_arrow" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Devam Et
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Issue Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title={<><StatusIcon icon="warning" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Montaj Sorunu Bildir</>}
        size="medium"
      >
        {selectedTask && (
          <>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div><strong>Müşteri:</strong> {selectedTask.customerName}</div>
              <div><strong>Görev:</strong> {selectedTask.roleName} - {selectedTask.stageName}</div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Sorun Türü *</label>
                <select
                  className="form-control"
                  value={issueForm.issueType}
                  onChange={(e) => setIssueForm({ ...issueForm, issueType: e.target.value })}
                >
                  {issueTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.icon || ''} {t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Adet *</label>
                <input
                  type="number"
                  className="form-control"
                  value={issueForm.quantity}
                  onChange={(e) => setIssueForm({ ...issueForm, quantity: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Sorunlu Ürün/Malzeme *</label>
              <input
                type="text"
                className="form-control"
                value={issueForm.item}
                onChange={(e) => setIssueForm({ ...issueForm, item: e.target.value })}
                placeholder="Örn: Cam 80x120"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hata Kaynağı *</label>
              <select
                className="form-control"
                value={issueForm.faultSource}
                onChange={(e) => setIssueForm({ ...issueForm, faultSource: e.target.value })}
              >
                {faultSources.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label"><StatusIcon icon="photo_camera" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Fotoğraf (Zorunlu)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'issue')}
                className="form-control"
              />
              {issueForm.photoUrl && (
                <img 
                  src={issueForm.photoUrl} 
                  alt="Sorun fotoğrafı" 
                  style={{ maxWidth: 200, marginTop: '0.5rem', borderRadius: 4 }}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <textarea
                className="form-control"
                value={issueForm.note}
                onChange={(e) => setIssueForm({ ...issueForm, note: e.target.value })}
                rows={2}
                placeholder="Ne oldu? Nasıl oldu?"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={issueForm.createReplacement}
                  onChange={(e) => setIssueForm({ ...issueForm, createReplacement: e.target.checked })}
                />
                Yedek sipariş oluştur (Üretim Takip'e düşer)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowIssueModal(false)}>
                İptal
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleReportIssue}
                disabled={actionLoading || !issueForm.item || !issueForm.photoUrl}
              >
                {actionLoading ? 'Kaydediliyor...' : <><StatusIcon icon="warning" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Sorunu Bildir</>}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Complete Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title={selectedJob ? <><StatusIcon icon="done_all" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Tüm Görevleri Tamamla</> : <><StatusIcon icon="check_circle" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Görevi Tamamla</>}
        size="medium"
      >
        <div style={{ marginBottom: '1rem' }}>
          {selectedTask && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div><strong>Görev:</strong> {selectedTask.roleName} - {selectedTask.stageName}</div>
            </div>
          )}
          {selectedJob && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div><strong>Müşteri:</strong> {selectedJob.customerName}</div>
              <div><strong>Tamamlanacak Görev:</strong> {selectedJob.tasks.length} adet</div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label"><StatusIcon icon="photo_camera" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Montaj Öncesi Fotoğraf (Zorunlu)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, 'before')}
            className="form-control"
          />
          {completeForm.photosBefore.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {completeForm.photosBefore.map((url, i) => (
                <img key={i} src={url} alt="Öncesi" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }} />
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label"><StatusIcon icon="photo_camera" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Montaj Sonrası Fotoğraf (Zorunlu)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, 'after')}
            className="form-control"
          />
          {completeForm.photosAfter.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {completeForm.photosAfter.map((url, i) => (
                <img key={i} src={url} alt="Sonrası" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }} />
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            <StatusIcon icon="draw" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Müşteri İmzası 
            {(selectedJob || (selectedTask && isLastStageInRole(selectedTask, jobs.find(j => j.tasks.some(t => t.id === selectedTask?.id))))) 
              ? <span style={{ color: 'var(--danger)' }}> (Zorunlu - Son Aşama)</span>
              : ' (Opsiyonel)'}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, 'signature')}
            className="form-control"
          />
          {completeForm.customerSignature && (
            <img 
              src={completeForm.customerSignature} 
              alt="İmza" 
              style={{ maxWidth: 200, marginTop: '0.5rem', borderRadius: 4 }}
            />
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Not (Opsiyonel)</label>
          <textarea
            className="form-control"
            value={completeForm.note}
            onChange={(e) => setCompleteForm({ ...completeForm, note: e.target.value })}
            rows={2}
            placeholder="Ek notlar..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setShowCompleteModal(false)}>
            İptal
          </button>
          <button 
            className="btn btn-success" 
            onClick={() => selectedJob ? handleCompleteAll(selectedJob) : handleCompleteTask(selectedTask)}
            disabled={actionLoading || 
              completeForm.photosBefore.length === 0 || 
              completeForm.photosAfter.length === 0 || 
              ((selectedJob || (selectedTask && isLastStageInRole(selectedTask, jobs.find(j => j.tasks.some(t => t.id === selectedTask?.id))))) && !completeForm.customerSignature)
            }
          >
            {actionLoading ? 'Kaydediliyor...' : <><StatusIcon icon="check_circle" style={{ marginRight: 4, verticalAlign: 'middle' }} /> Tamamla</>}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default MontajBugun;
