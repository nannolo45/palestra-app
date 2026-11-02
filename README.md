# Palestra

Your gym in your phone: where each machine is and how you set it, your routines, a guided workout with a rest
timer, and every set you do. Everyday reads the routines and plans *when* you train; Palestra hands back the real
times. Same pattern as Ricette and Everyday: a plain-JS PWA with no build step, data in a private GitHub
repository, offline first.

The full guide for using the app is in the app (Settings → Guide) and in the doc *Palestra: guide*.

## Repositories

| Repository | Visibility | What it holds |
|---|---|---|
| `palestra-app` (this one) | public | the app, published with GitHub Pages |
| `palestra-data` | **private** | your data, as JSON files (created by the app on the first sync) |

## Setup (about 10 minutes, once)

1. **Publish the app.** In this repository: Settings → Pages → *Deploy from a branch* → `main`, folder `/ (root)`.
   After a minute the app is at `https://<you>.github.io/palestra-app/`.
2. **Create `palestra-data`**: a new **private**, empty repository.
3. **Make a token per device.** GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
   Repository access: *Only select repositories* → `palestra-data`. Permissions: *Contents → Read and write*. Nothing else.
4. **Install on the phone.** Open the app's address in Chrome → menu → *Install app*.
5. **Connect.** Settings → GitHub connection: your user name, `palestra-data`, the token → *Save and sync*.
6. **Everyday.** In Everyday: Settings → Advanced → Connections → Palestra, with its own token for `palestra-data`
   (Contents: Read and write; Everyday only writes the `planned` record, see below).

## What's in the repository

| Path | What it is |
|---|---|
| `index.html`, `manifest.webmanifest`, `sw.js` | the page, the install manifest, the offline cache (`VERSION` in `sw.js`) |
| `css/style.css` | the look: light app with a yellow accent, dark workout mode |
| `fonts/` | Barlow and Barlow Condensed (SIL Open Font License, see `fonts/OFL.txt`), so the app works offline |
| `js/store.js` | IndexedDB storage and per-record merging (newest `updatedAt` wins) |
| `js/sync.js` | sync with `palestra-data` through the GitHub Contents API; sessions split by month; the data contract |
| `js/model.js` | exercise types, cardio machines and measures, estimated lengths, the weekly automatic increase |
| `js/workout.js` | the workout in progress, all from timestamps (survives a locked phone or a reload) |
| `js/plans.js`, `js/importer.js` | weekly plans and the active plan; import from text or JSON |
| `js/views/` | the screens: routines (with the active plan), plans, import, exercises, gym, history, settings, workout mode |
| `js/guide.js` | the in-app guide, Italian and English |
| `js/i18n.js` | texts, Italian (first) and English |
| `tests/` | unit tests (`npm test`) and a browser test with a fake GitHub (`npm run e2e`); not needed to use the app |

## Data (`palestra-data`)

Every record has `id`, `updatedAt` (ms since 1970) and, once deleted, `deleted: true`. Deletions are kept 90 days.
Unknown fields are kept on every write.

| File | One record is | Main fields |
|---|---|---|
| `data/places.json` | a zone of the gym | `name`, `order` (walking order), `note` |
| `data/machines.json` | a machine or station | `name`, `number`, `placeId`, `kind` (`weights`/`cardio`), `settings`, `cardioKind` (`treadmill`, `elliptical`, `bike`, `rower`, `stepper`, `custom`), `measures` (for `custom`: up to 3 of `speed`, `incline`, `level`, `resistance`, `cadence`, `distance`, `calories`, `watt`, or `{key, label, unit}`) |
| `data/exercises.json` | an exercise | `name`, `type` (`weights`/`bodyweight`/`cardio`), `equipment` (`machine`/`barbell`/`dumbbell`/`cable`), `machineId`, `placeId`, `muscles`, `defaultRest`, `notes`, `timed`, `cardio: {kind, targets}`, `increase: {mode: type/custom/off, step}` |
| `data/routines.json` | a routine | `name`, `items: [{exerciseId, sets, reps` or `seconds, weight, rest, targets}]`, `restBetween`, `estMinutes`, `autoIncrease`, `increaseWeek` |
| `data/sessions/YYYY-MM.json` | a workout done | `routineId`, `start`, `end` (ms), `minutes` (without pauses), `sets: [{exerciseId, n, reps, weight, seconds, targets, distance, dur, restTaken, restPlanned}]`, `breakdown: {work, rest, walk, pause}` (s), `outcome` (`done`/`partial`), `everydayBlockId` |
| `data/plans.json` | a weekly plan (a **workout** in the app since v9) | `name`, `note`, `days: [{routineId, weekday, time?}]` (0 = Monday … 6 = Sunday, or `null`; `time` "HH:MM") |
| `data/prefs.json` | a setting, `{id, value}` | `contract` (the contract version, `1`), `activePlan` and `moves` (read by Everyday, below), `increase`, `training`, `gymName`; and `planned`, written by Everyday |

### Data contract with Everyday (v1)

Everyday reads `routines.json` (`id`, `name`, `estMinutes`, `deleted`, `updatedAt`) and the session files of the
current and previous month (`id`, `routineId`, `start`, `end`, `minutes`, `outcome`, `everydayBlockId`).
`start` and `end` are ms since 1970 and place the block; `minutes` is the time worked, without pauses.

Everyday writes only the prefs record `planned`: `[{blockId, routineId, date: "YYYY-MM-DD", start: "HH:MM"}]`,
rewritten in full on each sync with the next 14 days.

The contract version is the prefs record `{id: "contract", value: 1}`, as in Ricette. A higher value than the app
knows makes it keep reading but stop writing until it's updated. Changing a listed field means contract v2.

**Names (v9).** In the app a routine is a **scheda** (EN: routine) and a plan is a **workout** (EN: workout); a session done is an **allenamento**. The data keeps the old keys (`routines`, `plans`, `sessions`), so the contract doesn't change.

**Moves** (prefs record `moves`, written by *Sposta a domani* on Oggi, read by Everyday since its v60): `[{routineId, from: "YYYY-MM-DD", to: "YYYY-MM-DD", at}]`, in the order they were made (`at` in ms); only the current week's are kept. Everyday applies them in order on each sync: the block still on `from` goes to `to` (same time if free, else the first free slot), blocks done or started stay, and the result comes back through `planned`. Entries are never rewritten once they may have been synced: moving again adds one, *Rimetti oggi* adds the reverse move (a move not yet synced is just removed).

**Text import.** `WORKOUT:` names the plan, `SCHEDA:` (or `ROUTINE:`) starts a routine, optionally `@ lun 18:00`. A file with `GIORNO:`/`DAY:` lines and no `WORKOUT:` is read the old way (`SCHEDA:` = plan name).

**Active plan** (prefs record `activePlan`, read by Everyday): `{planId, name, from: "YYYY-MM-DD", days: [{routineId, weekday, time?}], previous?}`. `time` ("HH:MM") is optional: with
it Everyday places the routine at that time every week; without it, the person picks the time each week in Everyday.
Everyday plans the active plan's routines on their weekdays (`null` = any day) from `from` on. When a plan is made
active "from Monday", `previous` holds the plan in force until then, in the same shape, so Everyday keeps planning
it for the rest of the week. `null` = no active plan. This is an addition to contract v1: no listed field changes.

A session started in Palestra without a block is matched by Everyday to a block for the same routine that day,
nearest by time, or gets a new block. A deleted routine archives its saved task in Everyday.

Everyday opens a workout with `…/palestra-app/#/start/<routineId>?block=<blockId>`; the session saved at the end
carries that `everydayBlockId`.

## Updating

Change `VERSION` in `sw.js` and `APP_VERSION` in `js/views/settings.js` with every release, and add a line to `CHANGELOG.md`.
Phones only fetch new files when `sw.js` changes: they download the new version in the background and show the *Aggiorna* bar.

## Tests

```
npm test        # model, workout timing, translations (Node 20+)
npm run e2e     # the whole app in Chromium with a fake GitHub and a controlled clock (needs Playwright)
```

## User guide

The guide is a standalone page per language, `guide-it.html` and `guide-en.html`, opened from Settings → Guida in the same
tab. They're built from `docs/guide/it.md` and `en.md` (same headings and pictures in both) by `docs/guide/build.py`
(Everyday's, set up for Palestra). Each picture has a phone version (`guide/<lang>/NN-name.webp`, 390×780 at 2×) and a
computer one (`guide/<lang>/desk/NN-name.webp`, 1440×900), in the dark theme. At the top, two dropdowns: *Mostra la guida
per* (Telefono / Computer, remembered in `localStorage` as `guideMode`, shared with Ricette and Everyday) and *Lingua*.
The guide follows the app's light/dark choice (`palestra-theme`). After a visible change, retake the pictures and rebuild:

```
cd tests
node ../docs/guide/screenshots.mjs it ../guide/it
node ../docs/guide/screenshots.mjs en ../guide/en
node ../docs/guide/screenshots.mjs it /tmp/desk/it desk
node ../docs/guide/screenshots.mjs en /tmp/desk/en desk
cd .. && python3 docs/guide/webp.py --desk /tmp/desk && python3 docs/guide/build.py     # needs markdown and Pillow
```

Then bump the version: the guide pages are in the offline cache.

## Light, dark or automatic

Impostazioni → Lingua e aspetto → Aspetto: *Automatico* (follows the device, the default), *Chiaro*, *Scuro*, kept on the
device only in `localStorage` under `palestra-theme`. `index.html` sets the class `light` or `dark` on `<html>` before the
first paint; `js/theme.js` (Everyday's) keeps it in step. Colours are CSS variables: light ("Pulito", shared with Everyday
and Ricette) on `:root`, dark on `:root.dark`; there are no `prefers-color-scheme` media queries in the CSS. The workout
screen is always dark.
