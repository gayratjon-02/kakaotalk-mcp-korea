import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerReadTools } from '../tool/read-tools.js';
import { logger } from './logger.js';

export async function startMcpServer(): Promise<void> {
	const server = new McpServer({ name: 'kakaotalk-mcp-korea', version: '0.1.0' });
	registerReadTools(server);
	await server.connect(new StdioServerTransport());
	logger.info('mcp server ready');
}
