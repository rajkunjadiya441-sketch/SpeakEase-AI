import React from 'react';

export function Badge({ children, variant = 'default', size = 'sm', className = '' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    primary: 'bg-[#EEF0FD] text-[#5865E8] border-[#c8cef7]',
    teal: 'bg-[#E7F7F5] text-[#2BAE9B] border-[#b0e6df]',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-medium px-2.5 py-1',
    lg: 'text-sm font-medium px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variants[variant] || variants.default} ${sizes[size] || sizes.sm} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
    case 'COMPLETED':
    case 'APPROVED':
      return <Badge variant="success">{status}</Badge>;
    case 'NEEDS ATTENTION':
    case 'IN_PROGRESS':
    case 'PENDING':
      return <Badge variant="warning">{status === 'IN_PROGRESS' ? 'In Progress' : status}</Badge>;
    case 'DRAFT':
    case 'NEW':
      return <Badge variant="primary">{status}</Badge>;
    case 'ASSIGNED':
      return <Badge variant="teal">Assigned</Badge>;
    case 'INACTIVE':
      return <Badge variant="default">Inactive</Badge>;
    default:
      return <Badge variant="default">{status || 'Unknown'}</Badge>;
  }
}
