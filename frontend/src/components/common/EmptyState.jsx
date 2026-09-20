import React from 'react';
import Button from './Button';

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  badgeText = 'Foundation Ready',
  actionLabel,
  onAction,
  actionIcon,
  upcomingFeatures = [],
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 backdrop-blur-sm ${className}`}
    >
      {Icon && (
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
            <Icon className="w-8 h-8" />
          </div>
          {badgeText && (
            <span className="absolute -bottom-2 -right-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-slate-800 text-sky-300 border border-slate-700 shadow-sm">
              {badgeText}
            </span>
          )}
        </div>
      )}

      <h3 className="text-lg md:text-xl font-semibold text-slate-100 mb-2">
        {title}
      </h3>

      <p className="text-sm text-slate-400 max-w-lg leading-relaxed mb-6">
        {description}
      </p>

      {upcomingFeatures.length > 0 && (
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 mb-6 text-left">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
            Planned Capabilities
          </h4>
          <ul className="space-y-2">
            {upcomingFeatures.map((feature, idx) => (
              <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          variant="primary"
          leftIcon={actionIcon}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
