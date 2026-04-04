import './App.css'
import logo from './assets/logo.svg'
import { useEffect, useRef, useCallback, useState } from 'react'

const GNOME_COUNT = 60

function useScrollReveal() {
  const ref = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(node)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

function App() {
  const [isScrolled, setIsScrolled] = useState(false)
  const services = useScrollReveal()
  const about = useScrollReveal()
  const contact = useScrollReveal()

  const heroRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const pointerRef = useRef({ x: -9999, y: -9999 })
  const animationActiveRef = useRef(true)
  const gnomeImageRef = useRef<HTMLImageElement | null>(null)
  const gnomesRef = useRef<Array<{
    x: number
    y: number
    vx: number
    vy: number
    size: number
    rotation: number
    rotationSpeed: number
  }>>([])

  const loadGnomeImage = useCallback(() => {
    if (gnomeImageRef.current) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => { gnomeImageRef.current = img; resolve() }
      img.src = logo
    })
  }, [])

  const initGnomes = useCallback(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    gnomesRef.current = Array.from({ length: GNOME_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: -50 - Math.random() * 400,
      vx: (Math.random() - 0.5) * 0.4,
      vy: Math.random() * 1.5 + 1.2,
      size: Math.random() * 10 + 14,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.04,
    }))
  }, [])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!animationActiveRef.current) {
      animationRef.current = null
      return
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const pointer = pointerRef.current
    const img = gnomeImageRef.current

    for (const g of gnomesRef.current) {
      // Pointer repulsion
      const dx = g.x - pointer.x
      const dy = g.y - pointer.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 130) {
        const force = (130 - dist) / 130
        const angle = Math.atan2(dy, dx)
        g.vx += Math.cos(angle) * force * 0.18
        g.vy += Math.sin(angle) * force * 0.18
      }

      // Friction on horizontal, maintain fall
      g.vx *= 0.96
      if (g.vy < 1.2) g.vy = Math.random() * 1.5 + 1.2

      g.x += g.vx
      g.y += g.vy
      g.rotation += g.rotationSpeed

      // Wrap horizontally
      if (g.x < -60) g.x = canvas.width + 60
      if (g.x > canvas.width + 60) g.x = -60

      // Reset when fallen off bottom
      if (g.y > canvas.height + 60) {
        g.y = -60 - Math.random() * 200
        g.x = Math.random() * canvas.width
        g.vx = (Math.random() - 0.5) * 0.4
        g.vy = Math.random() * 1.5 + 1.2
      }

      ctx.save()
      ctx.translate(g.x, g.y)
      ctx.rotate(g.rotation)
      ctx.globalAlpha = 0.55 + Math.random() * 0.2

      if (img) {
        ctx.shadowBlur = 12
        ctx.shadowColor = 'rgba(61, 139, 79, 0.6)'
        ctx.drawImage(img, -g.size / 2, -g.size / 2, g.size, g.size)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, g.size / 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(61, 139, 79, 0.6)'
        ctx.fill()
      }

      ctx.globalAlpha = 1
      ctx.restore()
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [])

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current
    const hero = heroRef.current
    if (!canvas || !hero) return

    const setSize = () => {
      const rect = hero.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      initGnomes()
    }
    setSize()

    loadGnomeImage().then(() => {
      animationActiveRef.current = true
      animate()
    })

    const onPointerMove = (e: PointerEvent) => {
      const rect = hero.getBoundingClientRect()
      pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onPointerLeave = () => { pointerRef.current = { x: -9999, y: -9999 } }

    hero.addEventListener('pointermove', onPointerMove)
    hero.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('resize', setSize)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      hero.removeEventListener('pointermove', onPointerMove)
      hero.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', setSize)
    }
  }, [initGnomes, animate, loadGnomeImage])

  // Scroll: nav + pause canvas when scrolled past hero
  useEffect(() => {
    let timeout: number | null = null

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)

      const hero = heroRef.current
      const heroHeight = hero ? hero.getBoundingClientRect().height : 0
      const beyondHero = window.scrollY > heroHeight * 0.6

      if (beyondHero) {
        animationActiveRef.current = false
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
      }

      if (timeout) window.clearTimeout(timeout)
      timeout = window.setTimeout(() => {
        const hero = heroRef.current
        const heroHeight = hero ? hero.getBoundingClientRect().height : 0
        const withinHero = window.scrollY <= heroHeight * 0.6
        if (withinHero && !animationRef.current) {
          animationActiveRef.current = true
          animationRef.current = requestAnimationFrame(animate)
        }
      }, 150)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [animate])

  return (
    <div className="app">
      <nav className={`nav ${isScrolled ? 'nav-scrolled' : ''}`}>
        <div className="nav-container">
          <img src={logo} className="nav-logo" alt="Gnome Trading Group" />
          <div className="nav-title">Gnome Trading Group</div>
        </div>
      </nav>

      <section className="hero" ref={heroRef}>
        <div className="hero-content">
          <div className="hero-logo-container">
            <img src={logo} className="hero-logo" alt="" />
          </div>
          <h1 className="hero-title">Gnome Trading Group</h1>
          <p className="hero-subtitle">
            Leveraging cutting-edge technology and quantitative research
            to provide superior market-making and liquidity services
            across global financial markets.
          </p>
          <a href="mailto:contact@gnometrading.group" className="cta-button">
            Get in Touch
          </a>
        </div>
        <canvas ref={canvasRef} className="gnome-canvas" />
      </section>

      <section className="services" ref={services.ref}>
        <div className={`container reveal ${services.isVisible ? 'revealed' : ''}`}>
          <h2 className="section-title">Our Expertise</h2>
          <div className="services-grid">
            <div className="service-card">
              <span className="service-card-icon">📈</span>
              <h3>Market Making</h3>
              <p>
                Advanced algorithmic strategies providing continuous liquidity
                and tight spreads across major global exchanges.
              </p>
            </div>
            <div className="service-card">
              <span className="service-card-icon">⚡</span>
              <h3>Liquidity Taking</h3>
              <p>
                Sophisticated execution algorithms designed to minimize market
                impact while maximizing trading efficiency.
              </p>
            </div>
            <div className="service-card">
              <span className="service-card-icon">🔬</span>
              <h3>Research & Technology</h3>
              <p>
                Proprietary research and cutting-edge technology stack
                powering our trading infrastructure and strategies.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="about" ref={about.ref}>
        <div className={`container reveal ${about.isVisible ? 'revealed' : ''}`}>
          <div className="about-content">
            <div className="about-text">
              <h2>Technology-Driven Trading</h2>
              <p>
                At Gnome Trading Group, we combine deep market expertise with
                advanced technological infrastructure to deliver exceptional
                trading performance. Our team of quantitative researchers,
                engineers, and traders work together to develop innovative
                solutions that adapt to dynamic global markets.
              </p>
              <p>
                We focus on building robust, scalable systems that can handle
                the complexities of modern financial markets while maintaining
                the highest standards of risk management and operational excellence.
              </p>
            </div>
            <div className="about-stats">
              <div className="stat">
                <div className="stat-number">24/7</div>
                <div className="stat-label">Market Coverage</div>
              </div>
              <div className="stat">
                <div className="stat-number">99.9%</div>
                <div className="stat-label">Uptime</div>
              </div>
              <div className="stat">
                <div className="stat-number">ns</div>
                <div className="stat-label">Latency</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contact" ref={contact.ref}>
        <div className={`container reveal ${contact.isVisible ? 'revealed' : ''}`}>
          <h2 className="section-title">Ready to Partner?</h2>
          <p className="contact-description">
            Let's discuss how our advanced trading solutions can support
            your trading operations.
          </p>
          <a href="mailto:contact@gnometrading.group" className="cta-button">
            Get in Touch
          </a>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <img src={logo} className="footer-logo-img" alt="Gnome Trading Group" />
              <span>Gnome Trading Group</span>
            </div>
            <div className="footer-text">
              &copy; {new Date().getFullYear()} Gnome Trading Group
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
