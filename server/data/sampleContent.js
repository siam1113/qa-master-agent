export const sampleDocuments = [
  {
    id: 'doc-auth-onboarding',
    title: 'Authentication Onboarding',
    type: 'text',
    content:
      'Users sign in with email and password, then complete multi-factor authentication. The login screen must show validation errors, account lockout feedback, rate limiting messaging, and a forgot password link.',
    features: ['Email login', 'Multi-factor authentication', 'Forgot password', 'Account lockout feedback'],
    relatedScreens: ['screen-login']
  },
  {
    id: 'doc-dashboard-onboarding',
    title: 'Dashboard Onboarding',
    type: 'text',
    content:
      'After login, users land on the QA dashboard. The dashboard summarizes active test charters, open defects, latest exploratory session notes, agent confidence, and risk-ranked workflows.',
    features: ['QA dashboard', 'Test charters', 'Defect summary', 'Session notes', 'Risk-ranked workflows'],
    relatedScreens: ['screen-dashboard']
  },
  {
    id: 'doc-checkout-onboarding',
    title: 'Checkout Risk Notes',
    type: 'text',
    content:
      'Checkout requires cart review, promo code validation, payment authorization, and a final confirmation receipt. Testers should verify invalid promo codes, retryable payment failures, tax recalculation, and receipt persistence.',
    features: ['Cart review', 'Promo validation', 'Payment authorization', 'Receipt confirmation', 'Retryable payment failures'],
    relatedScreens: ['screen-checkout']
  }
];

export const sampleImages = [
  {
    id: 'screen-login',
    title: 'Login Screen Mock',
    type: 'image',
    alt: 'Login form with email, password, MFA prompt, validation area, lockout banner, and forgot password link.',
    src: '/samples/login.svg',
    features: ['Email login', 'Multi-factor authentication', 'Forgot password', 'Account lockout feedback']
  },
  {
    id: 'screen-dashboard',
    title: 'QA Dashboard Mock',
    type: 'image',
    alt: 'Dashboard cards for active test charters, open defects, exploratory notes, risk score, and execution sessions.',
    src: '/samples/dashboard.svg',
    features: ['QA dashboard', 'Test charters', 'Defect summary', 'Session notes', 'Risk-ranked workflows']
  },
  {
    id: 'screen-checkout',
    title: 'Checkout Flow Mock',
    type: 'image',
    alt: 'Checkout review screen with promo code, payment status, retry controls, tax calculation, and confirmation receipt panels.',
    src: '/samples/checkout.svg',
    features: ['Cart review', 'Promo validation', 'Payment authorization', 'Receipt confirmation', 'Retryable payment failures']
  }
];

export const sampleWorkflows = [
  {
    id: 'workflow-authentication',
    name: 'Authentication and MFA',
    goal: 'Validate secure sign-in from credentials through multi-factor challenge completion.',
    screens: ['screen-login'],
    rules: ['rule-auth-lockout'],
    steps: ['Open login screen', 'Submit valid credentials', 'Complete MFA challenge', 'Verify dashboard redirect', 'Attempt invalid credentials and confirm lockout feedback']
  },
  {
    id: 'workflow-checkout',
    name: 'Checkout completion',
    goal: 'Validate order completion across cart, promo, payment, retry, and receipt states.',
    screens: ['screen-checkout'],
    rules: ['rule-promo-validation', 'rule-payment-retry'],
    steps: ['Review cart totals', 'Apply valid and invalid promo codes', 'Authorize payment', 'Retry retryable payment failure', 'Verify receipt persistence']
  }
];

export const sampleBusinessRules = [
  {
    id: 'rule-auth-lockout',
    name: 'Authentication lockout policy',
    description: 'After repeated credential failures, the UI must show lockout feedback without revealing whether the email exists.',
    validations: ['Generic lockout message', 'No account enumeration', 'Recovery path remains visible'],
    confidence: 0.82
  },
  {
    id: 'rule-promo-validation',
    name: 'Promo code validation',
    description: 'Invalid, expired, and ineligible promo codes must not change the order total and must produce clear inline feedback.',
    validations: ['Invalid code feedback', 'Expired code feedback', 'Order total unchanged'],
    confidence: 0.86
  },
  {
    id: 'rule-payment-retry',
    name: 'Payment retry behavior',
    description: 'Retryable payment failures must preserve cart state, payment context, and user-entered promo code state.',
    validations: ['Cart state preserved', 'Payment status visible', 'Retry control enabled'],
    confidence: 0.78
  }
];
