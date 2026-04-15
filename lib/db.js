import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

import { nanoid } from 'nanoid'

const defaultData = { 
  users: [
    { 
      username: 'admin', 
      password: '', // admin123 handle in server.js
      role: 'admin',
      token: nanoid(32) // Unique token even for admin
    }
  ],
  logs: [] 
}

const adapter = new JSONFile('db.json')
const db = new Low(adapter, defaultData)

// Read from JSON file, will set db.data to null if file doesn't exist or is empty
await db.read()

// If file is empty, use defaultData
if (!db.data) {
  db.data = defaultData
  await db.write()
}

export default db
