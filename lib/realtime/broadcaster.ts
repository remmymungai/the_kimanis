import { createClient } from "@supabase/supabase-js";
import type { RealtimeMessage } from "@/types/realtime";
import { SESSION_CHANNEL } from "@/lib/games";

export function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { params: { eventsPerSecond: 20 } } }
  );
}

/** Subscribe, send one broadcast, then tear down — reliable for server-side one-offs. */
async function sendOnChannel(channelName: string, payload: RealtimeMessage): Promise<void> {
  const supabase = getAdminSupabase();
  const channel = supabase.channel(channelName, { config: { broadcast: { ack: true } } });

  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") resolve();
    });
    // Safety timeout so a flaky connection never hangs the request
    setTimeout(resolve, 2000);
  });

  await channel.send({ type: "broadcast", event: "game_event", payload });
  await supabase.removeChannel(channel);
}

export async function broadcastGameEvent(
  gameInstanceId: string,
  payload: RealtimeMessage
): Promise<void> {
  await sendOnChannel(`game:${gameInstanceId}`, payload);
}

export async function broadcastEventWide(
  _eventId: string,
  payload: RealtimeMessage
): Promise<void> {
  // Single party session → fixed channel that the lobby subscribes to.
  await sendOnChannel(SESSION_CHANNEL, payload);
}
