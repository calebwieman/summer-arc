export interface DailyHabits {
  run: boolean;
  amLift: boolean;
  plunge: boolean;
  bibleAm: boolean;
  noPhoneBeforeBible: boolean;
  pmLift: boolean;
  bibleEvening: boolean;
  sleepBy10: boolean;
}

export interface DailyLog {
  date: string;
  habits: DailyHabits;
  coldCalls: number;
  runMiles: number;
  runNotes: string;
  amLiftNotes: string;
  pmLiftNotes: string;
  plungeMinutes: number;
  sleepHours: number;
  win: string;
  lesson: string;
  top3Priorities: [string, string, string];
}

export interface WeeklyReview {
  weekStart: string;
  biggestWin: string;
  biggestLesson: string;
  changeNextWeek: string;
}
