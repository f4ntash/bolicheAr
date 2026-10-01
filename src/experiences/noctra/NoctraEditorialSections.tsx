import { ArrowLeft, ArrowRight, CalendarDays, Check, Compass, LockKeyhole, Music2, Sparkles, Ticket, UnlockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import { assetUrl } from '../../utils/assets'
import './NoctraEditorialSections.css'

type RewardState = 'locked' | 'ready' | 'unlocked'

type SectionFrameProps = {
  section: string
  children: ReactNode
  className?: string
  onBack: () => void
}

export function NoctraSectionFrame({ section, children, className = '', onBack }: SectionFrameProps) {
  return <section className={`phone-screen noctra-editorial-section ${className}`}>
    <header className="noctra-editorial__header">
      <button type="button" onClick={onBack} aria-label="Volver al menú"><ArrowLeft size={20} /><span>MENÚ</span></button>
      <img src={assetUrl('experiences/noctra/noctra-mark.svg')} alt="NOCTRA" />
      <span className="noctra-editorial__header-label">{section}</span>
    </header>
    <div className="noctra-editorial__content">{children}</div>
  </section>
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="noctra-editorial__heading">
    <span className="noctra-editorial__eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p>{description}</p>
  </div>
}

const upcomingDates = [
  { date: '12 OCT', title: 'NIGHT 04', location: 'MENDOZA', state: 'DISPONIBLE', art: 'experiences/noctra/photos/crowds/noctra-photo-crowd-01-landscape.webp', tone: 'pink' },
  { date: '26 OCT', title: 'SUNSET SPECIAL', location: 'LUJÁN DE CUYO', state: 'PRÓXIMAMENTE', art: 'experiences/noctra/photos/sunsets/noctra-photo-sunset-palms-01-landscape.webp', tone: 'coral' },
  { date: '09 NOV', title: 'NIGHT 05', location: 'MENDOZA', state: 'SOLD OUT', art: 'experiences/noctra/photos/friends/noctra-photo-friends-01-landscape.webp', tone: 'blue' },
  { date: '23 NOV', title: 'SPECIAL DROP', location: 'UBICACIÓN POR REVELAR', state: 'UBICACIÓN SECRETA', art: 'experiences/noctra/photos/backstage/noctra-photo-backstage-corridor-01-landscape.webp', tone: 'lime' },
]

export function NoctraUpcomingDates({ onBack }: { onBack: () => void }) {
  return <NoctraSectionFrame section="PRÓXIMAS FECHAS" onBack={onBack} className="noctra-upcoming-dates">
    <PageHeading eyebrow="NOCTRA · CALENDARIO CONCEPTUAL" title="Próximas fechas" description="Nuevas noches. Nuevos momentos." />
    <div className="noctra-dates-grid">
      {upcomingDates.map((date, index) => <article className={`noctra-date-poster noctra-date-poster--${date.tone}`} key={date.date}>
        <div className="noctra-date-poster__photo" style={{ backgroundImage: `url(${assetUrl(date.art)})` }} aria-hidden="true" />
        <span className="noctra-date-poster__index">EDICIÓN 0{index + 4}</span>
        <strong className="noctra-date-poster__date">{date.date}</strong>
        <h2>{date.title}</h2>
        <p>{date.location}</p>
        <span className="noctra-date-poster__state"><i />{date.state}</span>
      </article>)}
    </div>
    <p className="noctra-editorial__note"><CalendarDays size={15} /> Fechas y estados conceptuales. Esta demo no ofrece entradas ni reservas.</p>
  </NoctraSectionFrame>
}

const lineup = [
  { time: '22:00', name: 'LERA', stage: 'SUNSET', role: 'OPENING', note: 'El primer pulso · warm up', opening: true },
  { time: '23:30', name: 'AURA 91', stage: 'MAIN', role: 'MAIN', note: 'Ritmo abierto · live set', main: true },
  { time: '01:00', name: 'NULLA', stage: 'MAIN', role: 'MAIN', note: 'Frecuencia central · headliner', main: true, headliner: true },
  { time: '02:30', name: 'KORO', stage: 'MAIN', role: 'MAIN', note: 'La pista sigue · extended set', main: true },
  { time: '04:00', name: 'VANTA', stage: 'AFTER', role: 'CLOSING', note: 'Último tramo · closing set', closing: true },
]

export function NoctraLineup({ onBack }: { onBack: () => void }) {
  return <NoctraSectionFrame section="LINE UP" onBack={onBack} className="noctra-lineup-page">
    <div className="noctra-lineup-poster">
      <img className="noctra-lineup-poster__photo" src={assetUrl('experiences/noctra/photos/crowds/noctra-photo-crowd-01-portrait.webp')} alt="Público en una noche NOCTRA" />
      <div className="noctra-lineup-poster__tape">MENDOZA · NIGHT 03</div>
      <p>UNA NOCHE<br />EN FRECUENCIA</p>
      <span>22:00 — 05:00</span>
      <i aria-hidden="true">N</i>
    </div>
    <div className="noctra-lineup-list-heading"><span>PROGRAMACIÓN</span><Music2 size={17} /><span>ARTISTAS FICTICIOS</span></div>
    <ol className="noctra-lineup-list">
      {lineup.map((act) => <li className={`${act.opening ? 'is-opening' : ''}${act.main ? ' is-main' : ''}${act.headliner ? ' is-headliner' : ''}${act.closing ? ' is-closing' : ''}`} key={act.name}>
        <time>{act.time}</time>
        <div><h2>{act.name}</h2><p>{act.note}</p></div>
        <span className="noctra-lineup-list__markers"><b className="noctra-lineup-list__role">{act.role}</b><small className="noctra-lineup-list__stage">{act.stage}</small></span>
      </li>)}
    </ol>
    <p className="noctra-editorial__note"><Music2 size={15} /> Programación conceptual. Line up sujeto a adaptación.</p>
  </NoctraSectionFrame>
}

type MomentCatalogProps = {
  onBack: () => void
  onExplore: () => void
  isStationFound: (stationId: string) => boolean
  engagementCount: number
  requiredCount: number
  rewardState: RewardState
}

export function NoctraMomentsCatalog({ onBack, onExplore, isStationFound, engagementCount, requiredCount, rewardState }: MomentCatalogProps) {
  const moments = [
    { id: 'entrance', title: 'FIRST PULSE', description: 'La noche empieza acá.', reward: 'Frame NOCTRA', kind: 'PRINCIPAL', image: 'experiences/noctra/moments/noctra-moment-first-pulse.svg', status: isStationFound('entrance') ? 'COMPLETADO' : 'DISPONIBLE' },
    { id: 'main-stage', title: 'MAIN STAGE', description: 'El momento central.', reward: 'Frame MAIN STAGE', kind: 'PRINCIPAL', image: 'experiences/noctra/moments/noctra-moment-main-stage.svg', status: isStationFound('main-stage') ? 'COMPLETADO' : 'DISPONIBLE' },
    { id: 'hidden-frequency', title: 'HIDDEN FREQUENCY', description: 'No todos la encuentran.', reward: 'Secret Badge', kind: 'SECRET', image: 'experiences/noctra/moments/noctra-moment-hidden-frequency.svg', status: isStationFound('hidden-frequency') ? 'COMPLETADO' : 'SECRET' },
    { id: 'nova-drop', title: 'NOVA DROP', description: 'Una activación especial.', reward: 'NOVA pass + frame', kind: 'BONUS', image: 'experiences/noctra/moments/noctra-moment-nova-drop.svg', status: isStationFound('nova-drop') ? 'COMPLETADO' : 'BONUS' },
    { id: 'final-drop', title: 'FINAL DROP · BACKSTAGE', description: 'Completá 4 momentos.', reward: 'Backstage Access', kind: 'REWARD', image: 'experiences/noctra/moments/noctra-moment-final-drop.svg', status: rewardState === 'locked' ? 'LOCKED' : rewardState === 'ready' ? 'LISTO' : 'DESBLOQUEADO' },
  ]
  const collectedCount = moments.filter((moment) => moment.status === 'COMPLETADO' || moment.status === 'DESBLOQUEADO').length

  return <NoctraSectionFrame section="MOMENTOS" onBack={onBack} className="noctra-moments-catalog">
    <PageHeading eyebrow="TU ARCHIVO DE LA NOCHE" title="Momentos" description="Cada señal suma una pieza a tu colección." />
    <div className="noctra-moments-progress"><div><span>COLECCIÓN</span><strong>{String(collectedCount).padStart(2, '0')} / 05</strong></div><div className="noctra-moments-progress__track"><i style={{ width: `${collectedCount / moments.length * 100}%` }} /></div><small>{engagementCount} / {requiredCount} para Backstage Access</small></div>
    <div className="noctra-catalog-list">
      {moments.map((moment, index) => <article className={`noctra-catalog-moment${moment.status === 'LOCKED' ? ' is-locked' : ''}`} key={moment.id}>
        <div className="noctra-catalog-moment__art"><img src={assetUrl(moment.image)} alt="" /><span>0{index + 1}</span></div>
        <div className="noctra-catalog-moment__copy"><div><span className="noctra-catalog-moment__kind">{moment.kind}</span><span className={`noctra-catalog-moment__status status-${moment.status.toLowerCase().replace(/ /g, '-')}`}>{moment.status === 'COMPLETADO' && <Check size={12} />}{moment.status === 'LOCKED' && <LockKeyhole size={12} />}{moment.status}</span></div><h2>{moment.title}</h2><p>{moment.description}</p><small><Sparkles size={12} /> {moment.reward}</small></div>
      </article>)}
    </div>
    <button type="button" className="noctra-editorial__primary" onClick={onExplore}><Compass size={17} /> IR AL RECORRIDO <ArrowRight size={16} /></button>
  </NoctraSectionFrame>
}

type EditionProps = {
  onBack: () => void
  editionId: string
  isStationFound: (stationId: string) => boolean
  rewardState: RewardState
}

const editionPresentation: Record<string, { label: string; dateLabel: string }> = {
  'night-03': { label: 'NIGHT 03', dateLabel: '29.09.26' },
  'night-02': { label: 'NIGHT 02', dateLabel: '22 AGO 2026' },
  'sunset-special': { label: 'SUNSET EDITION', dateLabel: '28 SEP 2026' },
}

export function NoctraEditionSection({ onBack, editionId, isStationFound, rewardState }: EditionProps) {
  const edition = editionPresentation[editionId] ?? editionPresentation['night-03']
  const date = edition.dateLabel
  const foundCount = ['entrance', 'main-stage', 'hidden-frequency', 'nova-drop'].filter(isStationFound).length + (rewardState === 'unlocked' ? 1 : 0)

  return <NoctraSectionFrame section="EDICIÓN" onBack={onBack} className="noctra-edition-page">
    <div className="noctra-edition-hero">
      <img src={assetUrl('experiences/noctra/photos/sunsets/noctra-photo-sunset-palms-01-landscape.webp')} alt="Atardecer en Mendoza, arte conceptual de Night 03" />
      <div className="noctra-edition-hero__grain" />
      <span className="noctra-edition-hero__active">EDICIÓN ACTIVA</span>
      <p>{edition.label}</p>
      <strong>MENDOZA</strong>
      <small>{date}</small>
      <img className="noctra-edition-hero__badge" src={assetUrl('experiences/noctra/badges/noctra-badge-night-03.svg')} alt="Insignia Night 03" />
    </div>
    <div className="noctra-edition-stats">
      <div><strong>{String(foundCount).padStart(2, '0')} / 05</strong><span>MOMENTOS</span></div>
      <div><strong>{isStationFound('hidden-frequency') ? 'FOUND' : 'SECRET'}</strong><span>HIDDEN FREQUENCY</span></div>
      <div><strong>{rewardState === 'locked' ? 'LOCKED' : rewardState === 'ready' ? 'READY' : 'UNLOCKED'}</strong><span>BACKSTAGE ACCESS</span></div>
    </div>
    <p className="noctra-edition-copy">Cada noche tiene sus propios momentos. Lo que desbloqueás queda guardado en esa edición.</p>
    <div className="noctra-edition-archive"><span>ARCHIVO DE EDICIONES</span><div><b className={editionId === 'night-02' ? 'is-current' : ''}>NIGHT 02</b><b className={editionId === 'sunset-special' ? 'is-current' : ''}>SUNSET SPECIAL</b><b className={editionId !== 'night-02' && editionId !== 'sunset-special' ? 'is-current' : ''}>NIGHT 03 {editionId !== 'night-02' && editionId !== 'sunset-special' && <i>ACTIVA</i>}</b></div></div>
    <img className="noctra-edition-pass" src={assetUrl('experiences/noctra/passes/noctra-pass-nova-pass.svg')} alt="Pase coleccionable de la edición" />
  </NoctraSectionFrame>
}

export function NoctraExperienceInfo({ onBack, onExplore }: { onBack: () => void; onExplore: () => void }) {
  const steps = [
    { n: '01', title: 'DESCUBRÍ', body: 'Encontrá momentos repartidos durante la noche.', icon: Compass },
    { n: '02', title: 'DESBLOQUEÁ', body: 'Escaneá, explorá y encontrá señales ocultas.', icon: UnlockKeyhole },
    { n: '03', title: 'GUARDÁ', body: 'Tus fotos y recuerdos quedan asociados a tu noche.', icon: Ticket },
    { n: '04', title: 'COMPLETÁ', body: 'Desbloqueá recompensas y accesos especiales.', icon: Sparkles },
  ]
  return <NoctraSectionFrame section="LA EXPERIENCIA" onBack={onBack} className="noctra-experience-info">
    <PageHeading eyebrow="MÁS QUE UNA NOCHE" title="Tu noche deja huella." description="Una experiencia para descubrir, guardar y volver a mirar." />
    <div className="noctra-info-steps">{steps.map(({ n, title, body, icon: Icon }) => <article key={n}><span>{n}</span><Icon size={20} /><h2>{title}</h2><p>{body}</p></article>)}</div>
    <aside className="noctra-info-disclosure"><strong>DEMO CONCEPTUAL</strong><p>NOCTRA es una demo conceptual creada por Corsteno. NOVA, los artistas y los eventos son ficticios. La experiencia es configurable para cada marca o evento.</p></aside>
    <button type="button" className="noctra-editorial__primary" onClick={onExplore}>EMPEZAR A EXPLORAR <ArrowRight size={16} /></button>
  </NoctraSectionFrame>
}
