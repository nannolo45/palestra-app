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
| `js/views/` | the screens: routines, exercises, gym, history, settings, workout mode |
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
| `data/prefs.json` | a setting, `{id, value}` | `contract` (the contract version, `1`), `increase`, `training`, `gymName`; and `planned`, written by Everyday |

### Data contract with Everyday (v1)

Everyday reads `routines.json` (`id`, `name`, `estMinutes`, `deleted`, `updatedAt`) and the session files of the
current and previous month (`id`, `routineId`, `start`, `end`, `minutes`, `outcome`, `everydayBlockId`).
`start` and `end` are ms since 1970 and place the block; `minutes` is the time worked, without pauses.

Everyday writes only the prefs record `planned`: `[{blockId, routineId, date: "YYYY-MM-DD", start: "HH:MM"}]`,
rewritten in full on each sync with the next 14 days.

The contract version is the prefs record `{id: "contract", value: 1}`, as in Ricette. A higher value than the app
knows makes it keep reading but stop writing until it's updated. Changing a listed field means contract v2.

A session started in Palestra without a block is matched by Everyday to a block for the same routine that day,
nearest by time, or gets a new block. A deleted routine archives its saved task in Everyday.

Everyday opens a workout with `…/palestra-app/#/start/<routineId>?block=<blockId>`; the session saved at the end
carries that `everydayBlockId`.

## Updating

Change `VERSION` in `sw.js` with every release: phones download it in the background and show an *Update* bar.

## Tests

```
npm test        # model, workout timing, translations (Node 20+)
npm run e2e     # the whole app in Chromium with a fake GitHub and a controlled clock (needs Playwright)
```
