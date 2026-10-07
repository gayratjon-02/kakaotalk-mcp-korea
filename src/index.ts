#!/usr/bin/env node
import { runCli } from './libs/cli/cli.js';
import { logger } from './libs/server/logger.js';
import { startMcpServer } from './libs/server/mcp-server.js';

const args = process.argv.slice(2);

if (args.length > 0) {
	await runCli(args);
} else {
	startMcpServer().catch((error) => {
		logger.error('failed to start', { error: error instanceof Error ? error.message : String(error) });
		process.exit(1);
	});
}
