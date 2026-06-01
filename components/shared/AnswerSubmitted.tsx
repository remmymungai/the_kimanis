import { cn } from "@/lib/utils";

type Props = {
  answer: string;
  className?: string;
};

export function AnswerSubmitted({ answer, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 p-8 text-center animate-fade-in", className)}>
      <div className="w-16 h-16 rounded-full bg-sage/20 flex items-center justify-center text-3xl">
        ✓
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-medium mb-1">Your answer</p>
        <p className="text-lg font-bold text-dark">{answer}</p>
      </div>
      <p className="text-sm text-muted-foreground">Waiting for results...</p>
    </div>
  );
}
