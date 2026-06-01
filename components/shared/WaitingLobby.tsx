import { cn } from "@/lib/utils";

type Props = {
  message?: string;
  className?: string;
};

export function WaitingLobby({ message = "Get ready for the next question...", className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-6 p-8 text-center", className)}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-olive animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-3 h-3 rounded-full bg-olive animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-3 h-3 rounded-full bg-olive animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <p className="text-base text-muted-foreground font-medium">{message}</p>
    </div>
  );
}
