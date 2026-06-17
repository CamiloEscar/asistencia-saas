// Re-export of Sonner toast for a consistent import path.
// We use Sonner (already configured in app/App.tsx) for toasts.
// This file exists so feature code can `import { toast } from '@/components/ui/toast'`.
export { toast, Toaster } from 'sonner';
