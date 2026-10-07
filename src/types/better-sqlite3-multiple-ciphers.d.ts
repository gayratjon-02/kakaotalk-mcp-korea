declare module 'better-sqlite3-multiple-ciphers' {
	namespace Database {
		interface Statement {
			get(...params: unknown[]): unknown;
			all(...params: unknown[]): unknown[];
		}
		interface Database {
			pragma(source: string): unknown;
			prepare(source: string): Statement;
			close(): this;
		}
	}
	interface DatabaseConstructor {
		new (file: string, options?: { readonly?: boolean; fileMustExist?: boolean }): Database.Database;
	}
	const Database: DatabaseConstructor;
	export default Database;
}
