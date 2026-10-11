export type SetKind = 'passage' | 'words';
export interface TextSet {
  id: string;
  name: string;
  kind: SetKind;
  content: string;
  createdAt: string;
  updatedAt: string;
}
export interface SetDraft { name: string; kind: SetKind; content: string }
export type TestMode = 'time' | 'words';
export interface Settings { setId: string; mode: TestMode; amount: number }
export interface TestResult {
  wpm: number;
  raw: number;
  accuracy: number;
  seconds: number;
  correct: number;
  incorrect: number;
  totalKeystrokes: number;
  mistakes: number;
}
