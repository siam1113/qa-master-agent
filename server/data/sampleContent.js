// Sample onboarding text and UI image examples are kept small so the POC can boot instantly.
export const sampleDocuments = [
  {
    id: 'doc-auth-onboarding',
    title: 'Authentication Onboarding',
    type: 'text',
    content:
      'Users sign in with email and password, then complete multi-factor authentication. The login screen must show validation errors and a forgot password link.',
    features: ['Email login', 'Multi-factor authentication', 'Forgot password'],
    relatedScreens: ['screen-login']
  },
  {
    id: 'doc-dashboard-onboarding',
    title: 'Dashboard Onboarding',
    type: 'text',
    content:
      'After login, users land on the QA dashboard. The dashboard summarizes active test charters, open defects, and the latest exploratory session notes.',
    features: ['QA dashboard', 'Test charters', 'Defect summary', 'Session notes'],
    relatedScreens: ['screen-dashboard']
  },
  {
    id: 'doc-checkout-onboarding',
    title: 'Checkout Risk Notes',
    type: 'text',
    content:
      'Checkout requires cart review, promo code validation, payment authorization, and a final confirmation receipt. Testers should verify boundary conditions for invalid promo codes.',
    features: ['Cart review', 'Promo validation', 'Payment authorization', 'Receipt confirmation'],
    relatedScreens: ['screen-checkout']
  }
];

// SVG data URLs stand in for uploaded UI images and let the UI render examples without binary fixtures.
export const sampleImages = [
  {
    id: 'screen-login',
    title: 'Login Screen Mock',
    type: 'image',
    alt: 'Login form with email, password, MFA prompt, validation area, and forgot password link.',
    src: '/samples/login.svg',
    features: ['Email login', 'Multi-factor authentication', 'Forgot password']
  },
  {
    id: 'screen-dashboard',
    title: 'QA Dashboard Mock',
    type: 'image',
    alt: 'Dashboard cards for active test charters, open defects, and exploratory notes.',
    src: '/samples/dashboard.svg',
    features: ['QA dashboard', 'Test charters', 'Defect summary', 'Session notes']
  },
  {
    id: 'screen-checkout',
    title: 'Checkout Flow Mock',
    type: 'image',
    alt: 'Checkout review screen with promo code, payment status, and confirmation receipt panels.',
    src: '/samples/checkout.svg',
    features: ['Cart review', 'Promo validation', 'Payment authorization', 'Receipt confirmation']
  }
];
