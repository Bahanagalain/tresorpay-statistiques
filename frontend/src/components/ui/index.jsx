import React from 'react';

export function Button({ children, className = '', variant = 'primary', ...props }) {
  const btnClass = variant === 'outline' ? 'btn-secondary-outline' : 'btn-primary';
  return (
    <button className={`${btnClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`card-layer ${className}`} {...props}>
      {children}
    </div>
  );
}

export function DepartmentChip({ department }) {
  const deptLower = department.toLowerCase();
  let chipClass = 'chip-minfi';
  if (deptLower === 'dgi') chipClass = 'chip-dgi';
  else if (deptLower === 'dgd') chipClass = 'chip-dgd';
  
  return (
    <span className={`dept-chip ${chipClass}`}>
      {department}
    </span>
  );
}

export function GhostInput({ className = '', ...props }) {
  return (
    <input className={`ghost-input ${className}`} {...props} />
  );
}
