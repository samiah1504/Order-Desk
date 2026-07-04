import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function PageHeader({ title, subtitle, back, actions }) {
  const navigate = useNavigate()
  return (
    <div className="page-header">
      {back && (
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-lg leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
    </div>
  )
}
