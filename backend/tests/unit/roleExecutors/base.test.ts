import { saveFeedItem, saveTokenUsage, type DbClient } from '../../../src/services/roleExecutors/base'

function createMockDb(): DbClient & { calls: Array<{sql: string, params: unknown[]}> } {
  const calls: Array<{sql: string, params: unknown[]}> = []
  return {
    calls,
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params })
      return { rows: [] }
    }
  }
}

describe('roleExecutors/base', () => {
  describe('saveFeedItem', () => {
    it('inserts feed item with correct fields', async () => {
      const db = createMockDb()
      const id = await saveFeedItem(db, 'agent-1', 'info', 'test content')
      expect(id).toBeTruthy()
      expect(db.calls).toHaveLength(1)
      expect(db.calls[0].sql).toContain('INSERT INTO feed_items')
      expect(db.calls[0].params).toContain('agent-1')
      expect(db.calls[0].params).toContain('info')
      expect(db.calls[0].params).toContain('test content')
    })

    it('sets requires_approval=1 when flagged', async () => {
      const db = createMockDb()
      await saveFeedItem(db, 'agent-1', 'approval', 'needs review', true)
      expect(db.calls[0].params).toContain(1)
    })
  })

  describe('saveTokenUsage', () => {
    it('inserts token usage with cost calculation', async () => {
      const db = createMockDb()
      await saveTokenUsage(db, 'agent-1', 'mission-1', 1000, 500, 'claude-sonnet-4-6')
      expect(db.calls).toHaveLength(1)
      expect(db.calls[0].sql).toContain('INSERT INTO token_usage')
      const costParam = db.calls[0].params[5] as number
      expect(costParam).toBeGreaterThan(0)
    })
  })
})
