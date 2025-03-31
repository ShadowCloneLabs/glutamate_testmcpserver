import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import chalk from 'chalk';
export const Logger = {
    log: (...args) => console.log(...args),
    error: (...args) => console.error(...args),
};
class SequentialThinkingServer {
    constructor() {
        this.thoughtHistory = [];
        this.branches = {};
    }
    validateThoughtData(input) {
        const data = input;
        if (!data.thought || typeof data.thought !== 'string') {
            throw new Error('Invalid thought: must be a string');
        }
        if (!data.thoughtNumber || typeof data.thoughtNumber !== 'number') {
            throw new Error('Invalid thoughtNumber: must be a number');
        }
        if (!data.totalThoughts || typeof data.totalThoughts !== 'number') {
            throw new Error('Invalid totalThoughts: must be a number');
        }
        if (typeof data.nextThoughtNeeded !== 'boolean') {
            throw new Error('Invalid nextThoughtNeeded: must be a boolean');
        }
        return {
            thought: data.thought,
            thoughtNumber: data.thoughtNumber,
            totalThoughts: data.totalThoughts,
            nextThoughtNeeded: data.nextThoughtNeeded,
            isRevision: data.isRevision,
            revisesThought: data.revisesThought,
            branchFromThought: data.branchFromThought,
            branchId: data.branchId,
            needsMoreThoughts: data.needsMoreThoughts,
        };
    }
    formatThought(thoughtData) {
        const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = thoughtData;
        let prefix = '';
        let context = '';
        if (isRevision) {
            prefix = chalk.yellow('🔄 Revision');
            context = ` (revising thought ${revisesThought})`;
        }
        else if (branchFromThought) {
            prefix = chalk.green('🌿 Branch');
            context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
        }
        else {
            prefix = chalk.blue('💭 Thought');
            context = '';
        }
        const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
        const border = '─'.repeat(Math.max(header.length, thought.length) + 4);
        return `
┌${border}┐
│ ${header} │
├${border}┤
│ ${thought.padEnd(border.length - 2)} │
└${border}┘`;
    }
    processThought(input) {
        try {
            const validatedInput = this.validateThoughtData(input);
            if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
                validatedInput.totalThoughts = validatedInput.thoughtNumber;
            }
            this.thoughtHistory.push(validatedInput);
            if (validatedInput.branchFromThought && validatedInput.branchId) {
                if (!this.branches[validatedInput.branchId]) {
                    this.branches[validatedInput.branchId] = [];
                }
                this.branches[validatedInput.branchId].push(validatedInput);
            }
            const formattedThought = this.formatThought(validatedInput);
            Logger.log(formattedThought);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            thoughtNumber: validatedInput.thoughtNumber,
                            totalThoughts: validatedInput.totalThoughts,
                            nextThoughtNeeded: validatedInput.nextThoughtNeeded,
                            branches: Object.keys(this.branches),
                            thoughtHistoryLength: this.thoughtHistory.length
                        }, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error),
                            status: 'failed'
                        }, null, 2)
                    }],
                isError: true
            };
        }
    }
}
export class SequentialThinkingHttpServer {
    constructor() {
        this.sseTransport = null;
        this.server = new McpServer({
            name: "Sequential Thinking MCP Server",
            version: "0.2.0",
        }, {
            capabilities: {
                logging: {},
                tools: {},
            },
        });
        this.thinkingServer = new SequentialThinkingServer();
        this.registerTools();
    }
    registerTools() {
        this.server.tool("sequentialthinking", `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.`, {
            thought: z.string().describe("Your current thinking step"),
            nextThoughtNeeded: z.boolean().describe("Whether another thought step is needed"),
            thoughtNumber: z.number().min(1).describe("Current thought number"),
            totalThoughts: z.number().min(1).describe("Estimated total thoughts needed"),
            isRevision: z.boolean().optional().describe("Whether this revises previous thinking"),
            revisesThought: z.number().min(1).optional().describe("Which thought is being reconsidered"),
            branchFromThought: z.number().min(1).optional().describe("Branching point thought number"),
            branchId: z.string().optional().describe("Branch identifier"),
            needsMoreThoughts: z.boolean().optional().describe("If more thoughts are needed")
        }, async (params) => {
            const result = this.thinkingServer.processThought(params);
            return {
                content: result.content.map(item => ({
                    type: "text",
                    text: item.text
                }))
            };
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
