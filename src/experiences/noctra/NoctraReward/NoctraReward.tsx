import { ArrowLeft, ArrowRight, Check, Gift, LockKeyhole } from 'lucide-react'
import type { ExperienceRuntime } from '../../../types'
import NoctraHeader from '../components/NoctraHeader/NoctraHeader'
import './NoctraReward.css'

type NoctraRewardProps = {
  experience: ExperienceRuntime
  unlocked: boolean
  progress: number
  required: number
  onBack: () => void
  onPhoto: () => void
  onExplore: () => void
}

export default function NoctraReward({ experience, unlocked, progress, required, onBack, onPhoto, onExplore }: NoctraRewardProps) {
  const rewardImage = experience.config.passportHistory.find((item) => item.stationId === 'final-drop')?.image ?? experience.stationById['main-stage'].image
  return <section className={`phone-screen noctra-reward ${unlocked ? 'is-unlocked' : 'is-locked'}`}>
    <div className="noctra-reward__art" style={{ backgroundImage: `url(${rewardImage})` }} aria-hidden="true" />
    <div className="noctra-reward__glow" aria-hidden="true" />
    <NoctraHeader page="Final Drop" onBack={onBack} />
    <main className="noctra-reward__content">
      <p className="noctra-eyebrow">{unlocked ? 'NOCTRA COMPLETED' : 'PREMIO BLOQUEADO'} <span /></p>
      <div className="noctra-reward__badge" aria-hidden="true"><Gift size={32} /><span>{unlocked ? <Check size={15} /> : <LockKeyhole size={15} />}</span></div>
      <h1>{unlocked ? <>Access backstage<br /><em>unlocked.</em></> : <>La noche<br /><em>continúa.</em></>}</h1>
      <p>{unlocked ? 'Completaste NOCTRA. Este último acceso también es tuyo.' : `Desbloqueá ${required} señales principales para abrir la última puerta.`}</p>
      <article className="noctra-reward__pass">
        <div className="noctra-reward__pass-top"><span>NOCTRA · MENDOZA 2026</span><span>{unlocked ? 'ACCESO DIGITAL' : `${progress} / ${required}`}</span></div>
        <strong>BACKSTAGE PASS</strong>
        <span>NOCTRA · ACCESO EXCLUSIVO · DEMO CONCEPTUAL</span>
        <div className="noctra-reward__barcode" aria-hidden="true" />
      </article>
      {unlocked ? <button type="button" className="noctra-primary-action" onClick={onPhoto}>Crear foto de cierre <ArrowRight size={16} /></button> : <button type="button" className="noctra-secondary-action" onClick={onExplore}><ArrowLeft size={16} /> Volver al recorrido</button>}
      <small className="noctra-reward__disclaimer">Recompensa ficticia · Sin validez real</small>
    </main>
  </section>
}
