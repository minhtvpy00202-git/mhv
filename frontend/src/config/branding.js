export const DEFAULT_BRANDING = {
  companyName: import.meta.env.VITE_COMPANY_NAME || 'FPT',
  legalEntityName: import.meta.env.VITE_LEGAL_ENTITY_NAME || '',
  taxCode: import.meta.env.VITE_TAX_CODE || '',
  appName: import.meta.env.VITE_APP_NAME || 'Asset Management',
  primaryColor: import.meta.env.VITE_PRIMARY_COLOR || '#f27025',
  address: import.meta.env.VITE_COMPANY_ADDRESS || '',
  phoneNumber: import.meta.env.VITE_COMPANY_PHONE_NUMBER || '',
  adminTitle: import.meta.env.VITE_ADMIN_TITLE || `${import.meta.env.VITE_COMPANY_NAME || 'FPT'} Admin`,
  techTitle: import.meta.env.VITE_TECH_TITLE || `${import.meta.env.VITE_COMPANY_NAME || 'FPT'} Tech Support`,
  supplyTitle: import.meta.env.VITE_SUPPLY_TITLE || `${import.meta.env.VITE_COMPANY_NAME || 'FPT'} Vật tư tiêu hao`,
}

export const BRANDING = DEFAULT_BRANDING
