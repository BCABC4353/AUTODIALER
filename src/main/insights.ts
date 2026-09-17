import {
  ConnectClient,
  DescribeUserCommand,
  ListRealtimeContactAnalysisSegmentsV2Command,
  type Contact,
} from '@aws-sdk/client-connect';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { AWS_REGION, CONNECT_INSTANCE_ID } from './aws';
import type { CallAnalysis, ContactDetail, TranscriptTurn } from '../shared/types';

export const RECORDING_BUCKET = 'bcabc-connect-638647552089';
const RECORDING_PREFIX = 'recordings/';

const connect = new ConnectClient({ region: AWS_REGION });
const s3 = new S3Client({ region: AWS_REGION });
const userNames = new Map<string, string | null>();

type Loose = Contact & Record<string, unknown>;

function iso(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function secondsBetween(a: unknown, b: unknown): number | null {
  if (!(a instanceof Date) || !(b instanceof Date)) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));
}

export async function userName(agentId: string): Promise<string | null> {
  if (userNames.has(agentId)) return userNames.get(agentId) ?? null;
  try {
    const res = await connect.send(new DescribeUserCommand({ InstanceId: CONNECT_INSTANCE_ID, UserId: agentId }));
    const name = res.User?.Username ?? null;
    userNames.set(agentId, name);
    return name;
  } catch {
    userNames.set(agentId, null);
    return null;
  }
}

export async function buildDetail(contact: Contact): Promise<ContactDetail> {
  const c = contact as Loose;
  const agentInfo = contact.AgentInfo;
  const device = agentInfo?.DeviceInfo
    ? [agentInfo.DeviceInfo.PlatformName, agentInfo.DeviceInfo.PlatformVersion, agentInfo.DeviceInfo.OperatingSystem].filter(Boolean).join(' ')
    : null;
  const quality = c.QualityMetrics as
    | { Agent?: { Audio?: { QualityScore?: number; PotentialQualityIssues?: string[] } }; Customer?: { Audio?: { QualityScore?: number; PotentialQualityIssues?: string[] } } }
    | undefined;
  const voice = c.CustomerVoiceActivity as { GreetingStartTimestamp?: Date; GreetingEndTimestamp?: Date } | undefined;
  const recordings = c.Recordings as { Location?: string; MediaStreamType?: string; ParticipantType?: string }[] | undefined;
  const recording = recordings?.find((r) => r.Location) ?? null;
  const agent = agentInfo?.Id
    ? {
        id: agentInfo.Id,
        username: await userName(agentInfo.Id),
        connectedAt: iso(agentInfo.ConnectedToAgentTimestamp),
        talkSeconds: secondsBetween(agentInfo.ConnectedToAgentTimestamp, contact.DisconnectTimestamp),
        holdSeconds: (c.AgentInfo as { AgentInitiatedHoldDuration?: number } | undefined)?.AgentInitiatedHoldDuration ?? 0,
        holdCount: (c.TotalPauseCount as number | undefined) ?? 0,
        acwSeconds: (c.AgentInfo as { AfterContactWorkDuration?: number } | undefined)?.AfterContactWorkDuration ?? null,
        device,
      }
    : null;
  return {
    contactId: contact.Id ?? '',
    campaignId: (c.Campaign as { CampaignId?: string } | undefined)?.CampaignId ?? null,
    initiatedAt: iso(contact.InitiationTimestamp),
    ringStartAt: iso(c.RingStartTimestamp),
    answeredAt: iso(c.ConnectedToSystemTimestamp),
    disconnectedAt: iso(contact.DisconnectTimestamp),
    ringSeconds: secondsBetween(c.RingStartTimestamp ?? contact.InitiationTimestamp, c.ConnectedToSystemTimestamp ?? contact.DisconnectTimestamp),
    answeredSeconds: secondsBetween(c.ConnectedToSystemTimestamp, contact.DisconnectTimestamp),
    greetingSeconds: secondsBetween(voice?.GreetingStartTimestamp, voice?.GreetingEndTimestamp),
    amd: contact.AnsweringMachineDetectionStatus ?? null,
    disconnectReason: (c.DisconnectReason as string | undefined) ?? null,
    agent,
    quality: {
      agent: quality?.Agent?.Audio?.QualityScore ?? null,
      customer: quality?.Customer?.Audio?.QualityScore ?? null,
      issues: [...(quality?.Agent?.Audio?.PotentialQualityIssues ?? []), ...(quality?.Customer?.Audio?.PotentialQualityIssues ?? [])],
    },
    recordingLocation: recording?.Location ?? null,
  };
}

export async function fetchAnalysis(contactId: string): Promise<CallAnalysis> {
  const transcript: TranscriptTurn[] = [];
  const categories = new Set<string>();
  let summary: string | null = null;
  let status: CallAnalysis['status'] = 'ready';
  let token: string | undefined;
  try {
    do {
      const res = await connect.send(
        new ListRealtimeContactAnalysisSegmentsV2Command({
          InstanceId: CONNECT_INSTANCE_ID,
          ContactId: contactId,
          OutputType: 'Raw',
          SegmentTypes: ['Transcript', 'Categories', 'PostContactSummary'],
          MaxResults: 100,
          NextToken: token,
        }),
      );
      if (res.Status === 'IN_PROGRESS') status = 'pending';
      if (res.Status === 'FAILED') status = 'unavailable';
      for (const seg of res.Segments ?? []) {
        const t = seg.Transcript;
        if (t?.Content) {
          transcript.push({
            id: t.Id ?? String(transcript.length),
            role: t.ParticipantRole ?? 'UNKNOWN',
            text: t.Content,
            sentiment: t.Sentiment ?? null,
            at: t.Time?.AbsoluteTime ? t.Time.AbsoluteTime.toISOString() : null,
          });
        }
        const cats = seg.Categories?.MatchedDetails;
        if (cats) for (const name of Object.keys(cats)) categories.add(name);
        const pcs = seg.PostContactSummary;
        if (pcs?.Content) summary = pcs.Content;
      }
      token = res.NextToken;
    } while (token);
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    status = name === 'ResourceNotFoundException' ? 'pending' : 'unavailable';
  }
  if (status === 'ready' && transcript.length === 0) status = 'pending';
  return { status, transcript, categories: [...categories], summary, fetchedAt: new Date().toISOString() };
}

export function fallbackSummary(analysis: CallAnalysis): string | null {
  if (analysis.summary) return analysis.summary;
  const customer = analysis.transcript.filter((t) => t.role === 'CUSTOMER').map((t) => t.text.trim()).filter(Boolean);
  if (customer.length === 0) return null;
  const text = customer.slice(-3).join(' ');
  return text.length > 240 ? text.slice(0, 237) + '…' : text;
}

export async function findRecordingKey(contactId: string, at: Date | null): Promise<string | null> {
  const prefixes: string[] = [];
  if (at) {
    const y = at.getUTCFullYear();
    const m = String(at.getUTCMonth() + 1).padStart(2, '0');
    const d = String(at.getUTCDate()).padStart(2, '0');
    prefixes.push(`${RECORDING_PREFIX}connect/bcabc/CallRecordings/${y}/${m}/${d}/`);
  }
  prefixes.push(RECORDING_PREFIX);
  for (const prefix of prefixes) {
    let token: string | undefined;
    do {
      const res = await s3.send(new ListObjectsV2Command({ Bucket: RECORDING_BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }));
      const hit = (res.Contents ?? []).find((o) => o.Key && o.Key.includes(contactId) && /\.(wav|mp3|ogg)$/i.test(o.Key));
      if (hit?.Key) return hit.Key;
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  }
  return null;
}

export function keyFromLocation(location: string): string {
  const trimmed = location.replace(/^s3:\/\//, '');
  return trimmed.startsWith(RECORDING_BUCKET + '/') ? trimmed.slice(RECORDING_BUCKET.length + 1) : trimmed;
}

export async function fetchRecording(key: string): Promise<Uint8Array | null> {
  const res = await s3.send(new GetObjectCommand({ Bucket: RECORDING_BUCKET, Key: key }));
  if (!res.Body) return null;
  return res.Body.transformToByteArray();
}
