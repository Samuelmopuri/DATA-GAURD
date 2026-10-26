export function cn(...classes: (string | undefined | null | false | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}
