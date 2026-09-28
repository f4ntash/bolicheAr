// QR payload formats:
// tusestaciones://station/<station-id>
// noctra://station/<station-id>
export function parseStationQr(value: string, validStationIds: ReadonlySet<string>): string | null {
  const match = /^(?:tusestaciones|noctra):\/\/station\/([^/?#]+)$/i.exec(value.trim())
  const stationId = match?.[1]?.toLowerCase()

  return stationId && validStationIds.has(stationId) ? stationId : null
}
