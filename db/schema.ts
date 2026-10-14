import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import type { Tracker } from '../src/lib/raids'

export const rosters = pgTable('rosters', {
  ownerId: text('owner_id').primaryKey(),
  state: jsonb('state').$type<Tracker>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
