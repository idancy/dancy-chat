import { writeExclusive } from '../fs/atomic.js';
import { messageFile } from '../fs/paths.js';
import {
  type MessageRecord,
  type SendMessageInput,
  type SendMessageOutput,
} from '../schemas.js';
import { newUlid } from '../util/ulid.js';

// Filenames use ISO timestamp + ULID so both humans and machines can
// sort chronologically. Colons in ISO timestamps are legal on macOS/
// Linux filesystems; we replace them with dashes defensively.
const filenameFor = (sentAt: string, msgId: string): string => {
  const safeTs = sentAt.replace(/:/g, '-');
  return `${safeTs}-${msgId}.json`;
};

export const sendMessage = async (input: SendMessageInput): Promise<SendMessageOutput> => {
  const { project_key, from, to, subject, body, thread_id } = input;
  const msg_id = newUlid();
  const sent_at = new Date().toISOString();
  const record: MessageRecord = {
    msg_id,
    from,
    to,
    subject,
    body,
    thread_id: thread_id ?? null,
    sent_at,
  };
  const filename = filenameFor(sent_at, msg_id);
  await writeExclusive(
    messageFile(project_key, to, filename),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  return { msg_id, sent_at };
};
