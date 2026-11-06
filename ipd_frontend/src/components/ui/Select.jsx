import React from 'react';

export function Select({
  label,
  id,
  options = [],
  error,
  helperText,
  className = '',
  required = false,
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-[#172033] tracking-wide">
          {label} {required && <span className="text-[#DC5A65]">*</span>}
        </label>
      )}
      <select
        id={selectId}
        required={required}
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[#172033] transition-colors focus:outline-none focus:ring-2 focus:ring-[#5865E8] focus:border-transparent ${
          error ? 'border-[#DC5A65] focus:ring-[#DC5A65]' : 'border-[#E5E9F2]'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      {error && <p className="text-xs text-[#DC5A65] font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#687386]">{helperText}</p>}
    </div>
  );
}

export function Textarea({
  label,
  id,
  error,
  helperText,
  rows = 3,
  className = '',
  required = false,
  ...props
}) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-xs font-semibold text-[#172033] tracking-wide">
          {label} {required && <span className="text-[#DC5A65]">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        required={required}
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[#172033] placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-[#5865E8] focus:border-transparent ${
          error ? 'border-[#DC5A65] focus:ring-[#DC5A65]' : 'border-[#E5E9F2]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#DC5A65] font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#687386]">{helperText}</p>}
    </div>
  );
}
