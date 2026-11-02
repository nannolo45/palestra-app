// The guide shown in Settings → Guida. It comes in two versions, picked by the screen it's opened on:
// phone (bottom tabs) and desktop (top bar, wider pages). Each chapter has a shared text, optional
// per-device overrides, and screenshots from guide/phone/*.jpg and guide/desktop/*.jpg
// (made by tests/guide-shots.cjs from the real app). **bold** becomes <strong>.
//
// Chapter: { title, intro, steps, shots, phone?: {intro?, steps?, shots?}, desktop?: {intro?, steps?, shots?} }
// shots: [[name, caption]]

export const GUIDE = {
  it: [
    {
      title: 'Installazione',
      intro: 'Una volta sola, circa dieci minuti. I tuoi dati restano in un repository GitHub **privato** che leggi solo tu (ed Everyday).',
      steps: [
        'Su GitHub crea il repository privato **palestra-data**, vuoto: Palestra scrive i suoi file alla prima sincronizzazione.',
        'Crea un token per ogni dispositivo: GitHub → Settings → Developer settings → **Fine-grained tokens**. Accesso solo a palestra-data, permesso **Contents: Read and write**, nient\'altro. Chiamalo come il dispositivo.',
        'In **Impostazioni → Collegamento GitHub** inserisci utente, repository e token, poi **Salva e sincronizza**.',
        'Prepara nell\'ordine: zone e macchine, poi esercizi, poi schede, poi un workout.',
      ],
      shots: [['settings', 'Impostazioni, divise in sezioni']],
      phone: {
        steps: [
          'Apri l\'indirizzo dell\'app in Chrome e scegli **Installa app** (o Aggiungi a schermata Home). Da lì aprila dall\'icona: funziona a schermo intero e offline.',
          'Le **Impostazioni** sono l\'ingranaggio in alto a destra in **Oggi**, e in fondo a ogni pagina che lo richiama.',
        ],
      },
      desktop: {
        steps: [
          'In Chrome o Edge apri l\'indirizzo dell\'app e scegli **Installa** nella barra dell\'indirizzo: si apre in una finestra sua, come le altre app.',
          'Le **Impostazioni** sono l\'ingranaggio in alto a destra, nella barra in alto, come in Ricette ed Everyday.',
        ],
      },
    },
    {
      title: 'Muoversi nell\'app',
      intro: 'Cinque sezioni: **Oggi** (cosa ti tocca), **Workout** (le tue settimane), **Schede** (le liste di esercizi), **Esercizi** (con la **Palestra**) e **Storico**. Un **allenamento** è una scheda fatta davvero.',
      shots: [['today', 'Oggi, la prima pagina']],
      phone: {
        steps: [
          'Le sezioni sono le **schede in basso**. Tocca quella che ti serve; quella aperta è gialla.',
          'Lo stato della sincronizzazione è in **Oggi**, sotto la data: toccalo per sincronizzare subito.',
          'Le azioni principali (**Nuova scheda**, **Importa**…) sono in cima a ogni pagina.',
        ],
      },
      desktop: {
        steps: [
          'Le sezioni sono nella **barra in alto**, accanto al nome dell\'app; quella aperta ha lo sfondo giallo chiaro.',
          'A destra nella barra: le azioni della pagina (**Nuova scheda · Importa**, **Nuovo workout · Importa**), lo stato della **sincronizzazione** e l\'**ingranaggio** delle impostazioni.',
          'Le pagine usano la larghezza: due colonne in Oggi e Storico, elenco e dettaglio affiancati in Schede, la libreria di esercizi accanto a una scheda in modifica.',
        ],
      },
    },
    {
      title: 'Oggi',
      intro: 'La prima pagina: il **workout attivo**, la scheda di oggi e cosa hai già fatto in settimana.',
      steps: [
        'In alto la scheda di oggi, con l\'ora se l\'hai data, e **▶ Inizia**.',
        '**Sposta a domani**: se oggi salti, la scheda passa a domani, solo per questa settimana. Everyday la ripianifica. **Rimetti oggi** annulla.',
        'Sotto la settimana (fatte, prossima, da fare), il workout attivo con **Cambia**, l\'ultimo allenamento e il mese.',
        'Senza un workout attivo vedi le tue schede da iniziare e un invito a crearne uno.',
      ],
      shots: [['today-moved', 'Dopo «Sposta a domani»']],
      desktop: { intro: 'La prima pagina, in due colonne: a sinistra la scheda di oggi e la settimana, a destra il **workout attivo**, l\'ultimo allenamento e il mese.' },
    },
    {
      title: 'La tua palestra',
      intro: 'In **Esercizi → Palestra** c\'è il percorso della tua palestra: le schede lo usano per farti camminare meno, e durante l\'allenamento ti dice dove andare.',
      steps: [
        '**Zone**: aggiungi le aree in cui ti sposti, poi **Riordina** e trascinale nell\'ordine in cui le attraversi.',
        '**Macchine**: in ogni zona, con il **numero** scritto sopra (M14, C3), un nome e le **regolazioni** (sedile, schienale, perno). Più macchine uguali possono essere una sola voce (C1–6).',
        'Una macchina che **non c\'è**: dalla pagina dell\'esercizio tocca **+ Nuova macchina** (o **+ Altra macchina** per il cardio). Per il cardio scegli cosa misura oltre al tempo, fino a tre, o crea una misura tua.',
      ],
      shots: [['gym', 'Esercizi → Palestra: le zone in ordine di percorso']],
    },
    {
      title: 'Esercizi',
      intro: 'Ogni esercizio ha un **tipo** in alto, e il tipo decide cosa imposti.',
      steps: [
        '**Pesi** (etichetta scura con il numero della macchina): serie, ripetizioni, kg, recupero.',
        '**Corpo libero** (bordo tratteggiato): serie, ripetizioni o secondi, recupero.',
        '**Cardio** (etichetta gialla): la macchina (tapis roulant, ellittica, bike, vogatore, stepper o una tua) e gli obiettivi: durata, velocità, pendenza, livello…',
        'Le **note** sono facoltative: come eseguirlo, cosa ricordare. Le vedi durante l\'allenamento.',
        'Nell\'elenco scegli **Per muscolo** o **Per posto**, filtra per tipo, apri e chiudi i gruppi, e passa alla **vista compatta** con il pulsante in alto.',
      ],
      shots: [['exercises', 'L\'elenco degli esercizi'], ['exercise', 'Un esercizio: tipo, macchina, note']],
      desktop: { steps: ['I gruppi sono affiancati in una griglia, così vedi più esercizi insieme.'] },
    },
    {
      title: 'Schede',
      intro: 'Una **scheda** è una sequenza di esercizi che ripeti, come Gambe o Full body. La **durata stimata** si calcola da sola ed è quella che usa Everyday.',
      steps: [
        'Nella pagina **Schede** ci sono tutte: cerca, filtra (**nel workout attivo**, **in nessun workout**) e vedi in quale workout è ognuna.',
        '**Nuova scheda** o **Importa**: dai un nome, poi **Aggiungi esercizio** (o **Importa** accanto) per ognuno. Toccalo per serie, ripetizioni, peso e recupero.',
        'Accanto a ogni esercizio vedi **l\'ultima volta**: il peso, i minuti o le ripetizioni dell\'ultimo allenamento.',
        'In **Modifica** trascina dalla maniglia per cambiare l\'ordine, **Ordina per percorso** per seguire la palestra, e attiva l\'**aumento automatico**.',
        '**Duplica in un altro workout** copia la scheda in un altro workout (o in uno nuovo), da cambiare senza toccare l\'originale.',
      ],
      phone: { shots: [['routines', 'Le tue schede'], ['routine', 'Una scheda, con l\'ultima volta di ogni esercizio']] },
      desktop: {
        steps: [
          'Elenco e scheda sono **affiancati**: tocca una scheda a sinistra e la vedi a destra senza cambiare pagina.',
          'In **Modifica**, a destra c\'è la **libreria degli esercizi**: cerca e tocca **+** per aggiungere.',
        ],
        shots: [['routines', 'Elenco e scheda affiancati'], ['routine-edit', 'Modifica, con la libreria degli esercizi accanto']],
      },
    },
    {
      title: 'Workout e workout attivo',
      intro: 'Un **workout** è la tua settimana: le schede che fai, ognuna nel suo giorno. Quello **attivo** è quello che vedi in Oggi e che Everyday pianifica.',
      steps: [
        'Nella pagina **Workout** quello attivo è in alto, gli altri restano salvati con il loro storico.',
        'Apri un workout per cambiargli nome, ordine delle schede (trascina) e il **giorno della settimana** di ognuna (L M M G V S D), con un\'**ora** facoltativa: con l\'ora Everyday la mette in agenda da sola.',
        '**Aggiungi scheda** o **Importa** per metterci altre schede.',
        '**Rendi attivo**: scegli se da lunedì (finisci la settimana con quello di prima) o da oggi.',
        '**Esporta .txt** salva il workout come testo, da condividere o reimportare.',
      ],
      shots: [['plans', 'I tuoi workout'], ['plan', 'Un workout: schede, giorni e ore']],
    },
    {
      title: 'Importare',
      intro: 'Accanto a **Nuovo workout**, **Nuova scheda** e **Aggiungi esercizio** c\'è **Importa**, e c\'è anche in **Impostazioni → Importa**: incolla un testo, o scegli un file .txt o .json. Prima vedi un\'anteprima.',
      steps: [
        '**WORKOUT:** nome della settimana, **SCHEDA:** nome di una scheda (dopo **@** giorno e ora, facoltativi: @ lun 18:00), poi un esercizio per riga. I file vecchi con SCHEDA: e GIORNO: si leggono ancora.',
        'Un esercizio: **Panca piana 4x8 60 kg rec 2:30**. Peso e recupero sono facoltativi. A tempo: **Plank 3x45s**. Cardio: **Ellittica 15 min livello 6**.',
        'L\'attrezzo tra parentesi, se vuoi: (bilanciere), (manubri), (cavi), (macchina). Una riga che inizia con **-** è una nota per l\'esercizio sopra.',
        'Nell\'anteprima: **già tuo** riusa il tuo esercizio, **nuovo** lo crea, **da controllare** segna un pezzo non capito.',
      ],
      shots: [['import', 'L\'anteprima prima di importare']],
    },
    {
      title: 'Durante l\'allenamento',
      intro: 'Tocca **▶ Inizia** (o **Apri in Palestra** da un blocco di Everyday). Lo schermo diventa scuro e grande, resta acceso e funziona senza rete.',
      steps: [
        '**Aumenti della settimana** (prima seduta della settimana, se attivo): togli la spunta a quelli che non vuoi, poi **Conferma e inizia**.',
        '**La serie**: esercizio, serie 2 di 4, ripetizioni e kg, macchina e zona, la tua nota. Correggi con −/+ se hai fatto diverso, poi **Fatto**.',
        '**Recupero**: conto alla rovescia, **+30 s** e **Salta**. Vibra a zero. Sotto: cosa viene dopo e dove andare.',
        '**Pausa** (in alto a destra) ferma il tempo. **×** chiude prima: le serie fatte si salvano come parziale.',
        'Se il telefono si blocca o l\'app si ricarica, riaprila: riprende da dove era.',
      ],
      shots: [['workout', 'Una serie'], ['rest', 'Il recupero']],
      desktop: { intro: 'Tocca **▶ Inizia**. Lo schermo diventa scuro e grande; su un computer o un tablet in palestra i numeri si leggono da lontano.' },
    },
    {
      title: 'Aumento automatico',
      intro: 'Una volta a settimana Palestra può alzare i tuoi obiettivi, e chiede sempre prima, all\'inizio della seduta.',
      steps: [
        'In **Impostazioni → Aumento automatico**: di quanto per tipo (macchine +2,5 kg, bilanciere +2,5, manubri +1, cavi +2,5, corpo libero +1 ripetizione, cardio +1 minuto) e quando.',
        '**Se completo**: sale solo se l\'ultima volta hai fatto tutte le serie. **Sempre**: ogni settimana, chiedendo comunque.',
        'Nella pagina di un esercizio: come il suo tipo, un passo tuo, o escluso. Si attiva per ogni scheda in **Modifica**.',
      ],
      shots: [['increase', 'I passi per tipo']],
    },
    {
      title: 'Storico',
      intro: 'I tuoi progressi e tutti gli allenamenti.',
      steps: [
        'Scegli un esercizio: vedi il carico nel tempo, quanto è cambiato e l\'ultima volta.',
        'Sotto (o accanto, su un computer) gli allenamenti, completi o parziali. Toccane uno per vedere ogni serie e dove sono andati i minuti.',
      ],
      shots: [['history', 'Progressi e allenamenti']],
    },
    {
      title: 'Everyday',
      intro: 'Palestra decide **cosa** fai in palestra, Everyday **quando**.',
      steps: [
        'In Everyday: **Impostazioni → Avanzate → Collegamenti → Palestra**, incolla un token per palestra-data con **Contents: Read and write**.',
        'Ogni scheda appare in Everyday come **routine**, con la sua durata stimata. Quelle del workout attivo si ripetono da sole nei loro giorni; le altre le pianifichi a mano.',
        'Un blocco di allenamento in Everyday ha **▶ Apri in Palestra**, che apre quella scheda pronta a partire.',
        'Alla fine Everyday segna fatto il blocco con l\'ora vera di inizio e fine, e la durata stimata si avvicina a quella reale.',
      ],
    },
    {
      title: 'Sync, offline e backup',
      intro: 'Tutto funziona senza rete: le modifiche aspettano sul dispositivo e partono alla prossima sincronizzazione.',
      steps: [
        'Si sincronizza all\'apertura, alla fine dell\'allenamento e con **Sync** in Impostazioni.',
        '**Più dispositivi** (telefono e computer): ognuno ha il suo token e la sua copia, e si uniscono a ogni sync; vince la modifica più recente.',
        'Quando esce una versione nuova compare la barra **Aggiorna**: toccala quando non ti stai allenando.',
        '**Backup** scarica tutti i dati in un file; il repository tiene anche tutte le versioni passate.',
      ],
    },
    {
      title: 'Problemi comuni',
      intro: 'Le soluzioni più frequenti.',
      steps: [
        'Errore **401/403**: il token è scaduto o non vede palestra-data. Creane uno nuovo e incollalo in Collegamento GitHub.',
        'Errore **404**: utente o nome del repository sbagliati.',
        '**Lo schermo si spegne** durante l\'allenamento: escludi Palestra dal risparmio batteria.',
        '**Il blocco non risulta fatto in Everyday**: tocca Sync in Palestra e poi in Everyday.',
      ],
    },
  ],
  en: [
    {
      title: 'Install',
      intro: 'Once, about ten minutes. Your data stays in a **private** GitHub repository that only you (and Everyday) can read.',
      steps: [
        'On GitHub, create the private repository **palestra-data**, empty: Palestra writes its files on the first sync.',
        'Make a token for each device: GitHub → Settings → Developer settings → **Fine-grained tokens**. Access to palestra-data only, permission **Contents: Read and write**, nothing else. Name it after the device.',
        'In **Settings → GitHub connection** enter user, repository and token, then **Save and sync**.',
        'Set up in this order: zones and machines, then exercises, then routines, then a workout.',
      ],
      shots: [['settings', 'Settings, in sections']],
      phone: {
        steps: [
          'Open the app\'s address in Chrome and choose **Install app** (or Add to Home screen). From then on open it from its icon: it runs full screen and works offline.',
          '**Settings** is the gear at the top right of **Today**.',
        ],
      },
      desktop: {
        steps: [
          'In Chrome or Edge open the app\'s address and choose **Install** in the address bar: it opens in its own window, like other apps.',
          '**Settings** is the gear at the top right, in the top bar, as in Ricette and Everyday.',
        ],
      },
    },
    {
      title: 'Getting around',
      intro: 'Five sections: **Today** (what\'s on), **Workouts** (your weeks), **Routines** (lists of exercises), **Exercises** (with the **Gym**) and **History**. A **session** is a routine you actually did.',
      shots: [['today', 'Today, the first page']],
      phone: {
        steps: [
          'The sections are the **tabs at the bottom**. Tap the one you need; the open one is yellow.',
          'The sync status is on **Today**, under the date: tap it to sync now.',
          'Main actions (**New routine**, **Import**…) are at the top of each page.',
        ],
      },
      desktop: {
        steps: [
          'The sections are in the **top bar**, next to the app\'s name; the open one has a light yellow background.',
          'On the right of the bar: the page\'s actions (**New routine · Import**, **New workout · Import**), the **sync** status and the settings **gear**.',
          'Pages use the width: two columns on Today and History, list and detail side by side in Routines, the exercise library next to a routine being edited.',
        ],
      },
    },
    {
      title: 'Today',
      intro: 'The first page: the **active workout**, today\'s routine and what you\'ve done this week.',
      steps: [
        'At the top, today\'s routine, with its time if you gave one, and **▶ Start**.',
        '**Move to tomorrow**: if you skip today, the routine moves to tomorrow, for this week only. Everyday re-plans it. **Back to today** undoes it.',
        'Below: the week (done, next, to do), the active workout with **Change**, the last session and the month.',
        'With no active workout you see your routines to start and a nudge to make one.',
      ],
      shots: [['today-moved', 'After “Move to tomorrow”']],
      desktop: { intro: 'The first page, in two columns: today\'s routine and the week on the left, the **active workout**, the last session and the month on the right.' },
    },
    {
      title: 'Your gym',
      intro: '**Exercises → Gym** is your gym as a walking route: routines use it so you walk less, and the workout tells you where to go next.',
      steps: [
        '**Zones**: add the areas you move between, then **Reorder** and drag them into the order you walk them.',
        '**Machines**: in each zone, with the **number** printed on it (M14, C3), a name and its **settings** (seat, back rest, pin). Several identical machines can be one entry (C1–6).',
        'A machine that **isn\'t listed**: on the exercise page tap **+ New machine** (or **+ Other machine** for cardio). For cardio, pick what it measures besides time, up to three, or make your own.',
      ],
      shots: [['gym', 'Exercises → Gym: zones in walking order']],
    },
    {
      title: 'Exercises',
      intro: 'Every exercise has a **type** at the top, and the type decides what you set.',
      steps: [
        '**Weights** (dark tag with the machine number): sets, reps, kg, rest.',
        '**Bodyweight** (dashed outline): sets, reps or seconds, rest.',
        '**Cardio** (yellow tag): the machine (treadmill, elliptical, bike, rower, stepper or your own) and the targets: duration, speed, incline, level…',
        '**Notes** are optional: how to do it, what to remember. They show during the workout.',
        'In the list choose **By muscle** or **By place**, filter by type, open and close groups, and switch to the **compact view** with the button at the top.',
      ],
      shots: [['exercises', 'The exercise list'], ['exercise', 'An exercise: type, machine, notes']],
      desktop: { steps: ['Groups sit side by side in a grid, so you see more at once.'] },
    },
    {
      title: 'Routines',
      intro: 'A **routine** is a sequence of exercises you repeat, like Legs or Full body. Its **estimated length** is worked out for you, and it\'s what Everyday plans with.',
      steps: [
        'The **Routines** page lists them all: search, filter (**in the active workout**, **in no workout**) and see which workout uses each.',
        '**New routine** or **Import**: give it a name, then **Add exercise** (or **Import** next to it) for each one. Tap one for sets, reps, weight and rest.',
        'Next to each exercise you see **last time**: the weight, minutes or reps from the last session.',
        'In **Edit**, drag by the handle to change the order, **Sort by route** to follow the gym, and switch on the **automatic increase**.',
        '**Duplicate into another workout** copies the routine into another workout (or a new one), to change without touching the original.',
      ],
      phone: { shots: [['routines', 'Your routines'], ['routine', 'A routine, with last time for each exercise']] },
      desktop: {
        steps: [
          'List and routine sit **side by side**: click a routine on the left and it shows on the right without leaving the page.',
          'In **Edit**, the **exercise library** is on the right: search and click **+** to add.',
        ],
        shots: [['routines', 'List and routine side by side'], ['routine-edit', 'Edit, with the exercise library alongside']],
      },
    },
    {
      title: 'Workouts and the active workout',
      intro: 'A **workout** is your week: the routines you do, each on its day. The **active** one is what you see in Today and what Everyday plans.',
      steps: [
        'On the **Workouts** page the active one is at the top, the others stay saved with their history.',
        'Open a workout to change its name, the order of its routines (drag) and the **weekday** of each (M T W T F S S), with an optional **time**: with a time Everyday schedules it by itself.',
        '**Add routine** or **Import** to put more routines in.',
        '**Make active**: choose from Monday (finish the week with the old one) or from today.',
        '**Export .txt** saves the workout as text, to share or import again.',
      ],
      shots: [['plans', 'Your workouts'], ['plan', 'A workout: routines, days and times']],
    },
    {
      title: 'Importing',
      intro: 'Next to **New workout**, **New routine** and **Add exercise** there\'s **Import**, and it\'s also in **Settings → Import**: paste text, or pick a .txt or .json file. You see a preview first.',
      steps: [
        '**WORKOUT:** the week\'s name, **ROUTINE:** a routine\'s name (after **@** an optional day and time: @ mon 18:00), then one exercise per line. Older files with PLAN: and DAY: still read.',
        'An exercise: **Bench press 4x8 60 kg rest 2:30**. Weight and rest are optional. Timed: **Plank 3x45s**. Cardio: **Elliptical 15 min level 6**.',
        'Equipment in brackets if you like: (barbell), (dumbbells), (cables), (machine). A line starting with **-** is a note for the exercise above.',
        'In the preview: **yours** reuses your exercise, **new** creates it, **check** marks a bit it didn\'t understand.',
      ],
      shots: [['import', 'The preview before importing']],
    },
    {
      title: 'During the workout',
      intro: 'Tap **▶ Start** (or **Open in Palestra** on an Everyday block). The screen turns dark and large, stays on and works without signal.',
      steps: [
        '**This week\'s increases** (first session of the week, if on): untick any you don\'t want, then **Confirm and start**.',
        '**The set**: exercise, set 2 of 4, reps and kg, machine and zone, your note. Adjust with −/+ if you did something different, then **Done**.',
        '**Rest**: a countdown, **+30 s** and **Skip**. It vibrates at zero. Underneath: what\'s next and where to go.',
        '**Pause** (top right) stops the clock. **×** ends early: the sets you did are saved as partial.',
        'If the phone locks or the app reloads, open it again: it picks up where it was.',
      ],
      shots: [['workout', 'A set'], ['rest', 'Rest']],
      desktop: { intro: 'Click **▶ Start**. The screen turns dark and large; on a laptop or tablet at the gym the numbers read from a distance.' },
    },
    {
      title: 'Automatic increase',
      intro: 'Once a week Palestra can raise your targets, and it always asks first, at the start of the session.',
      steps: [
        'In **Settings → Automatic increase**: how much per type (machines +2.5 kg, barbell +2.5, dumbbells +1, cables +2.5, bodyweight +1 rep, cardio +1 minute) and when.',
        '**If complete**: only after a session where every set was done. **Always**: every week, still asking first.',
        'On an exercise\'s page: like its type, your own step, or excluded. Switch it on per routine in **Edit**.',
      ],
      shots: [['increase', 'Steps per type']],
    },
    {
      title: 'History',
      intro: 'Your progress and every session.',
      steps: [
        'Pick an exercise: its load over time, how much it changed and the last result.',
        'Below (or alongside, on a computer) the sessions, complete or partial. Tap one to see every set and where the minutes went.',
      ],
      shots: [['history', 'Progress and sessions']],
    },
    {
      title: 'Everyday',
      intro: 'Palestra decides **what** you do at the gym, Everyday **when**.',
      steps: [
        'In Everyday: **Settings → Advanced → Connections → Palestra**, paste a token for palestra-data with **Contents: Read and write**.',
        'Each routine shows in Everyday as a **routine**, with its estimated length. The active workout\'s ones repeat on their days by themselves; plan the others by hand.',
        'A workout block in Everyday has **▶ Open in Palestra**, which opens that routine ready to start.',
        'At the end Everyday ticks the block with the real start and end, and the estimate gets closer to the real length.',
      ],
    },
    {
      title: 'Sync, offline and backup',
      intro: 'Everything works without signal: changes wait on the device and go up at the next sync.',
      steps: [
        'It syncs on opening, at the end of a workout and with **Sync** in Settings.',
        '**Several devices** (phone and computer): each has its own token and copy, and they merge on every sync; the most recent change wins.',
        'When a new version is out, an **Update** bar appears: tap it when you\'re not training.',
        '**Backup** downloads all your data as one file; the repository also keeps every past version.',
      ],
    },
    {
      title: 'Troubleshooting',
      intro: 'The most common fixes.',
      steps: [
        'Error **401/403**: the token expired or can\'t see palestra-data. Make a new one and paste it in GitHub connection.',
        'Error **404**: the user or repository name is wrong.',
        '**The screen turns off** during a workout: exclude Palestra from battery saving.',
        '**The block isn\'t ticked in Everyday**: tap Sync in Palestra, then in Everyday.',
      ],
    },
  ],
};

/** A chapter as the given device shows it: overrides replace, extra steps from the device are appended to the shared ones. */
export function chapterFor(ch, device) {
  const o = ch[device] || {};
  return {
    title: ch.title,
    intro: o.intro || ch.intro,
    steps: [...(ch.steps || []), ...(o.steps || [])],
    shots: o.shots || ch.shots || [],
  };
}

/** Every screenshot name a device needs (the screenshot script makes exactly these). */
export function shotNames(device) {
  const names = new Set();
  for (const lang of Object.values(GUIDE)) for (const ch of lang) for (const [n] of chapterFor(ch, device).shots) names.add(n);
  return [...names];
}
