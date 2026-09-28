import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import { assetUrl } from '../../../../utils/assets'
import './NoctraHeader.css'

type NoctraHeaderProps = {
  page?: string
  onBack?: () => void
  onMenu?: () => void
}

export default function NoctraHeader({ page, onBack, onMenu }: NoctraHeaderProps) {
  return <header className="noctra-header">
    {onBack ? <button type="button" className="noctra-header__back" onClick={onBack} aria-label="Volver al recorrido"><ArrowLeft size={19} /></button> : <span className="noctra-header__spacer" />}
    <img className="noctra-header__logo" src={assetUrl('experiences/noctra/noctra-wordmark.svg')} alt="NOCTRA" />
    {onMenu ? <button type="button" className="noctra-header__menu" onClick={onMenu} aria-label="Abrir menú"><MoreHorizontal size={21} /></button> : page ? <span className="noctra-header__page">{page}</span> : <span className="noctra-header__spacer" />}
  </header>
}
