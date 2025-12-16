const fastify = require('fastify')({ logger: true });
const { v4: uuidv4 } = require('uuid');

// Register CORS
fastify.register(require('@fastify/cors'), {
  origin: true
});

// Mock DEX Router
class MockDexRouter {
  async getRaydiumQuote(tokenIn, tokenOut, amount) {
    await this.sleep(200);
    const basePrice = 100 + Math.random() * 10;
    return { 
      price: basePrice * (0.98 + Math.random() * 0.04), 
      fee: 0.003,
      dex: 'raydium'
    };
  }
  
  async getMeteorQuote(tokenIn, tokenOut, amount) {
    await this.sleep(200);
    const basePrice = 100 + Math.random() * 10;
    return { 
      price: basePrice * (0.97 + Math.random() * 0.05), 
      fee: 0.002,
      dex: 'meteora'
    };
  }
  
  async executeSwap(dex, order) {
    await this.sleep(2000 + Math.random() * 1000);
    return { 
      txHash: this.generateMockTxHash(), 
      executedPrice: order.bestQuote.price,
      dex
    };
  }
  
  generateMockTxHash() {
    return Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Order Queue (simplified in-memory)
class OrderQueue {
  constructor() {
    this.orders = new Map();
    this.processing = new Set();
    this.maxConcurrent = 10;
  }
  
  add(order) {
    this.orders.set(order.id, order);
    this.processNext();
  }
  
  async processNext() {
    if (this.processing.size >= this.maxConcurrent) return;
    
    const pendingOrder = Array.from(this.orders.values())
      .find(order => order.status === 'pending' && !this.processing.has(order.id));
    
    if (pendingOrder) {
      this.processing.add(pendingOrder.id);
      this.processOrder(pendingOrder);
    }
  }
  
  async processOrder(order) {
    const router = new MockDexRouter();
    
    try {
      // Update status: routing
      order.status = 'routing';
      this.broadcastUpdate(order);
      
      // Get quotes from both DEXs
      const [raydiumQuote, meteoraQuote] = await Promise.all([
        router.getRaydiumQuote(order.tokenIn, order.tokenOut, order.amount),
        router.getMeteorQuote(order.tokenIn, order.tokenOut, order.amount)
      ]);
      
      // Select best quote
      const bestQuote = raydiumQuote.price > meteoraQuote.price ? raydiumQuote : meteoraQuote;
      order.bestQuote = bestQuote;
      
      console.log(`Order ${order.id}: Best price ${bestQuote.price} from ${bestQuote.dex}`);
      
      // Update status: building
      order.status = 'building';
      this.broadcastUpdate(order);
      
      await router.sleep(500); // Simulate transaction building
      
      // Update status: submitted
      order.status = 'submitted';
      this.broadcastUpdate(order);
      
      // Execute swap
      const result = await router.executeSwap(bestQuote.dex, order);
      
      // Update status: confirmed
      order.status = 'confirmed';
      order.txHash = result.txHash;
      order.executedPrice = result.executedPrice;
      this.broadcastUpdate(order);
      
    } catch (error) {
      order.status = 'failed';
      order.error = error.message;
      this.broadcastUpdate(order);
    } finally {
      this.processing.delete(order.id);
      this.processNext();
    }
  }
  
  broadcastUpdate(order) {
    // Broadcast to all connected WebSocket clients
    const update = {
      orderId: order.id,
      status: order.status,
      ...(order.txHash && { txHash: order.txHash }),
      ...(order.executedPrice && { executedPrice: order.executedPrice }),
      ...(order.error && { error: order.error }),
      ...(order.bestQuote && { selectedDex: order.bestQuote.dex })
    };
    
    fastify.websocketServer.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(update));
      }
    });
  }
}

const orderQueue = new OrderQueue();

// Register WebSocket
fastify.register(require('@fastify/websocket'));

// Routes
fastify.post('/api/orders/execute', async (request, reply) => {
  const { tokenIn, tokenOut, amount, orderType = 'market' } = request.body;
  
  if (!tokenIn || !tokenOut || !amount) {
    return reply.code(400).send({ error: 'Missing required fields' });
  }
  
  const orderId = uuidv4();
  const order = {
    id: orderId,
    tokenIn,
    tokenOut,
    amount,
    orderType,
    status: 'pending',
    createdAt: new Date()
  };
  
  orderQueue.add(order);
  
  reply.send({ orderId, status: 'pending' });
});

// WebSocket endpoint
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    connection.socket.on('message', message => {
      console.log('WebSocket message:', message.toString());
    });
    
    connection.socket.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });
});

// Health check
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date() };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Order Execution Engine running on port 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();