import bcrypt from 'bcryptjs'
import fs from 'fs'

const dbPath = './db.json'
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

const adminPassword = 'F#1superadmin'
const hashed = await bcrypt.hash(adminPassword, 10)

// Find or update admin
const admin = db.users.find(u => u.username === 'admin')
if (admin) {
    admin.password = hashed
    console.log('Admin password updated to hashed F#1superadmin')
}

// Add expiresAt to all users if missing
db.users.forEach(u => {
    if (!u.expiresAt) {
        // Default to 30 days from now
        const exp = new Date()
        exp.setDate(exp.getDate() + 30)
        u.expiresAt = exp.toISOString()
    }
})

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))
console.log('Database migrated successfully.')
