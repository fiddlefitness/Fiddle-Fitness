export const extractLast10Digits = (mobileNumber: string): string => {
    // Remove all non-digit characters
    const digitsOnly = mobileNumber.replace(/\D/g, '');
    
    // Take the last 10 digits
    return digitsOnly.slice(-10);
  };