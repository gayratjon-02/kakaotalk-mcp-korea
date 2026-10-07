import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAccountTools } from '../tool/account-tools.js';
import { registerFileTools } from '../tool/file-tools.js';
import { registerMessageActionTools } from '../tool/message-action-tools.js';
import { registerImageTools } from '../tool/image-tools.js';
import { registerInsightTools } from '../tool/insight-tools.js';
import { registerReadTools } from '../tool/read-tools.js';
import { registerStreamTools } from '../tool/stream-tools.js';
import { registerSendTool } from '../tool/send-tool.js';
import { logger } from './logger.js';
import { buildInstructions } from './server-instructions.js';

export async function startMcpServer(): Promise<void> {
	const server = new McpServer({ name: 'kakaotalk-mcp-korea', version: '0.1.0' }, { instructions: buildInstructions() });
	registerReadTools(server);
	registerInsightTools(server);
	registerStreamTools(server);
	registerFileTools(server);
	registerImageTools(server);
	registerAccountTools(server);
	registerMessageActionTools(server);
	registerSendTool(server);
	await server.connect(new StdioServerTransport());
	logger.info('mcp server ready');
}
