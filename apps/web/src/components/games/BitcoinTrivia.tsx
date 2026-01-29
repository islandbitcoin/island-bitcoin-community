import { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Zap, RefreshCw, CheckCircle, XCircle, Menu, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGameWallet } from "@/hooks/useGameWallet";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useStartSession,
  useSubmitAnswer,
  useTriviaProgress,
  useCurrentSession,
  TriviaApiError,
  type TriviaQuestion,
  type TriviaSession,
} from "@/hooks/useTriviaQuestions";
import { LevelSelector } from "./LevelSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const BitcoinTrivia = memo(function BitcoinTrivia() {
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const [session, setSession] = useState<TriviaSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answerResult, setAnswerResult] = useState<{
    correct: boolean;
    satsEarned: number;
    explanation: string;
  } | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { balance, refreshBalance } = useGameWallet();
  const { user } = useCurrentUser();
  const { start } = useStartSession();
  const { submit } = useSubmitAnswer();
  const { data: progress, refetch: refetchProgress } = useTriviaProgress();
  const { data: currentSessionData } = useCurrentSession();

  const currentLevel = progress?.currentLevel ?? 1;
  const currentQuestion: TriviaQuestion | null =
    session?.questions[currentQuestionIndex] ?? null;

  useEffect(() => {
    if (!session?.expiresAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)
      );
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        setSession(null);
        setSessionError("Session expired. Start a new session to continue.");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.expiresAt]);

  const startNewSession = useCallback(
    async (level: number) => {
      console.log('[BitcoinTrivia] Starting new session', { level, user: !!user, signer: !!user?.signer });
      setIsStartingSession(true);
      setSessionError(null);
      setSession(null);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setShowResult(false);
      setAnswerResult(null);

      try {
        const newSession = await start(level);
        console.log('[BitcoinTrivia] Session started successfully', newSession);
        setSession(newSession);
       } catch (error) {
         console.error("[BitcoinTrivia] Failed to start trivia session:", error);
         console.error("[BitcoinTrivia] Error details:", {
           message: error instanceof Error ? error.message : String(error),
           stack: error instanceof Error ? error.stack : undefined,
           type: error?.constructor?.name
         });
         // Set error to prevent auto-retry loop, but UI will show "Session Complete"
         setSessionError("failed");
       } finally {
        setIsStartingSession(false);
      }
    },
    [start, user]
  );

  // Restore session from server on page load
  useEffect(() => {
    if (currentSessionData && !session) {
      console.log('[BitcoinTrivia] Restoring session from server', currentSessionData);
      setSession(currentSessionData);
      setCurrentQuestionIndex(0);
    }
  }, [currentSessionData, session]);

  useEffect(() => {
    // Wait for user state to be determined before auto-starting
    // If user is defined (even if null), we know auth state is ready
    if (user === undefined) return;
    
    if (!session && !sessionError && !isStartingSession && currentLevel > 0) {
      startNewSession(currentLevel);
    }
  }, [user, session, sessionError, isStartingSession, currentLevel, startNewSession]);

  const handleAnswer = async (answerIndex: number) => {
    if (showResult || !currentQuestion || !session) return;

    setSelectedAnswer(answerIndex);
    setShowResult(true);

    try {
      const result = await submit(
        session.sessionId,
        currentQuestion.id,
        answerIndex
      );

      setAnswerResult({
        correct: result.correct,
        satsEarned: result.satsEarned,
        explanation: result.explanation,
      });

      refreshBalance();
      refetchProgress();

      if (result.levelUnlocked) {
        refetchProgress();
      }
    } catch (err) {
      if (err instanceof TriviaApiError && (err.status === 410 || err.status === 400)) {
        setSession(null);
        setSessionError("Session expired. Start a new session to continue.");
        return;
      }
      setAnswerResult({
        correct: false,
        satsEarned: 0,
        explanation: "Failed to submit answer. Please try again.",
      });
    }
  };

  const nextQuestion = () => {
    if (!session) return;
    const nextIdx = currentQuestionIndex + 1;
    if (nextIdx < session.questions.length) {
      setCurrentQuestionIndex(nextIdx);
      setSelectedAnswer(null);
      setShowResult(false);
      setAnswerResult(null);
    } else {
      setSession(null);
      refetchProgress();
    }
  };

  const changeLevel = (newLevel: number) => {
    setSession(null);
    setSessionError(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnswerResult(null);
    setShowLevelSelector(false);
    startNewSession(newLevel);
  };

  const accuracy =
    progress && progress.questionsAnswered > 0
      ? Math.round((progress.correct / progress.questionsAnswered) * 100)
      : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-lg border border-caribbean-sand bg-card p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Brain className="h-5 w-5 text-caribbean-ocean" />
              Bitcoin Trivia - Level {currentLevel}
            </h2>
            <p className="text-sm text-muted-foreground">
              Test your knowledge and earn sats!
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Zap className="h-4 w-4 text-caribbean-mango" />
              <span className="font-semibold">{balance?.balance || 0} sats</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Streak: {progress?.streak ?? 0}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-caribbean-ocean">
              {progress?.questionsAnswered ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Questions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-caribbean-palm">{accuracy}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-caribbean-sunset">
              {progress?.bestStreak ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Best Streak</p>
          </div>
        </div>

        {timeRemaining !== null && session && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className={cn(timeRemaining < 60 && "text-red-500 font-semibold")}>
              {formatTime(timeRemaining)} remaining
            </span>
          </div>
        )}

        {isStartingSession ? (
          <div className="space-y-4">
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-full bg-muted animate-pulse rounded" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 w-full bg-muted animate-pulse rounded" />
              ))}
            </div>
            <p className="text-center text-muted-foreground">Starting session...</p>
          </div>
         ) : currentQuestion ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "px-2 py-1 text-xs rounded-full",
                  currentQuestion.difficulty === "easy" && "bg-green-100 text-green-700",
                  currentQuestion.difficulty === "medium" && "bg-yellow-100 text-yellow-700",
                  currentQuestion.difficulty === "hard" && "bg-red-100 text-red-700"
                )}
              >
                {currentQuestion.difficulty}
              </span>
              <span className="px-2 py-1 text-xs rounded-full border">
                {currentQuestion.category}
              </span>
            </div>

            <h3 className="text-lg font-medium">{currentQuestion.question}</h3>

            <div className="space-y-2">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = showResult && answerResult?.correct && isSelected;
                const isIncorrect = showResult && !answerResult?.correct && isSelected;

                return (
                  <Button
                    key={index}
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left h-auto py-3 px-4",
                      isCorrect && "border-green-500 bg-green-50",
                      isIncorrect && "border-red-500 bg-red-50",
                      !showResult && "hover:bg-caribbean-ocean/10"
                    )}
                    onClick={() => handleAnswer(index)}
                    disabled={showResult}
                  >
                    <span className="flex items-center gap-2 w-full">
                      {isCorrect && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {isIncorrect && <XCircle className="h-4 w-4 text-red-600" />}
                      {option}
                    </span>
                  </Button>
                );
              })}
            </div>

            {showResult && answerResult && (
              <div
                className={cn(
                  "p-4 rounded-lg",
                  answerResult.correct ? "bg-green-50" : "bg-red-50"
                )}
              >
                <p className="text-sm font-medium">
                  {answerResult.correct
                    ? `Correct! +${answerResult.satsEarned} sats`
                    : "Incorrect. Keep learning!"}
                </p>
                {answerResult.explanation && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {answerResult.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : !session ? (
          <div className="space-y-3">
            <div className="p-4 bg-caribbean-mango/10 rounded-lg text-center">
              <h3 className="text-lg font-semibold mb-2">
                Session Complete!
              </h3>
              <p className="text-sm text-muted-foreground">
                {progress?.levelCompleted
                  ? "Level complete! Ready for harder questions?"
                  : "Start a new session to keep playing."}
              </p>
            </div>
            <Button
              onClick={() => startNewSession(currentLevel)}
              className="w-full bg-caribbean-mango hover:bg-caribbean-mango/90"
              disabled={isStartingSession}
            >
              <Brain className="mr-2 h-4 w-4" />
              {progress?.levelCompleted && currentLevel < 21
                ? `Start Level ${currentLevel + 1}`
                : "Start New Session"}
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading questions...</p>
          </div>
        )}

        {showResult && currentQuestion && session && (
          <Button
            onClick={nextQuestion}
            className="w-full bg-caribbean-ocean hover:bg-caribbean-ocean/90"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {currentQuestionIndex + 1 < (session?.questions.length ?? 0)
              ? "Next Question"
              : "Finish Session"}
          </Button>
        )}

        {session && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Session Progress</span>
              <span>
                {currentQuestionIndex + (showResult ? 1 : 0)} / {session.questions.length}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-caribbean-ocean transition-all"
                style={{
                  width: `${((currentQuestionIndex + (showResult ? 1 : 0)) / Math.max(session.questions.length, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => setShowLevelSelector(true)}
          className="w-full"
        >
          <Menu className="mr-2 h-4 w-4" />
          Choose Different Level
        </Button>
      </div>

      <Dialog open={showLevelSelector} onOpenChange={setShowLevelSelector}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Your Level</DialogTitle>
            <DialogDescription>
              Select a level to play. Complete levels to unlock new challenges!
            </DialogDescription>
          </DialogHeader>
          <LevelSelector
            currentLevel={currentLevel}
            onSelectLevel={changeLevel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
});
