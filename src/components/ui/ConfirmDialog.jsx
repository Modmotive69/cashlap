/**
 * ConfirmDialog — reusable confirmation modal.
 * Replaces window.confirm() and window.prompt() throughout the app.
 *
 * Usage:
 *   const [dialog, setDialog] = useState(null);
 *
 *   // Simple confirm:
 *   <ConfirmDialog
 *     open={!!dialog}
 *     title="Delete Campaign"
 *     description="This cannot be undone."
 *     confirmLabel="Delete"
 *     variant="destructive"
 *     onConfirm={() => { doDelete(); setDialog(null); }}
 *     onCancel={() => setDialog(null)}
 *   />
 *
 *   // With typed confirmation (for nuclear actions):
 *   <ConfirmDialog
 *     open={!!dialog}
 *     title="Delete ALL Campaigns"
 *     description="Type DELETE ALL CAMPAIGNS to confirm."
 *     confirmPhrase="DELETE ALL CAMPAIGNS"
 *     variant="destructive"
 *     onConfirm={() => { doNuke(); setDialog(null); }}
 *     onCancel={() => setDialog(null)}
 *   />
 */
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default', // 'default' | 'destructive'
  confirmPhrase = null, // if set, user must type this exactly to enable the button
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState('');
  const needsPhrase = Boolean(confirmPhrase);
  const phraseMatches = !needsPhrase || typed === confirmPhrase;

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setTyped('');
      onCancel?.();
    }
  };

  const handleConfirm = () => {
    if (!phraseMatches) return;
    setTyped('');
    onConfirm?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {needsPhrase && (
          <div className="px-1 pb-2">
            <p className="text-sm text-gray-600 mb-2">
              Type <span className="font-mono font-bold text-red-600">{confirmPhrase}</span> to confirm:
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmPhrase}
              className="font-mono text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && phraseMatches) handleConfirm(); }}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setTyped(''); onCancel?.(); }}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!phraseMatches}
            className={cn(
              variant === 'destructive' && 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-40'
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
