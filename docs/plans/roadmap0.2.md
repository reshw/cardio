🗺️ Cardio 통합 기술 & 기능 로드맵
📌 Phase 1: 인프라 안정화 & 등산 고도화 (현재 ~ Short-term)
"회원 100명의 수기 입력 피로도를 즉시 낮추고, 수동 입력 기반으로 등산 공식을 먼저 검증하는 단계"

기능 (Feature)

등산 상행/하행 분리 UI 구현: 입력 폼에서 '획득 고도(상행)'와 '하강 고도(하행)'를 분리 수집.

MET 기반 등산 마일리지 엔진 배포: 수동으로 입력된 값에 경사도/속도 가중치 공식을 적용하여 마일리지 자동 연산 및 DB(workouts) 적재.

반자동 인증 팝업 (선택적 플랜B): Strava 심사가 지연될 경우를 대비해, 가민/나이키런 스크린샷을 첨부하면 가벼운 OCR로 거리/시간을 인풋창에 자동 매핑해 주는 과도기적 UI 도입.

인프라 (Tech Infrastructure)

Strava API Production 승인 획득: 데모 로그인 계정 활성화 상태를 유지하며 심사 통과 완료 (하루 30,000요청 확보).

Strava Webhook 파이프라인 구축: Supabase/Cloudflare Workers 환경에 웹훅 수신부 세팅. 사용자가 앱을 켜지 않아도 운동 완료 시 DB에 자동 동기화되는 기본 베이스라인 완성 (Polling 방식 원천 차단).

📌 Phase 2: Strava 연동 및 겨울 시즌 준비 (Mid-term)
"자동화 엔진을 최초로 도입하고, Strava 생태계를 통해 스노보드/스키 데이터까지 흡수하는 단계"

기능 (Feature)

Strava Activity Type 매핑 확장: 수신된 웹훅 데이터 중 Snowboard, AlpineSki, BackcountrySki 파싱 엔진 가동.

스노보드 순수 활주 마일리지 엔진: Strava moving_time을 기반으로 리프트 시간을 제외한 순수 슬로프 활주 마일리지 계산 (경사 가중치 테이블 적용).

스노보드 핵심 스탯 카드 UI 배포: 동호회 대시보드에 '버티컬 드롭(m)', '최고 속도(km/h)'를 메인으로 하는 보더 전용 프로필 카드 론칭.

인프라 (Tech Infrastructure)

초기 동기화(Backfill) 최적화: 신규 가입자가 Strava 연동 시, 최근 2주 동안의 과거 데이터만 긁어오도록 스코프를 제한하여 하루 3만 건의 API 쿼터 방어.

크루별 테넌트 커스텀 계수 설정 페이지: 각 클럽 방장이 자기 크루의 성격에 맞게 러닝 외 등산/보드/보강운동의 기본 계수를 커스텀 조정할 수 있는 관리자 화면 오픈.

📌 Phase 3: 아이폰 캐패시터 네이티브 진화 (Long-term)
"가장 엄격한 iOS 기준으로 시스템 그릇을 키우고, 알림과 로컬 건강 데이터까지 확장하는 완전체 단계"

기능 (Feature)

백컨트리 하이크업 완전 연동: 가민/워치로 기록된 백컨트리 하이크업(BackcountrySki 등) 데이터를 등산 상행 공식과 결합하여 복합 마일리지 자동 산정.

푸시 알림을 통한 크루 동기부여: 동호회원이 마일리지를 적립하거나 순위 변동이 있을 때 푸시 알림 발송으로 리텐션 극대화.

인프라 (Tech Infrastructure)

Supabase 인증 고도화: 스토어 출시 필수 조건인 Apple 로그인(Sign in with Apple) 구현 및 기존 카카오 로그인 유저 매핑 테이블 최적화.

iOS Capacitor 래핑 & APNs 연동: Xcode 빌드 및 Apple 개발자 계정을 활용한 첫 App Store 공식 출시 (V1.0.0).

iOS HealthKit 파이프라인 개설: Strava를 쓰지 않고 애플워치 기본 운동 앱이나 Slopes 앱 단독으로만 타는 가벼운 유저들의 로컬 건강 데이터를 직접 쿼리하여 수집.

Live Update 시스템 세팅: 최초 출시 이후의 웹 코드 수정 및 UI 업데이트는 스토어 심사 없이 git push만으로 유저 폰에 실시간 반영되도록 인프라 구축.

🏗️ Cardio 데이터 & 서비스 구조도 (Mermaid)
Cardio 앱이 웹과 네이티브, 그리고 다양한 서드파티 데이터 소스(가민, Slopes 등)를 어떻게 흡수하여 하나의 Supabase DB로 통합하는지 보여주는 전체 아키텍처 구조도입니다.

코드 스니펫
graph TD
    %% 데이터 소스 영역
    subgraph Data_Sources [1. 운동 데이터 소스]
        Garmin[가민 피닉스 8 / 커넥트]
        AppleWatch[애플워치 기본 운동]
        Slopes[Slopes 앱 (보드/스키)]
        Nike[나이키 런 클럽]
    end

    %% 동기화 경로 A (웹 기반 자동화)
    subgraph Sync_Route_A [2-A. Strava 클라우드 연동]
        Garmin -->|자동 동기화| Strava[(Strava Cloud)]
        Slopes -->|자동 업로드| Strava
        Nike -->|자동 동기화| Strava
        
        Strava -->|운동 완료 이벤트| WebhookWorker[Cloudflare Webhook Worker]
    end

    %% 동기화 경로 B (네이티브 로컬 연동)
    subgraph Sync_Route_B [2-B. iOS 네이티브 로컬 연동]
        Garmin -->|가민커넥트 동기화| iOS_Health[아이폰 애플 건강 - HealthKit]
        AppleWatch -->|기본 동기화| iOS_Health
        Slopes -->|기본 동기화| iOS_Health
        
        iOS_Health -->|로컬 데이터 쿼리| Capacitor[Capacitor HealthKit Plugin]
    end

    %% 수동 입력 경로
    subgraph Sync_Route_C [2-C. 과도기 수동 입력]
        UserUI[Cardio 웹/앱 입력 UI] -->|상/하행 고도 및 시간 입력| ManualInput[수동 입력 프로세서]
    end

    %% Cardio 코어 엔진 영역
    subgraph Cardio_Core [3. Cardio 코어 서비스]
        WebhookWorker -->|Strava 데이터 파싱| MileageEngine[MET 기반 등가 마일리지 엔진]
        Capacitor -->|로컬 데이터 쏴주기| MileageEngine
        ManualInput -->|수동 데이터 전달| MileageEngine

        MileageEngine -->|1. 러닝 1km = 1마일<br>2. 등산 상행/하행 가중치 분리<br>3. 보드 순수활주 시간+경사| ScoreCalc[최종 마일리지 산출]
    end

    %% 백엔드 및 저장소
    subgraph Backend [4. 백엔드 및 DB]
        AppleAuth[Apple Sign-In / 카카오] --> SupabaseAuth[Supabase Auth]
        ScoreCalc -->|적재| SupabaseDB[(Supabase DB<br>workouts table)]
        SupabaseDB -->|실시간 갱신| DashboardUI[테넌트별 크루 리더보드 대시보드]
    end

    %% 스타일링
    style Garmin fill:#4CAF50,stroke:#fff,stroke-width:2px,color:#fff
    style iOS_Health fill:#FF2D55,stroke:#fff,stroke-width:2px,color:#fff
    style Strava fill:#FC4C02,stroke:#fff,stroke-width:2px,color:#fff
    style SupabaseDB fill:#3ECF8E,stroke:#fff,stroke-width:2px,color:#fff
    style MileageEngine fill:#2196F3,stroke:#fff,stroke-width:2px,color:#fff
이 구조의 강점
유저의 자유도: 가민 피닉스8을 차고 백컨트리를 타든, 애플워치로 슬로프에서 Slopes를 켜든 상관없이 최종 데이터는 완벽하게 호환되어 Cardio 앱으로 모입니다.

개발의 점진성: 수동 입력 엔진(Phase 1)을 먼저 만들어두면, 나중에 Strava 웹훅(Phase 2)과 캐패시터 로컬 쿼리(Phase 3)가 뚫릴 때 데이터를 넘겨주는 통로만 자동화로 갈아끼우면 되기 때문에 코어 마일리지 계산 로직을 재활용할 수 있어 매우 효율적입니다.