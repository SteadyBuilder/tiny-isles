/**
 * Cloudflare Workers + Durable Objects 멀티플레이 서버 엔드포인트 해석 유틸
 * - VITE_MULTIPLAYER_WS_URL 환경변수 우선 사용 (예: wss://tiny-isles-multiplayer.<account>.workers.dev)
 * - 미설정 로컬 개발 환경에서는 기본 ws://localhost:8787 사용
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getMultiplayerWsBaseUrl(): string {
  const configured = (import.meta.env?.VITE_MULTIPLAYER_WS_URL as string | undefined)?.trim();
  if (configured) {
    const normalized = stripTrailingSlash(configured);
    if (normalized.startsWith('https://')) return `wss://${normalized.slice(8)}`;
    if (normalized.startsWith('http://')) return `ws://${normalized.slice(7)}`;
    return normalized;
  }
  return 'ws://localhost:8787';
}

export function getMultiplayerHttpBaseUrl(): string {
  const wsUrl = getMultiplayerWsBaseUrl();
  if (wsUrl.startsWith('wss://')) return `https://${wsUrl.slice(6)}`;
  if (wsUrl.startsWith('ws://')) return `http://${wsUrl.slice(5)}`;
  return wsUrl;
}

export function buildRoomWsUrl(roomCode: string): string {
  const cleanCode = encodeURIComponent(roomCode.trim().toUpperCase());
  return `${getMultiplayerWsBaseUrl()}/ws/room/${cleanCode}`;
}

export function buildDirectoryWsUrl(): string {
  return `${getMultiplayerWsBaseUrl()}/ws/directory`;
}

export function buildDirectoryHttpUrl(): string {
  return `${getMultiplayerHttpBaseUrl()}/api/rooms`;
}
