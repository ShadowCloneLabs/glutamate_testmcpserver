import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
export const Logger = {
    log: (...args) => console.log(...args),
    error: (...args) => console.error(...args),
};
export class TestMcpServer {
    server;
    sseTransport = null;
    constructor() {
        this.server = new McpServer({
            name: "Test MCP Server",
            version: "0.1.0",
        }, {
            capabilities: {
                logging: {},
                tools: {},
            },
        });
        this.registerTools();
    }
    registerTools() {
        // Tool 1: Simple calculator
        this.server.tool("calculate", "Perform basic arithmetic operations", {
            operation: z.enum(["add", "subtract", "multiply", "divide"]),
            a: z.number().describe("First number"),
            b: z.number().describe("Second number"),
        }, async ({ operation, a, b }) => {
            try {
                let result;
                switch (operation) {
                    case "add":
                        result = a + b;
                        break;
                    case "subtract":
                        result = a - b;
                        break;
                    case "multiply":
                        result = a * b;
                        break;
                    case "divide":
                        if (b === 0)
                            throw new Error("Division by zero");
                        result = a / b;
                        break;
                }
                return {
                    content: [{ type: "text", text: `Result: ${result}` }],
                };
            }
            catch (error) {
                Logger.error(`Calculation error:`, error);
                return {
                    content: [{ type: "text", text: `Error: ${error}` }],
                };
            }
        });
        // Tool 2: Text transformer
        this.server.tool("transform_text", "Transform text using various operations", {
            text: z.string().describe("Input text to transform"),
            operation: z.enum(["uppercase", "lowercase", "reverse"]),
        }, async ({ text, operation }) => {
            try {
                let result;
                switch (operation) {
                    case "uppercase":
                        result = text.toUpperCase();
                        break;
                    case "lowercase":
                        result = text.toLowerCase();
                        break;
                    case "reverse":
                        result = text.split("").reverse().join("");
                        break;
                }
                return {
                    content: [{ type: "text", text: result }],
                };
            }
            catch (error) {
                Logger.error(`Text transformation error:`, error);
                return {
                    content: [{ type: "text", text: `Error: ${error}` }],
                };
            }
        });
    }
    async connect(transport) {
        await this.server.connect(transport);
        Logger.log("Server connected and ready to process requests");
    }
    async startHttpServer(port) {
        const app = express();
        app.get("/sse", async (req, res) => {
            Logger.log("New SSE connection established");
            this.sseTransport = new SSEServerTransport("/messages", res);
            await this.server.connect(this.sseTransport);
        });
        app.post("/messages", async (req, res) => {
            if (!this.sseTransport) {
                res.sendStatus(400);
                return;
            }
            await this.sseTransport.handlePostMessage(req, res);
        });
        app.listen(port, () => {
            Logger.log(`HTTP server listening on port ${port}`);
            Logger.log(`SSE endpoint available at http://localhost:${port}/sse`);
            Logger.log(`Message endpoint available at http://localhost:${port}/messages`);
        });
    }
}
