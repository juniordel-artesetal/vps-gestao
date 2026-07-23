import GuardaAssinatura from "@/components/GuardaAssinatura"
import AppShell from '@/components/AppShell'
import NovidadesPopup from '@/components/NovidadesPopup'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GuardaAssinatura />
      <AppShell>{children}</AppShell>
      <NovidadesPopup />
    </>
  )
}
