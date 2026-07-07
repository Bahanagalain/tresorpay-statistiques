import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, ShieldCheck, Share2, Activity, TerminalSquare, ArrowRight, Wallet } from 'lucide-react';
import { fetchDgiAvis, fetchDgiKpi } from '../../api/dgiAnalyticsApi';
import { formatMontant } from '../../utils/format';
import './DGIFluxOTP.css';

const NODES = [
  { id: 'usager', x: 18, y: 50, icon: User, title: 'Usager', sub: 'Interface de Paiement', color: '#3b82f6' },
  { id: 'tresorpay', x: 50, y: 50, icon: ShieldCheck, title: 'TresorPay Core', sub: 'Traitement & Checksum', color: '#10b981' },
  { id: 'otp', x: 82, y: 50, icon: Share2, title: 'Agrégateur OTP', sub: 'Hub de Quittancement', color: '#f59e0b' },
];

const LINKS = [
  { id: 'l1', from: 'usager', to: 'tresorpay' },
  { id: 'l2', from: 'tresorpay', to: 'otp' },
];

const generatePath = (x1, y1, x2, y2) => {
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
};

const fmtFull = (n) => formatMontant(n);

export default function DGIFluxOTP() {
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const [activeLinks, setActiveLinks] = useState({});
  const [activeNodes, setActiveNodes] = useState({});
  const [flowTypes, setFlowTypes] = useState({});
  const [totalCollecteJour, setTotalCollecteJour] = useState(0);
  const [txCount, setTxCount] = useState(0);
  const [lastFetchedIds, setLastFetchedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);

  const addLog = useCallback((msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false }) + '.' + Math.floor(Math.random() * 999).toString().padStart(3, '0');
    setLogs(prev => [...prev.slice(-50), { time: timestamp, msg, type }]);
  }, []);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch today's KPI for total amount
  const fetchTodayKpi = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const kpi = await fetchDgiKpi({ startDate: today, endDate: today });
      setTotalCollecteJour(kpi.totalRecouvre || 0);
    } catch {
      // silently fail
    }
  }, []);

  // Fetch real avis data and display as logs
  const fetchAndDisplayAvis = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetchDgiAvis({
        startDate: undefined,
        endDate: undefined,
        page: 1,
        limit: 50,
      });

      const avisList = response.data || [];
      
      if (avisList.length === 0) {
        setNoData(true);
        setLoading(false);
        return;
      }

      setNoData(false);

      // Find new avis not yet logged
      const newAvis = avisList.filter(a => !lastFetchedIds.has(a.numero));
      
      if (newAvis.length > 0) {
        const newIds = new Set(lastFetchedIds);
        
        for (const avis of newAvis) {
          newIds.add(avis.numero);
          const statut = avis.statut;
          const montant = fmtFull(avis.montantTotal);
          
          if (statut === 'PAID') {
            // Animate payment flow
            setActiveLinks({ l1: true, l2: true });
            setActiveNodes({ usager: true, tresorpay: true, otp: true });
            setFlowTypes({ l1: 'payment', l2: 'payment' });
            addLog(`[PAYÉ] Avis ${avis.numero} — ${montant} — ${avis.contribuable || 'Contribuable'}`, 'success');
            setTxCount(prev => prev + 1);
          } else if (statut === 'PENDING') {
            setActiveLinks({ l1: true });
            setActiveNodes({ usager: true, tresorpay: true });
            setFlowTypes({ l1: 'search' });
            addLog(`[ÉMIS] Avis ${avis.numero} — ${montant} — En attente de paiement`, 'info');
          } else if (statut === 'OVERDUE') {
            addLog(`[ÉMIS] Avis ${avis.numero} — ${montant} — En attente de paiement`, 'warning');
          }
        }
        
        setLastFetchedIds(newIds);
        
        // Reset animation after display
        setTimeout(() => {
          setActiveLinks({});
          setActiveNodes({});
          setFlowTypes({});
        }, 1500);
      }
      
      setLoading(false);
    } catch (err) {
      setLoading(false);
      addLog(`[ERREUR] Impossible de récupérer les avis: ${err?.message || 'Erreur réseau'}`, 'warning');
    }
  }, [addLog, lastFetchedIds]);

  // Initial load + periodic polling
  useEffect(() => {
    addLog('[SYSTEM] Connexion au flux TresorPay ↔ OTP...', 'system');
    
    fetchTodayKpi();
    fetchAndDisplayAvis();

    // Poll every 15 seconds for new data
    const interval = setInterval(() => {
      fetchTodayKpi();
      fetchAndDisplayAvis();
    }, 15000);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flux-otp-wrapper animate-fade-in">
      {/* Header */}
      <div className="flux-header">
        <div className="flux-header-title">
          <Activity size={20} className="text-primary pulse-icon" />
          <h3>Flux TresorPay ↔ OTP — Temps Réel</h3>
        </div>
        <div className="flux-legend">
          <span className="legend-item"><div className="legend-color" style={{background: '#3b82f6'}}></div> Émission d'avis</span>
          <span className="legend-item"><div className="legend-color" style={{background: '#10b981'}}></div> Paiement / Quittancement</span>
        </div>
      </div>

      <div className="flux-canvas-container">
        <div className="flux-grid"></div>

        {/* Total collecté du jour - badge central */}
        <div className="flux-total-badge">
          <Wallet size={16} />
          <div className="ftb-content">
            <span className="ftb-label">Collecte du jour</span>
            <span className="ftb-value">{fmtFull(totalCollecteJour)}</span>
          </div>
          <span className="ftb-count">{txCount} tx</span>
        </div>

        <svg className="flux-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {LINKS.map(link => {
            const nodeFrom = NODES.find(n => n.id === link.from);
            const nodeTo = NODES.find(n => n.id === link.to);
            const pathData = generatePath(nodeFrom.x, nodeFrom.y, nodeTo.x, nodeTo.y);
            const isActive = activeLinks[link.id];
            const flowType = flowTypes[link.id];
            const strokeColor = flowType === 'payment' ? '#10b981' : '#3b82f6';

            return (
              <g key={link.id}>
                <path d={pathData} className="flux-link-base" vectorEffect="non-scaling-stroke" />
                {isActive && (
                  <path 
                    d={pathData} 
                    className="flux-link-active" 
                    stroke={strokeColor} 
                    filter="url(#glow)"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {NODES.map(node => {
          const isActive = activeNodes[node.id];
          const Icon = node.icon;
          return (
            <div 
              key={node.id} 
              className={`flux-node ${isActive ? 'active' : ''}`}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: 'translate(-50%, -50%)',
                borderColor: isActive ? node.color : ''
              }}
            >
              <div className="node-icon-wrapper" style={{color: node.color, backgroundColor: `${node.color}15`}}>
                <Icon size={22} className={isActive ? 'pulse-icon' : ''} />
              </div>
              <div className="node-content">
                <span className="node-title">{node.title}</span>
                <span className="node-sub">{node.sub}</span>
              </div>
              {isActive && (
                <div className="node-glow-bg" style={{backgroundColor: node.color}} />
              )}
            </div>
          );
        })}

        {/* Flow direction arrows */}
        <div className="flux-direction-label" style={{ left: '34%', top: '38%' }}>
          <ArrowRight size={14} /> Requête
        </div>
        <div className="flux-direction-label" style={{ left: '66%', top: '38%' }}>
          <ArrowRight size={14} /> Quittance
        </div>

        {/* No data overlay */}
        {noData && !loading && (
          <div className="flux-no-data-overlay">
            <div className="flux-no-data-content">
              <Activity size={32} />
              <p>En attente de flux...</p>
              <span>Les données apparaîtront ici dès réception des premiers avis</span>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Log */}
      <div className="flux-terminal">
        <div className="term-header">
          <TerminalSquare size={14} /> Flux Server Logs — TresorPay ↔ OTP
          <div className="term-dots">
            <span/> <span/> <span/>
          </div>
        </div>
        <div className="term-body">
          {loading && logs.length <= 1 && (
            <div className="term-line">
              <span className="term-time">[--:--:--.---]</span>
              <span className="term-msg type-system">Chargement des données...</span>
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} className="term-line animate-slide-up" style={{animationDuration: '0.2s'}}>
              <span className="term-time">[{log.time}]</span>
              <span className={`term-msg type-${log.type}`}>{log.msg}</span>
            </div>
          ))}
          {noData && !loading && (
            <div className="term-line">
              <span className="term-time">[{new Date().toLocaleTimeString('fr-FR', { hour12: false })}]</span>
              <span className="term-msg type-system">[INFO] Aucun avis réceptionné. Polling actif toutes les 15s...</span>
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
