import GuardaAssinatura from '@/components/GuardaAssinatura'
import AppShell from '@/components/AppShell'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GuardaAssinatura />
      <AppShell>{children}</AppShell>
    </>
  )
}
