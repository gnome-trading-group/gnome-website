import { useEffect, useRef } from 'react'

const SIZE_W = 40
const SIZE_H = 52
const OUTLINE = '#050505'

type Spring = { bob: number; bobV: number; tilt: number; tiltV: number; stretch: number; stretchV: number }
type Face = { lookX: number; lookY: number; surprise: number; blink: number }

function drawHat(c: CanvasRenderingContext2D, bx: number, by: number, tilt: number, stretch: number) {
  const segments = 7
  const segLen = 9.5 * (1 + stretch)
  const pts: [number, number][] = [[bx, by]]
  let ang = -Math.PI / 2
  let x = bx
  let y = by
  for (let i = 1; i <= segments; i++) {
    ang += tilt * Math.pow(i / segments, 1.4) * 0.55
    x += Math.cos(ang) * segLen
    y += Math.sin(ang) * segLen
    pts.push([x, y])
  }
  const left: [number, number][] = []
  const right: [number, number][] = []
  pts.forEach(([px, py], i) => {
    const [nx, ny] = i < segments ? pts[i + 1] : [2 * px - pts[i - 1][0], 2 * py - pts[i - 1][1]]
    const a = Math.atan2(ny - py, nx - px)
    const w = 34 * (1 - i / segments)
    left.push([px + Math.cos(a - Math.PI / 2) * w, py + Math.sin(a - Math.PI / 2) * w])
    right.push([px + Math.cos(a + Math.PI / 2) * w, py + Math.sin(a + Math.PI / 2) * w])
  })
  c.beginPath()
  c.moveTo(...left[0])
  left.forEach((p) => c.lineTo(...p))
  for (let i = right.length - 1; i >= 0; i--) c.lineTo(...right[i])
  c.closePath()
  const g = c.createLinearGradient(0, by - 70, 0, by)
  g.addColorStop(0, '#8cc152')
  g.addColorStop(1, '#3c9a4a')
  c.fillStyle = g
  c.fill()
  c.lineWidth = 5
  c.strokeStyle = OUTLINE
  c.lineJoin = 'round'
  c.stroke()
  c.beginPath()
  c.moveTo(...left[2])
  c.lineTo(...right[2])
  c.stroke()
}

function drawGnome(c: CanvasRenderingContext2D, s: Spring, f: Face) {
  c.clearRect(0, 0, 100, 130)
  c.save()
  c.translate(0, s.bob)
  const cx = 50
  const fy = 92
  c.lineWidth = 5
  c.strokeStyle = OUTLINE
  c.fillStyle = '#d4d4d4'
  c.beginPath()
  c.moveTo(14, 96)
  c.quadraticCurveTo(50, 150, 86, 96)
  c.quadraticCurveTo(50, 112, 14, 96)
  c.fill()
  c.stroke()
  c.fillStyle = '#e2ad67'
  c.beginPath()
  c.ellipse(cx, fy, 32, 22, 0, Math.PI, 0)
  c.quadraticCurveTo(cx, fy + 18, cx - 32, fy)
  c.fill()
  c.stroke()
  const ex = f.lookX * 3
  const ey = f.lookY * 2
  c.lineCap = 'round'
  c.lineWidth = 4.5
  for (const sx of [-14, 14]) {
    c.beginPath()
    if (f.blink > 0) {
      c.moveTo(cx + sx - 5, fy - 3)
      c.lineTo(cx + sx + 5, fy - 3)
      c.stroke()
    } else if (f.surprise > 0.4) {
      c.fillStyle = OUTLINE
      c.arc(cx + sx + ex, fy - 3 + ey, 4, 0, Math.PI * 2)
      c.fill()
    } else {
      c.arc(cx + sx + ex * 0.5, fy - 1 + ey * 0.5, 5.5, Math.PI * 1.15, Math.PI * 1.85)
      c.stroke()
    }
  }
  c.lineWidth = 5
  c.fillStyle = '#f0916a'
  c.beginPath()
  c.arc(cx, fy + 8, 6.5, 0, Math.PI * 2)
  c.fill()
  c.stroke()
  drawHat(c, cx, fy - 14, s.tilt, s.stretch)
  c.restore()
}

export function Gnome({ onClick }: { onClick: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const btn = btnRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = SIZE_W * dpr
    canvas.height = SIZE_H * dpr
    ctx.setTransform((dpr * SIZE_W) / 100, 0, 0, (dpr * SIZE_W) / 100, 0, 0)
    const s: Spring = { bob: 0, bobV: 0, tilt: 0, tiltV: 0, stretch: 0, stretchV: 0 }
    const f: Face = { lookX: 0, lookY: 0, surprise: 0, blink: 0 }
    let lastY = scrollY
    let ptr: { x: number; y: number } | null = null
    let raf = 0
    const onPointer = (e: PointerEvent) => {
      ptr = { x: e.clientX, y: e.clientY }
    }

    const step = () => {
      const v = Math.max(-60, Math.min(60, scrollY - lastY))
      lastY = scrollY
      s.bobV += v * 0.05
      s.tiltV -= v * 0.004
      s.stretchV += Math.abs(v) * 0.0015
      let tx = 0
      let ty = 0
      if (ptr) {
        const r = btn.getBoundingClientRect()
        tx = Math.max(-1, Math.min(1, (ptr.x - (r.left + r.width / 2)) / 400))
        ty = Math.max(-1, Math.min(1, (ptr.y - (r.top + r.height / 2)) / 400))
      }
      if (Math.abs(v) > 2) ty = Math.sign(v)
      f.lookX += (tx - f.lookX) * 0.1
      f.lookY += (ty - f.lookY) * 0.1
      s.bobV = (s.bobV - s.bob * 0.12) * 0.82
      s.bob += s.bobV
      s.tiltV = (s.tiltV + (tx * 0.25 - s.tilt) * 0.06) * 0.9
      s.tilt += s.tiltV
      s.stretchV = (s.stretchV - s.stretch * 0.15) * 0.8
      s.stretch += s.stretchV
      f.surprise = Math.max(f.surprise * 0.96, Math.min(1, Math.abs(v) / 25))
      if (f.blink > 0) f.blink--
      else if (Math.random() < 0.004) f.blink = 8
      drawGnome(ctx, s, f)
      raf = requestAnimationFrame(step)
    }

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) drawGnome(ctx, s, f)
    else {
      addEventListener('pointermove', onPointer)
      raf = requestAnimationFrame(step)
    }
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('pointermove', onPointer)
    }
  }, [])

  return (
    <button ref={btnRef} type="button" className="gnome" onClick={onClick} aria-label="Open terminal">
      <canvas ref={canvasRef} />
    </button>
  )
}
