# Palestra: versions

Each release changes `VERSION` in `sw.js` and `APP_VERSION` in `js/views/settings.js` (a test checks they match).
Phones download the new version in the background and show the *Aggiorna* bar.

| Version | What changed |
|---|---|
| v7 | Exercise list: compact view, collapsible groups, filters on one row, no repeated type line |
| v6 | Creating a plan or a routine offers to import it from text or a file |
| v5 | Optional time per day in a plan, sent to Everyday; weekday and time in the text format |
| v4 | Weekly plans (schede) with an active one, which Everyday plans from; import from text, apart from Backup |
| v3 | Import routines from a file; the first session sets weights that are missing |
| v2 | Contract version kept in prefs, as in Ricette |
| v1 | First version: routines, exercises, gym, guided workout, history, sync with palestra-data |
