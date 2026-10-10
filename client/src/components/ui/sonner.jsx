import { Toaster as SonnerToaster, toast } from 'sonner';

/**
 * shadcn/ui Sonner setup. `useToast()` keeps its existing `(msg) => {}`
 * signature so all call sites continue to work unchanged.
 */
function Toaster({ ...props }) {
  return (
    <SonnerToaster
      position="bottom-center"
      toastOptions={{
        style: {
          background: 'var(--toast-bg)',
          color: 'var(--toast-fg)',
          border: '1px solid var(--line2)',
          borderRadius: '12px',
          fontSize: '13.5px',
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
