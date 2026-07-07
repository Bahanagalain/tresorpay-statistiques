import React from 'react';
import { Activity } from 'lucide-react';
import DGIFluxOTP from '../components/dgi/DGIFluxOTP';

export default function MonitoringOTP() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"><Activity size={24} /> Monitoring Flux OTP</h1>
        <p className="page-subtitle">Supervision en temps r\u00e9el des flux de paiement TresorPay \u2194 OTP</p>
      </div>
      <DGIFluxOTP />
    </div>
  );
}
