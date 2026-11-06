import React from 'react';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none';

  const variants = {
    primary: 'bg-[#5865E8] hover:bg-[#4752c4] text-white focus:ring-[#5865E8] shadow-sm',
    secondary: 'bg-[#2BAE9B] hover:bg-[#238f80] text-white focus:ring-[#2BAE9B] shadow-sm',
    outline: 'border border-[#E5E9F2] bg-white hover:bg-[#F7F8FC] text-[#172033] focus:ring-[#5865E8]',
    ghost: 'bg-transparent hover:bg-slate-100 text-[#687386] hover:text-[#172033] focus:ring-slate-400',
    danger: 'bg-[#DC5A65] hover:bg-red-700 text-white focus:ring-red-500 shadow-sm',
    subtle: 'bg-[#EEF0FD] hover:bg-[#e0e4fa] text-[#5865E8] focus:ring-[#5865E8]',
    tealSubtle: 'bg-[#E7F7F5] hover:bg-[#d5f1ed] text-[#2BAE9B] focus:ring-[#2BAE9B]',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5 font-semibold',
    xl: 'text-lg px-8 py-4 gap-3 font-semibold rounded-xl',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : LeftIcon ? (
        <LeftIcon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
      {!isLoading && RightIcon ? <RightIcon className="w-4 h-4 shrink-0" /> : null}
    </button>
  );
}
