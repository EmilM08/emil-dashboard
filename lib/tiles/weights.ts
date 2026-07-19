/**
 * Goals + tile weights — the math of the equation, with NO AI key at runtime.
 *
 *   y = the Mentor (the overseer, where the math lives)
 *   x = each input tile · w = that tile's share of the ACTIVE goal
 *
 * Each goal carries its own weights (sum ≈ 100): "famous YouTuber" leans on
 * Brand; "185 lb lean" leans on Train/Fuel. The row badges show the active
 * goal's weights; the Mentor lists every goal with its full breakdown.
 *
 * WHO DOES THE MATH: Claude Code, at build time — not an Anthropic key, not
 * you by hand. In VS Code, say:
 *
 *   "My goals are X and Y. Open lib/tiles/weights.ts and re-run the math:
 *    for each goal, weigh how much each tile's input actually moves it
 *    (ask me questions if you need to). Each goal's weights sum to 100."
 *
 * Claude reasons, edits DEFAULT_GOALS, you reload. Later it can also
 * cross-reference your real tile data (video published vs workouts, water,
 * caffeine) and retune from evidence. A localStorage override
 * ('vitality:goals') wins over these defaults, so the connector or a goals
 * UI can retune without a code change.
 */

export interface Goal {
  id: string
  title: string
  /** tile slot -> % of this goal (sums to ~100) */
  weights: Record<string, number>
  /** true while the mentor (Claude Code) hasn't shaped + weighed it yet */
  pending?: boolean
  /** each goal tints the board a little; the overall goal goes gold */
  accent?: string
  /** how far you've come, 0–100 — computed by the mentor from data sweeps
   *  (analytics, manual logs, wearables), never guessed by the app */
  progress?: number
}

/** One observation the mentor pushed after scanning your data, with any
 *  weight changes it made because of what it found. */
export interface Notice {
  id: string
  when: string
  text: string
  /** bullet points; **bold** marks the highlighted words */
  points?: string[]
  deltas?: { tile: string; from: number; to: number }[]
}

export const DEFAULT_GOALS: Goal[] = [
  {
    id: 'bulk',
    title: 'Build 15 kg of muscle — reach 80 kg built',
    accent: '#8AB4FF',
    weights: { train: 35, fuel: 35, vitals: 20, peak: 10 },
    progress: 0,
  },
  {
    id: 'level-up',
    title: 'Level up every area — sharp, consistent, in control',
    accent: '#6EE7B7',
    weights: { peak: 30, train: 20, vitals: 20, fuel: 15, brand: 10, finance: 5 },
    progress: 0,
  },
]

/** The overseer's synthesis of EVERY goal, polished into one sentence by the
 *  mentor (Claude Code). Switching it on = top priority — the board goes gold. */
export const OVERALL_GOAL: Goal = {
  id: 'overall',
  title: 'Become Emil at his best — physically built, mentally locked in, and living without brakes.',
  accent: '#E8C878',
  weights: { train: 30, fuel: 25, vitals: 20, peak: 15, brand: 7, finance: 3 },
  progress: 0,
}

/** Overall first, then the individual goals. */
export function allGoals(): Goal[] {
  return [OVERALL_GOAL, ...goals()]
}

/** The full active Goal (incl. overall), for accent + title. */
export function activeGoal(): Goal | undefined {
  const id = activeGoalId()
  return allGoals().find((g) => g.id === id) ?? goals()[0]
}

export const DEFAULT_NOTICED: Notice[] = []

/** A blueprint for a tile they SHOULD have — a gap the mentor found between
 *  their goal and what their tiles actually track. Pre-written by the mentor
 *  (Claude Code) from their data; localStorage 'vitality:ideas' overrides. */
export interface TileIdea {
  /** ONE word — how the idea shows up in the popup (the mentor picks it) */
  word?: string
  title: string
  /** what the tile tracks, in one line */
  tracks: string
  /** why it moves THIS goal — tied to their data when possible */
  why: string
  /** the weight it would likely earn (≈ %) */
  estWeight: number
}

export const DEFAULT_IDEAS: Record<string, TileIdea[]> = {
  overall: [
    {
      word: 'Sleep',
      title: 'Sleep consistency',
      tracks: 'bedtime + hours, night by night',
      why: 'At 17 and bulking, sleep is where the muscle actually grows. Nothing on the board tracks it yet — and it touches every other tile.',
      estWeight: 8,
    },
    {
      word: 'Water',
      title: 'Water intake',
      tracks: 'daily intake vs target',
      why: 'At 65 kg and growing, hydration is a silent lever. Cheap to track, compounds fast.',
      estWeight: 5,
    },
  ],
  bulk: [
    {
      word: 'Water',
      title: 'Water intake',
      tracks: 'daily intake vs target',
      why: 'Muscle is 75% water. No tile tracks hydration yet — it directly supports the bulk.',
      estWeight: 7,
    },
    {
      word: 'Steps',
      title: 'Steps / NEAT',
      tracks: 'daily movement outside the gym',
      why: 'During a bulk, keeping NEAT up stops fat from piling in too fast. Train sees sessions; this sees the rest of the day.',
      estWeight: 5,
    },
  ],
  'level-up': [
    {
      word: 'Journal',
      title: 'Daily reflection',
      tracks: 'one-line wins + blockers, daily',
      why: 'You said mental and lifestyle matter most. Nothing on the board tracks your head. A daily log is the cheapest edge there is.',
      estWeight: 10,
    },
    {
      word: 'Sleep',
      title: 'Sleep consistency',
      tracks: 'bedtime variance, night by night',
      why: 'Consistency beats duration. One tile, one habit, maximum leverage on every other tile.',
      estWeight: 8,
    },
  ],
}

/** The mentor's tile recommendations for a goal (localStorage override wins). */
export function tileIdeas(goalId: string): TileIdea[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('vitality:ideas')
      if (raw) {
        const o = JSON.parse(raw)
        if (o && typeof o === 'object' && Array.isArray(o[goalId])) return o[goalId] as TileIdea[]
      }
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_IDEAS[goalId] ?? DEFAULT_IDEAS.overall ?? []
}

/** The mentor's noticed feed: localStorage override, else the seeded example.
 *  Claude Code (or the connector) writes 'vitality:noticed' after a scan. */
export function noticedFeed(): Notice[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('vitality:noticed')
      if (raw) {
        const o = JSON.parse(raw)
        if (Array.isArray(o)) return o as Notice[]
      }
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_NOTICED
}

/** Save the goals list (used by the mentor page's goal input). */
export function saveGoals(list: Goal[]): void {
  try {
    window.localStorage.setItem('vitality:goals', JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

/** All goals: localStorage override ('vitality:goals') if valid, else defaults. */
export function goals(): Goal[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('vitality:goals')
      if (raw) {
        const o = JSON.parse(raw)
        if (Array.isArray(o) && o.every((g) => g && typeof g.id === 'string' && g.weights)) return o as Goal[]
      }
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_GOALS
}

/** The active goal id (persisted). Defaults to the first goal. */
export function activeGoalId(): string {
  if (typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem('vitality:goal:active')
      if (v) return v
    } catch {
      /* fall through */
    }
  }
  return goals()[0]?.id ?? ''
}

export function setActiveGoalId(id: string): void {
  try {
    window.localStorage.setItem('vitality:goal:active', id)
  } catch {
    /* ignore */
  }
}

/** The active goal's weights (the badges on the row read these). */
export function tileWeights(): Record<string, number> {
  return activeGoal()?.weights ?? {}
}
