import { useState, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Zap, RefreshCw, CheckCircle, XCircle, AlertCircle, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGameWallet } from "@/hooks/useGameWallet";
import {
  useTriviaQuestions,
  useSubmitAnswer,
  type TriviaQuestion,
} from "@/hooks/useTriviaQuestions";
import { LevelSelector } from "./LevelSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LocalProgress {
  totalQuestionsAnswered: number;
  correctAnswers: number;
  currentStreak: number;
  bestStreak: number;
  answeredQuestions: string[];
  satsEarned: number;
  currentLevel: number;
  levelCompleted: boolean;
}

const STORAGE_KEY = "bitcoinTriviaProgress";

function getStoredProgress(): LocalProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {
    totalQuestionsAnswered: 0,
    correctAnswers: 0,
    currentStreak: 0,
    bestStreak: 0,
    answeredQuestions: [],
    satsEarned: 0,
    currentLevel: 1,
    levelCompleted: false,
  };
}

function saveProgress(progress: LocalProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export const BitcoinTrivia = memo(function BitcoinTrivia() {
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<TriviaQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answerResult, setAnswerResult] = useState<{
    correct: boolean;
    satsEarned: number;
    explanation?: string;
  } | null>(null);
  const [progress, setProgress] = useState<LocalProgress>(getStoredProgress);

  const { balance, refreshBalance } = useGameWallet();
  const { submit } = useSubmitAnswer();
  const { data, isLoading, error, refetch } = useTriviaQuestions(progress.currentLevel);

  const questions = data?.questions || [];
  const serverProgress = data?.progress;

  useEffect(() => {
    if (serverProgress) {
      setProgress((prev) => ({
        ...prev,
        currentStreak: serverProgress.streak,
        bestStreak: Math.max(prev.bestStreak, serverProgress.bestStreak),
        satsEarned: serverProgress.satsEarned,
      }));
    }
  }, [serverProgress]);

  const getNextQuestion = () => {
    const unanswered = questions.filter(
      (q) => !progress.answeredQuestions.includes(q.id)
    );
    if (unanswered.length === 0) return null;
    return unanswered[Math.floor(Math.random() * unanswered.length)];
  };

  useEffect(() => {
    if (!currentQuestion && !progress.levelCompleted && questions.length > 0) {
      const next = getNextQuestion();
      if (next) {
        setCurrentQuestion(next);
      } else {
        setProgress((prev) => {
          const updated = { ...prev, levelCompleted: true };
          saveProgress(updated);
          return updated;
        });
      }
    }
  }, [questions.length, progress.levelCompleted, currentQuestion]);

  const handleAnswer = async (answerIndex: number) => {
    if (showResult || !currentQuestion) return;

    setSelectedAnswer(answerIndex);
    setShowResult(true);

    try {
      const result = await submit(
        currentQuestion.id,
        answerIndex,
        progress.currentLevel
      );

      setAnswerResult({
        correct: result.correct,
        satsEarned: result.satsEarned,
      });

      const newProgress: LocalProgress = {
        ...progress,
        totalQuestionsAnswered: progress.totalQuestionsAnswered + 1,
        correctAnswers: progress.correctAnswers + (result.correct ? 1 : 0),
        currentStreak: result.streak,
        bestStreak: Math.max(progress.bestStreak, result.streak),
        answeredQuestions: [...progress.answeredQuestions, currentQuestion.id],
        satsEarned: progress.satsEarned + result.satsEarned,
        levelCompleted: result.levelUnlocked,
      };

      if (result.levelUnlocked && progress.currentLevel < 21) {
        newProgress.currentLevel = progress.currentLevel + 1;
        newProgress.levelCompleted = false;
      }

      setProgress(newProgress);
      saveProgress(newProgress);
      refreshBalance();
    } catch (err) {
      setAnswerResult({
        correct: false,
        satsEarned: 0,
      });
    }
  };

  const nextQuestion = () => {
    const next = getNextQuestion();
    if (next) {
      setCurrentQuestion(next);
      setSelectedAnswer(null);
      setShowResult(false);
      setAnswerResult(null);
    } else {
      setProgress((prev) => {
        const updated = { ...prev, levelCompleted: true };
        saveProgress(updated);
        return updated;
      });
    }
  };

  const startNextLevel = () => {
    const newLevel = progress.currentLevel + 1;
    changeLevel(newLevel);
  };

  const changeLevel = (newLevel: number) => {
    const newProgress = {
      ...progress,
      currentLevel: newLevel,
      levelCompleted: false,
    };
    setProgress(newProgress);
    saveProgress(newProgress);
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnswerResult(null);
    setShowLevelSelector(false);
  };

  const accuracy =
    progress.totalQuestionsAnswered > 0
      ? Math.round((progress.correctAnswers / progress.totalQuestionsAnswered) * 100)
      : 0;

  const levelAnsweredCount = progress.answeredQuestions.filter((id) =>
    questions.some((q) => q.id === id)
  ).length;

  return (
    <div className="rounded-lg border border-caribbean-sand bg-card p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Brain className="h-5 w-5 text-caribbean-ocean" />
              Bitcoin Trivia - Level {progress.currentLevel}
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
              Streak: {progress.currentStreak}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-caribbean-ocean">
              {progress.totalQuestionsAnswered}
            </p>
            <p className="text-xs text-muted-foreground">Questions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-caribbean-palm">{accuracy}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-caribbean-sunset">
              {progress.bestStreak}
            </p>
            <p className="text-xs text-muted-foreground">Best Streak</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-full bg-muted animate-pulse rounded" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 w-full bg-muted animate-pulse rounded" />
              ))}
            </div>
            <p className="text-center text-muted-foreground">Loading questions...</p>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-4 rounded-lg border border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-600">Failed to load questions.</p>
            </div>
            <Button onClick={() => refetch()} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
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
              </div>
            )}
          </div>
        ) : progress.levelCompleted ? (
          <div className="space-y-3">
            <div className="p-4 bg-caribbean-mango/10 rounded-lg text-center">
              <h3 className="text-lg font-semibold mb-2">
                Level {progress.currentLevel} Complete!
              </h3>
              <p className="text-sm text-muted-foreground">
                You've mastered this level. Ready for harder questions?
              </p>
            </div>
            {progress.currentLevel < 21 && (
              <Button
                onClick={startNextLevel}
                className="w-full bg-caribbean-mango hover:bg-caribbean-mango/90"
              >
                <Brain className="mr-2 h-4 w-4" />
                Start Level {progress.currentLevel + 1}
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading questions...</p>
          </div>
        )}

        {showResult && currentQuestion && !progress.levelCompleted && (
          <Button
            onClick={nextQuestion}
            className="w-full bg-caribbean-ocean hover:bg-caribbean-ocean/90"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Next Question
          </Button>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Level {progress.currentLevel} Progress</span>
            <span>
              {levelAnsweredCount} / {questions.length || 12}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-caribbean-ocean transition-all"
              style={{
                width: `${(levelAnsweredCount / Math.max(questions.length, 1)) * 100}%`,
              }}
            />
          </div>
        </div>

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
            currentLevel={progress.currentLevel}
            onSelectLevel={changeLevel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
});
