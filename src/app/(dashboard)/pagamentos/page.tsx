import PaymentsTable from '@/components/pagamentos/PaymentsTable'
import { pagamentos } from '@/lib/mock-data'

export default function PagamentosPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <PaymentsTable pagamentos={pagamentos} />
    </div>
  )
}
