import crypto from 'node:crypto'
import dotenv from 'dotenv'
import express from 'express'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve(process.cwd(), '.env.local')
dotenv.config({ path: envPath })
dotenv.config()

const app = express()
const port = Number(process.env.ESEWA_API_PORT ?? 3001)
const merchantCode = process.env.ESEWA_MERCHANT_CODE ?? process.env.VITE_ESEWA_MERCHANT_CODE ?? ''
const merchantSecret = process.env.ESEWA_MERCHANT_SECRET ?? ''
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5173'
const productCode = process.env.ESEWA_PRODUCT_CODE || process.env.VITE_ESEWA_PRODUCT_CODE || merchantCode || 'BIMCLUB'
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

app.use(express.json({ limit: '1mb' }))
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }
  next()
})

const createSignature = ({ totalAmount, transactionUuid, productCode, secret }) => {
  if (!secret) {
    throw new Error('ESEWA_MERCHANT_SECRET is not configured.')
  }

  return crypto
    .createHmac('sha256', secret)
    .update(`${totalAmount}|${transactionUuid}|${productCode}`)
    .digest('base64')
}

const getAuthenticatedUser = async (request) => {
  if (!supabaseAdmin) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for paid event registration.')
  const authorization = request.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) {
    const error = new Error('Sign in before paying for an event.')
    error.status = 401
    throw error
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    const authError = new Error('Your session is invalid or expired. Sign in again.')
    authError.status = 401
    throw authError
  }
  return data.user
}

const parseEsewaCallback = (encodedData) => {
  if (typeof encodedData !== 'string' || encodedData.length > 16_384) {
    throw new Error('Missing or invalid eSewa callback data.')
  }
  let payload
  try {
    payload = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf8'))
  } catch {
    throw new Error('The eSewa callback data could not be decoded.')
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The eSewa callback data is invalid.')
  }
  return payload
}

const verifyEsewaCallback = (payload) => {
  const signedFieldNames = String(payload.signed_field_names ?? '').split(',')
  const allowedFields = new Set(['transaction_code', 'status', 'total_amount', 'transaction_uuid', 'product_code'])
  const requiredFields = ['status', 'total_amount', 'transaction_uuid', 'product_code']
  if (
    signedFieldNames.length !== new Set(signedFieldNames).size
    || signedFieldNames.some((field) => !allowedFields.has(field) || typeof payload[field] !== 'string')
    || requiredFields.some((field) => !signedFieldNames.includes(field))
  ) {
    return false
  }

  const canonical = signedFieldNames.map((field) => `${field}=${payload[field]}`).join(',')
  const expectedSignature = crypto.createHmac('sha256', merchantSecret).update(canonical).digest('base64')
  const providedSignature = String(payload.signature ?? '')
  return providedSignature.length === expectedSignature.length
    && crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))
}

const buildEsewaResponse = ({
  amount,
  purpose,
  donorName,
  merchantCodeValue,
  productCodeValue,
  successUrl,
  failureUrl,
  transactionId,
  environment,
}) => {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('A positive donation amount is required before redirecting to eSewa.')
  }

  const totalAmount = numericAmount.toFixed(2)
  const productCode = productCodeValue || 'BIMCLUB'
  const uuid = transactionId || `bim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const signature = createSignature({
    totalAmount,
    transactionUuid: uuid,
    productCode,
    secret: merchantSecret,
  })

  return {
    formUrl: environment === 'production'
      ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
      : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
    payload: {
      amount: totalAmount,
      tax_amount: '0.00',
      total_amount: totalAmount,
      transaction_uuid: uuid,
      product_code: productCode,
      merchant_code: merchantCodeValue,
      product_service_charge: '0.00',
      product_service_charge_amount: '0.00',
      success_url: successUrl,
      failure_url: failureUrl,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature,
      purpose: purpose || 'Club donation',
      donor_name: donorName || 'BIM Club member',
    },
  }
}

app.get('/api/esewa/health', (_request, response) => {
  response.json({
    ok: true,
    merchantConfigured: Boolean(merchantCode && merchantSecret),
    port,
  })
})

app.post('/api/esewa/create-payment', (request, response) => {
  try {
    const payload = request.body ?? {}
    if (payload.eventId) {
      void (async () => {
        try {
          if (!merchantCode || !merchantSecret) {
            response.status(400).json({ message: 'Configure ESEWA_MERCHANT_CODE and ESEWA_MERCHANT_SECRET before accepting payments.' })
            return
          }
          const user = await getAuthenticatedUser(request)
          const transactionId = crypto.randomUUID()
          const { data: expectedAmount, error: intentError } = await supabaseAdmin.rpc('create_event_payment_intent', {
            target_event_id: String(payload.eventId),
            target_member_id: user.id,
            target_transaction_uuid: transactionId,
          })
          if (intentError) throw intentError

          const result = buildEsewaResponse({
            amount: Number(expectedAmount),
            purpose: String(payload.purpose || 'Event registration'),
            donorName: String(payload.donorName || 'BIM Club member'),
            merchantCodeValue: merchantCode,
            productCodeValue: productCode,
            successUrl: `${appBaseUrl}/?event_payment=success&event_id=${encodeURIComponent(String(payload.eventId))}`,
            failureUrl: `${appBaseUrl}/?event_payment=failed&event_id=${encodeURIComponent(String(payload.eventId))}`,
            transactionId,
            environment: String(payload.environment ?? process.env.VITE_ESEWA_ENV ?? 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox',
          })
          response.json(result)
        } catch (error) {
          response.status(error?.status ?? 400).json({
            message: error instanceof Error ? error.message : 'Unable to prepare the eSewa event payment.',
          })
        }
      })()
      return
    }

    const amount = Number(payload.amount)
    const { purpose = 'Club donation', donorName = 'BIM Club member', merchantCodeValue = merchantCode, productCodeValue = process.env.VITE_ESEWA_PRODUCT_CODE || 'BIMCLUB', successUrl, failureUrl, transactionId, environment = process.env.VITE_ESEWA_ENV ?? 'sandbox' } = payload

    if (!merchantCodeValue) {
      response.status(400).json({ message: 'ESEWA_MERCHANT_CODE is missing. Set it in .env.local before starting the payment flow.' })
      return
    }

    if (!merchantSecret) {
      response.status(400).json({ message: 'ESEWA_MERCHANT_SECRET is missing. Add it to the backend environment before making a live payment.' })
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      response.status(400).json({ message: 'The donation amount must be a positive number.' })
      return
    }

    const result = buildEsewaResponse({
      amount,
      purpose: String(purpose),
      donorName: String(donorName),
      merchantCodeValue: String(merchantCodeValue),
      productCodeValue: String(productCodeValue),
      successUrl: String(successUrl || process.env.VITE_ESEWA_SUCCESS_URL || 'http://localhost:5173/donations?payment=success'),
      failureUrl: String(failureUrl || process.env.VITE_ESEWA_FAILURE_URL || 'http://localhost:5173/donations?payment=failed'),
      transactionId: String(transactionId || `bim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
      environment: String(environment).toLowerCase() === 'production' ? 'production' : 'sandbox',
    })

    response.json(result)
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : 'Unable to create the eSewa payment request.',
    })
  }
})

app.post('/api/esewa/complete-event-payment', async (request, response) => {
  try {
    if (!merchantSecret) {
      response.status(400).json({ message: 'ESEWA_MERCHANT_SECRET is not configured. Payment verification cannot continue.' })
      return
    }
    const user = await getAuthenticatedUser(request)
    const payload = parseEsewaCallback(request.body?.data)
    if (!verifyEsewaCallback(payload)) {
      response.status(400).json({ message: 'The eSewa payment signature is invalid.' })
      return
    }
    if (String(payload.status).toUpperCase() !== 'COMPLETE') {
      response.status(400).json({ message: 'eSewa did not report a completed payment.' })
      return
    }
    if (String(payload.product_code) !== productCode) {
      response.status(400).json({ message: 'The eSewa payment was created for a different merchant product.' })
      return
    }
    const amount = Number(payload.total_amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      response.status(400).json({ message: 'The eSewa payment amount is invalid.' })
      return
    }

    const { data: intent, error: intentError } = await supabaseAdmin
      .from('event_payment_intents')
      .select('event_id')
      .eq('transaction_uuid', String(payload.transaction_uuid))
      .eq('member_id', user.id)
      .is('completed_at', null)
      .maybeSingle()
    if (intentError) throw intentError
    if (!intent) {
      response.status(400).json({ message: 'No active event payment matches this eSewa transaction.' })
      return
    }

    const { error: registrationError } = await supabaseAdmin.rpc('complete_paid_event_registration', {
      target_transaction_uuid: String(payload.transaction_uuid),
      target_member_id: user.id,
      target_paid_amount: amount,
    })
    if (registrationError) throw registrationError
    response.json({ eventId: intent.event_id })
  } catch (error) {
    response.status(error?.status ?? 400).json({
      message: error instanceof Error ? error.message : 'Unable to confirm the eSewa event payment.',
    })
  }
})

app.post('/api/esewa/verify-payment', (request, response) => {
  try {
    const { amount, transaction_uuid, product_code, signature, signed_field_names } = request.body ?? {}

    if (!merchantSecret) {
      response.status(400).json({ message: 'ESEWA_MERCHANT_SECRET is missing. Verification cannot continue.' })
      return
    }

    if (!amount || !transaction_uuid || !product_code || !signature) {
      response.status(400).json({ message: 'Missing eSewa callback values for verification.' })
      return
    }

    const expectedSignature = createSignature({
      totalAmount: Number(amount).toFixed(2),
      transactionUuid: transaction_uuid,
      productCode: product_code,
      secret: merchantSecret,
    })

    let valid = false
    const providedSignature = String(signature)
    if (providedSignature.length === expectedSignature.length) {
      valid = crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))
    }

    response.json({
      valid,
      signedFieldNames: signed_field_names ?? 'total_amount,transaction_uuid,product_code',
    })
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : 'Unable to verify the eSewa callback.',
    })
  }
})

app.listen(port, () => {
  console.log(`eSewa backend listening on http://localhost:${port}`)
})
