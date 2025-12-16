# Deployment Guide

## Local Development

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## Testing

```bash
# Run unit tests
npm test

# Test with client
node test-client.js

# Open HTML test client
open client-test.html
```

## Free Hosting Options

### 1. Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

### 2. Render
1. Connect GitHub repo to Render
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Deploy

### 3. Heroku
```bash
# Install Heroku CLI
heroku create order-execution-engine
git push heroku main
```

### 4. Vercel (Serverless)
```bash
npm install -g vercel
vercel --prod
```

## Environment Variables

No environment variables required for basic setup. All dependencies are mocked for simplicity.

## Production Considerations

For production deployment:
- Add Redis for queue management
- Add PostgreSQL for order persistence  
- Implement proper error handling
- Add rate limiting
- Use real DEX SDKs instead of mocks
- Add authentication/authorization