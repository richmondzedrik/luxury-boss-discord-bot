# Discord Bot Deployment

## Files in this directory:
- discord-bot-server.js - Main bot server
- package.json - Dependencies and scripts
- railway.json - Railway deployment config
- Procfile - Heroku/Render deployment config
- .env.example - Environment variables template

## Deployment Steps:

### Railway (Recommended):
1. Create account at https://railway.app/
2. Create new project from GitHub repo
3. Upload these files to your repo
4. Set environment variables in Railway dashboard
5. Deploy automatically

### Render:
1. Create account at https://render.com/
2. Create new Web Service
3. Connect your GitHub repo with these files
4. Set environment variables
5. Deploy

## Environment Variables to Set:
- DISCORD_BOT_TOKEN (from Discord Developer Portal)
- DISCORD_CHANNEL_ID (your Discord channel ID)
- NODE_ENV=production

## After Deployment:
Update your website's VITE_DISCORD_BOT_API_URL to point to your deployed bot URL.
