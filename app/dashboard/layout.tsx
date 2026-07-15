import AppShell from '@/components/AppShell'
import NovidadesPopup from '@/components/NovidadesPopup'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <NovidadesPopup />
    </>
  )
}
