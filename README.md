# Order Execution Engine

A DEX order execution engine that processes market orders with routing between Raydium and Meteora, providing real-time WebSocket updates.

## Order Type Choice: Market Orders

**Why Market Orders**: Market orders provide immediate execution at current market prices, making them ideal for demonstrating real-time DEX routing and WebSocket status updates without complex price monitoring logic.

**Extension to Other Types**: The engine can be extended to support limit orders by adding price monitoring loops, and sniper orders by implementing token launch detection and rapid execution triggers.

## Features

- Market order execution with DEX routing
- Real-time WebSocket status updates
- Mock DEX integration (Raydium & Meteora)
- Concurrent order processing (up to 10 orders)
- Automatic best price selection

## Setup

```bash
npm install
npm start
```

## API Usage

### Execute Order
```bash
POST /api/orders/execute
{
  "tokenIn": "SOL",
  "tokenOut": "USDC", 
  "amount": 1.5,
  "orderType": "market"
}
```

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Order update:', update);
};
```

## Order Status Flow

1. `pending` - Order received and queued
2. `routing` - Comparing DEX prices  
3. `building` - Creating transaction
4. `submitted` - Transaction sent to network
5. `confirmed` - Transaction successful (includes txHash)
6. `failed` - If any step fails (includes error)

## Architecture

- **FastifyJS**: HTTP server with built-in WebSocket support
- **Mock DEX Router**: Simulates Raydium/Meteora with realistic delays
- **In-Memory Queue**: Processes up to 10 concurrent orders
- **Real-time Updates**: WebSocket broadcasts for all order status changes

## Testing

```bash
npm test
```

## Deployment

Deploy to any Node.js hosting platform. The server runs on port 3000 by default.