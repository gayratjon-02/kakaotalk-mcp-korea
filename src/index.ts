#!/usr/bin/env node
import { startMcpServer } from './libs/server/mcp-server.js';
import { logger } from './libs/server/logger.js';

startMcpServer().catch((error) => {
	logger.error('failed to start', { error: error instanceof Error ? error.message : String(error) });
	process.exit(1);
});
