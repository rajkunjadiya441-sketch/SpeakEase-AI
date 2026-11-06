import React from 'react';

export function Card({ children, className = '', hover = false, onClick, ...props }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-[#E5E9F2] shadow-xs p-6 ${
        hover ? 'transition-all duration-150 hover:shadow-md hover:border-slate-300 cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-4 border-b border-[#E5E9F2] ${className}`}>
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-[#172033]">{title}</h3>
        {description && <p className="text-xs sm:text-sm text-[#687386] mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
