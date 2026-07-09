import EventStaffGuard from '@/components/dashboard/EventStaffGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <EventStaffGuard>{children}</EventStaffGuard>;
}
