// Wrapper server da loja pública — renderiza o client component (que lê o slug via useParams).
import LojaCliente from './LojaCliente'

export default function LojaPage() {
  return <LojaCliente />
}
