import { GameRoomDO, WorkerEnv } from './GameRoomDO';
import { LobbyDirectoryDO } from './LobbyDirectoryDO';

export { GameRoomDO, LobbyDirectoryDO };

function buildCorsHeaders(request: Request, env: WorkerEnv): Headers {
  const origin = request.headers.get('Origin') || '*';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowOrigin =
    allowed.length === 0 || allowed.includes('*') || allowed.includes(origin)
      ? origin
      : allowed[0];

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return headers;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'tiny-isles-multiplayer' }), {
        headers: {
          ...Object.fromEntries(buildCorsHeaders(request, env).entries()),
          'Content-Type': 'application/json',
        },
      });
    }

    // 공개 방 목록 REST 조회
    if (url.pathname === '/api/rooms' && request.method === 'GET') {
      const dirId = env.LOBBY_DIRECTORY.idFromName('global_directory_v1');
      const dirStub = env.LOBBY_DIRECTORY.get(dirId);
      const res = await dirStub.fetch('https://directory.internal/rooms');
      const headers = buildCorsHeaders(request, env);
      headers.set('Content-Type', 'application/json');
      return new Response(res.body, { status: res.status, headers });
    }

    // 공개 방 목록 WebSocket 실시간 구독
    if (url.pathname === '/ws/directory') {
      const dirId = env.LOBBY_DIRECTORY.idFromName('global_directory_v1');
      const dirStub = env.LOBBY_DIRECTORY.get(dirId);
      return dirStub.fetch(request);
    }

    // 방별 전용 Durable Object WebSocket 연결 (/ws/room/:roomCode)
    const roomMatch = url.pathname.match(/^\/ws\/room\/([A-Za-z0-9_-]{2,32})$/);
    if (roomMatch) {
      const roomCode = roomMatch[1].toUpperCase();
      const roomId = env.GAME_ROOMS.idFromName(roomCode);
      const roomStub = env.GAME_ROOMS.get(roomId);
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('roomId', roomCode);
      return roomStub.fetch(new Request(forwardUrl.toString(), request));
    }

    return new Response('Not Found', {
      status: 404,
      headers: buildCorsHeaders(request, env),
    });
  },
};
