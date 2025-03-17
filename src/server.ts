import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { IncomingMessage, ServerResponse } from "http";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export const Logger = {
  log: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
};

export class TestMcpServer {
  private readonly server: McpServer;
  private sseTransport: SSEServerTransport | null = null;

  constructor() {
    this.server = new McpServer(
      {
        name: "Test MCP Server",
        version: "0.1.0",
      },
      {
        capabilities: {
          logging: {},
          tools: {},
        },
      }
    );

    this.registerTools();
  }

  private registerTools(): void {
    // Tool 1: Simple calculator
    this.server.tool(
      "calculate",
      "Perform basic arithmetic operations",
      {
        operation: z.enum(["add", "subtract", "multiply", "divide"]),
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      },
      async ({ operation, a, b }) => {
        try {
          let result: number;
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
              if (b === 0) throw new Error("Division by zero");
              result = a / b;
              break;
          }
          return {
            content: [{ type: "text", text: `Result: ${result}` }],
          };
        } catch (error) {
          Logger.error(`Calculation error:`, error);
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
          };
        }
      }
    );

    // Tool 2: Text transformer
    this.server.tool(
      "transform_text",
      "Transform text using various operations",
      {
        text: z.string().describe("Input text to transform"),
        operation: z.enum(["uppercase", "lowercase", "reverse"]),
      },
      async ({ text, operation }) => {
        try {
          let result: string;
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
        } catch (error) {
          Logger.error(`Text transformation error:`, error);
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
          };
        }
      }
    );

    // Tool 3: Text Analyzer
    this.server.tool(
      "analyze_text",
      "Analyze text and provide various statistics",
      {
        text: z.string().describe("Text to analyze"),
        analysis_types: z.array(z.enum([
          "word_count",
          "character_count",
          "sentence_count",
          "average_word_length",
          "most_common_words"
        ])).describe("Types of analysis to perform")
      },
      async ({ text, analysis_types }) => {
        try {
          const results: Record<string, any> = {};

          for (const analysis of analysis_types) {
            switch (analysis) {
              case "word_count":
                results.word_count = text.split(/\s+/).filter(word => word.length > 0).length;
                break;
              case "character_count":
                results.character_count = text.replace(/\s/g, '').length;
                break;
              case "sentence_count":
                results.sentence_count = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
                break;
              case "average_word_length":
                const words = text.split(/\s+/).filter(word => word.length > 0);
                results.average_word_length = words.reduce((sum, word) => sum + word.length, 0) / words.length;
                break;
              case "most_common_words":
                const wordFrequency = new Map<string, number>();
                text.toLowerCase().split(/\s+/)
                  .filter(word => word.length > 0)
                  .forEach(word => {
                    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
                  });
                results.most_common_words = Array.from(wordFrequency.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5);
                break;
            }
          }

          return {
            content: [{ 
              type: "text", 
              text: `Analysis Results:\n${JSON.stringify(results, null, 2)}` 
            }],
          };
        } catch (error) {
          Logger.error(`Text analysis error:`, error);
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
          };
        }
      }
    );

    // Tool 4: Data Validator
    this.server.tool(
      "validate_data",
      "Validate data against predefined schemas",
      {
        schema_type: z.enum(["email", "phone", "url", "date", "credit_card"]),
        data: z.string().describe("Data to validate"),
        options: z.object({
          strict: z.boolean().optional(),
          region: z.string().optional()
        }).optional()
      },
      async ({ schema_type, data, options }) => {
        try {
          const patterns = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            phone: /^\+?[\d\s-]{10,}$/,
            url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/,
            date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
            credit_card: /^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/
          };

          const isValid = patterns[schema_type].test(data);
          let details = "";

          if (isValid) {
            switch (schema_type) {
              case "email":
                const [local, domain] = data.split("@");
                details = `Local part: ${local}, Domain: ${domain}`;
                break;
              case "date":
                const date = new Date(data);
                details = `Day: ${date.getDate()}, Month: ${date.getMonth() + 1}, Year: ${date.getFullYear()}`;
                break;
              // Add more specific validations as needed
            }
          }

          return {
            content: [{ 
              type: "text", 
              text: `Validation Results:\n` +
                    `Valid: ${isValid}\n` +
                    `Schema: ${schema_type}\n` +
                    `${details ? `Details: ${details}` : ''}`
            }],
          };
        } catch (error) {
          Logger.error(`Validation error:`, error);
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
          };
        }
      }
    );
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
    Logger.log("Server connected and ready to process requests");
  }

  async startHttpServer(port: number): Promise<void> {
    const app = express();

    app.get("/sse", async (req: Request, res: Response) => {
      Logger.log("New SSE connection established");
      this.sseTransport = new SSEServerTransport(
        "/messages",
        res as unknown as ServerResponse<IncomingMessage>
      );
      await this.server.connect(this.sseTransport);
    });

    app.post("/messages", async (req: Request, res: Response) => {
      if (!this.sseTransport) {
        res.sendStatus(400);
        return;
      }
      await this.sseTransport.handlePostMessage(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse<IncomingMessage>
      );
    });

    app.listen(port, () => {
      Logger.log(`HTTP server listening on port ${port}`);
      Logger.log(`SSE endpoint available at http://localhost:${port}/sse`);
      Logger.log(`Message endpoint available at http://localhost:${port}/messages`);
    });
  }
} 