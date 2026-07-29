-- 클럽 마일리지 탭 "종목별 필터" 칩에 노출할 상위 카테고리 화이트리스트.
-- NULL = 활성화된 종목 전체 노출 (기본값, 기존 동작과 동일). 배열이 있으면 그 목록만 노출.
alter table clubs add column if not exists mileage_filter_categories text[];

comment on column clubs.mileage_filter_categories is
  '마일리지 탭 종목별 필터 칩에 노출할 상위 카테고리(club_mileage_configs.category) 화이트리스트. NULL 이면 활성화된 전체 종목 노출';
