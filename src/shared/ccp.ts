export const CCP_ORIGIN = 'https://bcabc.my.connect.aws';
export const CCP_URL = `${CCP_ORIGIN}/ccp-v2/`;
export const CCP_PARTITION = 'persist:ccp';

export function isConnectHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === 'bcabc.my.connect.aws' ||
      host.endsWith('.my.connect.aws') ||
      host.endsWith('.awsapps.com') ||
      host.endsWith('.amazonaws.com') ||
      host.endsWith('.connect.aws')
    );
  } catch {
    return false;
  }
}
