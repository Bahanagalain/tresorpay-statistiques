import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import { fetchRepartitionMinisteres } from '../../api/analyticsApi';
import './MainLayout.css';

// ── Contexts ─────────────────────────────────────────────────
export const PresentationContext = createContext({
  presentMode: false, toggle: () => {},
  dgiTabOverride: null, slideshowActive: false, slideshowCdi: null, slideshowDateRange: null,
});
export const usePresentMode = () => useContext(PresentationContext);

export const SidebarContext = createContext({ collapsed: false, toggleSidebar: () => {} });
export const useSidebar = () => useContext(SidebarContext);

// ── Settings (localStorage) ──────────────────────────────────
const DEFAULT_SETTINGS = { inactivityDelay: 120, slideInterval: 30, dateFilter: 'today' };

function loadSettings() {
  try {
    const raw = localStorage.getItem('presentation_settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
export function savePresentationSettings(s) {
  localStorage.setItem('presentation_settings', JSON.stringify(s));
  // Dispatch event so MainLayout picks up changes live
  window.dispatchEvent(new Event('presentation-settings-changed'));
}

// ── Clock ────────────────────────────────────────────────────
function PresentationClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  const f = time.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const [h, m, s] = f.split(':');
  return (
    <div className="pres-clock">
      <span className="pres-clock__time">
        <span className="pres-clock__h">{h}</span><span className="pres-clock__sep">:</span>
        <span className="pres-clock__m">{m}</span><span className="pres-clock__sep pres-clock__sep--blink">:</span>
        <span className="pres-clock__s">{s}</span>
      </span>
      <span className="pres-clock__label">Yaoundé, Cameroun</span>
    </div>
  );
}

// ── Slide indicator ──────────────────────────────────────────
function SlideIndicator({ current, total, label, progress }) {
  return (
    <div className="pres-indicator">
      <div className="pres-indicator__dots">
        {Array.from({ length: Math.min(total, 20) }, (_, i) => (
          <span key={i} className={`pres-dot ${i === current ? 'active' : ''}`} />
        ))}
        {total > 20 && <span className="pres-dot-more">+{total - 20}</span>}
      </div>
      <span className="pres-indicator__label">{label}</span>
      <div className="pres-progress">
        <div className="pres-progress__fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

// ── Countdown overlay (shows last 60s before slideshow) ──────
function CountdownOverlay({ seconds }) {
  if (seconds > 60 || seconds <= 0) return null;
  return (
    <div className="pres-countdown">
      <span className="pres-countdown__num">{seconds}</span>
      <span className="pres-countdown__label">Diaporama dans</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
export default function MainLayout() {
  const [presentMode, setPresentMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState(loadSettings);

  // Slideshow
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slides, setSlidesState] = useState([]);
  const slidesRef = useRef([]);
  const setSlides = (s) => { slidesRef.current = s; setSlidesState(s); };
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [dgiTabOverride, setDgiTabOverride] = useState(null);
  const [slideshowCdi, setSlideshowCdi] = useState(null);
  const [slideshowDateRange, setSlideshowDateRange] = useState(null);
  const ignoreInputUntil = useRef(0); // ignore mouse events briefly after slide changes

  // Inactivity
  const [secondsUntilSlideshow, setSecondsUntilSlideshow] = useState(-1);
  const inactivityDeadline = useRef(0);
  const countdownInterval = useRef(null);
  const slideTimer = useRef(null);
  const progressTimer = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Reload settings when changed from Profile page
  useEffect(() => {
    const handler = () => setSettings(loadSettings());
    window.addEventListener('presentation-settings-changed', handler);
    return () => window.removeEventListener('presentation-settings-changed', handler);
  }, []);

  const toggle = useCallback(() => {
    setPresentMode(p => {
      if (p) {
        setSlideshowActive(false);
        setDgiTabOverride(null);
        setSlideshowCdi(null);
        setSlideshowDateRange(null);
        setSecondsUntilSlideshow(-1);
        clearInterval(countdownInterval.current);
      }
      return !p;
    });
  }, []);

  const toggleSidebar = () => setSidebarCollapsed(p => !p);

  // ── Build slides from CDI data ──
  const buildAndStartSlideshow = useCallback(async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let dateRange = {};
    const s = loadSettings();
    if (s.dateFilter === 'today') dateRange = { startDate: todayStr, endDate: todayStr };
    else if (s.dateFilter === 'month') {
      const now = new Date();
      dateRange = { startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), endDate: todayStr };
    }

    try {
      let effectiveDateRange = { ...dateRange };
      let cdiData = await fetchDgiCdi(dateRange);

      // If filtered date returns no data, fallback to all data
      if (cdiData.length === 0 && (dateRange.startDate || dateRange.endDate)) {
        cdiData = await fetchDgiCdi({});
        effectiveDateRange = {};
      }

      const sorted = [...cdiData]
        .filter(c => c.centre && (c.montant > 0 || c.montantRecouvre > 0 || c.nombreAvis > 0))
        .sort((a, b) => (b.montant || 0) - (a.montant || 0));

      const slideList = [
        { type: 'overview', label: 'Aperçu Stratégique' },
        ...sorted.map(cdi => ({ type: 'cdi-detail', cdiName: cdi.centre, label: cdi.centre })),
      ];

      console.log(`[Slideshow] ${slideList.length} slides (${sorted.length} CDIs)`);
      ignoreInputUntil.current = Date.now() + 3000;
      setSlides(slideList);
      setSlideshowActive(true);
      setSlideIndex(0);
      setSlideProgress(0);
      setSlideshowDateRange(effectiveDateRange);
      navigate('/tableau-de-bord', { replace: true });
      setDgiTabOverride('overview');
      setSlideshowCdi(null);
    } catch (err) {
      console.error('[Slideshow] Error building slides:', err);
      setSlides([{ type: 'overview', label: 'Aperçu Stratégique' }]);
      setSlideshowActive(true);
      setSlideIndex(0);
      setSlideshowDateRange(null);
      navigate('/tableau-de-bord', { replace: true });
      setDgiTabOverride('overview');
    }
  }, [navigate]);

  // ── Navigate to slide ──
  const goToSlide = useCallback((index) => {
    const slide = slidesRef.current[index];
    if (!slide) return;
    // Ignore mouse events for 2s after navigation to prevent false stops
    ignoreInputUntil.current = Date.now() + 2000;
    setTransitioning(true);
    setTimeout(() => {
      if (slide.type === 'overview') {
        navigate('/tableau-de-bord', { replace: true });
        setDgiTabOverride('overview');
        setSlideshowCdi(null);
      } else if (slide.type === 'cdi-detail') {
        navigate('/performance-cdi', { replace: true });
        setSlideshowCdi(slide.cdiName);
        setDgiTabOverride(null);
      }
      setSlideIndex(index);
      setSlideProgress(0);
      setTimeout(() => setTransitioning(false), 150);
    }, 350);
  }, [navigate]);

  // ── Inactivity timer ──
  const startInactivityTimer = useCallback(() => {
    const delay = settings.inactivityDelay * 1000;
    inactivityDeadline.current = Date.now() + delay;

    clearInterval(countdownInterval.current);
    countdownInterval.current = setInterval(() => {
      const remaining = Math.ceil((inactivityDeadline.current - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(countdownInterval.current);
        setSecondsUntilSlideshow(-1);
        buildAndStartSlideshow();
      } else {
        setSecondsUntilSlideshow(remaining);
      }
    }, 1000);
  }, [settings.inactivityDelay, buildAndStartSlideshow]);

  const resetInactivity = useCallback(() => {
    if (!presentMode) return;
      if (slideshowActive) {
        setSlideshowActive(false);
        setDgiTabOverride(null);
        setSlideshowCdi(null);
        setSlideshowDateRange(null);
        setSlideProgress(0);
        clearTimeout(slideTimer.current);
        clearInterval(progressTimer.current);
    }
    startInactivityTimer();
  }, [presentMode, slideshowActive, startInactivityTimer]);

  // Attach/detach inactivity listeners
  useEffect(() => {
    if (!presentMode) {
      clearInterval(countdownInterval.current);
      setSecondsUntilSlideshow(-1);
      return;
    }

    // Only react to deliberate user actions (click, key, touch) — NOT mousemove
    // mousemove triggers during navigation and would kill the slideshow
    const stopEvents = ['mousedown', 'keydown', 'touchstart'];
    const handler = (e) => {
      // Ignore during protection window after slide change
      if (Date.now() < ignoreInputUntil.current) return;
      // Ignore Escape (handled separately)
      if (e.type === 'keydown' && e.key === 'Escape') return;

      if (slideshowActive) {
        setSlideshowActive(false);
        setDgiTabOverride(null);
        setSlideshowCdi(null);
        setSlideshowDateRange(null);
        clearTimeout(slideTimer.current);
        clearInterval(progressTimer.current);
      }
      startInactivityTimer();
    };

    stopEvents.forEach(e => document.addEventListener(e, handler, { passive: true }));
    startInactivityTimer();

    return () => {
      stopEvents.forEach(e => document.removeEventListener(e, handler));
      clearInterval(countdownInterval.current);
    };
  }, [presentMode, slideshowActive, startInactivityTimer]);

  // ── Auto-advance slides ──
  useEffect(() => {
    if (!slideshowActive || slides.length === 0) {
      clearTimeout(slideTimer.current);
      clearInterval(progressTimer.current);
      return;
    }

    const intervalMs = settings.slideInterval * 1000;
    const startTime = Date.now();

    progressTimer.current = setInterval(() => {
      setSlideProgress(Math.min(100, ((Date.now() - startTime) / intervalMs) * 100));
    }, 200);

    slideTimer.current = setTimeout(() => {
      const total = slidesRef.current.length;
      if (total > 0) goToSlide((slideIndex + 1) % total);
    }, intervalMs);

    return () => {
      clearTimeout(slideTimer.current);
      clearInterval(progressTimer.current);
    };
  }, [slideshowActive, slideIndex, slides, settings.slideInterval, goToSlide]);

  // ── Escape ──
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && presentMode) { e.preventDefault(); toggle(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [presentMode, toggle]);

  return (
    <PresentationContext.Provider value={{ presentMode, toggle, dgiTabOverride, slideshowActive, slideshowCdi, slideshowDateRange }}>
      <SidebarContext.Provider value={{ collapsed: sidebarCollapsed, toggleSidebar }}>
        <div className={`app-container${presentMode ? ' presentation-mode' : ''}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
          <Sidebar />
          <div className="content-wrapper">
            <TopNav />
            <main className={`main-content ${slideshowActive && transitioning ? 'pres-fade-out' : slideshowActive ? 'pres-fade-in' : ''}`}>
              <Outlet />
            </main>
          </div>

          {presentMode && (
            <>
              <PresentationClock />
              {slideshowActive && slides.length > 0 && (
                <SlideIndicator current={slideIndex} total={slides.length} label={slides[slideIndex]?.label || ''} progress={slideProgress} />
              )}
              {!slideshowActive && secondsUntilSlideshow > 0 && secondsUntilSlideshow <= 60 && (
                <CountdownOverlay seconds={secondsUntilSlideshow} />
              )}
              <button className="pres-exit-btn" onClick={toggle} title="Quitter (Esc)">Esc</button>
            </>
          )}
        </div>
      </SidebarContext.Provider>
    </PresentationContext.Provider>
  );
}
