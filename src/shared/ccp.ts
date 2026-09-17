export const CCP_ORIGIN = 'https://bcabc.my.connect.aws';
export const CCP_URL = `${CCP_ORIGIN}/ccp-v2/`;
export const CCP_PARTITION = 'persist:ccp';

const HOST_SUFFIXES = ['.my.connect.aws', '.connect.aws', '.awsapps.com', '.amazonaws.com', '.signin.aws', '.amazon.com', '.aws.amazon.com'];

export function isConnectHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'signin.aws' || HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}
