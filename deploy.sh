#!/bin/bash

echo "🚀 Deploying Order Execution Engine..."

# Install dependencies
npm install

# Run tests
echo "🧪 Running tests..."
npm test

if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
    
    # Start server
    echo "🌟 Starting server..."
    npm start
else
    echo "❌ Tests failed. Please fix before deploying."
    exit 1
fi