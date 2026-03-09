import type { PageContextServer } from 'vike/types'

export type Data = {
  user: { authenticated: boolean; username: string } | null
}

export async function data(pageContext: PageContextServer): Promise<Data> {
  // globalThis로 서버 함수 참조 (Rollup 빌드 에러 회피)
  const validateSession = (globalThis as any).__owmValidateSession as
    ((token: string) => Promise<{ userId: number; username: string } | null>) | undefined

  const runtime = (pageContext as any).runtime
  const req = runtime?.req
  const token = req?.cookies?.owm_session || parseCookie(req?.headers?.cookie, 'owm_session')

  if (!token || !validateSession) {
    return { user: null }
  }

  const session = await validateSession(token)
  if (!session) {
    return { user: null }
  }

  return {
    user: {
      authenticated: true,
      username: session.username,
    },
  }
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match?.[1]
}
