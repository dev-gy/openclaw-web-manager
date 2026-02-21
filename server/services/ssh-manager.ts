import { Client, type ConnectConfig } from 'ssh2'

interface SSHConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
}

interface ExecResult {
  stdout: string
  stderr: string
  code: number
}

/**
 * SSH connection manager using ssh2.
 * Each instance manages one connection to a target server.
 */
export class SSHManager {
  private conn: Client
  private config: ConnectConfig

  constructor(sshConfig: SSHConfig) {
    this.conn = new Client()
    this.config = {
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      ...(sshConfig.password
        ? { password: sshConfig.password }
        : { privateKey: sshConfig.privateKey }),
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSH connection timeout'))
      }, 15000)

      this.conn.on('ready', () => {
        clearTimeout(timeout)
        resolve()
      })

      this.conn.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      this.conn.connect(this.config)
    })
  }

  exec(command: string): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      this.conn.exec(command, (err, stream) => {
        if (err) return reject(err)

        let stdout = ''
        let stderr = ''

        stream.on('close', (code: number) => {
          resolve({ stdout, stderr, code: code ?? 0 })
        })

        stream.on('data', (data: Buffer) => {
          stdout += data.toString()
        })

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })
      })
    })
  }

  /**
   * Execute a command and stream output via callback.
   * Used for real-time progress during installation.
   */
  execStream(
    command: string,
    onData: (chunk: string, isStderr: boolean) => void
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.conn.exec(command, (err, stream) => {
        if (err) return reject(err)

        stream.on('close', (code: number) => {
          resolve(code ?? 0)
        })

        stream.on('data', (data: Buffer) => {
          onData(data.toString(), false)
        })

        stream.stderr.on('data', (data: Buffer) => {
          onData(data.toString(), true)
        })
      })
    })
  }

  close(): void {
    this.conn.end()
  }
}
