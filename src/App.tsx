import './App.css'
import logo from './assets/logo.svg'
import { useEffect, useRef, useCallback, useState } from 'react'

function App() {
  const heroRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const particlesRef = useRef<Array<{
    x: number
    y: number
    vx: number
    vy: number
    size: number
    originalX: number
    originalY: number
    targetX: number
    targetY: number
    type: 'particle' | 'gnome'
    rotation: number
    rotationSpeed: number
  }>>([])
  const [isScrolled, setIsScrolled] = useState(false)
  const interactionEnabledRef = useRef(true)
  const gnomeImageRef = useRef<HTMLImageElement | null>(null)
  const animationActiveRef = useRef(true)
  const [isPaused, setIsPaused] = useState(false)

  // Load gnome logo image
  const loadGnomeImage = useCallback(() => {
    if (gnomeImageRef.current) return Promise.resolve()
    
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        gnomeImageRef.current = img
        resolve()
      }
      img.src = logo
    })
  }, [])

  // Initialize particles
  const initParticles = useCallback(() => {
    if (!canvasRef.current || !heroRef.current) return
    
    const canvas = canvasRef.current
    const particles: typeof particlesRef.current = []
    
    // Create 1000+ particles and 50 gnome logos
    for (let i = 0; i < 1200; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        originalX: 0,
        originalY: 0,
        targetX: 0,
        targetY: 0,
        type: 'particle',
        rotation: 0,
        rotationSpeed: 0
      })
    }
    
    // Add falling gnome logos
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -50 - Math.random() * 200, // Start above the canvas
        vx: (Math.random() - 0.5) * 0.2,
        vy: Math.random() * 0.5 + 0.3, // Falling speed
        size: Math.random() * 8 + 12, // Larger gnome logos
        originalX: 0,
        originalY: 0,
        targetX: 0,
        targetY: 0,
        type: 'gnome',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05
      })
    }
    
    particlesRef.current = particles
  }, [])

  // Animation loop
  const animate = useCallback(() => {
    if (!canvasRef.current || !heroRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    if (!animationActiveRef.current) {
      // Do not clear; keep current frame visible when paused
      animationRef.current = null
      return
    }
    
    const mouse = mouseRef.current
    const interactionEnabled = interactionEnabledRef.current
    const particles = particlesRef.current
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Update and draw particles
    particles.forEach(particle => {
      if (particle.type === 'particle') {
        // Calculate distance from mouse
        const dx = particle.x - mouse.x
        const dy = particle.y - mouse.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        // Mouse interaction
        if (interactionEnabled && distance < 100) {
          const force = (100 - distance) / 100
          const angle = Math.atan2(dy, dx)
          particle.vx += Math.cos(angle) * force * 0.1
          particle.vy += Math.sin(angle) * force * 0.1
        }
        
        // Apply friction and return to original position
        particle.vx *= 0.98
        particle.vy *= 0.98
        
        // Update position
        particle.x += particle.vx
        particle.y += particle.vy
        
        // Keep particles in bounds
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -0.5
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -0.5
        particle.x = Math.max(0, Math.min(canvas.width, particle.x))
        particle.y = Math.max(0, Math.min(canvas.height, particle.y))
        
        // Draw particle
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(74, 154, 90, ${0.6 + Math.random() * 0.4})`
        ctx.shadowBlur = 10
        ctx.shadowColor = '#4a9a5a'
        ctx.fill()
      } else if (particle.type === 'gnome') {
        // Calculate distance from mouse for gnome interaction
        const dx = particle.x - mouse.x
        const dy = particle.y - mouse.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        // Mouse interaction for gnomes (stronger effect than particles)
        if (interactionEnabled && distance < 120) {
          const force = (120 - distance) / 120
          const angle = Math.atan2(dy, dx)
          particle.vx += Math.cos(angle) * force * 0.15 // Stronger force than particles
          particle.vy += Math.sin(angle) * force * 0.15
        }
        
        // Apply friction to horizontal movement, but maintain falling motion
        particle.vx *= 0.97 // Friction for horizontal movement
        // Don't apply friction to vertical velocity to maintain falling
        if (particle.vy < 0.3) {
          particle.vy = Math.random() * 0.5 + 0.3 // Ensure minimum falling speed
        }
        
        // Update gnome logo position and rotation
        particle.x += particle.vx
        particle.y += particle.vy
        particle.rotation += particle.rotationSpeed
        
        // Reset gnome when it falls off screen
        if (particle.y > canvas.height + 50) {
          particle.y = -50 - Math.random() * 200
          particle.x = Math.random() * canvas.width
          // Reset velocity to normal falling speed
          particle.vx = (Math.random() - 0.5) * 0.2
          particle.vy = Math.random() * 0.5 + 0.3
        }
        
        // Keep gnomes in horizontal bounds
        if (particle.x < -50) particle.x = canvas.width + 50
        if (particle.x > canvas.width + 50) particle.x = -50
        
        // Draw gnome logo
        ctx.save()
        ctx.translate(particle.x, particle.y)
        ctx.rotate(particle.rotation)
        
        if (gnomeImageRef.current) {
          // Draw the actual gnome logo
          const logoSize = particle.size
          ctx.shadowBlur = 15
          ctx.shadowColor = '#4a9a5a'
          ctx.globalAlpha = 0.8 + Math.random() * 0.2
          ctx.drawImage(
            gnomeImageRef.current,
            -logoSize / 2,
            -logoSize / 2,
            logoSize,
            logoSize
          )
          ctx.globalAlpha = 1
        } else {
          // Fallback: draw a simple circle if image isn't loaded yet
          ctx.beginPath()
          ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(74, 154, 90, ${0.7 + Math.random() * 0.3})`
          ctx.shadowBlur = 15
          ctx.shadowColor = '#4a9a5a'
          ctx.fill()
        }
        
        ctx.restore()
      }
    })
    
    animationRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !heroRef.current) return
    
    const canvas = canvasRef.current
    const rect = heroRef.current.getBoundingClientRect()
    
    // Set canvas size
    canvas.width = rect.width
    canvas.height = rect.height
    
    // Load gnome image and initialize particles
    loadGnomeImage().then(() => {
      initParticles()
      animate()
    })
    
    // Handle mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return
      
      const rect = heroRef.current.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
    
    const handleResize = () => {
      if (!canvasRef.current || !heroRef.current) return
      
      const rect = heroRef.current.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      initParticles()
    }
    
    heroRef.current.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', handleResize)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (heroRef.current) {
        heroRef.current.removeEventListener('mousemove', handleMouseMove)
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [initParticles, animate, loadGnomeImage])

  // Handle scroll for navbar
  useEffect(() => {
    let scrollTimeout: number | null = null

    const handleScroll = () => {
      const hero = heroRef.current
      const heroHeight = hero ? hero.getBoundingClientRect().height : 0
      const threshold = Math.max(50, heroHeight * 0.5) // halfway down hero
      const scrolled = window.scrollY > 50
      const beyondThreshold = window.scrollY > threshold
      setIsScrolled(scrolled)

      // Disable interaction and animation when beyond threshold
      interactionEnabledRef.current = !beyondThreshold
      setIsPaused(beyondThreshold)
      if (beyondThreshold) {
        animationActiveRef.current = false
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
      }

      // Debounce: re-enable after scrolling stops and only near top
      if (scrollTimeout) {
        window.clearTimeout(scrollTimeout)
      }
      scrollTimeout = window.setTimeout(() => {
        const hero = heroRef.current
        const heroHeight = hero ? hero.getBoundingClientRect().height : 0
        const threshold = Math.max(50, heroHeight * 0.5)
        const withinInteractive = window.scrollY <= threshold
        interactionEnabledRef.current = withinInteractive
        setIsPaused(!withinInteractive)
        animationActiveRef.current = withinInteractive
        if (withinInteractive && !animationRef.current) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }, 150)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll as EventListener)
  }, [])

  return (
    <div className={`app ${isPaused ? 'paused' : ''}`}>
      {/* Navigation */}
      <nav className={`nav ${isScrolled ? 'nav-scrolled' : ''}`}>
        <div className="nav-container">
          <img src={logo} className="nav-logo" alt="Gnome Trading Group" />
          <div className="nav-title">Gnome Trading Group</div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero" ref={heroRef}>
        <div className="hero-content">
          <div className="hero-logo-container">
            <img src={logo} className="hero-logo" alt="Gnome Trading Group" />
          </div>
          <h1 className="hero-title">
            <span className="title-word">GTG</span>
          </h1>
          <p className="hero-subtitle">
            Leveraging cutting-edge technology and state-of-the-art research 
            to provide superior market-making and liquidity services across 
            global financial markets.
          </p>
          <div className="hero-cta">
            <a href="mailto:contact@gnometrading.group" className="cta-button">
              Contact
        </a>
      </div>
        </div>
        <div className="hero-background">
          <canvas 
            ref={canvasRef}
            className="particle-canvas"
          />
        </div>
      </section>

      {/* Services Section */}
      <section className="services">
        <div className="container">
          <h2 className="section-title">Our Expertise</h2>
          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon market-making-icon"></div>
              <h3>Market Making</h3>
              <p>
                Advanced algorithmic strategies providing continuous liquidity 
                and tight spreads across major global exchanges.
              </p>
            </div>
            <div className="service-card">
              <div className="service-icon liquidity-icon"></div>
              <h3>Liquidity Taking</h3>
              <p>
                Sophisticated execution algorithms designed to minimize market 
                impact while maximizing trading efficiency.
              </p>
            </div>
            <div className="service-card">
              <div className="service-icon research-icon"></div>
              <h3>Research & Technology</h3>
              <p>
                Proprietary research and cutting-edge technology stack 
                powering our trading infrastructure and strategies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about">
        <div className="container">
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
                the complexities of modern financial markets while 
                maintaining the highest standards of risk management and 
                operational excellence.
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

      {/* Contact Section */}
      <section className="contact">
        <div className="container">
          <h2 className="section-title">Ready to Partner?</h2>
          <p className="contact-description">
            Let's discuss how our advanced trading solutions can support 
            your trading operations.
          </p>
          <div className="contact-info">
            <a href="mailto:contact@gnometrading.group" className="contact-email">
              Contact
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <img src={logo} className="footer-logo-img" alt="Gnome Trading Group" />
              <span>Gnome Trading Group</span>
            </div>
            <div className="footer-text">
              Advanced trading solutions powered by technology and research.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
