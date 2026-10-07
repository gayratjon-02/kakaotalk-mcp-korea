declare module 'better-sqlite3-multiple-ciphers' {
	namespace Database {
		interface RunResult {
			changes: number;
			lastInsertRowid: number | bigint;
		}
		interface Statement {
			get(...params: unknown[]): unknown;
			all(...params: unknown[]): unknown[];
			run(...params: unknown[]): RunResult;
		}
		interface Database {
			pragma(source: string): unknown;
			prepare(source: string): Statement;
			exec(source: string): this;
			close(): this;
		}
	}
	interface DatabaseConstructor {
		// a bare ":memory:" path with no options opens a plain, unencrypted in-memory database (used by tests)
		new (file: string, options?: { readonly?: boolean; fileMustExist?: boolean }): Database.Database;
	}
	const Database: DatabaseConstructor;
	export default Database;
}
