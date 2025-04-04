# Glutamate Test MCP Server

This repository contains test MCP (Model Context Protocol) server implementations designed to be used with Cursor IDE and similar tools.

## Overview

Glutamate Test MCP Server provides example implementations of MCP servers for various use cases, including:

- **PostgreSQL database access**: Connect to a PostgreSQL database, list tables, and execute SQL queries
- **Sequential thinking**: Implement step-by-step reasoning capabilities

## Prerequisites

- Node.js (v16 or higher recommended)
- pnpm (v10.7.1 or later)
- PostgreSQL (for the postgres server implementation)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ShadowCloneLabs/glutamate_testmcpserver.git
cd glutamate_testmcpserver
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build the project

```bash
pnpm run build
```

### 4. Run a specific server implementation

For PostgreSQL:

```bash
cd src/postgres
pnpm start -- --port 4002 --database-url postgresql://username:password@localhost:5432/your_database
```

For Sequential Thinking:

```bash
cd src/sequential-thinking
pnpm start
```

## Connecting to Cursor

Cursor supports MCP servers, which allows it to extend AI capabilities using external services. Here's how to connect:

1. Create or edit the `.cursor/mcp.json` file in your home directory:

```json
{
  "mcpServers": {
    "server-name": {
      "url": "http://localhost:4002/sse"
    }
  }
}
```

2. Restart Cursor to apply the changes

3. When using AI features in Cursor, it will now be able to access the capabilities provided by your MCP server

## Example Capabilities

### PostgreSQL Server

The PostgreSQL server provides the following capabilities:

- List all tables in a database
- Get schema information for a specific table
- Execute read-only SQL queries against the database

### Sequential Thinking Server

The Sequential Thinking server enables step-by-step reasoning for complex problems, allowing the LLM to:

- Break down complex tasks into discrete steps
- Execute each step and track progress
- Build on previous steps to solve multi-stage problems

## Development

### Project Structure

```
glutamate_testmcpserver/
├── src/
│   ├── postgres/           # PostgreSQL MCP server implementation
│   └── sequential-thinking/ # Sequential thinking MCP server
├── package.json            # Root package configuration
└── tsconfig.json           # TypeScript configuration
```

### Building and Testing

- Build all workspaces: `pnpm run build`
- Watch mode (development): `pnpm run watch`

## Example: How Cursor Uses It

Cursor IDE integrates with MCP servers to extend AI capabilities. When you ask Cursor to perform a task that requires database access (with the PostgreSQL MCP server configured), it:

1. Connects to your configured MCP server
2. The MCP server authenticates and establishes a connection to your database
3. Cursor can now request schema information and run queries against your database
4. Results are presented directly in the Cursor interface

For example, you might ask:

> "Show me the schema of the users table and get the count of active users"

Cursor would use the MCP server to:

1. Retrieve the schema for the users table
2. Execute `SELECT COUNT(*) FROM users WHERE status = 'active'`
3. Present the results to you

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC License
