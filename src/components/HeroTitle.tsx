import { useEffect, useRef } from 'react'

const WORDS = ['Gnome', 'Trading', 'Group']
const COLLAPSE_SCREENS = 0.45

export function HeroTitle() {
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const title = titleRef.current!
    const rests = [...title.querySelectorAll<HTMLElement>('.rest')]
    let widths: number[] = []

    const apply = () => {
      const p = Math.min(1, Math.max(0, scrollY / (innerHeight * COLLAPSE_SCREENS)))
      const e = p * p * (3 - 2 * p)
      rests.forEach((el, i) => {
        el.style.maxWidth = `${(widths[i] ?? 0) * (1 - e)}px`
        el.style.opacity = String(Math.max(0, 1 - e * 1.6))
      })
      title.style.setProperty('--word-gap', `${0.26 * (1 - e) + 0.04 * e}em`)
      title.classList.toggle('collapsed', e > 0.98)
    }
    const measure = () => {
      widths = rests.map((el) => {
        el.style.maxWidth = 'none'
        return el.scrollWidth
      })
      apply()
    }

    measure()
    void document.fonts?.ready.then(measure)
    addEventListener('scroll', apply, { passive: true })
    addEventListener('resize', measure)
    return () => {
      removeEventListener('scroll', apply)
      removeEventListener('resize', measure)
    }
  }, [])

  return (
    <h1 className="hero-title" ref={titleRef} aria-label={WORDS.join(' ')}>
      {WORDS.map((w) => (
        <span key={w} className="word" aria-hidden="true">
          <span className="initial">{w[0]}</span>
          <span className="rest">{w.slice(1)}</span>
        </span>
      ))}
    </h1>
  )
}
