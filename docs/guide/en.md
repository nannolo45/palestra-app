# Palestra: user guide

How to set Palestra up, train with it every week and have it work alongside Everyday.

<div class="desk-only" markdown="1">
**You're reading the computer guide.** The pictures show the app on a wide screen. Where the guide says *tap*, on a computer it's a click. In the menu at the top, *Show the guide for* → **📱 Phone** switches to the phone guide (your choice is kept). Click a picture to enlarge it.
</div>
<div class="phone-only" markdown="1">
*This is the phone guide. In the menu at the top, *Show the guide for* → **💻 Computer** switches to the computer one.*
</div>

## What Palestra is

Palestra tells you what to do at the gym, exercise by exercise, and remembers what you did. You set up your **routines** once (Chest and biceps, Legs…), put them in a **workout**, which is your week, and at the gym you follow the screen: set, weight, rest, where to go next.

Your data lives in your own private space on GitHub, which only you can read (and Everyday, if you connect it). The app works without signal too: it syncs when it's back online.

Palestra isn't a coach's training programme and doesn't count calories. It decides **what** you do: name, length and exercises. Everyday decides **when**.

A **session** is a routine you actually did: you'll find it in [History](#history).

## First setup

Once, about twenty minutes. You need a GitHub account and your gym in mind: the areas and machines you use.

### 1. Install the app

Open Palestra's address in Chrome. On a phone choose *Install app* (or *Add to Home screen*); on a computer, *Install* in the address bar. From then on open it from its icon: it runs full screen and works offline.

### 2. Connect your GitHub space

On GitHub, create a private, empty repository called `palestra-data`. Then make a token for this device: *Settings → Developer settings → Fine-grained tokens*, access to `palestra-data` only, permission *Contents: Read and write*. Name it after the device, for example "Tom's phone".

In Palestra tap the gear, then *GitHub connection*. Enter your user, the repository and the token, then *Save and sync*.

![GitHub connection: user, repository and token](guide/en/04-github.webp)

### 3. Map out your gym

In *Gym* add the **zones** you move between (Entrance and cardio, Machine room, Free weights…) and tap *Reorder* to put them in the order you walk through them. Routines use this route so you walk less.

![The gym: zones in the order you walk them](guide/en/05-gym.webp)

In each zone tap **+** to add a **machine**, with the number printed on it (M14, C3) and your settings (seat, back rest). Several identical machines can be one entry, like treadmills C1–6.

![New machine: name, number, zone and settings](guide/en/06-new-machine.webp)

### 4. Add your exercises

In *Exercises* tap **+**. Pick the type (*Weights*, *Bodyweight* or *Cardio*), the machine and the usual rest. **Notes** are optional: how to do it, what to remember. You see them again during the workout.

![An exercise: type, machine, rest and notes](guide/en/08-exercise.webp)

### 5. Make your routines

In *Routines* tap *New routine*, give it a name (say, "Chest and biceps") and add exercises with *Add exercise*. Tap an exercise to choose sets, reps, weight and rest. [Inside a routine](#routines) covers the rest.

![Edit routine: the order of the exercises and the automatic increase](guide/en/12-routine-edit.webp)

### 6. Optional: import a workout that's already written

If Marco, your trainer, wrote your week on a sheet or in a message, you don't have to copy it by hand. Tap *Import* next to *New workout* and paste the text: one exercise per line, the way you'd write it. [Importing from text](#importing-from-text) explains how to write it.

![Import: paste the text, how to write it is underneath](guide/en/17-import.webp)

Tap *Read the text*. Before saving you see a preview: **yours** reuses one of your exercises with its machine, **new** creates it, **check** marks a bit the app didn't understand.

![The preview: what it reuses, what it creates, what to check](guide/en/18-import-preview.webp)

### 7. Make a workout active

A **workout** groups the week's routines, each on its day. In *Workouts* open one and tap *Make active*: from then on you see it in *Today* and Everyday plans it. If you switch mid-week, choose to start from Monday or from today.

![Making a workout active: the old one stays saved](guide/en/16-activate.webp)

## The four sections

| Section | What it's for |
|---|---|
| *Today* | Today's routine, the week, your last session and the month |
| *Training* | Three tabs: **Workouts** (your weeks: which routines, on which days and at what time), **Routines** (to search, open, edit and start) and **Exercises** |
| *Gym* | Your gyms: zones, machines and equipment |
| *History* | Your progress, your breaks and every session you've done |

In *Training* you move between tabs by tapping them or **swiping** left and right on the list. It reopens the one you looked at last. From a routine, a workout or an exercise, **‹ Training › Routines** at the top takes you back to the right tab.

At the top of each page are its actions, like *New routine* and *Import*. The **gear** at the top right opens *Settings*: one list in three groups (*Connections*, *Training*, *App*). Each row says how it's set now and opens a page about that one thing; *← Settings* at the top goes back to the list.

In *Settings → Language and appearance*, **Appearance** picks the app's colours: *Automatic* follows the phone or computer (dark in the evening, if the device is), *Light* and *Dark* stay that way. The choice stays on this device, and the guide follows it. During a workout the screen is dark either way.

![Settings: everything in its own section](guide/en/03-settings.webp)

### Search, filter and group

*Exercises*, *Routines* and *Workouts* have the same tools at the top:

- **Search** and **Filters**. *Filters* opens a panel under the search, only when you tap it, with everything: the group tags, *Group by*, *Sort by*, the filters (each with how many it finds), *Colours* and *Rows* (compact, or with details and notes). *Done* closes it. The button shows how many filters are on; with the panel closed they stay under the search as tags with a ✕ to remove them.
- **The groups**, in the panel, as coloured tags with their count: tap one to see only that group (more than one too). **Hold and drag** a tag to reorder them: the list follows the same order.
- **Each group closes** when you tap its title; *Close all* closes them together. The coloured square next to the title changes the group's colour, which comes back as a bar on the left of each row.

Each workout has its own colour, the same in *Routines* and *Workouts*. In *Workouts*, the other workouts are rows with **⋯**: *Make active*, *Open*, *Duplicate*, *Export as text*, *Delete*. Closed groups, order, filters and colours stay as you leave them, on this device.

![The Filters panel: group tags, a tap to filter, drag to reorder](guide/en/38-tags.webp)

## Today

The first page tells you what's on today. At the top is the day's routine, with its time if you set one, and *Start*. If Everyday has already put it in your plan, it says *in Everyday*.

![Today: today's routine at 18:00 and the week](guide/en/01-today.webp)

### Start today's routine

Tap *Start*. Before the real workout there's **Ready?**: how long it takes, how many sets and zones, the first exercise large with its picture, and the whole routine in order with the changes of zone. The clock starts only when you tap *Start*. Then the workout opens full screen: [During the workout](#during-the-workout) explains what you see.

Rather have it start on its own? In *Settings → Training → Before starting* choose **Countdown**: 15 seconds (or as many as you like) to get to the first machine, with *+15 s* and *Start now*.

![Ready?: the whole routine before starting](guide/en/32-ready.webp)

### Move to tomorrow

Can't make it today? Tap *Move to tomorrow*. The routine moves to tomorrow for this week only, and the list of days shows it. *Back to today* undoes it. If you use Everyday, the block moves there too at the next sync: at the same time if it's free, otherwise in the first free slot tomorrow.

With a **rotation** workout there are no days: Today shows *Next*, and if the rest you set after the last routine isn't over it says so (*rest suggested a bit longer*). With **alternating weeks** *This week* says whether it's A or B.

![After "Move to tomorrow": the routine has moved, and you can put it back](guide/en/02-moved.webp)

### The week and the month

Below are the week's routines: the ones done, the next one and the ones left. Then the **active workout** with *Change*, your last session and a square for each day of the month, yellow when you trained.

## Workouts

A workout is your week: the routines you do, each on its day. The **active** one is in yellow at the top; the others stay saved with their history, for when you need them (a deload week, for instance).

![Your workouts: the active one at the top](guide/en/14-plans.webp)

### Create a workout

Tap *New workout*. At the top are your routines as coloured tiles: **drag one onto a day**, or tap it and then tap the day. A day can hold more than one (morning and evening). To move one, drag it to another day; to remove it tap ✕ or drag it to the bin that appears at the bottom. *New routine* makes one (or imports it from text).

![A workout: routines on the days, with the time](guide/en/15-plan.webp)

### Days and times

The tile shows the time (or *time?*): tap it to pick one, or *No time*. With a time Everyday puts it in your plan by itself; without one, you choose when in Everyday each week. On a computer the week is a grid of seven columns.

### Alternating weeks and rotation

Above the tiles pick the shape of the workout:

| Shape | How it works |
|---|---|
| *Weekly* | Every week the same |
| *Alternate A · B* | Two weeks that take turns: on a phone pick *Week A* or *B* and fill it in; the current one says *(this one)*. Counted from when the workout became active |
| *Rotation* | No fixed days: each time you go you do **the next one**, after the last it starts again. Drag routines into the loop to order them; *Rest day* adds a circle after a routine (tap it: 1, 2, 3 days or gone). If you go sooner, *Today* tells you |

![Alternating weeks: week B, with Thursday's routine](guide/en/45-plan-ab.webp)

![Rotation: the routines in order, with a rest day](guide/en/46-plan-rotation.webp)

Each week Everyday gets that week's days (A or B); with a rotation it gets the routines with no day, and you put them in your plan. *Export .txt* keeps the shape, and importing finds it again.

### Change the active workout

In *Workouts* tap **⋯** on another workout, then *Make active*. Mid-week, choose *From Monday* to finish the week with the old one, or *From today*. The old workout stays saved.

### Export and duplicate

*Export .txt* saves the workout as text, to send to someone or import again. *Duplicate* makes a copy to change without touching the original.

## Routines

A routine is a sequence of exercises you repeat, like "Legs". Palestra works out its **estimated length** from the sets and rests, and corrects it with how long you really took: the last six times, the newest counting most. Tap the minutes at the top of a routine to see the sums, session by session.

![Your routines, with the workout each one is in](guide/en/10-routines.webp)

### Find a routine

They're grouped by workout, each with its colour. Type in the search, tap a workout's tag, or open *Filters* (workout, state, length). With *Rows → With details and notes* you see under each routine which workouts it's in.

### Inside a routine

At the top: the estimated length, the sets and the zones. Then the exercises in the order you do them, with arrows where you change zone. On the right of each exercise is **last time**: the weight, minutes or reps from your last session.

![A routine: today's plan and, underneath, last time](guide/en/11-routine.webp)

![The estimated minutes: how long you took the last times](guide/en/44-minutes.webp)

### Edit a routine

Tap *Edit*. The exercises are **blocks** one under the other, joined by circles: each circle is the rest before the next one.

- **Drag** a block by its handle (⋮⋮) to change the order; on a computer drag it from anywhere, and drag in from the list on the right too.
- **Tap the circle** to change the rest (30 s, 45 s, 1, 1:30, 2, 2:30, 3 min). After 3 min comes **⚡ superset**: the two exercises are done back to back, no rest between, round after round.
- **+ or**, beside a block: the **alternative**, for when the machine is busy or missing. You can also drag another block onto it. During a workout it's the first suggestion of *I did another exercise*.

| Part | What you set |
|---|---|
| Name | How you see it here and in Everyday |
| *Automatic increase* | Whether Palestra offers to raise your weights each week |
| Order | Drag by the handle (or the ↑ ↓ arrows on the handle, from a keyboard) |
| An exercise | Tap it: sets, reps or seconds, weight, rest, or *Remove from routine* |
| *Equal sets / Different sets* | With *different* each set has its own reps and weight (pyramids, drop sets, a warm-up); *Another set* adds one |
| *Rep range* | E.g. 8–12 instead of a fixed number: the weight goes up when you reach 12 in every set |
| *To failure* | Every set or only the last, until you can't do another clean rep |
| *Add exercise* | Pick it from the list, or make a new one |
| *Import* | Adds exercises written as text |

![Add exercise: the list, with each one's machine](guide/en/13-add-exercise.webp)

![Different sets: each set with its own reps and weight](guide/en/34-sets-editor.webp)

### Try it out

On a routine's page, **Try it out** opens the same screens as the real workout, standing still: a yellow strip says *Trial · nothing is saved*, the clock shows "—:—", the rest doesn't count down (*Next* to move on). *Done* goes to the next set, the edges jump from one exercise to another. No session, no increases, nothing sent to Everyday. *Exit* takes you back to the routine.

![Try it out: the real workout, standing still](guide/en/33-try.webp)

### Duplicate into another workout

In a routine tap *Duplicate into another workout* and choose where. The copy is yours to change: the original stays as it was.

## Exercises

*Training → Exercises* lists all your exercises, grouped by **body part**: Chest, Back, Shoulders, Arms, Legs, Core and Cardio. Inside each part are the muscles (in *Legs*: Quads, Hamstrings, Glutes, Calves, Adductors). *Filters → Group by* also lists them by muscle, zone or type; in *Filters* pick type, body part, zone, whether they're in the active workout, and compact rows or rows with notes.

![Exercises: by body part, with the muscles inside](guide/en/07-exercises.webp)

### The catalogue

At the top, *Mine · Catalogue*. The **catalogue** has about 750 common exercises, with a drawing and the muscles. Search, filter by body part or equipment, and tap **+ Add**: it becomes yours, with muscles, equipment and drawing already set. The ones you have say *✓ yours*. Not there? *Create "…"* at the bottom makes a new one with that name.

![The catalogue: search and add](guide/en/43-catalogue.webp)

### The muscles

Palestra **recognises them from the name**, in English, Italian or German: *Chest press* goes to Chest, *Lat pulldown* to Back › Lats, *Cable pushdown* to Arms › Triceps, *Beinpresse* to Legs. On the exercise's page, under *Muscles*, the recognised ones have a dashed border; tap muscles to choose them yourself. The first one you pick is the **main** one (★): it decides the group; the others count half in History. An exercise Palestra can't place, with no muscles chosen, goes to **To sort out**, at the bottom, so you see it.

### The three types

| Type | What you set |
|---|---|
| *Weights* | Sets, reps, kg and rest; the dark tag carries the machine's number |
| *Bodyweight* | Sets, reps or seconds, rest; the tag has a dashed outline |
| *Cardio* | The machine (treadmill, elliptical, bike, rower…) and the targets: duration, speed, incline, level |

![A cardio exercise: the machine and its targets](guide/en/09-exercise-cardio.webp)

### Pictures

Each exercise can have a drawing of the movement, in two positions (*Start* and *End*), and each machine a photo of your own.

- **The drawing.** On the exercise's page tap *Choose a picture*: Palestra suggests the drawings closest to the name. If none fits, search with other words, in English or Italian. *None* leaves the exercise without one.
- **All at once.** In *Exercises*, the *Match pictures* card takes you through the exercises without a picture one after another: tap the right drawing and *Use this one*, or *None*.
- **Your photo of the machine.** Tap *Photograph the machine*: on a phone the camera opens. The photo is shrunk and kept on the phone and, if GitHub is connected, in palestra-data in the *photos* folder, so your other devices see it too. *Retake* and *Remove* change it.

Don't need them? *Settings → Language and appearance → Pictures* turns them all off: they stay saved but aren't shown until you turn them back on.

The drawings come from free-exercise-db, in the public domain; they download the first time you see them and then stay available offline.

![Choose a picture: the drawings closest to the name](guide/en/28-picker.webp)

![Match pictures: one exercise after another](guide/en/29-match.webp)

## Gym

One gym or more: your usual one, *Home*, the hotel's. They're tabs at the top; *+ Another* adds one, the pencil renames it (or deletes it: its zones and machines move to the first).

![Gym: the zones in walking order and the machines in each](guide/en/05-gym.webp)

### Zones and machines

**Zones** are in the order you walk through them: *Reorder* moves them, and routines follow this route. In each zone tap **+** for a **machine**: number, name, settings. Tap a machine to change it. From an exercise's page you can add one that isn't listed (*New machine*, or *Other machine* for cardio, where you pick what it measures besides time).

### Equipment

*Equipment* (on the right on a computer) is what that gym has, as ticks: barbell, rack, benches, dumbbells, cables, leg press, machines, dip and pull-up bars, cardio, mats. The first gym has everything until you untick something; a new one starts empty, and the machines you add tick what they need on their own.

![Home's equipment: only dumbbells, mats and a bar](guide/en/40-equipment.webp)

### When something is missing

Every exercise knows what it needs (from its type, equipment and name). Every routine is done in a gym: the first, or the one chosen in *Edit → Where you do it*. With more gyms, a routine has **Where:** to see how it looks elsewhere.

If something is missing there, a warning at the top says how many exercises, and each one has an orange line (*Needs: Leg press*) with **two alternatives for the same muscles**, first from your exercises, then simple ones (bodyweight, dumbbells). **Use** asks:

- **Only when you're at Home**: the routine stays as it is; there, you do the alternative instead (with *instead of …* next to it, and *Back to …* to remove it). Sets and reps stay; cardio minutes become one timed set.
- **Replace it in the routine**: from now on, everywhere.

*Start* and *Try it* start in the gym you're looking at. The same warning shows on *Today*, on today's routine, and on the workout's week on a computer.

![A routine at Home: what's missing and the alternatives](guide/en/39-missing.webp)

## During the workout

The screen turns dark and large, stays on and works without signal. If the phone locks or the app reloads, open it again: it picks up where you were.

### This week's increases

At the first session of the week, if the automatic increase is on, Palestra offers your new targets: one exercise per line, before and after. Untick any you don't want, then tap *Confirm … and start*, or *Start with the old weights*.

![Going up? Untick the ones you don't want](guide/en/19-increase.webp)

### A set

You see the exercise, the set (2 of 4), reps and kg, the machine and its zone, and your note. If you did something different, adjust with − and +. Then tap *Done*. *Back* returns to the step before (the previous set or the cardio): what you had logged is taken off and you do it again.

![A set: reps, kg, where to go and your note](guide/en/20-set.webp)

**What the weight means.** With dumbbells the number is *per dumbbell* (what's written on it), with the sum underneath: "Take 2 dumbbells of 15 kg · 30 kg in all". With a barbell it's the total with the 20 kg bar, with the plates per side underneath. For an exercise that's different (one dumbbell, or a barbell counted per side) change it on the exercise's page, under *Equipment*: *The weight is* and *Dumbbells*.

**Sets that differ.** If the routine has different sets (e.g. 8 × 10, 6 × 12, 4 × 14 kg), a row under the title shows them all: done, now and to come. Each set starts from its own numbers.

**To failure.** A yellow *To failure* label above the reps, and the goal underneath (e.g. *Goal 8–12*) with last time's reps. The reps start from what you did last time in that set: adjust them with − and + at the end of the set.

**A starting weight.** If an exercise has no weight yet and you've filled in *Settings → Your body*, the set suggests *To start with: … kg* with **Use**. It's only a guide, on the prudent side: if the reps come easily, go up.

**One more rep.** Press + beyond the routine: "one more than the routine" shows next to the number. What you did is saved; at the end you decide whether to keep it in the routine.

### One more set or exercise

In the rest after the **last** set of an exercise, Palestra asks: *…: sets done. One more?*

- **+ Another set**: comes right away, marked *extra*, with the numbers of the set you just did. *Remove* if you change your mind.
- **+ An exercise**: pick one of yours; it comes right away, marked *added*, with one set from last time's numbers. When it's done, the same question.

After the workout's last set the question stays, with **Finish the workout** underneath.

![Another set: it comes right away, marked extra](guide/en/35-more.webp)

### Looking at the exercises before and after

Tap the left or right edge of the screen (or swipe) to see the exercise before or after. It's clear you're only looking: *Preview* at the top, a dashed box saying where you really are, the rest in grey, and *Back to exercise …* instead of *Done*. In the bar at the top, the segment you're looking at has an outline; the yellow one stays where you are.

- **Do it now**, on an exercise further on (or one skipped): it comes next, for example when its machine is free and the one you're due on isn't.
- **Correct the numbers**, on one already done: change the reps and kg of each set.

![Preview: the exercise after, and the way back](guide/en/31-preview.webp)

Next to the machine there's a small picture: your photo, or the exercise's drawing. Tap it to see it full screen; *Machine* and *Exercise* switch between them, and tapping the drawing shows the other position.

![Full screen: your photo of the machine or the drawing](guide/en/30-viewer.webp)

### Rest

A countdown starts, and you see how long you actually rested. *+30 s* adds time (once the time is up it counts 30 seconds from now), *Skip* moves straight on. At zero it rings, the phone vibrates and *Skip* turns into a yellow *Done*. Tapped *Done* too early, or got a number wrong? *Redo the set* reopens it with the values you had entered. Underneath is what's next and where to go.

![Rest: the time left and what comes next](guide/en/21-rest.webp)

### The sound when the rest ends

In *Settings → Training*, **Sound when the rest ends**: *Bell*, *Three beeps*, *Gong* or *None*, the volume and *Try*. You can have a tick in the last 3 seconds, and a second ring after 30 seconds if you don't tap anything. The sound works after your first tap in the workout (browsers want it that way).

![The sound when the rest ends](guide/en/42-alarm.webp)

### Leave without finishing

The **⌄** arrow at the top left **minimises** the workout: you go back where you were in the app and the workout goes on. A bar stays at the bottom with the routine and the rest counting down; when the rest is over it turns yellow and rings. Tap **Back** to go in again. To really finish there's **×** at the top right.

![Minimised workout: the bar with the rest, over Today](guide/en/48-live.webp)

### I did another exercise

The machine is busy and you did something else? Under the name tap **I did another exercise**. At the top is the routine's alternative (if it has one), then similar exercises for the same muscles, with last time's numbers; underneath you can search all of yours. The sets left become that one's, marked *instead of …*. At the end you choose: just today, at this gym (if you have more than one), or from now on in the routine.

![What did you do: the alternative and similar ones](guide/en/47-other.webp)

### Cardio

For cardio you see the time left and the targets, which you can change with − and +. If you like, enter the distance from the display. Tap *Finish* when you're done.

![Cardio: the time left and the targets](guide/en/22-cardio.webp)

### Pause and finish

*Pause*, at the top right, stops the clock: for a phone call or a queue at a machine. **×** ends early: the sets you did are saved as a partial session. At the end you get the summary: time, sets, total weight, rests and new bests.

![Finished: the session summary](guide/en/23-summary.webp)

### Different from the routine

If you did anything differently from the routine, the summary shows it exercise by exercise, set by set: what the routine said, what you did, and a tag for each difference (*+1 reps*, *−2,5 kg*, *extra*, *skipped*, *new*). For each one you choose:

| Choice | The routine |
|---|---|
| *Just today* | Doesn't change |
| *As I did it* | Takes today's numbers, set by set |
| *All …* | Every set like the best one (if one went better) or like the last (if you dropped) |
| *Add to the routine* | An added exercise goes in where you did it |

When it opens, *As I did it* is already picked when you did more, *Just today* when you did less or skipped: a bad day doesn't lower the routine by mistake. *All as I did it* and *None, just today* apply to all. Under each choice a line says exactly what the routine becomes; then **Update the routine**.

![Different from the routine: set by set, and what the routine becomes](guide/en/36-diff.webp)

### Automatic increase, in Settings

In *Settings → Automatic increase* choose when (*If complete*: only if you did every set last time; *Always*) and by how much per type: machines +2.5 kg, dumbbells +1, bodyweight +1 rep, cardio +1 minute. On an exercise's page you can give it its own step or leave it out.

![Automatic increase: when, and by how much per type](guide/en/27-increase-settings.webp)

### Your body, for suggested weights

In *Settings → Your body* enter your weight, height, sex and experience (all optional). They're only used to suggest a starting weight when an exercise doesn't have one yet: your weight times a prudent ratio per exercise, adjusted for experience and sex; height moves it a little. Below you see your exercises' starting weights. On machines it's really only a guide: they differ from gym to gym.

![Your body: the starting weights](guide/en/37-body.webp)

## History

At the top pick what to look at: **Everything** (every session together), **Body parts** (a line per part, tap the legend to hide one), **Workouts** (each in its colour), one **Routine** or one **Exercise** (its load, how much it grew and the last result). Below, the measure: **kg lifted**, **sets** or **top weight** (for several exercises it's an index: 100 is where you started). Then the period: 2, 3, 6 months or all.

Above the chart: sessions, breaks and the change over the last 4 weeks.

![History: body parts week by week, with a break](guide/en/24-history.webp)

### Breaks

**Ten days or more** without training are a break (change the number in *Settings → Rest and training*). On the chart it's a grey band with the number of days, and a dashed line goes across it: the dip after it explains itself. Below, in *Breaks*, pick the reason (holiday, illness, injury, work…): it shows on the band.

### Where you improved

For each body part, the kg lifted in the **last 4 weeks you trained** against the 4 before, with a word on why (more sets, more weight, steady). Breaks don't count. Below are all your sessions, complete or partial.

![Where you improved, and the breaks with their reason](guide/en/41-improved.webp)

### A session

Tap one to see where the minutes went (work, rests, walking, pauses) and every set you did.

![A session: where the minutes went and every set](guide/en/25-session.webp)

## Importing from text

Next to *New workout*, *New routine* and *Add exercise* there's *Import*. Paste the text or pick a .txt file. Write it the way you would by hand, one thing per line:

| Line | What it means |
|---|---|
| `WORKOUT: Marco's upper lower` | The week's name (optional) |
| `ROUTINE: Upper @ mon 18:00` | Starts a routine; after `@` an optional day and time |
| `Bench press 4x8 60 kg rest 2:30` | An exercise: sets x reps, weight and rest optional |
| `Barbell curl 8/6/4 x 10/12/14` | Different sets: 8 × 10, 6 × 12, 4 × 14 kg |
| `Barbell curl 3x8 10/12/14 kg` | Same reps, rising weight |
| `Leg press 12/10/8 x 100` | Same weight, falling reps |
| `Chest press 3x8-12 rest 2:00` | A rep range: the weight goes up when you reach 12 in every set |
| `Chest press 3x8-12 to failure` | Every set to failure (Italian: `cedimento`) |
| `Barbell row 3x8-12 last to failure` | Only the last set to failure (Italian: `ultima a cedimento`) |
| `Plank 3x45s` | A timed exercise |
| `Elliptical 10 min level 6` | Cardio, with its targets |
| `(dumbbells)` | The equipment, if you like: (barbell), (dumbbells), (cables), (machine) |
| `- Elbows slightly bent.` | A note for the exercise above |

With slashes, the number of sets is how many values sit between the slashes. If reps and weights both use slashes they must be the same number: if not, the preview flags the line and uses the first weight for all. *Export* writes routines in the same format.

Older files, with `PLAN:` for the week and `DAY:` for the routines, still read.

## With Everyday

Palestra decides name, length and exercises; Everyday decides when. To connect them, in Everyday open *Settings → Advanced → Connections → Palestra* and paste a token for `palestra-data` with *Contents: Read and write*.

![Everyday, in Palestra's settings: what it sees and what it writes](guide/en/26-everyday.webp)

- Each routine shows in Everyday as a **routine**, with its estimated length.
- The active workout's routines repeat on their days by themselves, at the time you chose. You plan the others by hand.
- A workout block in Everyday has *Open in Palestra*: it opens that routine ready to start.
- At the end Everyday ticks the block with the real start and end, and the estimate gets closer to the real length.
- *Move to tomorrow* in Palestra moves the block in Everyday too, at the next sync. *Back to today* puts it back where it was. A block you move in Everyday shows on its new day in Palestra as well.

## A typical week

**Sunday evening.** You open *Today*: the active workout is Chest and biceps · Back and triceps · Legs, on Monday, Wednesday and Saturday. Everyday has already put the three blocks in your plan.

**Monday, 18:00.** At the gym you tap *Start*. It's the first session of the week: Palestra offers the bench press at 62.5 kg instead of 60. You confirm. You follow the screen set by set; after the elliptical it sends you to the free weights, rack R1–2.

**Wednesday.** A work dinner. At lunch you open *Today* and tap *Move to tomorrow*: Back and triceps moves to Thursday, and after the sync the Everyday block is on Thursday at 18:00 too.

**Saturday morning.** Legs at 10:30. The leg press is taken: you tap *Pause*, wait, carry on. The waiting doesn't make the routine's estimate longer.

**Sunday.** In *History* you look at the bench press: +7.5 kg in four weeks.

## On a computer

On a wide screen the sections are in the top bar, next to the app's name, as in Ricette and Everyday, with the sync status and the gear. In *Training* a **second bar** under it holds *Workouts · Routines · Exercises* and, on the right, that tab's actions (*New routine* · *Import*).

Pages use the width. In *Workouts* the chosen workout's **week** sits beside the list, day by day, with what's missing. In *Routines* the list and the chosen routine sit side by side. *Exercises* is in three columns. *Gym* puts the equipment to the right of the zones; *Today* and *History* have two columns. When you edit a routine, the exercise library is on the right: search and click **+** to add.

![On a computer: Training's second bar and the workout's week](guide/en/desk/14-plans.webp)

Use a different token for each device: phone and computer stay in step at every sync.

## Tips and troubleshooting

**Sync doesn't start.** Tap the gear and look at the line at the top. If it says error 401 or 403, the token has expired or can't see `palestra-data`: make a new one and paste it in *GitHub connection*. With 404, the user or repository name is wrong.

**The screen turns off during a workout.** Exclude Palestra from your phone's battery saving, and check that the screen-on option is switched on in *Rest and training*.

**The block isn't ticked in Everyday.** Sync Palestra (gear → *Sync*), then Everyday.

**An Update bar appears.** A new version is out: tap it when you're not training.

**You want a copy of everything.** *Settings → Your data → Backup* downloads all your data as one file. The GitHub repository also keeps every past version.
