import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Sparkles } from 'lucide-react'
import type { NoctraEdition, NoctraMomentView, NoctraStationVariant } from './noctraMoments'
import { DEFAULT_NOCTRA_EDITION, getNoctraStationVariant, loadNoctraMomentViews, NOCTRA_EDITIONS } from './noctraMoments'
import './noctra-moments.css'

type RewardState = 'locked' | 'ready' | 'unlocked'

export function NoctraHomeLoop({ edition }: { edition: NoctraEdition }) {
  return <div className="noctra-home-loop" data-edition={edition.id} aria-label="Recompensa y señal oculta de NOCTRA">
    <p><span>4 MOMENTOS</span><ArrowRight size={15} aria-hidden="true" /><strong>BACKSTAGE ACCESS</strong></p>
    <span><i /> UNA SEÑAL OCULTA ESTÁ ACTIVA ESTA NOCHE</span>
  </div>
}

export function NoctraMomentReveal({ stationName, stationImage, variant, edition, progress, required, rewards, createLabel, onCreate, onContinue }: {
  stationName: string
  stationImage: string
  variant: NoctraStationVariant
  edition: NoctraEdition
  progress: number
  required: number
  rewards: string[]
  createLabel?: string
  onCreate: () => void
  onContinue: () => void
}) {
  return <section className={`phone-screen full-photo-screen noctra-reveal noctra-effect-${variant.effect}`} style={{ backgroundImage: `url(${stationImage})` }}>
    <div className="noctra-reveal__shade" />
    <div className="noctra-reveal__lights" aria-hidden="true"><i /><i /><i /><i /></div>
    <header className="noctra-reveal__header"><span>NOCTRA</span><span>{edition.label}</span></header>
    <div className="noctra-reveal__copy" key={variant.id}>
      <p className="noctra-reveal__eyebrow"><Sparkles size={13} /> {variant.kind === 'secret' ? 'SECRET FOUND' : 'MOMENTO DESBLOQUEADO'}</p>
      <span className="noctra-reveal__edition">{variant.badge}</span>
      <h1>{variant.title || stationName}</h1>
      <p className="noctra-reveal__progress">{String(progress).padStart(2, '0')} <i>/</i> {String(required).padStart(2, '0')} <small>MOMENTOS</small></p>
      <p className="noctra-reveal__description">{variant.description}</p>
      {rewards.length > 0 && <div className="noctra-reveal__reward"><span>DESBLOQUEASTE</span><strong>{rewards.join(' · ')}</strong></div>}
    </div>
    <div className="noctra-reveal__actions">
      <button className="cream-button" onClick={onCreate}><Camera size={17} /> {createLabel ?? 'CREAR MI MOMENTO'} <ArrowRight size={17} /></button>
      <button className="noctra-reveal__continue" onClick={onContinue}>SEGUIR EN LA NOCHE</button>
    </div>
  </section>
}

function useMomentViews() {
  const [moments, setMoments] = useState<NoctraMomentView[]>([])
  useEffect(() => {
    let cancelled = false
    let urls: string[] = []
    void loadNoctraMomentViews().then((next) => {
      if (cancelled) {
        next.forEach((item) => item.photoUrl && URL.revokeObjectURL(item.photoUrl))
        return
      }
      urls = next.flatMap((item) => item.photoUrl ? [item.photoUrl] : [])
      setMoments(next)
    })
    return () => {
      cancelled = true
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])
  return moments
}

function MomentTile({ moment, poster }: { moment: NoctraMomentView; poster?: string }) {
  const eventDate = NOCTRA_EDITIONS[moment.editionId]?.eventDate ?? moment.eventDate
  const date = new Date(`${eventDate}T12:00:00`)
  const dateLabel = Number.isNaN(date.getTime()) ? eventDate : new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '').toUpperCase()
  return <article className={`noctra-moment-tile noctra-moment-tile--${moment.kind}`} data-station-id={moment.stationId} data-has-photo={moment.photoUrl ? 'true' : 'false'}>
    <div className="noctra-moment-tile__image"><img src={moment.photoUrl || poster || ''} alt={moment.photoUrl ? `Foto guardada en ${moment.stationName}` : `Imagen de ${moment.stationName}`} /><span>{moment.kind === 'secret' ? 'SECRET' : moment.kind === 'special' ? 'SPECIAL' : 'NOCTRA'}</span></div>
    <div className="noctra-moment-tile__copy"><strong>{moment.stationName}</strong><small>{dateLabel} <i /> {moment.editionLabel}</small><p>{moment.badge || moment.reward}</p>{moment.photoUrl && <em>FOTO GUARDADA</em>}</div>
  </article>
}

export function NoctraPassportMoments({ stationImages, onOpenNight, onDiscover }: { stationImages: Record<string, string>; onOpenNight: () => void; onDiscover: () => void }) {
  const moments = useMomentViews()
  return <section className="noctra-moments-section" aria-labelledby="noctra-moments-title">
    <header className="noctra-moments-section__heading"><div><p>EL ARCHIVO PERSONAL DE TU NOCHE</p><h2 id="noctra-moments-title">TUS MOMENTOS</h2></div><span>{String(moments.length).padStart(2, '0')}</span></header>
    {moments.length ? <div className="noctra-moment-grid">{moments.slice(0, 6).map((moment) => <MomentTile key={moment.id} moment={moment} poster={stationImages[moment.stationId]} />)}</div> : <div className="noctra-moments-empty"><span>01</span><div><strong>La noche está por empezar.</strong><p>Descubrí First Pulse y guardá el primer momento.</p></div><button onClick={onDiscover} aria-label="Encontrar el primer momento"><ArrowRight size={18} /></button></div>}
    <button className="noctra-night-link" onClick={onOpenNight}>REVISAR TU NOCHE <ArrowRight size={16} /></button>
  </section>
}

export function NoctraNightRecap({ edition, rewardState, stationImages, fallbackImage, onBack, onDiscover }: { edition: NoctraEdition; rewardState: RewardState; stationImages: Record<string, string>; fallbackImage: string; onBack: () => void; onDiscover: () => void }) {
  const moments = useMomentViews().filter((moment) => moment.editionId === edition.id)
  const secretCount = moments.filter((moment) => moment.kind === 'secret').length
  const specialCount = moments.filter((moment) => moment.kind === 'special').length
  const [crewCount, setCrewCount] = useState(1)
  const photos = moments.filter((moment) => moment.photoUrl)
  const cover = photos[0]?.photoUrl || moments[0] && stationImages[moments[0].stationId] || fallbackImage
  const shareNight = async () => {
    try {
      const response = await fetch(cover)
      const blob = await response.blob()
      const file = new File([blob], `noctra-${edition.id}-night.jpg`, { type: blob.type || 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `NOCTRA · ${edition.label}`, text: 'Algunas noches pasan. Otras quedan.' })
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `noctra-${edition.id}-night.jpg`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      // Sharing is optional; the local archive remains available.
    }
  }

  return <section className="phone-screen noctra-night-recap" style={{ backgroundImage: `url(${cover})` }}>
    <div className="noctra-night-recap__shade" />
    <header className="noctra-night-recap__header"><button className="icon-button" onClick={onBack} aria-label="Volver al Passport"><ArrowLeft size={19} /></button><span>NOCTRA · {edition.label}</span><span>ARCHIVE</span></header>
    <div className="noctra-night-recap__content">
      <p className="noctra-night-recap__eyebrow">ALGUNAS NOCHES PASAN. OTRAS QUEDAN.</p>
      <h1>TU<br /><i>NOCHE</i></h1>
      <div className="noctra-night-recap__edition"><span>{edition.shortName}</span><span>{edition.dateLabel} · MENDOZA</span></div>
      <div className="noctra-night-recap__stats"><div><b>{moments.length}</b><span>MOMENTOS</span></div><div><b>{secretCount}</b><span>SECRETOS</span></div><div><b>{specialCount}</b><span>SPECIAL</span></div></div>
      <section className="noctra-night-recap__collection"><header><strong>ESTUVISTE AHÍ</strong><span>{String(photos.length).padStart(2, '0')} FOTOS</span></header><div className="noctra-night-recap__grid">{moments.slice(0, 4).map((moment) => <MomentTile key={moment.id} moment={moment} poster={stationImages[moment.stationId]} />)}{moments.length === 0 && <div className="noctra-night-recap__empty">Todavía no hay momentos guardados.<button onClick={onDiscover}>ENCONTRÁ EL PRIMERO <ArrowRight size={15} /></button></div>}</div></section>
      <section className="noctra-crew-moment"><div><span>CREW MOMENT · DEMO</span><strong>Este momento se desbloquea en grupo.</strong><small>SIMULACIÓN CONCEPTUAL · SIN PERSONAS CONECTADAS</small></div><button onClick={() => setCrewCount((count) => count >= 3 ? 1 : count + 1)} aria-label="Simular avance del Crew Moment">{crewCount}/3</button><div className="noctra-crew-moment__track"><i style={{ width: `${(crewCount / 3) * 100}%` }} /></div></section>
      <div className="noctra-night-recap__reward"><span>{rewardState === 'unlocked' ? 'ACCESS SAVED' : rewardState === 'ready' ? 'READY TO OPEN' : 'TU PRÓXIMA PUERTA'}</span><strong>BACKSTAGE ACCESS</strong><small>RECOMPENSA CONCEPTUAL DE DEMOSTRACIÓN</small></div>
      <button className="noctra-night-recap__share" onClick={() => { void shareNight() }}><Sparkles size={15} /> GUARDAR / COMPARTIR ESTA NOCHE</button>
      <button className="noctra-night-recap__back" onClick={onBack}>VOLVER AL PASSPORT</button>
    </div>
  </section>
}

export function NoctraPhotoEffects({ variant, edition, dateLabel }: { variant: NoctraStationVariant; edition: NoctraEdition; dateLabel: string }) {
  return <>
    <div className={`noctra-live-effects noctra-effect-${variant.effect}`} aria-hidden="true"><i /><i /><i /><i /><span /></div>
    <div className="noctra-preview-stamp" aria-hidden="true"><small>NOCTRA · {edition.label}</small><strong>{variant.title}</strong><span>{dateLabel}</span></div>
  </>
}

type NoctraExperienceUIProps =
  | { mode: 'home-loop'; editionId: string }
  | { mode: 'moment-reveal'; stationName: string; stationImage: string; variant: NoctraStationVariant; editionId: string; progress: number; required: number; rewards: string[]; createLabel?: string; onCreate: () => void; onContinue: () => void }
  | { mode: 'passport-moments'; stationImages: Record<string, string>; onOpenNight: () => void; onDiscover: () => void }
  | { mode: 'night-recap'; editionId: string; rewardState: RewardState; stationImages: Record<string, string>; fallbackImage: string; onBack: () => void; onDiscover: () => void }
  | { mode: 'photo-effects'; stationId: string; editionId: string }

export default function NoctraExperienceUI(props: NoctraExperienceUIProps) {
  const editionId = 'editionId' in props ? props.editionId : DEFAULT_NOCTRA_EDITION.id
  const edition = NOCTRA_EDITIONS[editionId] ?? DEFAULT_NOCTRA_EDITION
  if (props.mode === 'home-loop') return <NoctraHomeLoop edition={edition} />
  if (props.mode === 'moment-reveal') return <NoctraMomentReveal {...props} edition={edition} />
  if (props.mode === 'passport-moments') return <NoctraPassportMoments {...props} />
  if (props.mode === 'night-recap') return <NoctraNightRecap {...props} edition={edition} />
  const variant = getNoctraStationVariant(props.stationId, edition)
  return <NoctraPhotoEffects variant={variant} edition={edition} dateLabel={edition.dateLabel} />
}
