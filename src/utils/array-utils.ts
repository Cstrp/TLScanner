/**
 * Check if only one non-empty string exists in the array.
 * @param arr - Array of strings to check.
 * @returns True if only one non-empty string exists, false otherwise.
 */
export function existOnlyOne(arr: string[]): boolean {
  let exist = false;
  for (const item of arr) {
    if (item !== "") {
      if (exist) return false;
      exist = true;
    }
  }
  return exist;
}

/**
 * Remove duplicate strings from an array while preserving the order.
 * @param strSlice - Array of strings to filter.
 * @returns A new array with duplicates removed.
 */
export function removeDuplicateStr(strSlice: string[]): string[] {
  const seen = new Set<string>();
  return strSlice.filter((item) => {
    const isNew = !seen.has(item);
    seen.add(item);
    return isNew;
  });
}
