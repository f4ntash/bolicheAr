import { createContext, useContext, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Check, Gift, LockKeyhole } from 'lucide-react'
import type { EngagementMicroReward, EngagementProgress, ExperienceRuntime } from '../types'
import type { FinalRewardState } from '../utils/engagement'
import './engagement.css'

export type EngagementUnlockFeedbackState = {
  key: number
  stationName: string
  progress: number
  required: number
  rewards: EngagementMicroReward[]
}

export type EngagementViewModel = {
  experience: ExperienceRuntime
  progress: EngagementProgress
  progressCount: number
  progressMessage: string
  rewardState: FinalRewardState
  unlockedMicroRewards: EngagementMicroReward[]
  feedback: EngagementUnlockFeedbackState | null
  onOpenReward: () => void
  onClaimReward: () => void
  onDismissFeedback: () => void
}

export const EngagementContext = createContext<EngagementViewModel | null>(null)

export function useEngagementView() {
  return useContext(EngagementContext)
}

export function EngagementCard({ variant = 'home' }: { variant?: 'home' | 'passport' | 'stations' }) {
  const engagement = useEngagementView()
  const definition = engagement?.experience.config.engagement
  if (!engagement || !definition?.enabled) return null

  const { finalReward, goal } = definition
  const percent = Math.min(100, Math.round(engagement.progressCount / goal.requiredUnlocks * 100))
  const statusLabel = engagement.rewardState === 'unlocked'
    ? finalReward.unlockedLabel
    : engagement.rewardState === 'ready'
      ? finalReward.readyLabel
      : finalReward.lockedLabel
  const description = variant === 'home' && engagement.progressCount === 0 && engagement.rewardState === 'locked'
    ? goal.description
    : engagement.progressMessage

  return <section className={`engagement-card engagement-card--${variant}`} aria-label={goal.title}>
    <div className="engagement-card__heading"><span>{variant === 'home' ? 'OBJETIVO DE LA NOCHE' : 'PRÓXIMO OBJETIVO'}</span><span>{engagement.progressCount} / {goal.requiredUnlocks}</span></div>
    <div className="engagement-card__reward"><strong>{finalReward.title}</strong><small>{statusLabel}</small></div>
    <div className="engagement-card__bar" role="progressbar" aria-label={goal.title} aria-valuemin={0} aria-valuemax={goal.requiredUnlocks} aria-valuenow={engagement.progressCount}>
      <span style={{ width: `${percent}%` }} />
    </div>
    <p>{description}</p>
    {variant === 'passport' && engagement.unlockedMicroRewards.length > 0 && <div className="engagement-card__micro-rewards">
      <span>DESBLOQUEASTE</span>
      <ul>{engagement.unlockedMicroRewards.map((reward) => <li key={reward.id}><Check size={12} />{reward.title}</li>)}</ul>
    </div>}
    <button type="button" className="engagement-card__action" onClick={engagement.onOpenReward}>
      {engagement.rewardState === 'locked' ? 'Ver recompensa' : 'Abrir recompensa'} <ArrowRight size={15} />
    </button>
  </section>
}

export function EngagementUnlockFeedback() {
  const engagement = useEngagementView()
  const feedback = engagement?.feedback
  const definition = engagement?.experience.config.engagement
  const dismissFeedback = engagement?.onDismissFeedback

  useEffect(() => {
    if (!feedback || !dismissFeedback) return
    const timer = window.setTimeout(dismissFeedback, 9000)
    return () => window.clearTimeout(timer)
  }, [feedback?.key, dismissFeedback])

  if (!engagement || !feedback || !definition?.enabled) return null

  return <div className="engagement-feedback-anchor" aria-live="polite">
    <aside className="engagement-feedback" role="status">
      <div className="engagement-feedback__top"><span>{definition.feedback.title}</span><span>{feedback.progress} / {feedback.required}</span></div>
      <strong>{feedback.stationName}</strong>
      <p>{feedback.rewards.length ? feedback.rewards.map((reward) => reward.message).join(' · ') : engagement.progressMessage}</p>
      <button type="button" onClick={engagement.onDismissFeedback}>{definition.feedback.continueLabel} <ArrowRight size={14} /></button>
    </aside>
  </div>
}

export function FinalRewardScreen({
  experience,
  progressCount,
  state,
  onBack,
  onClaim,
  onPhoto,
}: {
  experience: ExperienceRuntime
  progressCount: number
  state: FinalRewardState
  onBack: () => void
  onClaim: () => void
  onPhoto?: () => void
}) {
  const definition = experience.config.engagement
  if (!definition?.enabled) return null
  const reward = definition.finalReward
  const locked = state === 'locked'
  const ready = state === 'ready'
  const statusLabel = locked ? reward.lockedLabel : ready ? reward.readyLabel : reward.unlockedLabel
  const description = locked ? reward.description : ready ? reward.readyDescription : reward.unlockedDescription

  return <section className={`phone-screen engagement-reward-screen is-${state}`}>
    <div className="engagement-reward-screen__art" style={{ backgroundImage: `url(${reward.image})` }} aria-hidden="true" />
    <div className="engagement-reward-screen__shade" aria-hidden="true" />
    <header className="engagement-reward-screen__header">
      <button type="button" className="icon-button" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} /></button>
      <span>{experience.config.name}</span>
      <span>RECOMPENSA FINAL</span>
    </header>
    <div className="engagement-reward-screen__content">
      <p className="engagement-reward-screen__eyebrow">{statusLabel}</p>
      <div className="engagement-reward-screen__badge" aria-hidden="true"><Gift size={30} /><span>{locked ? <LockKeyhole size={14} /> : <Check size={14} />}</span></div>
      <h1>{reward.title}</h1>
      <p className="engagement-reward-screen__description">{description}</p>
      <div className="engagement-reward-screen__pass">
        <div><span>{experience.config.name} · {experience.config.location}</span><span>{locked ? `${progressCount} / ${definition.goal.requiredUnlocks}` : state === 'ready' ? reward.readyLabel : 'ACCESO DIGITAL'}</span></div>
        <strong>{reward.title}</strong>
        <span>{definition.goal.description}</span>
        <i aria-hidden="true" />
      </div>
      {locked ? <button type="button" className="engagement-reward-screen__secondary" onClick={onBack}><ArrowLeft size={15} /> Volver al recorrido</button>
        : ready ? <button type="button" className="engagement-reward-screen__primary" onClick={onClaim}>{reward.claimLabel} <ArrowRight size={15} /></button>
          : <button type="button" className="engagement-reward-screen__primary" onClick={onPhoto ?? onBack}>{onPhoto ? reward.photoActionLabel || 'Crear una foto' : 'Volver al recorrido'} <ArrowRight size={15} /></button>}
      <small className="engagement-reward-screen__disclaimer">{reward.disclaimer}</small>
    </div>
  </section>
}
