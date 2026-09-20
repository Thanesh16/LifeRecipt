import React from 'react';

export const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  colorScheme = 'sky', // sky, emerald, amber, purple
  className = '',
}) => {
  const colorStyles = {
    sky: {
      iconBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      glow: 'hover:border-sky-500/40',
    },
    emerald: {
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      glow: 'hover:border-emerald-500/40',
    },
    amber: {
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      glow: 'hover:border-amber-500/40',
    },
    purple: {
      iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      glow: 'hover:border-purple-500/40',
    },
  };

  const scheme = colorStyles[colorScheme] || colorStyles.sky;

  return (
    <div
      className={`rounded-xl border border-slate-800/90 bg-slate-900/70 p-5 transition-all duration-200 ${scheme.glow} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {title}
        </span>
        {Icon && (
          <div className={`p-2.5 rounded-lg border ${scheme.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="text-2xl font-bold text-slate-100 tracking-tight">
          {value}
        </div>
        {description && (
          <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
            {trend && <span className="font-medium text-emerald-400">{trend}</span>}
            <span>{description}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;
