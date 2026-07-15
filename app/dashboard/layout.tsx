import AppShell from '@/components/AppShell'
import NovidadesPopup from '@/components/NovidadesPopup'
import PromoPopup from '@/components/PromoPopup'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <NovidadesPopup />
      <PromoPopup />
    </>
  )
}
