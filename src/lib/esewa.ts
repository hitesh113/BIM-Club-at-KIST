export type EsewaEnvironment = 'sandbox' | 'production'

export type EsewaPaymentInput = {
  amount: number
  purpose: string
  donorName: string
  eventId?: string
  accessToken?: string
  merchantCode?: string
  productCode?: string
  successUrl?: string
  failureUrl?: string
  transactionId?: string
  environment?: EsewaEnvironment
}

export type EsewaPaymentSession = {
  formUrl: string
  payload: Record<string, string>
}

const parseEnvironment = (): EsewaEnvironment => {
  const environment = (import.meta.env.VITE_ESEWA_ENV ?? 'sandbox').toLowerCase()
  return environment === 'production' ? 'production' : 'sandbox'
}

const getDefaultSuccessUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5173/donations?payment=success'
  return `${window.location.origin}/donations?payment=success`
}

const getDefaultFailureUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5173/donations?payment=failed'
  return `${window.location.origin}/donations?payment=failed`
}

export const hasEsewaConfig = Boolean(import.meta.env.VITE_ESEWA_MERCHANT_CODE)

export const getEsewaFormUrl = (environment = parseEnvironment()) => environment === 'production'
  ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
  : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'

export const buildEsewaFormData = ({
  amount,
  purpose,
  donorName,
  merchantCode = import.meta.env.VITE_ESEWA_MERCHANT_CODE ?? '',
  productCode = import.meta.env.VITE_ESEWA_PRODUCT_CODE ?? (merchantCode || 'BIMCLUB'),
  successUrl = import.meta.env.VITE_ESEWA_SUCCESS_URL ?? getDefaultSuccessUrl(),
  failureUrl = import.meta.env.VITE_ESEWA_FAILURE_URL ?? getDefaultFailureUrl(),
  transactionId = `bim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  environment = parseEnvironment(),
}: EsewaPaymentInput) => {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('A positive donation amount is required before redirecting to eSewa.')
  }
  if (!merchantCode) {
    throw new Error('Missing eSewa merchant code. Add VITE_ESEWA_MERCHANT_CODE to your environment.')
  }

  return {
    amount: numericAmount.toFixed(2),
    tax_amount: '0.00',
    total_amount: numericAmount.toFixed(2),
    transaction_uuid: transactionId,
    product_code: productCode,
    merchant_code: merchantCode,
    product_service_charge: '0.00',
    product_service_charge_amount: '0.00',
    success_url: successUrl,
    failure_url: failureUrl,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
    purpose: purpose.trim() || 'Club donation',
    donor_name: donorName.trim() || 'BIM Club member',
    environment,
  }
}

export const createEsewaPaymentSession = async (input: EsewaPaymentInput): Promise<EsewaPaymentSession> => {
  if (!hasEsewaConfig) {
    throw new Error('Set VITE_ESEWA_MERCHANT_CODE and the callback URLs in .env.local before using the eSewa payment flow.')
  }

  const response = await fetch('/api/esewa/create-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
    },
    body: JSON.stringify({
      eventId: input.eventId,
      amount: input.amount,
      purpose: input.purpose,
      donorName: input.donorName,
      merchantCode: input.merchantCode ?? import.meta.env.VITE_ESEWA_MERCHANT_CODE,
      productCode: input.productCode ?? import.meta.env.VITE_ESEWA_PRODUCT_CODE,
      successUrl: input.successUrl ?? import.meta.env.VITE_ESEWA_SUCCESS_URL ?? getDefaultSuccessUrl(),
      failureUrl: input.failureUrl ?? import.meta.env.VITE_ESEWA_FAILURE_URL ?? getDefaultFailureUrl(),
      transactionId: input.transactionId,
      environment: input.environment ?? parseEnvironment(),
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message ?? 'Unable to prepare the eSewa payment request.')
  }

  return {
    formUrl: body.formUrl ?? getEsewaFormUrl(input.environment ?? parseEnvironment()),
    payload: body.payload ?? buildEsewaFormData(input),
  }
}

export const submitEsewaPayment = async (input: EsewaPaymentInput) => {
  const { formUrl, payload } = await createEsewaPaymentSession(input)

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = formUrl
  form.acceptCharset = 'UTF-8'
  form.style.display = 'none'

  Object.entries(payload).forEach(([name, value]) => {
    if (value === undefined || value === null || value === '') return
    const inputField = document.createElement('input')
    inputField.type = 'hidden'
    inputField.name = name
    inputField.value = String(value)
    form.appendChild(inputField)
  })

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)

  return payload
}

export const completeEsewaEventPayment = async (data: string, accessToken: string): Promise<{ eventId: string }> => {
  const response = await fetch('/api/esewa/complete-event-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ data }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message ?? 'Unable to confirm the eSewa event payment.')
  }
  if (typeof body.eventId !== 'string') {
    throw new Error('The eSewa payment was verified, but its event could not be identified.')
  }
  return { eventId: body.eventId }
}

export const getEsewaCallbackState = (search = typeof window === 'undefined' ? '' : window.location.search) => {
  const params = new URLSearchParams(search)
  return {
    refId: params.get('refId') ?? '',
    status: params.get('status') ?? '',
    oid: params.get('oid') ?? '',
    amount: params.get('amount') ?? '',
    transaction_uuid: params.get('transaction_uuid') ?? '',
  }
}
