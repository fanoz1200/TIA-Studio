/**
 * Bundled Electron runs the app on 127.0.0.1 without Manus server credentials.
 * Downloadable documentation and release files must therefore use the published
 * storage route when opened from that local host. Browser deployments preserve
 * their relative URLs so they continue to use the current deployment origin.
 */
export const PUBLIC_DOWNLOAD_ORIGIN = "https://tiadelaytool-aq6zdeih.manus.space";

export function resolveResourceDownloadHref(path: string, hostname?: string): string {
  const activeHost = hostname ?? (typeof window === "undefined" ? "" : window.location.hostname);
  return activeHost === "127.0.0.1" ? `${PUBLIC_DOWNLOAD_ORIGIN}${path}` : path;
}
