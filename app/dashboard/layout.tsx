import Sidebar from '@/components/Sidebar'
import NovidadesPopup from '@/components/NovidadesPopup'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <NovidadesPopup />
    </div>
  )
}
