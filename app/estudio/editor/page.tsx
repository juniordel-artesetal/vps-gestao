// O Editor de imagem do SOA Design passou para o Método MAE (04/10/2026). Os designs antigos continuam
// abrindo em /estudio/editor/<id> (listados em Método MAE → Editor de imagem → Abrir… → Designs antigos).
import { redirect } from 'next/navigation'

export default function Designs() {
  redirect('/estudio/mae/imagem')
}
