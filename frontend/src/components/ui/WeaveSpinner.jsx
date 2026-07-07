import React from 'react';
import './WeaveSpinner.css';

export default function WeaveSpinner({ size = 120, message }) {
  return (
    <div className="weave-spinner-wrapper">
      <div className="weave-spinner-container" style={{ width: size, height: size }}>
        <div className="weave-thread wt1" />
        <div className="weave-thread wt2" />
        <div className="weave-thread wt3" />
        <div className="weave-thread wt4" />
        <div className="weave-node" />
      </div>
      {message && <p className="weave-spinner-msg">{message}</p>}
    </div>
  );
}
