import { ConnectClient, DescribeUserCommand, type Contact } from '@aws-sdk/client-connect';
import { ConnectContactLensClient, ListRealtimeContactAnalysisSegmentsCommand, type RealtimeContactAnalysisSegment } from '@aws-sdk/client-connect-contact-lens';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { AWS_REGION, CONNECT_INSTANCE_ID } from './aws';
import { HIDDEN_CATEGORIES } from '../shared/categories';
import type { CallAnalysis, CallCharacteristics, ContactDetail, ExtractedFact, LiveLens, TranscriptTurn } from '../shared/types';

export const RECORDING_BUCKET = 'bcabc-connect-638647552089';
const RECORDING_PREFIX = 'recordings/';

const connect = new ConnectClient({ region: AWS_REGION });
const lens = new ConnectContactLensClient({ region: AWS_REGION });
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

function visibleCategories(names: Iterable<string>): string[] {
  return [...new Set(names)].filter((n) => !HIDDEN_CATEGORIES.has(n));
}

async function listSegments(contactId: string): Promise<RealtimeContactAnalysisSegment[]> {
  const segments: RealtimeContactAnalysisSegment[] = [];
  let token: string | undefined;
  do {
    const res = await lens.send(new ListRealtimeContactAnalysisSegmentsCommand({ InstanceId: CONNECT_INSTANCE_ID, ContactId: contactId, MaxResults: 100, NextToken: token }));
    segments.push(...(res.Segments ?? []));
    token = res.NextToken && (res.Segments ?? []).length > 0 ? res.NextToken : undefined;
  } while (token);
  return segments;
}

function extractedFrom(segments: RealtimeContactAnalysisSegment[]): ExtractedFact[] {
  const out = new Map<string, ExtractedFact>();
  for (const seg of segments) {
    const e = seg.ExtractedInformation;
    if (!e?.ExtractionDefinitionName) continue;
    const value = (e.ExtractedValues ?? []).map((v) => v.Content).filter(Boolean).join('; ');
    if (value) out.set(e.ExtractionDefinitionName, { name: e.ExtractionDefinitionName, label: e.ExtractionDefinitionDisplayLabel ?? e.ExtractionDefinitionName, value });
  }
  return [...out.values()];
}

export async function fetchAnalysis(contactId: string, at: Date | null): Promise<CallAnalysis> {
  const fetchedAt = new Date().toISOString();
  try {
    const file = await fetchCharacteristics(contactId, at);
    if (file && file.transcript.length > 0) {
      return { status: 'ready', transcript: file.transcript, categories: file.categories, summary: file.summary, characteristics: file.characteristics, extracted: file.extracted, actions: [], fetchedAt };
    }
  } catch {
    /* fall through to the live segments */
  }
  const transcript: TranscriptTurn[] = [];
  const categories = new Set<string>();
  let summary: string | null = null;
  let status: CallAnalysis['status'] = 'ready';
  let segments: RealtimeContactAnalysisSegment[] = [];
  try {
    segments = await listSegments(contactId);
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    status = name === 'ResourceNotFoundException' || name === 'InvalidRequestException' ? 'pending' : 'unavailable';
  }
  for (const seg of segments) {
    const t = seg.Transcript;
    if (t?.Content) {
      transcript.push({ id: t.Id ?? String(transcript.length), role: t.ParticipantRole ?? 'UNKNOWN', text: t.Content, sentiment: t.Sentiment ?? null, at: null });
    }
    for (const name of seg.Categories?.MatchedCategories ?? []) categories.add(name);
    if (seg.PostContactSummary?.Content) summary = seg.PostContactSummary.Content;
  }
  if (status === 'ready' && transcript.length === 0) status = 'pending';
  return { status, transcript, categories: visibleCategories(categories), summary, characteristics: null, extracted: extractedFrom(segments), actions: [], fetchedAt };
}

export async function fetchLive(contactId: string): Promise<LiveLens | null> {
  let segments: RealtimeContactAnalysisSegment[];
  try {
    segments = await listSegments(contactId);
  } catch {
    return null;
  }
  const customer = segments.map((s) => s.Transcript).filter((t): t is NonNullable<typeof t> => Boolean(t?.Content) && t?.ParticipantRole === 'CUSTOMER');
  const recent: string[] = customer.slice(-3).flatMap((t) => (t.Sentiment ? [String(t.Sentiment)] : []));
  let sentiment: string | null = null;
  if (recent.length) {
    const score = recent.reduce((sum, s) => sum + (s === 'POSITIVE' ? 1 : s === 'NEGATIVE' ? -1 : 0), 0);
    sentiment = score > 0 ? 'POSITIVE' : score < 0 ? 'NEGATIVE' : recent.includes('MIXED') ? 'MIXED' : 'NEUTRAL';
  }
  const categories = new Set<string>();
  for (const seg of segments) for (const name of seg.Categories?.MatchedCategories ?? []) categories.add(name);
  return { sentiment, lastLine: customer[customer.length - 1]?.Content ?? '', categories: visibleCategories(categories) };
}

interface LensFile {
  JobStatus?: string;
  Categories?: { MatchedCategories?: string[] };
  ConversationCharacteristics?: {
    ContactSummary?: { PostContactSummary?: { Content?: string } };
    TotalConversationDurationMillis?: number;
    Sentiment?: {
      OverallSentiment?: { AGENT?: number; CUSTOMER?: number };
      SentimentByPeriod?: { QUARTER?: { AGENT?: { Score?: number }[]; CUSTOMER?: { Score?: number }[] } };
    };
    Interruptions?: { TotalCount?: number; TotalTimeMillis?: number; InterruptionsByInterrupter?: { AGENT?: unknown[]; CUSTOMER?: unknown[] } };
    NonTalkTime?: { TotalTimeMillis?: number };
    TalkSpeed?: { DetailsByParticipant?: { AGENT?: { AverageWordsPerMinute?: number }; CUSTOMER?: { AverageWordsPerMinute?: number } } };
    TalkTime?: { DetailsByParticipant?: { AGENT?: { TotalTimeMillis?: number }; CUSTOMER?: { TotalTimeMillis?: number } } };
  };
  ExtractedInformation?: { Extractions?: { Name?: string; DisplayLabel?: string; Value?: string }[] };
  Transcript?: {
    Id?: string;
    ParticipantId?: string;
    ParticipantRole?: string;
    Content?: string;
    Sentiment?: string;
    BeginOffsetMillis?: number;
    LoudnessScore?: number[];
    IssuesDetected?: { Text?: string }[];
    OutcomesDetected?: { Text?: string }[];
    ActionItemsDetected?: { Text?: string }[];
  }[];
}

export interface LensFileResult {
  characteristics: CallCharacteristics;
  summary: string | null;
  categories: string[];
  transcript: TranscriptTurn[];
  extracted: ExtractedFact[];
}

function sec(ms: number | undefined): number | null {
  return typeof ms === 'number' ? Math.round(ms / 100) / 10 : null;
}

function meanLoudness(turns: LensFile['Transcript'], who: string): number | null {
  const values: number[] = [];
  for (const t of turns ?? []) if ((t.ParticipantRole ?? t.ParticipantId) === who) for (const v of t.LoudnessScore ?? []) values.push(v);
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

function dayFolder(at: Date): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, '0');
  const d = String(at.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${d}/`;
}

export async function findAnalysisKey(contactId: string, at: Date | null): Promise<string | null> {
  const prefixes: string[] = [];
  if (at) {
    prefixes.push(`Analysis/Voice/${dayFolder(at)}`, `${RECORDING_PREFIX}Analysis/Voice/${dayFolder(at)}`);
  }
  prefixes.push('Analysis/Voice/', `${RECORDING_PREFIX}Analysis/`);
  for (const prefix of prefixes) {
    let token: string | undefined;
    do {
      const res = await s3.send(new ListObjectsV2Command({ Bucket: RECORDING_BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }));
      const hits = (res.Contents ?? []).filter((o) => o.Key && o.Key.includes(contactId) && o.Key.endsWith('.json'));
      if (hits.length) {
        const preferred = hits.filter((o) => !/Redacted/i.test(o.Key ?? ''));
        const pool = preferred.length ? preferred : hits;
        return pool.sort((a, b) => (b.Key ?? '').localeCompare(a.Key ?? ''))[0]?.Key ?? null;
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  }
  return null;
}

export async function fetchCharacteristics(contactId: string, at: Date | null): Promise<LensFileResult | null> {
  const key = await findAnalysisKey(contactId, at);
  if (!key) return null;
  const res = await s3.send(new GetObjectCommand({ Bucket: RECORDING_BUCKET, Key: key }));
  if (!res.Body) return null;
  const file = JSON.parse(await res.Body.transformToString()) as LensFile;
  if (file.JobStatus && file.JobStatus !== 'COMPLETED') return null;
  const cc = file.ConversationCharacteristics ?? {};
  const quarters = cc.Sentiment?.SentimentByPeriod?.QUARTER;
  const turns = file.Transcript ?? [];
  const collect = (field: 'IssuesDetected' | 'OutcomesDetected' | 'ActionItemsDetected') => turns.flatMap((t) => (t[field] ?? []).map((x) => x.Text ?? '').filter(Boolean));
  const characteristics: CallCharacteristics = {
    durationSeconds: sec(cc.TotalConversationDurationMillis),
    talkSeconds: { agent: sec(cc.TalkTime?.DetailsByParticipant?.AGENT?.TotalTimeMillis), customer: sec(cc.TalkTime?.DetailsByParticipant?.CUSTOMER?.TotalTimeMillis) },
    nonTalkSeconds: sec(cc.NonTalkTime?.TotalTimeMillis),
    interruptions: {
      count: cc.Interruptions?.TotalCount ?? 0,
      seconds: sec(cc.Interruptions?.TotalTimeMillis) ?? 0,
      byAgent: cc.Interruptions?.InterruptionsByInterrupter?.AGENT?.length ?? 0,
      byCustomer: cc.Interruptions?.InterruptionsByInterrupter?.CUSTOMER?.length ?? 0,
    },
    wordsPerMinute: { agent: cc.TalkSpeed?.DetailsByParticipant?.AGENT?.AverageWordsPerMinute ?? null, customer: cc.TalkSpeed?.DetailsByParticipant?.CUSTOMER?.AverageWordsPerMinute ?? null },
    loudness: { agent: meanLoudness(turns, 'AGENT'), customer: meanLoudness(turns, 'CUSTOMER') },
    sentiment: { agent: cc.Sentiment?.OverallSentiment?.AGENT ?? null, customer: cc.Sentiment?.OverallSentiment?.CUSTOMER ?? null },
    sentimentByQuarter: {
      agent: (quarters?.AGENT ?? []).map((q) => q.Score ?? 0),
      customer: (quarters?.CUSTOMER ?? []).map((q) => q.Score ?? 0),
    },
    issues: collect('IssuesDetected'),
    outcomes: collect('OutcomesDetected'),
    actionItems: collect('ActionItemsDetected'),
  };
  const transcript: TranscriptTurn[] = turns
    .filter((t) => t.Content)
    .map((t, i) => ({ id: t.Id ?? String(i), role: t.ParticipantRole ?? t.ParticipantId ?? 'UNKNOWN', text: t.Content ?? '', sentiment: t.Sentiment ?? null, at: null }));
  const extracted: ExtractedFact[] = (file.ExtractedInformation?.Extractions ?? [])
    .filter((e) => e.Name && e.Value)
    .map((e) => ({ name: e.Name ?? '', label: e.DisplayLabel ?? e.Name ?? '', value: e.Value ?? '' }));
  return {
    characteristics,
    summary: cc.ContactSummary?.PostContactSummary?.Content ?? null,
    categories: visibleCategories(file.Categories?.MatchedCategories ?? []),
    transcript,
    extracted,
  };
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
    prefixes.push(`${RECORDING_PREFIX}${dayFolder(at)}`, `${RECORDING_PREFIX}connect/bcabc/CallRecordings/${dayFolder(at)}`);
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
