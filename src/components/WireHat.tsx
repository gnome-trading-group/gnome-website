import { useEffect, useRef } from 'react'

type Vec = [number, number, number]
type Shape = (line: number, k: number, t: number) => Vec

const LINES = 24
const POINTS = 32
const TAU = Math.PI * 2
const CURSOR_W = 0.16
const CURSOR_H = 0.28
const BOOK = 1
const CURSOR = 3

const LINE_RGB = '233,234,236'
const ACCENT_RGB = '86,178,99'

function rotY([x, y, z]: Vec, a: number): Vec {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c + z * s, y, -x * s + z * c]
}

function cone(i: number, k: number, cx: number, scale: number, yaw: number, rings: number): Vec {
  const r = scale
  const height = 2.6 * scale
  const base = -height / 2
  let p: Vec
  if (i < rings) {
    const h = 0.02 + (i / rings) * 0.92
    const a = (k / (POINTS - 1)) * TAU
    p = [Math.cos(a) * r * (1 - h), base + h * height, Math.sin(a) * r * (1 - h)]
  } else {
    const a = ((i - rings) / rings) * TAU + 0.2
    const h = k / (POINTS - 1)
    p = [Math.cos(a) * r * (1 - h), base + h * height, Math.sin(a) * r * (1 - h)]
  }
  const [x, y, z] = rotY(p, yaw)
  return [x + cx, y, z]
}

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
const rand = seeded(42)
const depth = Array.from({ length: LINES }, (_, i) => 0.25 + Math.abs(i - 11.5) * 0.09 + rand() * 0.35)

const shapes: Shape[] = [
  (i, k, t) => cone(i, k, 0, 1, t * 0.25, 12),
  (i, k) => {
    const y = (11.5 - i) * 0.1 + (i < 12 ? 0.06 : -0.06)
    return [-0.9 + (k / (POINTS - 1)) * depth[i] * 1.6, y, 0]
  },
  (i, k, t) => (i < 12 ? cone(i, k, -1.25, 0.5, t * 0.3, 6) : cone(i - 12, k, 1.25, 0.5, -t * 0.3, 6)),
  (i, k) => {
    const u = ((i + k / (POINTS - 1)) / LINES) * 2 * (CURSOR_W + CURSOR_H)
    let x: number
    let y: number
    if (u < CURSOR_W) [x, y] = [u, CURSOR_H]
    else if (u < CURSOR_W + CURSOR_H) [x, y] = [CURSOR_W, CURSOR_H - (u - CURSOR_W)]
    else if (u < 2 * CURSOR_W + CURSOR_H) [x, y] = [CURSOR_W - (u - CURSOR_W - CURSOR_H), 0]
    else [x, y] = [0, u - 2 * CURSOR_W - CURSOR_H]
    return [x - CURSOR_W / 2, y - CURSOR_H / 2, 0]
  },
]

function isAccent(stage: number, i: number): boolean {
  if (stage === 0) return i % 12 === 3
  if (stage === 2) return i % 12 === 3 || i % 12 === 2
  if (stage === BOOK) return i >= 12
  return false
}

const smooth = (x: number) => x * x * (3 - 2 * x)

type Props = { sections: { id: string; label: string }[]; onCursorClick: () => void }

export function WireHat({ sections, onCursorClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLButtonElement>(null)
  const dotsRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const cursor = cursorRef.current!
    const ctx = canvas.getContext('2d')!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const beats = sections.map((s) => document.getElementById(s.id)!)
    const dots = [...dotsRef.current!.querySelectorAll('a')]
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 }
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0

    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2)
      w = innerWidth
      h = innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
    }

    const stage = () => {
      const mid = scrollY + h / 2
      const centers = beats.map((b) => b.offsetTop + b.offsetHeight / 2)
      if (mid <= centers[0]) return 0
      for (let i = 0; i < centers.length - 1; i++) {
        if (mid < centers[i + 1]) return i + (mid - centers[i]) / (centers[i + 1] - centers[i])
      }
      return centers.length - 1
    }

    const frame = (now: number) => {
      const t = reduce ? 0 : now / 1000
      ptr.x += (ptr.tx - ptr.x) * 0.05
      ptr.y += (ptr.ty - ptr.y) * 0.05
      const f = stage()
      const a = Math.min(CURSOR, Math.floor(f))
      const b = Math.min(CURSOR, a + 1)
      const m = smooth(f - a)
      dots.forEach((d, i) => d.classList.toggle('on', i === Math.round(f)))

      const narrow = w < 860
      const anchors = narrow
        ? [[0.5, 0.3], [0.5, 0.3], [0.5, 0.26], [0.5, 0.3]]
        : [[0.7, 0.5], [0.72, 0.5], [0.5, 0.3], [0.72, 0.5]]
      const cx = w * (anchors[a][0] + (anchors[b][0] - anchors[a][0]) * m)
      const cy = h * (anchors[a][1] + (anchors[b][1] - anchors[a][1]) * m)
      const scale = Math.min(w, h) * (narrow ? 0.22 : 0.26)

      const solid = (s: number) => (s === BOOK || s === CURSOR ? 0 : 1)
      const depthAmt = solid(a) * (1 - m) + solid(b) * m
      const pitch = 0.28 + ptr.y * 0.4
      const cp = Math.cos(pitch)
      const sp = Math.sin(pitch)
      const twinAmt = (a === 2 ? 1 - m : 0) + (b === 2 ? m : 0)
      const alpha = (narrow ? 0.45 : 0.75) * (1 - 0.55 * twinAmt)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.lineWidth = 1
      ctx.lineJoin = 'round'
      for (let i = 0; i < LINES; i++) {
        ctx.beginPath()
        for (let k = 0; k < POINTS; k++) {
          const p = shapes[a](i, k, t)
          const q = shapes[b](i, k, t)
          const lerp: Vec = [p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m, p[2] + (q[2] - p[2]) * m]
          const [x, y, z] = rotY(lerp, ptr.x * 0.6 * depthAmt)
          const y2 = y * (1 - depthAmt + depthAmt * cp) - z * sp * depthAmt
          const z2 = y * sp * depthAmt + z * (1 - depthAmt + depthAmt * cp)
          const persp = 5 / (5 + z2)
          const px = cx + x * scale * persp
          const py = cy - y2 * scale * persp
          if (k) ctx.lineTo(px, py)
          else ctx.moveTo(px, py)
        }
        const accent = (isAccent(a, i) ? 1 - m : 0) + (isAccent(b, i) ? m : 0)
        ctx.strokeStyle = accent > 0.5 ? `rgba(${ACCENT_RGB},${alpha})` : `rgba(${LINE_RGB},${alpha * 0.7})`
        ctx.stroke()
      }

      const showCursor = f > 2.6
      cursor.hidden = !showCursor
      if (showCursor) {
        const cw = CURSOR_W * scale
        const ch = CURSOR_H * scale
        Object.assign(cursor.style, { left: `${cx - cw}px`, top: `${cy - ch}px`, width: `${cw * 2}px`, height: `${ch * 2}px` })
        if (f > 2.9 && Math.floor(t * 1.6) % 2 === 0) {
          ctx.fillStyle = `rgba(${ACCENT_RGB},.85)`
          ctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch)
        }
      }
      if (!reduce) raf = requestAnimationFrame(frame)
    }

    const onPointer = (e: PointerEvent) => {
      ptr.tx = e.clientX / w - 0.5
      ptr.ty = e.clientY / h - 0.5
    }
    const onScrollStatic = () => frame(0)
    const onResize = () => {
      size()
      if (reduce) frame(0)
    }

    size()
    addEventListener('resize', onResize)
    addEventListener('pointermove', onPointer)
    if (reduce) {
      addEventListener('scroll', onScrollStatic, { passive: true })
      frame(0)
    } else raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onPointer)
      removeEventListener('scroll', onScrollStatic)
    }
  }, [sections])

  return (
    <>
      <canvas ref={canvasRef} className="wire" aria-hidden="true" />
      <button ref={cursorRef} type="button" className="wire-cursor" hidden aria-label="Open terminal" onClick={onCursorClick} />
      <nav ref={dotsRef} className="dots" aria-label="Sections">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} aria-label={s.label} />
        ))}
      </nav>
    </>
  )
}
