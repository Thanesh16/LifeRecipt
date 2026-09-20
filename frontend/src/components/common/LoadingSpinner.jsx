import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ label = 'Loading...', size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`flex flex-col items-center justify-center py-12 gap-3 ${className}`}>
      <Loader2 className={`${sizeMap[size] || sizeMap.md} animate-spin text-sky-400`} />
      {label && <p className="text-xs font-medium text-slate-400">{label}</p>}
    </div>
  );
};

export default LoadingSpinner;
