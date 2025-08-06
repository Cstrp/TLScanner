/**
 * 
 * @param domain - The domain name to validate.
 * @description Validates a domain name against a simple regex pattern.
 * The pattern allows alphanumeric characters, hyphens, and dots.
 * It does not check for the validity of the domain structure (e.g., TLDs).
 * This is a basic validation and may not cover all edge cases.
 * @returns True if the domain name is valid, false otherwise.
 */
export function validateDomainName(domain: string): boolean {
  const regex = /^[A-Za-z0-9\-.]+$/;
  return regex.test(domain);
}
