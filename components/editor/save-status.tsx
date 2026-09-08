import { AlertCircle, CheckCircle, Loader2, CircleDot } from 'lucide-react';

export function SaveStatus({
  dirty,
  saving,
  error,
}: {
  dirty: boolean;
  saving: boolean;
  error: string;
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
        <AlertCircle className="h-3.5 w-3.5" />
        Save failed
      </span>
    );
  }
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <CircleDot className="h-3.5 w-3.5" />
        Unsaved changes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
      <CheckCircle className="h-3.5 w-3.5" />
      Saved
    </span>
  );
}
