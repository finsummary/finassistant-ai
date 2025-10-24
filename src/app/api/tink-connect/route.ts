import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const clientId = process.env.NEXT_PUBLIC_TINK_CLIENT_ID
    const redirectUri = process.env.NEXT_PUBLIC_TINK_REDIRECT_URI || 'http://localhost:3004/dashboard'
    if (!clientId || !redirectUri) {
      return NextResponse.json({ ok: false, error: 'Missing NEXT_PUBLIC_TINK_CLIENT_ID or NEXT_PUBLIC_TINK_REDIRECT_URI' }, { status: 200 })
    }

    const scopes = [
      'accounts:read',
      'balances:read',
      'transactions:read',
      'providers:read',
      'authorization:grant'
    ].join(' ')

    const market = process.env.NEXT_PUBLIC_TINK_MARKET || 'SE'
    const locale = process.env.NEXT_PUBLIC_TINK_LOCALE || 'en_US'

    const testFlag = (process.env.NEXT_PUBLIC_TINK_TEST ?? 'true').toString().toLowerCase() === 'true'

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      market,
      locale,
      test: String(testFlag),
      response_type: 'code'
    })

    const link = `https://link.tink.com/1.0/authorize?${params.toString()}`
    return NextResponse.json({ ok: true, link }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 200 })
  }
}


