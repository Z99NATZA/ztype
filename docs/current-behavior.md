# Current Behavior

## Sets and Modes

```text
ชุดข้อความ -> เพิ่มชุด: save a named passage or word bank.
Sets support search, editing, deletion, and selection for practice.
Word banks split entries on whitespace or commas and sample with replacement.

เวลา:     15 / 30 / 60 / 120 seconds; custom 1–3,600. Ends at the time limit.
จำนวนคำ:  10 / 25 / 50 / 100 words; custom 1–1,000. Short passages repeat.
ต้นฉบับ:  One passage with internal spacing and line breaks; no time or word limit.

Default: 30 seconds. Time/word modes collapse passage whitespace.
Saving trims outer whitespace. Thai words use Intl.Segmenter.
Original/word mode finishes at the target length even with typing errors.
```

## Controls

```text
Practice focuses automatically; timing starts on the first character.
Changing the set, mode, or amount starts a new round.
Automatic focus preserves page scroll when changing practice settings.
The page keeps a permanent scrollbar gutter so optional controls cannot shift the layout.
The set picker groups passages and word banks, supports name search and marks the selected set.
Arrow keys and Enter select a set; Esc or clicking outside closes the picker.
Correct completed words and the prefix before them lock; unlocked text stays editable.

Space: advances to the next word even if the current word is unfinished.
Skipped graphemes count as errors; normal spaces preserve original spacing.
Enter: space, or newline in original mode.
Tab:   inserts an expected tab in original mode.
Enter on results: new round. Esc in the typing area: restart.
ชุดต่อไป on results: starts the next saved set, wrapping after the last set.
The next-set button is disabled when only one set is saved.
Typing from blank page space resumes input; Enter returns focus.
Dialogs close through buttons or Esc; outside clicks preserve the draft.

Paste/drop are blocked in practice. Thai combining marks and IME are supported.
```

## Results

```text
WPM uses correct grapheme groups, with five groups per word.
Raw WPM counts actual input; skipped graphemes do not increase speed.
Accuracy includes skipped graphemes and mistakes even after correction.

Sets persist on the server; preferences stay in browser localStorage.
Results are shown for the current round only.
```
