const WebSocket = require('ws');

// Test client to demonstrate order execution
async function testOrderExecution() {
  console.log('🚀 Testing Order Execution Engine\n');
  
  // Connect WebSocket first
  const ws = new WebSocket('ws://localhost:3000/ws');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    submitTestOrders();
  });
  
  ws.on('message', (data) => {
    const update = JSON.parse(data.toString());
    console.log(`📊 Order ${update.orderId.substring(0, 8)}: ${update.status}${update.selectedDex ? ` (${update.selectedDex})` : ''}${update.txHash ? ` - TX: ${update.txHash.substring(0, 16)}...` : ''}`);
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
  
  async function submitTestOrders() {
    console.log('\n📝 Submitting 5 test orders...\n');
    
    const orders = [
      { tokenIn: 'SOL', tokenOut: 'USDC', amount: 1.5 },
      { tokenIn: 'USDC', tokenOut: 'SOL', amount: 150 },
      { tokenIn: 'SOL', tokenOut: 'USDT', amount: 2.0 },
      { tokenIn: 'USDT', tokenOut: 'SOL', amount: 200 },
      { tokenIn: 'USDC', tokenOut: 'USDT', amount: 100 }
    ];
    
    for (let i = 0; i < orders.length; i++) {
      try {
        const response = await fetch('http://localhost:3000/api/orders/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...orders[i], orderType: 'market' })
        });
        
        const result = await response.json();
        console.log(`✅ Order ${i + 1} submitted: ${result.orderId.substring(0, 8)} (${orders[i].tokenIn} → ${orders[i].tokenOut})`);
        
        // Small delay between orders
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to submit order ${i + 1}:`, error.message);
      }
    }
  }
  
  // Close connection after 30 seconds
  setTimeout(() => {
    console.log('\n🔚 Test completed');
    ws.close();
    process.exit(0);
  }, 30000);
}

// Check if server is running
fetch('http://localhost:3000/health')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Server health check passed:', data.status);
    testOrderExecution();
  })
  .catch(error => {
    console.error('❌ Server not running. Please start with: npm start');
    process.exit(1);
  });