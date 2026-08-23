# 🎬 CineList – Lista Film Collaborativa

> App web per creare liste rinominabili di film e serie TV, **collaborative in tempo reale**, con ricerca TMDB, voti personali, statistiche e molto altro.

---

## ✨ Funzionalità

- 📋 **Liste multiple** rinominabili con doppio click
- 🔗 **Collaborazione via link** – condividi e modifica con chiunque in tempo reale  
- 🔒 **Modalità privata** – tieni le tue liste solo per te
- 🎬 **Ricerca TMDB** – migliaia di film e serie TV con poster, anno, rating
- ✅ **Segna come visto** con data automatica
- ⭐ **Voto personale** (1-10) + note per ogni titolo
- 👥 **Presenza online** – vedi chi sta guardando la lista con te
- 🔔 **Notifiche real-time** quando un collaboratore aggiunge o segna come visto
- 📊 **Statistiche** – titoli totali, ore guardate, generi, voto medio
- 📱 **PWA** – installabile su mobile e desktop
- 🌙 **Dark mode** con design glassmorphism

---

## 🚀 Setup Firebase (obbligatorio)

### 1. Crea un progetto Firebase

1. Vai su [console.firebase.google.com](https://console.firebase.google.com)
2. Clicca **"Aggiungi progetto"**
3. Scegli un nome (es. `cinelist-mio`)
4. Puoi disabilitare Google Analytics se vuoi
5. Clicca **"Crea progetto"**

### 2. Configura Authentication

1. Nel pannello Firebase: **Build → Authentication → Get started**
2. Vai nella scheda **"Sign-in method"**
3. Abilita **Google** → salva

### 3. Configura Firestore Database

1. **Build → Firestore Database → Create database**
2. Scegli **"Start in test mode"** (sicuro per sviluppo, da aggiornare in produzione)
3. Scegli la regione più vicina (es. `europe-west1`)
4. Clicca **"Enable"**

### 4. Configura Realtime Database (per presenza online)

1. **Build → Realtime Database → Create database**
2. Scegli la regione
3. Scegli **"Start in test mode"**

### 5. Ottieni le credenziali

1. Vai in **Impostazioni progetto** (icona ⚙️ in alto a sinistra)
2. Nella sezione **"Le tue app"**, clicca sull'icona `</>`  (Web)
3. Dai un nome all'app (es. `cinelist-web`)
4. **Non** selezionare Firebase Hosting (usiamo GitHub Pages)
5. Copia l'oggetto `firebaseConfig` che appare

### 6. Inserisci le credenziali nell'app

Apri `app.js` e cerca la sezione:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  // ...
};
```

Sostituisci con i tuoi valori reali. Es:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAbc123...",
  authDomain: "cinelist-mio.firebaseapp.com",
  databaseURL: "https://cinelist-mio-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "cinelist-mio",
  storageBucket: "cinelist-mio.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 7. Regole Firestore (produzione)

Per uso in produzione, aggiorna le regole di Firestore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Lists: readable/writable by members
    match /lists/{listId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        request.auth.uid in resource.data.members;
      allow delete: if request.auth != null && 
        request.auth.uid == resource.data.ownerId;
        
      // Items subcollection
      match /items/{itemId} {
        allow read, write: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/lists/$(listId)).data.members;
      }
    }
    
    // Notifications
    match /notifications/{notifId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.recipientId;
      allow create: if request.auth != null;
    }
  }
}
```

---

## 🌐 Deploy su GitHub Pages

1. **Crea un repository** su GitHub (es. `cinelist`)
2. **Carica i file**: `index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, `icons/`
3. Vai in **Settings → Pages**
4. Source: **"Deploy from a branch"** → `main` → `/ (root)`
5. Clicca **Save** → dopo qualche minuto l'app è online!

### ⚠️ Importante: aggiungi il dominio GitHub Pages a Firebase Auth

1. Firebase Console → **Authentication → Settings → Authorized domains**
2. Aggiungi: `tuousername.github.io`

---

## 📁 Struttura file

```
/
├── index.html          # App shell
├── style.css           # Design system (dark glassmorphism)
├── app.js              # Logica app (Firebase + TMDB)
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

---

## 🔑 API Keys

- **TMDB API Key** già inclusa nel codice (`19a3e7d1a5356e8daa2323dabc5e1a2d`) – usata solo lato client
- **Firebase Config** → da aggiungere tu (vedi istruzioni sopra)

---

## 🛠️ Uso locale

Puoi aprire `index.html` direttamente nel browser dopo aver configurato Firebase, oppure usare un server locale:

```bash
npx serve .
# oppure
python3 -m http.server 8080
```

---

## 📱 Installazione come PWA

- **Android (Chrome)**: Apri l'app nel browser → menu ⋮ → "Aggiungi a schermata Home"
- **iOS (Safari)**: Apri l'app → icona condivisione → "Aggiungi a schermata Home"  
- **Desktop (Chrome/Edge)**: Icona di installazione nella barra degli indirizzi

---

Made with ❤️ using Firebase + TMDB API
