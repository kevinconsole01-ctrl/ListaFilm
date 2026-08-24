// ============================================
// CINELIST – Main Application
// Firebase v10 Modular SDK + TMDB API
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc, onSnapshot, query, where,
  orderBy, serverTimestamp, arrayUnion, arrayRemove,
  writeBatch, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDatabase, ref as dbRef, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ============ FIREBASE CONFIG ============
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCBBMPlP83jkwhv9tk2wSzdrysD5_URFLI",
  authDomain: "cinelist-mio.firebaseapp.com",
  databaseURL: "https://cinelist-mio-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "cinelist-mio",
  storageBucket: "cinelist-mio.firebasestorage.app",
  messagingSenderId: "223664330406",
  appId: "1:223664330406:web:9cd99532b02f4e2b024667"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ============ TMDB CONFIG ============
const TMDB_API_KEY = "19a3e7d1a5356e8daa2323dabc5e1a2d";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const TMDB_IMG_ORIGINAL = "https://image.tmdb.org/t/p/w780";

// ============ APP STATE ============
let app, auth, db, rtdb;
let currentUser = null;
let currentListId = null;
let currentListData = null;
let currentFilter = "all";
let currentSort = "added";
let currentItems = [];
let searchTimeout = null;
let listUnsubscribe = null;
let itemsUnsubscribe = null;
let listsUnsubscribe = null;
let notifUnsubscribe = null;
let ratingTarget = null; // {listId, itemId, item}
let deleteTarget = null;
let userLists = [];
let isFirebaseConfigured = false;

// ============ INIT ============
function isConfigured() {
  return firebaseConfig.apiKey !== "YOUR_API_KEY";
}

function initFirebase() {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    try {
      rtdb = getDatabase(app);
    } catch (e) {
      console.warn("Realtime Database not configured:", e.message);
    }
    isFirebaseConfigured = true;
    return true;
  } catch (e) {
    console.error("Firebase init error:", e);
    return false;
  }
}

async function bootstrap() {
  showLoading(true);
  
  // Check for shared list in URL
  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get("share");
  
  if (!isConfigured()) {
    showLoading(false);
    showConfigError();
    return;
  }
  
  const ok = initFirebase();
  if (!ok) {
    showLoading(false);
    showConfigError();
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    showLoading(false);
    if (user) {
      currentUser = user;
      await onLogin(user, shareToken);
    } else {
      showAuthScreen();
      if (shareToken) {
        sessionStorage.setItem("pendingShare", shareToken);
      }
    }
  });
}

function showConfigError() {
  document.body.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#080b14;font-family:'Inter',sans-serif;padding:2rem;">
      <div style="max-width:520px;width:100%;background:rgba(17,24,39,0.9);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:2.5rem;text-align:center;">
        <div style="font-size:3rem;margin-bottom:1rem;">⚙️</div>
        <h1 style="color:#f5c842;font-size:1.5rem;margin-bottom:0.5rem;font-family:'Outfit',sans-serif;">Configurazione Firebase richiesta</h1>
        <p style="color:#8b9cbd;line-height:1.6;margin-bottom:1.5rem;">Per usare CineList devi prima configurare Firebase. Apri il file <code style="background:rgba(255,255,255,0.08);padding:0.1rem 0.4rem;border-radius:4px;">app.js</code> e inserisci le tue credenziali Firebase nella variabile <code style="background:rgba(255,255,255,0.08);padding:0.1rem 0.4rem;border-radius:4px;">firebaseConfig</code>.</p>
        <a href="README.md" style="color:#f5c842;text-decoration:none;font-weight:600;">Leggi le istruzioni nel README &rarr;</a>
      </div>
    </div>`;
}

// ============ AUTH ============
function showAuthScreen() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  initParticles();
}

function showApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

function initParticles() {
  const container = document.getElementById("auth-particles");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.className = "auth-particle";
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation-delay: ${Math.random() * 4}s;
      animation-duration: ${3 + Math.random() * 3}s;
      opacity: ${Math.random() * 0.5};
      width: ${1 + Math.random() * 2}px;
      height: ${1 + Math.random() * 2}px;
    `;
    container.appendChild(p);
  }
}

async function onLogin(user, shareToken) {
  // Save user profile
  const userRef = doc(db, "users", user.uid);
  await setDoc(userRef, {
    displayName: user.displayName,
    photoURL: user.photoURL,
    email: user.email,
    lastSeen: serverTimestamp()
  }, { merge: true });

  // Update UI
  document.getElementById("user-name").textContent = user.displayName || "Utente";
  document.getElementById("user-email").textContent = user.email || "";
  const avatar = document.getElementById("user-avatar");
  if (user.photoURL) {
    avatar.src = user.photoURL;
    avatar.onerror = () => { avatar.src = generateAvatar(user.displayName); };
  } else {
    avatar.src = generateAvatar(user.displayName);
  }

  showApp();
  subscribeToLists();
  subscribeToNotifications();

  // Handle pending share link
  const pending = shareToken || sessionStorage.getItem("pendingShare");
  if (pending) {
    sessionStorage.removeItem("pendingShare");
    setTimeout(() => handleShareToken(pending), 500);
  } else {
    showSection("welcome");
  }
}

function generateAvatar(name) {
  const initials = (name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect fill='%231a2235' width='40' height='40' rx='20'/><text x='20' y='26' text-anchor='middle' fill='%23f5c842' font-size='14' font-family='Inter,sans-serif' font-weight='700'>${initials}</text></svg>`;
  return `data:image/svg+xml,${svg}`;
}

// ============ REALTIME LISTS ============
function subscribeToLists() {
  if (listsUnsubscribe) listsUnsubscribe();
  const q = query(
    collection(db, "lists"),
    where("members", "array-contains", currentUser.uid),
    orderBy("createdAt", "desc")
  );
  listsUnsubscribe = onSnapshot(q, (snap) => {
    userLists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderListsSidebar();
    updateStats();
    if (currentListId) {
      const still = userLists.find(l => l.id === currentListId);
      if (!still) { currentListId = null; showSection("welcome"); }
    }
  }, (err) => {
    console.error("Lists subscribe error:", err);
  });
}

function subscribeToNotifications() {
  if (notifUnsubscribe) notifUnsubscribe();
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );
  notifUnsubscribe = onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unread = notifs.filter(n => !n.read).length;
    const badge = document.getElementById("notif-badge");
    if (unread > 0) {
      badge.textContent = unread > 9 ? "9+" : unread;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
    renderNotifications(notifs);
  });
}

// ============ LISTS SIDEBAR ============
function renderListsSidebar() {
  const container = document.getElementById("lists-container");
  const empty = document.getElementById("lists-empty");
  const existing = container.querySelectorAll(".list-item");
  existing.forEach(el => el.remove());

  if (userLists.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  userLists.forEach(list => {
    const item = document.createElement("div");
    item.className = "list-item" + (list.id === currentListId ? " active" : "");
    item.dataset.id = list.id;
    item.innerHTML = `
      <span class="list-item-icon">${list.isShared ? "🔗" : "📋"}</span>
      <span class="list-item-name">${escapeHtml(list.name)}</span>
      <span class="list-item-count">${list.itemCount || 0}</span>
      ${list.isShared ? '<span class="list-item-shared"></span>' : ""}
    `;
    item.addEventListener("click", () => openList(list.id));
    container.appendChild(item);
  });
}

// ============ OPEN LIST ============
async function openList(listId) {
  if (listId === currentListId) {
    closeSidebar();
    return;
  }

  // Unsubscribe previous
  if (listUnsubscribe) listUnsubscribe();
  if (itemsUnsubscribe) itemsUnsubscribe();

  currentListId = listId;
  currentFilter = "all";
  currentSort = "added";
  document.getElementById("sort-select").value = "added";
  document.querySelectorAll(".filter-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.filter === "all");
  });

  showSection("list");
  renderListsSidebar();

  // Subscribe to list metadata
  listUnsubscribe = onSnapshot(doc(db, "lists", listId), (snap) => {
    if (!snap.exists()) return;
    currentListData = { id: snap.id, ...snap.data() };
    renderListHeader();
  });

  // Subscribe to items
  const itemsQ = query(
    collection(db, "lists", listId, "items"),
    orderBy("addedAt", "desc")
  );
  itemsUnsubscribe = onSnapshot(itemsQ, (snap) => {
    currentItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMoviesGrid();
    updateListCounts();
  });

  // Online presence
  if (rtdb) {
    try {
      const presenceRef = dbRef(rtdb, `presence/${listId}/${currentUser.uid}`);
      await set(presenceRef, {
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL || null,
        online: true,
        ts: rtServerTimestamp()
      });
      onDisconnect(presenceRef).remove();

      // Listen to presence
      const listPresenceRef = dbRef(rtdb, `presence/${listId}`);
      onValue(listPresenceRef, (snapshot) => {
        const users = snapshot.val() || {};
        renderOnlineUsers(Object.values(users).filter(u => u.online));
      });
    } catch(e) { /* realtime DB optional */ }
  }

  closeSidebar();
}

function renderListHeader() {
  if (!currentListData) return;
  const { name, isShared, ownerId } = currentListData;

  document.getElementById("list-title-display").textContent = name;
  document.title = `${name} – CineList`;

  const badge = document.getElementById("list-type-badge");
  badge.textContent = isShared ? "🔗 Collaborativa" : "🔒 Privata";
  badge.className = "list-badge " + (isShared ? "shared" : "private");

  const shareBadge = document.getElementById("list-share-mode");
  shareBadge.textContent = "";

  // Topbar title
  document.querySelector(".topbar-title-text").textContent = name;

  // Share button visibility
  const shareBtn = document.getElementById("btn-share-list");
  shareBtn.classList.remove("hidden");
}

function updateListCounts() {
  const total = currentItems.length;
  const watched = currentItems.filter(i => i.watched).length;
  document.getElementById("list-items-count").textContent = `${total} titol${total === 1 ? "o" : "i"}`;
  document.getElementById("list-watched-count").textContent = `${watched} vist${watched === 1 ? "o" : "i"}`;

  // Update sidebar count
  const sideItem = document.querySelector(`.list-item[data-id="${currentListId}"] .list-item-count`);
  if (sideItem) sideItem.textContent = total;
}

function renderOnlineUsers(users) {
  const bar = document.getElementById("online-users-bar");
  if (users.length <= 1) { bar.classList.add("hidden"); return; }
  bar.classList.remove("hidden");
  bar.innerHTML = users.slice(0,5).map(u => {
    if (u.photoURL) {
      return `<img class="online-user-dot" src="${u.photoURL}" title="${escapeHtml(u.displayName || "")}" alt="${escapeHtml(u.displayName || "")}" />`;
    }
    return `<div class="online-user-dot" title="${escapeHtml(u.displayName || "")}">${(u.displayName||"?")[0].toUpperCase()}</div>`;
  }).join("") + `<span class="online-count-label">${users.length} online</span>`;
}

// ============ MOVIES GRID ============
function renderMoviesGrid() {
  const grid = document.getElementById("movies-grid");
  const empty = document.getElementById("list-empty-state");
  
  let items = [...currentItems];

  // Filter
  if (currentFilter === "watched") items = items.filter(i => i.watched);
  else if (currentFilter === "unwatched") items = items.filter(i => !i.watched);

  // Sort
  if (currentSort === "alpha") items.sort((a,b) => a.title.localeCompare(b.title, "it"));
  else if (currentSort === "rating") items.sort((a,b) => (b.tmdbRating||0) - (a.tmdbRating||0));
  else if (currentSort === "myrating") items.sort((a,b) => {
    const ra = a.userRatings?.[currentUser.uid] || 0;
    const rb = b.userRatings?.[currentUser.uid] || 0;
    return rb - ra;
  });
  else if (currentSort === "year") items.sort((a,b) => (b.year||0) - (a.year||0));
  else items.sort((a,b) => {
    const ta = a.addedAt?.seconds || 0;
    const tb = b.addedAt?.seconds || 0;
    return tb - ta;
  });

  grid.innerHTML = "";

  if (items.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  items.forEach((item, idx) => {
    const card = createMovieCard(item);
    card.style.animationDelay = `${idx * 40}ms`;
    grid.appendChild(card);
  });
}

function createMovieCard(item) {
  const myRating = item.userRatings?.[currentUser.uid] || 0;
  const myNotes = item.userNotes?.[currentUser.uid] || "";
  const posterUrl = item.posterPath ? TMDB_IMG + item.posterPath : null;

  const card = document.createElement("div");
  card.className = "movie-card" + (item.watched ? " watched" : "");
  card.dataset.id = item.id;

  card.innerHTML = `
    <div class="movie-poster-wrap">
      ${posterUrl
        ? `<img class="movie-poster" src="${posterUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
        : `<div class="movie-poster-placeholder">${item.type === "tv" ? "📺" : "🎬"}</div>`
      }
      <span class="movie-type-badge ${item.type}">${item.type === "tv" ? "Serie" : "Film"}</span>
      ${item.watched ? `<div class="movie-watched-badge">✓</div>` : ""}
      ${item.tmdbRating ? `<div class="movie-rating-badge">⭐ ${item.tmdbRating.toFixed(1)}</div>` : ""}
      <div class="movie-overlay">
        <div class="movie-overlay-actions">
          <button class="overlay-btn watch-btn" data-action="watch" data-id="${item.id}">
            ${item.watched ? "↩ Rimuovi" : "✓ Visto"}
          </button>
          <button class="overlay-btn rate-btn" data-action="rate" data-id="${item.id}">
            ${myRating ? "⭐ " + myRating : "Vota"}
          </button>
          <button class="overlay-btn remove-btn" data-action="remove" data-id="${item.id}">
            🗑
          </button>
        </div>
      </div>
    </div>
    <div class="movie-info">
      <div class="movie-title">${escapeHtml(item.title)}</div>
      <div class="movie-meta">
        ${item.year ? `<span>${item.year}</span><span>·</span>` : ""}
        <span>${item.addedByName || "?"}</span>
      </div>
      ${myRating ? `<div class="my-rating">⭐ Il mio voto: ${myRating}/10</div>` : ""}
    </div>
  `;

  // Events
  card.querySelector(".movie-poster-wrap").addEventListener("click", (e) => {
    if (e.target.closest(".overlay-btn")) return;
    openMovieDetail(item);
  });
  card.querySelector(".movie-info").addEventListener("click", () => openMovieDetail(item));

  card.querySelector('[data-action="watch"]').addEventListener("click", (e) => {
    e.stopPropagation();
    toggleWatched(item);
  });
  card.querySelector('[data-action="rate"]').addEventListener("click", (e) => {
    e.stopPropagation();
    openRateModal(item);
  });
  card.querySelector('[data-action="remove"]').addEventListener("click", (e) => {
    e.stopPropagation();
    removeItemFromList(item.id);
  });

  return card;
}

// ============ TOGGLE WATCHED ============
async function toggleWatched(item) {
  if (!currentListId) return;
  const newWatched = !item.watched;
  const itemRef = doc(db, "lists", currentListId, "items", item.id);
  
  const updateData = {
    watched: newWatched,
    watchedAt: newWatched ? serverTimestamp() : null,
    watchedBy: newWatched ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid)
  };

  try {
    await updateDoc(itemRef, updateData);
    
    // Update list itemCount and watchedCount
    await updateDoc(doc(db, "lists", currentListId), {
      watchedCount: increment(newWatched ? 1 : -1)
    });

    // Notify collaborators
    if (currentListData?.isShared && newWatched) {
      await notifyCollaborators("watched", item);
    }

    showToast(newWatched ? `✅ "${item.title}" segnato come visto!` : `↩ "${item.title}" rimosso dai visti`, "success");
  } catch (e) {
    showToast("Errore: " + e.message, "error");
  }
}

// ============ REMOVE ITEM ============
async function removeItemFromList(itemId) {
  if (!currentListId) return;
  try {
    await deleteDoc(doc(db, "lists", currentListId, "items", itemId));
    await updateDoc(doc(db, "lists", currentListId), {
      itemCount: increment(-1)
    });
    showToast("Rimosso dalla lista", "info");
  } catch (e) {
    showToast("Errore: " + e.message, "error");
  }
}

// ============ MOVIE DETAIL MODAL ============
async function openMovieDetail(item) {
  const myRating = item.userRatings?.[currentUser.uid] || 0;
  const myNotes = item.userNotes?.[currentUser.uid] || "";
  
  const content = document.getElementById("modal-movie-content");
  const posterUrl = item.posterPath ? TMDB_IMG + item.posterPath : null;
  const backdropUrl = item.backdropPath ? TMDB_IMG_ORIGINAL + item.backdropPath : null;

  content.innerHTML = `
    <div class="movie-detail-backdrop">
      ${backdropUrl ? `<img src="${backdropUrl}" alt="" />` : ""}
    </div>
    <div class="movie-detail-body">
      <div class="movie-detail-poster">
        ${posterUrl
          ? `<img src="${posterUrl}" alt="${escapeHtml(item.title)}" />`
          : `<div style="aspect-ratio:2/3;background:var(--bg-3);display:flex;align-items:center;justify-content:center;font-size:2rem;">${item.type==="tv"?"📺":"🎬"}</div>`
        }
      </div>
      <div class="movie-detail-info">
        <div class="movie-detail-title">${escapeHtml(item.title)}</div>
        <div class="movie-detail-meta">
          <span class="movie-type-badge ${item.type}" style="position:static;">${item.type==="tv"?"📺 Serie TV":"🎬 Film"}</span>
          ${item.year ? `<span>${item.year}</span>` : ""}
          ${item.tmdbRating ? `<span class="movie-detail-rating">⭐ ${item.tmdbRating.toFixed(1)}/10</span>` : ""}
          ${item.runtime ? `<span>⏱ ${item.runtime}min</span>` : ""}
        </div>
        ${item.genres?.length ? `<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.75rem;">${item.genres.map(g=>`<span style="font-size:0.7rem;background:var(--bg-3);padding:0.15rem 0.5rem;border-radius:99px;color:var(--text-secondary);">${g}</span>`).join("")}</div>` : ""}
        ${item.overview ? `<div class="movie-detail-overview">${escapeHtml(item.overview.slice(0,300))}${item.overview.length>300?"...":""}</div>` : ""}
        ${myRating ? `<div class="my-rating" style="margin-bottom:0.5rem;">⭐ Il tuo voto: <strong>${myRating}/10</strong></div>` : ""}
        ${myNotes ? `<div class="movie-notes-display">"${escapeHtml(myNotes)}"</div>` : ""}
        ${item.watched && item.watchedAt ? `<div class="movie-watched-date">✅ Visto il ${formatDate(item.watchedAt?.seconds*1000)}</div>` : ""}
        <div class="movie-detail-actions" style="margin-top:1rem;">
          <button class="btn-primary btn-sm" id="detail-watch-btn">
            ${item.watched ? "↩ Segna non visto" : "✅ Segna come visto"}
          </button>
          <button class="btn-secondary btn-sm" id="detail-rate-btn">
            ${myRating ? "⭐ Modifica voto" : "⭐ Vota"}
          </button>
          ${item.tmdbId ? `<a href="https://www.themoviedb.org/${item.type}/${item.tmdbId}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none;">🔗 TMDB</a>` : ""}
        </div>
      </div>
    </div>
  `;

  document.getElementById("detail-watch-btn").addEventListener("click", () => {
    toggleWatched(item);
    closeModal("modal-movie");
  });
  document.getElementById("detail-rate-btn").addEventListener("click", () => {
    closeModal("modal-movie");
    setTimeout(() => openRateModal(item), 100);
  });

  openModal("modal-movie");
}

// ============ RATING MODAL ============
function openRateModal(item) {
  ratingTarget = { listId: currentListId, itemId: item.id, item };
  const myRating = item.userRatings?.[currentUser.uid] || 0;
  const myNotes = item.userNotes?.[currentUser.uid] || "";

  const info = document.getElementById("rate-movie-info");
  info.innerHTML = `
    ${item.posterPath ? `<img src="${TMDB_IMG + item.posterPath}" alt="" />` : ""}
    <span class="rate-movie-title">${escapeHtml(item.title)} ${item.year ? `(${item.year})` : ""}</span>
  `;

  // Set stars
  document.querySelectorAll(".star").forEach(s => {
    s.classList.toggle("active", parseInt(s.dataset.value) <= myRating);
  });
  document.getElementById("star-label").textContent = myRating ? starLabel(myRating) : "Nessun voto";
  document.getElementById("movie-notes").value = myNotes;

  openModal("modal-rate");
}

async function saveRating() {
  if (!ratingTarget) return;
  const { listId, itemId, item } = ratingTarget;
  
  const activeStars = document.querySelectorAll(".star.active");
  const rating = activeStars.length;
  const notes = document.getElementById("movie-notes").value.trim();

  try {
    const itemRef = doc(db, "lists", listId, "items", itemId);
    const updateData = {};
    if (rating > 0) {
      updateData[`userRatings.${currentUser.uid}`] = rating;
    }
    if (notes) {
      updateData[`userNotes.${currentUser.uid}`] = notes;
    }
    await updateDoc(itemRef, updateData);
    showToast(`Voto ${rating}/10 salvato!`, "success");
    closeModal("modal-rate");
  } catch (e) {
    showToast("Errore: " + e.message, "error");
  }
}

async function removeRating() {
  if (!ratingTarget) return;
  const { listId, itemId } = ratingTarget;
  try {
    const itemRef = doc(db, "lists", listId, "items", itemId);
    const updateData = {};
    updateData[`userRatings.${currentUser.uid}`] = null;
    updateData[`userNotes.${currentUser.uid}`] = null;
    await updateDoc(itemRef, updateData);
    showToast("Voto rimosso", "info");
    closeModal("modal-rate");
  } catch (e) {
    showToast("Errore: " + e.message, "error");
  }
}

// ============ LIST MANAGEMENT ============
async function createList(name, isShared) {
  if (!name.trim()) return;
  try {
    const shareToken = isShared ? generateToken() : null;
    const listRef = await addDoc(collection(db, "lists"), {
      name: name.trim(),
      isShared: isShared,
      shareToken: shareToken,
      ownerId: currentUser.uid,
      members: [currentUser.uid],
      itemCount: 0,
      watchedCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    showToast(`✅ Lista "${name}" creata!`, "success");
    closeModal("modal-new-list");
    await openList(listRef.id);
  } catch (e) {
    showToast("Errore: " + e.message, "error");
  }
}

async function renameList(newName) {
  if (!newName.trim() || !currentListId) return;
  try {
    await updateDoc(doc(db, "lists", currentListId), {
      name: newName.trim(),
      updatedAt: serverTimestamp()
    });
    showToast("Lista rinominata!", "success");
    closeModal("modal-rename-list");
  } catch (e) {
    showToast("Errore: " + e.message, "error");
  }
}

async function deleteList() {
  if (!currentListId) return;
  try {
    // Delete all items subcollection
    const itemsSnap = await getDocs(collection(db, "lists", currentListId, "items"));
    const batch = writeBatch(db);
    itemsSnap.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, "lists", currentListId));
    await batch.commit();
    
    currentListId = null;
    currentListData = null;
    closeModal("modal-confirm-delete");
    showSection("welcome");
    showToast("Lista eliminata", "info");
  } catch (e) {
    showToast("Errore: " + e.message, "error");
  }
}

async function toggleListShared(makeShared) {
  if (!currentListId) return;
  try {
    const shareToken = makeShared ? generateToken() : null;
    await updateDoc(doc(db, "lists", currentListId), {
      isShared: makeShared,
      shareToken: shareToken
    });
    showToast(makeShared ? "Lista resa collaborativa!" : "Lista resa privata", "success");
    closeModal("modal-share");
  } catch (e) {
    showToast("Errore: " + e.message, "error");
  }
}

// ============ SHARE ============
function openShareModal() {
  if (!currentListData) return;
  const { isShared, shareToken } = currentListData;
  const shareLink = shareToken
    ? `${window.location.origin}${window.location.pathname}?share=${shareToken}`
    : null;

  const linkInput = document.getElementById("share-link-input");
  const makePrivate = document.getElementById("btn-make-private");
  const makePublic = document.getElementById("btn-make-public");

  if (isShared && shareLink) {
    linkInput.value = shareLink;
    linkInput.parentElement.style.display = "flex";
    makePrivate.classList.remove("hidden");
    makePublic.classList.add("hidden");
  } else {
    linkInput.value = "Rendi la lista collaborativa per ottenere un link";
    linkInput.parentElement.style.display = "flex";
    makePrivate.classList.add("hidden");
    makePublic.classList.remove("hidden");
  }

  openModal("modal-share");
}

async function handleShareToken(token) {
  try {
    const q = query(collection(db, "lists"), where("shareToken", "==", token));
    const snap = await getDocs(q);
    if (snap.empty) {
      showToast("Link non valido o lista non trovata", "error");
      showSection("welcome");
      return;
    }
    const listDoc = snap.docs[0];
    const listId = listDoc.id;
    const listData = listDoc.data();

    // Add current user to members if not already there
    if (!listData.members?.includes(currentUser.uid)) {
      await updateDoc(doc(db, "lists", listId), {
        members: arrayUnion(currentUser.uid)
      });
      // Notify owner
      if (listData.ownerId !== currentUser.uid) {
        await addDoc(collection(db, "notifications"), {
          recipientId: listData.ownerId,
          type: "joined",
          actorId: currentUser.uid,
          actorName: currentUser.displayName || "Utente",
          actorPhoto: currentUser.photoURL || null,
          listId: listId,
          listName: listData.name,
          read: false,
          createdAt: serverTimestamp()
        });
      }
      showToast(`🎉 Ti sei unito alla lista "${listData.name}"!`, "success");
    }
    
    // Clear URL
    window.history.replaceState({}, "", window.location.pathname);
    openList(listId);
  } catch (e) {
    showToast("Errore: " + e.message, "error");
    showSection("welcome");
  }
}

// ============ ADD ITEM ============
async function addItemToList(tmdbItem) {
  if (!currentListId) return;
  
  // Check if already in list
  const exists = currentItems.some(i => i.tmdbId === tmdbItem.id && i.type === tmdbItem.type);
  if (exists) {
    showToast("Già presente in lista!", "info");
    return;
  }

  try {
    // Fetch extra details from TMDB
    let runtime = null;
    let genres = [];
    let backdropPath = tmdbItem.backdrop_path || null;
    try {
      const detailRes = await fetch(`${TMDB_BASE}/${tmdbItem.type}/${tmdbItem.id}?api_key=${TMDB_API_KEY}&language=it-IT`);
      const detail = await detailRes.json();
      runtime = detail.runtime || (detail.episode_run_time?.[0]) || null;
      genres = (detail.genres || []).map(g => g.name);
      backdropPath = detail.backdrop_path || backdropPath;
    } catch(e) { /* optional */ }

    const newItem = {
      tmdbId: tmdbItem.id,
      type: tmdbItem.type,
      title: tmdbItem.title || tmdbItem.name,
      originalTitle: tmdbItem.original_title || tmdbItem.original_name || null,
      posterPath: tmdbItem.poster_path || null,
      backdropPath: backdropPath,
      year: tmdbItem.release_date?.slice(0,4) || tmdbItem.first_air_date?.slice(0,4) || null,
      tmdbRating: tmdbItem.vote_average || null,
      overview: tmdbItem.overview || null,
      runtime: runtime,
      genres: genres,
      watched: false,
      watchedAt: null,
      watchedBy: [],
      userRatings: {},
      userNotes: {},
      addedBy: currentUser.uid,
      addedByName: currentUser.displayName || "Utente",
      addedAt: serverTimestamp()
    };

    await addDoc(collection(db, "lists", currentListId, "items"), newItem);
    await updateDoc(doc(db, "lists", currentListId), {
      itemCount: increment(1),
      updatedAt: serverTimestamp()
    });

    // Notify collaborators
    if (currentListData?.isShared) {
      await notifyCollaborators("added", { title: newItem.title });
    }

    showToast(`✅ "${newItem.title}" aggiunto!`, "success");
    
    // Mark as added in search results
    const addBtn = document.querySelector(`.search-result-add[data-tmdb="${tmdbItem.id}"]`);
    if (addBtn) {
      addBtn.classList.add("added");
      addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
  } catch (e) {
    showToast("Errore: " + e.message, "error");
  }
}

// ============ TMDB SEARCH ============
async function searchTMDB(query) {
  if (!query.trim()) {
    hideSearchResults();
    return;
  }

  const resultsDiv = document.getElementById("search-results");
  resultsDiv.classList.remove("hidden");
  resultsDiv.innerHTML = `<div class="search-loading">🎬 Cerco "${escapeHtml(query)}"...</div>`;

  try {
    const res = await fetch(`${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&language=it-IT&query=${encodeURIComponent(query)}&include_adult=false`);
    const data = await res.json();
    const results = (data.results || [])
      .filter(r => r.media_type === "movie" || r.media_type === "tv")
      .slice(0, 12);

    if (results.length === 0) {
      resultsDiv.innerHTML = `<div class="search-loading">Nessun risultato per "${escapeHtml(query)}"</div>`;
      return;
    }

    resultsDiv.innerHTML = "";
    results.forEach(item => {
      item.type = item.media_type;
      const title = item.title || item.name;
      const year = (item.release_date || item.first_air_date || "").slice(0,4);
      const poster = item.poster_path ? TMDB_IMG + item.poster_path : null;
      const isAdded = currentItems.some(i => i.tmdbId === item.id && i.type === item.type);

      const el = document.createElement("div");
      el.className = "search-result-item";
      el.innerHTML = `
        ${poster
          ? `<img src="${poster}" alt="${escapeHtml(title)}" />`
          : `<div style="width:40px;height:58px;border-radius:6px;background:var(--bg-3);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${item.type==="tv"?"📺":"🎬"}</div>`
        }
        <div class="search-result-info">
          <div class="search-result-title">${escapeHtml(title)}</div>
          <div class="search-result-meta">
            <span class="search-result-type ${item.type === "tv" ? "type-tv" : "type-movie"}">${item.type==="tv"?"Serie TV":"Film"}</span>
            ${year ? `<span>${year}</span>` : ""}
            ${item.vote_average ? `<span>⭐ ${item.vote_average.toFixed(1)}</span>` : ""}
          </div>
        </div>
        <button class="search-result-add ${isAdded ? "added" : ""}" data-tmdb="${item.id}" aria-label="Aggiungi">
          ${isAdded
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
          }
        </button>
      `;
      
      el.querySelector(".search-result-add").addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isAdded) addItemToList(item);
      });
      el.addEventListener("click", () => {
        if (!isAdded) addItemToList(item);
      });

      resultsDiv.appendChild(el);
    });
  } catch (e) {
    resultsDiv.innerHTML = `<div class="search-loading">Errore di ricerca: ${e.message}</div>`;
  }
}

function hideSearchResults() {
  document.getElementById("search-results").classList.add("hidden");
}

// ============ NOTIFICATIONS ============
async function notifyCollaborators(type, item) {
  if (!currentListData?.members) return;
  const others = currentListData.members.filter(uid => uid !== currentUser.uid);
  const batch = writeBatch(db);
  others.forEach(uid => {
    const nRef = doc(collection(db, "notifications"));
    batch.set(nRef, {
      recipientId: uid,
      type: type,
      actorId: currentUser.uid,
      actorName: currentUser.displayName || "Qualcuno",
      actorPhoto: currentUser.photoURL || null,
      listId: currentListId,
      listName: currentListData.name,
      itemTitle: item.title || "",
      read: false,
      createdAt: serverTimestamp()
    });
  });
  try { await batch.commit(); } catch(e) { /* notifications are optional */ }
}

function renderNotifications(notifs) {
  const list = document.getElementById("notifications-list");
  if (notifs.length === 0) {
    list.innerHTML = `<div class="notif-empty"><span>🔔</span><p>Nessuna notifica</p></div>`;
    return;
  }

  list.innerHTML = notifs.slice(0, 30).map(n => {
    const msg = getNotifMessage(n);
    return `
      <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}" data-list="${n.listId}">
        ${n.actorPhoto
          ? `<img class="notif-avatar" src="${escapeHtml(n.actorPhoto)}" alt="" />`
          : `<div class="notif-avatar" style="display:flex;align-items:center;justify-content:center;font-size:1rem;background:var(--bg-3);">${(n.actorName||"?")[0]}</div>`
        }
        <div class="notif-body">
          <div class="notif-text">${msg}</div>
          <div class="notif-time">${n.createdAt ? timeAgo(n.createdAt.seconds * 1000) : ""}</div>
        </div>
        ${!n.read ? '<div class="notif-unread-dot"></div>' : ""}
      </div>
    `;
  }).join("");

  list.querySelectorAll(".notif-item").forEach(el => {
    el.addEventListener("click", async () => {
      const nId = el.dataset.id;
      const lId = el.dataset.list;
      // Mark read
      await updateDoc(doc(db, "notifications", nId), { read: true }).catch(() => {});
      // Navigate to list
      if (lId) openList(lId);
      showSection("list");
    });
  });
}

async function markAllNotificationsRead() {
  const q = query(collection(db, "notifications"), where("recipientId", "==", currentUser.uid), where("read", "==", false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
  showToast("Tutte le notifiche lette", "info");
}

function getNotifMessage(n) {
  const actor = `<strong>${escapeHtml(n.actorName || "Qualcuno")}</strong>`;
  const list = `<strong>${escapeHtml(n.listName || "una lista")}</strong>`;
  const item = n.itemTitle ? `<strong>${escapeHtml(n.itemTitle)}</strong>` : "";
  switch(n.type) {
    case "added": return `${actor} ha aggiunto ${item} alla lista ${list}`;
    case "watched": return `${actor} ha segnato ${item} come visto in ${list}`;
    case "joined": return `${actor} si è unito alla tua lista ${list}`;
    default: return `Aggiornamento in ${list}`;
  }
}

// ============ STATS ============
function updateStats() {
  // Flatten all items from all lists
  // We listen to each list's items – simplified version using counts from list metadata
  const totalTitles = userLists.reduce((s, l) => s + (l.itemCount || 0), 0);
  const totalWatched = userLists.reduce((s, l) => s + (l.watchedCount || 0), 0);
  
  document.getElementById("stat-total-movies").textContent = totalTitles;
  document.getElementById("stat-watched").textContent = totalWatched;
  
  // Estimate hours (avg 1.8h per movie/episode)
  const hours = Math.round(totalWatched * 1.8);
  document.getElementById("stat-hours").textContent = hours + "h";
  
  // Stats from current items for rating
  if (currentItems.length > 0) {
    const ratings = currentItems
      .map(i => i.userRatings?.[currentUser?.uid])
      .filter(r => r && r > 0);
    if (ratings.length > 0) {
      const avg = (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(1);
      document.getElementById("stat-avg-rating").textContent = avg + "/10";
    }
  } else {
    document.getElementById("stat-avg-rating").textContent = "—";
  }
  
  renderStatsCharts();
}

async function renderStatsCharts() {
  // Genre chart from current list
  const genreCount = {};
  currentItems.forEach(item => {
    (item.genres || []).forEach(g => {
      genreCount[g] = (genreCount[g] || 0) + 1;
    });
  });
  
  const genres = Object.entries(genreCount).sort((a,b) => b[1]-a[1]).slice(0,6);
  const maxCount = genres[0]?.[1] || 1;
  
  const genreChart = document.getElementById("genre-chart");
  if (genres.length === 0) {
    genreChart.innerHTML = `<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:1rem;">Aggiungi film con generi per vedere le statistiche</div>`;
  } else {
    genreChart.innerHTML = genres.map(([g, c]) => `
      <div class="genre-row">
        <span class="genre-label">${g}</span>
        <div class="genre-bar-wrap"><div class="genre-bar" style="width:${(c/maxCount*100).toFixed(0)}%"></div></div>
        <span class="genre-count">${c}</span>
      </div>
    `).join("");
  }
  
  // Recent watched
  const recentWatched = [...currentItems]
    .filter(i => i.watched && i.watchedAt)
    .sort((a,b) => (b.watchedAt?.seconds||0) - (a.watchedAt?.seconds||0))
    .slice(0,5);
  
  const recentDiv = document.getElementById("recent-watched");
  if (recentWatched.length === 0) {
    recentDiv.innerHTML = `<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:1rem;">Nessun titolo visto ancora</div>`;
  } else {
    recentDiv.innerHTML = recentWatched.map(i => `
      <div class="recent-item">
        ${i.posterPath ? `<img src="${TMDB_IMG+i.posterPath}" alt="" />` : `<div style="width:32px;height:48px;background:var(--bg-3);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1rem;">${i.type==="tv"?"📺":"🎬"}</div>`}
        <div class="recent-item-info">
          <div class="recent-item-title">${escapeHtml(i.title)}</div>
          <div class="recent-item-date">${i.watchedAt ? formatDate(i.watchedAt.seconds*1000) : ""}</div>
        </div>
      </div>
    `).join("");
  }
}

// ============ SECTION MANAGEMENT ============
function showSection(name) {
  const sections = ["welcome", "stats", "notifications", "list"];
  sections.forEach(s => {
    const el = document.getElementById(`state-${s}`);
    if (el) el.classList.toggle("hidden", s !== name);
  });

  // Nav active state
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.section === name);
  });

  // Update topbar
  const titles = { welcome: "CineList", stats: "Statistiche", notifications: "Notifiche" };
  if (name !== "list") {
    document.querySelector(".topbar-title-text").textContent = titles[name] || "CineList";
    document.getElementById("btn-share-list").classList.add("hidden");
    document.getElementById("online-users-bar").classList.add("hidden");
    document.title = "CineList – La tua lista film collaborativa";
    // Unsubscribe from list if leaving
    if (name !== "list" && name !== "stats") {
      currentListId = null;
      renderListsSidebar();
    }
  }
  
  if (name === "stats") updateStats();
}

// ============ UTILS ============
function generateToken() {
  return Math.random().toString(36).slice(2,8) + Date.now().toString(36);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ts) {
  if (!ts) return "";
  return new Intl.DateTimeFormat("it-IT", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(ts));
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "adesso";
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours===1?"ora":"ore"} fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days===1?"giorno":"giorni"} fa`;
  return formatDate(ts);
}

function starLabel(r) {
  const labels = {1:"Pessimo 😤",2:"Molto scarso 😞",3:"Scarso 😕",4:"Sotto la media 😐",5:"Nella media 🙂",6:"Discreto 👍",7:"Buono 😊",8:"Molto buono 🤩",9:"Eccellente 🌟",10:"Capolavoro 🏆"};
  return labels[r] || `${r}/10`;
}

function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showLoading(show) {
  document.getElementById("loading-overlay").classList.toggle("hidden", !show);
}

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
  // Only restore overflow if no other modal is open
  if (!document.querySelector(".modal-overlay:not(.hidden)")) {
    document.body.style.overflow = "";
  }
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("open");
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {

  // Auth
  document.getElementById("btn-google-login").addEventListener("click", async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        showToast("Errore di accesso: " + e.message, "error");
      }
    }
  });

  document.getElementById("btn-logout").addEventListener("click", async () => {
    if (listUnsubscribe) listUnsubscribe();
    if (itemsUnsubscribe) itemsUnsubscribe();
    if (listsUnsubscribe) listsUnsubscribe();
    if (notifUnsubscribe) notifUnsubscribe();
    await signOut(auth);
    showAuthScreen();
    showToast("Disconnesso. Arrivederci! 👋", "info");
  });

  // Sidebar
  document.getElementById("btn-menu-toggle").addEventListener("click", openSidebar);
  document.getElementById("btn-sidebar-toggle").addEventListener("click", closeSidebar);
  document.getElementById("sidebar-overlay").addEventListener("click", closeSidebar);

  // Nav
  document.getElementById("nav-stats").addEventListener("click", () => showSection("stats"));
  document.getElementById("nav-notifications").addEventListener("click", () => showSection("notifications"));
  document.getElementById("btn-mark-all-read").addEventListener("click", markAllNotificationsRead);

  // New list
  document.getElementById("btn-new-list").addEventListener("click", () => openModal("modal-new-list"));
  document.getElementById("btn-welcome-new-list").addEventListener("click", () => openModal("modal-new-list"));
  document.getElementById("btn-close-new-list-modal").addEventListener("click", () => closeModal("modal-new-list"));
  document.getElementById("btn-cancel-new-list").addEventListener("click", () => closeModal("modal-new-list"));
  document.getElementById("btn-confirm-new-list").addEventListener("click", () => {
    const name = document.getElementById("new-list-name").value.trim();
    const type = document.querySelector("input[name='list-type']:checked").value;
    createList(name, type === "shared");
  });
  document.getElementById("new-list-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-confirm-new-list").click();
  });

  // Join list
  document.getElementById("btn-join-list").addEventListener("click", () => openModal("modal-join"));
  document.getElementById("btn-close-join-modal").addEventListener("click", () => closeModal("modal-join"));
  document.getElementById("btn-cancel-join").addEventListener("click", () => closeModal("modal-join"));
  document.getElementById("btn-confirm-join").addEventListener("click", () => {
    const val = document.getElementById("join-link-input").value.trim();
    const token = val.includes("share=") ? new URL(val).searchParams.get("share") : val;
    if (token) handleShareToken(token);
    else showToast("Inserisci un link valido", "error");
    closeModal("modal-join");
  });

  // Rename list
  document.getElementById("btn-rename-list").addEventListener("click", () => {
    document.getElementById("rename-list-input").value = currentListData?.name || "";
    openModal("modal-rename-list");
  });
  document.getElementById("list-title-display").addEventListener("dblclick", () => {
    document.getElementById("rename-list-input").value = currentListData?.name || "";
    openModal("modal-rename-list");
  });
  document.getElementById("btn-close-rename-modal").addEventListener("click", () => closeModal("modal-rename-list"));
  document.getElementById("btn-cancel-rename").addEventListener("click", () => closeModal("modal-rename-list"));
  document.getElementById("btn-confirm-rename").addEventListener("click", () => {
    renameList(document.getElementById("rename-list-input").value);
  });
  document.getElementById("rename-list-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-confirm-rename").click();
  });

  // Delete list
  document.getElementById("btn-delete-list").addEventListener("click", () => openModal("modal-confirm-delete"));
  document.getElementById("btn-confirm-delete").addEventListener("click", deleteList);
  document.getElementById("btn-cancel-delete").addEventListener("click", () => closeModal("modal-confirm-delete"));

  // Share
  document.getElementById("btn-share-list").addEventListener("click", openShareModal);
  document.getElementById("btn-close-share-modal").addEventListener("click", () => closeModal("modal-share"));
  document.getElementById("btn-copy-link").addEventListener("click", () => {
    const val = document.getElementById("share-link-input").value;
    navigator.clipboard.writeText(val).then(() => showToast("Link copiato!", "success"));
  });
  document.getElementById("btn-make-private").addEventListener("click", () => toggleListShared(false));
  document.getElementById("btn-make-public").addEventListener("click", () => toggleListShared(true));

  // Search
  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("btn-clear-search");
  searchInput.addEventListener("input", (e) => {
    const val = e.target.value;
    clearBtn.classList.toggle("hidden", !val);
    clearTimeout(searchTimeout);
    if (!val.trim()) { hideSearchResults(); return; }
    searchTimeout = setTimeout(() => searchTMDB(val), 400);
  });
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.classList.add("hidden");
    hideSearchResults();
    searchInput.focus();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-add-bar") && !e.target.closest("#search-results")) {
      hideSearchResults();
    }
  });

  // Filter tabs
  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      renderMoviesGrid();
    });
  });

  // Sort
  document.getElementById("sort-select").addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderMoviesGrid();
  });

  // Movie modal close
  document.getElementById("btn-close-movie-modal").addEventListener("click", () => closeModal("modal-movie"));
  document.getElementById("modal-movie").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-movie")) closeModal("modal-movie");
  });

  // Rate modal
  document.getElementById("btn-close-rate-modal").addEventListener("click", () => closeModal("modal-rate"));
  document.getElementById("btn-confirm-rate").addEventListener("click", saveRating);
  document.getElementById("btn-remove-rating").addEventListener("click", removeRating);

  // Stars
  const stars = document.querySelectorAll(".star");
  stars.forEach(star => {
    star.addEventListener("mouseenter", () => {
      const val = parseInt(star.dataset.value);
      stars.forEach(s => s.classList.toggle("active", parseInt(s.dataset.value) <= val));
      document.getElementById("star-label").textContent = starLabel(val);
    });
    star.addEventListener("click", () => {
      const val = parseInt(star.dataset.value);
      stars.forEach(s => s.classList.toggle("active", parseInt(s.dataset.value) <= val));
      document.getElementById("star-label").textContent = starLabel(val);
    });
  });
  document.getElementById("star-rating").addEventListener("mouseleave", () => {
    const active = document.querySelectorAll(".star.active").length;
    document.getElementById("star-label").textContent = active ? starLabel(active) : "Nessun voto";
  });

  // Close modals on overlay click
  ["modal-new-list","modal-rename-list","modal-share","modal-join","modal-rate","modal-confirm-delete"].forEach(id => {
    document.getElementById(id).addEventListener("click", (e) => {
      if (e.target.id === id) closeModal(id);
    });
  });

  // ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const open = document.querySelector(".modal-overlay:not(.hidden)");
      if (open) closeModal(open.id);
      else closeSidebar();
    }
  });
}

// ============ START ============
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  bootstrap();
});
