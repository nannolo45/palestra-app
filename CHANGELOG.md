# Palestra: versions

Each release changes `VERSION` in `sw.js` and `APP_VERSION` in `js/views/settings.js` (a test checks they match).
Phones download the new version in the background and show the *Aggiorna* bar.

| Version | What changed |
|---|---|
| v9 | New names: a day's list is a **scheda**, the week is a **workout**. Five tabs: Oggi, Workout, Schede, Esercizi (with Palestra), Storico. Sposta a domani, Duplica in un altro workout, last weights in a scheda, Importa beside every Nuovo. Desktop: sidebar, two columns, master-detail, exercise library beside the editor. Text import reads WORKOUT: and SCHEDA: (old files still work) |
| v8 | Nothing scrolls sideways: filters, headers and steppers wrap; the import text wraps long lines |
| v7 | Exercise list: compact view, collapsible groups, filters on one row, no repeated type line |
| v6 | Creating a plan or a routine offers to import it from text or a file |
| v5 | Optional time per day in a plan, sent to Everyday; weekday and time in the text format |
| v4 | Weekly plans (schede) with an active one, which Everyday plans from; import from text, apart from Backup |
| v3 | Import routines from a file; the first session sets weights that are missing |
| v2 | Contract version kept in prefs, as in Ricette |
| v1 | First version: routines, exercises, gym, guided workout, history, sync with palestra-data |
