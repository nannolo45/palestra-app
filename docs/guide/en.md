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

In *Exercises → Gym* add the **zones** you move between (Entrance and cardio, Machine room, Free weights…) and tap *Reorder* to put them in the order you walk through them. Routines use this route so you walk less.

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

## The five sections

| Section | What it's for |
|---|---|
| *Today* | Today's routine, the week, your last session and the month |
| *Workouts* | Your weeks: which routines, on which days and at what time |
| *Routines* | All your routines, to search, open, edit and start |
| *Exercises* | Your exercises and, under *Gym*, the zones and machines |
| *History* | Your progress and every session you've done |

At the top of each page are its actions, like *New routine* and *Import*. The **gear** at the top right opens *Settings*: one list in three groups (*Connections*, *Training*, *App*). Each row says how it's set now and opens a page about that one thing; *← Settings* at the top goes back to the list.

In *Settings → Language and appearance*, **Appearance** picks the app's colours: *Automatic* follows the phone or computer (dark in the evening, if the device is), *Light* and *Dark* stay that way. The choice stays on this device, and the guide follows it. During a workout the screen is dark either way.

![Settings: everything in its own section](guide/en/03-settings.webp)

## Today

The first page tells you what's on today. At the top is the day's routine, with its time if you set one, and *Start*. If Everyday has already put it in your plan, it says *in Everyday*.

![Today: today's routine at 18:00 and the week](guide/en/01-today.webp)

### Start today's routine

Tap *Start*. The workout opens full screen: [During the workout](#during-the-workout) explains what you see.

### Move to tomorrow

Can't make it today? Tap *Move to tomorrow*. The routine moves to tomorrow for this week only, and the list of days shows it. *Back to today* undoes it. If you use Everyday, the block moves there too at the next sync: at the same time if it's free, otherwise in the first free slot tomorrow.

![After "Move to tomorrow": the routine has moved, and you can put it back](guide/en/02-moved.webp)

### The week and the month

Below are the week's routines: the ones done, the next one and the ones left. Then the **active workout** with *Change*, your last session and a square for each day of the month, yellow when you trained.

## Workouts

A workout is your week: the routines you do, each on its day. The **active** one is in yellow at the top; the others stay saved with their history, for when you need them (a deload week, for instance).

![Your workouts: the active one at the top](guide/en/14-plans.webp)

### Create a workout

Tap *New workout*, then *Add routine* for each one. Drag a routine by its handle to change the order. *Import*, next to *Add routine*, adds routines written as text.

![A workout: its routines, days and times](guide/en/15-plan.webp)

### Days and times

For each routine tap the weekday (M T W T F S S) and, if you like, pick a *Time*. With a time Everyday puts it in your plan by itself; without one, you choose when in Everyday each week.

### Change the active workout

In *Workouts* tap *Make active* on another workout. Mid-week, choose *From Monday* to finish the week with the old one, or *From today*. The old workout stays saved.

### Export and duplicate

*Export .txt* saves the workout as text, to send to someone or import again. *Duplicate* makes a copy to change without touching the original.

## Routines

A routine is a sequence of exercises you repeat, like "Legs". Palestra works out its **estimated length** from the sets and rests, and corrects it with your real times after a few sessions.

![Your routines, with the workout each one is in](guide/en/10-routines.webp)

### Find a routine

Type in the search, or pick *In the active workout* or *In no workout*. Under each routine you see which workout it's in.

### Inside a routine

At the top: the estimated length, the sets and the zones. Then the exercises in the order you do them, with arrows where you change zone. On the right of each exercise is **last time**: the weight, minutes or reps from your last session.

![A routine: today's plan and, underneath, last time](guide/en/11-routine.webp)

### Edit a routine

Tap *Edit*.

| Part | What you set |
|---|---|
| Name | How you see it here and in Everyday |
| *Automatic increase* | Whether Palestra offers to raise your weights each week |
| Order | Drag by the handle; *Sort by walking route* follows your way round the gym |
| An exercise | Tap it: sets, reps or seconds, weight, rest, or *Remove from routine* |
| *Add exercise* | Pick it from the list, or make a new one |
| *Import* | Adds exercises written as text |

![Add exercise: the list, with each one's machine](guide/en/13-add-exercise.webp)

### Duplicate into another workout

In a routine tap *Duplicate into another workout* and choose where. The copy is yours to change: the original stays as it was.

## Exercises and the gym

*Exercises* lists all your exercises, grouped *By muscle* or *By place*. Filter by type, open and close groups, or switch to the *Compact view* with the button at the top to see more at once.

![Exercises: groups, filters and the compact view](guide/en/07-exercises.webp)

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

### The gym: zones and machines

In *Exercises → Gym* you change the zones, their order and the machines in each zone. Tap a machine for its number, name and settings.

### A machine that isn't listed

On an exercise's page tap *New machine* (or *Other machine* for cardio). For cardio, pick what it measures besides time, up to three things, or make your own measure with a name and a unit.

## During the workout

The screen turns dark and large, stays on and works without signal. If the phone locks or the app reloads, open it again: it picks up where you were.

### This week's increases

At the first session of the week, if the automatic increase is on, Palestra offers your new targets: one exercise per line, before and after. Untick any you don't want, then tap *Confirm … and start*, or *Start with the old weights*.

![Going up? Untick the ones you don't want](guide/en/19-increase.webp)

### A set

You see the exercise, the set (2 of 4), reps and kg, the machine and its zone, and your note. If you did something different, adjust with − and +. Then tap *Done*. *Back* returns to the step before (the previous set or the cardio): what you had logged is taken off and you do it again.

![A set: reps, kg, where to go and your note](guide/en/20-set.webp)

**What the weight means.** With dumbbells the number is *per dumbbell* (what's written on it), with the sum underneath: "Take 2 dumbbells of 15 kg · 30 kg in all". With a barbell it's the total with the 20 kg bar, with the plates per side underneath. For an exercise that's different (one dumbbell, or a barbell counted per side) change it on the exercise's page, under *Equipment*: *The weight is* and *Dumbbells*.

### Looking at the exercises before and after

Tap the left or right edge of the screen (or swipe) to see the exercise before or after. It's clear you're only looking: *Preview* at the top, a dashed box saying where you really are, the rest in grey, and *Back to exercise …* instead of *Done*. In the bar at the top, the segment you're looking at has an outline; the yellow one stays where you are.

- **Do it now**, on an exercise further on (or one skipped): it comes next, for example when its machine is free and the one you're due on isn't.
- **Correct the numbers**, on one already done: change the reps and kg of each set.

![Preview: the exercise after, and the way back](guide/en/31-preview.webp)

Next to the machine there's a small picture: your photo, or the exercise's drawing. Tap it to see it full screen; *Machine* and *Exercise* switch between them, and tapping the drawing shows the other position.

![Full screen: your photo of the machine or the drawing](guide/en/30-viewer.webp)

### Rest

A countdown starts, and you see how long you actually rested. *+30 s* adds time, *Skip* moves straight on. At zero the phone vibrates and *Skip* turns into a yellow *Done*. Tapped *Done* too early, or got a number wrong? *Redo the set* reopens it with the values you had entered. Underneath is what's next and where to go.

![Rest: the time left and what comes next](guide/en/21-rest.webp)

### Cardio

For cardio you see the time left and the targets, which you can change with − and +. If you like, enter the distance from the display. Tap *Finish* when you're done.

![Cardio: the time left and the targets](guide/en/22-cardio.webp)

### Pause and finish

*Pause*, at the top right, stops the clock: for a phone call or a queue at a machine. **×** ends early: the sets you did are saved as a partial session. At the end you get the summary: time, sets, total weight, rests and new bests.

![Finished: the session summary](guide/en/23-summary.webp)

### Automatic increase, in Settings

In *Settings → Automatic increase* choose when (*If complete*: only if you did every set last time; *Always*) and by how much per type: machines +2.5 kg, dumbbells +1, bodyweight +1 rep, cardio +1 minute. On an exercise's page you can give it its own step or leave it out.

![Automatic increase: when, and by how much per type](guide/en/27-increase-settings.webp)

## History

Pick an exercise at the top: you see how its load has grown, by how much, and the last result. Below are all your sessions, complete or partial.

![History: an exercise's progress and your sessions](guide/en/24-history.webp)

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
| `Plank 3x45s` | A timed exercise |
| `Elliptical 10 min level 6` | Cardio, with its targets |
| `(dumbbells)` | The equipment, if you like: (barbell), (dumbbells), (cables), (machine) |
| `- Elbows slightly bent.` | A note for the exercise above |

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

On a wide screen the sections are in the top bar, next to the app's name, as in Ricette and Everyday. On the right are the page's actions (*New routine* · *Import*), the sync status and the gear.

Pages use the width. *Today* and *History* have two columns. In *Routines* the list and the chosen routine sit side by side. When you edit a routine, the exercise library is on the right: search and click **+** to add. Exercises are laid out in a grid.

Use a different token for each device: phone and computer stay in step at every sync.

## Tips and troubleshooting

**Sync doesn't start.** Tap the gear and look at the line at the top. If it says error 401 or 403, the token has expired or can't see `palestra-data`: make a new one and paste it in *GitHub connection*. With 404, the user or repository name is wrong.

**The screen turns off during a workout.** Exclude Palestra from your phone's battery saving, and check that the screen-on option is switched on in *Rest and training*.

**The block isn't ticked in Everyday.** Sync Palestra (gear → *Sync*), then Everyday.

**An Update bar appears.** A new version is out: tap it when you're not training.

**You want a copy of everything.** *Settings → Your data → Backup* downloads all your data as one file. The GitHub repository also keeps every past version.
