import { createClient } from "@supabase/supabase-js";
import type { RealtimeMessage } from "@/types/realtime";

export function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function broadcastGameEvent(
  gameInstanceId: string,
  payload: RealtimeMessage
): Promise<void> {
  const supabase = getAdminSupabase();
  const channel = supabase.channel(`game:${gameInstanceId}`);
  await channel.send({
    type: "broadcast",
    event: "game_event",
    payload,
  });
  await supabase.removeChannel(channel);
}

export async function broadcastEventWide(
  eventId: string,
  payload: RealtimeMessage
): Promise<void> {
  const supabase = getAdminSupabase();
  const channel = supabase.channel(`event:${eventId}`);
  await channel.send({
    type: "broadcast",
    event: "game_event",
    payload,
  });
  await supabase.removeChannel(channel);
}
