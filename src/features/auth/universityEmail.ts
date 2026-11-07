export function normalizeUniversityEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (!/^[^\s@]+@(msu\.edu|umich\.edu)$/.test(email) || email.length > 254)
    throw Error("Use your @msu.edu or @umich.edu university email to sign up.");
  return email;
}
