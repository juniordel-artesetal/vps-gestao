import GuardaAssinatura from "@/components/GuardaAssinatura"
import AppShell from '@/components/AppShell'
import NovidadesPopup from '@/components/NovidadesPopup'
import AvisoAssinatura from '@/components/AvisoAssinatura'
import LojaPedidosPopup from '@/components/LojaPedidosPopup'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GuardaAssinatura />
      <AppShell><AvisoAssinatura />{children}</AppShell>
      <NovidadesPopup />
      <LojaPedidosPopup />
    </>
  )
}
