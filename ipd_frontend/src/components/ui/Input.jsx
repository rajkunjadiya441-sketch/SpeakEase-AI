import React from 'react';

export function Input({
  label,
  id,
  error,
  helperText,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className = '',
  required = false,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-[#172033] tracking-wide">
          {label} {required && <span className="text-[#DC5A65]">*</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-2xs">
        {LeftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#687386]">
            <LeftIcon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          required={required}
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[#172033] placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-[#5865E8] focus:border-transparent ${
            LeftIcon ? 'pl-9' : ''
          } ${RightIcon ? 'pr-9' : ''} ${
            error ? 'border-[#DC5A65] focus:ring-[#DC5A65]' : 'border-[#E5E9F2]'
          } ${className}`}
          {...props}
        />
        {RightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#687386]">
            <RightIcon className="w-4 h-4" />
          </div>
        )}
      </div>
      {error && <p className="text-xs text-[#DC5A65] font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#687386]">{helperText}</p>}
    </div>
  );
}
