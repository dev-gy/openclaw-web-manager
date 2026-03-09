import { redirect } from 'vike/abort'
import type { GuardAsync } from 'vike/types'

const publicRoutes = ['/login']

export const guard: GuardAsync = async (pageContext): ReturnType<GuardAsync> => {
  const { urlPathname } = pageContext

  if (publicRoutes.some((r) => urlPathname.startsWith(r))) {
    return
  }

  // 클라이언트 사이드 네비게이션: API로 인증 확인
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) throw redirect('/login')
    } catch (e) {
      if (e && typeof e === 'object' && '_isAbort' in e) throw e
      throw redirect('/login')
    }
    return
  }

  // 서버 사이드: 쿠키에서 세션 토큰 추출 → DB 검증 (globalThis로 Rollup 빌드 에러 회피)
  const validateSession = (globalThis as any).__owmValidateSession as
    ((token: string) => Promise<{ userId: number; username: string } | null>) | undefined
  const runtime = (pageContext as any).runtime
  const req = runtime?.req
  const token = req?.cookies?.owm_session || parseCookie(req?.headers?.cookie, 'owm_session')

  if (!token || !validateSession) {
    throw redirect('/login')
  }

  const session = await validateSession(token)
  if (!session) {
    throw redirect('/login')
  }
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match?.[1]
}
