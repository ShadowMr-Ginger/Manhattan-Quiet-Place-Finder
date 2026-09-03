import { useEffect, useMemo, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { buildBusynessHeatPoints } from '../../utils/busynessHeatmap'

/**
 * Canvas heatmap overlay (works with mapId / AdvancedMarker vector maps).
 * Intensity comes from list `crowdedness`, which is derived from current-hour busyness.
 * Colors use the same CROWDEDNESS palette as list badges (green / amber / red).
 */
export function BusynessHeatmapLayer({ places, visible }) {
  const map = useMap()
  const overlayRef = useRef(null)
  const pointsRef = useRef([])

  const points = useMemo(() => buildBusynessHeatPoints(places), [places])
  pointsRef.current = points

  useEffect(() => {
    if (!map || !window.google?.maps?.OverlayView) return undefined

    class BusynessHeatOverlay extends google.maps.OverlayView {
      constructor() {
        super()
        this.canvas = null
        this.listenerZooms = []
      }

      onAdd() {
        this.canvas = document.createElement('canvas')
        this.canvas.className = 'busyness-heat-canvas'
        this.canvas.style.position = 'absolute'
        this.canvas.style.top = '0'
        this.canvas.style.left = '0'
        this.canvas.style.pointerEvents = 'none'
        this.getPanes()?.overlayLayer?.appendChild(this.canvas)

        const redraw = () => this.draw()
        this.listenerZooms = [
          map.addListener('bounds_changed', redraw),
          map.addListener('zoom_changed', redraw),
          map.addListener('center_changed', redraw),
        ]
      }

      draw() {
        const projection = this.getProjection()
        const canvas = this.canvas
        if (!projection || !canvas) return

        const bounds = map.getBounds()
        if (!bounds) return

        const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest())
        const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast())
        if (!sw || !ne) return

        const width = Math.max(1, Math.abs(ne.x - sw.x))
        const height = Math.max(1, Math.abs(sw.y - ne.y))
        const dpr = Math.min(window.devicePixelRatio || 1, 2)

        canvas.style.left = `${Math.min(sw.x, ne.x)}px`
        canvas.style.top = `${Math.min(sw.y, ne.y)}px`
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)

        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, width, height)

        const zoom = map.getZoom() ?? 13
        // Zoomed in, venues sit far apart in screen space, so blobs stop
        // overlapping and quiet areas read as scattered dots rather than a
        // field. Grow the radius past the wide-view cap to keep coverage.
        const zoomBoost = zoom >= 15 ? 1.45 : 1
        const baseRadius =
          Math.max(22, Math.min(72, 12 + zoom * 2.6)) * zoomBoost
        const originX = Math.min(sw.x, ne.x)
        const originY = Math.min(sw.y, ne.y)

        for (const point of pointsRef.current) {
          const pixel = projection.fromLatLngToDivPixel(
            new google.maps.LatLng(point.lat, point.lng),
          )
          if (!pixel) continue

          const x = pixel.x - originX
          const y = pixel.y - originY
          const isHigh = point.level === 'high'
          // Green/amber were far weaker than red: at weight 0.18 the old core
          // alpha worked out to 0.20 against red's 0.92, so quiet areas barely
          // registered. Raised floors and a smaller radius penalty bring them
          // up to legible without letting them compete with the red hotspots.
          const radius = baseRadius * (isHigh ? 1.35 : 0.85 + point.weight * 0.35)
          const coreAlpha = isHigh ? 0.92 : 0.34 + 0.38 * point.weight
          const midAlpha = isHigh ? 0.55 : 0.14 + 0.28 * point.weight

          const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
          glow.addColorStop(0, hexToRgba(point.color, coreAlpha))
          glow.addColorStop(0.35, hexToRgba(point.color, midAlpha))
          glow.addColorStop(1, hexToRgba(point.color, 0))

          ctx.beginPath()
          ctx.fillStyle = glow
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fill()

          // Extra hot core so crowded spots read clearly as red.
          if (isHigh) {
            const core = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.38)
            core.addColorStop(0, 'rgba(255, 70, 70, 0.95)')
            core.addColorStop(0.55, hexToRgba(point.color, 0.7))
            core.addColorStop(1, hexToRgba(point.color, 0))
            ctx.beginPath()
            ctx.fillStyle = core
            ctx.arc(x, y, radius * 0.38, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      onRemove() {
        this.listenerZooms.forEach((listener) => {
          google.maps.event.removeListener(listener)
        })
        this.listenerZooms = []
        this.canvas?.remove()
        this.canvas = null
      }
    }

    const overlay = new BusynessHeatOverlay()
    overlayRef.current = overlay

    if (visible && points.length) {
      overlay.setMap(map)
    }

    return () => {
      overlay.setMap(null)
      overlayRef.current = null
    }
  }, [map])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    if (visible && points.length) {
      overlay.setMap(map)
      overlay.draw?.()
    } else {
      overlay.setMap(null)
    }
  }, [map, visible, points])

  return null
}

function hexToRgba(hex, alpha) {
  const raw = String(hex || '#f59e0b').replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const value = Number.parseInt(full, 16)
  if (Number.isNaN(value)) return `rgba(245, 158, 11, ${alpha})`
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
