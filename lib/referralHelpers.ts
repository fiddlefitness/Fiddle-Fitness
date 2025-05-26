/**
 * Extracts the referral code from a formatted string
 * Format: "XYZAB - Kapil Bamotriya"
 * @param formattedCode The formatted referral code with referrer name
 * @returns The referral code only
 */
export function extractReferralCode(formattedCode: string): string | null {
  if (!formattedCode) return null;
  
  // If the code contains a dash, it's in the formatted form
  if (formattedCode.includes(' - ')) {
    return formattedCode.split(' - ')[0].trim();
  }
  
  // Otherwise return as is
  return formattedCode;
}

/**
 * Formats a referral code with the referrer's name
 * @param code The referral code
 * @param name The referrer's name
 * @returns Formatted string "CODE - Name"
 */
export function formatReferralCode(code: string, name: string): string {
  return `${code} - ${name}`;
}
