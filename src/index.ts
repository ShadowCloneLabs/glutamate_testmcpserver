import { SequentialThinkingHttpServer } from './server2.js';

async function main() {
  try {
    const server = new SequentialThinkingHttpServer();
    // Start the HTTP server on port 3000
    await server.startHttpServer(3002);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main(); 