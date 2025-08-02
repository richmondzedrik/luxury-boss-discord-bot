#!/usr/bin/env node

console.log('🚀 Test Discord Bot starting...')

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

console.log('Environment variables loaded:')
console.log('DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not set')
console.log('DISCORD_CHANNEL_ID:', process.env.DISCORD_CHANNEL_ID || 'Not set')
console.log('PORT:', process.env.PORT || 'Not set')

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use(cors())

app.get('/test', (req, res) => {
  res.json({ 
    status: 'Test Discord bot server running',
    timestamp: new Date().toISOString(),
    env: {
      hasToken: !!process.env.DISCORD_BOT_TOKEN,
      hasChannelId: !!process.env.DISCORD_CHANNEL_ID,
      port: PORT
    }
  })
})

app.listen(PORT, () => {
  console.log(`🌐 Test Discord bot server running on port ${PORT}`)
  console.log(`📡 Test endpoint: http://localhost:${PORT}/test`)
})

console.log('✅ Test Discord bot server initialization complete')
