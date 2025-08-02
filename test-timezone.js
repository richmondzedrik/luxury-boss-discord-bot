// Quick test script
process.env.TZ = 'Asia/Manila'

const now = new Date()
console.log('UTC:', now.toISOString())
console.log('Manila:', now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone)

// Test with 37 seconds from now
const testTime = new Date(now.getTime() + 37000)
console.log('Test time Manila:', testTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))