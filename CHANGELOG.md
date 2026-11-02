# Palestra: versions

Each release changes `VERSION` in `sw.js` and `APP_VERSION` in `js/views/settings.js` (a test checks they match).
Phones download the new version in the background and show the *Aggiorna* bar.

| Version | What changed |
|---|---|
| v14 | Dark theme: Impostazioni → Aspetto (Automatico follows the device, Chiaro, Scuro), the same greys as the workout screen with yellow as the accent. The guide pages follow the same choice |
| v13 | Everyday v60 follows Sposta a domani: the guide and the Everyday page in Settings say so, instead of asking to move the block by hand |
| v12 | Sposta a domani, ready for Everyday: moves keep their order and a time (`at`), moving again adds a step, and Rimetti oggi after a sync adds the move back instead of deleting the record |
| v11 | The user guide is now its own page in each language (guide-it.html, guide-en.html), built from Markdown with phone and computer screenshots and a Telefono / Computer switch; Settings → Guida opens it. The settings gear is the one shared with Ricette and Everyday (an 8-tooth cog, labelled on wide screens, filled on Settings) and sits at the top right of every section |
| v10 | Desktop like Ricette and Everyday: tabs, page actions, sync and the settings gear in a top bar. The guide comes in a phone and a desktop version, with screenshots of each (made by tests/guide-shots.cjs) |
| v9 | New names: a day's list is a **scheda**, the week is a **workout**. Five tabs: Oggi, Workout, Schede, Esercizi (with Palestra), Storico. Sposta a domani, Duplica in un altro workout, last weights in a scheda, Importa beside every Nuovo. Desktop: sidebar, two columns, master-detail, exercise library beside the editor. Text import reads WORKOUT: and SCHEDA: (old files still work) |
| v8 | Nothing scrolls sideways: filters, headers and steppers wrap; the import text wraps long lines |
| v7 | Exercise list: compact view, collapsible groups, filters on one row, no repeated type line |
| v6 | Creating a plan or a routine offers to import it from text or a file |
| v5 | Optional time per day in a plan, sent to Everyday; weekday and time in the text format |
| v4 | Weekly plans (schede) with an active one, which Everyday plans from; import from text, apart from Backup |
| v3 | Import routines from a file; the first session sets weights that are missing |
| v2 | Contract version kept in prefs, as in Ricette |
| v1 | First version: routines, exercises, gym, guided workout, history, sync with palestra-data |
