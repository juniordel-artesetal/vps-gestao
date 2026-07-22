import GuardaAssinatura from "@/components/GuardaAssinatura"
import Sidebar from '@/components/Sidebar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <GuardaAssinatura />
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
