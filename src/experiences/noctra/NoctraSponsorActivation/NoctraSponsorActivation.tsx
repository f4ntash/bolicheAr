import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Gift, Sparkles, WandSparkles } from 'lucide-react'
import type { ExperienceRuntime } from '../../../types'
import { assetUrl } from '../../../utils/assets'
import NoctraHeader from '../components/NoctraHeader/NoctraHeader'
import './NoctraSponsorActivation.css'

type NoctraSponsorActivationProps = {
  experience: ExperienceRuntime
  onBack: () => void
  onPassport: () => void
  onContinue: () => void
}

const novadrops = [
  { eyebrow: 'NOVA · NIGHT DROP 01', title: 'Un brindis para el próximo track', benefit: 'SAMPLING FICTICIO' },
  { eyebrow: 'NOVA · NIGHT DROP 02', title: 'Un acceso preferente al backstage', benefit: 'BENEFICIO CONCEPTUAL' },
  { eyebrow: 'NOVA · NIGHT DROP 03', title: 'Un frame exclusivo para tu historia', benefit: 'CONTENIDO DE MARCA' },
]

export default function NoctraSponsorActivation({ experience, onBack, onPassport, onContinue }: NoctraSponsorActivationProps) {
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null)
  const [isRevealing, setIsRevealing] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])
  const revealDrop = () => {
    if (isRevealing) return
    setIsRevealing(true)
    timerRef.current = window.setTimeout(() => {
      setRevealedIndex(Math.floor(Math.random() * novadrops.length))
      setIsRevealing(false)
    }, 760)
  }
  const drop = revealedIndex === null ? null : novadrops[revealedIndex]

  return <section className="phone-screen noctra-sponsor">
    <div className="noctra-sponsor__art" style={{ backgroundImage: `url(${experience.config.stations.find((station) => station.id === 'nova-drop')?.image})` }} aria-hidden="true" />
    <div className="noctra-sponsor__glow" aria-hidden="true" />
    <div className="noctra-sponsor__rings" aria-hidden="true"><i /><i /><i /><i /></div>
    <NoctraHeader page="Sponsor experience" onBack={onBack} />
    <main className="noctra-sponsor__content">
      <div className="noctra-sponsor__brand"><img src={assetUrl('experiences/noctra/nova-mark.svg')} alt="NOVA" /><span>UNA EXPERIENCIA NOVA</span></div>
      <p className="noctra-eyebrow">UNA ACTIVACIÓN EXCLUSIVA <span /></p>
      <h1>NOVA<br /><em>Drop.</em></h1>
      <p className="noctra-sponsor__intro">La pista se detiene. La luz te encuentra.</p>
      <div className={`noctra-sponsor__reveal ${isRevealing ? 'is-revealing' : ''} ${drop ? 'is-open' : ''}`} aria-live="polite">
        {drop ? <><span className="noctra-sponsor__drop-label"><Gift size={14} /> {drop.eyebrow}</span><strong>{drop.title}</strong><small>{drop.benefit} · DEMO CONCEPTUAL</small></> : <><span className="noctra-sponsor__orb"><i /><i /><i /></span><small>{isRevealing ? 'BUSCANDO TU DROP…' : 'TU ACTIVACIÓN TE ESPERA'}</small></>}
      </div>
      {!drop ? <button type="button" className="noctra-sponsor__button" onClick={revealDrop} disabled={isRevealing}><WandSparkles size={16} /> {isRevealing ? 'Revelando' : 'Tocar para revelar'} <ArrowRight size={16} /></button> : <button type="button" className="noctra-sponsor__button" onClick={onPassport}><Sparkles size={16} /> Guardar en mi Passport <ArrowRight size={16} /></button>}
      <p className="noctra-sponsor__note">{drop ? 'Beneficio conceptual · Demo NOCTRA' : 'UNA ACTIVACIÓN INTERACTIVA · MENDOZA 2026'}</p>
    </main>
    <button type="button" className="noctra-sponsor__continue" onClick={onContinue}>Volver al recorrido <span>↗</span></button>
    <span className="noctra-sponsor__location">{experience.config.location} · {experience.config.eventDate}</span>
  </section>
}
