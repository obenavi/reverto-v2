'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/ui';
import { relativeTime } from '@/lib/format';
import ChatThread from '@/components/ChatThread';
import type { Conversation } from '@/lib/types';

type ConversationRow = Conversation & {
  bookings: { id: string; status: string } | null;
};

export default function MessagesPanel({ conversations }: { conversations: ConversationRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        hint="A thread opens automatically with every booking."
      />
    );
  }

  if (openId) {
    return (
      <div className="space-y-3">
        <button className="btn-secondary" onClick={() => setOpenId(null)}>
          ← All conversations
        </button>
        <ChatThread conversationId={openId} />
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <button
            className="card flex w-full items-center justify-between text-left hover:border-brand"
            onClick={() => setOpenId(conversation.id)}
          >
            <span>
              <span className="font-bold">{conversation.client_name}</span>
              <span className="block text-[13px] text-ink-muted">
                {conversation.bookings?.status ?? 'booking'} ·{' '}
                {relativeTime(conversation.last_message_at)}
              </span>
            </span>
            <span className="text-brand">→</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
