# Tiny Isles Architecture & AI Collaboration Guidelines

이 문서는 **Tiny Isles** 프로젝트의 아키텍처 원칙과, 향후 AI 어시스턴트 및 개발자가 새로운 기능 구현, 리팩토링, 버그 수정을 진행할 때 반드시 준수해야 하는 엔지니어링 표준을 정의합니다.

---

## 1. Core Architecture Principles (핵심 아키텍처 원칙)

### 1) 모듈화 및 파일 크기 엄격 제한 (SRP & 300-Line Limit)
- **모든 신규/수정 파일은 원칙적으로 200~300줄 이내로 유지해야 합니다.**
- 400줄을 초과하는 대형 파일(God Object)의 생성을 금지하며, 기능이 비대해질 경우 반드시 도메인/역할별 서브 시스템으로 분할 리팩토링합니다.
- 한 파일은 오직 하나의 명확한 단일 책임(Single Responsibility)만 가집니다.

### 2) 데이터와 로직의 완전한 분리 (Data-Driven Architecture)
- 수치, 밸런스, 타일셋 오프셋, 몬스터 스펙, 건물 청사진, 테크트리 비용 등은 로직 파일 내에 하드코딩하지 않고 데이터 파일(`src/data/`)로 분리합니다.
- 기획이나 밸런스가 바뀔 때 로직 코드를 건드리지 않고 순수 데이터 파일만 수정하여 반영할 수 있어야 합니다.

### 3) 인터페이스 및 이벤트 우선 (Contract-First & Decoupling)
- 시스템 간 직접적인 상호 참조(Circular Dependency)나 결합을 엄격히 금지합니다.
- 시스템 간 통신은 반드시 정의된 이벤트 인터페이스(`src/game/events/gameEvents.ts`)를 통과해야 합니다.

---

## 2. Feature Extension Protocols (기능 확장 프로토콜)

### 📌 규칙 1: 새로운 건물(Building/Tower/Wall) 추가 시
1. **데이터 등록:** `src/data/buildings.ts`의 `CONSTRUCTABLE_BLUEPRINTS` 배열에만 신규 건물 청사진(Blueprint) 데이터를 등록합니다.
   - 건물 타입(`type`), 이름, 아이콘, 렌더 스프라이트 키, 비용, 체력(maxHp), 사거리, 공격 주기 등 정의
2. **로직/특수 효과 구현:**
   - 건물이 타워/방어형인 경우: `src/game/systems/TowerDefenseSystem.ts`에만 요격 연산 추가
   - 건물이 경제/치유/버프형인 경우: `src/game/BuildingSystem.ts`에만 특수 효과 주기 처리 추가
3. **UI/뷰 자동 반영:** Blueprint 데이터를 기반으로 모달(`VillageBuildModal.tsx`)과 캔버스/Phaser 렌더러가 자동으로 연동됩니다.

### 📌 규칙 2: 새로운 몬스터(Monster/Boss) 추가 시
1. **데이터 등록:** `src/data/waves.ts`의 `REGULAR_MONSTER_TEMPLATES` 또는 `BOSS_MONSTER_TEMPLATES`에만 몬스터 기본 스펙 데이터를 등록합니다.
   - 타입(`type`), 명칭, 기본 HP, 웨이브당 증가치, 공격력, 이동 속도 등 정의
2. **AI 행동 패턴 구현:**
   - 몬스터의 길찾기, 외곽 방책 공격, 타워 회피, 보스 특수 스킬 등 인게임 행동 로직은 `src/game/systems/WaveSystem.ts`에만 추가합니다.
3. **유틸리티 순수 함수 유지:**
   - 스폰 위치 계산 및 타겟팅 연산은 `src/game/utils/waveUtils.ts`의 순수 함수를 활용합니다.

### 📌 규칙 3: 시스템 간 이벤트 통신 규약
- 모듈(예: WaveSystem, BuildingSystem, CoreGemSystem, WorldScene, React HUD) 간의 모든 호출은 `src/game/events/gameEvents.ts`의 `GameEvents`를 경유해야 합니다.
- 신규 이벤트를 추가할 경우:
  1. `GameEventPayloads` 인터페이스에 이벤트 키와 페이로드 타입을 먼저 선언합니다.
  2. `GameEvents.emit('event-name', payload)` 및 `GameEvents.on('event-name', handler)`로 통신합니다.

---

## 3. Realtime Multiplayer Synchronization (멀티 동기화 규약)

`src/lib/serverSync.ts`는 Supabase Realtime Broadcast 채널을 제어하며 다중 접속 시의 무결성을 보장합니다.

1. **고스트 텔레포트 현상 방지:**
   - `serverSync.isLatestMove(playerId, timestamp)`: 지연 도착한 과거 패킷을 자동 폐기하여 되감김 방지
   - `serverSync.shouldSnapTeleport(curX, curY, targetX, targetY)`: 280px 초과 거리 발생 시에만 Snap 순간이동하고, 그 외에는 Tween 선형 보간으로 부드러운 이동 보장
2. **레이스 컨디션 및 패킷 에코 방지:**
   - 발신자 ID 필터링(`senderId === localPlayerId`) 및 최근 80개 이벤트 ID LRU 캐시(`isValidIncomingEvent`)를 통해 동일 이벤트 중복 실행을 차단합니다.
3. **동기화 대상 이벤트 목록:**
   - `player_move`: 플레이어 위치, 방향, 액션 애니메이션
   - `village_upgraded`: 영지 점령 및 마을 티어 발전
   - `building_constructed` & `building_destroyed`: 건물 건설/철거
   - `wave_spawned`: 몬스터 웨이브/보스 출현
   - `territory_lost`: 영지 코어 파괴 및 영지 상실

---

## 4. Graphic Assets & Palisades (목책 및 그래픽 렌더링 규약)

- **Tiny Swords 에셋 규격:**
  - `Wood_Palisade_Corner.png`: 64×64 (NW: 52,52 / NE: 588,52 / SW: 52,588 / SE: 588,588)
  - `Wood_Palisade_Gate.png`: 128×64 (가로 게이트, 북/남 외곽선 중앙)
  - `Wood_Palisade_Gate_V.png`: 56×128 (세로 게이트, 동/서 외곽선 중앙)
  - `Wood_Palisade_H.png`: 192×64 (수평 방책 날개)
  - `Wood_Palisade_V.png`: 64×192 (수직 방책 날개)
- **오프셋 및 뎁스 소팅 (Y-Sorting):**
  - 각 파츠 간 2~4px 오버랩을 적용하여 어떤 줌 레벨에서도 외곽선 틈새(gap)가 발생하지 않도록 밀폐합니다.
  - 상하 이동 시 플레이어와 몬스터가 자연스럽게 앞/뒤로 가려지도록 `setDepth(y + 30)` 체계를 준수합니다.

---

## 5. Git & Delivery Protocol (작업 완료 및 푸시 수칙)

모든 코드 작업 완료 시 다음 파이프라인을 엄격히 준수합니다:
1. **사전 검증:** `npm run build`를 실행하여 TypeScript 타입 검사 및 Vite 번들링 무결성을 100% 확인합니다.
2. **Git 스테이징:** `git status`로 변경 사항을 검토한 후 관련 파일만 `git add`합니다.
3. **커밋 메시지:** Conventional Commits 규약(`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)을 준수합니다.
4. **원격 푸시:** `git push origin <working-branch>`를 실행하여 원격 저장소에 즉시 반영합니다.
5. **결과 보고:** 변경 내역 요약, 커밋 해시(Commit SHA), 푸시 상태 및 검증 절차를 사용자에게 보고합니다.
