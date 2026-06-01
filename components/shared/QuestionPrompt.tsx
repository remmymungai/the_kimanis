import { cn } from "@/lib/utils";

type Props = {
  prompt: string;
  questionNumber?: number;
  totalQuestions?: number;
  mediaUrl?: string | null;
  className?: string;
};

export function QuestionPrompt({ prompt, questionNumber, totalQuestions, mediaUrl, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", className)}>
      {questionNumber !== undefined && totalQuestions !== undefined && (
        <span className="text-xs font-semibold tracking-widest uppercase text-olive/70">
          Question {questionNumber} of {totalQuestions}
        </span>
      )}

      {mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt="Question media"
          className="w-full max-w-xs rounded-2xl object-cover max-h-48 shadow-md"
        />
      )}

      <p className="text-2xl font-bold text-dark leading-tight text-balance max-w-xs">
        {prompt}
      </p>
    </div>
  );
}
