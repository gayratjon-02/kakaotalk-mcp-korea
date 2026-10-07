import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerFileTools } from '../tool/file-tools.js';
import { registerInsightTools } from '../tool/insight-tools.js';
import { registerReadTools } from '../tool/read-tools.js';
import { registerStreamTools } from '../tool/stream-tools.js';
import { registerSendTool } from '../tool/send-tool.js';
import { logger } from './logger.js';

export async function startMcpServer(): Promise<void> {
	const server = new McpServer({ name: 'kakaotalk-mcp-korea', version: '0.1.0' });
	registerReadTools(server);
	registerInsightTools(server);
	registerStreamTools(server);
	registerFileTools(server);
	registerSendTool(server);
	await server.connect(new StdioServerTransport());
	logger.info('mcp server ready');
}
