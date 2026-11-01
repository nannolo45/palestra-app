// Translations: Italiano (first) and English. Values can be functions taking arguments.
import { state } from './store.js';

export const LANGS = { it: 'Italiano', en: 'English' };

const pl = (n, one, many) => (n === 1 ? one : many);

const it = {
  // tabs and common words
  tab_routines: 'Allenamenti', tab_exercises: 'Esercizi', tab_gym: 'Palestra', tab_history: 'Storico',
  settings: 'Impostazioni', save: 'Salva', saved: 'Salvato', cancel: 'Annulla', delete: 'Elimina', close: 'Chiudi', done: 'Fine', edit: 'Modifica',
  add: 'Aggiungi', back: 'Indietro', undo: 'Annulla', confirmYes: 'Sì', next: 'Prossima', skip: 'Salta', start: 'Inizia', resume: 'Riprendi',
  name: 'Nome', note: 'Nota', notes: 'Note', optional: 'facoltative', optionalOne: 'facoltativa', none: 'Nessuna', other: 'Altro', all: 'Tutti', number: 'Numero', unit: 'Unità',
  less: (x) => `Meno, ${x}`, more: (x) => `Più, ${x}`, removeX: (x) => `Togli ${x}`, moveItem: (x) => `Sposta ${x}`,
  deleted: (x) => `«${x}» eliminato`, nameNeeded: 'Serve un nome', notFound: 'Non trovato', notFoundText: 'Forse è stato eliminato su un altro dispositivo.',
  agoNow: 'adesso', agoMin: (n) => `${n} min fa`, agoH: (n) => `${n} h fa`,
  st_local: 'Solo su questo dispositivo', st_syncing: 'Sincronizzazione…', st_offline: 'Offline · si sincronizza appena c\'è rete', st_error: 'Sincronizzazione non riuscita', st_pending: 'Modifiche da caricare', st_synced: 'Sincronizzato',
  err_auth: 'token non valido o scaduto (401)', err_forbidden: 'il token non può scrivere nel repository (403)', err_notfound: 'utente o repository non trovato (404)', err_http: 'errore di GitHub', err_conflict: 'troppe modifiche insieme, riprova', err_network: 'nessuna connessione', err_unknown: 'errore sconosciuto', err_missing: 'mancano utente, repository o token', err_readonly: 'il token può solo leggere: serve Contents: Read and write',
  updateReady: 'È pronta una nuova versione.', update: 'Aggiorna',

  // types, kinds, measures
  type_weights: 'Pesi', type_bodyweight: 'Corpo libero', type_cardio: 'Cardio', cardio: 'Cardio',
  eq_machine: 'Macchina', eq_barbell: 'Bilanciere', eq_dumbbell: 'Manubri', eq_cable: 'Cavi',
  eqShort_machine: 'M', eqShort_barbell: 'BIL', eqShort_dumbbell: 'MAN', eqShort_cable: 'CAV', cardioShort: 'C', bodyShort: 'CL',
  kind_treadmill: 'Tapis roulant', kind_elliptical: 'Ellittica', kind_bike: 'Bike', kind_rower: 'Vogatore', kind_stepper: 'Stepper', kind_custom: 'Altra macchina', kind_otherMeasures: 'Altra (scegli tu cosa misura)',
  m_duration: 'Durata', m_speed: 'Velocità', m_incline: 'Pendenza', m_level: 'Livello', m_ramp: 'Rampa', m_resistance: 'Resistenza', m_cadence: 'Cadenza', m_strokes: 'Colpi', m_distance: 'Distanza', m_calories: 'Calorie', m_watt: 'Watt',
  cat_machine: 'Macchine', cat_barbell: 'Bilanciere', cat_dumbbell: 'Manubri', cat_cable: 'Cavi', cat_bodyweight: 'Corpo libero', cat_cardio: 'Cardio',
  catHint_machine: 'leg press, chest press…', catHint_barbell: 'panca, squat, stacco', catHint_dumbbell: 'per manubrio', catHint_cable: 'pulley, croci', catHint_bodyweight: 'ripetizioni', catHint_cardio: 'durata',
  reps: 'Ripetizioni', repsShort: 'rip', seconds: 'Secondi', sets: 'Serie', setsWord: 'serie', weight: 'Peso', rest: 'Recupero', zonesWord: 'zone',

  // routines
  yourRoutines: 'I tuoi allenamenti', newRoutine: 'Nuovo allenamento', newRoutineName: 'Nuovo allenamento',
  nextFromEveryday: 'Prossimo · da Everyday', nExercises: (n) => `${n} ${pl(n, 'esercizio', 'esercizi')}`, aboutMin: (n) => `circa ${n} min`, startsAt: (p) => `inizia da ${p}`,
  lastOn: (d) => `ultima ${d}`, neverDone: 'mai fatto', estimated: 'stimati', restShort: (r) => `riposo ${r}`,
  inEverydaySaved: (m) => `In Everyday come attività salvata · ${m} min`, plannedOn: (x) => `Pianificato: ${x}`, notPlanned: 'Non ancora pianificato in Everyday',
  esRoutinesTitle: 'Nessun allenamento ancora', esRoutinesText: 'Crea il primo allenamento con gli esercizi che hai già.', esRoutinesFirst: 'Prima prepara la palestra (zone e macchine) e qualche esercizio, poi crea un allenamento.', setUpGym: 'Prepara la palestra',
  esItemsTitle: 'Ancora nessun esercizio', esItemsText: 'Aggiungi gli esercizi a questo allenamento.',
  editRoutine: 'Modifica allenamento', autoIncrease: 'Aumento automatico', autoIncreaseHint: 'Te lo propone all\'inizio della prima seduta della settimana',
  autoIncreaseHow: 'Solo se l\'ultima volta hai completato. Ogni esercizio si può escludere.', changeSteps: 'Cambia i passi',
  orderTitle: 'Ordine', dragToMove: '· trascina per spostare', addExercise: 'Aggiungi esercizio', deleteRoutine: 'Elimina allenamento', deleteRoutineQ: (n) => `Eliminare «${n}»? Le sedute già fatte restano nello storico.`,
  sortByRoute: 'Ordina per percorso', sortedByRoute: 'Ordinati per zona, nell\'ordine del percorso', excluded: 'escluso', timed: 'a tempo', removeFromRoutine: 'Togli dall\'allenamento', measureBy: 'Misura', noExercisesYet: 'Non hai ancora esercizi.',

  // exercises
  newExercise: 'Nuovo esercizio', searchExercise: 'Cerca un esercizio', searchExercisePh: 'Cerca esercizio o macchina', byMuscle: 'Per muscolo', byPlace: 'Per posto', groupBy: 'Raggruppa', filterType: 'Filtra per tipo', noPlace: 'Senza zona',
  esExercisesTitle: 'Nessun esercizio ancora', esExercisesText: 'Aggiungi gli esercizi che fai: pesi, corpo libero o cardio.', esNoMatch: 'Nessun esercizio trovato', esNoMatchText: 'Prova a cambiare ricerca o filtro.',
  exerciseNamePh: 'Nome dell\'esercizio', exerciseType: 'Tipo di esercizio', equipment: 'Attrezzo', machine: 'Macchina', place: 'Zona', noMachine: 'Senza macchina', newMachine: 'Nuova macchina', otherMachine: 'Altra macchina',
  whichOnes: 'Quale', anyOfThem: 'Una qualsiasi', target: 'Obiettivo', targetHint: 'È il punto di partenza quando lo aggiungi a un allenamento.',
  defaultRest: 'Recupero di solito', muscles: 'Muscoli', musclesPh: 'es. Quadricipiti, Glutei', timedHint: 'A tempo (secondi invece di ripetizioni)',
  notesPh: 'Come eseguirlo, cosa ricordare…', notesHint: 'Le vedi durante l\'allenamento, sotto la macchina, e nell\'elenco degli esercizi.',
  incLikeType: (cat, step) => `Come ${cat} · ${step}`, incNone: 'nessuno', incCustom: 'Passo personalizzato', incOff: 'Escluso', incStep: 'Di quanto ogni settimana',
  lastTime: 'Ultima volta', seeProgress: 'Vedi i progressi', deleteExercise: 'Elimina esercizio', deleteExerciseQ: (n) => `Eliminare «${n}»?`,
  deleteExerciseUsed: (n, rs) => `«${n}» è in: ${rs}. Eliminandolo sparisce anche da lì. Le sedute già fatte restano.`, exercise: 'Esercizio',

  // gym
  yourGym: 'La tua palestra', nZones: (n) => `${n} ${pl(n, 'zona', 'zone')}`, nStations: (n) => `${n} ${pl(n, 'postazione', 'postazioni')}`, reorder: 'Riordina',
  walkOrderHint: 'In ordine di percorso: gli allenamenti seguono questo giro per camminare meno.', addZone: 'Aggiungi zona', newZone: 'Nuova zona', editZone: 'Zona', zonePh: 'es. Sala pesi, fila 2',
  deleteZone: 'Elimina zona', deleteZoneQ: (n, k) => `Eliminare «${n}»? ${k} ${pl(k, 'macchina resta', 'macchine restano')} senza zona.`, addMachineTo: (z) => `Aggiungi una macchina in ${z}`,
  esGymTitle: 'Com\'è fatta la tua palestra?', esGymText: 'Aggiungi le zone in cui ti sposti, nell\'ordine in cui le attraversi, poi le macchine di ognuna.',
  editMachine: 'Macchina', machineNamePh: 'es. Leg press', zone: 'Zona', machineType: 'Tipo di macchina', settingsOfMachine: 'Regolazioni', settingsPh: 'es. Sedile 5 · schienale 3', noSettings: 'nessuna regolazione',
  cardioKind: 'Che macchina è', whatItMeasures: 'Cosa misura', nOfMax: (n, m) => `${n} di ${m} in più`, customMeasure: '+ Misura personalizzata', customMeasurePh: 'es. Programma', addMeasure: 'Aggiungi misura',
  deleteMachine: 'Elimina macchina', deleteMachineQ: (n) => `Eliminare «${n}»?`, deleteMachineUsed: (n, ex) => `«${n}» è usata da: ${ex}. Gli esercizi restano, senza macchina.`,

  // history
  progressPerExercise: 'Progressi per esercizio', inNSessions: (n) => `in ${n} sedute`, lastWas: (x) => `Ultima: ${x}.`, avgRest: (x) => `Recupero medio ${x}.`,
  chartLabel: (ex, n, a, b, v1, v2, u) => `${ex}, ${n} sedute dal ${a} al ${b}: da ${v1} a ${v2} ${u}`,
  monthSummary: (m, n, time) => `${m}: ${n} ${pl(n, 'allenamento', 'allenamenti')} · ${time}`, sessionsTitle: 'Sedute', workout: 'Allenamento',
  nSets: (n) => `${n} serie`, nOfMSets: (a, b) => `${a} di ${b} serie`, partial: 'Parziale', complete: 'Completo',
  esHistoryTitle: 'Ancora nessuna seduta', esHistoryText: 'Gli allenamenti che fai compaiono qui, con i progressi di ogni esercizio.',
  fromEveryday: 'da Everyday', restedFor: (x) => `riposo ${x}`, deleteSession: 'Elimina seduta', deleteSessionQ: 'Eliminare questa seduta?', deletedSession: 'Seduta eliminata',
  whereMinutesWent: (n) => `Dove sono andati i ${n} minuti`, bd_work: 'Lavoro', bd_rest: 'Recuperi', bd_walk: 'Spostamenti', bd_pause: 'Pausa',

  // workout
  workoutInProgress: 'Allenamento in corso', workoutInProgressText: (n) => `Hai già iniziato ${n}. Riprendilo, oppure chiudilo e salva le serie fatte.`, endItAndStart: (n) => `Chiudi quello e inizia ${n}`,
  workoutInProgressShort: (n) => `${n} in corso`, firstOfWeek: 'Prima seduta della settimana', goUpQ: 'Si sale di peso?',
  goUpText: 'Dove la volta scorsa hai fatto tutte le ripetizioni, ti propongo il nuovo obiettivo. Togli quelli che non te la senti.', goUpTextAlways: 'Ecco i nuovi obiettivi della settimana. Togli quelli che non te la senti.',
  staysAt: (n) => `${n} resta com\'è`, heldReps: (u, of, g) => `L\'ultima volta ${u} ${pl(u, 'serie', 'serie')} su ${of} sotto le ${g} ripetizioni`, heldSets: (d, g) => `L\'ultima volta ${d} serie su ${g}`,
  heldSeconds: (u, of, g) => `L\'ultima volta ${u} serie su ${of} sotto i ${g} secondi`, heldMinutes: (d, g) => `L\'ultima volta ${d} min su ${g}`,
  excludedList: (x) => `${x}: esclus${x.includes(',') ? 'i' : 'o'} dall\'aumento`, timedList: (x) => `${x}: a tempo`,
  confirmNAndStart: (n) => (n === 1 ? 'Conferma 1 aumento e inizia' : `Conferma ${n} aumenti e inizia`), startWithOld: 'Inizia con i pesi di prima',
  noWorkout: 'Nessun allenamento in corso.', endWorkout: 'Termina allenamento', pauseWorkout: 'Metti in pausa l\'allenamento', exNofM: (r, a, b) => `${r} · esercizio ${a} di ${b}`,
  setNofM: (a, b) => `Serie ${a} di ${b}`, doneSet: 'Fatto', skipSet: 'Salta serie', setDone: (n, x) => `Serie ${n}: ${x}`, lastTimeWas: (x) => `la volta scorsa ${x}`,
  minutesN: (n) => `${n} min`, timeLeft: 'Mancano', overTime: 'Oltre il tempo', distanceFromDisplay: 'Distanza dal display', pause: 'Pausa', finishCardio: 'Fine',
  restAndMove: 'Recupero e spostamento', ofPlanned: (x) => `di ${x} previsti`, youRested: 'Hai riposato', sameMachine: (n) => (n ? `Stessa macchina, ${n}` : 'Stesso posto'), thenEx: (n, w) => `Poi ${n}${w ? ` · ${w}` : ''}`,
  paused: 'In pausa', pausedText: 'Il tempo dell\'allenamento è fermo. Le pause non allungano la stima.',
  endNothingQ: 'Non hai ancora fatto nessuna serie. Chiudere senza salvare?', endEarlyQ: 'Terminare adesso? Le serie fatte si salvano come allenamento parziale.',
  workoutFinished: 'Allenamento finito', allSets: 'tutte le serie', time: 'Tempo', estimatedN: (n) => `previsti ${n}`, totalWeight: 'Peso totale', repsTimesKg: 'ripetizioni × kg',
  rests: 'Recuperi', restsBreakdown: (x) => `previsti ${x}`, perExercise: 'Per esercizio', newBest: 'Nuovo massimo',
  savedEveryday: 'Salvato. Al prossimo sync Everyday segna fatto il blocco con i tempi veri.', savedLocal: 'Salvato. Si carica appena c\'è rete.',

  // settings
  syncStatus: 'Stato della sincronizzazione', notConnected: 'Non collegato', neverSynced: 'mai sincronizzato', sync: 'Sync', connect: 'Collega', syncing: 'Sincronizzazione…', syncOk: 'Sincronizzato.',
  contractNewer: 'I dati sono stati scritti da una versione più nuova di Palestra: aggiorna l\'app. Fino ad allora li leggo ma non li modifico.',
  set_github: 'Collegamento GitHub', set_increase: 'Aumento automatico', set_training: 'Recupero e allenamento', set_gym: 'Palestra', set_everyday: 'Everyday', set_lang: 'Lingua', set_backup: 'Backup', set_guide: 'Guida',
  whenDone: 'Se completo', whenAlways: 'Sempre', restBetweenSetsShort: (s) => `${s} s tra le serie`, vibration: 'vibrazione', screenOn: 'schermo acceso',
  everydayPlannedN: (n) => `${n} ${pl(n, 'allenamento pianificato', 'allenamenti pianificati')}`, everydayHow: 'Come funziona il collegamento', backupSub: 'Scarica una copia dei tuoi dati', guideSub: 'Come installare e usare Palestra',
  ghUser: 'Utente GitHub', ghRepo: 'Repository dei dati', ghBranch: 'Branch', ghToken: 'Token', tokenKeep: (m) => `Lascia vuoto per tenere quello attuale (${m})`,
  ghTokenHint: 'Fine-grained token, solo per palestra-data, con Contents: Read and write. Resta solo su questo dispositivo.', saveAndSync: 'Salva e sincronizza', testConnection: 'Prova il collegamento', testing: 'Provo…',
  testOkPrivate: 'Funziona. Il repository è privato.', testOkPublic: 'Funziona, ma il repository è pubblico: chiunque può leggere i tuoi dati. Rendilo privato.',
  disconnect: 'Scollega questo dispositivo', disconnectQ: 'Scollegare questo dispositivo? Il token viene cancellato da qui; i dati restano sul dispositivo e su GitHub.', disconnected: 'Scollegato',
  when: 'Quando', whenDoneText: 'Solo se l\'ultima volta hai completato tutte le serie. Gli altri restano fermi e ti dice perché.', whenAlwaysText: 'Ogni settimana, anche se l\'ultima volta non hai completato. Te lo chiede comunque prima.',
  howMuchPerType: 'Di quanto, per tipo', stepsHint: 'Valgono per tutti gli esercizi del tipo. Nella scheda di un esercizio puoi cambiarle o escluderlo; per ogni allenamento lo attivi in Modifica.',
  increaseIntro: 'Una volta a settimana, all\'inizio della prima seduta, ti propone i nuovi obiettivi. Confermi tu.',
  restBetweenSets: 'Recupero tra le serie', restBetweenExercises: 'Tra un esercizio e l\'altro', vibrateAtEnd: 'Vibra a fine recupero', soundAtEnd: 'Suono a fine recupero', keepScreenOn: 'Schermo acceso durante l\'allenamento', keepScreenOnHint: 'Se si spegne lo stesso, escludi Palestra dal risparmio batteria.',
  trainingHint: 'Sono i valori di partenza per i nuovi esercizi. Ogni esercizio in un allenamento ha il suo recupero.',
  gymName: 'Nome della palestra', gymNamePh: 'es. la tua palestra', units: 'Unità', zonesAndMachines: 'Zone e macchine',
  contract: 'Contratto dati', plannedByEveryday: 'Pianificati da Everyday', nothingYet: 'ancora niente', routinesShared: 'Allenamenti che Everyday vede',
  everydayIntro: 'Palestra decide cosa fai in palestra, Everyday quando.',
  everydayExplain: [
    'In Everyday apri **Impostazioni → Avanzate → Collegamenti → Palestra** e incolla un token per **palestra-data** con Contents: Read and write.',
    'Ogni allenamento appare in Everyday come **attività salvata** con la durata stimata. Pianificalo come le altre: quante volte a settimana, finestre, andata e ritorno.',
    'Un blocco di allenamento in Everyday ha **▶ Apri in Palestra**. A fine allenamento Everyday segna fatto il blocco con l\'ora vera di inizio e fine.',
    'Everyday scrive una sola cosa qui: gli allenamenti pianificati, per mostrarti il prossimo.',
  ],
  backupText: 'Scarica tutti i tuoi dati (zone, macchine, esercizi, allenamenti, sedute, impostazioni) in un file JSON.', downloadBackup: 'Scarica il backup',
  backupRepoHint: 'Il repository palestra-data tiene anche ogni versione passata nella sua cronologia.', thisDevice: 'Questo dispositivo', wipeDevice: 'Cancella i dati da questo dispositivo', wipe: 'Cancella',
  wipeQSynced: 'Cancellare i dati da questo dispositivo? Poi li riscarico da GitHub.', wipeQLocal: 'Cancellare tutti i dati? Non sei collegato a GitHub: non si possono recuperare.', wiped: 'Dati cancellati da questo dispositivo',
  guideIntro: 'Come installare Palestra e usarlo, dalla prima sincronizzazione al collegamento con Everyday.',
};

const en = {
  tab_routines: 'Routines', tab_exercises: 'Exercises', tab_gym: 'Gym', tab_history: 'History',
  settings: 'Settings', save: 'Save', saved: 'Saved', cancel: 'Cancel', delete: 'Delete', close: 'Close', done: 'Done', edit: 'Edit',
  add: 'Add', back: 'Back', undo: 'Undo', confirmYes: 'Yes', next: 'Next', skip: 'Skip', start: 'Start', resume: 'Resume',
  name: 'Name', note: 'Note', notes: 'Notes', optional: 'optional', optionalOne: 'optional', none: 'None', other: 'Other', all: 'All', number: 'Number', unit: 'Unit',
  less: (x) => `Less, ${x}`, more: (x) => `More, ${x}`, removeX: (x) => `Remove ${x}`, moveItem: (x) => `Move ${x}`,
  deleted: (x) => `“${x}” deleted`, nameNeeded: 'It needs a name', notFound: 'Not found', notFoundText: 'It may have been deleted on another device.',
  agoNow: 'just now', agoMin: (n) => `${n} min ago`, agoH: (n) => `${n} h ago`,
  st_local: 'Only on this device', st_syncing: 'Syncing…', st_offline: 'Offline · syncs when there\'s signal', st_error: 'Sync failed', st_pending: 'Changes to upload', st_synced: 'Synced',
  err_auth: 'token invalid or expired (401)', err_forbidden: 'the token can\'t write to the repository (403)', err_notfound: 'user or repository not found (404)', err_http: 'GitHub error', err_conflict: 'too many changes at once, try again', err_network: 'no connection', err_unknown: 'unknown error', err_missing: 'user, repository or token missing', err_readonly: 'the token can only read: it needs Contents: Read and write',
  updateReady: 'A new version is ready.', update: 'Update',

  type_weights: 'Weights', type_bodyweight: 'Bodyweight', type_cardio: 'Cardio', cardio: 'Cardio',
  eq_machine: 'Machine', eq_barbell: 'Barbell', eq_dumbbell: 'Dumbbells', eq_cable: 'Cables',
  eqShort_machine: 'M', eqShort_barbell: 'BAR', eqShort_dumbbell: 'DB', eqShort_cable: 'CAB', cardioShort: 'C', bodyShort: 'BW',
  kind_treadmill: 'Treadmill', kind_elliptical: 'Elliptical', kind_bike: 'Bike', kind_rower: 'Rower', kind_stepper: 'Stepper', kind_custom: 'Other machine', kind_otherMeasures: 'Other (choose what it measures)',
  m_duration: 'Duration', m_speed: 'Speed', m_incline: 'Incline', m_level: 'Level', m_ramp: 'Ramp', m_resistance: 'Resistance', m_cadence: 'Cadence', m_strokes: 'Strokes', m_distance: 'Distance', m_calories: 'Calories', m_watt: 'Watts',
  cat_machine: 'Machines', cat_barbell: 'Barbell', cat_dumbbell: 'Dumbbells', cat_cable: 'Cables', cat_bodyweight: 'Bodyweight', cat_cardio: 'Cardio',
  catHint_machine: 'leg press, chest press…', catHint_barbell: 'bench, squat, deadlift', catHint_dumbbell: 'per dumbbell', catHint_cable: 'pulley, flyes', catHint_bodyweight: 'reps', catHint_cardio: 'duration',
  reps: 'Reps', repsShort: 'reps', seconds: 'Seconds', sets: 'Sets', setsWord: 'sets', weight: 'Weight', rest: 'Rest', zonesWord: 'zones',

  yourRoutines: 'Your routines', newRoutine: 'New routine', newRoutineName: 'New routine',
  nextFromEveryday: 'Next · from Everyday', nExercises: (n) => `${n} ${pl(n, 'exercise', 'exercises')}`, aboutMin: (n) => `about ${n} min`, startsAt: (p) => `starts at ${p}`,
  lastOn: (d) => `last ${d}`, neverDone: 'never done', estimated: 'estimated', restShort: (r) => `rest ${r}`,
  inEverydaySaved: (m) => `In Everyday as a saved task · ${m} min`, plannedOn: (x) => `Planned: ${x}`, notPlanned: 'Not planned in Everyday yet',
  esRoutinesTitle: 'No routines yet', esRoutinesText: 'Make your first routine from the exercises you have.', esRoutinesFirst: 'First set up the gym (zones and machines) and a few exercises, then make a routine.', setUpGym: 'Set up the gym',
  esItemsTitle: 'No exercises yet', esItemsText: 'Add exercises to this routine.',
  editRoutine: 'Edit routine', autoIncrease: 'Automatic increase', autoIncreaseHint: 'Proposed at the start of the first session of the week',
  autoIncreaseHow: 'Only if you completed it last time. Any exercise can be left out.', changeSteps: 'Change the steps',
  orderTitle: 'Order', dragToMove: '· drag to move', addExercise: 'Add exercise', deleteRoutine: 'Delete routine', deleteRoutineQ: (n) => `Delete “${n}”? Past sessions stay in the history.`,
  sortByRoute: 'Sort by walking route', sortedByRoute: 'Sorted by zone, in walking order', excluded: 'excluded', timed: 'timed', removeFromRoutine: 'Remove from routine', measureBy: 'Measure', noExercisesYet: 'You have no exercises yet.',

  newExercise: 'New exercise', searchExercise: 'Search an exercise', searchExercisePh: 'Search exercise or machine', byMuscle: 'By muscle', byPlace: 'By place', groupBy: 'Group', filterType: 'Filter by type', noPlace: 'No zone',
  esExercisesTitle: 'No exercises yet', esExercisesText: 'Add the exercises you do: weights, bodyweight or cardio.', esNoMatch: 'No exercise found', esNoMatchText: 'Try another search or filter.',
  exerciseNamePh: 'Exercise name', exerciseType: 'Exercise type', equipment: 'Equipment', machine: 'Machine', place: 'Zone', noMachine: 'No machine', newMachine: 'New machine', otherMachine: 'Other machine',
  whichOnes: 'Which one', anyOfThem: 'Any of them', target: 'Target', targetHint: 'The starting point when you add it to a routine.',
  defaultRest: 'Usual rest', muscles: 'Muscles', musclesPh: 'e.g. Quads, Glutes', timedHint: 'Timed (seconds instead of reps)',
  notesPh: 'How to do it, what to remember…', notesHint: 'Shown during the workout, under the machine, and in the exercise list.',
  incLikeType: (cat, step) => `Like ${cat} · ${step}`, incNone: 'none', incCustom: 'Own step', incOff: 'Excluded', incStep: 'How much each week',
  lastTime: 'Last time', seeProgress: 'See progress', deleteExercise: 'Delete exercise', deleteExerciseQ: (n) => `Delete “${n}”?`,
  deleteExerciseUsed: (n, rs) => `“${n}” is in: ${rs}. Deleting it removes it from there too. Past sessions stay.`, exercise: 'Exercise',

  yourGym: 'Your gym', nZones: (n) => `${n} ${pl(n, 'zone', 'zones')}`, nStations: (n) => `${n} ${pl(n, 'station', 'stations')}`, reorder: 'Reorder',
  walkOrderHint: 'In walking order: routines follow this route so you walk less.', addZone: 'Add zone', newZone: 'New zone', editZone: 'Zone', zonePh: 'e.g. Weights room, row 2',
  deleteZone: 'Delete zone', deleteZoneQ: (n, k) => `Delete “${n}”? ${k} ${pl(k, 'machine stays', 'machines stay')} without a zone.`, addMachineTo: (z) => `Add a machine to ${z}`,
  esGymTitle: 'What\'s your gym like?', esGymText: 'Add the zones you move between, in the order you walk them, then the machines in each.',
  editMachine: 'Machine', machineNamePh: 'e.g. Leg press', zone: 'Zone', machineType: 'Machine type', settingsOfMachine: 'Settings', settingsPh: 'e.g. Seat 5 · back 3', noSettings: 'no settings',
  cardioKind: 'What machine it is', whatItMeasures: 'What it measures', nOfMax: (n, m) => `${n} of ${m} extra`, customMeasure: '+ Your own measure', customMeasurePh: 'e.g. Programme', addMeasure: 'Add measure',
  deleteMachine: 'Delete machine', deleteMachineQ: (n) => `Delete “${n}”?`, deleteMachineUsed: (n, ex) => `“${n}” is used by: ${ex}. The exercises stay, without a machine.`,

  progressPerExercise: 'Progress per exercise', inNSessions: (n) => `in ${n} sessions`, lastWas: (x) => `Last: ${x}.`, avgRest: (x) => `Average rest ${x}.`,
  chartLabel: (ex, n, a, b, v1, v2, u) => `${ex}, ${n} sessions from ${a} to ${b}: from ${v1} to ${v2} ${u}`,
  monthSummary: (m, n, time) => `${m}: ${n} ${pl(n, 'workout', 'workouts')} · ${time}`, sessionsTitle: 'Sessions', workout: 'Workout',
  nSets: (n) => `${n} ${pl(n, 'set', 'sets')}`, nOfMSets: (a, b) => `${a} of ${b} sets`, partial: 'Partial', complete: 'Complete',
  esHistoryTitle: 'No sessions yet', esHistoryText: 'The workouts you do show up here, with each exercise\'s progress.',
  fromEveryday: 'from Everyday', restedFor: (x) => `rest ${x}`, deleteSession: 'Delete session', deleteSessionQ: 'Delete this session?', deletedSession: 'Session deleted',
  whereMinutesWent: (n) => `Where the ${n} minutes went`, bd_work: 'Work', bd_rest: 'Rests', bd_walk: 'Walking', bd_pause: 'Pause',

  workoutInProgress: 'Workout in progress', workoutInProgressText: (n) => `You've already started ${n}. Resume it, or end it and save the sets you did.`, endItAndStart: (n) => `End that one and start ${n}`,
  workoutInProgressShort: (n) => `${n} in progress`, firstOfWeek: 'First session of the week', goUpQ: 'Going up?',
  goUpText: 'Where you hit every rep last time, here\'s the new target. Untick any you don\'t feel like.', goUpTextAlways: 'Here are this week\'s new targets. Untick any you don\'t feel like.',
  staysAt: (n) => `${n} stays where it is`, heldReps: (u, of, g) => `Last time ${u} of ${of} sets under ${g} reps`, heldSets: (d, g) => `Last time ${d} of ${g} sets`,
  heldSeconds: (u, of, g) => `Last time ${u} of ${of} sets under ${g} seconds`, heldMinutes: (d, g) => `Last time ${d} of ${g} min`,
  excludedList: (x) => `${x}: excluded from the increase`, timedList: (x) => `${x}: timed`,
  confirmNAndStart: (n) => (n === 1 ? 'Confirm 1 increase and start' : `Confirm ${n} increases and start`), startWithOld: 'Start with the old weights',
  noWorkout: 'No workout in progress.', endWorkout: 'End workout', pauseWorkout: 'Pause the workout', exNofM: (r, a, b) => `${r} · exercise ${a} of ${b}`,
  setNofM: (a, b) => `Set ${a} of ${b}`, doneSet: 'Done', skipSet: 'Skip set', setDone: (n, x) => `Set ${n}: ${x}`, lastTimeWas: (x) => `last time ${x}`,
  minutesN: (n) => `${n} min`, timeLeft: 'Time left', overTime: 'Over time', distanceFromDisplay: 'Distance on the display', pause: 'Pause', finishCardio: 'Finish',
  restAndMove: 'Rest and move', ofPlanned: (x) => `of ${x} planned`, youRested: 'You\'ve rested', sameMachine: (n) => (n ? `Same machine, ${n}` : 'Same place'), thenEx: (n, w) => `Then ${n}${w ? ` · ${w}` : ''}`,
  paused: 'Paused', pausedText: 'The workout clock is stopped. Pauses don\'t make the estimate longer.',
  endNothingQ: 'You haven\'t done any set yet. End without saving?', endEarlyQ: 'End now? The sets you did are saved as a partial workout.',
  workoutFinished: 'Workout finished', allSets: 'all sets', time: 'Time', estimatedN: (n) => `estimated ${n}`, totalWeight: 'Total weight', repsTimesKg: 'reps × kg',
  rests: 'Rests', restsBreakdown: (x) => `planned ${x}`, perExercise: 'Per exercise', newBest: 'New best',
  savedEveryday: 'Saved. At the next sync Everyday ticks the block with the real times.', savedLocal: 'Saved. It uploads as soon as there\'s signal.',

  syncStatus: 'Sync status', notConnected: 'Not connected', neverSynced: 'never synced', sync: 'Sync', connect: 'Connect', syncing: 'Syncing…', syncOk: 'Synced.',
  contractNewer: 'The data was written by a newer Palestra: update the app. Until then I read it but don\'t change it.',
  set_github: 'GitHub connection', set_increase: 'Automatic increase', set_training: 'Rest and training', set_gym: 'Gym', set_everyday: 'Everyday', set_lang: 'Language', set_backup: 'Backup', set_guide: 'Guide',
  whenDone: 'If complete', whenAlways: 'Always', restBetweenSetsShort: (s) => `${s} s between sets`, vibration: 'vibration', screenOn: 'screen on',
  everydayPlannedN: (n) => `${n} ${pl(n, 'workout planned', 'workouts planned')}`, everydayHow: 'How the connection works', backupSub: 'Download a copy of your data', guideSub: 'How to install and use Palestra',
  ghUser: 'GitHub user', ghRepo: 'Data repository', ghBranch: 'Branch', ghToken: 'Token', tokenKeep: (m) => `Leave empty to keep the current one (${m})`,
  ghTokenHint: 'Fine-grained token, for palestra-data only, with Contents: Read and write. It stays on this device only.', saveAndSync: 'Save and sync', testConnection: 'Test the connection', testing: 'Testing…',
  testOkPrivate: 'It works. The repository is private.', testOkPublic: 'It works, but the repository is public: anyone can read your data. Make it private.',
  disconnect: 'Disconnect this device', disconnectQ: 'Disconnect this device? The token is deleted from here; the data stays on the device and on GitHub.', disconnected: 'Disconnected',
  when: 'When', whenDoneText: 'Only if you completed every set last time. The others stay where they are, and it tells you why.', whenAlwaysText: 'Every week, even if you didn\'t complete last time. It still asks first.',
  howMuchPerType: 'How much, per type', stepsHint: 'They apply to every exercise of the type. On an exercise card you can change them or exclude it; switch it on per routine in Edit.',
  increaseIntro: 'Once a week, at the start of the first session, it proposes new targets. You confirm.',
  restBetweenSets: 'Rest between sets', restBetweenExercises: 'Between exercises', vibrateAtEnd: 'Vibrate when rest ends', soundAtEnd: 'Sound when rest ends', keepScreenOn: 'Keep the screen on during a workout', keepScreenOnHint: 'If it still turns off, exclude Palestra from battery saving.',
  trainingHint: 'These are the starting values for new exercises. Each exercise in a routine has its own rest.',
  gymName: 'Gym name', gymNamePh: 'e.g. your gym', units: 'Units', zonesAndMachines: 'Zones and machines',
  contract: 'Data contract', plannedByEveryday: 'Planned by Everyday', nothingYet: 'nothing yet', routinesShared: 'Routines Everyday sees',
  everydayIntro: 'Palestra decides what you do at the gym, Everyday when.',
  everydayExplain: [
    'In Everyday open **Settings → Advanced → Connections → Palestra** and paste a token for **palestra-data** with Contents: Read and write.',
    'Each routine shows in Everyday as a **saved task** with its estimated length. Plan it like the others: how many times a week, windows, the trips there and back.',
    'A workout block in Everyday has **▶ Open in Palestra**. At the end Everyday ticks the block with the real start and end.',
    'Everyday writes only one thing here: the planned workouts, to show you the next one.',
  ],
  backupText: 'Download all your data (zones, machines, exercises, routines, sessions, settings) as a JSON file.', downloadBackup: 'Download the backup',
  backupRepoHint: 'The palestra-data repository also keeps every past version in its history.', thisDevice: 'This device', wipeDevice: 'Delete the data on this device', wipe: 'Delete',
  wipeQSynced: 'Delete the data on this device? I\'ll download it again from GitHub.', wipeQLocal: 'Delete all data? You\'re not connected to GitHub: it can\'t be recovered.', wiped: 'Data deleted from this device',
  guideIntro: 'How to install Palestra and use it, from the first sync to the connection with Everyday.',
};

export const DICTS = { it, en };

export function getLang() {
  const l = state.settings.lang;
  if (l && DICTS[l]) return l;
  const nav = (typeof navigator !== 'undefined' && navigator.language || 'it').slice(0, 2);
  return nav === 'en' ? 'en' : 'it';
}

export function t(key, ...args) {
  const d = DICTS[getLang()];
  let v = d[key];
  if (v === undefined) v = it[key];
  if (v === undefined) return key;
  return typeof v === 'function' ? v(...args) : v;
}
