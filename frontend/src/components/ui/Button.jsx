import { forwardRef } from 'react';

const VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:hover:bg-indigo-600',
  secondary: 'border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:hover:bg-transparent',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:hover:bg-rose-600',
  'danger-outline': 'border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:hover:bg-transparent',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent',
  ai: 'bg-violet-600 text-white hover:bg-violet-700 disabled:hover:bg-violet-600',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

/**
 * Shared button primitive for NEW or touched call sites. Existing untouched
 * buttons elsewhere keep their own inline classes — this is not a forced
 * migration, just the consistent choice going forward so new/edited actions
 * don't reinvent slightly different shades of "primary button" each time.
 */
const Button = forwardRef(({ variant = 'primary', size = 'md', className = '', ...props }, ref) => (
  <button
    ref={ref}
    type={props.type ?? 'button'}
    className={`inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`}
    {...props}
  />
));
Button.displayName = 'Button';

export default Button;
