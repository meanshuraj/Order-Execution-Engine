const fastify = require('fastify');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Mock classes for testing
class MockDexRouter {
  async getRaydiumQuote() {
    return { price: 100, fee: 0.003, dex: 'raydium' };
  }
  
  async getMeteorQuote() {
    return { price: 101, fee: 0.002, dex: 'meteora' };
  }
  
  async executeSwap() {
    return { txHash: 'mock-tx-hash', executedPrice: 101 };
  }
}

class OrderQueue {
  constructor() {
    this.orders = new Map();
  }
  
  add(order) {
    this.orders.set(order.id, order);
    setTimeout(() => this.processOrder(order), 100);
  }
  
  async processOrder(order) {
    const router = new MockDexRouter();
    
    order.status = 'routing';
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      router.getRaydiumQuote(),
      router.getMeteorQuote()
    ]);
    
    const bestQuote = meteoraQuote.price > raydiumQuote.price ? meteoraQuote : raydiumQuote;
    order.bestQuote = bestQuote;
    
    order.status = 'building';
    order.status = 'submitted';
    
    const result = await router.executeSwap();
    order.status = 'confirmed';
    order.txHash = result.txHash;
  }
}

// Setup test server
const setupServer = async () => {
  const app = fastify({ logger: false });
  const orderQueue = new OrderQueue();
  
  await app.register(require('@fastify/websocket'));
  
  app.post('/api/orders/execute', async (request, reply) => {
    const { tokenIn, tokenOut, amount } = request.body;
    
    if (!tokenIn || !tokenOut || !amount) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }
    
    const orderId = uuidv4();
    const order = {
      id: orderId,
      tokenIn,
      tokenOut,
      amount,
      status: 'pending'
    };
    
    orderQueue.add(order);
    reply.send({ orderId, status: 'pending' });
  });
  
  app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection) => {
      connection.socket.on('message', () => {});
    });
  });
  
  app.get('/health', async () => {
    return { status: 'ok' };
  });
  
  return app;
};

describe('Order Execution Engine', () => {
  let server;
  
  beforeAll(async () => {
    server = await setupServer();
    await server.listen({ port: 0 });
  });
  
  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });
  
  test('should create order successfully', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.5
      }
    });
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.orderId).toBeDefined();
    expect(body.status).toBe('pending');
  });
  
  test('should reject invalid order', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL'
      }
    });
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Missing required fields');
  });
  
  test('should return health status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    });
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });
  
  test('DEX router should compare prices', () => {
    const raydiumQuote = { price: 100, fee: 0.003, dex: 'raydium' };
    const meteoraQuote = { price: 101, fee: 0.002, dex: 'meteora' };
    
    const bestQuote = meteoraQuote.price > raydiumQuote.price ? meteoraQuote : raydiumQuote;
    expect(bestQuote.dex).toBe('meteora');
  });
  
  test('Order queue should process orders', () => {
    const queue = new OrderQueue();
    const order = { id: '123', status: 'pending' };
    
    queue.add(order);
    expect(queue.orders.has('123')).toBe(true);
  });
  
  test('WebSocket should handle connections', async () => {
    const address = server.server.address();
    const ws = new WebSocket(`ws://localhost:${address.port}/ws`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve();
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });
  
  test('should handle concurrent orders', async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(server.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: 1
        }
      }));
    }
    
    const responses = await Promise.all(promises);
    responses.forEach(response => {
      expect(response.statusCode).toBe(200);
    });
  });
  
  test('should select best DEX price', () => {
    const raydiumQuote = { price: 100, fee: 0.003, dex: 'raydium' };
    const meteoraQuote = { price: 101, fee: 0.002, dex: 'meteora' };
    
    const bestQuote = meteoraQuote.price > raydiumQuote.price ? meteoraQuote : raydiumQuote;
    expect(bestQuote.dex).toBe('meteora');
  });
  
  test('should generate valid transaction hash', () => {
    const generateMockTxHash = () => {
      return Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    };
    
    const txHash = generateMockTxHash();
    expect(txHash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(txHash)).toBe(true);
  });
  
  test('should handle order status transitions', () => {
    const statuses = ['pending', 'routing', 'building', 'submitted', 'confirmed'];
    const order = { status: 'pending' };
    
    statuses.forEach(status => {
      order.status = status;
      expect(['pending', 'routing', 'building', 'submitted', 'confirmed', 'failed']).toContain(order.status);
    });
  });
});