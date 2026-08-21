'use client';

import { useState } from 'react';
import { EmptyState, Notice } from '@/components/ui';
import type { GalleryPhoto } from '@/lib/types';
import { useMutate } from './useMutate';

export default function GalleryPanel({ photos }: { photos: GalleryPhoto[] }) {
  const { mutate, busy, error } = useMutate();
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');

  async function addPhoto(event: React.FormEvent) {
    event.preventDefault();
    const ok = await mutate('/api/operators/gallery', {
      method: 'POST',
      body: { url, caption, sort_order: photos.length },
    });
    if (ok) {
      setUrl('');
      setCaption('');
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addPhoto} className="card space-y-3">
        <p className="font-bold">Show off your work</p>
        <div>
          <label htmlFor="url">Photo URL</label>
          <input
            id="url"
            type="url"
            required
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="caption">Caption</label>
          <input
            id="caption"
            placeholder="Mrs. Patel's car, spotless"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn-primary w-full" disabled={busy}>
          Add photo
        </button>
      </form>

      {photos.length === 0 ? (
        <EmptyState title="No photos yet" hint="A few good photos make neighbors much likelier to book." />
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="card !p-2">
              {/* Arbitrary external hosts, so a plain img avoids next/image domain config. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption ?? 'Work photo'}
                className="h-32 w-full rounded-btn object-cover"
                loading="lazy"
              />
              {photo.caption && <p className="mt-1 text-[13px]">{photo.caption}</p>}
              <button
                className="btn-secondary mt-2 w-full"
                disabled={busy}
                onClick={() => mutate(`/api/operators/gallery?id=${photo.id}`, { method: 'DELETE' })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
