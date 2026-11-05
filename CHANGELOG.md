# Palestra: versions

Each release changes `VERSION` in `sw.js` and `APP_VERSION` in `js/views/settings.js` (a test checks they match).
Phones download the new version in the background and show the *Aggiorna* bar.

| Version | What changed |
|---|---|
| v24 | *Pronto?* before starting (or a countdown, in Impostazioni → Allenamento). *Prova com'è*: a routine's real screens, still, nothing saved. Sets that differ (*Serie diverse*, `8/6/4 x 10/12/14`), rep ranges (`3x8-12`) and *a cedimento*. Impostazioni → *Il tuo corpo* and a suggested starting weight. After an exercise's last set: *+ Un'altra serie* / *+ Un esercizio*. The summary shows what was different from the routine, set by set, and updates it |
| v23 | What the weight means: dumbbells per dumbbell (with the sum underneath), barbell with the bar (with the plates per side); changeable per exercise (*Il peso è*, *Manubri*), and History's kilos lifted count it. Anteprima: tap the edges (or swipe) to look at the exercises before and after, with *Torna all'esercizio …*, *Fallo adesso* and *Correggi i numeri* |
| v22 | Everyday sees the workout in progress: prefs → `live` is written on start, pause, resume and end (after the session is up), so the block shows as running there |
| v21 | Going back during a workout: *Rifai la serie* in the rest reopens the set just done with what you entered; *Indietro* on a set or cardio goes to the previous step (a logged set is taken off and can be redone) |
| v20 | Rest: when the time is up, *Salta* becomes a yellow *Fine*. The next set no longer shows “× 0” when the weight is still to be chosen |
| v19 | Impostazioni → Lingua e aspetto → Immagini: turns the exercise drawings, machine photos and small pictures off or on (nothing is deleted) |
| v18 | Pictures: each exercise can have a drawing (two positions, from free-exercise-db, public domain), chosen from suggestions in the exercise or one exercise after another from Esercizi → Abbina le immagini. Each machine can have your own photo, synced to palestra-data/photos/. A small picture on the workout screen and in each scheda opens full screen |
| v17 | App icon: a full-bleed version for Android's icon shapes (maskable 192 and 512), the SVG no longer offered to launchers |
| v16 | Shared with Everyday and Ricette: the light palette Pulito and the same dark palette (light, dark or automatic now in Impostazioni → Lingua e aspetto, kept under palestra-theme), Settings as grouped lists with one topic per page, the guide's two dropdowns and WebP pictures in the dark theme. Fixed: the phone's status bar stayed light in dark mode; a tapped title kept the accent colour |
| v15 | On a computer, the Palestra logo in the top bar goes back to Oggi |
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
