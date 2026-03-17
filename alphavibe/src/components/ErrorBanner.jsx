import { AlertTriangle, RefreshCw, X } from 'lucide-react';

export default function ErrorBanner({ message, onRetry, onDismiss }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-red-950/30 border border-red-800/40 rounded-lg">
      <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-300 mb-0.5">Request Failed</p>
        <p className="text-xs text-red-400/80 leading-relaxed break-words">
          {message || 'Unable to reach the OpenBB backend at localhost:8000. Make sure the server is running.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
          >
            <RefreshCw size={11} />
            Retry
          </button>
        )}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-500/60 hover:text-red-400 transition-colors flex-shrink-0">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
