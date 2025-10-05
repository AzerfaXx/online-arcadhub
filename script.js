// --- GESTION DU LOADER ---
window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    loader.style.opacity = '0';
    setTimeout(() => {
        loader.style.display = 'none';
    }, 500);
});

// ==================================================================
//               LOGIQUE AUDIO GLOBALE
// ==================================================================

// On crée UN SEUL lecteur audio pour toute la session
const musicPlayer = new Audio('sounds/ambiance.mp3');
musicPlayer.loop = true;
musicPlayer.volume = 0.3;

// Sauvegarde le temps de lecture avant de quitter la page
window.addEventListener('beforeunload', () => {
    if (!musicPlayer.paused) {
        localStorage.setItem('musicCurrentTime', musicPlayer.currentTime);
    }
});

// Fonction de base pour jouer des sons courts (clics, etc.)
function playSound(src, volume = 1.0) {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play();
}

// Logique à exécuter quand la page est prête
document.addEventListener('DOMContentLoaded', () => {

    // --- Son de clic pour tous les boutons et liens ---
    const clickableElements = document.querySelectorAll('button, a');
    clickableElements.forEach(elem => {
        // On s'assure de ne pas ajouter un 2ème son de clic sur le bouton de musique
        if (elem.id !== 'music-toggle-btn') {
            elem.addEventListener('click', () => {
                playSound('sounds/click.mp3'); // Joue le son de clic
            });
        }
    });

    // --- Gestion du bouton de musique d'ambiance ---
    const musicBtn = document.getElementById('music-toggle-btn');

    // Fonction pour synchroniser l'état (musique + bouton)
    const syncMusicState = () => {
        if (localStorage.getItem('musicState') === 'playing') {
            const savedTime = parseFloat(localStorage.getItem('musicCurrentTime') || '0');
            musicPlayer.currentTime = savedTime;
            musicPlayer.play().catch(e => console.error("La lecture auto a été bloquée. Interagissez avec la page."));
            musicBtn.classList.add('playing');
        } else {
            musicPlayer.pause();
            musicBtn.classList.remove('playing');
        }
    };

    // Au clic sur le bouton, on inverse l'état
    musicBtn.addEventListener('click', () => {
        if (musicPlayer.paused) {
            localStorage.setItem('musicState', 'playing');
        } else {
            localStorage.setItem('musicState', 'paused');
            // On supprime le temps sauvegardé quand l'utilisateur met en pause manuellement
            localStorage.removeItem('musicCurrentTime');
        }
        syncMusicState(); // On met à jour l'affichage et le son
    });
    
    // On synchronise dès le chargement de la page
    syncMusicState();
});


// ==================================================================
//               SERVICE WORKER & INSTALLATION
// ==================================================================

// Enregistrement du Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker enregistré !', reg))
      .catch(err => console.error('Erreur d\'enregistrement du SW :', err));
  });
}

// Gestion du prompt d'installation
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'block';
        installBtn.addEventListener('click', async () => {
            installBtn.style.display = 'none';
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
        });
    }
});