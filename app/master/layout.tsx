// Auth do master é feita pelo middleware.ts
// Este layout só aplica o tema escuro
export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {children}
    </div>
  )
}
