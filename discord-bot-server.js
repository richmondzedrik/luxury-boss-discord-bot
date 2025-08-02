#!/usr/bin/env node

console.log('🚀 Discord Bot Server starting...')

/**
 * Discord Bot Server for Boss Monitoring
 *
 * This is a standalone Node.js server that runs the Discord bot.
 * It can be run separately from the React application.
 *
 * Usage:
 * 1. Set environment variables:
 *    - DISCORD_BOT_TOKEN: Your Discord bot token
 *    - DISCORD_CHANNEL_ID: The Discord channel ID to send messages to
 *
 * 2. Run the server:
 *    node discord-bot-server.js
 *
 * 3. The server will start on port 3001 and provide an API endpoint:
 *    POST /api/send-boss - Send a boss notification to Discord
 */

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware - CORS configuration to allow requests from the React app
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://luxurybhstatus.vercel.app',
    'https://luxurybhstatus-*.vercel.app',
    // Allow all Vercel preview deployments
    /^https:\/\/luxurybhstatus-.*\.vercel\.app$/,
    // Allow Railway/Render domains for testing
    /^https:\/\/.*\.up\.railway\.app$/,
    /^https:\/\/.*\.onrender\.com$/
  ],
  credentials: true
}))
app.use(express.json())

// Discord bot setup
let discordClient = null
let isConnected = false
let targetChannelId = process.env.DISCORD_CHANNEL_ID
const participationData = new Map()
// Store boss data for each message to enable respawn time updates
const messageBossData = new Map()

// Initialize Discord bot
async function initializeDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN
  
  if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN environment variable is required')
    return false
  }

  if (!targetChannelId) {
    console.error('❌ DISCORD_CHANNEL_ID environment variable is required')
    return false
  }

  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
      ]
    })

    // Set up event handlers
    discordClient.on('ready', () => {
      console.log(`✅ Discord bot logged in as ${discordClient.user.tag}!`)
      isConnected = true
    })

    discordClient.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return
      await handleReactionAdd(reaction, user)
    })

    discordClient.on('messageReactionRemove', async (reaction, user) => {
      if (user.bot) return
      await handleReactionRemove(reaction, user)
    })

    discordClient.on('error', (error) => {
      console.error('Discord bot error:', error)
    })

    discordClient.on('disconnect', () => {
      console.log('Discord bot disconnected')
      isConnected = false
    })

    // Login to Discord
    await discordClient.login(token)
    
    console.log('🤖 Discord bot initialized successfully!')

    // Start periodic respawn time updates
    startPeriodicRespawnTimeUpdates()

    return true
  } catch (error) {
    console.error('❌ Failed to initialize Discord bot:', error)
    return false
  }
}

// Periodic respawn time updates for Discord messages
function startPeriodicRespawnTimeUpdates() {
  console.log('🔄 Starting periodic respawn time updates (every 2 minutes)')

  setInterval(async () => {
    if (!isConnected || !discordClient) {
      return
    }

    console.log('🔄 Updating respawn times in Discord messages...')

    for (const [messageId, bossData] of messageBossData.entries()) {
      try {
        const participationInfo = participationData.get(messageId)
        if (!participationInfo) {
          console.log(`⚠️ No participation data for message ${messageId}, skipping update`)
          continue
        }

        // Try to fetch the message
        const channel = await discordClient.channels.fetch(targetChannelId)
        if (!channel) {
          console.log(`⚠️ Could not fetch channel ${targetChannelId}`)
          continue
        }

        const message = await channel.messages.fetch(messageId).catch(() => null)
        if (!message) {
          console.log(`⚠️ Could not fetch message ${messageId}, removing from tracking`)
          messageBossData.delete(messageId)
          participationData.delete(messageId)
          continue
        }

        // Update the embed with current respawn time
        await updateParticipationEmbed(message, participationInfo)

      } catch (error) {
        console.error(`❌ Error updating message ${messageId}:`, error.message)
      }
    }

    console.log(`✅ Respawn time update complete. Tracking ${messageBossData.size} messages.`)

    // Clean up old messages (older than 24 hours)
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    for (const [messageId, bossData] of messageBossData.entries()) {
      // Check if boss is very old (more than 24 hours past respawn time)
      const respawnTime = calculateRespawnTime(bossData)
      if (respawnTime && respawnTime.getTime() < oneDayAgo.getTime()) {
        console.log(`🗑️ Removing old boss message ${messageId} for ${bossData.monster}`)
        messageBossData.delete(messageId)
        participationData.delete(messageId)
      }
    }

  }, 2 * 60 * 1000) // Update every 2 minutes
}

// Handle reaction additions
async function handleReactionAdd(reaction, user) {
  try {
    console.log(`👆 Reaction added: ${reaction.emoji.name} by ${user.username}`)

    if (reaction.partial) {
      await reaction.fetch()
    }

    const messageId = reaction.message.id
    const emoji = reaction.emoji.name

    if (emoji !== '✅' && emoji !== '❌') {
      console.log(`❌ Ignoring reaction: ${emoji} (not ✅ or ❌)`)
      return
    }

    if (!participationData.has(messageId)) {
      console.log(`📝 Creating new participation data for message ${messageId}`)
      participationData.set(messageId, {
        participating: new Set(),
        notParticipating: new Set()
      })
    }

    const data = participationData.get(messageId)
    console.log(`📊 Before update - Participating: ${data.participating.size}, Not participating: ${data.notParticipating.size}`)

    if (emoji === '✅') {
      data.notParticipating.delete(user.id)
      data.participating.add(user.id)
      console.log(`✅ ${user.username} is now participating`)
    } else if (emoji === '❌') {
      data.participating.delete(user.id)
      data.notParticipating.add(user.id)
      console.log(`❌ ${user.username} is not participating`)
    }

    console.log(`📊 After update - Participating: ${data.participating.size}, Not participating: ${data.notParticipating.size}`)

    await updateParticipationEmbed(reaction.message, data)
  } catch (error) {
    console.error('Error handling reaction add:', error)
    console.error('Error details:', error.message)
  }
}

// Handle reaction removals
async function handleReactionRemove(reaction, user) {
  try {
    console.log(`👇 Reaction removed: ${reaction.emoji.name} by ${user.username}`)

    if (reaction.partial) {
      await reaction.fetch()
    }

    const messageId = reaction.message.id
    const emoji = reaction.emoji.name

    if (emoji !== '✅' && emoji !== '❌') {
      console.log(`❌ Ignoring reaction removal: ${emoji} (not ✅ or ❌)`)
      return
    }

    const data = participationData.get(messageId)
    if (!data) {
      console.log(`❌ No participation data found for message ${messageId}`)
      return
    }

    console.log(`📊 Before removal - Participating: ${data.participating.size}, Not participating: ${data.notParticipating.size}`)

    if (emoji === '✅') {
      data.participating.delete(user.id)
      console.log(`✅ Removed ${user.username} from participating`)
    } else if (emoji === '❌') {
      data.notParticipating.delete(user.id)
      console.log(`❌ Removed ${user.username} from not participating`)
    }

    console.log(`📊 After removal - Participating: ${data.participating.size}, Not participating: ${data.notParticipating.size}`)

    await updateParticipationEmbed(reaction.message, data)
  } catch (error) {
    console.error('Error handling reaction remove:', error)
    console.error('Error details:', error.message)
  }
}

// Update participation embed with enhanced status display
async function updateParticipationEmbed(message, participationData) {
  try {
    const embed = message.embeds[0]
    if (!embed) {
      console.error('No embed found in message')
      return
    }

    const participatingCount = participationData.participating.size
    const notParticipatingCount = participationData.notParticipating.size
    const totalResponses = participatingCount + notParticipatingCount
    const participationRate = totalResponses > 0 ? Math.round((participatingCount / totalResponses) * 100) : 0

    // Get usernames for participants (if available)
    let participatingUsers = []
    let notParticipatingUsers = []

    try {
      // Fetch user information for display names
      for (const userId of participationData.participating) {
        try {
          const user = await discordClient.users.fetch(userId)
          participatingUsers.push(user.displayName || user.username)
        } catch (err) {
          participatingUsers.push(`User ${userId}`)
        }
      }

      for (const userId of participationData.notParticipating) {
        try {
          const user = await discordClient.users.fetch(userId)
          notParticipatingUsers.push(user.displayName || user.username)
        } catch (err) {
          notParticipatingUsers.push(`User ${userId}`)
        }
      }
    } catch (error) {
      console.log('Could not fetch user details, showing counts only')
    }

    // Create participation status display
    let participationValue = `✅ **Participating (${participatingCount}):**\n`
    if (participatingUsers.length > 0) {
      participationValue += participatingUsers.slice(0, 10).join(', ')
      if (participatingUsers.length > 10) {
        participationValue += ` and ${participatingUsers.length - 10} more...`
      }
    } else {
      participationValue += '*No one yet*'
    }

    participationValue += `\n\n❌ **Not Participating (${notParticipatingCount}):**\n`
    if (notParticipatingUsers.length > 0) {
      participationValue += notParticipatingUsers.slice(0, 10).join(', ')
      if (notParticipatingUsers.length > 10) {
        participationValue += ` and ${notParticipatingUsers.length - 10} more...`
      }
    } else {
      participationValue += '*No one yet*'
    }

    // Rebuild the embed completely to ensure all fields are preserved
    const updatedEmbed = new EmbedBuilder()
      .setTitle(embed.title)
      .setColor(embed.color)
      .setDescription(embed.description)
      .setFooter({ text: embed.footer?.text || 'React with ✅ to participate or ❌ to skip this boss • Updates in real-time' })
      .setTimestamp()

    // Set thumbnail if it exists
    if (embed.thumbnail?.url) {
      updatedEmbed.setThumbnail(embed.thumbnail.url)
    }

    // Add all the original fields (boss info) with updated respawn time
    if (embed.fields && embed.fields.length >= 2) {
      console.log(`📋 Preserving ${embed.fields.length} original fields`)

      // Get the stored boss data for this message to recalculate respawn time
      const storedBossData = messageBossData.get(message.id)

      // Add boss name field
      const bossNameField = embed.fields.find(field => field.name === '👹 Boss Name')
      if (bossNameField) {
        updatedEmbed.addFields({
          name: bossNameField.name,
          value: bossNameField.value,
          inline: bossNameField.inline || false
        })
      }

      // Add respawn time field with updated calculation
      let timeValue = 'Unknown'
      if (storedBossData) {
        // Recalculate the respawn time with current time
        const formattedTime = formatRespawnTime(storedBossData)
        const formattedDate = formatDiscordDate(storedBossData)

        timeValue = formattedTime
        if (formattedDate) {
          timeValue += `\n${formattedDate}`
        }
        console.log(`⏰ Updated respawn time for ${storedBossData.monster}: ${formattedTime}`)
      } else {
        // Fallback to original time from embed if no stored data
        const originalTimeField = embed.fields.find(field => field.name === '⏰ Respawn Time')
        timeValue = originalTimeField?.value || 'Unknown'
        console.log(`⚠️ No stored boss data found for message ${message.id}, using original time`)
      }

      updatedEmbed.addFields({
        name: '⏰ Respawn Time',
        value: timeValue,
        inline: true
      })

      // Add points field if it exists
      const pointsField = embed.fields.find(field => field.name === '💰 Points')
      if (pointsField) {
        updatedEmbed.addFields({
          name: pointsField.name,
          value: pointsField.value,
          inline: pointsField.inline || false
        })
      }

      // Add notes field if it exists
      const notesField = embed.fields.find(field => field.name === '📝 Notes')
      if (notesField) {
        updatedEmbed.addFields({
          name: notesField.name,
          value: notesField.value,
          inline: notesField.inline || false
        })
      }
    } else {
      console.log(`⚠️ Warning: Expected at least 2 fields, found ${embed.fields?.length || 0}`)
    }

    // Add the updated participation fields
    updatedEmbed.addFields(
      {
        name: '👥 Participation Status',
        value: participationValue,
        inline: false
      },
      {
        name: '📊 Quick Stats',
        value: `**Total Responses:** ${totalResponses}\n**Participation Rate:** ${participationRate}%`,
        inline: false
      }
    )

    console.log(`📋 Updated embed will have ${updatedEmbed.data.fields?.length || 0} fields total`)

    await message.edit({ embeds: [updatedEmbed] })

    console.log(`📊 Updated participation: ${participatingCount} participating, ${notParticipatingCount} not participating`)
  } catch (error) {
    console.error('Error updating participation embed:', error)
    console.error('Error details:', error.message)
  }
}

// Helper function to calculate respawn time (EXACT same logic as website)
function calculateRespawnTime(boss) {
  // If respawn_time is provided and it's in the FUTURE, use it (EXACT website logic)
  if (boss.respawn_time) {
    const respawnDate = new Date(boss.respawn_time)
    const now = new Date()
    if (!isNaN(respawnDate.getTime()) && respawnDate.getTime() > now.getTime()) {
      console.log(`🕐 Using FUTURE API respawn_time for ${boss.monster}: ${boss.respawn_time}`)
      return respawnDate
    }
  }

  // Otherwise calculate from time_of_death + respawn_hours (EXACT website logic)
  if (boss.time_of_death && boss.respawn_hours) {
    const deathTime = new Date(boss.time_of_death)
    if (!isNaN(deathTime.getTime())) {
      const respawnTime = new Date(deathTime.getTime() + (boss.respawn_hours * 60 * 60 * 1000))
      console.log(`🕐 Calculated respawn time for ${boss.monster}: death(${boss.time_of_death}) + ${boss.respawn_hours}h = ${respawnTime.toISOString()}`)
      return respawnTime
    }
  }

  // Fallback to respawn_time even if it's in the past (EXACT website logic)
  if (boss.respawn_time) {
    const respawnDate = new Date(boss.respawn_time)
    console.log(`🕐 Fallback to PAST API respawn_time for ${boss.monster}: ${boss.respawn_time}`)
    return respawnDate
  }

  console.log(`⚠️ No valid respawn time found for ${boss.monster}`)
  return null
}

// Helper function to format respawn time (same logic as website)
function formatRespawnTime(boss) {
  const respawnDate = calculateRespawnTime(boss)

  if (!respawnDate || isNaN(respawnDate.getTime())) {
    return 'Unknown'
  }

  const now = new Date()
  const diffInMs = respawnDate.getTime() - now.getTime()

  // If the time has passed (boss is available now)
  if (diffInMs <= 0) {
    return 'Available Now!'
  }

  const diffInSeconds = Math.floor(diffInMs / 1000)
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInDays > 0) {
    return `${diffInDays}d ${diffInHours % 24}h`
  } else if (diffInHours > 0) {
    return `${diffInHours}h ${diffInMinutes % 60}m`
  } else if (diffInMinutes > 0) {
    return `${diffInMinutes}m`
  } else {
    return `${diffInSeconds}s`
  }
}

// Helper function to format date for Discord (EXACT same as website)
function formatDiscordDate(boss) {
  const respawnDate = calculateRespawnTime(boss)
  if (!respawnDate || isNaN(respawnDate.getTime())) {
    return null
  }

  // Use the EXACT same formatting as website BossPage.jsx line 436-442
  // This should match the website's display exactly
  try {
    const formatted = respawnDate.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    console.log(`📅 Date formatting debug:`)
    console.log(`   Input ISO: ${respawnDate.toISOString()}`)
    console.log(`   Local time: ${respawnDate.toString()}`)
    console.log(`   Formatted: ${formatted}`)
    console.log(`   Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`)
    return formatted
  } catch (error) {
    console.error('Error formatting date:', error)
    return respawnDate.toLocaleString()
  }
}

// Create boss embed with participation status
function createBossEmbed(bossData, participationData = null) {
  const participatingCount = participationData ? participationData.participating.size : 0
  const notParticipatingCount = participationData ? participationData.notParticipating.size : 0
  const totalResponses = participatingCount + notParticipatingCount
  const participationRate = totalResponses > 0 ? Math.round((participatingCount / totalResponses) * 100) : 0

  // Format time using website's logic
  const formattedTime = formatRespawnTime(bossData)
  const formattedDate = formatDiscordDate(bossData)

  // Create time display value
  let timeValue = formattedTime
  if (formattedDate) {
    timeValue += `\n${formattedDate}`
  }

  // Create initial participation status display
  const participationValue = `✅ **Participating (${participatingCount}):**\n*No one yet*\n\n❌ **Not Participating (${notParticipatingCount}):**\n*No one yet*`

  const embed = new EmbedBuilder()
    .setTitle(`🔥 Boss Alert: ${bossData.name || bossData.monster}`)
    .setColor(0xFF6B35)
    .setDescription(`@here A boss is ready for hunting! React below to indicate your participation.`)
    .addFields(
      {
        name: '👹 Boss Name',
        value: bossData.monster || 'Unknown Boss',
        inline: true
      },
      {
        name: '⏰ Respawn Time',
        value: timeValue,
        inline: true
      },


      {
        name: '👥 Participation Status',
        value: participationValue,
        inline: false
      },
      {
        name: '📊 Quick Stats',
        value: `**Total Responses:** ${totalResponses}\n**Participation Rate:** ${participationRate}%`,
        inline: false
      }
    )
    .setFooter({
      text: 'React with ✅ to participate or ❌ to skip this boss • Updates in real-time'
    })
    .setTimestamp()

  if (bossData.image_url || bossData.display_image) {
    embed.setThumbnail(bossData.image_url || bossData.display_image)
  }

  return embed
}

// API Routes
app.get('/api/status', (_, res) => {
  res.json({
    status: 'running',
    discordConnected: isConnected,
    botUser: discordClient?.user?.tag || null,
    channelId: targetChannelId
  })
})

app.post('/api/send-boss', async (req, res) => {
  try {
    if (!isConnected || !discordClient) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not connected'
      })
    }

    const bossData = req.body
    console.log('📥 Received boss data from frontend:', JSON.stringify(bossData, null, 2))
    console.log('🔍 Key time fields received:')
    console.log('   respawn_time:', bossData.respawn_time)
    console.log('   time_of_death:', bossData.time_of_death)
    console.log('   respawn_hours:', bossData.respawn_hours)

    // Check if the request includes admin verification
    // Note: In production, you should implement proper JWT token verification
    if (!bossData.isAdmin) {
      console.log('❌ Unauthorized attempt to send boss notification - admin access required')
      return res.status(403).json({
        success: false,
        error: 'Admin access required to send Discord notifications'
      })
    }

    if (!bossData || !bossData.monster) {
      return res.status(400).json({
        success: false,
        error: 'Boss data is required'
      })
    }

    const channel = await discordClient.channels.fetch(targetChannelId)
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Discord channel not found'
      })
    }

    // Initialize participation data first
    const initialParticipationData = {
      participating: new Set(),
      notParticipating: new Set()
    }

    // Ensure boss data has the required fields for time calculation
    const processedBossData = {
      ...bossData,
      // Make sure we have the right field names for time calculation
      monster: bossData.monster || bossData.name,
      name: bossData.name || bossData.monster,
      respawn_time: bossData.respawn_time,
      time_of_death: bossData.time_of_death,
      respawn_hours: bossData.respawn_hours,
      points: bossData.points,
      notes: bossData.notes,
      image_url: bossData.image_url || bossData.display_image
    }

    const embed = createBossEmbed(processedBossData, initialParticipationData)
    console.log(`📤 Sending boss notification for: ${processedBossData.monster}`)
    console.log(`📋 Embed has ${embed.data.fields?.length || 0} fields`)
    console.log(`⏰ Formatted time: ${formatRespawnTime(processedBossData)}`)
    console.log(`📅 Formatted date: ${formatDiscordDate(processedBossData)}`)
    console.log(`🕐 Calculated respawn time: ${calculateRespawnTime(processedBossData)?.toISOString() || 'null'}`)

    const message = await channel.send({ embeds: [embed] })

    await message.react('✅')
    await message.react('❌')

    participationData.set(message.id, initialParticipationData)
    // Store boss data for this message to enable respawn time updates
    messageBossData.set(message.id, processedBossData)

    console.log(`✅ Boss notification sent successfully! Message ID: ${message.id}`)

    console.log(`📢 Boss notification sent: ${bossData.monster}`)

    res.json({
      success: true,
      messageId: message.id,
      channelId: channel.id
    })
  } catch (error) {
    console.error('Error sending boss notification:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Start the server
async function startServer() {
  console.log('🚀 Starting Discord Bot Server...')
  
  // Initialize Discord bot
  const botInitialized = await initializeDiscordBot()
  
  if (!botInitialized) {
    console.error('❌ Failed to initialize Discord bot. Server will still start but Discord features will be unavailable.')
  }

  // Start Express server
  app.listen(PORT, () => {
    console.log(`🌐 Discord Bot Server running on port ${PORT}`)
    console.log(`📡 API endpoint: http://localhost:${PORT}/api/send-boss`)
    console.log(`📊 Status endpoint: http://localhost:${PORT}/api/status`)
    
    if (botInitialized) {
      console.log('✅ Discord bot is ready to send notifications!')
    }
  })
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Discord Bot Server...')
  
  if (discordClient) {
    await discordClient.destroy()
    console.log('🤖 Discord bot disconnected')
  }
  
  process.exit(0)
})

// Start the server
startServer().catch(console.error)
