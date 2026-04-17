import { z } from 'zod';

// ---------- On-disk records ----------

export const AgentRecord = z.object({
  name: z.string(),
  task_description: z.string(),
  session_id: z.string().nullable(),
  registered_at: z.string(),
  last_active: z.string(),
});
export type AgentRecord = z.infer<typeof AgentRecord>;

export const MessageRecord = z.object({
  msg_id: z.string(),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  thread_id: z.string().nullable(),
  sent_at: z.string(),
});
export type MessageRecord = z.infer<typeof MessageRecord>;

export const LeaseRecord = z.object({
  holder: z.string(),
  ttl_s: z.number().int().positive(),
  acquired_at_ms: z.number().int().nonnegative(),
  expires_at_ms: z.number().int().nonnegative(),
});
export type LeaseRecord = z.infer<typeof LeaseRecord>;

// ---------- Tool inputs ----------

export const RegisterInput = z.object({
  project_key: z.string().min(1),
  task_description: z.string().min(1),
  session_id: z.string().optional(),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const SendMessageInput = z.object({
  project_key: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  subject: z.string().min(1),
  body: z.string(),
  thread_id: z.string().optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageInput>;

export const ReceiveMessagesInput = z.object({
  project_key: z.string().min(1),
  agent_name: z.string().min(1),
  block: z.boolean().optional(),
  timeout_s: z.number().int().min(1).max(600).optional(),
});
export type ReceiveMessagesInput = z.infer<typeof ReceiveMessagesInput>;

export const ListAgentsInput = z.object({
  project_key: z.string().min(1),
});
export type ListAgentsInput = z.infer<typeof ListAgentsInput>;

export const AcquireLeaseInput = z.object({
  project_key: z.string().min(1),
  name: z.string().min(1),
  holder: z.string().min(1),
  ttl_s: z.number().int().positive().max(86_400),
});
export type AcquireLeaseInput = z.infer<typeof AcquireLeaseInput>;

export const ReleaseLeaseInput = z.object({
  project_key: z.string().min(1),
  name: z.string().min(1),
  holder: z.string().min(1),
});
export type ReleaseLeaseInput = z.infer<typeof ReleaseLeaseInput>;

// ---------- Tool outputs ----------

export const RegisterOutput = z.object({
  name: z.string(),
  slug: z.string(),
});
export type RegisterOutput = z.infer<typeof RegisterOutput>;

export const SendMessageOutput = z.object({
  msg_id: z.string(),
  sent_at: z.string(),
});
export type SendMessageOutput = z.infer<typeof SendMessageOutput>;

export const ReceiveMessagesOutput = z.object({
  messages: z.array(MessageRecord),
});
export type ReceiveMessagesOutput = z.infer<typeof ReceiveMessagesOutput>;

export const ListAgentsOutput = z.object({
  slug: z.string(),
  agents: z.array(
    z.object({
      name: z.string(),
      task_description: z.string(),
      registered_at: z.string(),
      last_active: z.string(),
    }),
  ),
});
export type ListAgentsOutput = z.infer<typeof ListAgentsOutput>;

export const AcquireLeaseOutput = z.object({
  acquired: z.boolean(),
  holder: z.string(),
  expires_at: z.string(),
});
export type AcquireLeaseOutput = z.infer<typeof AcquireLeaseOutput>;

export const ReleaseLeaseOutput = z.object({
  released: z.boolean(),
});
export type ReleaseLeaseOutput = z.infer<typeof ReleaseLeaseOutput>;
