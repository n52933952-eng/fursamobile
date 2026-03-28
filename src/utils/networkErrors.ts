/**
 * Maps axios / network errors to user-visible text (cold start, timeouts, offline).
 */
export function getFriendlyApiError(err: unknown, isArabic: boolean, fallbackWrongCreds?: string): string {
  const e = err as any
  const server = e?.response?.data?.error
  if (typeof server === 'string' && server.trim()) return server

  const code = e?.code as string | undefined
  const msg = String(e?.message || '')

  if (code === 'ECONNABORTED' || /timeout/i.test(msg)) {
    return isArabic
      ? 'انتهى وقت الانتظار. إذا كان الخادم متوقفاً (مثل Render المجاني) انتظر دقيقة أو دقيقتين ثم اضغط إنشاء الحساب مرة أخرى.'
      : 'Request timed out. If the server was asleep (e.g. free Render), wait 1–2 minutes, then try again.'
  }

  if (code === 'ERR_NETWORK' || msg === 'Network Error') {
    return isArabic
      ? 'تعذر الاتصال بالخادم. تحقق من الإنترنت أو حاول بعد قليل عندما يكون الخادم نشطاً.'
      : 'Could not reach the server. Check your connection or try again in a minute when the server is awake.'
  }

  if (e?.response?.status >= 500) {
    return isArabic
      ? 'الخادم غير متاح مؤقتاً. حاول مرة أخرى بعد قليل.'
      : 'Server is temporarily unavailable. Please try again shortly.'
  }

  return fallbackWrongCreds ?? (isArabic ? 'حدث خطأ ما' : 'Something went wrong')
}
