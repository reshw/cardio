export function getDeviceInfo(): { device: string; os: string } {
  const ua = navigator.userAgent;

  // OS 감지
  let os = 'Unknown';
  const iosMatch = ua.match(/CPU (?:iPhone )?OS ([\d_]+)/);
  const androidMatch = ua.match(/Android ([\d.]+)/);
  const windowsMatch = ua.match(/Windows NT ([\d.]+)/);
  const macMatch = ua.match(/Mac OS X ([\d_.]+)/);

  if (iosMatch) {
    os = `iOS ${iosMatch[1].replace(/_/g, '.')}`;
  } else if (androidMatch) {
    os = `Android ${androidMatch[1]}`;
  } else if (windowsMatch) {
    const ver: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
    os = `Windows ${ver[windowsMatch[1]] ?? windowsMatch[1]}`;
  } else if (macMatch) {
    os = `macOS ${macMatch[1].replace(/_/g, '.')}`;
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  // 기기 감지
  let device = 'Desktop';
  if (/iPhone/.test(ua)) {
    device = 'iPhone';
  } else if (/iPad/.test(ua)) {
    device = 'iPad';
  } else if (/Android/.test(ua)) {
    const samsungMatch = ua.match(/Samsung|SM-[A-Z]\d+|Galaxy/i);
    const pixelMatch = ua.match(/Pixel [\w]+/i);
    const lgMatch = ua.match(/LG-?\w+/i);
    if (samsungMatch) {
      const modelMatch = ua.match(/SM-([A-Z0-9]+)/i);
      device = modelMatch ? `Galaxy (${modelMatch[1]})` : 'Galaxy';
    } else if (pixelMatch) {
      device = pixelMatch[0];
    } else if (lgMatch) {
      device = lgMatch[0];
    } else {
      device = 'Android';
    }
  }

  return { device, os };
}
