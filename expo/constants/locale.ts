export const CURRENCY = {
  symbol: '₹',
  code: 'INR',
  locale: 'en-IN',
};

export const formatPrice = (amount: number): string => {
  return `${CURRENCY.symbol}${amount.toLocaleString(CURRENCY.locale)}`;
};

export const PHONE = {
  countryCode: '+91',
  placeholder: '+91 98765 43210',
  minLength: 10,
};

export const COUNTRY = {
  name: 'India',
  code: 'IN',
};
