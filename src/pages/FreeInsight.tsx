import { useEffect, useState } from 'react'
import { FreeReading } from '../components/FreeReading'
import { ButtonLink, PageHero } from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import { loadWeekly, weeklyIsRunning } from '../lib/weekly'

export default function FreeInsight() {
  usePageTitle('Free Moolank insight')
  const [weekly, setWeekly] = useState(false)
  useEffect(() => {
    let alive = true
    loadWeekly().then((i) => { if (alive) setWeekly(weeklyIsRunning(i)) })
    return () => { alive = false }
  }, [])
  const gets = [
    'Your Moolank and Bhagyank',
    'What your numbers say about you, by name',
    'A reading for your month ahead: work, relationships and energy',
    'Answers to two questions about your life, and one of your own',
    ...(weekly ? ['This week’s reading for your number'] : []),
  ]
  return (
    <>
      <PageHero
        eyebrow="Free insight"
        title={<>Discover your <em>Moolank</em></>}
        lede="Your Moolank is the root number of the day you were born. Enter your name and date of birth for your numbers, a reading for this month, and answers to the questions on your mind."
      />
      <section className="section section--paper">
        <div className="container split split--wide-right" style={{ alignItems: 'start' }}>
          <div className="stack">
            <h2>What you <em>get</em></h2>
            <ul className="insight-gets">
              {gets.map((g) => <li key={g}>{g}</li>)}
            </ul>
            <p><ButtonLink to="/services/numerology" variant="ghost">About numerology consultations</ButtonLink></p>
          </div>
          <FreeReading />
        </div>
      </section>
    </>
  )
}
