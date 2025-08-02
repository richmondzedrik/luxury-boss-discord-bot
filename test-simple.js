console.log('🚀 Simple test starting...')

try {
  console.log('Environment variables:')
  console.log('DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not set')
  console.log('DISCORD_CHANNEL_ID:', process.env.DISCORD_CHANNEL_ID || 'Not set')
  console.log('PORT:', process.env.PORT || 'Not set')

  console.log('Loading express...')
  const express = require('express')
  console.log('Express loaded successfully')

  console.log('Loading discord.js...')
  const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js')
  console.log('Discord.js loaded successfully')

  const app = express()
  const PORT = process.env.PORT || 3001

  app.use(express.json())

  app.get('/test', (req, res) => {
    res.json({ status: 'Test server running' })
  })

  app.listen(PORT, () => {
    console.log(`🌐 Test server running on port ${PORT}`)
  })

  console.log('✅ Test completed successfully')

} catch (error) {
  console.error('❌ Error in test:', error)
  console.error('Error stack:', error.stack)
}
