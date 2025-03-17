import { TestMcpServer } from "./server";
const PORT = 3000;
async function startServer() {
    const server = new TestMcpServer();
    console.log(`Initializing Test MCP Server in HTTP mode on port ${PORT}...`);
    await server.startHttpServer(PORT);
}
// Start the server
startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
