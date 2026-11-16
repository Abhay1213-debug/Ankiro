import type { Digit } from '../shared/numerology'

/**
 * Short, fixed meanings for the Bhagyank (life-path number) and the personal month, in our own words from the
 * qualities most numerology sources agree on. They are shown when the AI writer is unavailable, and they are also
 * given to the AI so its reading stays consistent with them. No planets, no remedies (the site does not use astrology).
 */

export const bhagyankThemes: Record<Digit, { title: string; text: string }> = {
  1: { title: 'The pioneer', text: 'Your path asks you to stand on your own feet, start things and lead. Life keeps handing you chances to go first.' },
  2: { title: 'The peacemaker', text: 'Your path runs through people. Partnerships, patience and tact bring you further than going it alone.' },
  3: { title: 'The communicator', text: 'Your path is about expression: speaking, teaching, creating. Joy and sharing what you know open doors for you.' },
  4: { title: 'The builder', text: 'Your path rewards steady work. What you build slowly and properly lasts, and people come to rely on you.' },
  5: { title: 'The explorer', text: 'Your path is change and movement. New places, people and ideas keep you growing; routine tests you.' },
  6: { title: 'The caretaker', text: 'Your path is responsibility and care: family, home and the people who depend on you. Love is your teacher.' },
  7: { title: 'The seeker', text: 'Your path turns inward: study, reflection and faith. Answers come to you in quiet, not in crowds.' },
  8: { title: 'The achiever', text: 'Your path is about effort and results: money, position and authority, earned through patience and hard work.' },
  9: { title: 'The humanitarian', text: 'Your path is service and completion. You are here to give, to finish what matters and to let go gracefully.' },
}

export const personalMonthThemes: Record<Digit, { theme: string; text: string; focus: [string, string, string] }> = {
  1: { theme: 'A fresh start', text: 'A month to begin: new plans, new habits, a first step you have been putting off.', focus: ['Start one thing you have delayed', 'Back your own decisions', 'Keep promises to yourself small and daily'] },
  2: { theme: 'Patience and partnership', text: 'A slower, softer month. Results come through cooperation, listening and waiting for the right moment.', focus: ['Listen more than you speak', 'Mend one relationship', 'Let decisions ripen before you act'] },
  3: { theme: 'Expression and people', text: 'A social, creative month. Speak up, share your ideas and say yes to good company.', focus: ['Say what you have been holding back', 'Make time for friends', 'Put one idea into words or work'] },
  4: { theme: 'Work and foundations', text: 'A month for steady effort: organise, plan, finish the practical tasks that make the future easier.', focus: ['Sort out money and paperwork', 'Build a simple routine', 'Finish before you start something new'] },
  5: { theme: 'Change and movement', text: 'A lively month with surprises. Travel, new contacts and change are likely; stay flexible.', focus: ['Say yes to one new experience', 'Avoid rash spending', 'Keep your plans loose'] },
  6: { theme: 'Home and responsibility', text: 'A month centred on family, home and the people who rely on you. Care is rewarded.', focus: ['Give time to family', 'Settle a household matter', 'Look after your own health too'] },
  7: { theme: 'Reflection', text: 'A quieter, inward month. Rest, study and think before big moves; trust your instincts.', focus: ['Take time alone to think', 'Learn something deeply', 'Delay big commitments if unsure'] },
  8: { theme: 'Effort and reward', text: 'A month for ambition and money matters. Hard work shows results; decisions carry weight.', focus: ['Push one important goal', 'Review your finances', 'Stay fair in every deal'] },
  9: { theme: 'Completion', text: 'A month for endings and clearing out. Finish, forgive and make room for what comes next.', focus: ['Close what is unfinished', 'Let go of one old worry', 'Help someone without expecting return'] },
}
