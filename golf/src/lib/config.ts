/**
 * Where the API lives.
 *
 * Defaults to the Supabase edge function, which holds the database credentials
 * inside Supabase — nothing sensitive reaches the browser. The publishable key
 * below is the browser-safe one and is designed to be shipped; it grants
 * nothing on its own, because the golf schema is not exposed through the
 * project API and the function is its only reader.
 *
 * Set VITE_API_BASE=/api to use the bundled Express server instead (the
 * self-contained Railway deploy).
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE ??
  'https://kpmamrhzubcawrdrfmpb.supabase.co/functions/v1/golf'

export const API_KEY =
  import.meta.env.VITE_API_KEY ?? 'sb_publishable_Z7Z78ipmchkXfixEe9yWsQ_b178kCf-'
