declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): Database
    exec(sql: string, params?: any[]): QueryExecResult[]
    getRowsModified(): number
    close(): void
    export(): Uint8Array
  }

  export interface QueryExecResult {
    columns: string[]
    values: any[][]
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
  }

  export default function initSqlJs(config?: {
    locateFile?: (filename: string) => string
  }): Promise<SqlJsStatic>
}
