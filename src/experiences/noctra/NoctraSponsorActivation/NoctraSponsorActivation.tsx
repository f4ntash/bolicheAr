import { useEffect, useState } from 'react'
import { ArrowRight, Check, Compass, Gift, LockKeyhole, Sparkles, Ticket } from 'lucide-react'
import type { ExperienceRuntime } from '../../../types'
import { assetUrl } from '../../../utils/assets'
import { NoctraSectionFrame } from '../NoctraEditorialSections'

type NoctraSponsorActivationProps = {
  experience: ExperienceRuntime
  editionId: string
  isFound: boolean
  onBack: () => void
  onFind: () => void
  onPhoto: () => void
  onPassport: () => void
  onContinue: () => void
}

export default function NoctraSponsorActivation({ experience, editionId, isFound, onBack, onFind, onPhoto, onPassport, onContinue }: NoctraSponsorActivationProps) {
  const [hasSavedMoment, setHasSavedMoment] = useState(false)
  const drop = experience.config.engagement?.drop
  const activeDrop = experience.config.stations.find((station) => station.id === 'nova-drop')
  const steps = [
    { label: 'ENCONTRAR', done: isFound },
    { label: 'ACTIVAR', done: isFound },
    { label: 'DESBLOQUEAR', done: isFound },
    { label: 'GUARDAR', done: hasSavedMoment },
  ]
  useEffect(() => {
    let active = true
    if (!isFound) { setHasSavedMoment(false); return () => { active = false } }
    void import('../noctraMoments').then(({ getLatestNoctraMoment }) => getLatestNoctraMoment('nova-drop', editionId)).then((moment) => {
      if (active) setHasSavedMoment(Boolean(moment?.photo))
    })
    return () => { active = false }
  }, [editionId, isFound])

  return <NoctraSectionFrame section="ACTIVACIÓN DE MARCA" onBack={onBack} className="noctra-nova-section">
    <div className="noctra-nova__brand"><img src={assetUrl('experiences/noctra/nova-mark.svg')} alt="NOVA" /><span>MARCA FICTICIA · NIGHT 03</span></div>
    <div className="noctra-nova__hero">
      <div className="noctra-nova__hero-copy"><span>{isFound ? 'DROP ENCONTRADO' : 'ACTIVACIÓN EXCLUSIVA'}</span><h1>NOVA<br />DROP.</h1><p>Encontrá el drop. Desbloqueá una pieza especial.</p></div>
      <img className="noctra-nova__hero-art" src={assetUrl(isFound ? 'experiences/noctra/passes/noctra-pass-nova-pass.svg' : 'experiences/noctra/rewards/noctra-reward-nova-drop.svg')} alt={isFound ? 'NOVA Drop collectible pass' : 'NOVA Drop conceptual reward'} />
    </div>
    <div className="noctra-nova__status" role="status">
      {isFound ? <Check size={19} /> : <LockKeyhole size={18} />}
      <div><strong>{hasSavedMoment ? 'RECUERDO GUARDADO · NOVA DROP' : isFound ? 'COMPLETADO · NOVA DROP' : drop?.title ?? 'DROP BLOQUEADO'}</strong><span>{isFound ? 'NOVA Pass y frame habilitados en Photo Studio.' : drop?.description ?? activeDrop?.description}</span></div>
    </div>
    <div className="noctra-nova__steps" aria-label="Progreso de la activación">
      {steps.map((step) => <span className={step.done ? 'is-done' : ''} key={step.label}>{step.done && <Check size={11} />}{step.label}</span>)}
    </div>
    <div className="noctra-nova__actions">
      {isFound
        ? <button type="button" className="noctra-editorial__primary" onClick={onPhoto}><Sparkles size={17} /> CREAR FOTO NOVA <ArrowRight size={16} /></button>
        : <button type="button" className="noctra-editorial__primary" onClick={onFind}><Compass size={17} /> ENCONTRAR DROP <ArrowRight size={16} /></button>}
      {isFound && <button type="button" className="noctra-nova__secondary" onClick={onPassport}><Ticket size={16} /> VER EN PASSPORT</button>}
      <button type="button" className="noctra-nova__secondary" onClick={onContinue}>VOLVER AL RECORRIDO <ArrowRight size={15} /></button>
    </div>
    <p className="noctra-nova__disclaimer"><Gift size={13} /> Activación conceptual de NOVA. Sin beneficio comercial real.</p>
  </NoctraSectionFrame>
}
