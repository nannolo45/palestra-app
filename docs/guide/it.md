# Palestra: guida per l'utente

Come preparare Palestra, allenarti con lei ogni settimana e farla lavorare insieme a Everyday.

<div class="desk-only" markdown="1">
**Stai leggendo la guida per il computer.** Le immagini mostrano l'app su uno schermo largo. Dove la guida dice *tocca*, sul computer è un clic. Nel menu in cima, *Mostra la guida per* → **📱 Telefono** passa a quella per il telefono (la scelta resta). Clicca un'immagine per ingrandirla.
</div>
<div class="phone-only" markdown="1">
*Questa è la guida per il telefono. Nel menu in cima, *Mostra la guida per* → **💻 Computer** passa a quella per il computer.*
</div>

## Cos'è Palestra

Palestra ti dice cosa fare in palestra, esercizio per esercizio, e si ricorda cosa hai fatto. Prepari una volta le tue **schede** (Petto e bicipiti, Gambe…), le metti in un **workout**, cioè la tua settimana, e in palestra segui lo schermo: serie, peso, recupero, dove andare dopo.

I tuoi dati stanno in un tuo spazio privato su GitHub, che leggi solo tu (ed Everyday, se lo colleghi). L'app funziona anche senza rete: si sincronizza quando la ritrova.

Palestra non è un programma di allenamento scritto da un coach e non conta le calorie. Decide **cosa** fai: nome, durata ed esercizi. **Quando** lo fai lo decide Everyday.

Un **allenamento** è una scheda fatta davvero: lo trovi nello [Storico](#storico).

## Prima configurazione

Una volta sola, circa venti minuti. Ti serve un account GitHub e la tua palestra in mente: le zone e le macchine che usi.

### 1. Installare l'app

Apri l'indirizzo di Palestra in Chrome. Sul telefono scegli *Installa app* (o *Aggiungi a schermata Home*); sul computer, *Installa* nella barra dell'indirizzo. Da lì aprila dall'icona: si apre a schermo intero e funziona offline.

### 2. Collegare il tuo spazio su GitHub

Su GitHub crea un repository privato e vuoto chiamato `palestra-data`. Poi crea un token per questo dispositivo: *Settings → Developer settings → Fine-grained tokens*, accesso solo a `palestra-data`, permesso *Contents: Read and write*. Chiamalo come il dispositivo, per esempio «Telefono di Tommaso».

In Palestra tocca l'ingranaggio, poi *Collegamento GitHub*. Scrivi il tuo utente, il repository e il token, poi *Salva e sincronizza*.

![Collegamento GitHub: utente, repository e token](guide/it/04-github.webp)

### 3. Disegnare la tua palestra

In *Esercizi → Palestra* aggiungi le **zone** in cui ti sposti (Ingresso e cardio, Sala macchine, Pesi liberi…) e tocca *Riordina* per metterle nell'ordine in cui le attraversi. Le schede useranno questo percorso per farti camminare meno.

![La palestra: le zone nell'ordine del tuo giro](guide/it/05-gym.webp)

In ogni zona tocca **+** per aggiungere una **macchina**, con il numero che ha sopra (M14, C3) e le tue regolazioni (sedile, schienale). Più macchine uguali possono essere una sola voce, come i tapis roulant C1–6.

![Nuova macchina: nome, numero, zona e regolazioni](guide/it/06-new-machine.webp)

### 4. Aggiungere gli esercizi

In *Esercizi* tocca **+**. Scegli il tipo (*Pesi*, *Corpo libero* o *Cardio*), la macchina e il recupero di solito. Le **note** sono facoltative: come eseguirlo, cosa ricordare. Le rivedi durante l'allenamento.

![Un esercizio: tipo, macchina, recupero e note](guide/it/08-exercise.webp)

### 5. Creare le schede

In *Schede* tocca *Nuova scheda*, dai un nome (per esempio «Petto e bicipiti») e aggiungi gli esercizi con *Aggiungi esercizio*. Tocca un esercizio per scegliere serie, ripetizioni, peso e recupero. [Dentro una scheda](#schede) trovi tutto il resto.

![Modifica scheda: l'ordine degli esercizi e l'aumento automatico](guide/it/12-routine-edit.webp)

### 6. Facoltativo: importare un workout già scritto

Se Marco, il tuo istruttore, ti ha scritto la settimana su un foglio o in un messaggio, non devi ricopiarla a mano. Tocca *Importa* accanto a *Nuovo workout* e incolla il testo: un esercizio per riga, come lo scriveresti tu. [Importare da testo](#importare-da-testo) spiega come si scrive.

![Importa: incolla il testo, sotto c'è come scriverlo](guide/it/17-import.webp)

Tocca *Leggi il testo*. Prima di salvare vedi un'anteprima: **già tuo** riusa un tuo esercizio con la sua macchina, **nuovo** lo crea, **da controllare** segna un pezzo che l'app non ha capito.

![L'anteprima: cosa riusa, cosa crea, cosa controllare](guide/it/18-import-preview.webp)

### 7. Rendere attivo un workout

Un **workout** raccoglie le schede della settimana, ognuna nel suo giorno. In *Workout* aprine uno e tocca *Rendi attivo*: da quel momento lo vedi in *Oggi* ed Everyday lo pianifica. Se cambi a metà settimana, scegli se partire da lunedì o da oggi.

![Rendere attivo un workout: quello di prima resta salvato](guide/it/16-activate.webp)

## Le cinque sezioni

| Sezione | A cosa serve |
|---|---|
| *Oggi* | La scheda di oggi, la settimana, l'ultimo allenamento e il mese |
| *Workout* | Le tue settimane: quali schede, in che giorni e a che ora |
| *Schede* | Tutte le tue schede, da cercare, aprire, modificare e iniziare |
| *Esercizi* | Gli esercizi e, in *Palestra*, le zone e le macchine |
| *Storico* | I tuoi progressi e ogni allenamento fatto |

In cima a ogni pagina ci sono le sue azioni, come *Nuova scheda* e *Importa*. L'**ingranaggio** in alto a destra apre le *Impostazioni*: un elenco in tre gruppi (*Collegamenti*, *Allenamento*, *App*). Ogni riga dice com'è impostata ora e apre una pagina sola su quella cosa; *← Impostazioni* in alto torna all'elenco.

In *Impostazioni → Lingua e aspetto*, **Aspetto** sceglie i colori dell'app: *Automatico* segue il telefono o il computer (scuro la sera, se il telefono lo è), *Chiaro* o *Scuro* restano sempre così. La scelta resta su questo dispositivo, e la guida la segue. Durante l'allenamento lo schermo è comunque scuro.

![Impostazioni: ogni cosa nella sua sezione](guide/it/03-settings.webp)

## Oggi

La prima pagina ti dice cosa ti tocca oggi. In alto c'è la scheda del giorno, con l'ora se l'hai data, e *Inizia*. Se Everyday l'ha già messa in agenda, accanto c'è scritto *in Everyday*.

![Oggi: la scheda di oggi alle 18:00 e la settimana](guide/it/01-today.webp)

### Iniziare la scheda di oggi

Tocca *Inizia*. Si apre l'allenamento a schermo intero: [Durante l'allenamento](#durante-lallenamento) spiega cosa vedi.

### Sposta a domani

Oggi non ce la fai? Tocca *Sposta a domani*. La scheda passa a domani solo per questa settimana, e lo vedi nella lista dei giorni. *Rimetti oggi* annulla. Se usi Everyday, alla prossima sincronizzazione sposta anche il blocco: alla stessa ora se è libera, altrimenti nel primo spazio libero di domani.

![Dopo «Sposta a domani»: la scheda è spostata, puoi rimetterla](guide/it/02-moved.webp)

### La settimana e il mese

Sotto vedi le schede della settimana: quelle fatte, la prossima e quelle che restano. Poi il **workout attivo** con *Cambia*, l'ultimo allenamento e un quadretto per ogni giorno del mese, giallo quando ti sei allenato.

## Workout

Un workout è la tua settimana: le schede che fai, ognuna nel suo giorno. Quello **attivo** è in giallo in cima; gli altri restano salvati con il loro storico, per quando ti servono (per esempio una settimana di scarico).

![I tuoi workout: quello attivo in cima](guide/it/14-plans.webp)

### Creare un workout

Tocca *Nuovo workout*, poi *Aggiungi scheda* per ognuna. Trascina una scheda dalla maniglia per cambiare l'ordine. Con *Importa* accanto ad *Aggiungi scheda* aggiungi schede scritte come testo.

![Un workout: le schede, i giorni e le ore](guide/it/15-plan.webp)

### Giorni e ore

Per ogni scheda tocca il giorno della settimana (L M M G V S D) e, se vuoi, scegli un'*Ora*. Con l'ora Everyday la mette in agenda da solo; senza, la scegli tu ogni settimana in Everyday.

### Cambiare il workout attivo

In *Workout* tocca *Rendi attivo* su un altro workout. Se è metà settimana, scegli *Da lunedì* per finire la settimana con quello di prima, o *Da oggi*. Il workout di prima resta salvato.

### Esportare e duplicare

*Esporta .txt* salva il workout come testo, da mandare a qualcuno o da reimportare. *Duplica* ne fa una copia da cambiare senza toccare l'originale.

## Schede

Una scheda è una sequenza di esercizi che ripeti, come «Gambe». Palestra calcola la **durata stimata** dalle serie e dai recuperi, e la corregge con i tuoi tempi veri dopo qualche allenamento.

![Le tue schede, con il workout in cui è ognuna](guide/it/10-routines.webp)

### Trovare una scheda

Scrivi nella ricerca, oppure scegli *Nel workout attivo* o *In nessun workout*. Sotto ogni scheda vedi in quale workout è.

### Dentro una scheda

In alto la durata stimata, le serie e le zone. Poi gli esercizi nell'ordine in cui li fai, con le frecce quando cambi zona. A destra di ogni esercizio c'è **l'ultima volta**: il peso, i minuti o le ripetizioni del tuo ultimo allenamento.

![Una scheda: il piano di oggi e, sotto, l'ultima volta](guide/it/11-routine.webp)

### Modificare una scheda

Tocca *Modifica*.

| Parte | Cosa imposti |
|---|---|
| Nome | Come la vedi qui e in Everyday |
| *Aumento automatico* | Se Palestra ti propone di salire di peso ogni settimana |
| Ordine | Trascina dalla maniglia; *Ordina per percorso* segue il giro della palestra |
| Un esercizio | Toccalo: serie, ripetizioni o secondi, peso, recupero, oppure *Togli dalla scheda* |
| *Aggiungi esercizio* | Sceglilo dall'elenco, o creane uno nuovo |
| *Importa* | Aggiunge esercizi scritti come testo |

![Aggiungi esercizio: l'elenco con la macchina di ognuno](guide/it/13-add-exercise.webp)

### Duplicare in un altro workout

In una scheda tocca *Duplica in un altro workout* e scegli dove. La copia è tua da cambiare: l'originale resta com'era.

## Esercizi e palestra

In *Esercizi* trovi tutti i tuoi esercizi, raggruppati *Per muscolo* o *Per posto*. Filtra per tipo, apri e chiudi i gruppi, o passa alla *Vista compatta* con il pulsante in alto per vederne di più.

![Esercizi: i gruppi, i filtri e la vista compatta](guide/it/07-exercises.webp)

### I tre tipi

| Tipo | Cosa imposti |
|---|---|
| *Pesi* | Serie, ripetizioni, kg e recupero; l'etichetta scura porta il numero della macchina |
| *Corpo libero* | Serie, ripetizioni o secondi, recupero; l'etichetta ha il bordo tratteggiato |
| *Cardio* | La macchina (tapis roulant, ellittica, bike, vogatore…) e gli obiettivi: durata, velocità, pendenza, livello |

![Un esercizio cardio: la macchina e i suoi obiettivi](guide/it/09-exercise-cardio.webp)

### La palestra: zone e macchine

In *Esercizi → Palestra* cambi le zone, il loro ordine e le macchine in ogni zona. Tocca una macchina per il numero, il nome e le regolazioni.

### Una macchina che non c'è

Dalla pagina di un esercizio tocca *Nuova macchina* (o *Altra macchina* per il cardio). Per il cardio scegli cosa misura oltre al tempo, fino a tre cose, o crea una misura tua con nome e unità.

## Durante l'allenamento

Lo schermo diventa scuro e grande, resta acceso e funziona senza rete. Se il telefono si blocca o l'app si ricarica, riaprila: riprende da dove eri.

### Gli aumenti della settimana

Al primo allenamento della settimana, se l'aumento automatico è acceso, Palestra ti propone i nuovi obiettivi: un esercizio per riga, prima e dopo. Togli la spunta a quelli che non vuoi, poi tocca *Conferma … e inizia*, oppure *Inizia con i pesi di prima*.

![Si sale di peso? Togli la spunta a quelli che non vuoi](guide/it/19-increase.webp)

### Una serie

Vedi l'esercizio, la serie (2 di 4), ripetizioni e kg, la macchina con la zona e la tua nota. Se hai fatto diverso, correggi con − e +. Poi tocca *Fatto*.

![Una serie: ripetizioni, kg, dove andare e la tua nota](guide/it/20-set.webp)

### Il recupero

Parte il conto alla rovescia, e vedi quanto hai riposato davvero. *+30 s* allunga, *Salta* riparte subito. A zero il telefono vibra. Sotto c'è cosa viene dopo e dove andare.

![Il recupero: quanto manca e cosa viene dopo](guide/it/21-rest.webp)

### Il cardio

Per il cardio vedi il tempo che manca e gli obiettivi, da cambiare con − e +. Se vuoi, scrivi la distanza che legge il display. Tocca *Fine* quando hai finito.

![Il cardio: il tempo che manca e gli obiettivi](guide/it/22-cardio.webp)

### Pausa e fine

*Pausa*, in alto a destra, ferma il tempo: per una telefonata o una fila alla macchina. **×** chiude prima: le serie fatte si salvano come allenamento parziale. Alla fine vedi il riepilogo: tempo, serie, peso totale, recuperi e i nuovi massimi.

![Fine: il riepilogo dell'allenamento](guide/it/23-summary.webp)

### L'aumento automatico, nelle impostazioni

In *Impostazioni → Aumento automatico* scegli quando (*Se completo*: solo se l'ultima volta hai fatto tutte le serie; *Sempre*) e di quanto per tipo: macchine +2,5 kg, manubri +1, corpo libero +1 ripetizione, cardio +1 minuto. Nella pagina di un esercizio puoi dargli un passo suo o escluderlo.

![Aumento automatico: quando e di quanto, per tipo](guide/it/27-increase-settings.webp)

## Storico

Scegli un esercizio in alto: vedi come è cresciuto il carico, di quanto e l'ultima volta. Sotto ci sono tutti gli allenamenti, completi o parziali.

![Storico: i progressi di un esercizio e gli allenamenti](guide/it/24-history.webp)

### Un allenamento

Toccane uno per vedere dove sono andati i minuti (lavoro, recuperi, spostamenti, pause) e ogni serie che hai fatto.

![Un allenamento: dove sono andati i minuti e ogni serie](guide/it/25-session.webp)

## Importare da testo

Accanto a *Nuovo workout*, *Nuova scheda* e *Aggiungi esercizio* c'è *Importa*. Incolla il testo o scegli un file .txt. Scrivi come scriveresti a mano, una cosa per riga:

| Riga | Cosa vuol dire |
|---|---|
| `WORKOUT: Upper Lower di Marco` | Il nome della settimana (facoltativo) |
| `SCHEDA: Upper @ lun 18:00` | Inizia una scheda; dopo `@` giorno e ora, facoltativi |
| `Panca piana 4x8 60 kg rec 2:30` | Un esercizio: serie x ripetizioni, peso e recupero facoltativi |
| `Plank 3x45s` | Un esercizio a tempo |
| `Ellittica 10 min livello 6` | Cardio, con i suoi obiettivi |
| `(manubri)` | L'attrezzo, se vuoi: (bilanciere), (manubri), (cavi), (macchina) |
| `- Gomiti appena piegati.` | Una nota per l'esercizio sopra |

I file scritti prima, con `SCHEDA:` per la settimana e `GIORNO:` per le schede, si leggono ancora.

## Con Everyday

Palestra decide nome, durata ed esercizi; Everyday decide quando. Per collegarle, in Everyday apri *Impostazioni → Avanzate → Collegamenti → Palestra* e incolla un token per `palestra-data` con *Contents: Read and write*.

![Everyday, nelle impostazioni di Palestra: cosa vede e cosa scrive](guide/it/26-everyday.webp)

- Ogni scheda appare in Everyday come **routine**, con la sua durata stimata.
- Le schede del workout attivo si ripetono da sole nei loro giorni, all'ora che hai scelto. Le altre le pianifichi a mano.
- Un blocco di allenamento in Everyday ha *Apri in Palestra*: apre quella scheda pronta a partire.
- Alla fine Everyday segna fatto il blocco con l'ora vera di inizio e fine, e la durata stimata si avvicina a quella reale.
- *Sposta a domani* in Palestra sposta anche il blocco in Everyday, alla prossima sincronizzazione. *Rimetti oggi* lo riporta dov'era. Un blocco spostato in Everyday si vede nel suo nuovo giorno anche in Palestra.

## Una settimana tipo

**Domenica sera.** Apri *Oggi*: il workout attivo è Petto e bicipiti · Schiena e tricipiti · Gambe, lunedì, mercoledì e sabato. Everyday ha già messo i tre blocchi in agenda.

**Lunedì, 18:00.** In palestra tocchi *Inizia*. È la prima volta della settimana: Palestra ti propone la panca piana a 62,5 kg invece di 60. Confermi. Segui lo schermo serie per serie; dopo l'ellittica ti dice di andare ai pesi liberi, rack R1–2.

**Mercoledì.** Hai una cena di lavoro. A pranzo apri *Oggi* e tocchi *Sposta a domani*: Schiena e tricipiti passa a giovedì, e dopo la sincronizzazione anche il blocco in Everyday è giovedì alle 18:00.

**Sabato mattina.** Gambe alle 10:30. Leg press occupata: tocchi *Pausa*, aspetti, riprendi. Il tempo di attesa non allunga la stima della scheda.

**Domenica.** Nello *Storico* guardi la panca piana: +7,5 kg in quattro settimane.

## Su un computer

Su uno schermo largo le sezioni sono nella barra in alto, accanto al nome dell'app, come in Ricette ed Everyday. A destra ci sono le azioni della pagina (*Nuova scheda* · *Importa*), lo stato della sincronizzazione e l'ingranaggio.

Le pagine usano la larghezza. *Oggi* e *Storico* hanno due colonne. In *Schede* l'elenco e la scheda scelta stanno affiancati. Quando modifichi una scheda, a destra c'è la libreria degli esercizi: cerca e clicca **+** per aggiungere. Gli esercizi sono in una griglia.

Usa un token diverso per ogni dispositivo: telefono e computer restano allineati a ogni sincronizzazione.

## Consigli e problemi comuni

**La sincronizzazione non parte.** Tocca l'ingranaggio e guarda la riga in alto. Se dice errore 401 o 403, il token è scaduto o non vede `palestra-data`: creane uno nuovo e incollalo in *Collegamento GitHub*. Con 404, l'utente o il nome del repository sono sbagliati.

**Lo schermo si spegne durante l'allenamento.** Escludi Palestra dal risparmio batteria del telefono, e controlla che in *Recupero e allenamento* sia acceso lo schermo.

**Il blocco non risulta fatto in Everyday.** Sincronizza Palestra (ingranaggio → *Sync*), poi Everyday.

**Compare la barra Aggiorna.** È uscita una versione nuova: toccala quando non ti stai allenando.

**Vuoi una copia di tutto.** *Impostazioni → I tuoi dati → Backup* scarica tutti i tuoi dati in un file. Il repository su GitHub tiene comunque ogni versione passata.
