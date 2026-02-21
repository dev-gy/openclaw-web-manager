import type { FastifyPluginAsync } from 'fastify'
import { SSHManager } from '../services/ssh-manager.js'

const installRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/install/start
  fastify.post('/start', async (request, reply) => {
    const { host, port, username, authType, password, privateKey } = request.body as {
      host: string
      port: number
      username: string
      authType: 'password' | 'key'
      password?: string
      privateKey?: string
    }

    try {
      const ssh = new SSHManager({
        host,
        port: port || 22,
        username,
        ...(authType === 'password' ? { password } : { privateKey: privateKey || '' }),
      })

      await ssh.connect()

      // Pre-check
      const osInfo = await ssh.exec('cat /etc/os-release | head -3')
      const nodeVersion = await ssh.exec('node --version 2>/dev/null || echo "not-installed"')
      const ramInfo = await ssh.exec('free -h | head -2')

      ssh.close()

      return {
        success: true,
        precheck: {
          os: osInfo.stdout.trim(),
          nodeInstalled: !nodeVersion.stdout.includes('not-installed'),
          nodeVersion: nodeVersion.stdout.trim(),
          ram: ramInfo.stdout.trim(),
        },
      }
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || 'SSH connection failed',
      })
    }
  })

  // GET /api/install/status
  fastify.get('/status', async () => {
    // TODO: Phase 3 — Track install pipeline state
    return { status: 'idle' }
  })

  // POST /api/install/abort
  fastify.post('/abort', async () => {
    // TODO: Phase 3 — Abort running install
    return { success: true }
  })
}

export default installRoutes
