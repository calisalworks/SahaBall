export function getServerHttpBase(): string {
  const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return '';
}

export function getServerWsUrl(): string {
  const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
  if (configured) {
    const clean = configured.replace(/\/+$/, '');
    if (clean.startsWith('https://')) {
      return `wss://${clean.slice('https://'.length)}/ws`;
    }
    if (clean.startsWith('http://')) {
      return `ws://${clean.slice('http://'.length)}/ws`;
    }
    return `wss://${clean}/ws`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}
