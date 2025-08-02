#!/usr/bin/env node

console.log('🧪 Testing Respawn Time Fix...')

// Helper function to calculate respawn time (same logic as the fixed Discord bot)
function calculateRespawnTime(boss) {
  // ALWAYS prioritize respawn_time from API if it exists (regardless of past/future)
  // This ensures Discord bot matches the website's display
  if (boss.respawn_time) {
    const respawnDate = new Date(boss.respawn_time)
    if (!isNaN(respawnDate.getTime())) {
      console.log(`🕐 Using API respawn_time for ${boss.monster}: ${boss.respawn_time}`)
      return respawnDate
    }
  }

  // Fallback: calculate from time_of_death + respawn_hours only if respawn_time is not available
  if (boss.time_of_death && boss.respawn_hours) {
    const deathTime = new Date(boss.time_of_death)
    if (!isNaN(deathTime.getTime())) {
      const respawnTime = new Date(deathTime.getTime() + (boss.respawn_hours * 60 * 60 * 1000))
      console.log(`🕐 Calculated respawn time for ${boss.monster}: ${respawnTime.toISOString()}`)
      return respawnTime
    }
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

  console.log(`📊 Time calculation for ${boss.monster}:`)
  console.log(`   Respawn Date: ${respawnDate.toISOString()}`)
  console.log(`   Current Time: ${now.toISOString()}`)
  console.log(`   Difference (ms): ${diffInMs}`)
  console.log(`   Difference (minutes): ${Math.floor(diffInMs / (1000 * 60))}`)

  // If the time has passed (boss is available now)
  if (diffInMs <= 0) {
    return 'Available Now!'
  }

  // Calculate remaining time
  const hours = Math.floor(diffInMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60))

  return `${hours}h ${minutes}m`
}

// Test with the exact data you provided
const testBoss = {
  "id": "timitris",
  "name": "Floran Fields",
  "respawn_hours": 8,
  "respawn_time": "2025-07-31T01:10:00",
  "notified": true,
  "image_url": "https://mtnnhtajjcrgcfftukci.supabase.co/storage/v1/object/public/monster//timitris.png",
  "monster": "Timitris",
  "notes": "red",
  "points": 500,
  "last_stale_notified_time": null,
  "status": "PENDING",
  "failed_attempts": 0,
  "time_of_death": "2025-07-31T01:10:00",
  "display_image": "https://mtnnhtajjcrgcfftukci.supabase.co/storage/v1/object/public/monster//image%20(58).png"
}

console.log('\n🎯 Testing with your boss data:')
console.log('Boss:', testBoss.monster)
console.log('API respawn_time:', testBoss.respawn_time)
console.log('time_of_death:', testBoss.time_of_death)
console.log('respawn_hours:', testBoss.respawn_hours)

const result = formatRespawnTime(testBoss)
console.log('\n✨ RESULT:', result)

console.log('\n📋 Expected: "Available Now!" (since 2025-07-31T01:10:00 is in the past)')
console.log('📋 Actual  :', result)

if (result === 'Available Now!') {
  console.log('✅ SUCCESS: Discord bot will now show "Available Now!" matching the website!')
} else {
  console.log('❌ ISSUE: Result does not match expected "Available Now!"')
}

console.log('\n🔄 This fix ensures Discord bot always uses respawn_time from API first, matching website behavior.')
