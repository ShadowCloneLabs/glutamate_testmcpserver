import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import { IncomingMessage, ServerResponse } from "http";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";

export const Logger = {
  log: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
};

const SCHEMA_PATH = "schema";

/**
 * PostgreSQL database service that handles actual database operations
 */
class PostgresDatabaseService {
  private pool: pg.Pool;
  private resourceBaseUrl: URL;

  constructor(databaseUrl: string) {
    this.resourceBaseUrl = new URL(databaseUrl);
    this.resourceBaseUrl.protocol = "postgres:";
    this.resourceBaseUrl.password = "";

    this.pool = new pg.Pool({
      connectionString: databaseUrl,
    });
  }

  async listResources() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      return {
        resources: result.rows.map((row) => ({
          uri: new URL(`${row.table_name}/${SCHEMA_PATH}`, this.resourceBaseUrl)
            .href,
          mimeType: "application/json",
          name: `"${row.table_name}" database schema`,
        })),
      };
    } finally {
      client.release();
    }
  }

  async readResource(uri: string) {
    const resourceUrl = new URL(uri);

    const pathComponents = resourceUrl.pathname.split("/");
    const schema = pathComponents.pop();
    const tableName = pathComponents.pop();

    if (schema !== SCHEMA_PATH) {
      throw new Error("Invalid resource URI");
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
        [tableName]
      );

      return {
        contents: [
          {
            uri: uri,
            mimeType: "application/json",
            text: JSON.stringify(result.rows, null, 2),
          },
        ],
      };
    } finally {
      client.release();
    }
  }

  async executeQuery(sql: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(sql);
      return result.rows;
    } catch (error) {
      throw error;
    } finally {
      client
        .query("ROLLBACK")
        .catch((error) =>
          Logger.error("Could not roll back transaction:", error)
        );

      client.release();
    }
  }
}

export class PostgresHttpServer {
  private readonly server: McpServer;
  private sseTransport: SSEServerTransport | null = null;
  private dbService: PostgresDatabaseService;

  constructor(databaseUrl: string) {
    this.server = new McpServer(
      {
        name: "example-servers/postgres",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.dbService = new PostgresDatabaseService(databaseUrl);
    this.registerTools();
  }

  private registerTools(): void {
    // Register SQL query tool
    this.server.tool(
      "query",
      "Run a read-only SQL query",
      {
        sql: z.string().describe("SQL query to execute"),
      },
      async (params) => {
        const rows = await this.dbService.executeQuery(params.sql);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      }
    );

    // Register list resources tool
    this.server.tool(
      "listResources",
      "List all database tables",
      {},
      async () => {
        const result = await this.dbService.listResources();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Register read resource tool
    this.server.tool(
      "readResource",
      "Read schema information about a table",
      {
        uri: z.string().describe("Resource URI"),
      },
      async (params) => {
        const result = await this.dbService.readResource(params.uri);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
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
        res.status(400).send("No SSE connection established");
        return;
      }
      await this.sseTransport.handlePostMessage(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse<IncomingMessage>
      );
    });

    app.listen(port, () => {
      Logger.log(`PostgreSQL MCP Server listening on port ${port}`);
      Logger.log(`SSE endpoint available at http://localhost:${port}/sse`);
      Logger.log(
        `Message endpoint available at http://localhost:${port}/messages`
      );
    });
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error("Please provide a database URL as a command-line argument");
      process.exit(1);
    }

    const databaseUrl = args[0];
    const port = args[1] ? parseInt(args[1]) : 4003;

    const server = new PostgresHttpServer(databaseUrl);
    await server.startHttpServer(port);
  } catch (error) {
    Logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Run the server if this file is executed directly
if (require.main === module) {
  main();
}
