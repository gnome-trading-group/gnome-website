import { useCallback, useState } from 'react'
import './App.css'
import { Gnome } from './components/Gnome'
import { HeroTitle } from './components/HeroTitle'
import { Tape } from './components/Tape'
import { Terminal } from './components/Terminal'
import { WireHat } from './components/WireHat'

const EMAIL = 'contact@gnometrading.group'

const SECTIONS = [
  { id: 's0', label: 'Top' },
  { id: 's1', label: 'Markets' },
  { id: 's2', label: 'Venues and careers' },
  { id: 's3', label: 'Contact' },
]

const TAPE = ['Digital assets', 'Prediction markets', 'Equities', 'Options']

const MARKETS = [
  ['Digital assets', 'Spot and perpetuals, on and off-chain'],
  ['Prediction markets', 'Event contracts across numerous venues'],
  ['Equities', 'Liquidity providing and taking'],
  ['Options', 'Volatility across strikes and expiries'],
]

function CopyButton() {
  const [label, setLabel] = useState('Copy')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setLabel('Copied')
    } catch {
      const el = document.getElementById('email')
      if (el) getSelection()?.selectAllChildren(el)
      setLabel('Selected')
    }
    setTimeout(() => setLabel('Copy'), 1600)
  }
  return (
    <button type="button" className="btn" onClick={copy}>
      {label}
    </button>
  )
}

export default function App() {
  const [termOpen, setTermOpen] = useState(false)
  const openTerm = useCallback(() => setTermOpen(true), [])
  const closeTerm = useCallback(() => setTermOpen(false), [])

  return (
    <>
      <WireHat sections={SECTIONS} onCursorClick={openTerm} />
      <Gnome onClick={openTerm} />

      <main>
        <header className="wrap beat hero" id="s0">
          <div className="hero-copy">
            <span className="label">Electronic trading</span>
            <HeroTitle />
            <Tape items={TAPE} />
          </div>
        </header>

        <section className="wrap beat" id="s1">
          <div className="copy">
            <span className="label">Markets</span>
            <h2>Both taking and making.</h2>
            <ul className="markets">
              {MARKETS.map(([name, desc]) => (
                <li key={name}>
                  <b>{name}</b>
                  {desc}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="wrap split" id="s2">
          <div id="venues">
            <span className="label">For venues</span>
            <h2>Need liquidity?</h2>
            <p>Launching a market or a maker program? We quote both sides from day one and integrate new venues quickly.</p>
            <ul>
              <li>Continuous two-sided quotes</li>
              <li>Integration in days</li>
              <li>Risk limits on every session</li>
            </ul>
          </div>
          <div id="careers">
            <span className="label">For engineers &amp; researchers</span>
            <h2>Build with us.</h2>
            <p>A small team where everyone owns systems end to end, from research to production.</p>
            <ul>
              <li>Latency-sensitive engineering</li>
              <li>Research on full order books</li>
              <li>Frontier markets</li>
            </ul>
          </div>
        </section>

        <section className="wrap beat contact" id="s3">
          <div className="copy">
            <span className="label">Contact</span>
            <div className="email" id="email">
              {EMAIL}
            </div>
            <div className="row">
              <CopyButton />
              <a className="btn" href={`mailto:${EMAIL}`}>
                Email
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="wrap">
        <span>© {new Date().getFullYear()} Gnome Trading Group</span>
        <button type="button" className="ghost" onClick={openTerm} aria-label="Open terminal">
          _
        </button>
      </footer>

      <Terminal open={termOpen} onOpen={openTerm} onClose={closeTerm} />
    </>
  )
}
