import { cn } from "@/lib/utils";

type Props = {
  message?: string;
  gameTitle?: string;
  className?: string;
};

export function WaitingLobby({ message, gameTitle, className }: Props) {
  const text = message ?? (gameTitle ? `Get ready for ${gameTitle}…` : "Get ready for the next question…");
  return (
    <div className={cn("min-h-dvh bg-cream flex flex-col items-center justify-center gap-6 p-8 text-center", className)}>
      {gameTitle && (
        <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">
          Up next
        </span>
      )}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-olive animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-3 h-3 rounded-full bg-olive animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-3 h-3 rounded-full bg-olive animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <p className="text-lg text-dark font-semibold text-balance max-w-xs">{text}</p>
    </div>
  );
}
