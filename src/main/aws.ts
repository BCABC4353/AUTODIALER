import fs from 'node:fs';
import {
  ConnectCampaignsV2Client,
  CreateCampaignCommand,
  DescribeCampaignCommand,
  GetCampaignStateCommand,
  PauseCampaignCommand,
  PutOutboundRequestBatchCommand,
  ResumeCampaignCommand,
  StartCampaignCommand,
  type OutboundRequest,
} from '@aws-sdk/client-connectcampaignsv2';
import {
  ConnectClient,
  DescribeContactCommand,
  GetContactAttributesCommand,
  GetCurrentUserDataCommand,
  SearchContactsCommand,
  type Contact,
} from '@aws-sdk/client-connect';
import { userDataFile } from './db';

export const AWS_REGION = 'us-west-2';
export const CONNECT_INSTANCE_ID = 'e455d73d-802c-42db-bcbb-8074082a99e8';
export const DEFAULT_CAMPAIGN_ID = 'fa2187a0-f3ec-451d-8dd4-586fe6398e6a';
export const CAMPAIGN_NAME = 'PatientClaimFollowUp';
export const QUEUE_ID = '964b55f7-4faa-4db3-bcd2-909f1e884cb5';
export const CALLER_ID = '+12139344537';

const DEAD_STATES = new Set(['Stopped', 'Completed', 'Failed']);

interface CampaignFile {
  id: string;
  name: string;
}

function readCampaignFile(): CampaignFile {
  const file = userDataFile('campaign.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<CampaignFile>;
    if (parsed.id) return { id: parsed.id, name: parsed.name ?? CAMPAIGN_NAME };
  } catch {
    /* fall through */
  }
  return { id: DEFAULT_CAMPAIGN_ID, name: CAMPAIGN_NAME };
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AgentSnapshot {
  available: boolean;
  contactIds: string[];
  reachable: boolean;
}

export class Aws {
  private campaigns = new ConnectCampaignsV2Client({ region: AWS_REGION });
  private connect = new ConnectClient({ region: AWS_REGION });
  campaign: CampaignFile = readCampaignFile();
  note: string | null = null;

  async campaignState(): Promise<string> {
    const res = await this.campaigns.send(new GetCampaignStateCommand({ id: this.campaign.id }));
    return res.state ?? 'Unknown';
  }

  async recreateCampaign(): Promise<void> {
    const old = await this.campaigns.send(new DescribeCampaignCommand({ id: this.campaign.id }));
    const name = `${CAMPAIGN_NAME}-${stamp()}`;
    const created = await this.campaigns.send(
      new CreateCampaignCommand({
        name,
        connectInstanceId: CONNECT_INSTANCE_ID,
        channelSubtypeConfig: old.campaign?.channelSubtypeConfig,
      }),
    );
    if (!created.id) throw new Error('CreateCampaign returned no id');
    this.campaign = { id: created.id, name };
    fs.writeFileSync(userDataFile('campaign.json'), JSON.stringify(this.campaign), 'utf8');
    this.note = `previous campaign was stopped; created ${name}`;
  }

  async ensureRunning(): Promise<string> {
    let state = await this.campaignState();
    if (state === 'Running') return state;
    if (DEAD_STATES.has(state)) {
      await this.recreateCampaign();
      state = await this.campaignState();
    }
    if (state === 'Paused') {
      await this.campaigns.send(new ResumeCampaignCommand({ id: this.campaign.id }));
    } else if (state !== 'Running') {
      await this.campaigns.send(new StartCampaignCommand({ id: this.campaign.id }));
    }
    for (let i = 0; i < 20; i += 1) {
      await sleep(1000);
      state = await this.campaignState();
      if (state === 'Running') return state;
    }
    return state;
  }

  async pauseCampaign(): Promise<void> {
    try {
      await this.campaigns.send(new PauseCampaignCommand({ id: this.campaign.id }));
    } catch {
      /* already paused or not running */
    }
  }

  async agentSnapshot(): Promise<AgentSnapshot> {
    try {
      const data = await this.connect.send(
        new GetCurrentUserDataCommand({ InstanceId: CONNECT_INSTANCE_ID, Filters: { Queues: [QUEUE_ID] } }),
      );
      let available = false;
      const contactIds: string[] = [];
      for (const user of data.UserDataList ?? []) {
        const status = user.Status?.StatusName;
        const slots = user.AvailableSlotsByChannel?.VOICE ?? 0;
        if (status === 'Available' && slots > 0) available = true;
        for (const contact of user.Contacts ?? []) {
          if (contact.ContactId) contactIds.push(contact.ContactId);
        }
      }
      return { available, contactIds, reachable: true };
    } catch {
      return { available: true, contactIds: [], reachable: false };
    }
  }

  async send(batch: OutboundRequest[]) {
    const res = await this.campaigns.send(
      new PutOutboundRequestBatchCommand({ id: this.campaign.id, outboundRequests: batch }),
    );
    return { accepted: res.successfulRequests ?? [], failed: res.failedRequests ?? [] };
  }

  async recentContactIds(minutes = 20): Promise<string[]> {
    const now = new Date();
    const res = await this.connect.send(
      new SearchContactsCommand({
        InstanceId: CONNECT_INSTANCE_ID,
        TimeRange: {
          Type: 'INITIATION_TIMESTAMP',
          StartTime: new Date(now.getTime() - minutes * 60 * 1000),
          EndTime: now,
        },
        MaxResults: 50,
      }),
    );
    return (res.Contacts ?? []).map((c) => c.Id).filter((id): id is string => Boolean(id));
  }

  async describe(contactId: string): Promise<Contact> {
    const res = await this.connect.send(
      new DescribeContactCommand({ InstanceId: CONNECT_INSTANCE_ID, ContactId: contactId }),
    );
    return res.Contact ?? {};
  }

  async attributes(contactId: string): Promise<Record<string, string>> {
    try {
      const res = await this.connect.send(
        new GetContactAttributesCommand({ InstanceId: CONNECT_INSTANCE_ID, InitialContactId: contactId }),
      );
      return res.Attributes ?? {};
    } catch {
      return {};
    }
  }
}

export function buildRequest(
  run: string,
  phone: string,
  patient: string | null,
  balance: number | null,
  now: Date,
  expiryMinutes: number,
): OutboundRequest {
  return {
    clientToken: `${run}-${Math.floor(now.getTime() / 1000)}`,
    expirationTime: new Date(now.getTime() + expiryMinutes * 60 * 1000),
    channelSubtypeParameters: {
      telephony: {
        connectSourcePhoneNumber: CALLER_ID,
        destinationPhoneNumber: '+1' + phone,
        attributes: {
          PATIENT: patient ?? '',
          RUN: run,
          BALANCE: balance === null ? '' : balance.toFixed(2),
          BALANCE_SPOKEN: balance === null ? '' : String(Math.round(balance)),
          TRIPDATE: '',
        },
      },
    },
  };
}
