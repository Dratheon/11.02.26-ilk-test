import { useEffect, useState, useMemo } from 'react';
import DateInput from '../components/DateInput';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import { StatusIcon } from '../utils/muiIcons';
import { getJobs, getCustomers, updateJobPayment } from '../services/dataService';

const formatNumber = (val) => new Intl.NumberFormat('tr-TR').format(val || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';

// Ödeme durumu badge'leri
const PAYMENT_STATUS = {
  pending: { label: 'Bekliyor', tone: 'warning', icon: 'schedule' },
  overdue: { label: 'Gecikmiş', tone: 'danger', icon: 'error' },
  today: { label: 'Bugün', tone: 'primary', icon: 'today' },
  afterDelivery: { label: 'Montaj Bitti', tone: 'info', icon: 'home' },
  chequeWaiting: { label: 'Çek Bekliyor', tone: 'secondary', icon: 'pending_actions' },
  chequeReceived: { label: 'Çek Alındı', tone: 'success', icon: 'check_circle' },
  collected: { label: 'Tahsil Edildi', tone: 'success', icon: 'check_circle' },
};

// İş durumu badge'leri
const JOB_STATUS = {
  'MONTAJA_HAZIR': { label: 'Montaja Hazır', icon: 'build' },
  'MONTAJ_TERMIN': { label: 'Montaj Terminli', icon: 'event' },
  'MUHASEBE_BEKLIYOR': { label: 'Muhasebe Bekliyor', icon: 'credit_card' },
  'KAPALI': { label: 'Kapandı', icon: 'check_circle' },
};

const FinansOdemelerKasa = () => {
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // pending, collected
  const [filter, setFilter] = useState('all'); // all, cash, card, cheque, afterDelivery

  // Modal states
  const [collectModal, setCollectModal] = useState(null); // Tahsil et modal
  const [chequeModal, setChequeModal] = useState(null); // Çek detay modal
  const [detailModal, setDetailModal] = useState(null); // Ödeme detay modal (alınmış)
  const [jobModal, setJobModal] = useState(null); // İş detay modal

  // Tahsil et form
  const [collectForm, setCollectForm] = useState({
    amount: '',
    isPartial: false,
    hasDiscount: false,
    discountAmount: '',
    discountReason: '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Çek formu
  const [chequeForm, setChequeForm] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
      try {
        setLoading(true);
        setError('');
      const [jobsData, customersData] = await Promise.all([
        getJobs(),
        getCustomers(),
      ]);
      setJobs(jobsData.filter(j => !j.deleted));
      setCustomers(customersData);
      } catch (err) {
      setError(err.message || 'Veriler alınamadı');
      } finally {
        setLoading(false);
      }
    };

  // Müşteri adını bul
  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Bilinmiyor';
  };

  // Montaj bitmiş mi kontrol et
  const isAssemblyDone = (job) => {
    const doneStatuses = ['MUHASEBE_BEKLIYOR', 'KAPALI'];
    return doneStatuses.includes(job.status);
  };

  // İşlerden ödemeleri çıkar
  const payments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = [];

    jobs.forEach(job => {
      const plan = job.approval?.paymentPlan;
      if (!plan) return;

      const basePayment = {
        jobId: job.id,
        jobTitle: job.title || job.id,
        customerId: job.customerId,
        customerName: job.customerName || getCustomerName(job.customerId),
        jobStatus: job.status,
      };

      // Nakit
      if (plan.cash?.amount > 0) {
        const cashDate = plan.cash.date ? new Date(plan.cash.date) : null;
        let status = 'pending';
        if (plan.cash.status === 'collected') status = 'collected';
        else if (cashDate) {
          if (cashDate < today) status = 'overdue';
          else if (cashDate.toDateString() === today.toDateString()) status = 'today';
        }
        result.push({
          ...basePayment,
          id: `${job.id}-cash`,
          type: 'cash',
          typeLabel: 'Nakit',
          amount: plan.cash.amount,
          date: plan.cash.date,
          status,
          collectedData: plan.cash.collectedData || null,
        });
      }

      // Kart
      if (plan.card?.amount > 0) {
        const cardDate = plan.card.date ? new Date(plan.card.date) : null;
        let status = 'pending';
        if (plan.card.status === 'collected') status = 'collected';
        else if (cardDate) {
          if (cardDate < today) status = 'overdue';
          else if (cardDate.toDateString() === today.toDateString()) status = 'today';
        }
        result.push({
          ...basePayment,
          id: `${job.id}-card`,
          type: 'card',
          typeLabel: 'Kredi Kartı',
          amount: plan.card.amount,
          date: plan.card.date,
          status,
          collectedData: plan.card.collectedData || null,
        });
      }

      // Çek
      if (plan.cheque?.total > 0) {
        const hasDetails = plan.cheque.received && plan.cheque.items?.length > 0;
        result.push({
          ...basePayment,
          id: `${job.id}-cheque`,
          type: 'cheque',
          typeLabel: `Çek (${plan.cheque.count || '?'} adet)`,
          amount: plan.cheque.total,
          date: null,
          status: plan.cheque.status === 'collected' ? 'collected' : (hasDetails ? 'chequeReceived' : 'chequeWaiting'),
          chequeDetails: plan.cheque.items || [],
          chequeCount: plan.cheque.count || 0,
          chequeReceived: plan.cheque.received || false,
          collectedData: plan.cheque.collectedData || null,
        });
      }

      // Teslim Sonrası
      if (plan.afterDelivery?.amount > 0) {
        let status = 'pending';
        if (plan.afterDelivery.status === 'collected') status = 'collected';
        else if (isAssemblyDone(job)) status = 'afterDelivery';
        result.push({
          ...basePayment,
          id: `${job.id}-afterDelivery`,
          type: 'afterDelivery',
          typeLabel: 'Teslim Sonrası',
          amount: plan.afterDelivery.amount,
          date: null,
          status,
          note: plan.afterDelivery.note,
          collectedData: plan.afterDelivery.collectedData || null,
        });
      }
    });

    return result;
  }, [jobs, customers]);

  // Filtrelenmiş ödemeler
  const filteredPayments = useMemo(() => {
    let data = payments;

    // Tab filtresi
    if (activeTab === 'pending') {
      data = data.filter(p => p.status !== 'collected');
    } else {
      data = data.filter(p => p.status === 'collected');
    }

    // Tip filtresi
    if (filter !== 'all') {
      data = data.filter(p => p.type === filter);
    }

    // Sıralama: Gecikmiş > Bugün > Montaj Bitti > Çek Bekliyor > Bekliyor
    const statusOrder = { overdue: 0, today: 1, afterDelivery: 2, chequeWaiting: 3, chequeReceived: 4, pending: 5, collected: 6 };
    data.sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 99;
      const orderB = statusOrder[b.status] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      // Aynı durumda tarihe göre
      if (a.date && b.date) return new Date(a.date) - new Date(b.date);
      return 0;
    });

    return data;
  }, [payments, activeTab, filter]);

  // Özet istatistikler
  const summary = useMemo(() => {
    const pending = payments.filter(p => p.status !== 'collected');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    return {
      overdueCount: pending.filter(p => p.status === 'overdue').length,
      overdueAmount: pending.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0),
      todayCount: pending.filter(p => p.status === 'today').length,
      todayAmount: pending.filter(p => p.status === 'today').reduce((s, p) => s + p.amount, 0),
      afterDeliveryCount: pending.filter(p => p.status === 'afterDelivery').length,
      afterDeliveryAmount: pending.filter(p => p.status === 'afterDelivery').reduce((s, p) => s + p.amount, 0),
      chequeWaitingCount: pending.filter(p => p.status === 'chequeWaiting').length,
      thisWeekCount: pending.filter(p => {
        if (!p.date) return false;
        const d = new Date(p.date);
        return d >= today && d <= weekLater;
      }).length,
      thisWeekAmount: pending.filter(p => {
        if (!p.date) return false;
        const d = new Date(p.date);
        return d >= today && d <= weekLater;
      }).reduce((s, p) => s + p.amount, 0),
      totalPending: pending.reduce((s, p) => s + p.amount, 0),
      totalCollected: payments.filter(p => p.status === 'collected').reduce((s, p) => s + p.amount, 0),
    };
  }, [payments]);

  // Tahsil et modalını aç
  const openCollectModal = (payment) => {
    setCollectForm({
      amount: payment.amount,
      isPartial: false,
      hasDiscount: false,
      discountAmount: '',
      discountReason: '',
      note: '',
    });
    setCollectModal(payment);
  };

  // Çek detay modalını aç
  const openChequeModal = (payment) => {
    const count = payment.chequeCount || 1;
    const existingItems = payment.chequeDetails || [];
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push(existingItems[i] || {
        bank: '',
        chequeNo: '',
        amount: Math.round(payment.amount / count),
        due: '',
      });
    }
    setChequeForm(items);
    setChequeModal(payment);
  };

  // Tahsil et kaydet
  const handleCollect = async () => {
    if (!collectModal) return;

    try {
      setSubmitting(true);
      
      const job = jobs.find(j => j.id === collectModal.jobId);
      if (!job) throw new Error('İş bulunamadı');

      const plan = { ...job.approval.paymentPlan };
      const typeKey = collectModal.type;
      
      const collectedData = {
        collectedAt: new Date().toISOString(),
        originalAmount: collectModal.amount,
        collectedAmount: Number(collectForm.amount) || collectModal.amount,
        isPartial: collectForm.isPartial,
        discountAmount: collectForm.hasDiscount ? Number(collectForm.discountAmount) : 0,
        discountReason: collectForm.discountReason,
        note: collectForm.note,
      };

      if (typeKey === 'cash') {
        plan.cash = { ...plan.cash, status: 'collected', collectedData };
      } else if (typeKey === 'card') {
        plan.card = { ...plan.card, status: 'collected', collectedData };
      } else if (typeKey === 'cheque') {
        plan.cheque = { ...plan.cheque, status: 'collected', collectedData };
      } else if (typeKey === 'afterDelivery') {
        plan.afterDelivery = { ...plan.afterDelivery, status: 'collected', collectedData };
      }

      await updateJobPayment(job.id, plan);
      await loadData();
      setCollectModal(null);
    } catch (err) {
      setError(err.message || 'Tahsilat kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  // Çek detaylarını kaydet
  const handleSaveCheque = async () => {
    if (!chequeModal) return;

    try {
      setSubmitting(true);
      
      const job = jobs.find(j => j.id === chequeModal.jobId);
      if (!job) throw new Error('İş bulunamadı');

      const plan = { ...job.approval.paymentPlan };
      plan.cheque = {
        ...plan.cheque,
        received: true,
        items: chequeForm,
        count: chequeForm.length,
        total: chequeForm.reduce((s, c) => s + Number(c.amount || 0), 0),
      };

      await updateJobPayment(job.id, plan);
      await loadData();
      setChequeModal(null);
    } catch (err) {
      setError(err.message || 'Çek detayları kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  // Durum badge'i render
  const renderStatus = (status) => {
    const info = PAYMENT_STATUS[status];
    if (!info) return <span className="badge badge-secondary">{status}</span>;
    return <span className={`badge badge-${info.tone}`}><StatusIcon icon={info.icon} style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }} />{info.label}</span>;
  };

  // Tip ikonu
  const getTypeIcon = (type) => {
    switch (type) {
      case 'cash': return 'payments';
      case 'card': return 'credit_card';
      case 'cheque': return 'receipt_long';
      case 'afterDelivery': return 'home';
      default: return 'attach_money';
    }
  };

  return (
    <div>
      <PageHeader
        title="Ödemeler / Kasa"
        subtitle="Tahsilat takibi ve hatırlatmalar"
      />

      {loading ? (
        <Loader text="Ödemeler yükleniyor..." />
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Hata</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <>
          {/* Uyarı Kartları */}
          {(summary.overdueCount > 0 || summary.todayCount > 0 || summary.afterDeliveryCount > 0 || summary.chequeWaitingCount > 0) && (
            <div style={{ 
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
              padding: 16, 
              borderRadius: 12, 
              marginBottom: 16,
              border: '1px solid #f59e0b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <StatusIcon icon="warning" style={{ fontSize: 20, color: '#d97706' }} />
                <span style={{ fontWeight: 700, fontSize: 16 }}>Dikkat Gerektiren Ödemeler</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {summary.overdueCount > 0 && (
                  <div style={{ background: '#fecaca', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusIcon icon="error" style={{ color: '#dc2626' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Gecikmiş: {summary.overdueCount}</div>
                      <div style={{ fontSize: 13, color: '#991b1b' }}>₺{formatNumber(summary.overdueAmount)}</div>
                    </div>
                  </div>
                )}
                {summary.todayCount > 0 && (
                  <div style={{ background: '#dbeafe', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusIcon icon="today" style={{ color: '#2563eb' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Bugün: {summary.todayCount}</div>
                      <div style={{ fontSize: 13, color: '#1e40af' }}>₺{formatNumber(summary.todayAmount)}</div>
                    </div>
                  </div>
                )}
                {summary.afterDeliveryCount > 0 && (
                  <div style={{ background: '#d1fae5', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusIcon icon="home" style={{ color: '#059669' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Montajı Biten: {summary.afterDeliveryCount}</div>
                      <div style={{ fontSize: 13, color: '#065f46' }}>₺{formatNumber(summary.afterDeliveryAmount)}</div>
                    </div>
                  </div>
                )}
                {summary.chequeWaitingCount > 0 && (
                  <div style={{ background: '#e5e7eb', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusIcon icon="pending_actions" style={{ color: '#6b7280' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Çek Bekliyor: {summary.chequeWaitingCount}</div>
                      <div style={{ fontSize: 13, color: '#374151' }}>Detay girilecek</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* KPI Kartları */}
          <div className="kpi-cards-container" style={{ marginBottom: 16 }}>
            <div className="kpi-card">
              <div className="stat-icon warning">
                <StatusIcon icon="schedule" />
              </div>
              <div className="stat-content">
                <div className="stat-value">₺{formatNumber(summary.totalPending)}</div>
                <div className="stat-label">Bekleyen Toplam</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="stat-icon primary">
                <StatusIcon icon="date_range" />
              </div>
              <div className="stat-content">
                <div className="stat-value">₺{formatNumber(summary.thisWeekAmount)}</div>
                <div className="stat-label">Bu Hafta Alınacak</div>
                <div className="stat-subtitle">{summary.thisWeekCount} ödeme</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="stat-icon success">
                <StatusIcon icon="check_circle" />
              </div>
              <div className="stat-content">
                <div className="stat-value" style={{ color: 'var(--color-success)' }}>₺{formatNumber(summary.totalCollected)}</div>
                <div className="stat-label">Tahsil Edilen</div>
              </div>
            </div>
          </div>

          {/* Tabs ve Filtreler */}
          <div className="filter-bar" style={{ marginBottom: 16 }}>
            <div className="filter-toggle-group">
              <button
                className={`filter-toggle-btn ${activeTab === 'pending' ? 'active' : ''}`}
                onClick={() => setActiveTab('pending')}
              >
                <StatusIcon icon="schedule" style={{ fontSize: 16 }} /> Bekleyen ({payments.filter(p => p.status !== 'collected').length})
              </button>
              <button
                className={`filter-toggle-btn ${activeTab === 'collected' ? 'active' : ''}`}
                onClick={() => setActiveTab('collected')}
              >
                <StatusIcon icon="check_circle" style={{ fontSize: 16 }} /> Tahsil Edilen ({payments.filter(p => p.status === 'collected').length})
              </button>
            </div>
            <div className="filter-toggle-group">
              <button
                className={`filter-toggle-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Tümü
              </button>
              <button
                className={`filter-toggle-btn ${filter === 'cash' ? 'active' : ''}`}
                onClick={() => setFilter('cash')}
              >
                <StatusIcon icon="payments" style={{ fontSize: 16 }} /> Nakit
              </button>
              <button
                className={`filter-toggle-btn ${filter === 'card' ? 'active' : ''}`}
                onClick={() => setFilter('card')}
              >
                <StatusIcon icon="credit_card" style={{ fontSize: 16 }} /> Kart
              </button>
              <button
                className={`filter-toggle-btn ${filter === 'cheque' ? 'active' : ''}`}
                onClick={() => setFilter('cheque')}
              >
                <StatusIcon icon="receipt_long" style={{ fontSize: 16 }} /> Çek
              </button>
              <button
                className={`filter-toggle-btn ${filter === 'afterDelivery' ? 'active' : ''}`}
                onClick={() => setFilter('afterDelivery')}
              >
                <StatusIcon icon="home" style={{ fontSize: 16 }} /> Teslim Sonrası
              </button>
            </div>
          </div>

          <div className="card">

            {/* Tablo */}
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Müşteri</th>
                    <th>İş</th>
                    <th>Tip</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div style={{ padding: 40, textAlign: 'center' }}>
                          <div style={{ fontSize: 48, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                            <StatusIcon icon={activeTab === 'pending' ? 'celebration' : 'assignment'} style={{ fontSize: 48, color: 'var(--color-primary)' }} />
                          </div>
                          <div style={{ fontWeight: 600 }}>
                            {activeTab === 'pending' ? 'Bekleyen ödeme yok!' : 'Henüz tahsilat kaydı yok'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment) => (
                      <tr 
                        key={payment.id}
                        style={{ 
                          background: payment.status === 'overdue' ? '#fef2f2' : 
                                     payment.status === 'today' ? '#eff6ff' :
                                     payment.status === 'afterDelivery' ? '#ecfdf5' : undefined
                        }}
                      >
                        <td>
                          {payment.date ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{formatDate(payment.date)}</div>
                              {payment.status === 'overdue' && (
                                <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>Gecikmiş!</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{payment.customerName}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13 }}>{payment.jobTitle}</div>
                          <code style={{ fontSize: 10 }}>{payment.jobId}</code>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StatusIcon icon={getTypeIcon(payment.type)} style={{ flexShrink: 0 }} />
                            <span>{payment.typeLabel}</span>
                          </div>
                        </td>
                        <td>
                          <strong style={{ fontSize: 15 }}>₺{formatNumber(payment.amount)}</strong>
                        </td>
                        <td>
                          {renderStatus(payment.status)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {payment.status === 'collected' ? (
                              <button
                                className="btn btn-success btn-small"
                                onClick={() => setDetailModal(payment)}
                              >
                                <StatusIcon icon="check" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }} /> Ödeme Alındı
                              </button>
                            ) : payment.status === 'chequeWaiting' ? (
                              <button
                                className="btn btn-primary btn-small"
                                onClick={() => openChequeModal(payment)}
                              >
                                Çek Detayı Gir
                              </button>
                            ) : (
                              <button
                                className="btn btn-success btn-small"
                                onClick={() => openCollectModal(payment)}
                              >
                                Tahsil Et
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-small"
                              onClick={() => setJobModal(payment)}
                            >
                              İşe Git
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tahsil Et Modal */}
      <Modal
        open={Boolean(collectModal)}
        title={<><StatusIcon icon="payments" style={{ fontSize: 20, marginRight: 8, verticalAlign: 'middle' }} /> Ödeme Tahsil Et</>}
        size="medium"
        onClose={() => setCollectModal(null)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setCollectModal(null)} disabled={submitting}>
              İptal
            </button>
            <button className="btn btn-success" onClick={handleCollect} disabled={submitting}>
              {submitting ? 'Kaydediliyor...' : <><StatusIcon icon="check" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }} /> Tahsil Et</>}
            </button>
          </>
        }
      >
        {collectModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--color-bg-secondary)', padding: 16, borderRadius: 8 }}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Müşteri</div>
                  <div style={{ fontWeight: 600 }}>{collectModal.customerName}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>İş</div>
                  <div style={{ fontWeight: 600 }}>{collectModal.jobTitle}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Ödeme Tipi</div>
                  <div><StatusIcon icon={getTypeIcon(collectModal.type)} style={{ marginRight: 4, verticalAlign: 'middle' }} />{collectModal.typeLabel}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Beklenen Tutar</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>₺{formatNumber(collectModal.amount)}</div>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Alınan Tutar</label>
              <input
                type="number"
                className="form-input"
                value={collectForm.amount}
                onChange={(e) => setCollectForm(p => ({ ...p, amount: e.target.value }))}
                style={{ fontSize: 18, fontWeight: 600 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={collectForm.isPartial}
                  onChange={(e) => setCollectForm(p => ({ ...p, isPartial: e.target.checked }))}
                />
                <span>Kısmi tahsilat (kalan tutar sonra alınacak)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={collectForm.hasDiscount}
                  onChange={(e) => setCollectForm(p => ({ ...p, hasDiscount: e.target.checked }))}
                />
                <span>İskonto ile kapat</span>
              </label>
            </div>

            {collectForm.hasDiscount && (
              <div className="grid grid-2" style={{ gap: 12, padding: 12, background: '#fef3c7', borderRadius: 8 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">İskonto Tutarı *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={collectForm.discountAmount}
                    onChange={(e) => setCollectForm(p => ({ ...p, discountAmount: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">İskonto Sebebi *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={collectForm.discountReason}
                    onChange={(e) => setCollectForm(p => ({ ...p, discountReason: e.target.value }))}
                    placeholder="Örn: Nakit indirimi"
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Not (Opsiyonel)</label>
              <textarea
                className="form-input"
                value={collectForm.note}
                onChange={(e) => setCollectForm(p => ({ ...p, note: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Çek Detay Modal */}
      <Modal
        open={Boolean(chequeModal)}
        title={<><StatusIcon icon="receipt_long" style={{ fontSize: 20, marginRight: 8, verticalAlign: 'middle' }} /> Çek Detayları Gir</>}
        size="large"
        onClose={() => setChequeModal(null)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setChequeModal(null)} disabled={submitting}>
              İptal
            </button>
            <button className="btn btn-primary" onClick={handleSaveCheque} disabled={submitting}>
              {submitting ? 'Kaydediliyor...' : <><StatusIcon icon="save" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }} /> Çekleri Kaydet</>}
            </button>
          </>
        }
      >
        {chequeModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--color-bg-secondary)', padding: 12, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{chequeModal.customerName}</span>
                  <span className="text-muted"> - {chequeModal.jobTitle}</span>
                </div>
                <div>
                  <span className="text-muted">Toplam: </span>
                  <strong>₺{formatNumber(chequeModal.amount)}</strong>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              <table className="table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Banka</th>
                    <th>Çek No</th>
                    <th>Tutar</th>
                    <th>Vade Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {chequeForm.map((cheque, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={cheque.bank}
                          onChange={(e) => {
                            const newForm = [...chequeForm];
                            newForm[idx] = { ...newForm[idx], bank: e.target.value };
                            setChequeForm(newForm);
                          }}
                          placeholder="Banka adı"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={cheque.chequeNo}
                          onChange={(e) => {
                            const newForm = [...chequeForm];
                            newForm[idx] = { ...newForm[idx], chequeNo: e.target.value };
                            setChequeForm(newForm);
                          }}
                          placeholder="Çek numarası"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-input"
                          value={cheque.amount}
                          onChange={(e) => {
                            const newForm = [...chequeForm];
                            newForm[idx] = { ...newForm[idx], amount: Number(e.target.value) };
                            setChequeForm(newForm);
                          }}
                          style={{ width: 120 }}
                        />
                      </td>
                      <td>
                        <DateInput
                          value={cheque.due}
                          onChange={(val) => {
                            const newForm = [...chequeForm];
                            newForm[idx] = { ...newForm[idx], due: val };
                            setChequeForm(newForm);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <span className="text-muted">Girilen toplam: </span>
              <strong>₺{formatNumber(chequeForm.reduce((s, c) => s + Number(c.amount || 0), 0))}</strong>
            </div>
          </div>
        )}
      </Modal>

      {/* Ödeme Detay Modal (Alınmış) */}
      <Modal
        open={Boolean(detailModal)}
        title={<><StatusIcon icon="check_circle" style={{ fontSize: 20, marginRight: 8, verticalAlign: 'middle', color: 'var(--color-success)' }} /> Ödeme Detayı</>}
        size="medium"
        onClose={() => setDetailModal(null)}
        actions={
          <button className="btn btn-primary" onClick={() => setDetailModal(null)}>
            Kapat
          </button>
        }
      >
        {detailModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#ecfdf5', padding: 16, borderRadius: 8 }}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Müşteri</div>
                  <div style={{ fontWeight: 600 }}>{detailModal.customerName}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>İş</div>
                  <div style={{ fontWeight: 600 }}>{detailModal.jobTitle}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Ödeme Tipi</div>
                  <div><StatusIcon icon={getTypeIcon(detailModal.type)} style={{ marginRight: 4, verticalAlign: 'middle' }} />{detailModal.typeLabel}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Tutar</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-success)' }}>
                    ₺{formatNumber(detailModal.amount)}
                  </div>
                </div>
              </div>
            </div>

            {detailModal.collectedData && (
              <div style={{ border: '1px solid var(--color-border)', padding: 16, borderRadius: 8 }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}><StatusIcon icon="assignment" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }} /> Tahsilat Bilgileri</h4>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div>
                    <div className="text-muted" style={{ fontSize: 11 }}>Tahsilat Tarihi</div>
                    <div>{formatDate(detailModal.collectedData.collectedAt)}</div>
                  </div>
                  <div>
                    <div className="text-muted" style={{ fontSize: 11 }}>Alınan Tutar</div>
                    <div style={{ fontWeight: 600 }}>₺{formatNumber(detailModal.collectedData.collectedAmount)}</div>
                  </div>
                  {detailModal.collectedData.isPartial && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span className="badge badge-warning">Kısmi Tahsilat</span>
                    </div>
                  )}
                  {detailModal.collectedData.discountAmount > 0 && (
                    <>
                      <div>
                        <div className="text-muted" style={{ fontSize: 11 }}>İskonto</div>
                        <div style={{ color: 'var(--color-warning)' }}>₺{formatNumber(detailModal.collectedData.discountAmount)}</div>
                      </div>
                      <div>
                        <div className="text-muted" style={{ fontSize: 11 }}>İskonto Sebebi</div>
                        <div>{detailModal.collectedData.discountReason || '-'}</div>
                      </div>
                    </>
                  )}
                  {detailModal.collectedData.note && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <div className="text-muted" style={{ fontSize: 11 }}>Not</div>
                      <div>{detailModal.collectedData.note}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* İş Detay Modal */}
      <Modal
        open={Boolean(jobModal)}
        title={jobModal ? <><StatusIcon icon="work" style={{ fontSize: 20, marginRight: 8, verticalAlign: 'middle' }} /> {jobModal.jobTitle}</> : ''}
        size="medium"
        onClose={() => setJobModal(null)}
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => window.open(`/isler/list?job=${jobModal?.jobId}&stage=6`, '_blank')}
            >
              <StatusIcon icon="open_in_new" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }} /> Tam Detay (Yeni Sekme)
            </button>
            <button className="btn btn-primary" onClick={() => setJobModal(null)}>
              Kapat
            </button>
          </>
        }
      >
        {jobModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--color-bg-secondary)', padding: 16, borderRadius: 8 }}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>İş Kodu</div>
                  <code>{jobModal.jobId}</code>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Müşteri</div>
                  <div style={{ fontWeight: 600 }}>{jobModal.customerName}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>İş Başlığı</div>
                  <div style={{ fontWeight: 600 }}>{jobModal.jobTitle}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 11 }}>İş Durumu</div>
                  <div>
                    {JOB_STATUS[jobModal.jobStatus] ? (
                      <span><StatusIcon icon={JOB_STATUS[jobModal.jobStatus].icon} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {JOB_STATUS[jobModal.jobStatus].label}</span>
                    ) : (
                      <span>{jobModal.jobStatus}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: 20 }}>
              <div className="text-muted" style={{ marginBottom: 8 }}>
                Detaylı iş bilgileri için "Tam Detay" butonuna tıklayın
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FinansOdemelerKasa;
