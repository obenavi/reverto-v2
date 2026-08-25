/**
 * Proof attached to a dispute.
 *
 * The opposite policy to the identity checks, and deliberately so. An ID photo
 * is destroyed because keeping it creates risk and answers no later question.
 * Evidence is kept because it IS the later question — it is what an
 * administrator decides on, and it is the record a party may need for a claim
 * that is not ours to decide.
 *
 * The bucket is private. Nothing is ever served from a public URL; an admin
 * route mints a short-lived signed link when a reviewer opens the dispute.
 */
import { supabaseAdmin } from './supabase';

export const EVIDENCE_BUCKET = 'dispute-evidence';
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_SIDE = 8;

export const ALLOWED_EVIDENCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

/** How long a reviewer's link to a file stays good. Minutes, not days. */
export const SIGNED_URL_SECONDS = 15 * 60;

export type EvidenceSide = 'neighbor' | 'operator';

/**
 * Where a file lives. Namespaced by dispute so a stray listing cannot leak
 * across cases, and randomised so the path is not guessable from the dispute
 * id alone.
 */
export function evidencePath(disputeId: string, side: EvidenceSide, fileName: string): string {
  const extension = (fileName.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${disputeId}/${side}/${crypto.randomUUID()}.${extension || 'bin'}`;
}

export async function storeEvidence(args: {
  disputeId: string;
  side: EvidenceSide;
  file: File;
  caption: string | null;
  ip: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();

  const { count } = await db
    .from('dispute_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('dispute_id', args.disputeId)
    .eq('side', args.side);

  if ((count ?? 0) >= MAX_FILES_PER_SIDE) {
    return { ok: false, error: `You can attach up to ${MAX_FILES_PER_SIDE} files.` };
  }

  const path = evidencePath(args.disputeId, args.side, args.file.name);

  const { error: uploadError } = await db.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, await args.file.arrayBuffer(), {
      contentType: args.file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[evidence] upload failed', uploadError);
    return { ok: false, error: 'Could not save that file.' };
  }

  const { error } = await db.from('dispute_evidence').insert({
    dispute_id: args.disputeId,
    side: args.side,
    storage_path: path,
    mime_type: args.file.type,
    size_bytes: args.file.size,
    caption: args.caption,
    uploaded_ip: args.ip,
  });

  if (error) {
    console.error('[evidence] row failed', error);
    // Don't leave an orphan in the bucket that nothing points at.
    await db.storage.from(EVIDENCE_BUCKET).remove([path]);
    return { ok: false, error: 'Could not save that file.' };
  }

  return { ok: true };
}

export type SignedEvidence = {
  id: string;
  side: EvidenceSide;
  caption: string | null;
  mimeType: string;
  createdAt: string;
  url: string | null;
};

/** Everything attached to one dispute, with short-lived links. Admin only. */
export async function signedEvidenceFor(disputeId: string): Promise<SignedEvidence[]> {
  const db = supabaseAdmin();

  const { data } = await db
    .from('dispute_evidence')
    .select('id, side, caption, mime_type, storage_path, created_at')
    .eq('dispute_id', disputeId)
    .order('created_at');

  if (!data?.length) return [];

  const signed = await Promise.all(
    data.map(async (row) => {
      const { data: link } = await db.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);

      return {
        id: row.id,
        side: row.side as EvidenceSide,
        caption: row.caption,
        mimeType: row.mime_type,
        createdAt: row.created_at,
        url: link?.signedUrl ?? null,
      };
    })
  );

  return signed;
}
