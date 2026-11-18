import { useEffect, useRef } from 'react'

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

function utcStamp(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)} UTC`
}

export function Tape({ items }: { items: string[] }) {
  const clockRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (clockRef.current) clockRef.current.textContent = utcStamp(new Date())
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="tape">
      <i className="live-dot" aria-hidden="true" />
      <span className="utc" ref={clockRef} />
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  )
}
