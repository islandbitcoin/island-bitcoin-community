import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Trophy, Star, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LevelSelectorProps {
  currentLevel: number;
  onSelectLevel: (level: number) => void;
  className?: string;
}

const MAX_LEVEL = 21;

function getDifficultyLabel(level: number): string {
  if (level <= 5) return "Beginner";
  if (level <= 10) return "Intermediate";
  if (level <= 15) return "Advanced";
  return "Expert";
}

function getDifficultyColor(level: number): string {
  if (level <= 5) return "text-green-600";
  if (level <= 10) return "text-blue-600";
  if (level <= 15) return "text-orange-600";
  return "text-red-600";
}

export function LevelSelector({
  currentLevel,
  onSelectLevel,
  className,
}: LevelSelectorProps) {
  const [selectedLevel, setSelectedLevel] = useState(currentLevel);

  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

  const isUnlocked = (level: number) => level <= currentLevel;
  const isCompleted = (level: number) => level < currentLevel;

  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <h2 className="text-2xl font-bold mb-2">Select a Level</h2>
        <p className="text-muted-foreground">
          Choose your difficulty level. Complete levels to unlock new challenges!
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {levels.map((level) => {
          const unlocked = isUnlocked(level);
          const completed = isCompleted(level);
          const isSelected = selectedLevel === level;

          return (
            <div
              key={level}
              className={cn(
                "relative rounded-lg border p-4 transition-all cursor-pointer",
                unlocked ? "hover:shadow-lg" : "opacity-60",
                isSelected && "ring-2 ring-caribbean-ocean"
              )}
              onClick={() => {
                if (unlocked) {
                  setSelectedLevel(level);
                }
              }}
            >
              {!unlocked && (
                <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center z-10">
                  <Lock className="h-8 w-8 text-muted-foreground" />
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Level {level}</h3>
                <div className="flex items-center gap-2">
                  {completed && <CheckCircle className="h-5 w-5 text-green-600" />}
                  <span
                    className={cn(
                      "px-2 py-1 text-xs rounded-full bg-muted",
                      getDifficultyColor(level)
                    )}
                  >
                    {getDifficultyLabel(level)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {completed && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Trophy className="h-4 w-4" />
                    <span>Completed!</span>
                  </div>
                )}

                {unlocked && !completed && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4" />
                    <span>In Progress</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() => onSelectLevel(selectedLevel)}
          disabled={!isUnlocked(selectedLevel)}
          className="bg-caribbean-ocean hover:bg-caribbean-ocean/90"
        >
          Start Level {selectedLevel}
        </Button>
      </div>
    </div>
  );
}
