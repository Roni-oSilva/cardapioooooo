import { ToastProvider } from '@/components/admin/ui';
export const metadata = { title: 'Cozinha', robots: { index: false } };
export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
