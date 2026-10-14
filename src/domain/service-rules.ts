export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const RETIRED_PREFIX = "eliminado-";

export function isRetiredSlug(slug: string): boolean {
  return slug.startsWith(RETIRED_PREFIX);
}

export function retiredSlug(slug: string, id: string): string {
  return `${RETIRED_PREFIX}${id.slice(0, 8)}-${slug}`;
}
