import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 앱 스토어 링크 — app_releases 최신 행이 우선이고, 행이 없거나 조회가 실패하면 이 상수로 폴백한다.
 * (출시된 앱을 "준비 중"으로 보여주지 않기 위함)
 * 링크가 바뀌면 여기 한 곳만 고친다. Download / InviteLanding / StartGuide 가 공유.
 */
export const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.reshw.cardio';
export const IOS_STORE_URL = 'https://apps.apple.com/kr/app/cardioxclub/id6779019606';

export type StoreUrls = { ios: string; android: string };

/** 두 플랫폼 스토어 링크. 최초엔 폴백 상수, app_releases 조회가 끝나면 최신 url 로 교체. */
export const useStoreUrls = (logTag: string): StoreUrls => {
  const [urls, setUrls] = useState<StoreUrls>({ ios: IOS_STORE_URL, android: ANDROID_STORE_URL });

  useEffect(() => {
    let alive = true;
    supabase
      .from('app_releases')
      .select('platform, url, released_at')
      .order('released_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error(`[${logTag}] 스토어 링크 조회 실패, 기본 링크 사용:`, JSON.stringify(error), error);
          return;
        }
        const ios = data?.find((r) => r.platform === 'ios')?.url;
        const android = data?.find((r) => r.platform === 'android')?.url;
        setUrls({ ios: ios || IOS_STORE_URL, android: android || ANDROID_STORE_URL });
      });
    return () => { alive = false; };
  }, [logTag]);

  return urls;
};
